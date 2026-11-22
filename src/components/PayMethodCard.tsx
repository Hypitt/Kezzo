import { Copy, ExternalLink } from 'lucide-react';
import { copyText } from '../lib/share';
import { GUIDE } from '../lib/premiumGuideText';
import { ORDERS } from '../lib/ordersText';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';

export interface PayDetails { method: string; type?: string; account_name?: string; account_number?: string; instructions?: string; pay_link?: string; qr_data?: string }

/** One way to pay: name, number or merchant code (with Copy), a button for the payment link, and the QR picture. */
export function PayMethodCard({ m }: { m: PayDetails }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const o = ORDERS[lang];
  const g = GUIDE[lang];
  const copy = async (s: string) => { await copyText(s); toast(o.copied); };
  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-2.5 text-sm">
      <p className="font-medium">{m.method}{m.type && o.types[m.type] ? <span className="text-xs font-normal text-zinc-500"> · {o.types[m.type]}</span> : null}</p>
      {m.account_name && <p className="text-xs text-zinc-600">{o.accName}: {m.account_name}</p>}
      {m.account_number && (
        <p className="flex items-center gap-2 text-xs text-zinc-600">{g.numberL}: <b className="break-all text-sm text-zinc-900">{m.account_number}</b>
          <button type="button" className="btn btn-ghost !px-2 !py-1" aria-label={o.copy} onClick={() => void copy(m.account_number ?? '')}><Copy className="h-3.5 w-3.5" aria-hidden="true" /></button></p>
      )}
      {m.pay_link && <a href={m.pay_link} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary btn-sm mt-2 inline-flex"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{g.openLink}</a>}
      {m.qr_data && (
        <div className="mt-2">
          <p className="mb-1 text-xs text-zinc-500">{g.scanQr}</p>
          <img src={m.qr_data} alt={g.scanQr} className="h-40 w-40 rounded-lg border border-zinc-300 bg-white object-contain" />
        </div>
      )}
      {m.instructions && <p className="mt-1 whitespace-pre-line text-xs text-zinc-600">{m.instructions}</p>}
    </div>
  );
}
