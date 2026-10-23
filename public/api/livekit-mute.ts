import { RoomServiceClient } from 'livekit-server-sdk';
import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import { livekitEnv, livekitHttpUrl, publishing } from './_lib/livekit';

/**
 * POST /api/livekit-mute  { battleId, userId, muted }
 * Host-only. Muting removes the competitor's microphone permission (they cannot switch it back on);
 * unmuting gives the permission back and they press their mic button again. The choice is also saved in the
 * database, so it still applies if they reconnect.
 */
export default route(async (req, res) => {
  const lk = livekitEnv();
  const { user, db } = await authenticate(req);
  const body = readBody(req);
  const battleId = String(body.battleId ?? '');
  const targetId = String(body.userId ?? '');
  const muted = body.muted === true;
  if (!UUID_RE.test(battleId) || !UUID_RE.test(targetId)) throw new HttpError(400, 'Invalid request');

  const { data: battle } = await db.from('battles').select('id,host_id,status,mode').eq('id', battleId).maybeSingle();
  if (!battle) throw new HttpError(404, 'Battle not found');
  if (battle.host_id !== user.id) throw new HttpError(403, 'Only the host can mute or unmute');
  if (battle.status === 'ended') throw new HttpError(409, 'This battle has ended');
  if (targetId === battle.host_id) throw new HttpError(400, 'The host controls their own microphone');

  const { data: updated, error } = await db
    .from('battle_contenders').update({ muted }).eq('battle_id', battleId).eq('user_id', targetId).select('user_id');
  if (error) throw new HttpError(500, 'Could not update the mute setting');
  if (!updated?.length) throw new HttpError(404, 'That person is not a contender');

  const room = `battle:${battleId}`;
  const svc = new RoomServiceClient(livekitHttpUrl(lk.url), lk.key, lk.secret);
  const allowed = publishing(battle.mode === 'audio' ? 'audio' : 'video', muted);
  try {
    const permission = { canSubscribe: true, canPublishData: false, canPublish: allowed.canPublish, canPublishSources: allowed.canPublishSources };
    // metadata (3rd argument) stays undefined; the permission object is the 4th. Works across 2.x versions.
    await (svc.updateParticipant as unknown as (r: string, i: string, m: undefined, p: unknown) => Promise<unknown>)(room, targetId, undefined, permission);
    if (muted) {
      // Also silence the track that is already live, in case the permission change is slow to arrive.
      const info = (await svc.getParticipant(room, targetId)) as unknown as { tracks?: Array<{ sid: string; source: number }> };
      for (const track of info.tracks ?? []) {
        if (track.source === 2) await svc.mutePublishedTrack(room, targetId, track.sid, true);
      }
    }
  } catch {
    // The person may not be connected right now. The saved setting is applied the next time they join.
  }
  res.status(200).json({ ok: true, muted });
});
