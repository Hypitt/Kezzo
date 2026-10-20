import { adminClient, HttpError, readBody, route, UUID_RE } from './_lib/server';

/**
 * POST /api/track  { events: [{ kind, path?, referrer?, value?, detail? }], visitor, session, lang?, token? }
 * Privacy-friendly usage statistics. Stores a random visitor id, the page pattern (never the real ids in the URL) and
 * coarse device data. The IP address and the full user agent are never stored; the country comes from the platform header.
 * The browser skips this call entirely when "Do Not Track" or "Global Privacy Control" is on.
 */
const KINDS = new Set(['pageview', 'signin', 'signup', 'signout', 'perf', 'error']);
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|curl|wget|python|node-fetch|axios|monitor/i;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function agent(ua: string): { device: string; browser: string; os: string } {
  const tablet = /ipad|tablet|(android(?!.*mobile))/i.test(ua);
  const mobile = /mobi|iphone|ipod|android/i.test(ua);
  const device = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Other';
  const os = /windows/i.test(ua) ? 'Windows' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android'
    : /mac os/i.test(ua) ? 'macOS' : /linux|cros/i.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  return s || null;
};

/** Only the host name of the referring site is kept. */
function refHost(v: unknown, own: string): string | null {
  const s = text(v, 300);
  if (!s) return null;
  try {
    const host = new URL(s).hostname.replace(/^www\./, '');
    return host === own ? null : host.slice(0, 120);
  } catch {
    return null;
  }
}

export default route(async (req, res) => {
  const ua = String(req.headers['user-agent'] ?? '');
  if (!ua || BOT.test(ua)) {
    res.status(204).end();
    return;
  }
  const body = readBody(req);
  const visitor = String(body.visitor ?? '');
  const session = String(body.session ?? '');
  if (!ID_RE.test(visitor) || !ID_RE.test(session)) throw new HttpError(400, 'Invalid request');
  const list = Array.isArray(body.events) ? body.events.slice(0, 10) : [];
  if (list.length === 0) throw new HttpError(400, 'No events');

  const db = adminClient();

  // A signed-in person may attach their account id (used for daily active users). The token is verified, never trusted.
  let userId: string | null = null;
  const token = text(body.token, 4000);
  if (token) {
    const { data } = await db.auth.getUser(token);
    if (data.user && UUID_RE.test(data.user.id)) userId = data.user.id;
  }

  const own = String(req.headers.host ?? '').split(':')[0].replace(/^www\./, '');
  const country = text(req.headers['x-vercel-ip-country'], 3)?.toUpperCase() ?? null;
  const lang = text(body.lang, 8);
  const { device, browser, os } = agent(ua);

  const rows = list.flatMap((raw) => {
    const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const kind = String(e.kind ?? '');
    if (!KINDS.has(kind)) return [];
    const value = typeof e.value === 'number' && Number.isFinite(e.value) ? Math.max(0, Math.min(600000, Math.round(e.value))) : null;
    return [{
      kind, visitor, session, user_id: userId, country, lang, device, browser, os, value,
      path: text(e.path, 120)?.replace(/[?#].*$/, '') ?? null,
      referrer: refHost(e.referrer, own),
      detail: text(e.detail, 160),
    }];
  });
  if (rows.length === 0) throw new HttpError(400, 'No valid events');

  const { error } = await db.from('analytics_events').insert(rows);
  if (error) throw new HttpError(500, 'Could not save');

  // Housekeeping: now and then, delete events older than the retention period.
  if (Math.random() < 0.01) await db.rpc('purge_analytics', { p_months: 13 });
  res.status(204).end();
});
