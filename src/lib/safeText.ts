import type { Lang } from './types';

export interface SafeWords { warn: string; sensitive: string; show: string; hide: string }

/** Safety wording for payment screens. Kezzo never asks for card numbers, bank logins, PINs or passwords. */
export const SAFE: Record<Lang, SafeWords> = {
  en: { warn: 'Never type a card number, bank login, PIN or password here. Use only a merchant code, a payment link or a QR code.', sensitive: 'This looks like a card number, bank detail, PIN or password. Remove it. Use a merchant code, payment link or QR code instead.', show: 'Show', hide: 'Hide' },
  fr: { warn: 'N’écrivez jamais ici un numéro de carte, un accès bancaire, un code PIN ou un mot de passe. Utilisez seulement un code marchand, un lien de paiement ou un code QR.', sensitive: 'Cela ressemble à un numéro de carte, une info bancaire, un PIN ou un mot de passe. Retirez-le. Utilisez plutôt un code marchand, un lien de paiement ou un code QR.', show: 'Afficher', hide: 'Masquer' },
  es: { warn: 'Nunca escribas aquí un número de tarjeta, acceso bancario, PIN o contraseña. Usa solo un código de comercio, un enlace de pago o un código QR.', sensitive: 'Parece un número de tarjeta, dato bancario, PIN o contraseña. Quítalo. Usa un código de comercio, enlace de pago o código QR.', show: 'Mostrar', hide: 'Ocultar' },
  pt: { warn: 'Nunca digite aqui número de cartão, acesso bancário, PIN ou senha. Use só um código de comerciante, um link de pagamento ou um QR code.', sensitive: 'Parece um número de cartão, dado bancário, PIN ou senha. Remova. Use um código de comerciante, link de pagamento ou QR code.', show: 'Mostrar', hide: 'Ocultar' },
  hi: { warn: 'यहाँ कभी कार्ड नंबर, बैंक लॉगिन, पिन या पासवर्ड न लिखें। केवल मर्चेंट कोड, भुगतान लिंक या QR कोड इस्तेमाल करें।', sensitive: 'यह कार्ड नंबर, बैंक जानकारी, पिन या पासवर्ड जैसा लगता है। इसे हटाएँ। इसके बजाय मर्चेंट कोड, भुगतान लिंक या QR कोड इस्तेमाल करें।', show: 'दिखाएँ', hide: 'छुपाएँ' },
};

export const isSensitiveError = (message: string): boolean => message.includes('sensitive_data');
