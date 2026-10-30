import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient, UUID_RE } from './_lib/server';

/**
 * GET /s/<type>/<id>[/<readable-name>]  (rewritten to /api/share?type=&id=)
 * The link people paste into TikTok, Instagram, Facebook, WhatsApp, X ...
 *  - Social apps read the preview tags (title, picture, Kezzo name) from this page.
 *  - Visitors who are not signed in see a short preview of the content (its text and a glimpse of the picture or video)
 *    and are asked to log in or create an account to see all of it.
 *  - Signed-in members are sent straight to the content in the app.
 * Only public details are used, and only a short part of the text.
 */
const TARGET: Record<string, string> = { post: 'post', profile: 'profile', battle: 'battles', live: 'live', group: 'groups', event: 'community', poll: 'community', opportunity: 'opportunities' };
type L = 'en' | 'fr' | 'es' | 'pt' | 'hi';
const W: Record<L, { more: string; signup: string; login: string; why: string; locked: string; by: string; poll: string; opp: string; event: string; profile: string; battle: string; live: string; group: string; tag: string }> = {
  en: { more: 'Sign up or log in to read the rest and see everything.', signup: 'Create a free account', login: 'Log in', why: 'The full post, picture and video are for Kezzo members.', locked: 'Paid content: unlock it in Kezzo.', by: 'by', poll: 'Poll', opp: 'Opportunity', event: 'Event', profile: 'Profile', battle: 'Live battle', live: 'Live', group: 'Group', tag: 'Get to know the world through its people.' },
  fr: { more: 'Inscrivez-vous ou connectez-vous pour lire la suite et tout voir.', signup: 'Créer un compte gratuit', login: 'Se connecter', why: 'La publication complète, l’image et la vidéo sont réservées aux membres de Kezzo.', locked: 'Contenu payant : débloquez-le dans Kezzo.', by: 'par', poll: 'Sondage', opp: 'Opportunité', event: 'Événement', profile: 'Profil', battle: 'Battle en direct', live: 'En direct', group: 'Groupe', tag: 'Découvrez le monde à travers ses gens.' },
  es: { more: 'Regístrate o inicia sesión para leer el resto y verlo todo.', signup: 'Crear una cuenta gratis', login: 'Iniciar sesión', why: 'La publicación completa, la imagen y el video son para miembros de Kezzo.', locked: 'Contenido de pago: desbloquéalo en Kezzo.', by: 'por', poll: 'Encuesta', opp: 'Oportunidad', event: 'Evento', profile: 'Perfil', battle: 'Batalla en vivo', live: 'En vivo', group: 'Grupo', tag: 'Conoce el mundo a través de su gente.' },
  pt: { more: 'Cadastre-se ou entre para ler o resto e ver tudo.', signup: 'Criar uma conta grátis', login: 'Entrar', why: 'A publicação completa, a imagem e o vídeo são para membros do Kezzo.', locked: 'Conteúdo pago: desbloqueie no Kezzo.', by: 'por', poll: 'Enquete', opp: 'Oportunidade', event: 'Evento', profile: 'Perfil', battle: 'Batalha ao vivo', live: 'Ao vivo', group: 'Grupo', tag: 'Conheça o mundo através das suas pessoas.' },
  hi: { more: 'बाकी पढ़ने और सब कुछ देखने के लिए साइन अप या लॉग इन करें।', signup: 'मुफ़्त खाता बनाएँ', login: 'लॉग इन', why: 'पूरी पोस्ट, तस्वीर और वीडियो Kezzo के सदस्यों के लिए हैं।', locked: 'सशुल्क सामग्री: Kezzo में अनलॉक करें।', by: 'द्वारा', poll: 'पोल', opp: 'अवसर', event: 'इवेंट', profile: 'प्रोफ़ाइल', battle: 'लाइव बैटल', live: 'लाइव', group: 'ग्रुप', tag: 'लोगों के ज़रिए दुनिया को जानें।' },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c] as string);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const R2_NAME = /^[0-9a-f-]{36}\/r-/i;

interface Preview { label: string; title: string; text: string; lines: string[]; image: string; ogImage: string; video: string; note: string; by: string }

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const q = (k: string) => String(Array.isArray(req.query[k]) ? req.query[k]?.[0] : req.query[k] ?? '');
  const type = q('type');
  const id = q('id');
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  const base = (process.env.SITE_URL?.trim().replace(/\/+$/, '')) || (host ? `https://${host}` : '');
  const target = TARGET[type];

  if (!target || !UUID_RE.test(id)) {
    res.redirect(302, base ? `${base}/` : '/');
    return;
  }

  const accept = String(req.headers['accept-language'] ?? '').toLowerCase();
  const lang: L = (['fr', 'es', 'pt', 'hi'] as const).find((l) => accept.startsWith(l) || accept.includes(`,${l}`)) ?? 'en';
  const w = W[lang];
  const p: Preview = { label: 'Kezzo', title: 'Kezzo', text: '', lines: [], image: '', ogImage: '', video: '', note: '', by: '' };
  let description = w.tag;

  try {
    const db = adminClient();
    const supaUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    const r2 = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    const fileUrl = (path: string) => (R2_NAME.test(path) && r2 ? `${r2}/${path}` : supaUrl ? `${supaUrl}/storage/v1/object/public/media-public/${path}` : '');
    const thumbOf = (path: string) => path.replace(/\.[^./]+$/, '') + '-t.jpg';
    if (type === 'post') {
      const { data } = await db.from('posts')
        .select('title,body,kind,media_bucket,media_path,download_price,author:profiles!author_id(display_name)').eq('id', id).maybeSingle();
      if (data) {
        const author = one(data.author as { display_name: string } | { display_name: string }[] | null);
        p.label = w.by; p.title = clip(String(data.title), 120); p.by = author?.display_name ?? '';
        p.text = clip(String(data.body ?? '').replace(/\s+/g, ' ').trim(), 220);
        description = `${author?.display_name ?? 'Someone'} on Kezzo`;
        const path = String(data.media_path ?? '');
        if (data.media_bucket === 'media-public' && path && !data.download_price) {
          if (data.kind === 'photo') { p.image = fileUrl(thumbOf(path)); p.ogImage = fileUrl(path); }
          // a glimpse of a video only when it comes from R2 (free downloads); other videos show a plain tile
          if (data.kind === 'video' && R2_NAME.test(path)) p.video = fileUrl(path);
        } else if (data.download_price) p.note = w.locked;
      }
    } else if (type === 'profile') {
      const { data } = await db.from('profiles').select('display_name,handle,avatar_url,bio').eq('id', id).maybeSingle();
      if (data) {
        p.label = w.profile; p.title = `${clip(String(data.display_name), 60)} (@${data.handle})`;
        p.text = clip(String(data.bio ?? '').replace(/\s+/g, ' ').trim(), 200);
        if (data.avatar_url) { p.image = String(data.avatar_url); p.ogImage = p.image; }
        description = p.text || w.tag;
      }
    } else if (type === 'event') {
      const { data } = await db.from('events').select('title,description,starts_at,location,cover_path').eq('id', id).maybeSingle();
      if (data) {
        p.label = w.event; p.title = clip(String(data.title), 120);
        p.lines = [new Date(String(data.starts_at)).toUTCString().slice(0, 22) + ' UTC', String(data.location ?? '')].filter(Boolean);
        p.text = clip(String(data.description ?? '').replace(/\s+/g, ' ').trim(), 200);
        if (data.cover_path) { p.image = fileUrl(String(data.cover_path)); p.ogImage = p.image; }
        description = `${w.event} · ${p.lines[0] ?? ''}`;
      }
    } else if (type === 'opportunity') {
      const { data } = await db.from('opportunities').select('title,org,body,city,country,hidden').eq('id', id).maybeSingle();
      if (data && !data.hidden) {
        p.label = w.opp; p.title = clip(String(data.title), 120);
        p.lines = [[data.org, data.city, data.country].filter(Boolean).join(' · ')].filter(Boolean);
        p.text = clip(String(data.body ?? '').replace(/\s+/g, ' ').trim(), 200);
        description = `${w.opp} · ${clip(p.lines[0] ?? '', 100)}`;
      }
    } else if (type === 'poll') {
      const { data } = await db.from('polls').select('question,poll_options(label)').eq('id', id).maybeSingle();
      if (data) {
        p.label = w.poll; p.title = clip(String(data.question), 160);
        p.lines = ((data.poll_options as { label: string }[] | null) ?? []).slice(0, 4).map((o) => clip(String(o.label), 60));
        description = w.poll;
      }
    } else if (type === 'battle') {
      const { data } = await db.from('battles').select('title,topic,status').eq('id', id).maybeSingle();
      p.label = w.battle; p.title = data ? clip(String(data.title), 120) : 'Kezzo'; p.text = data ? clip(String(data.topic ?? ''), 200) : '';
      description = w.battle;
    } else if (type === 'live') {
      const { data } = await db.from('live_streams').select('title').eq('id', id).maybeSingle();
      p.label = w.live; p.title = data ? clip(String(data.title), 120) : 'Kezzo';
      description = w.live;
    } else {
      const { data } = await db.from('groups').select('name,tagline,join_policy').eq('id', id).maybeSingle();
      p.label = w.group; p.title = data ? clip(String(data.name), 80) : 'Kezzo';
      p.text = data && data.join_policy === 'open' ? clip(String(data.tagline ?? ''), 120) : '';
      description = w.group;
    }
  } catch {
    /* keep the generic Kezzo preview */
  }

  const dest = `${base}/#/${target}/${id}`;
  const signup = `${base}/?auth=signup#/${target}/${id}`;
  const login = `${base}/?auth=signin#/${target}/${id}`;
  const self = `${base}/s/${type}/${id}`;
  const ogTitle = `${p.title} · Kezzo`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Vary', 'Accept-Language');
  const media = p.video
    ? `<video id="v" src="${esc(p.video)}#t=0.1" muted autoplay loop playsinline preload="metadata" disablepictureinpicture controlslist="nodownload noplaybackrate" oncontextmenu="return false" style="width:100%;max-height:420px;display:block;background:#000"></video>`
    : p.image
      ? `<img src="${esc(p.image)}" alt="" style="width:100%;max-height:420px;object-fit:cover;display:block" onerror="if(this.dataset.f!=='1'&&${JSON.stringify(p.ogImage || '')}){this.dataset.f='1';this.src=${JSON.stringify(p.ogImage || '').replace(/</g, '\\u003c')}}" />`
      : '';
  res.status(200).send(`<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(ogTitle)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:site_name" content="Kezzo" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(ogTitle)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(self)}" />
${p.ogImage ? `<meta property="og:image" content="${esc(p.ogImage)}" />\n` : ''}<meta name="twitter:card" content="${p.ogImage ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${esc(ogTitle)}" />
<meta name="twitter:description" content="${esc(description)}" />
${p.ogImage ? `<meta name="twitter:image" content="${esc(p.ogImage)}" />` : ''}
<style>
*{box-sizing:border-box}body{margin:0;font-family:Helvetica,Arial,sans-serif;background:#fafaf9;color:#18181b}
header{background:#000;color:#fff;padding:12px 16px;font-weight:700;font-size:18px}
main{max-width:560px;margin:0 auto;padding:16px}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden}
.pad{padding:16px}.k{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#71717a;font-weight:700}
h1{font-size:22px;line-height:1.25;margin:6px 0 8px}p{margin:0 0 8px;line-height:1.5;color:#3f3f46}
.fade{position:relative;max-height:96px;overflow:hidden}.fade:after{content:"";position:absolute;inset:auto 0 0 0;height:56px;background:linear-gradient(transparent,#fff)}
.tile{height:200px;background:#27272a;display:flex;align-items:center;justify-content:center;color:#fff;font-size:44px}
.btn{display:block;text-align:center;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 16px;margin-top:10px}
.pri{background:#18181b;color:#fff}.sec{border:1px solid #d4d4d8;color:#18181b;background:#fff}
.small{font-size:13px;color:#71717a}ul{margin:0 0 8px;padding-left:18px;color:#3f3f46}
</style>
<script>try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-.+-auth-token$/.test(k)&&localStorage.getItem(k)){location.replace(${JSON.stringify(dest).replace(/</g, '\\u003c')});break}}}catch(e){}</script>
</head><body>
<header>Kezzo</header>
<main>
<div class="card">
${media}
<div class="pad">
<div class="k">${esc(p.label)}${p.by ? ` ${esc(p.by)}` : ''}</div>
<h1>${esc(p.title)}</h1>
${p.lines.length ? (type === 'poll' ? `<ul>${p.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : p.lines.map((l) => `<p class="small">${esc(l)}</p>`).join('')) : ''}
${p.text ? `<div class="fade"><p>${esc(p.text)}</p></div>` : ''}
${p.note ? `<p class="small">${esc(p.note)}</p>` : ''}
<p class="small">${esc(w.why)}</p>
<a class="btn pri" href="${esc(signup)}">${esc(w.signup)}</a>
<a class="btn sec" href="${esc(login)}">${esc(w.login)}</a>
<p class="small" style="margin-top:12px;text-align:center">${esc(w.more)}</p>
</div></div>
</main>
<script>var v=document.getElementById('v');if(v){v.addEventListener('timeupdate',function(){if(v.currentTime>6){v.currentTime=0;v.play().catch(function(){})}})}</script>
</body></html>`);
}
