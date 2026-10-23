import type { Lang } from './types';

export interface Contest {
  id: string; title: string; theme: string; prize: string; rules: string; starts_at: string; ends_at: string;
}
export interface Entry {
  rank: number; post_id: string; kind: 'photo' | 'video'; title: string; media_path: string; author_id: string;
  author_name: string; author_avatar: string | null; likes: number; commenters: number; score: number; entered_at: string;
}
export type Phase = 'soon' | 'open' | 'ended';
export const phaseOf = (c: Contest, now = Date.now()): Phase =>
  now < Date.parse(c.starts_at) ? 'soon' : now > Date.parse(c.ends_at) ? 'ended' : 'open';

export interface ContestWords {
  nav: string; banner: (prize: string) => string; join: string; see: string;
  soon: string; open: string; ended: string; endsOn: string; startsOn: string; prize: string; theme: string;
  how: string; step1: string; step2: string; step3: string; rulesTitle: string;
  enter: string; enterHelp: string; pick: string; noPosts: string; upload: string; signup: string; entered: string; entering: string;
  board: string; empty: string; likes: string; commenters: string; score: string; view: string; share: string; refresh: string;
  winner: string; winnerNote: string; none: string; closed: string;
  errAlready: string; errClosed: string; errGeneric: string; thanks: string;
}

export const CONTEST: Record<Lang, ContestWords> = {
  en: {
    nav: 'Contest', banner: (p) => `Contest: share your best photo or video${p ? ` and win ${p}` : ''}`, join: 'Enter', see: 'See the ranking',
    soon: 'Starts soon', open: 'Open now', ended: 'Finished', endsOn: 'Ends', startsOn: 'Starts', prize: 'Prize', theme: 'Theme',
    how: 'How it works', step1: 'Create a free account and enter one photo or video.',
    step2: 'Share your entry with your friends and followers. They sign up and like and comment.',
    step3: 'The entry with the highest score wins. Score = people who liked it + people who commented on it.',
    rulesTitle: 'Rules', enter: 'Enter the contest', enterHelp: 'Pick one of your public photos or videos. You can enter once.',
    pick: 'Enter this one', noPosts: 'You have no free public photo or video yet.', upload: 'Upload one', signup: 'Sign up to enter',
    entered: 'You are in! Share your entry to climb the ranking.', entering: 'Entering…',
    board: 'Ranking', empty: 'No entries yet. Be the first!', likes: 'Likes', commenters: 'Commenters', score: 'Score', view: 'Open', share: 'Share', refresh: 'Refresh',
    winner: 'Winner', winnerNote: 'The contest is over. Congratulations!', none: 'No contest right now.', closed: 'Entries are closed.',
    errAlready: 'You have already entered this contest.', errClosed: 'This contest is not open.', errGeneric: 'Something went wrong. Try again.', thanks: 'Entry received!',
  },
  fr: {
    nav: 'Concours', banner: (p) => `Concours : partagez votre meilleure photo ou vidéo${p ? ` et gagnez ${p}` : ''}`, join: 'Participer', see: 'Voir le classement',
    soon: 'Bientôt', open: 'En cours', ended: 'Terminé', endsOn: 'Se termine le', startsOn: 'Commence le', prize: 'Prix', theme: 'Thème',
    how: 'Comment ça marche', step1: 'Créez un compte gratuit et inscrivez une photo ou une vidéo.',
    step2: 'Partagez votre participation à vos amis et abonnés. Ils s’inscrivent, aiment et commentent.',
    step3: 'La participation avec le meilleur score gagne. Score = personnes qui ont aimé + personnes qui ont commenté.',
    rulesTitle: 'Règlement', enter: 'Participer au concours', enterHelp: 'Choisissez une de vos photos ou vidéos publiques. Une seule participation.',
    pick: 'Inscrire celle-ci', noPosts: 'Vous n’avez pas encore de photo ou vidéo publique gratuite.', upload: 'En publier une', signup: 'S’inscrire pour participer',
    entered: 'C’est fait ! Partagez votre participation pour monter au classement.', entering: 'Inscription…',
    board: 'Classement', empty: 'Aucune participation. Soyez le premier !', likes: 'J’aime', commenters: 'Commentateurs', score: 'Score', view: 'Ouvrir', share: 'Partager', refresh: 'Actualiser',
    winner: 'Gagnant', winnerNote: 'Le concours est terminé. Félicitations !', none: 'Aucun concours pour le moment.', closed: 'Les inscriptions sont closes.',
    errAlready: 'Vous participez déjà à ce concours.', errClosed: 'Ce concours n’est pas ouvert.', errGeneric: 'Une erreur est survenue. Réessayez.', thanks: 'Participation reçue !',
  },
  es: {
    nav: 'Concurso', banner: (p) => `Concurso: comparte tu mejor foto o video${p ? ` y gana ${p}` : ''}`, join: 'Participar', see: 'Ver la clasificación',
    soon: 'Pronto', open: 'Abierto', ended: 'Terminado', endsOn: 'Termina el', startsOn: 'Empieza el', prize: 'Premio', theme: 'Tema',
    how: 'Cómo funciona', step1: 'Crea una cuenta gratis e inscribe una foto o un video.',
    step2: 'Comparte tu participación con amigos y seguidores. Ellos se registran, dan me gusta y comentan.',
    step3: 'Gana la participación con la puntuación más alta. Puntuación = personas que dieron me gusta + personas que comentaron.',
    rulesTitle: 'Reglas', enter: 'Participar en el concurso', enterHelp: 'Elige una de tus fotos o videos públicos. Solo puedes participar una vez.',
    pick: 'Inscribir esta', noPosts: 'Aún no tienes una foto o video público gratuito.', upload: 'Subir una', signup: 'Regístrate para participar',
    entered: '¡Estás dentro! Comparte tu participación para subir en la clasificación.', entering: 'Inscribiendo…',
    board: 'Clasificación', empty: 'Aún no hay participaciones. ¡Sé el primero!', likes: 'Me gusta', commenters: 'Comentaristas', score: 'Puntos', view: 'Abrir', share: 'Compartir', refresh: 'Actualizar',
    winner: 'Ganador', winnerNote: 'El concurso terminó. ¡Felicidades!', none: 'No hay concurso por ahora.', closed: 'Las inscripciones están cerradas.',
    errAlready: 'Ya participas en este concurso.', errClosed: 'Este concurso no está abierto.', errGeneric: 'Algo salió mal. Inténtalo de nuevo.', thanks: '¡Participación recibida!',
  },
  pt: {
    nav: 'Concurso', banner: (p) => `Concurso: compartilhe sua melhor foto ou vídeo${p ? ` e ganhe ${p}` : ''}`, join: 'Participar', see: 'Ver a classificação',
    soon: 'Em breve', open: 'Aberto', ended: 'Encerrado', endsOn: 'Termina em', startsOn: 'Começa em', prize: 'Prêmio', theme: 'Tema',
    how: 'Como funciona', step1: 'Crie uma conta grátis e inscreva uma foto ou um vídeo.',
    step2: 'Compartilhe sua inscrição com amigos e seguidores. Eles se cadastram, curtem e comentam.',
    step3: 'Vence a inscrição com a maior pontuação. Pontuação = pessoas que curtiram + pessoas que comentaram.',
    rulesTitle: 'Regras', enter: 'Participar do concurso', enterHelp: 'Escolha uma de suas fotos ou vídeos públicos. Só é possível participar uma vez.',
    pick: 'Inscrever esta', noPosts: 'Você ainda não tem foto ou vídeo público gratuito.', upload: 'Enviar um', signup: 'Cadastre-se para participar',
    entered: 'Você está dentro! Compartilhe sua inscrição para subir na classificação.', entering: 'Inscrevendo…',
    board: 'Classificação', empty: 'Nenhuma inscrição ainda. Seja o primeiro!', likes: 'Curtidas', commenters: 'Comentaristas', score: 'Pontos', view: 'Abrir', share: 'Compartilhar', refresh: 'Atualizar',
    winner: 'Vencedor', winnerNote: 'O concurso terminou. Parabéns!', none: 'Nenhum concurso no momento.', closed: 'As inscrições estão encerradas.',
    errAlready: 'Você já participa deste concurso.', errClosed: 'Este concurso não está aberto.', errGeneric: 'Algo deu errado. Tente novamente.', thanks: 'Inscrição recebida!',
  },
  hi: {
    nav: 'प्रतियोगिता', banner: (p) => `प्रतियोगिता: अपनी सबसे अच्छी फ़ोटो या वीडियो साझा करें${p ? ` और ${p} जीतें` : ''}`, join: 'भाग लें', see: 'रैंकिंग देखें',
    soon: 'जल्द शुरू', open: 'अभी खुली है', ended: 'समाप्त', endsOn: 'समाप्ति', startsOn: 'शुरुआत', prize: 'इनाम', theme: 'विषय',
    how: 'यह कैसे काम करता है', step1: 'मुफ़्त खाता बनाएँ और एक फ़ोटो या वीडियो जमा करें।',
    step2: 'अपनी एंट्री दोस्तों और फ़ॉलोअर्स के साथ साझा करें। वे साइन अप करके लाइक और कमेंट करें।',
    step3: 'सबसे ज़्यादा स्कोर वाली एंट्री जीतती है। स्कोर = लाइक करने वाले लोग + कमेंट करने वाले लोग।',
    rulesTitle: 'नियम', enter: 'प्रतियोगिता में भाग लें', enterHelp: 'अपनी एक सार्वजनिक फ़ोटो या वीडियो चुनें। आप सिर्फ़ एक बार भाग ले सकते हैं।',
    pick: 'यह जमा करें', noPosts: 'आपके पास अभी कोई मुफ़्त सार्वजनिक फ़ोटो या वीडियो नहीं है।', upload: 'एक अपलोड करें', signup: 'भाग लेने के लिए साइन अप करें',
    entered: 'आप शामिल हैं! रैंकिंग में ऊपर आने के लिए अपनी एंट्री साझा करें।', entering: 'जमा हो रही है…',
    board: 'रैंकिंग', empty: 'अभी कोई एंट्री नहीं। पहले बनें!', likes: 'लाइक', commenters: 'कमेंट करने वाले', score: 'स्कोर', view: 'खोलें', share: 'साझा करें', refresh: 'ताज़ा करें',
    winner: 'विजेता', winnerNote: 'प्रतियोगिता समाप्त हुई। बधाई!', none: 'अभी कोई प्रतियोगिता नहीं है।', closed: 'एंट्री बंद है।',
    errAlready: 'आप इस प्रतियोगिता में पहले से हैं।', errClosed: 'यह प्रतियोगिता खुली नहीं है।', errGeneric: 'कुछ गड़बड़ हुई। फिर कोशिश करें।', thanks: 'एंट्री मिल गई!',
  },
};
