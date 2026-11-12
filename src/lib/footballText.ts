import type { Lang } from './types';

export interface FootballWords {
  title: string; sub: string; local: string; localSub: string; online: string; hostBtn: string; joinCode: string; codePh: string; join: string; openMatches: string; noMatches: string;
  perTeam: string; minutes: string; signIn: string; helpTitle: string; helpP1: string; helpP2: string; helpOnline: string; helpTouch: string; keysLegend: string;
  teamA: string; teamB: string; code: string; copyLink: string; copied: string; share: string; lobbyTitle: string; you: string; host: string; waitHost: string; startMatch: string; fillAi: string;
  humansN: (n: number) => string; leave: string; publicMatch: string; full: string; takeTeam: string; hostOf: (n: string) => string; matchOf: (n: number, m: number) => string;
  kickoff: string; goal: string; fullTime: string; out: string; pause: string; resume: string; quit: string; rotate: string; keepOpen: string; connecting: string; hostLeft: string; badCode: string;
  winner: (t: string) => string; draw: string; playAgain: string; back: string; pass: string; shoot: string; sprint: string; limit: string; p1: string; p2: string; inviteText: string; noRoom: string;
}

export const FOOTBALL: Record<Lang, FootballWords> = {
  en: {
    title: 'Football', sub: 'Play football with friends on one screen or online.', local: 'Play on this screen', localSub: '2 players on one device. Computer players fill the rest of each team.', online: 'Play online',
    hostBtn: 'Host a match', joinCode: 'Join with a code', codePh: 'Match code', join: 'Join', openMatches: 'Open matches', noMatches: 'No open matches right now. Host one and invite your friends!',
    perTeam: 'Players per team', minutes: 'Match length (minutes)', signIn: 'Sign in to play online', helpTitle: 'Controls', helpP1: 'Player 1: W A S D to move, F pass, G shoot, R sprint.', helpP2: 'Player 2: arrow keys to move, , pass, . shoot, / sprint.',
    helpOnline: 'Online: W A S D or arrows to move, F pass, G shoot (hold for power), R or Shift sprint.', helpTouch: 'Phone: use the stick and the buttons on screen. Hold shoot for a stronger shot. Pass when you do not have the ball to switch player.', keysLegend: 'Without the ball, shoot = slide tackle.',
    teamA: 'Orange', teamB: 'Blue', code: 'Match code', copyLink: 'Copy invite link', copied: 'Invite link copied', share: 'Share', lobbyTitle: 'Match lobby', you: 'you', host: 'host', waitHost: 'Waiting for the host to start…',
    startMatch: 'Start match', fillAi: 'Empty places are filled by computer players.', humansN: (n) => `${n} ${n === 1 ? 'person' : 'people'}`, leave: 'Leave', publicMatch: 'Show in open matches', full: 'Full', takeTeam: 'Join this team',
    hostOf: (n) => `${n}’s match`, matchOf: (n, m) => `${n} v ${n} · ${m} min`, kickoff: 'Kick off', goal: 'GOAL!', fullTime: 'Full time', out: 'Out of play', pause: 'Pause', resume: 'Resume', quit: 'Quit',
    rotate: 'Turn your phone sideways to play.', keepOpen: 'Keep this screen open: you are hosting the match.', connecting: 'Connecting…', hostLeft: 'The host left the match.', badCode: 'Enter the 5-letter match code.',
    winner: (t) => `${t} wins!`, draw: 'Draw', playAgain: 'Play again', back: 'Back to Football', pass: 'Pass', shoot: 'Shoot', sprint: 'Run', limit: 'Online matches work best with up to about 8 people at once on the free Supabase plan.', p1: 'P1', p2: 'P2',
    inviteText: 'Join my Kezzo football match!', noRoom: 'This match is not open.',
  },
  fr: {
    title: 'Football', sub: 'Jouez au football entre amis sur un seul écran ou en ligne.', local: 'Jouer sur cet écran', localSub: '2 joueurs sur un appareil. Des joueurs ordinateur complètent chaque équipe.', online: 'Jouer en ligne',
    hostBtn: 'Créer un match', joinCode: 'Rejoindre avec un code', codePh: 'Code du match', join: 'Rejoindre', openMatches: 'Matchs ouverts', noMatches: 'Aucun match ouvert pour l’instant. Créez-en un et invitez vos amis !',
    perTeam: 'Joueurs par équipe', minutes: 'Durée du match (minutes)', signIn: 'Connectez-vous pour jouer en ligne', helpTitle: 'Commandes', helpP1: 'Joueur 1 : W A S D pour bouger, F passe, G tir, R sprint.', helpP2: 'Joueur 2 : flèches pour bouger, , passe, . tir, / sprint.',
    helpOnline: 'En ligne : W A S D ou flèches pour bouger, F passe, G tir (maintenir pour la puissance), R ou Maj sprint.', helpTouch: 'Téléphone : utilisez le stick et les boutons à l’écran. Maintenez tir pour un tir plus fort. Passe sans ballon : change de joueur.', keysLegend: 'Sans le ballon, tir = tacle glissé.',
    teamA: 'Orange', teamB: 'Bleu', code: 'Code du match', copyLink: 'Copier le lien d’invitation', copied: 'Lien d’invitation copié', share: 'Partager', lobbyTitle: 'Salon du match', you: 'vous', host: 'hôte', waitHost: 'En attente du début par l’hôte…',
    startMatch: 'Lancer le match', fillAi: 'Les places vides sont remplies par des joueurs ordinateur.', humansN: (n) => `${n} personne${n > 1 ? 's' : ''}`, leave: 'Quitter', publicMatch: 'Afficher dans les matchs ouverts', full: 'Complet', takeTeam: 'Rejoindre cette équipe',
    hostOf: (n) => `Match de ${n}`, matchOf: (n, m) => `${n} c. ${n} · ${m} min`, kickoff: 'Coup d’envoi', goal: 'BUT !', fullTime: 'Fin du match', out: 'Ballon sorti', pause: 'Pause', resume: 'Reprendre', quit: 'Quitter',
    rotate: 'Tournez votre téléphone à l’horizontale pour jouer.', keepOpen: 'Gardez cet écran ouvert : vous hébergez le match.', connecting: 'Connexion…', hostLeft: 'L’hôte a quitté le match.', badCode: 'Entrez le code du match à 5 caractères.',
    winner: (t) => `${t} gagne !`, draw: 'Match nul', playAgain: 'Rejouer', back: 'Retour au football', pass: 'Passe', shoot: 'Tir', sprint: 'Course', limit: 'Les matchs en ligne fonctionnent mieux jusqu’à environ 8 personnes à la fois avec l’offre gratuite de Supabase.', p1: 'J1', p2: 'J2',
    inviteText: 'Rejoins mon match de football sur Kezzo !', noRoom: 'Ce match n’est pas ouvert.',
  },
  es: {
    title: 'Fútbol', sub: 'Juega al fútbol con amigos en una pantalla o en línea.', local: 'Jugar en esta pantalla', localSub: '2 jugadores en un dispositivo. Jugadores de la computadora completan cada equipo.', online: 'Jugar en línea',
    hostBtn: 'Crear un partido', joinCode: 'Unirse con un código', codePh: 'Código del partido', join: 'Unirse', openMatches: 'Partidos abiertos', noMatches: 'No hay partidos abiertos ahora. ¡Crea uno e invita a tus amigos!',
    perTeam: 'Jugadores por equipo', minutes: 'Duración del partido (minutos)', signIn: 'Inicia sesión para jugar en línea', helpTitle: 'Controles', helpP1: 'Jugador 1: W A S D para moverte, F pase, G tiro, R correr.', helpP2: 'Jugador 2: flechas para moverte, , pase, . tiro, / correr.',
    helpOnline: 'En línea: W A S D o flechas para moverte, F pase, G tiro (mantén para más fuerza), R o Shift correr.', helpTouch: 'Móvil: usa el stick y los botones en pantalla. Mantén tiro para un tiro más fuerte. Pase sin balón: cambia de jugador.', keysLegend: 'Sin el balón, tiro = entrada deslizante.',
    teamA: 'Naranja', teamB: 'Azul', code: 'Código del partido', copyLink: 'Copiar enlace de invitación', copied: 'Enlace de invitación copiado', share: 'Compartir', lobbyTitle: 'Sala del partido', you: 'tú', host: 'anfitrión', waitHost: 'Esperando a que el anfitrión empiece…',
    startMatch: 'Empezar partido', fillAi: 'Los lugares vacíos los llenan jugadores de la computadora.', humansN: (n) => `${n} ${n === 1 ? 'persona' : 'personas'}`, leave: 'Salir', publicMatch: 'Mostrar en partidos abiertos', full: 'Completo', takeTeam: 'Unirse a este equipo',
    hostOf: (n) => `Partido de ${n}`, matchOf: (n, m) => `${n} vs ${n} · ${m} min`, kickoff: 'Saque inicial', goal: '¡GOL!', fullTime: 'Final', out: 'Fuera de juego', pause: 'Pausa', resume: 'Seguir', quit: 'Salir',
    rotate: 'Gira el teléfono en horizontal para jugar.', keepOpen: 'Mantén esta pantalla abierta: eres el anfitrión.', connecting: 'Conectando…', hostLeft: 'El anfitrión salió del partido.', badCode: 'Escribe el código de 5 caracteres.',
    winner: (t) => `¡Gana ${t}!`, draw: 'Empate', playAgain: 'Jugar otra vez', back: 'Volver al fútbol', pass: 'Pase', shoot: 'Tiro', sprint: 'Correr', limit: 'Los partidos en línea funcionan mejor con hasta unas 8 personas a la vez en el plan gratuito de Supabase.', p1: 'J1', p2: 'J2',
    inviteText: '¡Únete a mi partido de fútbol en Kezzo!', noRoom: 'Este partido no está abierto.',
  },
  pt: {
    title: 'Futebol', sub: 'Jogue futebol com amigos em uma tela ou online.', local: 'Jogar nesta tela', localSub: '2 jogadores em um aparelho. Jogadores do computador completam cada time.', online: 'Jogar online',
    hostBtn: 'Criar uma partida', joinCode: 'Entrar com um código', codePh: 'Código da partida', join: 'Entrar', openMatches: 'Partidas abertas', noMatches: 'Nenhuma partida aberta agora. Crie uma e convide seus amigos!',
    perTeam: 'Jogadores por time', minutes: 'Duração da partida (minutos)', signIn: 'Entre para jogar online', helpTitle: 'Controles', helpP1: 'Jogador 1: W A S D para mover, F passe, G chute, R correr.', helpP2: 'Jogador 2: setas para mover, , passe, . chute, / correr.',
    helpOnline: 'Online: W A S D ou setas para mover, F passe, G chute (segure para força), R ou Shift correr.', helpTouch: 'Celular: use o stick e os botões na tela. Segure chute para um chute mais forte. Passe sem a bola: troca de jogador.', keysLegend: 'Sem a bola, chute = carrinho.',
    teamA: 'Laranja', teamB: 'Azul', code: 'Código da partida', copyLink: 'Copiar link de convite', copied: 'Link de convite copiado', share: 'Compartilhar', lobbyTitle: 'Sala da partida', you: 'você', host: 'anfitrião', waitHost: 'Aguardando o anfitrião começar…',
    startMatch: 'Começar partida', fillAi: 'Vagas vazias são preenchidas por jogadores do computador.', humansN: (n) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`, leave: 'Sair', publicMatch: 'Mostrar em partidas abertas', full: 'Cheio', takeTeam: 'Entrar neste time',
    hostOf: (n) => `Partida de ${n}`, matchOf: (n, m) => `${n} x ${n} · ${m} min`, kickoff: 'Pontapé inicial', goal: 'GOL!', fullTime: 'Fim de jogo', out: 'Bola fora', pause: 'Pausa', resume: 'Continuar', quit: 'Sair',
    rotate: 'Vire o celular na horizontal para jogar.', keepOpen: 'Mantenha esta tela aberta: você é o anfitrião.', connecting: 'Conectando…', hostLeft: 'O anfitrião saiu da partida.', badCode: 'Digite o código de 5 caracteres.',
    winner: (t) => `${t} vence!`, draw: 'Empate', playAgain: 'Jogar de novo', back: 'Voltar ao futebol', pass: 'Passe', shoot: 'Chute', sprint: 'Correr', limit: 'As partidas online funcionam melhor com até cerca de 8 pessoas ao mesmo tempo no plano gratuito do Supabase.', p1: 'J1', p2: 'J2',
    inviteText: 'Entre na minha partida de futebol no Kezzo!', noRoom: 'Esta partida não está aberta.',
  },
  hi: {
    title: 'फ़ुटबॉल', sub: 'दोस्तों के साथ एक स्क्रीन पर या ऑनलाइन फ़ुटबॉल खेलें।', local: 'इसी स्क्रीन पर खेलें', localSub: 'एक डिवाइस पर 2 खिलाड़ी। हर टीम के बाकी खिलाड़ी कंप्यूटर के होंगे।', online: 'ऑनलाइन खेलें',
    hostBtn: 'मैच बनाएँ', joinCode: 'कोड से जुड़ें', codePh: 'मैच कोड', join: 'जुड़ें', openMatches: 'खुले मैच', noMatches: 'अभी कोई खुला मैच नहीं। एक बनाएँ और दोस्तों को बुलाएँ!',
    perTeam: 'प्रति टीम खिलाड़ी', minutes: 'मैच की अवधि (मिनट)', signIn: 'ऑनलाइन खेलने के लिए साइन इन करें', helpTitle: 'नियंत्रण', helpP1: 'खिलाड़ी 1: W A S D चलने के लिए, F पास, G शॉट, R दौड़।', helpP2: 'खिलाड़ी 2: तीर वाली कुंजियाँ, , पास, . शॉट, / दौड़।',
    helpOnline: 'ऑनलाइन: W A S D या तीर चलने के लिए, F पास, G शॉट (ज़ोर के लिए दबाए रखें), R या Shift दौड़।', helpTouch: 'फ़ोन: स्क्रीन के स्टिक और बटन इस्तेमाल करें। ज़ोरदार शॉट के लिए शॉट दबाए रखें। गेंद के बिना पास = खिलाड़ी बदलें।', keysLegend: 'गेंद के बिना शॉट = स्लाइड टैकल।',
    teamA: 'नारंगी', teamB: 'नीली', code: 'मैच कोड', copyLink: 'आमंत्रण लिंक कॉपी करें', copied: 'आमंत्रण लिंक कॉपी हुआ', share: 'साझा करें', lobbyTitle: 'मैच लॉबी', you: 'आप', host: 'मेज़बान', waitHost: 'मेज़बान के शुरू करने का इंतज़ार…',
    startMatch: 'मैच शुरू करें', fillAi: 'खाली जगहें कंप्यूटर खिलाड़ी भरेंगे।', humansN: (n) => `${n} लोग`, leave: 'छोड़ें', publicMatch: 'खुले मैचों में दिखाएँ', full: 'भरा', takeTeam: 'इस टीम में जुड़ें',
    hostOf: (n) => `${n} का मैच`, matchOf: (n, m) => `${n} बनाम ${n} · ${m} मिनट`, kickoff: 'किक-ऑफ़', goal: 'गोल!', fullTime: 'मैच ख़त्म', out: 'गेंद बाहर', pause: 'रोकें', resume: 'जारी रखें', quit: 'छोड़ें',
    rotate: 'खेलने के लिए फ़ोन को आड़ा घुमाएँ।', keepOpen: 'यह स्क्रीन खुली रखें: आप मैच के मेज़बान हैं।', connecting: 'जुड़ रहा है…', hostLeft: 'मेज़बान ने मैच छोड़ दिया।', badCode: '5 अक्षर का मैच कोड लिखें।',
    winner: (t) => `${t} जीता!`, draw: 'ड्रॉ', playAgain: 'फिर खेलें', back: 'फ़ुटबॉल पर लौटें', pass: 'पास', shoot: 'शॉट', sprint: 'दौड़', limit: 'मुफ़्त Supabase प्लान पर ऑनलाइन मैच एक समय में लगभग 8 लोगों तक सबसे अच्छे चलते हैं।', p1: 'खि1', p2: 'खि2',
    inviteText: 'Kezzo पर मेरे फ़ुटबॉल मैच में जुड़ें!', noRoom: 'यह मैच खुला नहीं है।',
  },
};
