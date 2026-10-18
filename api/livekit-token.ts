import { AccessToken } from 'livekit-server-sdk';
import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';

/**
 * POST /api/livekit-token  { room: "battle:<id>" | "group:<id>" | "dm:<idA>:<idB>" }
 * Returns a short-lived LiveKit token. The server decides who may join and who may publish:
 *   battle: anyone signed in can watch; only contenders can publish audio/video
 *   group:  members only
 *   dm:     the two participants only (and not blocked)
 */
export default route(async (req, res) => {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new HttpError(503, 'LiveKit is not configured on the server');
  }
  const { user, db } = await authenticate(req);
  const room = String(readBody(req).room ?? '');
  const parts = room.split(':');
  let canPublish = false;

  if (parts[0] === 'battle' && parts.length === 2 && UUID_RE.test(parts[1])) {
    const { data: battle } = await db.from('battles').select('id,status').eq('id', parts[1]).maybeSingle();
    if (!battle) throw new HttpError(404, 'Battle not found');
    if (battle.status === 'ended') throw new HttpError(403, 'This battle has ended');
    const { data: contender } = await db
      .from('battle_contenders').select('user_id').eq('battle_id', parts[1]).eq('user_id', user.id).maybeSingle();
    canPublish = Boolean(contender);
  } else if (parts[0] === 'group' && parts.length === 2 && UUID_RE.test(parts[1])) {
    const { data: member } = await db
      .from('group_members').select('user_id').eq('group_id', parts[1]).eq('user_id', user.id).maybeSingle();
    if (!member) throw new HttpError(403, 'Join this squad first');
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

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: user.id,
    name: profile.display_name as string,
    ttl: '2h',
  });
  token.addGrant({ room, roomJoin: true, canSubscribe: true, canPublish, canPublishData: false });
  res.status(200).json({ token: await token.toJwt(), url: LIVEKIT_URL, canPublish });
});
