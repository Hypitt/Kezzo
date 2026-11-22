import type { Lang } from './types';

/** Words for reviews from completed orders, in the five Kezzo languages. */
export interface ReviewWords {
  leave: string; rate: string; commentPh: string; send: string; thanks: string; yours: string; title: string; none: string; show: string; hide: string; confirmed: string; err: string; cancel: string;
  errors: Record<string, string>;
}
export const REVIEWS: Record<Lang, ReviewWords> = {
  en: { leave: 'Leave a review', rate: 'Your rating', commentPh: 'Say a few words (optional)', send: 'Send review', thanks: 'Thank you for your review.', yours: 'Your review', title: 'Reviews', none: 'No reviews yet.', show: 'Show reviews', hide: 'Hide reviews', confirmed: 'From a completed order', err: 'Something went wrong. Please try again.', cancel: 'Cancel',
    errors: { not_completed: 'You can review once the order is completed.', already_reviewed: 'You already reviewed this order.', not_buyer: 'Only the buyer can review.', bad_rating: 'Choose 1 to 5 stars.' } },
  fr: { leave: 'Laisser un avis', rate: 'Votre note', commentPh: 'Quelques mots (facultatif)', send: 'Envoyer l’avis', thanks: 'Merci pour votre avis.', yours: 'Votre avis', title: 'Avis', none: 'Aucun avis pour l’instant.', show: 'Voir les avis', hide: 'Masquer les avis', confirmed: 'D’une commande terminée', err: 'Une erreur est survenue. Réessayez.', cancel: 'Annuler',
    errors: { not_completed: 'Vous pouvez donner un avis quand la commande est terminée.', already_reviewed: 'Vous avez déjà donné un avis sur cette commande.', not_buyer: 'Seul l’acheteur peut donner un avis.', bad_rating: 'Choisissez de 1 à 5 étoiles.' } },
  es: { leave: 'Dejar una reseña', rate: 'Tu valoración', commentPh: 'Unas palabras (opcional)', send: 'Enviar reseña', thanks: 'Gracias por tu reseña.', yours: 'Tu reseña', title: 'Reseñas', none: 'Aún no hay reseñas.', show: 'Ver reseñas', hide: 'Ocultar reseñas', confirmed: 'De un pedido completado', err: 'Algo salió mal. Inténtalo de nuevo.', cancel: 'Cancelar',
    errors: { not_completed: 'Puedes opinar cuando el pedido esté completado.', already_reviewed: 'Ya opinaste sobre este pedido.', not_buyer: 'Solo el comprador puede opinar.', bad_rating: 'Elige de 1 a 5 estrellas.' } },
  pt: { leave: 'Deixar uma avaliação', rate: 'Sua nota', commentPh: 'Algumas palavras (opcional)', send: 'Enviar avaliação', thanks: 'Obrigado pela sua avaliação.', yours: 'Sua avaliação', title: 'Avaliações', none: 'Ainda não há avaliações.', show: 'Ver avaliações', hide: 'Ocultar avaliações', confirmed: 'De um pedido concluído', err: 'Algo deu errado. Tente de novo.', cancel: 'Cancelar',
    errors: { not_completed: 'Você pode avaliar quando o pedido estiver concluído.', already_reviewed: 'Você já avaliou este pedido.', not_buyer: 'Só o comprador pode avaliar.', bad_rating: 'Escolha de 1 a 5 estrelas.' } },
  hi: { leave: 'समीक्षा दें', rate: 'आपकी रेटिंग', commentPh: 'कुछ शब्द लिखें (वैकल्पिक)', send: 'समीक्षा भेजें', thanks: 'आपकी समीक्षा के लिए धन्यवाद।', yours: 'आपकी समीक्षा', title: 'समीक्षाएँ', none: 'अभी कोई समीक्षा नहीं।', show: 'समीक्षाएँ देखें', hide: 'समीक्षाएँ छिपाएँ', confirmed: 'पूरे हुए ऑर्डर से', err: 'कुछ गलत हो गया। फिर कोशिश करें।', cancel: 'रद्द करें',
    errors: { not_completed: 'ऑर्डर पूरा होने के बाद आप समीक्षा दे सकते हैं।', already_reviewed: 'आप इस ऑर्डर की समीक्षा पहले दे चुके हैं।', not_buyer: 'केवल खरीदार समीक्षा दे सकता है।', bad_rating: '1 से 5 सितारे चुनें।' } },
};
export function reviewError(lang: Lang, message: string): string {
  const w = REVIEWS[lang];
  const k = Object.keys(w.errors).find((e) => message.includes(e));
  return k ? w.errors[k] : w.err;
}
