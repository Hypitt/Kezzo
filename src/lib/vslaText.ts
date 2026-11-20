import type { Lang } from './types';

/** Plain-language help and the contribution flow for savings groups (VSLA). */
export interface VslaWords {
  guideTitle: string; guideShow: string; guideHide: string; guideSteps: Array<[string, string]>;
  hintStart: string; hintWait: string; hintReview: (n: number) => string; hintReviewBtn: string; hintPay: string; hintPayBtn: string;
  payTitle: string; payHelp: string; whatPaid: string; kShares: string; kSocial: string; kRepay: string;
  sharesQ: string; sharesHelp: (price: string, max: number) => string; youPay: (amount: string) => string;
  amountL: string; dateL: string; noteL: string; notePh: string; loanQ: string; noLoan: string; send: string; sentOk: string; offlineNow: string;
  mineTitle: string; mineEmpty: string; stPending: string; stApproved: string; stDeclined: string; stCancelled: string; cancelBtn: string;
  toApprove: string; nothingToApprove: string; approveBtn: string; declineBtn: string; approveAll: string; approvedN: (n: number) => string; adminHint: string;
  sectSummary: string; sectMembers: string; sectRecord: string; sectRecent: string; recordHelp: string;
  kindHelp: { shares: string; social: string; fine: string; loan: string; loan_repay: string };
  cycleHelp: { freq: string; currency: string; price: string; interest: string; multiple: string }; startHelp: string;
  joinHelp: string; createHelp: string; required: string;
}

export const VSLA: Record<Lang, VslaWords> = {
  en: {
    guideTitle: 'How savings groups work', guideShow: 'How does it work?', guideHide: 'Hide help',
    guideSteps: [
      ['Create or join a group', 'One person creates the group and shares its code. The other members join with that code.'],
      ['Start a cycle', 'The treasurer sets the price of one share, the interest on loans and how often the group meets.'],
      ['Pay your contribution', 'Each member sends their contribution here. The treasurer checks it and approves it, then it appears in the list.'],
      ['Borrow and share out', 'Members can ask for a loan. At the end of the cycle, the savings and the interest are shared out.'],
    ],
    hintStart: 'Next step: start your first cycle below.', hintWait: 'The treasurer has not started a cycle yet. You can send contributions as soon as it starts.',
    hintReview: (n) => `${n} contribution${n > 1 ? 's are' : ' is'} waiting for your approval.`, hintReviewBtn: 'Review', hintPay: 'Next step: send your contribution for this meeting.', hintPayBtn: 'Send my contribution',
    payTitle: 'Send my contribution', payHelp: 'Choose what you paid, check the amount, then send. The treasurer will check it and approve it.',
    whatPaid: 'What did you pay?', kShares: 'Savings shares', kSocial: 'Social fund', kRepay: 'Loan repayment',
    sharesQ: 'How many shares?', sharesHelp: (price, max) => `One share costs ${price}. You can buy up to ${max} per meeting.`, youPay: (a) => `You pay: ${a}`,
    amountL: 'Amount', dateL: 'Date you paid', noteL: 'Note (optional)', notePh: 'For example: paid in cash to the treasurer', loanQ: 'Which loan?', noLoan: 'You have no open loan.',
    send: 'Send for approval', sentOk: 'Sent. The treasurer will approve it soon.', offlineNow: 'You are offline. Try again when you have a connection.',
    mineTitle: 'My contributions', mineEmpty: 'You have not sent any contribution yet.', stPending: 'Waiting for approval', stApproved: 'Approved', stDeclined: 'Declined', stCancelled: 'Cancelled', cancelBtn: 'Cancel',
    toApprove: 'To approve', nothingToApprove: 'Nothing to approve right now.', approveBtn: 'Approve', declineBtn: 'Decline', approveAll: 'Approve all', approvedN: (n) => `${n} approved.`,
    adminHint: 'Members send their own contributions here. Approve them in one tap and they are added to the books.',
    sectSummary: 'Summary', sectMembers: 'Members', sectRecord: 'Record an entry yourself', sectRecent: 'Latest activity',
    recordHelp: 'Use this for a member who gave you cash in person, or for a member without a Kezzo account.',
    kindHelp: {
      shares: 'Shares a member bought at the meeting. The amount is the number of shares times the share price.',
      social: 'Money for the social fund, for example for emergencies.',
      fine: 'A fine paid by a member, for example for being late.',
      loan: 'Lend money to a member. The loan grows by the interest rate of this cycle.',
      loan_repay: 'A member paying back a loan, in part or in full.',
    },
    cycleHelp: {
      freq: 'How often the group meets and members contribute.', currency: 'The money your group uses, for example KES, UGX or RWF.',
      price: 'What one share costs. Members buy shares at each meeting.', interest: 'Percent added to a loan when it is repaid. Use 0 for no interest.',
      multiple: 'Optional. A member can borrow up to this many times their savings. Leave empty for no limit.',
    },
    startHelp: 'A cycle is one savings period, often a year. Fill in the rules your group agreed on.',
    joinHelp: 'Have a code from your group? Enter it to join.', createHelp: 'Start a new savings group. You become its treasurer.', required: 'required',
  },
  fr: {
    guideTitle: 'Comment fonctionne un groupe d’épargne', guideShow: 'Comment ça marche ?', guideHide: 'Masquer l’aide',
    guideSteps: [
      ['Créer ou rejoindre un groupe', 'Une personne crée le groupe et partage son code. Les autres membres rejoignent avec ce code.'],
      ['Démarrer un cycle', 'Le trésorier fixe le prix d’une part, l’intérêt des prêts et la fréquence des réunions.'],
      ['Verser sa cotisation', 'Chaque membre envoie sa cotisation ici. Le trésorier la vérifie et l’approuve, puis elle apparaît dans la liste.'],
      ['Emprunter et partager', 'Les membres peuvent demander un prêt. À la fin du cycle, l’épargne et les intérêts sont partagés.'],
    ],
    hintStart: 'Prochaine étape : démarrez votre premier cycle ci-dessous.', hintWait: 'Le trésorier n’a pas encore démarré de cycle. Vous pourrez envoyer vos cotisations dès son démarrage.',
    hintReview: (n) => `${n} cotisation${n > 1 ? 's attendent' : ' attend'} votre approbation.`, hintReviewBtn: 'Voir', hintPay: 'Prochaine étape : envoyez votre cotisation pour cette réunion.', hintPayBtn: 'Envoyer ma cotisation',
    payTitle: 'Envoyer ma cotisation', payHelp: 'Choisissez ce que vous avez payé, vérifiez le montant, puis envoyez. Le trésorier la vérifiera et l’approuvera.',
    whatPaid: 'Qu’avez-vous payé ?', kShares: 'Parts d’épargne', kSocial: 'Fonds social', kRepay: 'Remboursement de prêt',
    sharesQ: 'Combien de parts ?', sharesHelp: (price, max) => `Une part coûte ${price}. Vous pouvez en acheter jusqu’à ${max} par réunion.`, youPay: (a) => `Vous payez : ${a}`,
    amountL: 'Montant', dateL: 'Date du paiement', noteL: 'Note (facultatif)', notePh: 'Par exemple : payé en espèces au trésorier', loanQ: 'Quel prêt ?', noLoan: 'Vous n’avez aucun prêt en cours.',
    send: 'Envoyer pour approbation', sentOk: 'Envoyé. Le trésorier l’approuvera bientôt.', offlineNow: 'Vous êtes hors ligne. Réessayez avec une connexion.',
    mineTitle: 'Mes cotisations', mineEmpty: 'Vous n’avez envoyé aucune cotisation.', stPending: 'En attente d’approbation', stApproved: 'Approuvée', stDeclined: 'Refusée', stCancelled: 'Annulée', cancelBtn: 'Annuler',
    toApprove: 'À approuver', nothingToApprove: 'Rien à approuver pour le moment.', approveBtn: 'Approuver', declineBtn: 'Refuser', approveAll: 'Tout approuver', approvedN: (n) => `${n} approuvée${n > 1 ? 's' : ''}.`,
    adminHint: 'Les membres envoient eux-mêmes leurs cotisations ici. Approuvez-les en un geste et elles sont ajoutées aux livres.',
    sectSummary: 'Résumé', sectMembers: 'Membres', sectRecord: 'Enregistrer une opération vous-même', sectRecent: 'Activité récente',
    recordHelp: 'À utiliser pour un membre qui vous a remis de l’argent en main propre, ou un membre sans compte Kezzo.',
    kindHelp: {
      shares: 'Parts achetées par un membre à la réunion. Le montant est le nombre de parts multiplié par le prix d’une part.',
      social: 'Argent pour le fonds social, par exemple pour les urgences.',
      fine: 'Amende payée par un membre, par exemple pour un retard.',
      loan: 'Prêter de l’argent à un membre. Le prêt augmente du taux d’intérêt du cycle.',
      loan_repay: 'Un membre rembourse un prêt, en partie ou en totalité.',
    },
    cycleHelp: {
      freq: 'La fréquence des réunions et des cotisations.', currency: 'La monnaie de votre groupe, par exemple KES, UGX ou RWF.',
      price: 'Le prix d’une part. Les membres achètent des parts à chaque réunion.', interest: 'Pourcentage ajouté à un prêt au remboursement. Mettez 0 pour aucun intérêt.',
      multiple: 'Facultatif. Un membre peut emprunter jusqu’à ce multiple de son épargne. Laissez vide pour aucune limite.',
    },
    startHelp: 'Un cycle est une période d’épargne, souvent d’un an. Indiquez les règles convenues par votre groupe.',
    joinHelp: 'Vous avez un code de votre groupe ? Saisissez-le pour rejoindre.', createHelp: 'Créez un nouveau groupe d’épargne. Vous en devenez le trésorier.', required: 'obligatoire',
  },
  es: {
    guideTitle: 'Cómo funciona un grupo de ahorro', guideShow: '¿Cómo funciona?', guideHide: 'Ocultar ayuda',
    guideSteps: [
      ['Crear o unirse a un grupo', 'Una persona crea el grupo y comparte su código. Los demás miembros se unen con ese código.'],
      ['Iniciar un ciclo', 'El tesorero define el precio de una acción, el interés de los préstamos y cada cuánto se reúne el grupo.'],
      ['Pagar tu aporte', 'Cada miembro envía su aporte aquí. El tesorero lo revisa y lo aprueba, y entonces aparece en la lista.'],
      ['Pedir prestado y repartir', 'Los miembros pueden pedir un préstamo. Al final del ciclo se reparten los ahorros y los intereses.'],
    ],
    hintStart: 'Siguiente paso: inicia tu primer ciclo abajo.', hintWait: 'El tesorero aún no inició un ciclo. Podrás enviar aportes en cuanto empiece.',
    hintReview: (n) => `${n} aporte${n > 1 ? 's esperan' : ' espera'} tu aprobación.`, hintReviewBtn: 'Revisar', hintPay: 'Siguiente paso: envía tu aporte de esta reunión.', hintPayBtn: 'Enviar mi aporte',
    payTitle: 'Enviar mi aporte', payHelp: 'Elige lo que pagaste, revisa el monto y envía. El tesorero lo revisará y lo aprobará.',
    whatPaid: '¿Qué pagaste?', kShares: 'Acciones de ahorro', kSocial: 'Fondo social', kRepay: 'Pago de préstamo',
    sharesQ: '¿Cuántas acciones?', sharesHelp: (price, max) => `Una acción cuesta ${price}. Puedes comprar hasta ${max} por reunión.`, youPay: (a) => `Pagas: ${a}`,
    amountL: 'Monto', dateL: 'Fecha del pago', noteL: 'Nota (opcional)', notePh: 'Por ejemplo: pagado en efectivo al tesorero', loanQ: '¿Qué préstamo?', noLoan: 'No tienes préstamos abiertos.',
    send: 'Enviar para aprobación', sentOk: 'Enviado. El tesorero lo aprobará pronto.', offlineNow: 'Estás sin conexión. Inténtalo de nuevo con conexión.',
    mineTitle: 'Mis aportes', mineEmpty: 'Aún no has enviado ningún aporte.', stPending: 'Esperando aprobación', stApproved: 'Aprobado', stDeclined: 'Rechazado', stCancelled: 'Cancelado', cancelBtn: 'Cancelar',
    toApprove: 'Por aprobar', nothingToApprove: 'Nada por aprobar ahora.', approveBtn: 'Aprobar', declineBtn: 'Rechazar', approveAll: 'Aprobar todo', approvedN: (n) => `${n} aprobado${n > 1 ? 's' : ''}.`,
    adminHint: 'Los miembros envían aquí sus propios aportes. Apruébalos con un toque y se añaden a los libros.',
    sectSummary: 'Resumen', sectMembers: 'Miembros', sectRecord: 'Registrar una operación tú mismo', sectRecent: 'Actividad reciente',
    recordHelp: 'Úsalo para un miembro que te dio dinero en persona, o un miembro sin cuenta de Kezzo.',
    kindHelp: {
      shares: 'Acciones que un miembro compró en la reunión. El monto es el número de acciones por el precio de una acción.',
      social: 'Dinero para el fondo social, por ejemplo para emergencias.',
      fine: 'Multa pagada por un miembro, por ejemplo por llegar tarde.',
      loan: 'Prestar dinero a un miembro. El préstamo crece con el interés de este ciclo.',
      loan_repay: 'Un miembro devuelve un préstamo, en parte o por completo.',
    },
    cycleHelp: {
      freq: 'Cada cuánto se reúne el grupo y los miembros aportan.', currency: 'La moneda de tu grupo, por ejemplo KES, UGX o RWF.',
      price: 'Lo que cuesta una acción. Los miembros compran acciones en cada reunión.', interest: 'Porcentaje que se suma al préstamo al pagarlo. Usa 0 para sin interés.',
      multiple: 'Opcional. Un miembro puede pedir hasta este múltiplo de sus ahorros. Déjalo vacío para no tener límite.',
    },
    startHelp: 'Un ciclo es un periodo de ahorro, a menudo un año. Escribe las reglas que acordó tu grupo.',
    joinHelp: '¿Tienes un código de tu grupo? Escríbelo para unirte.', createHelp: 'Crea un nuevo grupo de ahorro. Serás su tesorero.', required: 'obligatorio',
  },
  pt: {
    guideTitle: 'Como funciona um grupo de poupança', guideShow: 'Como funciona?', guideHide: 'Ocultar ajuda',
    guideSteps: [
      ['Criar ou entrar em um grupo', 'Uma pessoa cria o grupo e compartilha o código. Os outros membros entram com esse código.'],
      ['Iniciar um ciclo', 'O tesoureiro define o preço de uma cota, os juros dos empréstimos e a frequência das reuniões.'],
      ['Pagar sua contribuição', 'Cada membro envia a contribuição aqui. O tesoureiro confere e aprova, e então ela aparece na lista.'],
      ['Pedir emprestado e repartir', 'Os membros podem pedir um empréstimo. No fim do ciclo, a poupança e os juros são repartidos.'],
    ],
    hintStart: 'Próximo passo: inicie seu primeiro ciclo abaixo.', hintWait: 'O tesoureiro ainda não iniciou um ciclo. Você poderá enviar contribuições assim que começar.',
    hintReview: (n) => `${n} contribuiç${n > 1 ? 'ões aguardam' : 'ão aguarda'} sua aprovação.`, hintReviewBtn: 'Revisar', hintPay: 'Próximo passo: envie sua contribuição desta reunião.', hintPayBtn: 'Enviar minha contribuição',
    payTitle: 'Enviar minha contribuição', payHelp: 'Escolha o que você pagou, confira o valor e envie. O tesoureiro vai conferir e aprovar.',
    whatPaid: 'O que você pagou?', kShares: 'Cotas de poupança', kSocial: 'Fundo social', kRepay: 'Pagamento de empréstimo',
    sharesQ: 'Quantas cotas?', sharesHelp: (price, max) => `Uma cota custa ${price}. Você pode comprar até ${max} por reunião.`, youPay: (a) => `Você paga: ${a}`,
    amountL: 'Valor', dateL: 'Data do pagamento', noteL: 'Nota (opcional)', notePh: 'Por exemplo: pago em dinheiro ao tesoureiro', loanQ: 'Qual empréstimo?', noLoan: 'Você não tem empréstimo em aberto.',
    send: 'Enviar para aprovação', sentOk: 'Enviado. O tesoureiro vai aprovar em breve.', offlineNow: 'Você está offline. Tente de novo com conexão.',
    mineTitle: 'Minhas contribuições', mineEmpty: 'Você ainda não enviou nenhuma contribuição.', stPending: 'Aguardando aprovação', stApproved: 'Aprovada', stDeclined: 'Recusada', stCancelled: 'Cancelada', cancelBtn: 'Cancelar',
    toApprove: 'A aprovar', nothingToApprove: 'Nada para aprovar agora.', approveBtn: 'Aprovar', declineBtn: 'Recusar', approveAll: 'Aprovar tudo', approvedN: (n) => `${n} aprovada${n > 1 ? 's' : ''}.`,
    adminHint: 'Os membros enviam aqui as próprias contribuições. Aprove com um toque e elas entram nos livros.',
    sectSummary: 'Resumo', sectMembers: 'Membros', sectRecord: 'Registrar um lançamento você mesmo', sectRecent: 'Atividade recente',
    recordHelp: 'Use para um membro que lhe entregou dinheiro pessoalmente, ou um membro sem conta no Kezzo.',
    kindHelp: {
      shares: 'Cotas que um membro comprou na reunião. O valor é o número de cotas vezes o preço de uma cota.',
      social: 'Dinheiro para o fundo social, por exemplo para emergências.',
      fine: 'Multa paga por um membro, por exemplo por atraso.',
      loan: 'Emprestar dinheiro a um membro. O empréstimo cresce com os juros deste ciclo.',
      loan_repay: 'Um membro pagando um empréstimo, em parte ou por inteiro.',
    },
    cycleHelp: {
      freq: 'Com que frequência o grupo se reúne e os membros contribuem.', currency: 'A moeda do seu grupo, por exemplo KES, UGX ou RWF.',
      price: 'Quanto custa uma cota. Os membros compram cotas a cada reunião.', interest: 'Percentual somado ao empréstimo quando ele é pago. Use 0 para sem juros.',
      multiple: 'Opcional. Um membro pode pedir até este múltiplo da própria poupança. Deixe vazio para sem limite.',
    },
    startHelp: 'Um ciclo é um período de poupança, geralmente um ano. Preencha as regras que o grupo combinou.',
    joinHelp: 'Tem um código do seu grupo? Digite para entrar.', createHelp: 'Crie um novo grupo de poupança. Você será o tesoureiro.', required: 'obrigatório',
  },
  hi: {
    guideTitle: 'बचत समूह कैसे काम करता है', guideShow: 'यह कैसे काम करता है?', guideHide: 'मदद छिपाएँ',
    guideSteps: [
      ['समूह बनाएँ या जुड़ें', 'एक व्यक्ति समूह बनाकर उसका कोड साझा करता है। बाकी सदस्य उस कोड से जुड़ते हैं।'],
      ['चक्र शुरू करें', 'कोषाध्यक्ष एक हिस्से की क़ीमत, ऋण पर ब्याज और बैठक कितनी बार होगी, यह तय करता है।'],
      ['अपना योगदान दें', 'हर सदस्य अपना योगदान यहाँ भेजता है। कोषाध्यक्ष जाँचकर मंज़ूर करता है, फिर वह सूची में दिखता है।'],
      ['उधार लें और बाँटें', 'सदस्य ऋण माँग सकते हैं। चक्र के अंत में बचत और ब्याज बाँट दिए जाते हैं।'],
    ],
    hintStart: 'अगला क़दम: नीचे अपना पहला चक्र शुरू करें।', hintWait: 'कोषाध्यक्ष ने अभी चक्र शुरू नहीं किया। शुरू होते ही आप योगदान भेज सकेंगे।',
    hintReview: (n) => `${n} योगदान आपकी मंज़ूरी का इंतज़ार कर रहे हैं।`, hintReviewBtn: 'देखें', hintPay: 'अगला क़दम: इस बैठक का अपना योगदान भेजें।', hintPayBtn: 'मेरा योगदान भेजें',
    payTitle: 'मेरा योगदान भेजें', payHelp: 'चुनें कि आपने क्या दिया, राशि जाँचें और भेजें। कोषाध्यक्ष जाँचकर मंज़ूर करेगा।',
    whatPaid: 'आपने क्या दिया?', kShares: 'बचत के हिस्से', kSocial: 'सामाजिक कोष', kRepay: 'ऋण की वापसी',
    sharesQ: 'कितने हिस्से?', sharesHelp: (price, max) => `एक हिस्से की क़ीमत ${price} है। हर बैठक में अधिकतम ${max} ख़रीद सकते हैं।`, youPay: (a) => `आप देंगे: ${a}`,
    amountL: 'राशि', dateL: 'भुगतान की तारीख़', noteL: 'नोट (वैकल्पिक)', notePh: 'जैसे: कोषाध्यक्ष को नक़द दिया', loanQ: 'कौन सा ऋण?', noLoan: 'आपका कोई खुला ऋण नहीं है।',
    send: 'मंज़ूरी के लिए भेजें', sentOk: 'भेज दिया। कोषाध्यक्ष जल्द मंज़ूर करेगा।', offlineNow: 'आप ऑफ़लाइन हैं। कनेक्शन होने पर फिर कोशिश करें।',
    mineTitle: 'मेरे योगदान', mineEmpty: 'आपने अभी तक कोई योगदान नहीं भेजा।', stPending: 'मंज़ूरी का इंतज़ार', stApproved: 'मंज़ूर', stDeclined: 'अस्वीकृत', stCancelled: 'रद्द', cancelBtn: 'रद्द करें',
    toApprove: 'मंज़ूर करने हैं', nothingToApprove: 'अभी मंज़ूर करने को कुछ नहीं।', approveBtn: 'मंज़ूर करें', declineBtn: 'अस्वीकार करें', approveAll: 'सब मंज़ूर करें', approvedN: (n) => `${n} मंज़ूर किए गए।`,
    adminHint: 'सदस्य अपने योगदान यहाँ ख़ुद भेजते हैं। एक टैप में मंज़ूर करें और वे खातों में जुड़ जाते हैं।',
    sectSummary: 'सारांश', sectMembers: 'सदस्य', sectRecord: 'ख़ुद एक प्रविष्टि दर्ज करें', sectRecent: 'हाल की गतिविधि',
    recordHelp: 'उस सदस्य के लिए जिसने आपको सीधे नक़द दिया, या जिसका Kezzo खाता नहीं है।',
    kindHelp: {
      shares: 'बैठक में सदस्य द्वारा ख़रीदे हिस्से। राशि = हिस्सों की संख्या × एक हिस्से की क़ीमत।',
      social: 'सामाजिक कोष के लिए पैसा, जैसे आपात स्थिति के लिए।',
      fine: 'सदस्य द्वारा दिया जुर्माना, जैसे देर से आने पर।',
      loan: 'किसी सदस्य को पैसा उधार दें। ऋण इस चक्र की ब्याज दर से बढ़ता है।',
      loan_repay: 'सदस्य ऋण लौटा रहा है, आंशिक या पूरा।',
    },
    cycleHelp: {
      freq: 'समूह कितनी बार मिलता है और सदस्य योगदान देते हैं।', currency: 'आपके समूह की मुद्रा, जैसे KES, UGX या RWF।',
      price: 'एक हिस्से की क़ीमत। सदस्य हर बैठक में हिस्से ख़रीदते हैं।', interest: 'ऋण चुकाते समय जुड़ने वाला प्रतिशत। बिना ब्याज के लिए 0 रखें।',
      multiple: 'वैकल्पिक। सदस्य अपनी बचत के इतने गुना तक उधार ले सकता है। सीमा न हो तो ख़ाली छोड़ें।',
    },
    startHelp: 'चक्र बचत की एक अवधि है, अक्सर एक साल। अपने समूह के तय नियम भरें।',
    joinHelp: 'क्या आपके पास समूह का कोड है? जुड़ने के लिए डालें।', createHelp: 'नया बचत समूह शुरू करें। आप उसके कोषाध्यक्ष होंगे।', required: 'ज़रूरी',
  },
};
