import type { Lang } from './types';
import type { Contest } from './contest';

/** A contest as listed for one person: with their own marks and what they may do. */
export interface ContestRow extends Contest {
  owner_id: string | null; owner_name: string | null; official: boolean; hidden: boolean; entries: number;
  entered: boolean; voted: boolean; can_manage: boolean; phase: 'soon' | 'open' | 'ended';
}

export const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export interface HubWords {
  title: string; sub: string; create: string; filterAll: string; filterOpen: string; filterEntered: string; filterVoted: string; filterMine: string; filterEnded: string;
  none: string; noneFilter: string; official: string; by: string; entered: string; voted: string; yours: string; hiddenTag: string;
  open: string; soon: string; ended: string; entries: (n: number) => string; left: (d: number, h: number) => string; startsOn: string; endedOn: string;
  all: string; manage: string; edit: string; newTitle: string; editTitle: string; save: string; cancel: string; saved: string;
  fTitle: string; fTheme: string; fPrize: string; fRules: string; fStarts: string; fEnds: string; fHint: string;
  errMany: string; errLong: string; errDates: string; errForbidden: string; errGeneric: string; signIn: string;
  hide: string; unhide: string; banUser: string; unbanUser: string; bannedTag: string; mgmtHelp: string; hiddenNote: string; errBanned: string;
}

export const HUB: Record<Lang, HubWords> = {
  en: {
    title: 'Contests', sub: 'Join a contest, vote for your favorites, or start your own.', create: 'Start a contest',
    filterAll: 'All', filterOpen: 'Open now', filterEntered: 'I entered', filterVoted: 'I voted', filterMine: 'My contests', filterEnded: 'Finished',
    none: 'No contests yet. Start the first one!', noneFilter: 'Nothing here yet.', official: 'Kezzo', by: 'By', entered: 'Entered', voted: 'Voted', yours: 'Yours', hiddenTag: 'Hidden',
    open: 'Open now', soon: 'Starts soon', ended: 'Finished', entries: (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`, left: (d, h) => (d > 0 ? `${d}d ${h}h left` : `${h}h left`), startsOn: 'Starts', endedOn: 'Ended',
    all: 'All contests', manage: 'Manage this contest', edit: 'Edit details', newTitle: 'Start a contest', editTitle: 'Edit the contest', save: 'Save', cancel: 'Cancel', saved: 'Saved',
    fTitle: 'Title', fTheme: 'Theme', fPrize: 'Prize (optional)', fRules: 'Rules', fStarts: 'Starts', fEnds: 'Ends',
    fHint: 'Entries are new photos or videos. The entry with the most likes and commenters wins. You can run up to 3 unfinished contests, each up to 90 days.',
    errMany: 'You already have 3 unfinished contests. Wait for one to end or delete it.', errLong: 'A contest can last 90 days at most.', errDates: 'The end must be after the start.', errForbidden: 'You cannot do this.', errGeneric: 'Something went wrong. Try again.', signIn: 'Sign in to start a contest',
    hide: 'Hide from everyone', unhide: 'Show again', banUser: 'Stop this person from entering', unbanUser: 'Allow again', bannedTag: 'Blocked', mgmtHelp: 'You can remove entries and stop people from entering. Only you and Kezzo admins see this.', hiddenNote: 'This contest is hidden from everyone but you and Kezzo admins.', errBanned: 'You cannot enter this contest.',
  },
  fr: {
    title: 'Concours', sub: 'Participez, votez pour vos préférés ou lancez le vôtre.', create: 'Lancer un concours',
    filterAll: 'Tous', filterOpen: 'En cours', filterEntered: 'J’y participe', filterVoted: 'J’ai voté', filterMine: 'Mes concours', filterEnded: 'Terminés',
    none: 'Aucun concours. Lancez le premier !', noneFilter: 'Rien ici pour l’instant.', official: 'Kezzo', by: 'Par', entered: 'Inscrit', voted: 'Voté', yours: 'Le vôtre', hiddenTag: 'Masqué',
    open: 'En cours', soon: 'Bientôt', ended: 'Terminé', entries: (n) => `${n} participation${n > 1 ? 's' : ''}`, left: (d, h) => (d > 0 ? `${d} j ${h} h restants` : `${h} h restantes`), startsOn: 'Début', endedOn: 'Terminé le',
    all: 'Tous les concours', manage: 'Gérer ce concours', edit: 'Modifier', newTitle: 'Lancer un concours', editTitle: 'Modifier le concours', save: 'Enregistrer', cancel: 'Annuler', saved: 'Enregistré',
    fTitle: 'Titre', fTheme: 'Thème', fPrize: 'Prix (facultatif)', fRules: 'Règlement', fStarts: 'Début', fEnds: 'Fin',
    fHint: 'Les participations sont de nouvelles photos ou vidéos. Celle qui a le plus de j’aime et de commentateurs gagne. Jusqu’à 3 concours non terminés, de 90 jours maximum.',
    errMany: 'Vous avez déjà 3 concours non terminés. Attendez la fin de l’un d’eux ou supprimez-en un.', errLong: 'Un concours dure 90 jours au maximum.', errDates: 'La fin doit suivre le début.', errForbidden: 'Action non permise.', errGeneric: 'Une erreur est survenue. Réessayez.', signIn: 'Connectez-vous pour lancer un concours',
    hide: 'Masquer pour tout le monde', unhide: 'Afficher de nouveau', banUser: 'Empêcher cette personne de participer', unbanUser: 'Autoriser de nouveau', bannedTag: 'Bloqué', mgmtHelp: 'Vous pouvez retirer des participations et empêcher des personnes de participer. Seuls vous et les admins Kezzo le voient.', hiddenNote: 'Ce concours est masqué pour tous sauf vous et les admins Kezzo.', errBanned: 'Vous ne pouvez pas participer à ce concours.',
  },
  es: {
    title: 'Concursos', sub: 'Participa, vota por tus favoritos o crea el tuyo.', create: 'Crear un concurso',
    filterAll: 'Todos', filterOpen: 'Abiertos', filterEntered: 'Participo', filterVoted: 'Voté', filterMine: 'Mis concursos', filterEnded: 'Terminados',
    none: 'Aún no hay concursos. ¡Crea el primero!', noneFilter: 'Aún no hay nada aquí.', official: 'Kezzo', by: 'Por', entered: 'Inscrito', voted: 'Votó', yours: 'Tuyo', hiddenTag: 'Oculto',
    open: 'Abierto', soon: 'Pronto', ended: 'Terminado', entries: (n) => `${n} ${n === 1 ? 'participación' : 'participaciones'}`, left: (d, h) => (d > 0 ? `${d} d ${h} h restantes` : `${h} h restantes`), startsOn: 'Empieza', endedOn: 'Terminó',
    all: 'Todos los concursos', manage: 'Gestionar este concurso', edit: 'Editar', newTitle: 'Crear un concurso', editTitle: 'Editar el concurso', save: 'Guardar', cancel: 'Cancelar', saved: 'Guardado',
    fTitle: 'Título', fTheme: 'Tema', fPrize: 'Premio (opcional)', fRules: 'Reglas', fStarts: 'Empieza', fEnds: 'Termina',
    fHint: 'Las participaciones son fotos o videos nuevos. Gana la que tenga más me gusta y comentaristas. Hasta 3 concursos sin terminar, de máximo 90 días.',
    errMany: 'Ya tienes 3 concursos sin terminar. Espera a que termine uno o elimínalo.', errLong: 'Un concurso dura 90 días como máximo.', errDates: 'El final debe ser posterior al inicio.', errForbidden: 'No puedes hacer esto.', errGeneric: 'Algo salió mal. Inténtalo de nuevo.', signIn: 'Inicia sesión para crear un concurso',
    hide: 'Ocultar para todos', unhide: 'Mostrar de nuevo', banUser: 'Impedir que participe', unbanUser: 'Permitir de nuevo', bannedTag: 'Bloqueado', mgmtHelp: 'Puedes quitar participaciones e impedir que alguien participe. Solo tú y los administradores de Kezzo lo ven.', hiddenNote: 'Este concurso está oculto para todos salvo tú y los administradores de Kezzo.', errBanned: 'No puedes participar en este concurso.',
  },
  pt: {
    title: 'Concursos', sub: 'Participe, vote nos seus favoritos ou crie o seu.', create: 'Criar um concurso',
    filterAll: 'Todos', filterOpen: 'Abertos', filterEntered: 'Participo', filterVoted: 'Votei', filterMine: 'Meus concursos', filterEnded: 'Encerrados',
    none: 'Ainda não há concursos. Crie o primeiro!', noneFilter: 'Nada aqui ainda.', official: 'Kezzo', by: 'Por', entered: 'Inscrito', voted: 'Votou', yours: 'Seu', hiddenTag: 'Oculto',
    open: 'Aberto', soon: 'Em breve', ended: 'Encerrado', entries: (n) => `${n} ${n === 1 ? 'participação' : 'participações'}`, left: (d, h) => (d > 0 ? `${d} d ${h} h restantes` : `${h} h restantes`), startsOn: 'Começa', endedOn: 'Terminou',
    all: 'Todos os concursos', manage: 'Gerir este concurso', edit: 'Editar', newTitle: 'Criar um concurso', editTitle: 'Editar o concurso', save: 'Salvar', cancel: 'Cancelar', saved: 'Salvo',
    fTitle: 'Título', fTheme: 'Tema', fPrize: 'Prêmio (opcional)', fRules: 'Regras', fStarts: 'Começa', fEnds: 'Termina',
    fHint: 'As participações são fotos ou vídeos novos. Vence a que tiver mais curtidas e comentaristas. Até 3 concursos não encerrados, de no máximo 90 dias.',
    errMany: 'Você já tem 3 concursos não encerrados. Espere um terminar ou exclua um.', errLong: 'Um concurso dura no máximo 90 dias.', errDates: 'O fim deve ser depois do início.', errForbidden: 'Você não pode fazer isso.', errGeneric: 'Algo deu errado. Tente de novo.', signIn: 'Entre para criar um concurso',
    hide: 'Ocultar de todos', unhide: 'Mostrar de novo', banUser: 'Impedir de participar', unbanUser: 'Permitir de novo', bannedTag: 'Bloqueado', mgmtHelp: 'Você pode remover participações e impedir pessoas de participar. Só você e os administradores do Kezzo veem isto.', hiddenNote: 'Este concurso está oculto para todos, exceto você e os administradores do Kezzo.', errBanned: 'Você não pode participar deste concurso.',
  },
  hi: {
    title: 'प्रतियोगिताएँ', sub: 'भाग लें, अपने पसंदीदा को वोट दें, या अपनी प्रतियोगिता शुरू करें।', create: 'प्रतियोगिता शुरू करें',
    filterAll: 'सभी', filterOpen: 'अभी खुली', filterEntered: 'मैंने भाग लिया', filterVoted: 'मैंने वोट दिया', filterMine: 'मेरी प्रतियोगिताएँ', filterEnded: 'समाप्त',
    none: 'अभी कोई प्रतियोगिता नहीं। पहली शुरू करें!', noneFilter: 'यहाँ अभी कुछ नहीं।', official: 'Kezzo', by: 'द्वारा', entered: 'शामिल', voted: 'वोट दिया', yours: 'आपकी', hiddenTag: 'छिपी',
    open: 'अभी खुली', soon: 'जल्द शुरू', ended: 'समाप्त', entries: (n) => `${n} प्रविष्टियाँ`, left: (d, h) => (d > 0 ? `${d} दिन ${h} घंटे बाकी` : `${h} घंटे बाकी`), startsOn: 'शुरू', endedOn: 'समाप्त',
    all: 'सभी प्रतियोगिताएँ', manage: 'इस प्रतियोगिता को संभालें', edit: 'बदलें', newTitle: 'प्रतियोगिता शुरू करें', editTitle: 'प्रतियोगिता बदलें', save: 'सहेजें', cancel: 'रद्द करें', saved: 'सहेजा गया',
    fTitle: 'शीर्षक', fTheme: 'विषय', fPrize: 'इनाम (वैकल्पिक)', fRules: 'नियम', fStarts: 'शुरू', fEnds: 'समाप्त',
    fHint: 'प्रविष्टियाँ नई फ़ोटो या वीडियो होती हैं। सबसे ज़्यादा लाइक और टिप्पणीकारों वाली प्रविष्टि जीतती है। 3 अधूरी प्रतियोगिताएँ तक, हर एक अधिकतम 90 दिन।',
    errMany: 'आपकी 3 प्रतियोगिताएँ अभी चल रही हैं। एक के ख़त्म होने तक रुकें या एक हटा दें।', errLong: 'प्रतियोगिता अधिकतम 90 दिन की हो सकती है।', errDates: 'समाप्ति शुरुआत के बाद होनी चाहिए।', errForbidden: 'आप यह नहीं कर सकते।', errGeneric: 'कुछ गड़बड़ हुई। फिर कोशिश करें।', signIn: 'प्रतियोगिता शुरू करने के लिए साइन इन करें',
    hide: 'सबसे छिपाएँ', unhide: 'फिर दिखाएँ', banUser: 'इस व्यक्ति को भाग लेने से रोकें', unbanUser: 'फिर अनुमति दें', bannedTag: 'रोका गया', mgmtHelp: 'आप प्रविष्टियाँ हटा सकते हैं और लोगों को भाग लेने से रोक सकते हैं। यह केवल आपको और Kezzo एडमिन को दिखता है।', hiddenNote: 'यह प्रतियोगिता आपके और Kezzo एडमिन के अलावा सबसे छिपी है।', errBanned: 'आप इस प्रतियोगिता में भाग नहीं ले सकते।',
  },
};

/** Turns a database error from a contest action into words for the person. */
export function contestError(message: string | undefined, h: HubWords): string {
  const m = message ?? '';
  if (m.includes('too_many')) return h.errMany;
  if (m.includes('too_long')) return h.errLong;
  if (m.includes('bad_dates') || m.includes('contests_check')) return h.errDates;
  if (m.includes('forbidden')) return h.errForbidden;
  if (m.includes('banned')) return h.errBanned;
  return h.errGeneric;
}
