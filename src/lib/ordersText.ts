import type { Lang } from './types';

/** Words for payment methods, the Pay button and orders, in the five Kezzo languages. */
export interface OrderWords {
  nav: string; title: string; sub: string; err: string; done: string; copy: string; copied: string;
  notice: string; pay: string; support: string; qty: string; total: string; supportAmt: string; currencyL: string; start: string; creating: string;
  payTo: string; useRef: string; accName: string; accNumber: string; iPaid: string; txnNote: string; later: string; noMethods: string; orderMade: string;
  tabBuy: string; tabSell: string; tabMethods: string; noOrders: string; ref: string; from: string; to: string;
  statuses: Record<string, string>;
  actions: { iPaid: string; confirm: string; notReceived: string; prepare: string; complete: string; cancel: string; cancelAsk: string; showPay: string; hidePay: string };
  methodsHelp: string; premiumNeeded: string; goPremium: string; addT: string; country: string; method: string; type: string; types: Record<string, string>; other: string;
  accNameL: string; accNumberL: string; instrL: string; add: string; on: string; off: string; isDefault: string; makeDefault: string; del: string; none: string; pickCountry: string;
  errors: Record<string, string>;
}

const EN: OrderWords = {
  nav: 'Orders & payments', title: 'Orders & payments', sub: 'Your purchases, your sales and the payment methods you show to buyers.', err: 'Something went wrong. Please try again.', done: 'Done.', copy: 'Copy', copied: 'Copied.',
  notice: 'Payment goes directly to the seller. Kezzo does not hold, guarantee or refund payments. Only pay sellers you trust.',
  pay: 'Pay', support: 'Support me', qty: 'Quantity', total: 'Total', supportAmt: 'Amount', currencyL: 'Currency', start: 'Continue', creating: 'One moment…',
  payTo: 'Pay the seller with', useRef: 'Include this reference in your payment', accName: 'Account name', accNumber: 'Number', iPaid: 'I’ve paid', txnNote: 'Transaction ID or note (optional)', later: 'Pay later', noMethods: 'This seller has no payment method to show.', orderMade: 'Order created.',
  tabBuy: 'My purchases', tabSell: 'My sales', tabMethods: 'Payment methods', noOrders: 'No orders yet.', ref: 'Reference', from: 'Seller', to: 'Buyer',
  statuses: { awaiting_payment: 'Awaiting payment', marked_paid: 'Marked paid by buyer', confirmed: 'Confirmed by seller', disputed: 'Payment disputed', preparing: 'Preparing', completed: 'Completed', cancelled: 'Cancelled' },
  actions: { iPaid: 'I’ve paid', confirm: 'Confirm payment', notReceived: 'Not received', prepare: 'Start preparing', complete: 'Mark completed', cancel: 'Cancel order', cancelAsk: 'Reason for cancelling', showPay: 'Show how to pay', hidePay: 'Hide' },
  methodsHelp: 'Buyers see these methods and pay you directly. Kezzo never checks a payment: you check your own account and confirm each order.', premiumNeeded: 'Showing payment methods is a Premium feature.', goPremium: 'See Premium',
  addT: 'Add a payment method', country: 'Country', method: 'Method', type: 'Type', types: { mobile_money: 'Mobile money', bank: 'Bank transfer', other: 'Other' }, other: 'Other / bank', accNameL: 'Account name (as on the account)', accNumberL: 'Number or account', instrL: 'Instructions (optional)', add: 'Add', on: 'Shown', off: 'Hidden', isDefault: 'Default', makeDefault: 'Make default', del: 'Delete', none: 'No payment method yet.', pickCountry: 'Choose a country',
  errors: { seller_not_ready: 'This seller cannot take payments right now.', out_of_stock: 'Not enough in stock.', no_price: 'This item has no price. Ask the seller.', own_item: 'This is your own item.', rate_limited: 'Too many orders today. Try again tomorrow.', bad_amount: 'Enter a valid amount.', bad_status: 'This order cannot change that way.', reason_required: 'Please give a reason.', premium_required: 'Premium is needed to add payment methods.', plan_limit_payment_methods: 'You reached the limit of payment methods for your plan.' },
};
const FR: OrderWords = {
  nav: 'Commandes et paiements', title: 'Commandes et paiements', sub: 'Vos achats, vos ventes et les moyens de paiement montrés aux acheteurs.', err: 'Une erreur est survenue. Réessayez.', done: 'Fait.', copy: 'Copier', copied: 'Copié.',
  notice: 'Le paiement va directement au vendeur. Kezzo ne détient, ne garantit et ne rembourse pas les paiements. Ne payez que des vendeurs de confiance.',
  pay: 'Payer', support: 'Soutenez-moi', qty: 'Quantité', total: 'Total', supportAmt: 'Montant', currencyL: 'Devise', start: 'Continuer', creating: 'Un instant…',
  payTo: 'Payez le vendeur avec', useRef: 'Indiquez cette référence dans votre paiement', accName: 'Nom du compte', accNumber: 'Numéro', iPaid: 'J’ai payé', txnNote: 'ID de transaction ou note (facultatif)', later: 'Payer plus tard', noMethods: 'Ce vendeur n’a aucun moyen de paiement à montrer.', orderMade: 'Commande créée.',
  tabBuy: 'Mes achats', tabSell: 'Mes ventes', tabMethods: 'Moyens de paiement', noOrders: 'Aucune commande.', ref: 'Référence', from: 'Vendeur', to: 'Acheteur',
  statuses: { awaiting_payment: 'En attente de paiement', marked_paid: 'Marqué payé par l’acheteur', confirmed: 'Confirmé par le vendeur', disputed: 'Paiement contesté', preparing: 'En préparation', completed: 'Terminé', cancelled: 'Annulé' },
  actions: { iPaid: 'J’ai payé', confirm: 'Confirmer le paiement', notReceived: 'Non reçu', prepare: 'Commencer la préparation', complete: 'Marquer terminé', cancel: 'Annuler la commande', cancelAsk: 'Motif de l’annulation', showPay: 'Voir comment payer', hidePay: 'Masquer' },
  methodsHelp: 'Les acheteurs voient ces moyens et vous paient directement. Kezzo ne vérifie jamais un paiement : vous vérifiez votre propre compte et confirmez chaque commande.', premiumNeeded: 'Afficher des moyens de paiement est une fonction Premium.', goPremium: 'Voir Premium',
  addT: 'Ajouter un moyen de paiement', country: 'Pays', method: 'Méthode', type: 'Type', types: { mobile_money: 'Mobile money', bank: 'Virement bancaire', other: 'Autre' }, other: 'Autre / banque', accNameL: 'Nom du compte (comme sur le compte)', accNumberL: 'Numéro ou compte', instrL: 'Instructions (facultatif)', add: 'Ajouter', on: 'Affiché', off: 'Masqué', isDefault: 'Par défaut', makeDefault: 'Définir par défaut', del: 'Supprimer', none: 'Aucun moyen de paiement.', pickCountry: 'Choisir un pays',
  errors: { seller_not_ready: 'Ce vendeur ne peut pas recevoir de paiement pour l’instant.', out_of_stock: 'Stock insuffisant.', no_price: 'Cet article n’a pas de prix. Demandez au vendeur.', own_item: 'C’est votre propre article.', rate_limited: 'Trop de commandes aujourd’hui. Réessayez demain.', bad_amount: 'Entrez un montant valide.', bad_status: 'Cette commande ne peut pas changer ainsi.', reason_required: 'Indiquez un motif.', premium_required: 'Premium est nécessaire pour ajouter des moyens de paiement.', plan_limit_payment_methods: 'Vous avez atteint la limite de moyens de paiement de votre plan.' },
};
const ES: OrderWords = {
  nav: 'Pedidos y pagos', title: 'Pedidos y pagos', sub: 'Tus compras, tus ventas y los métodos de pago que muestras a los compradores.', err: 'Algo salió mal. Inténtalo de nuevo.', done: 'Listo.', copy: 'Copiar', copied: 'Copiado.',
  notice: 'El pago va directamente al vendedor. Kezzo no retiene, garantiza ni reembolsa pagos. Paga solo a vendedores de confianza.',
  pay: 'Pagar', support: 'Apóyame', qty: 'Cantidad', total: 'Total', supportAmt: 'Importe', currencyL: 'Moneda', start: 'Continuar', creating: 'Un momento…',
  payTo: 'Paga al vendedor con', useRef: 'Incluye esta referencia en tu pago', accName: 'Nombre de la cuenta', accNumber: 'Número', iPaid: 'Ya pagué', txnNote: 'ID de transacción o nota (opcional)', later: 'Pagar después', noMethods: 'Este vendedor no tiene métodos de pago para mostrar.', orderMade: 'Pedido creado.',
  tabBuy: 'Mis compras', tabSell: 'Mis ventas', tabMethods: 'Métodos de pago', noOrders: 'Aún no hay pedidos.', ref: 'Referencia', from: 'Vendedor', to: 'Comprador',
  statuses: { awaiting_payment: 'Esperando pago', marked_paid: 'Marcado pagado por el comprador', confirmed: 'Confirmado por el vendedor', disputed: 'Pago en disputa', preparing: 'En preparación', completed: 'Completado', cancelled: 'Cancelado' },
  actions: { iPaid: 'Ya pagué', confirm: 'Confirmar pago', notReceived: 'No recibido', prepare: 'Empezar a preparar', complete: 'Marcar completado', cancel: 'Cancelar pedido', cancelAsk: 'Motivo de la cancelación', showPay: 'Ver cómo pagar', hidePay: 'Ocultar' },
  methodsHelp: 'Los compradores ven estos métodos y te pagan directamente. Kezzo nunca verifica un pago: tú revisas tu cuenta y confirmas cada pedido.', premiumNeeded: 'Mostrar métodos de pago es una función Premium.', goPremium: 'Ver Premium',
  addT: 'Añadir un método de pago', country: 'País', method: 'Método', type: 'Tipo', types: { mobile_money: 'Dinero móvil', bank: 'Transferencia bancaria', other: 'Otro' }, other: 'Otro / banco', accNameL: 'Nombre de la cuenta (como en la cuenta)', accNumberL: 'Número o cuenta', instrL: 'Instrucciones (opcional)', add: 'Añadir', on: 'Visible', off: 'Oculto', isDefault: 'Predeterminado', makeDefault: 'Hacer predeterminado', del: 'Eliminar', none: 'Aún no hay métodos de pago.', pickCountry: 'Elige un país',
  errors: { seller_not_ready: 'Este vendedor no puede recibir pagos ahora.', out_of_stock: 'No hay suficiente stock.', no_price: 'Este artículo no tiene precio. Pregunta al vendedor.', own_item: 'Es tu propio artículo.', rate_limited: 'Demasiados pedidos hoy. Inténtalo mañana.', bad_amount: 'Introduce un importe válido.', bad_status: 'Este pedido no puede cambiar así.', reason_required: 'Indica un motivo.', premium_required: 'Se necesita Premium para añadir métodos de pago.', plan_limit_payment_methods: 'Llegaste al límite de métodos de pago de tu plan.' },
};
const PT: OrderWords = {
  nav: 'Pedidos e pagamentos', title: 'Pedidos e pagamentos', sub: 'Suas compras, suas vendas e as formas de pagamento mostradas aos compradores.', err: 'Algo deu errado. Tente de novo.', done: 'Pronto.', copy: 'Copiar', copied: 'Copiado.',
  notice: 'O pagamento vai direto ao vendedor. A Kezzo não retém, garante nem reembolsa pagamentos. Pague apenas vendedores de confiança.',
  pay: 'Pagar', support: 'Apoie-me', qty: 'Quantidade', total: 'Total', supportAmt: 'Valor', currencyL: 'Moeda', start: 'Continuar', creating: 'Um momento…',
  payTo: 'Pague ao vendedor com', useRef: 'Inclua esta referência no pagamento', accName: 'Nome da conta', accNumber: 'Número', iPaid: 'Já paguei', txnNote: 'ID da transação ou nota (opcional)', later: 'Pagar depois', noMethods: 'Este vendedor não tem forma de pagamento para mostrar.', orderMade: 'Pedido criado.',
  tabBuy: 'Minhas compras', tabSell: 'Minhas vendas', tabMethods: 'Formas de pagamento', noOrders: 'Ainda não há pedidos.', ref: 'Referência', from: 'Vendedor', to: 'Comprador',
  statuses: { awaiting_payment: 'Aguardando pagamento', marked_paid: 'Marcado pago pelo comprador', confirmed: 'Confirmado pelo vendedor', disputed: 'Pagamento contestado', preparing: 'Em preparação', completed: 'Concluído', cancelled: 'Cancelado' },
  actions: { iPaid: 'Já paguei', confirm: 'Confirmar pagamento', notReceived: 'Não recebido', prepare: 'Começar a preparar', complete: 'Marcar concluído', cancel: 'Cancelar pedido', cancelAsk: 'Motivo do cancelamento', showPay: 'Ver como pagar', hidePay: 'Ocultar' },
  methodsHelp: 'Os compradores veem estas formas e pagam direto a você. A Kezzo nunca verifica um pagamento: você confere sua conta e confirma cada pedido.', premiumNeeded: 'Mostrar formas de pagamento é um recurso Premium.', goPremium: 'Ver Premium',
  addT: 'Adicionar forma de pagamento', country: 'País', method: 'Método', type: 'Tipo', types: { mobile_money: 'Dinheiro móvel', bank: 'Transferência bancária', other: 'Outro' }, other: 'Outro / banco', accNameL: 'Nome da conta (como na conta)', accNumberL: 'Número ou conta', instrL: 'Instruções (opcional)', add: 'Adicionar', on: 'Visível', off: 'Oculto', isDefault: 'Padrão', makeDefault: 'Tornar padrão', del: 'Excluir', none: 'Ainda não há forma de pagamento.', pickCountry: 'Escolha um país',
  errors: { seller_not_ready: 'Este vendedor não pode receber pagamentos agora.', out_of_stock: 'Estoque insuficiente.', no_price: 'Este item não tem preço. Pergunte ao vendedor.', own_item: 'Este é o seu próprio item.', rate_limited: 'Pedidos demais hoje. Tente amanhã.', bad_amount: 'Informe um valor válido.', bad_status: 'Este pedido não pode mudar assim.', reason_required: 'Informe um motivo.', premium_required: 'É preciso Premium para adicionar formas de pagamento.', plan_limit_payment_methods: 'Você atingiu o limite de formas de pagamento do seu plano.' },
};
const HI: OrderWords = {
  nav: 'ऑर्डर और भुगतान', title: 'ऑर्डर और भुगतान', sub: 'आपकी खरीद, आपकी बिक्री और खरीदारों को दिखाए जाने वाले भुगतान तरीके।', err: 'कुछ गलत हो गया। फिर कोशिश करें।', done: 'हो गया।', copy: 'कॉपी', copied: 'कॉपी हो गया।',
  notice: 'भुगतान सीधे विक्रेता को जाता है। Kezzo भुगतान न रखता है, न गारंटी देता है, न वापस करता है। केवल भरोसेमंद विक्रेताओं को भुगतान करें।',
  pay: 'भुगतान करें', support: 'मुझे सपोर्ट करें', qty: 'मात्रा', total: 'कुल', supportAmt: 'राशि', currencyL: 'मुद्रा', start: 'आगे बढ़ें', creating: 'एक पल…',
  payTo: 'विक्रेता को इससे भुगतान करें', useRef: 'अपने भुगतान में यह संदर्भ लिखें', accName: 'खाते का नाम', accNumber: 'नंबर', iPaid: 'मैंने भुगतान किया', txnNote: 'लेनदेन ID या नोट (वैकल्पिक)', later: 'बाद में', noMethods: 'इस विक्रेता का कोई भुगतान तरीका दिखाने के लिए नहीं है।', orderMade: 'ऑर्डर बन गया।',
  tabBuy: 'मेरी खरीद', tabSell: 'मेरी बिक्री', tabMethods: 'भुगतान तरीके', noOrders: 'अभी कोई ऑर्डर नहीं।', ref: 'संदर्भ', from: 'विक्रेता', to: 'खरीदार',
  statuses: { awaiting_payment: 'भुगतान की प्रतीक्षा', marked_paid: 'खरीदार ने भुगतान चिह्नित किया', confirmed: 'विक्रेता ने पुष्टि की', disputed: 'भुगतान विवादित', preparing: 'तैयारी जारी', completed: 'पूरा', cancelled: 'रद्द' },
  actions: { iPaid: 'मैंने भुगतान किया', confirm: 'भुगतान की पुष्टि करें', notReceived: 'नहीं मिला', prepare: 'तैयारी शुरू करें', complete: 'पूरा चिह्नित करें', cancel: 'ऑर्डर रद्द करें', cancelAsk: 'रद्द करने का कारण', showPay: 'भुगतान कैसे करें देखें', hidePay: 'छिपाएँ' },
  methodsHelp: 'खरीदार ये तरीके देखकर सीधे आपको भुगतान करते हैं। Kezzo कभी भुगतान की जाँच नहीं करता: आप अपना खाता जाँचकर हर ऑर्डर की पुष्टि करते हैं।', premiumNeeded: 'भुगतान तरीके दिखाना प्रीमियम सुविधा है।', goPremium: 'प्रीमियम देखें',
  addT: 'भुगतान तरीका जोड़ें', country: 'देश', method: 'तरीका', type: 'प्रकार', types: { mobile_money: 'मोबाइल मनी', bank: 'बैंक ट्रांसफ़र', other: 'अन्य' }, other: 'अन्य / बैंक', accNameL: 'खाते का नाम (खाते के अनुसार)', accNumberL: 'नंबर या खाता', instrL: 'निर्देश (वैकल्पिक)', add: 'जोड़ें', on: 'दिख रहा', off: 'छिपा', isDefault: 'डिफ़ॉल्ट', makeDefault: 'डिफ़ॉल्ट बनाएँ', del: 'हटाएँ', none: 'अभी कोई भुगतान तरीका नहीं।', pickCountry: 'देश चुनें',
  errors: { seller_not_ready: 'यह विक्रेता अभी भुगतान नहीं ले सकता।', out_of_stock: 'स्टॉक कम है।', no_price: 'इस वस्तु की कीमत नहीं है। विक्रेता से पूछें।', own_item: 'यह आपकी अपनी वस्तु है।', rate_limited: 'आज बहुत ऑर्डर हो गए। कल कोशिश करें।', bad_amount: 'सही राशि लिखें।', bad_status: 'यह ऑर्डर इस तरह नहीं बदल सकता।', reason_required: 'कारण लिखें।', premium_required: 'भुगतान तरीके जोड़ने के लिए प्रीमियम चाहिए।', plan_limit_payment_methods: 'आप अपने प्लान की भुगतान तरीकों की सीमा तक पहुँच गए।' },
};
export const ORDERS: Record<Lang, OrderWords> = { en: EN, fr: FR, es: ES, pt: PT, hi: HI };

/** Turns a database error from the order or payment functions into a friendly sentence. */
export function orderError(lang: Lang, message: string): string {
  const w = ORDERS[lang];
  const k = Object.keys(w.errors).find((e) => message.includes(e));
  return k ? w.errors[k] : w.err;
}

/** Extra report reasons for scams, and the one warning shown in chat. */
export const TRUST_WORDS: Record<Lang, { scam: string; fake_product: string; no_delivery: string; chatWarn: string; soon: string }> = {
  en: { scam: 'Scam', fake_product: 'Fake product', no_delivery: 'No delivery', chatWarn: 'This person has shared a phone number or payment details and is not a Premium seller. Be careful paying unverified sellers.', soon: 'Premium ends soon' },
  fr: { scam: 'Arnaque', fake_product: 'Faux produit', no_delivery: 'Pas de livraison', chatWarn: 'Cette personne a partagé un numéro ou des détails de paiement et n’est pas un vendeur Premium. Soyez prudent avant de payer un vendeur non vérifié.', soon: 'Premium se termine bientôt' },
  es: { scam: 'Estafa', fake_product: 'Producto falso', no_delivery: 'Sin entrega', chatWarn: 'Esta persona compartió un número o datos de pago y no es vendedor Premium. Ten cuidado al pagar a vendedores no verificados.', soon: 'Premium termina pronto' },
  pt: { scam: 'Golpe', fake_product: 'Produto falso', no_delivery: 'Sem entrega', chatWarn: 'Esta pessoa compartilhou um número ou dados de pagamento e não é vendedor Premium. Tenha cuidado ao pagar vendedores não verificados.', soon: 'O Premium termina em breve' },
  hi: { scam: 'धोखाधड़ी', fake_product: 'नकली उत्पाद', no_delivery: 'डिलीवरी नहीं', chatWarn: 'इस व्यक्ति ने फ़ोन नंबर या भुगतान विवरण साझा किया है और यह प्रीमियम विक्रेता नहीं है। अनजान विक्रेताओं को भुगतान करते समय सावधान रहें।', soon: 'प्रीमियम जल्द खत्म होगा' },
};
