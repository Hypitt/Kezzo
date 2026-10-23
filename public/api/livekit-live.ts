import { RoomServiceClient } from 'livekit-server-sdk';
import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import { livekitEnv, livekitHttpUrl, publishing } from './_lib/livekit';

/**
 * POST /api/livekit-live  { streamId, action: "grant" | "revoke" | "close", userId? }
 * Host-only helpers for a Go Live stream, so changes take effect inside the running LiveKit room without anyone reconnecting:
 *   grant   an approved guest may now send audio/video
 *   revoke  the guest is taken off the stage (their sending permission is removed) and returns to being a viewer
 *   close   the stream has ended: disconnect everyone and delete the room
 */
export default route(async (req, res) => {
  const lk = livekitEnv();
  const { user, db } = await authenticate(req);
  const body = readBody(req);
  const streamId = String(body.streamId ?? '');
  const action = String(body.action ?? '');
  const targetId = String(body.userId ?? '');
  if (!UUID_RE.test(streamId) || !['grant', 'revoke', 'close'].includes(action)) throw new HttpError(400, 'Invalid request');

  const { data: stream } = await db.from('live_streams').select('id,host_id,status,mode').eq('id', streamId).maybeSingle();
  if (!stream) throw new HttpError(404, 'Live stream not found');
  if (stream.host_id !== user.id) throw new HttpError(403, 'Only the host can do this');

  const client = new RoomServiceClient(livekitHttpUrl(lk.url), lk.key, lk.secret);
  const room = `live:${streamId}`;

  try {
    if (action === 'close') {
      if (stream.status !== 'ended') throw new HttpError(409, 'End the stream first');
      await client.deleteRoom(room);
    } else {
      if (!UUID_RE.test(targetId) || targetId === user.id) throw new HttpError(400, 'Invalid request');
      if (action === 'grant') {
        const { data: guest } = await db
          .from('live_guests').select('status').eq('stream_id', streamId).eq('user_id', targetId).eq('status', 'approved').maybeSingle();
        if (!guest) throw new HttpError(403, 'Approve this guest first');
        const allowed = publishing(stream.mode === 'audio' ? 'audio' : 'video', false);
        await client.updateParticipant(room, targetId, undefined, {
          canPublish: allowed.canPublish, canSubscribe: true, canPublishData: false, canPublishSources: allowed.canPublishSources,
        } as never);
      } else {
        await db.from('live_guests').delete().eq('stream_id', streamId).eq('user_id', targetId);
        await client.updateParticipant(room, targetId, undefined, { canPublish: false, canSubscribe: true, canPublishData: false } as never);
      }
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // The person (or room) may not be connected right now; the database change is what matters.
  }
  res.status(200).json({ ok: true });
});
