import { AccessToken } from 'livekit-server-sdk';
import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import { livekitEnv, publishing } from './_lib/livekit';

/**
 * POST /api/livekit-token  { room: "battle:<id>" | "live:<id>" | "group:<id>" | "dm:<idA>:<idB>" }
 * Returns a short-lived LiveKit token. The server decides who may join and who may publish:
 *   battle: anyone signed in can watch; only contenders and the host can publish audio/video
 *           (a contender the host muted gets no microphone permission)
 *   live:   anyone signed in can watch; the host and guests the host approved can publish
 *   group:  members only
 *   dm:     the two participants only (and not blocked)
 */
export default route(async (req, res) => {
  const lk = livekitEnv();
  const { user, db } = await authenticate(req);
  const room = String(readBody(req).room ?? '');
  const parts = room.split(':');
  let canPublish = false;
  let canPublishSources: number[] = [];

  if (parts[0] === 'battle' && parts.length === 2 && UUID_RE.test(parts[1])) {
    const { data: battle } = await db.from('battles').select('id,status,host_id,mode').eq('id', parts[1]).maybeSingle();
    if (!battle) throw new HttpError(404, 'Battle not found');
    if (battle.status === 'ended') throw new HttpError(403, 'This battle has ended');
    const { data: contender } = await db
      .from('battle_contenders').select('user_id,muted').eq('battle_id', parts[1]).eq('user_id', user.id).maybeSingle();
    const isHost = battle.host_id === user.id;
    if (contender || isHost) {
      // The host always keeps their own microphone; contenders lose it while muted.
      const allowed = publishing(battle.mode === 'audio' ? 'audio' : 'video', Boolean(contender?.muted) && !isHost);
      canPublish = allowed.canPublish;
      canPublishSources = allowed.canPublishSources;
    }
  } else if (parts[0] === 'live' && parts.length === 2 && UUID_RE.test(parts[1])) {
    const { data: stream } = await db.from('live_streams').select('id,host_id,status,mode,kind').eq('id', parts[1]).maybeSingle();
    if (!stream) throw new HttpError(404, 'Live stream not found');
    if (stream.status === 'ended') throw new HttpError(403, 'This live stream has ended');
    let onStage = stream.host_id === user.id;
    if (!onStage && stream.kind === 'group') {
      const { data: guest } = await db
        .from('live_guests').select('status').eq('stream_id', parts[1]).eq('user_id', user.id).eq('status', 'approved').maybeSingle();
      onStage = Boolean(guest);
    }
    if (onStage) {
      const allowed = publishing(stream.mode === 'audio' ? 'audio' : 'video', false);
      canPublish = allowed.canPublish;
      canPublishSources = allowed.canPublishSources;
    }
  } else if (parts[0] === 'group' && parts.length === 2 && UUID_RE.test(parts[1])) {
    const { data: member } = await db
      .from('group_members').select('user_id').eq('group_id', parts[1]).eq('user_id', user.id).maybeSingle();
    if (!member) throw new HttpError(403, 'Join this group first');
    canPublish = true;
  } else if (parts[0] === 'dm' && parts.length === 3 && UUID_RE.test(parts[1]) && UUID_RE.test(parts[2])) {
    const [a, b] = [parts[1].toLowerCase(), parts[2].toLowerCase()];
    if (a >= b || (user.id !== a && user.id !== b)) throw new HttpError(403, 'Not your conversation');
    const other = user.id === a ? b : a;
    const [out, back] = await Promise.all([
      db.rpc('can_dm', { p_sender: user.id, p_recipient: other }),
      db.rpc('can_dm', { p_sender: other, p_recipient: user.id }),
    ]);
    if (!out.data && !back.data) throw new HttpError(403, 'Calls are not allowed with this user');
    canPublish = true;
  } else {
    throw new HttpError(400, 'Invalid room');
  }

  const { data: profile } = await db.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  if (!profile) throw new HttpError(403, 'Finish setting up your profile first');

  const token = new AccessToken(lk.key, lk.secret, {
    identity: user.id,
    name: profile.display_name as string,
    ttl: '2h',
  });
  const grant: Record<string, unknown> = { room, roomJoin: true, canSubscribe: true, canPublish, canPublishData: false };
  if (canPublishSources.length) grant.canPublishSources = canPublishSources;
  token.addGrant(grant as never);
  res.status(200).json({ token: await token.toJwt(), url: lk.url, canPublish });
});
