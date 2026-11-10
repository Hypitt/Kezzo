import type { Lang } from './types';

const EN = {
  title: 'Admin', sub: 'Manage Kezzo: members, content, reports, contests and the public site.',
  tabOverview: 'Overview', tabUsers: 'Members', tabReports: 'Reports', tabContent: 'Content', tabContests: 'Contests', tabAnalytics: 'Analytics', tabSite: 'Site', tabLog: 'Activity',
  noAccess: 'This page is for administrators only.', noAccessHelp: 'Ask the owner to add your account to the admins table.', signIn: 'Sign in', err: 'Something went wrong.',
  openReports: 'Reports to review', restricted: 'Restricted members', contestsOpen: 'Contests running', contestsHidden: 'Contests hidden', members: 'Members', actions24: 'Admin actions (24 h)',
  quick: 'Quick actions', goReports: 'Review reports', goUsers: 'Find a member', goContent: 'Search content', goContests: 'Manage contests', goAnalytics: 'See statistics', goSite: 'Edit the site',
  needsAttention: 'Needs your attention', allClear: 'Nothing to review right now.',
  searchUsers: 'Search by name or @handle', search: 'Search', fAll: 'Everyone', fRestricted: 'Restricted', fReported: 'Reported',
  joined: 'Joined', posts: 'posts', reportsShort: 'open reports', suspended: 'Suspended', banned: 'Banned', until: 'until', adminTag: 'Admin',
  suspend7: 'Suspend 7 days', suspend30: 'Suspend 30 days', ban: 'Ban', restore: 'Restore access', viewProfile: 'View profile',
  reasonAsk: 'Reason (shown to the member, optional):', banAsk: 'Ban this member for good? They will no longer be able to post, comment, message or go live.', suspendAsk: 'Suspend this member?',
  noUsers: 'No members found.', more: 'Show more', done: 'Done',
  rOpen: 'To review', rResolved: 'Resolved', rAll: 'All', dismiss: 'Dismiss', remove: 'Remove', view: 'Open', gone: '(already deleted)', by: 'By', reportsN: 'reports', noReports: 'No reports here.',
  removeAsk: 'Remove this for good?', resolvedAs: 'Resolved',
  tPost: 'Posts', tComment: 'Comments', tGroup: 'Groups', tBattle: 'Battles', tOpportunity: 'Opportunities', tMessage: 'Chat message', tProfile: 'Member',
  searchContent: 'Search by title, text or author', noContent: 'Nothing found.', contentNote: 'Removing a post also removes its comments and likes. Uploaded files stay in storage until you clean it.',
  open: 'Open', hide: 'Hide', show: 'Show', del: 'Delete', hidden: 'Hidden', entries: 'entries', delContestAsk: 'Delete this contest and its entries? The posts stay on Kezzo.', official: 'Kezzo', noContests: 'No contests yet.',
  logWhen: 'When', logWho: 'Admin', logWhat: 'Action', logOn: 'On', noLog: 'No admin actions recorded yet.',
  siteTools: 'Public site and look', siteHome: 'Edit the public homepage', siteTheme: 'Colors, fonts and text size', siteSections: 'Home and landing sections', siteStorage: 'Storage',
} as const;
type Words = Record<keyof typeof EN, string>;

const FR: Words = {
  title: 'Admin', sub: 'Gérez Kezzo : membres, contenus, signalements, concours et site public.',
  tabOverview: 'Aperçu', tabUsers: 'Membres', tabReports: 'Signalements', tabContent: 'Contenus', tabContests: 'Concours', tabAnalytics: 'Statistiques', tabSite: 'Site', tabLog: 'Activité',
  noAccess: 'Cette page est réservée aux administrateurs.', noAccessHelp: 'Demandez au propriétaire d’ajouter votre compte à la table admins.', signIn: 'Se connecter', err: 'Une erreur est survenue.',
  openReports: 'Signalements à examiner', restricted: 'Membres restreints', contestsOpen: 'Concours en cours', contestsHidden: 'Concours masqués', members: 'Membres', actions24: 'Actions admin (24 h)',
  quick: 'Actions rapides', goReports: 'Examiner les signalements', goUsers: 'Trouver un membre', goContent: 'Chercher un contenu', goContests: 'Gérer les concours', goAnalytics: 'Voir les statistiques', goSite: 'Modifier le site',
  needsAttention: 'À traiter', allClear: 'Rien à examiner pour l’instant.',
  searchUsers: 'Chercher par nom ou @identifiant', search: 'Chercher', fAll: 'Tout le monde', fRestricted: 'Restreints', fReported: 'Signalés',
  joined: 'Inscrit le', posts: 'publications', reportsShort: 'signalements ouverts', suspended: 'Suspendu', banned: 'Banni', until: 'jusqu’au', adminTag: 'Admin',
  suspend7: 'Suspendre 7 jours', suspend30: 'Suspendre 30 jours', ban: 'Bannir', restore: 'Rétablir l’accès', viewProfile: 'Voir le profil',
  reasonAsk: 'Motif (montré au membre, facultatif) :', banAsk: 'Bannir ce membre définitivement ? Il ne pourra plus publier, commenter, écrire ni faire de direct.', suspendAsk: 'Suspendre ce membre ?',
  noUsers: 'Aucun membre trouvé.', more: 'Afficher plus', done: 'C’est fait',
  rOpen: 'À examiner', rResolved: 'Traités', rAll: 'Tous', dismiss: 'Classer sans suite', remove: 'Retirer', view: 'Ouvrir', gone: '(déjà supprimé)', by: 'Par', reportsN: 'signalements', noReports: 'Aucun signalement ici.',
  removeAsk: 'Retirer définitivement ?', resolvedAs: 'Traité',
  tPost: 'Publications', tComment: 'Commentaires', tGroup: 'Groupes', tBattle: 'Battles', tOpportunity: 'Opportunités', tMessage: 'Message de chat', tProfile: 'Membre',
  searchContent: 'Chercher par titre, texte ou auteur', noContent: 'Rien trouvé.', contentNote: 'Retirer une publication retire aussi ses commentaires et ses j’aime. Les fichiers téléversés restent dans le stockage jusqu’à nettoyage.',
  open: 'Ouvrir', hide: 'Masquer', show: 'Afficher', del: 'Supprimer', hidden: 'Masqué', entries: 'participations', delContestAsk: 'Supprimer ce concours et ses participations ? Les publications restent sur Kezzo.', official: 'Kezzo', noContests: 'Aucun concours.',
  logWhen: 'Quand', logWho: 'Admin', logWhat: 'Action', logOn: 'Sur', noLog: 'Aucune action admin enregistrée.',
  siteTools: 'Site public et apparence', siteHome: 'Modifier la page d’accueil publique', siteTheme: 'Couleurs, polices et taille du texte', siteSections: 'Sections de l’accueil et de la page publique', siteStorage: 'Stockage',
};

export const adminText = (lang: Lang): Words => (lang === 'fr' ? FR : (EN as Words));
