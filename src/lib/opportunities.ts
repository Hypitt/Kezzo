import type { Lang } from './types';
import type { PublicProfile } from './types';

export const OPP_KINDS = ['scholarship', 'job', 'training', 'event', 'other'] as const;
export type OppKind = (typeof OPP_KINDS)[number];

export interface Opportunity {
  id: string; author_id: string; kind: OppKind; title: string; org: string; body: string; country: string; city: string;
  online: boolean; deadline: string | null; link: string | null; contact: string | null; hidden: boolean; created_at: string;
  author?: PublicProfile | PublicProfile[] | null;
}

const PLACE_KEY = 'kezzo_place';
export interface Place { country: string; city: string }
export const readPlace = (): Place => {
  try { const p = JSON.parse(localStorage.getItem(PLACE_KEY) ?? '{}') as Partial<Place>; return { country: String(p.country ?? ''), city: String(p.city ?? '') }; } catch { return { country: '', city: '' }; }
};
export const savePlace = (p: Place): void => { try { localStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } };

export interface OppWords {
  title: string; sub: string; share: string; kinds: Record<'all' | OppKind, string>;
  near: string; onlineOnly: string; everywhere: string; yourPlace: string; country: string; city: string; savePlace: string; placeHint: string;
  search: string; deadline: string; soon: string; apply: string; contact: string; online: string; empty: string; more: string; warn: string;
  formTitle: string; fKind: string; fTitle: string; fOrg: string; fBody: string; fCountry: string; fCity: string; fOnline: string; fDeadline: string; fLink: string; fContact: string;
  publish: string; save: string; cancel: string; edit: string; del: string; delAsk: string; hide: string; unhide: string; hiddenTitle: string;
  posted: string; saved: string; errRate: string; errGeneric: string; errPlace: string; errSafe: string; errLink: string; by: string; closed: string;
}

export const OPP: Record<Lang, OppWords> = {
  en: {
    title: 'Opportunities', sub: 'Scholarships, jobs, training and events shared by the community.', share: 'Share an opportunity',
    kinds: { all: 'All', scholarship: 'Scholarships', job: 'Jobs', training: 'Training', event: 'Events', other: 'Other' },
    near: 'Near me', onlineOnly: 'Online', everywhere: 'Everywhere', yourPlace: 'Your place', country: 'Country', city: 'City', savePlace: 'Save', placeHint: 'Add your country and city to see opportunities near you first.',
    search: 'Search opportunities', deadline: 'Deadline', soon: 'Closing soon', apply: 'Apply or learn more', contact: 'Contact', online: 'Online / anywhere', empty: 'No opportunities here yet. Be the first to share one!', more: 'Show more',
    warn: 'Never pay to apply.',
    formTitle: 'Share an opportunity', fKind: 'Type', fTitle: 'Title', fOrg: 'Organization (optional)', fBody: 'Details: who can apply, what it offers, how to apply', fCountry: 'Country', fCity: 'City (optional)', fOnline: 'Online or open to anywhere', fDeadline: 'Deadline (optional)', fLink: 'Link to apply or learn more (optional)', fContact: 'Contact email or phone (optional)',
    publish: 'Publish', save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete', delAsk: 'Delete this opportunity?', hide: 'Hide', unhide: 'Show again', hiddenTitle: 'Hidden opportunities',
    posted: 'Published', saved: 'Saved', errRate: 'You can share up to 5 opportunities per day.', errGeneric: 'Something went wrong. Try again.', errPlace: 'Add a country, or tick Online.', errSafe: 'Please remove unsuitable words.', errLink: 'The link must start with https://', by: 'Shared by', closed: 'Closed',
  },
  fr: {
    title: 'Opportunités', sub: 'Bourses, emplois, formations et événements partagés par la communauté.', share: 'Partager une opportunité',
    kinds: { all: 'Tout', scholarship: 'Bourses', job: 'Emplois', training: 'Formations', event: 'Événements', other: 'Autre' },
    near: 'Près de moi', onlineOnly: 'En ligne', everywhere: 'Partout', yourPlace: 'Votre lieu', country: 'Pays', city: 'Ville', savePlace: 'Enregistrer', placeHint: 'Ajoutez votre pays et votre ville pour voir d’abord les opportunités près de vous.',
    search: 'Rechercher des opportunités', deadline: 'Date limite', soon: 'Bientôt terminé', apply: 'Postuler ou en savoir plus', contact: 'Contact', online: 'En ligne / partout', empty: 'Aucune opportunité ici pour le moment. Soyez le premier à en partager une !', more: 'Voir plus',
    warn: 'Ne payez jamais pour postuler.',
    formTitle: 'Partager une opportunité', fKind: 'Type', fTitle: 'Titre', fOrg: 'Organisation (facultatif)', fBody: 'Détails : qui peut postuler, ce qui est offert, comment postuler', fCountry: 'Pays', fCity: 'Ville (facultatif)', fOnline: 'En ligne ou ouvert à tous', fDeadline: 'Date limite (facultatif)', fLink: 'Lien pour postuler ou en savoir plus (facultatif)', fContact: 'Courriel ou téléphone de contact (facultatif)',
    publish: 'Publier', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', del: 'Supprimer', delAsk: 'Supprimer cette opportunité ?', hide: 'Masquer', unhide: 'Réafficher', hiddenTitle: 'Opportunités masquées',
    posted: 'Publié', saved: 'Enregistré', errRate: 'Vous pouvez partager jusqu’à 5 opportunités par jour.', errGeneric: 'Une erreur est survenue. Réessayez.', errPlace: 'Ajoutez un pays ou cochez En ligne.', errSafe: 'Veuillez retirer les mots inappropriés.', errLink: 'Le lien doit commencer par https://', by: 'Partagé par', closed: 'Terminé',
  },
  es: {
    title: 'Oportunidades', sub: 'Becas, empleos, formación y eventos compartidos por la comunidad.', share: 'Compartir una oportunidad',
    kinds: { all: 'Todo', scholarship: 'Becas', job: 'Empleos', training: 'Formación', event: 'Eventos', other: 'Otro' },
    near: 'Cerca de mí', onlineOnly: 'En línea', everywhere: 'Todo el mundo', yourPlace: 'Tu lugar', country: 'País', city: 'Ciudad', savePlace: 'Guardar', placeHint: 'Añade tu país y ciudad para ver primero las oportunidades cercanas.',
    search: 'Buscar oportunidades', deadline: 'Fecha límite', soon: 'Cierra pronto', apply: 'Postular o saber más', contact: 'Contacto', online: 'En línea / cualquier lugar', empty: 'Aún no hay oportunidades aquí. ¡Sé el primero en compartir una!', more: 'Ver más',
    warn: 'Nunca pagues por postular.',
    formTitle: 'Compartir una oportunidad', fKind: 'Tipo', fTitle: 'Título', fOrg: 'Organización (opcional)', fBody: 'Detalles: quién puede postular, qué ofrece, cómo postular', fCountry: 'País', fCity: 'Ciudad (opcional)', fOnline: 'En línea o abierto a cualquier lugar', fDeadline: 'Fecha límite (opcional)', fLink: 'Enlace para postular o saber más (opcional)', fContact: 'Correo o teléfono de contacto (opcional)',
    publish: 'Publicar', save: 'Guardar', cancel: 'Cancelar', edit: 'Editar', del: 'Eliminar', delAsk: '¿Eliminar esta oportunidad?', hide: 'Ocultar', unhide: 'Mostrar de nuevo', hiddenTitle: 'Oportunidades ocultas',
    posted: 'Publicado', saved: 'Guardado', errRate: 'Puedes compartir hasta 5 oportunidades por día.', errGeneric: 'Algo salió mal. Inténtalo de nuevo.', errPlace: 'Añade un país o marca En línea.', errSafe: 'Quita las palabras inapropiadas.', errLink: 'El enlace debe empezar con https://', by: 'Compartido por', closed: 'Cerrado',
  },
  pt: {
    title: 'Oportunidades', sub: 'Bolsas, empregos, cursos e eventos compartilhados pela comunidade.', share: 'Compartilhar uma oportunidade',
    kinds: { all: 'Tudo', scholarship: 'Bolsas', job: 'Empregos', training: 'Formação', event: 'Eventos', other: 'Outro' },
    near: 'Perto de mim', onlineOnly: 'Online', everywhere: 'Em todo lugar', yourPlace: 'Seu lugar', country: 'País', city: 'Cidade', savePlace: 'Salvar', placeHint: 'Adicione seu país e cidade para ver primeiro as oportunidades perto de você.',
    search: 'Buscar oportunidades', deadline: 'Prazo', soon: 'Encerra em breve', apply: 'Candidatar-se ou saber mais', contact: 'Contato', online: 'Online / qualquer lugar', empty: 'Ainda não há oportunidades aqui. Seja o primeiro a compartilhar uma!', more: 'Ver mais',
    warn: 'Nunca pague para se candidatar.',
    formTitle: 'Compartilhar uma oportunidade', fKind: 'Tipo', fTitle: 'Título', fOrg: 'Organização (opcional)', fBody: 'Detalhes: quem pode se candidatar, o que oferece, como se candidatar', fCountry: 'País', fCity: 'Cidade (opcional)', fOnline: 'Online ou aberto a qualquer lugar', fDeadline: 'Prazo (opcional)', fLink: 'Link para se candidatar ou saber mais (opcional)', fContact: 'E-mail ou telefone de contato (opcional)',
    publish: 'Publicar', save: 'Salvar', cancel: 'Cancelar', edit: 'Editar', del: 'Excluir', delAsk: 'Excluir esta oportunidade?', hide: 'Ocultar', unhide: 'Mostrar de novo', hiddenTitle: 'Oportunidades ocultas',
    posted: 'Publicado', saved: 'Salvo', errRate: 'Você pode compartilhar até 5 oportunidades por dia.', errGeneric: 'Algo deu errado. Tente novamente.', errPlace: 'Adicione um país ou marque Online.', errSafe: 'Remova as palavras inadequadas.', errLink: 'O link deve começar com https://', by: 'Compartilhado por', closed: 'Encerrado',
  },
  hi: {
    title: 'अवसर', sub: 'समुदाय द्वारा साझा की गई छात्रवृत्तियाँ, नौकरियाँ, प्रशिक्षण और इवेंट।', share: 'कोई अवसर साझा करें',
    kinds: { all: 'सभी', scholarship: 'छात्रवृत्ति', job: 'नौकरियाँ', training: 'प्रशिक्षण', event: 'इवेंट', other: 'अन्य' },
    near: 'मेरे पास', onlineOnly: 'ऑनलाइन', everywhere: 'हर जगह', yourPlace: 'आपकी जगह', country: 'देश', city: 'शहर', savePlace: 'सहेजें', placeHint: 'अपने पास के अवसर पहले देखने के लिए अपना देश और शहर जोड़ें।',
    search: 'अवसर खोजें', deadline: 'अंतिम तिथि', soon: 'जल्द बंद होगा', apply: 'आवेदन करें या और जानें', contact: 'संपर्क', online: 'ऑनलाइन / कहीं से भी', empty: 'यहाँ अभी कोई अवसर नहीं है। पहला अवसर साझा करें!', more: 'और दिखाएँ',
    warn: 'आवेदन के लिए कभी पैसे न दें।',
    formTitle: 'कोई अवसर साझा करें', fKind: 'प्रकार', fTitle: 'शीर्षक', fOrg: 'संस्था (वैकल्पिक)', fBody: 'विवरण: कौन आवेदन कर सकता है, क्या मिलेगा, कैसे आवेदन करें', fCountry: 'देश', fCity: 'शहर (वैकल्पिक)', fOnline: 'ऑनलाइन या कहीं से भी', fDeadline: 'अंतिम तिथि (वैकल्पिक)', fLink: 'आवेदन या जानकारी का लिंक (वैकल्पिक)', fContact: 'संपर्क ईमेल या फ़ोन (वैकल्पिक)',
    publish: 'प्रकाशित करें', save: 'सहेजें', cancel: 'रद्द करें', edit: 'बदलें', del: 'हटाएँ', delAsk: 'यह अवसर हटाएँ?', hide: 'छिपाएँ', unhide: 'फिर दिखाएँ', hiddenTitle: 'छिपे हुए अवसर',
    posted: 'प्रकाशित', saved: 'सहेजा गया', errRate: 'आप एक दिन में अधिकतम 5 अवसर साझा कर सकते हैं।', errGeneric: 'कुछ गड़बड़ हुई। फिर कोशिश करें।', errPlace: 'देश जोड़ें या ऑनलाइन चुनें।', errSafe: 'कृपया अनुचित शब्द हटाएँ।', errLink: 'लिंक https:// से शुरू होना चाहिए', by: 'साझा करने वाले', closed: 'बंद',
  },
};
