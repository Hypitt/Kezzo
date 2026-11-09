import { useEffect, useRef, useState } from 'react';
import { Check, Mic, X } from 'lucide-react';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';

const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const supportedType = (): string | null => {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  return TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
};
export const voiceSupported = (): boolean => supportedType() !== null;

const ext = (mime: string): string => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');
const clock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * A microphone button. Press it to start recording, then tick to send or cross to throw the recording away.
 * Gives back a small audio file named "voice-....webm" (or .m4a on Safari) and its length in seconds.
 */
export function VoiceRecorder({ onDone, maxSeconds = 300, disabled = false }: {
  onDone: (file: File, seconds: number) => void;
  maxSeconds?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [on, setOn] = useState(false);
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const keep = useRef(false);
  const timer = useRef<number | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  const release = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => () => { keep.current = false; if (rec.current?.state === 'recording') rec.current.stop(); release(); }, []);

  const finish = (send: boolean) => {
    keep.current = send;
    if (rec.current?.state === 'recording') rec.current.stop();
  };

  const start = async () => {
    const mime = supportedType();
    if (!mime || on) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const r = new MediaRecorder(s, { mimeType: mime });
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      r.onstop = () => {
        const seconds = Math.round((Date.now() - started.current) / 1000);
        const base = mime.split(';')[0];
        const blob = new Blob(chunks.current, { type: base });
        release();
        setOn(false);
        if (!keep.current) return;
        if (seconds < 1 || blob.size === 0) return toast(t('voice_too_short'), 'error');
        done.current(new File([blob], `voice-${Date.now()}.${ext(mime)}`, { type: base }), seconds);
      };
      rec.current = r;
      started.current = Date.now();
      setSecs(0);
      setOn(true);
      r.start();
      timer.current = window.setInterval(() => {
        const n = Math.round((Date.now() - started.current) / 1000);
        setSecs(n);
        if (n >= maxSeconds) finish(true);
      }, 500);
    } catch {
      release();
      toast(t('voice_mic_denied'), 'error');
    }
  };

  if (!voiceSupported()) return null;
  if (!on) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => void start()} disabled={disabled} aria-label={t('voice_record')} title={t('voice_record')}>
        <Mic className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
      <span className="tabular-nums">{clock(secs)}</span>
      <button type="button" className="rounded-full p-1 hover:bg-red-100" onClick={() => finish(false)} aria-label={t('voice_cancel')} title={t('voice_cancel')}>
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className="rounded-full bg-red-600 p-1 text-white hover:bg-red-700" onClick={() => finish(true)} aria-label={t('voice_send')} title={t('voice_send')}>
        <Check className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  );
}
