import type { Lang } from './types';

export const MARKET_KINDS = ['product', 'service'] as const;
export type MarketKind = (typeof MARKET_KINDS)[number];
export const MARKET_CATS = ['fashion', 'electronics', 'home', 'food', 'beauty', 'art', 'music', 'education', 'events', 'repairs', 'transport', 'digital', 'other'] as const;
export type MarketCat = (typeof MARKET_CATS)[number];
export type MarketStatus = 'active' | 'sold' | 'paused';

export interface Listing {
  id: string; seller_id: string; kind: MarketKind; category: MarketCat; title: string; body: string; price: number | null; currency: string;
  condition: 'new' | 'used' | null; country: string; city: string; online: boolean; contact: string | null; photos: string[];
  status: MarketStatus; hidden: boolean; created_at: string;
  seller?: { id: string; display_name: string; avatar_url: string | null; handle: string } | Array<{ id: string; display_name: string; avatar_url: string | null; handle: string }> | null;
}

export function formatPrice(price: number | null, currency: string, lang: Lang, free: string, ask: string): string {
  if (price === null) return ask;
  if (price === 0) return free;
  const code = currency.trim();
  if (/^[A-Z]{3}$/.test(code)) {
    try { return new Intl.NumberFormat(lang, { style: 'currency', currency: code, maximumFractionDigits: price % 1 === 0 ? 0 : 2 }).format(price); } catch { /* not a real code: shown as typed */ }
  }
  return `${price.toLocaleString(lang)} ${code}`.trim();
}

export interface MarketWords {
  title: string; sub: string; sell: string; all: string; products: string; services: string; mine: string; search: string; anyCategory: string;
  empty: string; emptyMine: string; more: string; safety: string; byLabel: string; online: string; free: string; ask: string; sold: string; paused: string;
  cats: Record<MarketCat, string>; kinds: Record<MarketKind, string>; conds: { new: string; used: string };
  formNew: string; formEdit: string; fKind: string; fCat: string; fTitle: string; fBody: string; fPrice: string; fPriceHelp: string; fCurrency: string; fCond: string;
  fCountry: string; fCity: string; fOnline: string; fContact: string; fPhotos: string; fPhotosHelp: string; addPhoto: string; removePhoto: string;
  publish: string; save: string; cancel: string; posted: string; saved: string; message: string; signIn: string; edit: string; del: string; delAsk: string;
  markSold: string; markActive: string; pause: string; readMore: string; showLess: string; contact: string; hide: string; unhide: string; hiddenTitle: string;
  errPlace: string; errRate: string; errSafe: string; errGeneric: string; errPhoto: string; location: string; uploading: string;
}

export const MARKET: Record<Lang, MarketWords> = {
  en: {
    title: 'Market', sub: 'Buy and sell products and services with other members.', sell: 'Sell something', all: 'All', products: 'Products', services: 'Services', mine: 'My listings', search: 'Search the market',
    anyCategory: 'All categories', empty: 'Nothing for sale here yet. Be the first to list something!', emptyMine: 'You have no listings yet.', more: 'Show more',
    safety: 'Kezzo doesn’t handle payments yet. Meet, check your item and enjoy your purchase.',
    byLabel: 'By', online: 'Online / delivery', free: 'Free', ask: 'Ask for the price', sold: 'Sold', paused: 'Paused',
    cats: { fashion: 'Fashion', electronics: 'Electronics', home: 'Home & garden', food: 'Food & drinks', beauty: 'Beauty & care', art: 'Art & crafts', music: 'Music & media', education: 'Lessons & coaching', events: 'Events & entertainment', repairs: 'Repairs & trades', transport: 'Transport & delivery', digital: 'Digital services', other: 'Other' },
    kinds: { product: 'Product', service: 'Service' }, conds: { new: 'New', used: 'Used' },
    formNew: 'Sell something', formEdit: 'Edit your listing', fKind: 'What are you offering?', fCat: 'Category', fTitle: 'Title', fBody: 'Description', fPrice: 'Price', fPriceHelp: 'Type the currency you sell in (for example USD, CAD, FCFA, €). Leave the price empty to let buyers ask for it, or enter 0 if it is free.', fCurrency: 'Currency (optional)', fCond: 'Condition',
    fCountry: 'Country', fCity: 'City', fOnline: 'Available online or by delivery', fContact: 'Other contact (optional)', fPhotos: 'Photos (up to 5)', fPhotosHelp: 'Clear photos sell faster.', addPhoto: 'Add photo', removePhoto: 'Remove photo',
    publish: 'Publish', save: 'Save', cancel: 'Cancel', posted: 'Your listing is live.', saved: 'Saved', message: 'Message seller', signIn: 'Sign in to message the seller', edit: 'Edit', del: 'Delete', delAsk: 'Delete this listing?',
    markSold: 'Mark as sold', markActive: 'Mark as available', pause: 'Pause', readMore: 'Read more', showLess: 'Show less', contact: 'Contact', hide: 'Hide', unhide: 'Show again', hiddenTitle: 'Hidden listings',
    errPlace: 'Enter a country, or tick “Available online or by delivery”.', errRate: 'You have posted a lot today. Please try again tomorrow.', errSafe: 'Please remove words that are not allowed.', errGeneric: 'Something went wrong. Try again.', errPhoto: 'A photo could not be added. Try another one.', location: 'Location', uploading: 'Uploading…',
  },
  fr: {
    title: 'Marché', sub: 'Achetez et vendez des produits et des services entre membres.', sell: 'Vendre', all: 'Tout', products: 'Produits', services: 'Services', mine: 'Mes annonces', search: 'Rechercher dans le marché',
    anyCategory: 'Toutes les catégories', empty: 'Rien à vendre pour l’instant. Soyez le premier à publier !', emptyMine: 'Vous n’avez pas encore d’annonce.', more: 'Voir plus',
    safety: 'Kezzo ne gère pas encore les paiements. Rencontrez-vous, vérifiez votre article et profitez de votre achat.',
    byLabel: 'Par', online: 'En ligne / livraison', free: 'Gratuit', ask: 'Prix sur demande', sold: 'Vendu', paused: 'En pause',
    cats: { fashion: 'Mode', electronics: 'Électronique', home: 'Maison et jardin', food: 'Aliments et boissons', beauty: 'Beauté et soins', art: 'Art et artisanat', music: 'Musique et médias', education: 'Cours et coaching', events: 'Événements et divertissement', repairs: 'Réparations et métiers', transport: 'Transport et livraison', digital: 'Services numériques', other: 'Autre' },
    kinds: { product: 'Produit', service: 'Service' }, conds: { new: 'Neuf', used: 'Usagé' },
    formNew: 'Vendre', formEdit: 'Modifier l’annonce', fKind: 'Que proposez-vous ?', fCat: 'Catégorie', fTitle: 'Titre', fBody: 'Description', fPrice: 'Prix', fPriceHelp: 'Indiquez la devise de vente (par ex. USD, CAD, FCFA, €). Laissez le prix vide pour qu’on vous le demande, ou entrez 0 si c’est gratuit.', fCurrency: 'Devise (facultatif)', fCond: 'État',
    fCountry: 'Pays', fCity: 'Ville', fOnline: 'Disponible en ligne ou par livraison', fContact: 'Autre contact (facultatif)', fPhotos: 'Photos (jusqu’à 5)', fPhotosHelp: 'De belles photos vendent plus vite.', addPhoto: 'Ajouter une photo', removePhoto: 'Retirer la photo',
    publish: 'Publier', save: 'Enregistrer', cancel: 'Annuler', posted: 'Votre annonce est publiée.', saved: 'Enregistré', message: 'Écrire au vendeur', signIn: 'Connectez-vous pour écrire au vendeur', edit: 'Modifier', del: 'Supprimer', delAsk: 'Supprimer cette annonce ?',
    markSold: 'Marquer comme vendu', markActive: 'Marquer comme disponible', pause: 'Mettre en pause', readMore: 'Lire la suite', showLess: 'Réduire', contact: 'Contact', hide: 'Masquer', unhide: 'Afficher de nouveau', hiddenTitle: 'Annonces masquées',
    errPlace: 'Indiquez un pays ou cochez « Disponible en ligne ou par livraison ».', errRate: 'Vous avez beaucoup publié aujourd’hui. Réessayez demain.', errSafe: 'Retirez les mots non permis.', errGeneric: 'Une erreur est survenue. Réessayez.', errPhoto: 'Une photo n’a pas pu être ajoutée. Essayez-en une autre.', location: 'Lieu', uploading: 'Envoi…',
  },
  es: {
    title: 'Mercado', sub: 'Compra y vende productos y servicios con otros miembros.', sell: 'Vender', all: 'Todo', products: 'Productos', services: 'Servicios', mine: 'Mis anuncios', search: 'Buscar en el mercado',
    anyCategory: 'Todas las categorías', empty: 'Aún no hay nada en venta. ¡Sé el primero en publicar!', emptyMine: 'Aún no tienes anuncios.', more: 'Ver más',
    safety: 'Kezzo aún no gestiona pagos. Queda con el vendedor, revisa el artículo y disfruta tu compra.',
    byLabel: 'Por', online: 'En línea / envío', free: 'Gratis', ask: 'Consultar precio', sold: 'Vendido', paused: 'En pausa',
    cats: { fashion: 'Moda', electronics: 'Electrónica', home: 'Hogar y jardín', food: 'Comida y bebida', beauty: 'Belleza y cuidado', art: 'Arte y artesanía', music: 'Música y medios', education: 'Clases y coaching', events: 'Eventos y entretenimiento', repairs: 'Reparaciones y oficios', transport: 'Transporte y envíos', digital: 'Servicios digitales', other: 'Otro' },
    kinds: { product: 'Producto', service: 'Servicio' }, conds: { new: 'Nuevo', used: 'Usado' },
    formNew: 'Vender', formEdit: 'Editar tu anuncio', fKind: '¿Qué ofreces?', fCat: 'Categoría', fTitle: 'Título', fBody: 'Descripción', fPrice: 'Precio', fPriceHelp: 'Escribe la moneda en que vendes (p. ej. USD, EUR, FCFA, €). Deja el precio vacío para que lo pregunten, o escribe 0 si es gratis.', fCurrency: 'Moneda (opcional)', fCond: 'Estado',
    fCountry: 'País', fCity: 'Ciudad', fOnline: 'Disponible en línea o con envío', fContact: 'Otro contacto (opcional)', fPhotos: 'Fotos (hasta 5)', fPhotosHelp: 'Las fotos claras venden más rápido.', addPhoto: 'Añadir foto', removePhoto: 'Quitar foto',
    publish: 'Publicar', save: 'Guardar', cancel: 'Cancelar', posted: 'Tu anuncio ya está publicado.', saved: 'Guardado', message: 'Escribir al vendedor', signIn: 'Inicia sesión para escribir al vendedor', edit: 'Editar', del: 'Eliminar', delAsk: '¿Eliminar este anuncio?',
    markSold: 'Marcar como vendido', markActive: 'Marcar como disponible', pause: 'Pausar', readMore: 'Leer más', showLess: 'Ver menos', contact: 'Contacto', hide: 'Ocultar', unhide: 'Mostrar de nuevo', hiddenTitle: 'Anuncios ocultos',
    errPlace: 'Escribe un país o marca «Disponible en línea o con envío».', errRate: 'Has publicado mucho hoy. Inténtalo mañana.', errSafe: 'Quita las palabras no permitidas.', errGeneric: 'Algo salió mal. Inténtalo de nuevo.', errPhoto: 'No se pudo añadir una foto. Prueba con otra.', location: 'Lugar', uploading: 'Subiendo…',
  },
  pt: {
    title: 'Mercado', sub: 'Compre e venda produtos e serviços com outros membros.', sell: 'Vender', all: 'Tudo', products: 'Produtos', services: 'Serviços', mine: 'Meus anúncios', search: 'Pesquisar no mercado',
    anyCategory: 'Todas as categorias', empty: 'Ainda não há nada à venda. Seja o primeiro a anunciar!', emptyMine: 'Você ainda não tem anúncios.', more: 'Ver mais',
    safety: 'O Kezzo ainda não processa pagamentos. Encontrem-se, confira o item e aproveite a compra.',
    byLabel: 'Por', online: 'Online / entrega', free: 'Grátis', ask: 'Preço sob consulta', sold: 'Vendido', paused: 'Pausado',
    cats: { fashion: 'Moda', electronics: 'Eletrônicos', home: 'Casa e jardim', food: 'Comida e bebida', beauty: 'Beleza e cuidados', art: 'Arte e artesanato', music: 'Música e mídia', education: 'Aulas e coaching', events: 'Eventos e entretenimento', repairs: 'Reparos e ofícios', transport: 'Transporte e entrega', digital: 'Serviços digitais', other: 'Outro' },
    kinds: { product: 'Produto', service: 'Serviço' }, conds: { new: 'Novo', used: 'Usado' },
    formNew: 'Vender', formEdit: 'Editar seu anúncio', fKind: 'O que você oferece?', fCat: 'Categoria', fTitle: 'Título', fBody: 'Descrição', fPrice: 'Preço', fPriceHelp: 'Digite a moeda em que você vende (ex.: USD, BRL, FCFA, R$). Deixe o preço vazio para perguntarem, ou digite 0 se for grátis.', fCurrency: 'Moeda (opcional)', fCond: 'Estado',
    fCountry: 'País', fCity: 'Cidade', fOnline: 'Disponível online ou com entrega', fContact: 'Outro contato (opcional)', fPhotos: 'Fotos (até 5)', fPhotosHelp: 'Fotos nítidas vendem mais rápido.', addPhoto: 'Adicionar foto', removePhoto: 'Remover foto',
    publish: 'Publicar', save: 'Salvar', cancel: 'Cancelar', posted: 'Seu anúncio está no ar.', saved: 'Salvo', message: 'Escrever ao vendedor', signIn: 'Entre para escrever ao vendedor', edit: 'Editar', del: 'Excluir', delAsk: 'Excluir este anúncio?',
    markSold: 'Marcar como vendido', markActive: 'Marcar como disponível', pause: 'Pausar', readMore: 'Ler mais', showLess: 'Ver menos', contact: 'Contato', hide: 'Ocultar', unhide: 'Mostrar de novo', hiddenTitle: 'Anúncios ocultos',
    errPlace: 'Informe um país ou marque “Disponível online ou com entrega”.', errRate: 'Você publicou muito hoje. Tente amanhã.', errSafe: 'Remova as palavras não permitidas.', errGeneric: 'Algo deu errado. Tente de novo.', errPhoto: 'Não foi possível adicionar uma foto. Tente outra.', location: 'Local', uploading: 'Enviando…',
  },
  hi: {
    title: 'बाज़ार', sub: 'दूसरे सदस्यों के साथ उत्पाद और सेवाएँ खरीदें और बेचें।', sell: 'कुछ बेचें', all: 'सभी', products: 'उत्पाद', services: 'सेवाएँ', mine: 'मेरे विज्ञापन', search: 'बाज़ार में खोजें',
    anyCategory: 'सभी श्रेणियाँ', empty: 'अभी यहाँ कुछ बिक्री के लिए नहीं है। पहले आप सूचीबद्ध करें!', emptyMine: 'आपका अभी कोई विज्ञापन नहीं है।', more: 'और दिखाएँ',
    safety: 'Kezzo अभी भुगतान नहीं संभालता। मिलें, अपना सामान जाँचें और खरीद का आनंद लें।',
    byLabel: 'द्वारा', online: 'ऑनलाइन / डिलीवरी', free: 'मुफ़्त', ask: 'कीमत पूछें', sold: 'बिक गया', paused: 'रुका हुआ',
    cats: { fashion: 'फ़ैशन', electronics: 'इलेक्ट्रॉनिक्स', home: 'घर और बगीचा', food: 'खाना और पेय', beauty: 'सौंदर्य और देखभाल', art: 'कला और शिल्प', music: 'संगीत और मीडिया', education: 'कक्षाएँ और कोचिंग', events: 'कार्यक्रम और मनोरंजन', repairs: 'मरम्मत और कारीगरी', transport: 'परिवहन और डिलीवरी', digital: 'डिजिटल सेवाएँ', other: 'अन्य' },
    kinds: { product: 'उत्पाद', service: 'सेवा' }, conds: { new: 'नया', used: 'इस्तेमाल किया' },
    formNew: 'कुछ बेचें', formEdit: 'अपना विज्ञापन बदलें', fKind: 'आप क्या पेश कर रहे हैं?', fCat: 'श्रेणी', fTitle: 'शीर्षक', fBody: 'विवरण', fPrice: 'कीमत', fPriceHelp: 'जिस मुद्रा में बेच रहे हैं वह लिखें (जैसे USD, INR, ₹)। कीमत खाली छोड़ें तो खरीदार पूछेंगे; मुफ़्त हो तो 0 लिखें।', fCurrency: 'मुद्रा (वैकल्पिक)', fCond: 'स्थिति',
    fCountry: 'देश', fCity: 'शहर', fOnline: 'ऑनलाइन या डिलीवरी से उपलब्ध', fContact: 'अन्य संपर्क (वैकल्पिक)', fPhotos: 'फ़ोटो (5 तक)', fPhotosHelp: 'साफ़ फ़ोटो जल्दी बिकती हैं।', addPhoto: 'फ़ोटो जोड़ें', removePhoto: 'फ़ोटो हटाएँ',
    publish: 'प्रकाशित करें', save: 'सहेजें', cancel: 'रद्द करें', posted: 'आपका विज्ञापन प्रकाशित हो गया।', saved: 'सहेजा गया', message: 'विक्रेता को संदेश', signIn: 'विक्रेता को संदेश भेजने के लिए साइन इन करें', edit: 'बदलें', del: 'हटाएँ', delAsk: 'यह विज्ञापन हटाएँ?',
    markSold: 'बिका हुआ चिह्नित करें', markActive: 'उपलब्ध चिह्नित करें', pause: 'रोकें', readMore: 'और पढ़ें', showLess: 'कम दिखाएँ', contact: 'संपर्क', hide: 'छिपाएँ', unhide: 'फिर दिखाएँ', hiddenTitle: 'छिपे विज्ञापन',
    errPlace: 'देश लिखें या “ऑनलाइन या डिलीवरी से उपलब्ध” चुनें।', errRate: 'आपने आज बहुत पोस्ट किया है। कल फिर कोशिश करें।', errSafe: 'अनुमति-रहित शब्द हटाएँ।', errGeneric: 'कुछ गड़बड़ हुई। फिर कोशिश करें।', errPhoto: 'एक फ़ोटो नहीं जुड़ सकी। दूसरी आज़माएँ।', location: 'स्थान', uploading: 'भेजा जा रहा है…',
  },
};
