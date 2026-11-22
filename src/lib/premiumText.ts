import type { Lang } from './types';

/** Words for the Premium page, in the five Kezzo languages. */
export interface PremiumWords {
  nav: string; title: string; sub: string; err: string; done: string;
  free: string; premium: string; feature: string;
  rows: Array<[string, string, string]>;
  limitsT: string; limitNames: Record<string, string>; unlimited: string; yes: string; no: string;
  statusActive: (d: string) => string; statusGrace: (d: string) => string; statusFree: string; statusExpired: string; statusSuspended: string;
  notice: string; howT: string; how: string[];
  country: string; pickCountry: string; duration: string; durations: Record<string, string>; price: string; noPrices: string;
  payTo: string; accName: string; accNumber: string; copy: string; copied: string; noAccounts: string;
  refL: string; refPh: string; noteL: string; send: string; sending: string;
  results: Record<string, string>; historyT: string; statuses: Record<string, string>; reason: string; cancel: string; limitHit: Record<string, string>;
}

const EN: PremiumWords = {
  nav: 'Premium', title: 'Kezzo Premium', sub: 'Social, marketplace and savings groups stay free. Premium adds direct-payment tools and higher limits for sellers and creators.', err: 'Something went wrong. Please try again.', done: 'Done.',
  free: 'Free', premium: 'Premium', feature: 'Feature',
  rows: [
    ['Social networking, messaging, publishing', 'Yes', 'Yes'], ['Browse the marketplace, contact sellers', 'Yes', 'Yes'], ['Publish listings', 'Limited', 'Higher'], ['Create live rooms', 'Basic limits', 'Higher limits'],
    ['Payment methods, Pay button, QR code', 'No', 'Yes'], ['Creator “Support me” button', 'No', 'Yes'], ['Advanced order management and reviews', 'No', 'Yes'], ['Premium badge, featured listings', 'No', 'Yes'],
    ['Savings group: run one group', 'Yes', 'Yes'], ['Savings: several groups, reports, exports, advanced roles', 'No', 'Yes'],
  ],
  limitsT: 'Plan limits', limitNames: { listings: 'Active listings', payment_methods: 'Payment methods shown', live_rooms_month: 'Live rooms per month', live_minutes: 'Live room minutes', vsla_groups: 'Savings groups as admin', vsla_members: 'Members per savings group', featured_month: 'Featured listings per month', export: 'Reports and export' }, unlimited: 'Unlimited', yes: 'Yes', no: 'No',
  statusActive: (d) => `Premium is active until ${d}.`, statusGrace: (d) => `Your Premium ended. You are in a 3-day grace period until ${d}. Renew to keep it.`, statusFree: 'You are on the Free plan.', statusExpired: 'Your Premium has ended. Your data is kept; renew to get Premium tools back.', statusSuspended: 'Your Premium is suspended. Contact support.',
  notice: 'The Premium fee is paid to Kezzo, outside the app. Customer payments to sellers are separate: Kezzo never holds, guarantees or refunds them.',
  howT: 'How to subscribe', how: ['Choose your country and a duration.', 'Pay the price shown to Kezzo’s account, using your own mobile money or bank.', 'Send the transaction reference here.', 'An admin checks the payment. Premium turns on as soon as it is approved.'],
  country: 'Country', pickCountry: 'Choose a country', duration: 'Duration', durations: { week: 'Weekly', month: 'Monthly', quarter: 'Quarterly' }, price: 'Price', noPrices: 'Prices are not set yet. Please check back soon.',
  payTo: 'Pay to', accName: 'Account name', accNumber: 'Number', copy: 'Copy', copied: 'Copied.', noAccounts: 'No payment account is set for this country yet.',
  refL: 'Transaction reference', refPh: 'The code from your payment message', noteL: 'Note (optional)', send: 'I have paid, send for approval', sending: 'Sending…',
  results: { ok: 'Sent. An admin will check your payment.', no_price: 'This price is not available.', duplicate: 'This reference was already used.', pending: 'You already have a payment waiting for approval.' },
  historyT: 'Your payments', statuses: { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' }, reason: 'Reason', cancel: 'Cancel',
  limitHit: { listings: 'You reached your listing limit. Premium raises it.', vsla_groups: 'You reached your savings-group limit. Premium raises it.', vsla_members: 'This group reached its member limit.' },
};
const FR: PremiumWords = {
  nav: 'Premium', title: 'Kezzo Premium', sub: 'Le social, la marketplace et les groupes d’épargne restent gratuits. Premium ajoute les outils de paiement direct et des limites plus hautes pour vendeurs et créateurs.', err: 'Une erreur est survenue. Réessayez.', done: 'Fait.',
  free: 'Gratuit', premium: 'Premium', feature: 'Fonction',
  rows: [
    ['Réseau social, messages, publications', 'Oui', 'Oui'], ['Parcourir la marketplace, contacter les vendeurs', 'Oui', 'Oui'], ['Publier des annonces', 'Limité', 'Plus élevé'], ['Créer des salons live', 'Limites de base', 'Limites plus hautes'],
    ['Moyens de paiement, bouton Payer, QR code', 'Non', 'Oui'], ['Bouton « Soutenez-moi » pour créateurs', 'Non', 'Oui'], ['Gestion avancée des commandes et avis', 'Non', 'Oui'], ['Badge Premium, annonces mises en avant', 'Non', 'Oui'],
    ['Épargne : gérer un groupe', 'Oui', 'Oui'], ['Épargne : plusieurs groupes, rapports, exports, rôles avancés', 'Non', 'Oui'],
  ],
  limitsT: 'Limites du plan', limitNames: { listings: 'Annonces actives', payment_methods: 'Moyens de paiement affichés', live_rooms_month: 'Salons live par mois', live_minutes: 'Minutes par salon live', vsla_groups: 'Groupes d’épargne en tant qu’admin', vsla_members: 'Membres par groupe d’épargne', featured_month: 'Annonces en avant par mois', export: 'Rapports et export' }, unlimited: 'Illimité', yes: 'Oui', no: 'Non',
  statusActive: (d) => `Premium est actif jusqu’au ${d}.`, statusGrace: (d) => `Votre Premium est terminé. Vous êtes en période de grâce de 3 jours jusqu’au ${d}. Renouvelez pour le garder.`, statusFree: 'Vous êtes sur le plan gratuit.', statusExpired: 'Votre Premium est terminé. Vos données sont conservées ; renouvelez pour retrouver les outils Premium.', statusSuspended: 'Votre Premium est suspendu. Contactez le support.',
  notice: 'Les frais Premium sont payés à Kezzo, en dehors de l’application. Les paiements des clients aux vendeurs sont séparés : Kezzo ne les détient, ne les garantit et ne les rembourse jamais.',
  howT: 'Comment s’abonner', how: ['Choisissez votre pays et une durée.', 'Payez le prix indiqué sur le compte de Kezzo, avec votre mobile money ou votre banque.', 'Envoyez ici la référence de la transaction.', 'Un admin vérifie le paiement. Premium s’active dès l’approbation.'],
  country: 'Pays', pickCountry: 'Choisir un pays', duration: 'Durée', durations: { week: 'Hebdomadaire', month: 'Mensuel', quarter: 'Trimestriel' }, price: 'Prix', noPrices: 'Les prix ne sont pas encore définis. Revenez bientôt.',
  payTo: 'Payer à', accName: 'Nom du compte', accNumber: 'Numéro', copy: 'Copier', copied: 'Copié.', noAccounts: 'Aucun compte de paiement n’est défini pour ce pays.',
  refL: 'Référence de la transaction', refPh: 'Le code du message de paiement', noteL: 'Note (facultatif)', send: 'J’ai payé, envoyer pour approbation', sending: 'Envoi…',
  results: { ok: 'Envoyé. Un admin va vérifier votre paiement.', no_price: 'Ce prix n’est pas disponible.', duplicate: 'Cette référence a déjà été utilisée.', pending: 'Vous avez déjà un paiement en attente d’approbation.' },
  historyT: 'Vos paiements', statuses: { pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' }, reason: 'Motif', cancel: 'Annuler',
  limitHit: { listings: 'Vous avez atteint votre limite d’annonces. Premium l’augmente.', vsla_groups: 'Vous avez atteint votre limite de groupes d’épargne. Premium l’augmente.', vsla_members: 'Ce groupe a atteint sa limite de membres.' },
};
const ES: PremiumWords = {
  nav: 'Premium', title: 'Kezzo Premium', sub: 'Lo social, el mercado y los grupos de ahorro siguen siendo gratis. Premium añade pagos directos y límites más altos para vendedores y creadores.', err: 'Algo salió mal. Inténtalo de nuevo.', done: 'Listo.',
  free: 'Gratis', premium: 'Premium', feature: 'Función',
  rows: [
    ['Red social, mensajes, publicaciones', 'Sí', 'Sí'], ['Explorar el mercado, contactar vendedores', 'Sí', 'Sí'], ['Publicar anuncios', 'Limitado', 'Más alto'], ['Crear salas en vivo', 'Límites básicos', 'Límites más altos'],
    ['Métodos de pago, botón Pagar, QR', 'No', 'Sí'], ['Botón «Apóyame» para creadores', 'No', 'Sí'], ['Gestión avanzada de pedidos y reseñas', 'No', 'Sí'], ['Insignia Premium, anuncios destacados', 'No', 'Sí'],
    ['Ahorro: gestionar un grupo', 'Sí', 'Sí'], ['Ahorro: varios grupos, informes, exportar, roles avanzados', 'No', 'Sí'],
  ],
  limitsT: 'Límites del plan', limitNames: { listings: 'Anuncios activos', payment_methods: 'Métodos de pago mostrados', live_rooms_month: 'Salas en vivo al mes', live_minutes: 'Minutos por sala en vivo', vsla_groups: 'Grupos de ahorro como admin', vsla_members: 'Miembros por grupo de ahorro', featured_month: 'Anuncios destacados al mes', export: 'Informes y exportar' }, unlimited: 'Ilimitado', yes: 'Sí', no: 'No',
  statusActive: (d) => `Premium está activo hasta el ${d}.`, statusGrace: (d) => `Tu Premium terminó. Estás en un periodo de gracia de 3 días hasta el ${d}. Renueva para mantenerlo.`, statusFree: 'Estás en el plan gratis.', statusExpired: 'Tu Premium terminó. Tus datos se conservan; renueva para recuperar las herramientas Premium.', statusSuspended: 'Tu Premium está suspendido. Contacta con soporte.',
  notice: 'La cuota Premium se paga a Kezzo, fuera de la app. Los pagos de clientes a vendedores son aparte: Kezzo nunca los retiene, garantiza ni reembolsa.',
  howT: 'Cómo suscribirte', how: ['Elige tu país y una duración.', 'Paga el precio indicado a la cuenta de Kezzo, con tu dinero móvil o banco.', 'Envía aquí la referencia de la transacción.', 'Un admin revisa el pago. Premium se activa al aprobarlo.'],
  country: 'País', pickCountry: 'Elige un país', duration: 'Duración', durations: { week: 'Semanal', month: 'Mensual', quarter: 'Trimestral' }, price: 'Precio', noPrices: 'Aún no hay precios. Vuelve pronto.',
  payTo: 'Pagar a', accName: 'Nombre de la cuenta', accNumber: 'Número', copy: 'Copiar', copied: 'Copiado.', noAccounts: 'Aún no hay cuenta de pago para este país.',
  refL: 'Referencia de la transacción', refPh: 'El código del mensaje de pago', noteL: 'Nota (opcional)', send: 'Ya pagué, enviar para aprobación', sending: 'Enviando…',
  results: { ok: 'Enviado. Un admin revisará tu pago.', no_price: 'Este precio no está disponible.', duplicate: 'Esta referencia ya fue usada.', pending: 'Ya tienes un pago esperando aprobación.' },
  historyT: 'Tus pagos', statuses: { pending: 'En espera', approved: 'Aprobado', rejected: 'Rechazado' }, reason: 'Motivo', cancel: 'Cancelar',
  limitHit: { listings: 'Llegaste a tu límite de anuncios. Premium lo aumenta.', vsla_groups: 'Llegaste a tu límite de grupos de ahorro. Premium lo aumenta.', vsla_members: 'Este grupo llegó a su límite de miembros.' },
};
const PT: PremiumWords = {
  nav: 'Premium', title: 'Kezzo Premium', sub: 'O social, o mercado e os grupos de poupança continuam grátis. O Premium adiciona pagamentos diretos e limites maiores para vendedores e criadores.', err: 'Algo deu errado. Tente de novo.', done: 'Pronto.',
  free: 'Grátis', premium: 'Premium', feature: 'Recurso',
  rows: [
    ['Rede social, mensagens, publicações', 'Sim', 'Sim'], ['Explorar o mercado, contatar vendedores', 'Sim', 'Sim'], ['Publicar anúncios', 'Limitado', 'Maior'], ['Criar salas ao vivo', 'Limites básicos', 'Limites maiores'],
    ['Formas de pagamento, botão Pagar, QR', 'Não', 'Sim'], ['Botão “Apoie-me” para criadores', 'Não', 'Sim'], ['Gestão avançada de pedidos e avaliações', 'Não', 'Sim'], ['Selo Premium, anúncios em destaque', 'Não', 'Sim'],
    ['Poupança: gerir um grupo', 'Sim', 'Sim'], ['Poupança: vários grupos, relatórios, exportar, funções avançadas', 'Não', 'Sim'],
  ],
  limitsT: 'Limites do plano', limitNames: { listings: 'Anúncios ativos', payment_methods: 'Formas de pagamento exibidas', live_rooms_month: 'Salas ao vivo por mês', live_minutes: 'Minutos por sala ao vivo', vsla_groups: 'Grupos de poupança como admin', vsla_members: 'Membros por grupo de poupança', featured_month: 'Anúncios em destaque por mês', export: 'Relatórios e exportação' }, unlimited: 'Ilimitado', yes: 'Sim', no: 'Não',
  statusActive: (d) => `O Premium está ativo até ${d}.`, statusGrace: (d) => `Seu Premium terminou. Você está em um período de carência de 3 dias até ${d}. Renove para manter.`, statusFree: 'Você está no plano grátis.', statusExpired: 'Seu Premium terminou. Seus dados são mantidos; renove para recuperar as ferramentas Premium.', statusSuspended: 'Seu Premium está suspenso. Fale com o suporte.',
  notice: 'A taxa Premium é paga à Kezzo, fora do app. Os pagamentos de clientes a vendedores são separados: a Kezzo nunca os retém, garante ou reembolsa.',
  howT: 'Como assinar', how: ['Escolha seu país e uma duração.', 'Pague o preço indicado na conta da Kezzo, com seu dinheiro móvel ou banco.', 'Envie aqui a referência da transação.', 'Um admin confere o pagamento. O Premium liga assim que for aprovado.'],
  country: 'País', pickCountry: 'Escolha um país', duration: 'Duração', durations: { week: 'Semanal', month: 'Mensal', quarter: 'Trimestral' }, price: 'Preço', noPrices: 'Os preços ainda não foram definidos. Volte em breve.',
  payTo: 'Pagar para', accName: 'Nome da conta', accNumber: 'Número', copy: 'Copiar', copied: 'Copiado.', noAccounts: 'Ainda não há conta de pagamento para este país.',
  refL: 'Referência da transação', refPh: 'O código da mensagem de pagamento', noteL: 'Nota (opcional)', send: 'Já paguei, enviar para aprovação', sending: 'Enviando…',
  results: { ok: 'Enviado. Um admin vai conferir seu pagamento.', no_price: 'Este preço não está disponível.', duplicate: 'Esta referência já foi usada.', pending: 'Você já tem um pagamento aguardando aprovação.' },
  historyT: 'Seus pagamentos', statuses: { pending: 'Aguardando', approved: 'Aprovado', rejected: 'Rejeitado' }, reason: 'Motivo', cancel: 'Cancelar',
  limitHit: { listings: 'Você atingiu o limite de anúncios. O Premium aumenta.', vsla_groups: 'Você atingiu o limite de grupos de poupança. O Premium aumenta.', vsla_members: 'Este grupo atingiu o limite de membros.' },
};
const HI: PremiumWords = {
  nav: 'प्रीमियम', title: 'Kezzo प्रीमियम', sub: 'सोशल, मार्केटप्लेस और बचत समूह मुफ़्त रहते हैं। प्रीमियम विक्रेताओं और क्रिएटर्स के लिए सीधा भुगतान और ऊँची सीमाएँ जोड़ता है।', err: 'कुछ गलत हो गया। फिर कोशिश करें।', done: 'हो गया।',
  free: 'मुफ़्त', premium: 'प्रीमियम', feature: 'सुविधा',
  rows: [
    ['सोशल नेटवर्क, संदेश, पोस्ट', 'हाँ', 'हाँ'], ['मार्केटप्लेस देखना, विक्रेताओं से बात', 'हाँ', 'हाँ'], ['लिस्टिंग डालना', 'सीमित', 'ज़्यादा'], ['लाइव रूम बनाना', 'बुनियादी सीमा', 'ऊँची सीमा'],
    ['भुगतान तरीके, Pay बटन, QR', 'नहीं', 'हाँ'], ['क्रिएटर “मुझे सपोर्ट करें” बटन', 'नहीं', 'हाँ'], ['उन्नत ऑर्डर प्रबंधन और रिव्यू', 'नहीं', 'हाँ'], ['प्रीमियम बैज, फ़ीचर्ड लिस्टिंग', 'नहीं', 'हाँ'],
    ['बचत: एक समूह चलाना', 'हाँ', 'हाँ'], ['बचत: कई समूह, रिपोर्ट, एक्सपोर्ट, उन्नत भूमिकाएँ', 'नहीं', 'हाँ'],
  ],
  limitsT: 'प्लान की सीमाएँ', limitNames: { listings: 'सक्रिय लिस्टिंग', payment_methods: 'दिखाए गए भुगतान तरीके', live_rooms_month: 'हर महीने लाइव रूम', live_minutes: 'लाइव रूम के मिनट', vsla_groups: 'एडमिन के रूप में बचत समूह', vsla_members: 'हर बचत समूह में सदस्य', featured_month: 'हर महीने फ़ीचर्ड लिस्टिंग', export: 'रिपोर्ट और एक्सपोर्ट' }, unlimited: 'असीमित', yes: 'हाँ', no: 'नहीं',
  statusActive: (d) => `प्रीमियम ${d} तक सक्रिय है।`, statusGrace: (d) => `आपका प्रीमियम खत्म हो गया। ${d} तक 3 दिन की छूट अवधि है। बनाए रखने के लिए नवीनीकरण करें।`, statusFree: 'आप मुफ़्त प्लान पर हैं।', statusExpired: 'आपका प्रीमियम खत्म हो गया। आपका डेटा सुरक्षित है; प्रीमियम टूल वापस पाने के लिए नवीनीकरण करें।', statusSuspended: 'आपका प्रीमियम निलंबित है। सहायता से संपर्क करें।',
  notice: 'प्रीमियम शुल्क ऐप के बाहर Kezzo को दिया जाता है। ग्राहकों के विक्रेताओं को भुगतान अलग हैं: Kezzo उन्हें न रखता है, न गारंटी देता है, न वापस करता है।',
  howT: 'सदस्यता कैसे लें', how: ['अपना देश और अवधि चुनें।', 'दिखाई गई कीमत अपने मोबाइल मनी या बैंक से Kezzo के खाते में दें।', 'लेनदेन का संदर्भ यहाँ भेजें।', 'एडमिन भुगतान जाँचता है। मंज़ूरी मिलते ही प्रीमियम चालू हो जाता है।'],
  country: 'देश', pickCountry: 'देश चुनें', duration: 'अवधि', durations: { week: 'साप्ताहिक', month: 'मासिक', quarter: 'त्रैमासिक' }, price: 'कीमत', noPrices: 'कीमतें अभी तय नहीं हैं। जल्द देखें।',
  payTo: 'यहाँ भुगतान करें', accName: 'खाते का नाम', accNumber: 'नंबर', copy: 'कॉपी', copied: 'कॉपी हो गया।', noAccounts: 'इस देश के लिए अभी भुगतान खाता नहीं है।',
  refL: 'लेनदेन संदर्भ', refPh: 'भुगतान संदेश का कोड', noteL: 'नोट (वैकल्पिक)', send: 'मैंने भुगतान किया, मंज़ूरी के लिए भेजें', sending: 'भेज रहे हैं…',
  results: { ok: 'भेज दिया। एडमिन आपका भुगतान जाँचेगा।', no_price: 'यह कीमत उपलब्ध नहीं है।', duplicate: 'यह संदर्भ पहले इस्तेमाल हो चुका है।', pending: 'आपका एक भुगतान पहले से मंज़ूरी की प्रतीक्षा में है।' },
  historyT: 'आपके भुगतान', statuses: { pending: 'प्रतीक्षा में', approved: 'मंज़ूर', rejected: 'अस्वीकृत' }, reason: 'कारण', cancel: 'रद्द करें',
  limitHit: { listings: 'आप लिस्टिंग की सीमा तक पहुँच गए। प्रीमियम इसे बढ़ाता है।', vsla_groups: 'आप बचत समूहों की सीमा तक पहुँच गए। प्रीमियम इसे बढ़ाता है।', vsla_members: 'इस समूह में सदस्यों की सीमा पूरी हो गई।' },
};
export const PREMIUM: Record<Lang, PremiumWords> = { en: EN, fr: FR, es: ES, pt: PT, hi: HI };

/** If a database error is a plan-limit error, returns a friendly message; otherwise null. */
export function limitMessage(lang: Lang, message: string): string | null {
  const m = /plan_limit_(listings|vsla_groups|vsla_members)/.exec(message);
  return m ? PREMIUM[lang].limitHit[m[1]] : null;
}
