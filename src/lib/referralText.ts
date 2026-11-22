import type { Lang } from './types';

interface Words {
  nav: string; heroTitle: (a: string) => string; heroText: string; yourCode: string; copyLink: string; copied: string; share: string; shareText: string;
  balance: string; paid: string; friends: string; waiting: string;
  installStep: [string, string]; rulesInstall: string;
  howTitle: string; steps: (days: number, actions: number) => Array<[string, string]>;
  rulesTitle: string; rules: (monthly: number, minPayout: string) => string[];
  listTitle: string; listEmpty: string; stPending: string; stQualified: string; stPaid: string; stRejected: string;
  payoutTitle: string; payoutHelp: string; payoutPh: string; save: string; saved: string; off: string; err: string; typed: string; claimOk: string;
}

export const REFERRAL: Record<Lang, Words> = {
  en: {
    installStep: ['They install the app','They add Kezzo to their phone (Add to Home screen or the app). Only the first install of a phone counts.'], rulesInstall: 'Only the first install of a phone counts: deleting and installing again does not earn twice.', nav: 'Invite & Earn', heroTitle: (a) => `Invite friends, earn ${a} each`, heroText: 'Share your personal link. When your friend joins Kezzo and becomes an active member, you earn a reward.',
    yourCode: 'Your invite code', copyLink: 'Copy link', copied: 'Link copied.', share: 'Share', shareText: 'Join me on Kezzo!',
    balance: 'Your balance', paid: 'Already paid', friends: 'Friends who qualified', waiting: 'Waiting to qualify',
    howTitle: 'How it works',
    steps: (d, n) => [['Share your link', 'Send it by WhatsApp, Facebook, TikTok or any other app.'], ['Your friend signs up', 'They open your link on the web or the phone app and create an account.'], ['They become active', `After ${d} days with a confirmed e-mail, they post, comment or like at least ${n} times.`], ['You earn', 'The reward is added to your balance. It is paid once a month.']],
    rulesTitle: 'Rules', rules: (m, p) => [`Rewards are paid once a month, when your balance reaches ${p}.`, `You can earn from up to ${m} friends each month.`, 'Fake accounts, self-invites and repeated sign-ups are rejected and can lead to a ban.', 'The code must be used when your friend signs up, not later.'],
    listTitle: 'My invited friends', listEmpty: 'No one has joined with your link yet.', stPending: 'Pending', stQualified: 'Earned', stPaid: 'Paid', stRejected: 'Rejected',
    payoutTitle: 'How should we pay you?', payoutHelp: 'Your mobile money number, PayPal e-mail or bank details. Only the Kezzo team can see it.', payoutPh: 'e.g. Mobile money +257…', save: 'Save', saved: 'Saved.', off: 'The invite program is paused for now.', err: 'Something went wrong. Please try again.', typed: 'Link is copied. Paste it anywhere.', claimOk: 'Welcome! You joined through a friend.',
  },
  fr: {
    installStep: ['Il installe l’application','Il ajoute Kezzo à son téléphone (écran d’accueil ou application). Seule la première installation d’un téléphone compte.'], rulesInstall: 'Seule la première installation d’un téléphone compte : supprimer puis réinstaller ne rapporte pas deux fois.', nav: 'Inviter et gagner', heroTitle: (a) => `Invitez vos amis, gagnez ${a} chacun`, heroText: 'Partagez votre lien personnel. Quand votre ami rejoint Kezzo et devient actif, vous gagnez une récompense.',
    yourCode: 'Votre code d’invitation', copyLink: 'Copier le lien', copied: 'Lien copié.', share: 'Partager', shareText: 'Rejoins-moi sur Kezzo !',
    balance: 'Votre solde', paid: 'Déjà payé', friends: 'Amis qualifiés', waiting: 'En attente',
    howTitle: 'Comment ça marche',
    steps: (d, n) => [['Partagez votre lien', 'Envoyez-le par WhatsApp, Facebook, TikTok ou une autre application.'], ['Votre ami s’inscrit', 'Il ouvre votre lien sur le web ou l’application et crée un compte.'], ['Il devient actif', `Après ${d} jours avec un e-mail confirmé, il publie, commente ou aime au moins ${n} fois.`], ['Vous gagnez', 'La récompense s’ajoute à votre solde. Elle est payée une fois par mois.']],
    rulesTitle: 'Règles', rules: (m, p) => [`Les récompenses sont payées une fois par mois, quand votre solde atteint ${p}.`, `Vous pouvez gagner pour ${m} amis au maximum par mois.`, 'Les faux comptes, auto-invitations et inscriptions répétées sont refusés et peuvent mener à un bannissement.', 'Le code doit être utilisé à l’inscription de votre ami, pas après.'],
    listTitle: 'Mes amis invités', listEmpty: 'Personne n’a encore rejoint avec votre lien.', stPending: 'En attente', stQualified: 'Gagné', stPaid: 'Payé', stRejected: 'Refusé',
    payoutTitle: 'Comment vous payer ?', payoutHelp: 'Votre numéro mobile money, e-mail PayPal ou coordonnées bancaires. Seule l’équipe Kezzo les voit.', payoutPh: 'ex. Mobile money +257…', save: 'Enregistrer', saved: 'Enregistré.', off: 'Le programme d’invitation est en pause.', err: 'Une erreur est survenue. Réessayez.', typed: 'Lien copié. Collez-le où vous voulez.', claimOk: 'Bienvenue ! Vous avez rejoint via un ami.',
  },
  es: {
    installStep: ['Instala la app','Añade Kezzo a su teléfono (pantalla de inicio o la app). Solo cuenta la primera instalación de un teléfono.'], rulesInstall: 'Solo cuenta la primera instalación de un teléfono: borrar e instalar otra vez no paga dos veces.', nav: 'Invita y gana', heroTitle: (a) => `Invita amigos, gana ${a} por cada uno`, heroText: 'Comparte tu enlace personal. Cuando tu amigo se une a Kezzo y se vuelve activo, ganas una recompensa.',
    yourCode: 'Tu código de invitación', copyLink: 'Copiar enlace', copied: 'Enlace copiado.', share: 'Compartir', shareText: '¡Únete a mí en Kezzo!',
    balance: 'Tu saldo', paid: 'Ya pagado', friends: 'Amigos calificados', waiting: 'En espera',
    howTitle: 'Cómo funciona',
    steps: (d, n) => [['Comparte tu enlace', 'Envíalo por WhatsApp, Facebook, TikTok u otra app.'], ['Tu amigo se registra', 'Abre tu enlace en la web o la app y crea una cuenta.'], ['Se vuelve activo', `Tras ${d} días con el correo confirmado, publica, comenta o da me gusta al menos ${n} veces.`], ['Tú ganas', 'La recompensa se suma a tu saldo. Se paga una vez al mes.']],
    rulesTitle: 'Reglas', rules: (m, p) => [`Las recompensas se pagan una vez al mes, cuando tu saldo llega a ${p}.`, `Puedes ganar por hasta ${m} amigos cada mes.`, 'Las cuentas falsas, autoinvitaciones y registros repetidos se rechazan y pueden causar un bloqueo.', 'El código debe usarse al registrarse tu amigo, no después.'],
    listTitle: 'Mis amigos invitados', listEmpty: 'Nadie se ha unido con tu enlace todavía.', stPending: 'Pendiente', stQualified: 'Ganado', stPaid: 'Pagado', stRejected: 'Rechazado',
    payoutTitle: '¿Cómo te pagamos?', payoutHelp: 'Tu número de dinero móvil, correo de PayPal o datos bancarios. Solo el equipo de Kezzo lo ve.', payoutPh: 'p. ej. Dinero móvil +257…', save: 'Guardar', saved: 'Guardado.', off: 'El programa de invitación está en pausa.', err: 'Algo salió mal. Inténtalo de nuevo.', typed: 'Enlace copiado. Pégalo donde quieras.', claimOk: '¡Bienvenido! Te uniste por un amigo.',
  },
  pt: {
    installStep: ['Ele instala o app','Ele adiciona o Kezzo ao celular (tela inicial ou o app). Só conta a primeira instalação de um celular.'], rulesInstall: 'Só conta a primeira instalação de um celular: apagar e instalar de novo não paga duas vezes.', nav: 'Convide e ganhe', heroTitle: (a) => `Convide amigos, ganhe ${a} por cada um`, heroText: 'Compartilhe seu link pessoal. Quando seu amigo entra no Kezzo e fica ativo, você ganha uma recompensa.',
    yourCode: 'Seu código de convite', copyLink: 'Copiar link', copied: 'Link copiado.', share: 'Compartilhar', shareText: 'Venha para o Kezzo comigo!',
    balance: 'Seu saldo', paid: 'Já pago', friends: 'Amigos qualificados', waiting: 'Aguardando',
    howTitle: 'Como funciona',
    steps: (d, n) => [['Compartilhe seu link', 'Envie por WhatsApp, Facebook, TikTok ou outro app.'], ['Seu amigo se cadastra', 'Ele abre seu link na web ou no app e cria uma conta.'], ['Ele fica ativo', `Após ${d} dias com e-mail confirmado, ele publica, comenta ou curte pelo menos ${n} vezes.`], ['Você ganha', 'A recompensa entra no seu saldo. O pagamento é mensal.']],
    rulesTitle: 'Regras', rules: (m, p) => [`As recompensas são pagas uma vez por mês, quando seu saldo chega a ${p}.`, `Você pode ganhar por até ${m} amigos por mês.`, 'Contas falsas, autoconvites e cadastros repetidos são recusados e podem levar a bloqueio.', 'O código deve ser usado no cadastro do seu amigo, não depois.'],
    listTitle: 'Meus amigos convidados', listEmpty: 'Ninguém entrou com seu link ainda.', stPending: 'Pendente', stQualified: 'Ganho', stPaid: 'Pago', stRejected: 'Recusado',
    payoutTitle: 'Como pagamos você?', payoutHelp: 'Seu número de dinheiro móvel, e-mail do PayPal ou dados bancários. Só a equipe Kezzo vê.', payoutPh: 'ex. Dinheiro móvel +257…', save: 'Salvar', saved: 'Salvo.', off: 'O programa de convites está pausado.', err: 'Algo deu errado. Tente de novo.', typed: 'Link copiado. Cole onde quiser.', claimOk: 'Bem-vindo! Você entrou por um amigo.',
  },
  hi: {
    installStep: ['वह ऐप इंस्टॉल करे','वह Kezzo को अपने फ़ोन में जोड़े (होम स्क्रीन या ऐप)। किसी फ़ोन का केवल पहला इंस्टॉल गिना जाता है।'], rulesInstall: 'किसी फ़ोन का केवल पहला इंस्टॉल गिना जाता है: हटाकर दोबारा इंस्टॉल करने पर दो बार इनाम नहीं मिलता।', nav: 'आमंत्रित करें और कमाएँ', heroTitle: (a) => `दोस्तों को बुलाएँ, हर एक पर ${a} कमाएँ`, heroText: 'अपना निजी लिंक साझा करें। जब आपका दोस्त Kezzo से जुड़कर सक्रिय हो जाता है, आपको इनाम मिलता है।',
    yourCode: 'आपका आमंत्रण कोड', copyLink: 'लिंक कॉपी करें', copied: 'लिंक कॉपी हो गया।', share: 'साझा करें', shareText: 'Kezzo पर मेरे साथ जुड़ें!',
    balance: 'आपका बैलेंस', paid: 'भुगतान हो चुका', friends: 'योग्य दोस्त', waiting: 'प्रतीक्षा में',
    howTitle: 'यह कैसे काम करता है',
    steps: (d, n) => [['अपना लिंक साझा करें', 'WhatsApp, Facebook, TikTok या किसी भी ऐप से भेजें।'], ['दोस्त साइन अप करे', 'वह आपका लिंक वेब या ऐप पर खोलकर खाता बनाए।'], ['वह सक्रिय हो', `पुष्टि किए ई-मेल के साथ ${d} दिन बाद, वह कम से कम ${n} बार पोस्ट, कमेंट या लाइक करे।`], ['आप कमाएँ', 'इनाम आपके बैलेंस में जुड़ जाता है। भुगतान महीने में एक बार होता है।']],
    rulesTitle: 'नियम', rules: (m, p) => [`इनाम महीने में एक बार दिया जाता है, जब आपका बैलेंस ${p} तक पहुँचे।`, `आप हर महीने अधिकतम ${m} दोस्तों पर कमा सकते हैं।`, 'नकली खाते, खुद को आमंत्रित करना और बार-बार साइन अप अस्वीकार होते हैं और प्रतिबंध लग सकता है।', 'कोड दोस्त के साइन अप के समय इस्तेमाल होना चाहिए, बाद में नहीं।'],
    listTitle: 'मेरे आमंत्रित दोस्त', listEmpty: 'अभी तक किसी ने आपके लिंक से जुड़ा नहीं।', stPending: 'लंबित', stQualified: 'कमाया', stPaid: 'भुगतान हुआ', stRejected: 'अस्वीकृत',
    payoutTitle: 'हम आपको भुगतान कैसे करें?', payoutHelp: 'आपका मोबाइल मनी नंबर, PayPal ई-मेल या बैंक विवरण। केवल Kezzo टीम इसे देखती है।', payoutPh: 'जैसे मोबाइल मनी +257…', save: 'सहेजें', saved: 'सहेजा गया।', off: 'आमंत्रण कार्यक्रम अभी रुका हुआ है।', err: 'कुछ गलत हुआ। फिर कोशिश करें।', typed: 'लिंक कॉपी हो गया। कहीं भी पेस्ट करें।', claimOk: 'स्वागत है! आप एक दोस्त के ज़रिए जुड़े।',
  },
};

interface AdminWords {
  tab: string; title: string; help: string; owed: string; paidT: string; pendingN: string; qualifiedN: string; rejectedN: string;
  requireInstall: string; requireEmail: string; rulesText: string; rulesHelp: string; approve: string; installsN: string;
  settings: string; enabled: string; reward: string; actions: string; days: string; window: string; cap: string; minPayout: string; saveSettings: string; saved: string;
  payouts: string; payoutsHelp: string; noPayouts: string; markPaid: string; paidNote: string; belowMin: string; noInfo: string; block: string; unblock: string; blocked: string;
  list: string; all: string; pending: string; qualified: string; paid: string; rejected: string; reject: string; restore: string; reason: string; invitedBy: string; empty: string; err: string; done: string; confirmPaid: string;
}
export const REFERRAL_ADMIN: Record<'en' | 'fr', AdminWords> = {
  en: {
    tab: 'Referrals', title: 'Invite & Earn', help: 'Members invite friends with a personal link. A referral only counts once the new member is real: confirmed e-mail, old enough and active. You pay balances once a month and mark them paid here.',
    owed: 'To pay', paidT: 'Paid so far', pendingN: 'Pending', qualifiedN: 'Qualified', rejectedN: 'Rejected',
    requireInstall: 'Friend must install the app (first install of a phone only)', requireEmail: 'Friend must confirm their e-mail', rulesText: 'Rules shown to members', rulesHelp: 'Optional. One rule per line. Leave empty to show the standard rules.', approve: 'Approve', installsN: 'Phones counted',
    settings: 'Settings', enabled: 'Program is on', reward: 'Reward per friend (US cents)', actions: 'Minimum actions (posts, comments, likes)', days: 'Minimum days since sign-up', window: 'Days to enter a code after sign-up', cap: 'Max rewards per member per month', minPayout: 'Minimum balance to pay (US cents)', saveSettings: 'Save settings', saved: 'Saved.',
    payouts: 'Monthly payouts', payoutsHelp: 'Pay each person outside Kezzo (mobile money, PayPal, bank), then press “Mark as paid”.', noPayouts: 'Nobody is waiting to be paid.', markPaid: 'Mark as paid', paidNote: 'Note (e.g. “Nov 2026, mobile money”)', belowMin: 'Below the minimum', noInfo: 'No payment details yet', block: 'Block', unblock: 'Unblock', blocked: 'Blocked',
    list: 'All referrals', all: 'All', pending: 'Pending', qualified: 'Qualified', paid: 'Paid', rejected: 'Rejected', reject: 'Reject', restore: 'Restore', reason: 'Reason (fake account, duplicate…)', invitedBy: 'invited by', empty: 'Nothing here yet.', err: 'Something went wrong.', done: 'Done.', confirmPaid: 'Mark all of this person’s rewards as paid?',
  },
  fr: {
    tab: 'Parrainage', title: 'Inviter et gagner', help: 'Les membres invitent leurs amis avec un lien personnel. Un parrainage ne compte que si le nouveau membre est réel : e-mail confirmé, assez ancien et actif. Vous payez les soldes une fois par mois et les marquez payés ici.',
    owed: 'À payer', paidT: 'Déjà payé', pendingN: 'En attente', qualifiedN: 'Qualifiés', rejectedN: 'Refusés',
    requireInstall: 'L’ami doit installer l’application (première installation d’un téléphone seulement)', requireEmail: 'L’ami doit confirmer son e-mail', rulesText: 'Règles affichées aux membres', rulesHelp: 'Facultatif. Une règle par ligne. Laissez vide pour afficher les règles standard.', approve: 'Approuver', installsN: 'Téléphones comptés',
    settings: 'Réglages', enabled: 'Programme activé', reward: 'Récompense par ami (cents US)', actions: 'Actions minimum (publications, commentaires, j’aime)', days: 'Jours minimum depuis l’inscription', window: 'Jours pour saisir un code après l’inscription', cap: 'Récompenses max par membre et par mois', minPayout: 'Solde minimum pour payer (cents US)', saveSettings: 'Enregistrer', saved: 'Enregistré.',
    payouts: 'Paiements du mois', payoutsHelp: 'Payez chaque personne hors de Kezzo (mobile money, PayPal, banque), puis appuyez sur « Marquer payé ».', noPayouts: 'Personne n’attend de paiement.', markPaid: 'Marquer payé', paidNote: 'Note (ex. « Nov 2026, mobile money »)', belowMin: 'Sous le minimum', noInfo: 'Pas encore de coordonnées', block: 'Bloquer', unblock: 'Débloquer', blocked: 'Bloqué',
    list: 'Tous les parrainages', all: 'Tous', pending: 'En attente', qualified: 'Qualifiés', paid: 'Payés', rejected: 'Refusés', reject: 'Refuser', restore: 'Rétablir', reason: 'Motif (faux compte, doublon…)', invitedBy: 'invité par', empty: 'Rien pour l’instant.', err: 'Une erreur est survenue.', done: 'Fait.', confirmPaid: 'Marquer toutes les récompenses de cette personne comme payées ?',
  },
};
