/**
 * Local dev / self-hosted server.
 *  - `npm run dev`   : Express + Vite middleware (hot reload) + the same /api handlers Vercel runs.
 *  - `npm run start` : serves the built `dist/` folder + /api (self-hosting, e.g. Docker).
 * On Vercel this file is not used: the static build and the functions in /api are deployed directly.
 */
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import path from 'node:path';

dotenv.config({ path: ['.env.local', '.env'] });

import health from '../api/health';
import livekitToken from '../api/livekit-token';
import livekitKick from '../api/livekit-kick';
import livekitMute from '../api/livekit-mute';
import livekitLive from '../api/livekit-live';
import aiJudge from '../api/ai-judge';
import track from '../api/track';
import notifyMessage from '../api/notify-message';
import emailOptout from '../api/email-optout';
import share from '../api/share';

type ApiHandler = (req: never, res: never) => unknown;
const routes: Record<string, ApiHandler> = {
  '/api/health': health,
  '/api/livekit-token': livekitToken,
  '/api/livekit-kick': livekitKick,
  '/api/livekit-mute': livekitMute,
  '/api/livekit-live': livekitLive,
  '/api/ai-judge': aiJudge,
  '/api/track': track,
  '/api/notify-message': notifyMessage,
  '/api/email-optout': emailOptout,
  '/api/share': share,
};

async function main() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  for (const [url, handler] of Object.entries(routes)) {
    app.all(url, (req: Request, res: Response) => {
      Promise.resolve((handler as (a: Request, b: Response) => unknown)(req, res)).catch((err: unknown) => {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
      });
    });
  }

  app.get('/s/:type/:id', (req: Request, res: Response) => res.redirect(`/api/share?type=${encodeURIComponent(req.params.type)}&id=${encodeURIComponent(req.params.id)}`));

  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log(`Kezzo running on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
