import { RoomServiceClient } from 'livekit-server-sdk';
import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import { livekitEnv, livekitHttpUrl } from './_lib/livekit';

/**
 * POST /api/livekit-kick  { battleId, userId }
 * Host-only: removes a contender from the battle and disconnects them from the live room.
 */
export default route(async (req, res) => {
  const lk = livekitEnv();
  const { user, db } = await authenticate(req);
  const body = readBody(req);
  const battleId = String(body.battleId ?? '');
  const targetId = String(body.userId ?? '');
  if (!UUID_RE.test(battleId) || !UUID_RE.test(targetId)) throw new HttpError(400, 'Invalid request');

  const { data: battle } = await db.from('battles').select('id,host_id,status').eq('id', battleId).maybeSingle();
  if (!battle) throw new HttpError(404, 'Battle not found');
  if (battle.host_id !== user.id) throw new HttpError(403, 'Only the host can remove contenders');
  if (battle.status === 'ended') throw new HttpError(409, 'This battle has ended');
  if (targetId === battle.host_id) throw new HttpError(400, 'The host cannot be removed');

  const { error } = await db.from('battle_contenders').delete().eq('battle_id', battleId).eq('user_id', targetId);
  if (error) throw new HttpError(500, 'Could not remove contender');

  try {
    await new RoomServiceClient(livekitHttpUrl(lk.url), lk.key, lk.secret).removeParticipant(`battle:${battleId}`, targetId);
  } catch {
    // The participant may not be connected right now; the database change is what matters.
  }
  res.status(200).json({ ok: true });
});
