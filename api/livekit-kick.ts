import { RoomServiceClient } from 'livekit-server-sdk';
import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import { livekitEnv, livekitHttpUrl } from './_lib/livekit';

/**
 * POST /api/livekit-kick  { battleId, userId }  or  { streamId, userId }
 * Host-only: removes a person from a battle or a live stream and bans them from that room.
 * A banned person cannot rejoin as a competitor or guest, cannot chat there, and gets no microphone or camera.
 * They are disconnected now; they may come back only as a silent viewer.
 */
export default route(async (req, res) => {
  const lk = livekitEnv();
  const { user, db } = await authenticate(req);
  const body = readBody(req);
  const battleId = String(body.battleId ?? '');
  const streamId = String(body.streamId ?? '');
  const targetId = String(body.userId ?? '');
  if (!UUID_RE.test(targetId) || targetId === user.id) throw new HttpError(400, 'Invalid request');

  let roomType: 'battle' | 'live';
  let roomId: string;
  if (UUID_RE.test(battleId)) {
    const { data: battle } = await db.from('battles').select('id,host_id,status').eq('id', battleId).maybeSingle();
    if (!battle) throw new HttpError(404, 'Battle not found');
    if (battle.host_id !== user.id) throw new HttpError(403, 'Only the host can remove people');
    if (battle.status === 'ended') throw new HttpError(409, 'This battle has ended');
    roomType = 'battle';
    roomId = battleId;
  } else if (UUID_RE.test(streamId)) {
    const { data: stream } = await db.from('live_streams').select('id,host_id,status').eq('id', streamId).maybeSingle();
    if (!stream) throw new HttpError(404, 'Live stream not found');
    if (stream.host_id !== user.id) throw new HttpError(403, 'Only the host can remove people');
    if (stream.status === 'ended') throw new HttpError(409, 'This live stream has ended');
    roomType = 'live';
    roomId = streamId;
  } else {
    throw new HttpError(400, 'Invalid request');
  }

  const { error: banError } = await db
    .from('room_bans')
    .upsert(
      { room_type: roomType, room_id: roomId, user_id: targetId, banned_by: user.id },
      { onConflict: 'room_type,room_id,user_id', ignoreDuplicates: true },
    );
  if (banError) throw new HttpError(500, 'Could not remove this person. Run supabase/update-4.sql first.');

  const { error } = roomType === 'battle'
    ? await db.from('battle_contenders').delete().eq('battle_id', roomId).eq('user_id', targetId)
    : await db.from('live_guests').delete().eq('stream_id', roomId).eq('user_id', targetId);
  if (error) throw new HttpError(500, 'Could not remove this person');

  try {
    await new RoomServiceClient(livekitHttpUrl(lk.url), lk.key, lk.secret).removeParticipant(`${roomType}:${roomId}`, targetId);
  } catch {
    // The person may not be connected right now; the ban is what matters.
  }
  res.status(200).json({ ok: true });
});
