import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Mic, Swords, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { PENDING_GROUP, PENDING_JOIN } from '../lib/invite';
import { InstallButton } from '../components/InstallButton';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useSections } from '../lib/sections';
import { autoPaths, orderOf, setShowOriginal, useCopy, useShowOriginal, useSiteContent } from '../lib/siteContent';
import { TR } from '../lib/translate';
import { ContestSection } from '../components/ContestSection';
import { LandingMedia } from '../components/LandingMedia';
import { useThemeScope } from '../lib/theme';

/**
 * The public page every visitor sees first. Everything else in Kezzo needs an account.
 * Plain markup and CSS (no pictures, no scripts beyond two tiny read-only calls) so it opens fast on any connection.
 * Palette: white and warm stone surfaces, near-black text, one brand red used only for the main buttons and small accents.
 */

export const COPY = {
  en: {
    login: 'Log in', signup: 'Sign up', language: 'Language',
    eyebrow: 'Live battles · Live streams · Groups',
    live: (n: number) => (n === 1 ? '1 battle live right now' : `${n} battles live right now`),
    h1a: 'Get to know the world', h1b: 'through its people.',
    lead: 'Show the world what makes your culture unique. Share your traditions, celebrate your heritage, exchange stories, and discover music, food, languages, and lifestyles from around the world.',
    leadTag: 'Share your culture. Discover the world.',
    talent: 'Do you have any talent? Share it with the world and let it be seen.',
    cta: 'Create your free account', ctaNote: 'Free to join · 16+ · Takes less than a minute',
    media: { kicker: 'From the community', title: 'See what people are sharing', note: 'Like what you see? Log in to see more or to add yours.', cta: 'Log in to comment', like: 'Like', comments: 'Comments' },
    lines: ['Don’t just watch. Be part of it.', 'Your people. Your moments. Your stage.'],
    pillars: [
      ['02 · Social participation', 'Don’t just scroll. Get involved.', 'Join conversations, react to live moments, meet new people, and become part of experiences that bring communities together.'],
      ['03 · Cultural exchange', 'Your culture. Your stories. Your world.', 'Show the world what makes your culture unique. Share your traditions, celebrate your heritage, exchange stories, and discover music, food, languages, and lifestyles from around the world.'],
      ['04 · Live competitions', 'Bring your talent. Join the challenge.', 'Take part in live competitions, challenge creators, showcase your skills, and rally your community. Step into the action and see what happens when talent meets friendly competition.'],
      ['05 · Live events', 'Be there when it happens.', 'Discover live events, join shared experiences, meet people with similar interests, and be part of the moments everyone is talking about.'],
      ['06 · Community & connection', 'More than a feed. A whole experience.', 'From cultural discoveries to live competitions and community events, find new ways to express yourself, connect with others, and make every interaction count.'],
    ],
    liveKicker: 'Three ways to be live', liveTitle: 'Live together, not just alone',
    liveText: 'Solo broadcasts, group livestreams and battles are different experiences, and Kezzo treats them that way. Bring friends or other creators on screen and talk with your audience as it happens.',
    modes: [
      ['Solo broadcast', 'Go live on your own with live chat. No battle needed.'],
      ['Group livestream', 'Invite guests onto the screen. Viewers ask to join, you decide who comes up.'],
      ['Battle', 'Creator versus creator, with a live scoreboard and votes from the crowd.'],
    ],
    feedKicker: 'More than likes', feedTitle: 'A feed that leads to participation',
    feedText: 'Videos, audio, photos and posts are there to start something. React, comment, follow, join a group and jump into the live moments around you.',
    feedNow: 'Available now', feedNowItems: ['Video, audio, photo and text posts', 'Likes, comments and follows', 'Groups, chats and calls', '24-hour status updates'],
    feedSoon: 'Coming soon', feedSoonItems: ['Polls', 'Audience questions', 'Challenges', 'Creator prompts'],
    groupsKicker: 'Communities', groupsTitle: 'Groups you can join', groupsText: 'Open groups from the Kezzo community. Sign up or log in to join.',
    example: 'Example', exGroups: [['Podcast & talk', 'Voices, interviews and live Q&A', 2415], ['Creators corner', 'Share your setup and tips', 1248], ['Friends & fun', 'Challenges with your crew', 862]],
    groupMembers: (n: number) => (n === 1 ? '1 member' : `${n} members`), groupJoin: 'Sign up to join',
    cats: { dance: 'Dance crew', roasting: 'Roasting', singing: 'Singing', debate: 'Debate', comedy: 'Comedy', other: 'Community' } as Record<string, string>,
    members: 'Kezzo is for members. Sign up or log in to see the feed, videos, live streams, battles and profiles.',
    finalTitle: 'Don’t just scroll. Get involved.', finalSub: 'Join Kezzo today and be part of the next moment.',
    videoTitle: '',
    terms: 'Terms', privacy: 'Privacy', contact: 'Contact',
  },
  fr: {
    login: 'Se connecter', signup: 'S’inscrire', language: 'Langue',
    eyebrow: 'Battles en direct · Directs · Groupes',
    live: (n: number) => (n === 1 ? '1 battle en direct maintenant' : `${n} battles en direct maintenant`),
    h1a: 'Découvrez le monde', h1b: 'à travers ses gens.',
    lead: 'Montrez au monde ce qui rend votre culture unique. Partagez vos traditions, célébrez votre héritage, échangez des histoires et découvrez la musique, la cuisine, les langues et les modes de vie du monde entier.',
    leadTag: 'Partagez votre culture. Découvrez le monde.',
    talent: 'Avez-vous du talent? Partagez-le avec le monde pour qu’il soit vu.',
    cta: 'Créer mon compte gratuit', ctaNote: 'Gratuit · 16 ans et plus · Moins d’une minute',
    media: { kicker: 'De la communauté', title: 'Découvrez ce que les gens partagent', note: 'Ça vous plaît? Connectez-vous pour en voir plus ou ajouter le vôtre.', cta: 'Se connecter pour commenter', like: 'J’aime', comments: 'Commentaires' },
    lines: ['Ne faites pas que regarder. Faites-en partie.', 'Vos gens. Vos moments. Votre scène.'],
    pillars: [
      ['02 · Participation sociale', 'Ne faites pas que défiler. Participez.', 'Joignez des conversations, réagissez aux moments en direct, rencontrez de nouvelles personnes et faites partie d’expériences qui rassemblent les communautés.'],
      ['03 · Échange culturel', 'Votre culture. Vos histoires. Votre monde.', 'Montrez au monde ce qui rend votre culture unique. Partagez vos traditions, célébrez votre héritage, échangez des histoires et découvrez la musique, la cuisine, les langues et les modes de vie du monde entier.'],
      ['04 · Compétitions en direct', 'Apportez votre talent. Relevez le défi.', 'Participez à des compétitions en direct, défiez des créateurs, mettez vos talents en valeur et mobilisez votre communauté. Entrez dans l’action et voyez ce qui arrive quand le talent rencontre la compétition amicale.'],
      ['05 · Événements en direct', 'Soyez là quand ça se passe.', 'Découvrez des événements en direct, vivez des expériences partagées, rencontrez des gens qui partagent vos intérêts et faites partie des moments dont tout le monde parle.'],
      ['06 · Communauté et connexion', 'Plus qu’un fil. Toute une expérience.', 'Des découvertes culturelles aux compétitions en direct et aux événements communautaires, trouvez de nouvelles façons de vous exprimer, de vous connecter aux autres et de donner du sens à chaque interaction.'],
    ],
    liveKicker: 'Trois façons d’être en direct', liveTitle: 'En direct ensemble, pas seulement seul',
    liveText: 'Les diffusions solo, les directs de groupe et les battles sont des expériences différentes, et Kezzo les traite ainsi. Faites monter vos amis ou d’autres créateurs à l’écran et échangez avec votre public en temps réel.',
    modes: [
      ['Diffusion solo', 'Passez en direct seul, avec clavardage en direct. Aucun battle nécessaire.'],
      ['Direct de groupe', 'Invitez des personnes à l’écran. Les spectateurs demandent à monter, vous choisissez qui vient.'],
      ['Battle', 'Créateur contre créateur, avec un tableau des scores en direct et les votes de la foule.'],
    ],
    feedKicker: 'Plus que des J’aime', feedTitle: 'Un fil qui mène à la participation',
    feedText: 'Les vidéos, l’audio, les photos et les publications servent à lancer quelque chose. Réagissez, commentez, abonnez-vous, joignez un groupe et entrez dans les moments en direct autour de vous.',
    feedNow: 'Disponible maintenant', feedNowItems: ['Publications vidéo, audio, photo et texte', 'J’aime, commentaires et abonnements', 'Groupes, messages et appels', 'Statuts de 24 heures'],
    feedSoon: 'Bientôt', feedSoonItems: ['Sondages', 'Questions du public', 'Défis', 'Suggestions pour créateurs'],
    groupsKicker: 'Communautés', groupsTitle: 'Des groupes à rejoindre', groupsText: 'Des groupes ouverts de la communauté Kezzo. Inscrivez-vous ou connectez-vous pour les rejoindre.',
    example: 'Exemple', exGroups: [['Podcast et discussions', 'Voix, entrevues et questions en direct', 2415], ['Coin des créateurs', 'Partagez votre installation et vos astuces', 1248], ['Amis et plaisir', 'Des défis entre amis', 862]],
    groupMembers: (n: number) => (n === 1 ? '1 membre' : `${n} membres`), groupJoin: 'S’inscrire pour rejoindre',
    cats: { dance: 'Équipe de danse', roasting: 'Roasting', singing: 'Chant', debate: 'Débat', comedy: 'Humour', other: 'Communauté' } as Record<string, string>,
    members: 'Kezzo est réservé aux membres. Inscrivez-vous ou connectez-vous pour voir le fil, les vidéos, les directs, les battles et les profils.',
    finalTitle: 'Ne faites pas que défiler. Participez.', finalSub: 'Joignez Kezzo aujourd’hui et faites partie du prochain moment.',
    videoTitle: '',
    terms: 'Conditions', privacy: 'Confidentialité', contact: 'Contact',
  },
  es: {
    login: 'Iniciar sesión', signup: 'Registrarse', language: 'Idioma',
    eyebrow: 'Batallas en vivo · Transmisiones en vivo · Grupos',
    live: (n: number) => (n === 1 ? '1 batalla en vivo ahora mismo' : `${n} batallas en vivo ahora mismo`),
    h1a: 'Conoce el mundo', h1b: 'a través de su gente.',
    lead: 'Muestra al mundo lo que hace única a tu cultura. Comparte tus tradiciones, celebra tu herencia, intercambia historias y descubre la música, la comida, los idiomas y los estilos de vida de todo el mundo.',
    leadTag: 'Comparte tu cultura. Descubre el mundo.',
    talent: '¿Tienes algún talento? Compártelo con el mundo para que lo vean.',
    cta: 'Crea tu cuenta gratis', ctaNote: 'Gratis · 16+ · Menos de un minuto',
    media: { kicker: 'De la comunidad', title: 'Mira lo que comparte la gente', note: '¿Te gusta lo que ves? Inicia sesión para ver más o añadir el tuyo.', cta: 'Inicia sesión para comentar', like: 'Me gusta', comments: 'Comentarios' },
    lines: ['No te limites a mirar. Sé parte de ello.', 'Tu gente. Tus momentos. Tu escenario.'],
    pillars: [
      ['02 · Participación social', 'No te limites a desplazarte. Participa.', 'Únete a conversaciones, reacciona a los momentos en vivo, conoce gente nueva y forma parte de experiencias que unen a las comunidades.'],
      ['03 · Intercambio cultural', 'Tu cultura. Tus historias. Tu mundo.', 'Muestra al mundo lo que hace única a tu cultura. Comparte tus tradiciones, celebra tu herencia, intercambia historias y descubre la música, la comida, los idiomas y los estilos de vida de todo el mundo.'],
      ['04 · Competiciones en vivo', 'Trae tu talento. Acepta el reto.', 'Participa en competiciones en vivo, rétate con otros creadores, muestra tus habilidades y moviliza a tu comunidad. Entra en la acción y mira lo que pasa cuando el talento se encuentra con la competencia sana.'],
      ['05 · Eventos en vivo', 'Está ahí cuando suceda.', 'Descubre eventos en vivo, comparte experiencias, conoce gente con intereses parecidos y sé parte de los momentos de los que todos hablan.'],
      ['06 · Comunidad y conexión', 'Más que un feed. Toda una experiencia.', 'Desde descubrimientos culturales hasta competiciones en vivo y eventos comunitarios, encuentra nuevas formas de expresarte, conectar con los demás y dar valor a cada interacción.'],
    ],
    liveKicker: 'Tres formas de estar en vivo', liveTitle: 'En vivo juntos, no solo',
    liveText: 'Las transmisiones en solitario, los directos en grupo y las batallas son experiencias distintas, y Kezzo las trata así. Sube a tus amigos u otros creadores a la pantalla y conversa con tu audiencia mientras sucede.',
    modes: [
      ['Transmisión en solitario', 'Sal en vivo por tu cuenta, con chat en directo. No hace falta una batalla.'],
      ['Directo en grupo', 'Invita a otras personas a la pantalla. Los espectadores piden subir y tú decides quién entra.'],
      ['Batalla', 'Creador contra creador, con marcador en vivo y votos del público.'],
    ],
    feedKicker: 'Más que me gusta', feedTitle: 'Un feed que lleva a participar',
    feedText: 'Los vídeos, el audio, las fotos y las publicaciones sirven para empezar algo. Reacciona, comenta, sigue, únete a un grupo y súmate a los momentos en vivo a tu alrededor.',
    feedNow: 'Disponible ahora', feedNowItems: ['Publicaciones de vídeo, audio, foto y texto', 'Me gusta, comentarios y seguidores', 'Grupos, chats y llamadas', 'Estados de 24 horas'],
    feedSoon: 'Próximamente', feedSoonItems: ['Encuestas', 'Preguntas del público', 'Retos', 'Ideas para creadores'],
    groupsKicker: 'Comunidades', groupsTitle: 'Grupos a los que puedes unirte', groupsText: 'Grupos abiertos de la comunidad de Kezzo. Regístrate o inicia sesión para unirte.',
    example: 'Ejemplo', exGroups: [['Pódcast y charlas', 'Voces, entrevistas y preguntas en vivo', 2415], ['Rincón de creadores', 'Comparte tu equipo y tus trucos', 1248], ['Amigos y diversión', 'Retos con tu grupo', 862]],
    groupMembers: (n: number) => (n === 1 ? '1 miembro' : `${n} miembros`), groupJoin: 'Regístrate para unirte',
    cats: { dance: 'Crew de baile', roasting: 'Roast', singing: 'Canto', debate: 'Debate', comedy: 'Comedia', other: 'Comunidad' } as Record<string, string>,
    members: 'Kezzo es para miembros. Regístrate o inicia sesión para ver el feed, los vídeos, las transmisiones en vivo, las batallas y los perfiles.',
    finalTitle: 'No te limites a desplazarte. Participa.', finalSub: 'Únete hoy a Kezzo y sé parte del próximo momento.',
    videoTitle: '',
    terms: 'Términos', privacy: 'Privacidad', contact: 'Contacto',
  },
  pt: {
    login: 'Entrar', signup: 'Cadastrar-se', language: 'Idioma',
    eyebrow: 'Batalhas ao vivo · Transmissões ao vivo · Grupos',
    live: (n: number) => (n === 1 ? '1 batalha ao vivo agora' : `${n} batalhas ao vivo agora`),
    h1a: 'Conheça o mundo', h1b: 'por meio das pessoas.',
    lead: 'Mostre ao mundo o que torna a sua cultura única. Compartilhe suas tradições, celebre sua herança, troque histórias e descubra música, comida, idiomas e estilos de vida do mundo inteiro.',
    leadTag: 'Compartilhe sua cultura. Descubra o mundo.',
    talent: 'Você tem algum talento? Compartilhe com o mundo para que todos vejam.',
    cta: 'Crie sua conta grátis', ctaNote: 'Grátis · 16+ · Leva menos de um minuto',
    media: { kicker: 'Da comunidade', title: 'Veja o que as pessoas estão compartilhando', note: 'Gostou do que viu? Entre para ver mais ou adicionar o seu.', cta: 'Entre para comentar', like: 'Curtir', comments: 'Comentários' },
    lines: ['Não fique só assistindo. Faça parte.', 'Suas pessoas. Seus momentos. Seu palco.'],
    pillars: [
      ['02 · Participação social', 'Não fique só rolando a tela. Participe.', 'Entre em conversas, reaja a momentos ao vivo, conheça gente nova e faça parte de experiências que unem comunidades.'],
      ['03 · Intercâmbio cultural', 'Sua cultura. Suas histórias. Seu mundo.', 'Mostre ao mundo o que torna a sua cultura única. Compartilhe suas tradições, celebre sua herança, troque histórias e descubra música, comida, idiomas e estilos de vida do mundo inteiro.'],
      ['04 · Competições ao vivo', 'Traga seu talento. Aceite o desafio.', 'Participe de competições ao vivo, desafie criadores, mostre suas habilidades e mobilize sua comunidade. Entre em ação e veja o que acontece quando o talento encontra a competição amigável.'],
      ['05 · Eventos ao vivo', 'Esteja lá quando acontecer.', 'Descubra eventos ao vivo, viva experiências compartilhadas, conheça pessoas com interesses parecidos e faça parte dos momentos de que todo mundo está falando.'],
      ['06 · Comunidade e conexão', 'Mais que um feed. Uma experiência completa.', 'De descobertas culturais a competições ao vivo e eventos da comunidade, encontre novas formas de se expressar, se conectar com os outros e dar valor a cada interação.'],
    ],
    liveKicker: 'Três formas de estar ao vivo', liveTitle: 'Ao vivo juntos, não só sozinho',
    liveText: 'Transmissões solo, lives em grupo e batalhas são experiências diferentes, e o Kezzo trata cada uma assim. Leve amigos ou outros criadores para a tela e converse com seu público enquanto acontece.',
    modes: [
      ['Transmissão solo', 'Vá ao vivo sozinho, com chat ao vivo. Não precisa de batalha.'],
      ['Live em grupo', 'Convide pessoas para a tela. Os espectadores pedem para entrar e você decide quem sobe.'],
      ['Batalha', 'Criador contra criador, com placar ao vivo e votos da plateia.'],
    ],
    feedKicker: 'Mais que curtidas', feedTitle: 'Um feed que leva à participação',
    feedText: 'Vídeos, áudios, fotos e publicações estão aqui para começar algo. Reaja, comente, siga, entre em um grupo e mergulhe nos momentos ao vivo ao seu redor.',
    feedNow: 'Disponível agora', feedNowItems: ['Publicações de vídeo, áudio, foto e texto', 'Curtidas, comentários e seguidores', 'Grupos, chats e chamadas', 'Status de 24 horas'],
    feedSoon: 'Em breve', feedSoonItems: ['Enquetes', 'Perguntas da plateia', 'Desafios', 'Ideias para criadores'],
    groupsKicker: 'Comunidades', groupsTitle: 'Grupos em que você pode entrar', groupsText: 'Grupos abertos da comunidade Kezzo. Cadastre-se ou entre para participar.',
    example: 'Exemplo', exGroups: [['Podcast e bate-papo', 'Vozes, entrevistas e perguntas ao vivo', 2415], ['Cantinho dos criadores', 'Compartilhe seu equipamento e suas dicas', 1248], ['Amigos e diversão', 'Desafios com a sua turma', 862]],
    groupMembers: (n: number) => (n === 1 ? '1 membro' : `${n} membros`), groupJoin: 'Cadastre-se para entrar',
    cats: { dance: 'Crew de dança', roasting: 'Roast', singing: 'Canto', debate: 'Debate', comedy: 'Comédia', other: 'Comunidade' } as Record<string, string>,
    members: 'O Kezzo é para membros. Cadastre-se ou entre para ver o feed, os vídeos, as lives, as batalhas e os perfis.',
    finalTitle: 'Não fique só rolando a tela. Participe.', finalSub: 'Entre hoje no Kezzo e faça parte do próximo momento.',
    videoTitle: '',
    terms: 'Termos', privacy: 'Privacidade', contact: 'Contato',
  },
  hi: {
    login: 'लॉग इन', signup: 'साइन अप', language: 'भाषा',
    eyebrow: 'लाइव बैटल · लाइव स्ट्रीम · ग्रुप',
    live: (n: number) => (n === 1 ? 'अभी 1 बैटल लाइव है' : `अभी ${n} बैटल लाइव हैं`),
    h1a: 'दुनिया को जानिए', h1b: 'उसके लोगों के ज़रिए।',
    lead: 'दुनिया को दिखाइए कि आपकी संस्कृति को क्या खास बनाता है। अपनी परंपराएँ साझा करें, अपनी विरासत का जश्न मनाएँ, कहानियों का आदान-प्रदान करें, और दुनिया भर का संगीत, खान-पान, भाषाएँ और जीवनशैली जानें।',
    leadTag: 'अपनी संस्कृति साझा करें। दुनिया को जानें।',
    talent: 'क्या आपके पास कोई प्रतिभा है? उसे दुनिया के साथ साझा करें ताकि सब उसे देख सकें।',
    cta: 'अपना मुफ़्त खाता बनाएँ', ctaNote: 'जुड़ना मुफ़्त · 16+ · एक मिनट से भी कम',
    media: { kicker: 'समुदाय से', title: 'देखिए लोग क्या साझा कर रहे हैं', note: 'पसंद आया? और देखने या अपना जोड़ने के लिए लॉग इन करें।', cta: 'टिप्पणी के लिए लॉग इन करें', like: 'लाइक', comments: 'टिप्पणियाँ' },
    lines: ['सिर्फ़ देखिए मत। हिस्सा बनिए।', 'आपके अपने लोग। आपके पल। आपका मंच।'],
    pillars: [
      ['02 · सामाजिक भागीदारी', 'सिर्फ़ स्क्रॉल मत कीजिए। जुड़िए।', 'बातचीत में शामिल हों, लाइव पलों पर प्रतिक्रिया दें, नए लोगों से मिलें और ऐसे अनुभवों का हिस्सा बनें जो समुदायों को जोड़ते हैं।'],
      ['03 · सांस्कृतिक आदान-प्रदान', 'आपकी संस्कृति। आपकी कहानियाँ। आपकी दुनिया।', 'दुनिया को दिखाइए कि आपकी संस्कृति को क्या खास बनाता है। अपनी परंपराएँ साझा करें, अपनी विरासत का जश्न मनाएँ, कहानियों का आदान-प्रदान करें, और दुनिया भर का संगीत, खान-पान, भाषाएँ और जीवनशैली जानें।'],
      ['04 · लाइव प्रतियोगिताएँ', 'अपनी प्रतिभा लाइए। चुनौती स्वीकारिए।', 'लाइव प्रतियोगिताओं में हिस्सा लें, क्रिएटरों को चुनौती दें, अपना हुनर दिखाएँ और अपने समुदाय को साथ लाएँ। मैदान में उतरिए और देखिए कि जब प्रतिभा दोस्ताना मुकाबले से मिलती है तो क्या होता है।'],
      ['05 · लाइव इवेंट', 'जब कुछ हो रहा हो, तब वहाँ रहिए।', 'लाइव इवेंट खोजें, साझा अनुभवों में शामिल हों, एक जैसी रुचि वाले लोगों से मिलें और उन पलों का हिस्सा बनें जिनकी हर कोई बात कर रहा है।'],
      ['06 · समुदाय और जुड़ाव', 'सिर्फ़ एक फ़ीड नहीं। एक पूरा अनुभव।', 'सांस्कृतिक खोजों से लेकर लाइव प्रतियोगिताओं और सामुदायिक इवेंट तक, खुद को व्यक्त करने, दूसरों से जुड़ने और हर बातचीत को मायने देने के नए तरीके खोजें।'],
    ],
    liveKicker: 'लाइव होने के तीन तरीके', liveTitle: 'सिर्फ़ अकेले नहीं, साथ मिलकर लाइव',
    liveText: 'अकेले प्रसारण, ग्रुप लाइव स्ट्रीम और बैटल अलग-अलग अनुभव हैं, और Kezzo उन्हें वैसे ही संभालता है। दोस्तों या दूसरे क्रिएटरों को स्क्रीन पर बुलाएँ और अपने दर्शकों से उसी पल बात करें।',
    modes: [
      ['अकेले प्रसारण', 'लाइव चैट के साथ अकेले लाइव आएँ। बैटल की ज़रूरत नहीं।'],
      ['ग्रुप लाइव स्ट्रीम', 'मेहमानों को स्क्रीन पर बुलाएँ। दर्शक जुड़ने का अनुरोध करते हैं और कौन आएगा, यह आप तय करते हैं।'],
      ['बैटल', 'क्रिएटर बनाम क्रिएटर, लाइव स्कोरबोर्ड और भीड़ के वोटों के साथ।'],
    ],
    feedKicker: 'लाइक से कहीं ज़्यादा', feedTitle: 'एक फ़ीड जो भागीदारी तक ले जाए',
    feedText: 'वीडियो, ऑडियो, फ़ोटो और पोस्ट कुछ शुरू करने के लिए हैं। प्रतिक्रिया दें, टिप्पणी करें, फ़ॉलो करें, किसी ग्रुप से जुड़ें और अपने आस-पास के लाइव पलों में कूद पड़ें।',
    feedNow: 'अभी उपलब्ध', feedNowItems: ['वीडियो, ऑडियो, फ़ोटो और टेक्स्ट पोस्ट', 'लाइक, टिप्पणियाँ और फ़ॉलो', 'ग्रुप, चैट और कॉल', '24 घंटे के स्टेटस'],
    feedSoon: 'जल्द आ रहा है', feedSoonItems: ['पोल', 'दर्शकों के सवाल', 'चैलेंज', 'क्रिएटरों के लिए सुझाव'],
    groupsKicker: 'समुदाय', groupsTitle: 'ग्रुप जिनसे आप जुड़ सकते हैं', groupsText: 'Kezzo समुदाय के खुले ग्रुप। जुड़ने के लिए साइन अप या लॉग इन करें।',
    example: 'उदाहरण', exGroups: [['पॉडकास्ट और बातचीत', 'आवाज़ें, इंटरव्यू और लाइव सवाल-जवाब', 2415], ['क्रिएटर कॉर्नर', 'अपना सेटअप और सुझाव साझा करें', 1248], ['दोस्त और मस्ती', 'अपनी टोली के साथ चैलेंज', 862]],
    groupMembers: (n: number) => (n === 1 ? '1 सदस्य' : `${n} सदस्य`), groupJoin: 'जुड़ने के लिए साइन अप करें',
    cats: { dance: 'डांस क्रू', roasting: 'रोस्टिंग', singing: 'गायन', debate: 'बहस', comedy: 'कॉमेडी', other: 'समुदाय' } as Record<string, string>,
    members: 'Kezzo सदस्यों के लिए है। फ़ीड, वीडियो, लाइव स्ट्रीम, बैटल और प्रोफ़ाइल देखने के लिए साइन अप या लॉग इन करें।',
    finalTitle: 'सिर्फ़ स्क्रॉल मत कीजिए। जुड़िए।', finalSub: 'आज ही Kezzo से जुड़ें और अगले पल का हिस्सा बनें।',
    videoTitle: '',
    terms: 'नियम', privacy: 'गोपनीयता', contact: 'संपर्क',
  },
} as const;

const MODE_ICONS: LucideIcon[] = [Mic, Users, Swords];

interface LandingGroup { id: string; name: string; tagline: string; category: string; member_count: number }

const outline = 'btn border border-zinc-300 bg-white text-zinc-900 hover:bg-stone-100';

/** Slim top bar: logo on the left, language and the two account buttons on the right. */
function Header() {
  const { openAuth } = useAuth();
  const { lang } = useI18n();
  const { go } = useRouter();
  const c = COPY[lang];
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/85 text-zinc-900 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <a href="#/" onClick={(e) => { e.preventDefault(); go('search'); }} className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-zinc-900 sm:text-xl">
          <img src="/logo.svg" alt="" width="20" height="28" className="h-7 w-auto" decoding="async" />
          Kezzo
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <LanguageSwitch className={`${outline} btn-sm`} />
          <InstallButton compact className={`${outline} btn-sm max-md:hidden`} />
          <button type="button" className="btn btn-sm px-2.5 text-zinc-900 hover:bg-stone-100 sm:px-3" onClick={() => openAuth('signin')}>{c.login}</button>
          <button type="button" className="btn btn-sm btn-accent rounded-full px-4" onClick={() => openAuth('signup')}>{c.signup}</button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { lang, t } = useI18n();
  const { go } = useRouter();
  const { openAuth } = useAuth();
  const c = COPY[lang];
  return (
    <footer className="border-t border-stone-200 bg-stone-50 px-4 pb-8 pt-12 text-zinc-600 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="flex items-center gap-2 font-display text-xl font-bold text-zinc-900"><img src="/logo.svg" alt="" width="20" height="28" className="h-7 w-auto" decoding="async" />Kezzo</p>
          <p className="mt-3 text-sm leading-relaxed">{c.leadTag}</p>
        </div>
        <nav aria-label="Kezzo" className="flex flex-col items-start gap-2 text-sm">
          <button type="button" className="hover:text-zinc-900" onClick={() => openAuth('signup')}>{c.signup}</button>
          <button type="button" className="hover:text-zinc-900" onClick={() => openAuth('signin')}>{c.login}</button>
          <button type="button" className="hover:text-zinc-900" onClick={() => go('legal', 'terms')}>{c.terms}</button>
          <button type="button" className="hover:text-zinc-900" onClick={() => go('legal', 'privacy')}>{c.privacy}</button>
          <a className="hover:text-zinc-900" href="mailto:kezzo.app@gmail.com">{c.contact}</a>
        </nav>
        <div className="flex flex-col items-start gap-3">
          <InstallButton className={`${outline} px-4 py-2 text-sm font-semibold`} label={t('download_kezzo')} />
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl border-t border-stone-200 pt-5 text-xs text-zinc-500">© {new Date().getFullYear()} Kezzo, WeDIL Inc., Canada</p>
    </footer>
  );
}

/** Header and footer around a public page (the landing page, and the Terms and Privacy pages while signed out). */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="landing-copy flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Fades and lifts its content in once, when it scrolls into view. Always visible without scripts, with reduced motion, or on very old browsers. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'hidden' | 'shown'>('idle');
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setState('hidden');
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState('shown'); io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`${className} ${state === 'hidden' ? 'translate-y-5 opacity-0' : 'translate-y-0 opacity-100'} transition duration-700 ease-out`}>{children}</div>;
}

/** Small heading block used by most sections: tiny label, large title, optional paragraph. */
function SectionHead({ kicker, title, text, center = false }: { kicker?: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} max-w-2xl`}>
      {kicker && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{kicker}</p>}
      <h2 data-part="section-title" className="mt-2 font-display text-[1.9rem] font-extrabold leading-[1.1] tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">{title}</h2>
      {text && <p data-part="section-text" className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-lg">{text}</p>}
    </div>
  );
}

/** Tiny looping clip: shows a still picture, and only plays (muted) while on screen. Stays a still for reduced motion / Save-Data. */
function LoopVideo({ name, className }: { name: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
    if (nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? '') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setOk(true);
    const v = ref.current;
    if (!v || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) void v.play().catch(() => undefined); else v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return ok
    ? <video ref={ref} className={className} muted loop playsInline preload="none" poster={`/landing/${name}.jpg`} src={`/landing/${name}.mp4`} aria-hidden="true" />
    : <img src={`/landing/${name}.jpg`} alt="" className={className} loading="lazy" decoding="async" />;
}

export function Landing({ invite, gate = false }: { invite?: string; gate?: boolean }) {
  const { openAuth } = useAuth();
  const { lang, t } = useI18n();
  const c = useCopy(COPY[lang], lang);
  const site = useSiteContent();
  const ord = orderOf(site.order);
  const showOrig = useShowOriginal();
  const hasAuto = autoPaths(site, lang).some((p) => site.originals[p]);
  const at = (id: string) => ({ order: ord.indexOf(id) + 1 });
  useThemeScope('landing');
  const on = useSections('landing');
  const [groups, setGroups] = useState<LandingGroup[]>([]);
  const [liveBattles, setLiveBattles] = useState(0);

  // A group invite opened while signed out: remember it and ask the person to sign up. They join right after.
  useEffect(() => {
    if (!invite) return;
    try { localStorage.setItem(PENDING_JOIN, invite); } catch { /* private mode: the link still works once signed in */ }
    openAuth('signup');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

  // Someone opened a shared link without being signed in: ask them to log in or sign up to see it.
  useEffect(() => {
    if (!gate) return;
    openAuth(new URLSearchParams(window.location.search).get('auth') === 'signin' ? 'signin' : 'signup');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  useEffect(() => {
    document.title = 'Kezzo';
  }, [lang]);

  // Featured groups and a live counter. Nothing is shown if there is nothing to show (or if update-8.sql has not been run yet).
  useEffect(() => {
    let off = false;
    void (async () => {
      const [g, s] = await Promise.all([supabase.rpc('landing_groups'), supabase.rpc('landing_stats')]);
      if (off) return;
      if (!g.error && Array.isArray(g.data)) setGroups(g.data as LandingGroup[]);
      const stats = s.data as { live_battles?: number } | null;
      if (!s.error && stats?.live_battles) setLiveBattles(Number(stats.live_battles));
    })();
    return () => { off = true; };
  }, []);

  const joinGroup = (id: string) => {
    try { localStorage.setItem(PENDING_GROUP, id); } catch { /* ignore */ }
    openAuth('signup');
  };

  const wrap = 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8';
  const catNames = Object.values(c.cats);

  return (
    <PublicFrame>
      {/* Hero: one big photo, a short headline with the key line in colour, two buttons */}
      <section className="relative isolate overflow-hidden bg-zinc-900 text-white">
        {!site.hidden.includes('hero') && (
          <img
            src={site.images.hero ?? '/landing/hero-photo.jpg'}
            alt=""
            width="1400"
            height="905"
            className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_35%]"
            fetchPriority="high"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-950/70 via-zinc-950/45 to-zinc-950/80" aria-hidden="true" />
        <div className={`${wrap} flex min-h-[32rem] flex-col items-center justify-center py-16 text-center sm:min-h-[36rem] sm:py-20 lg:min-h-[41rem] lg:py-28`}>
          {liveBattles > 0 && (
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
              {c.live(liveBattles)}
            </span>
          )}
          <h1 data-part="hero-title" className="max-w-4xl font-display font-extrabold leading-[1.04] tracking-tight" style={{ fontSize: 'clamp(2.35rem, 7.4vw, 5rem)' }}>
            {c.h1a}<br /><span className="text-[color-mix(in_srgb,var(--color-accent),white_30%)]">{c.h1b}</span>
          </h1>
          <p data-part="hero-text" className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{c.leadTag}</p>
          <p data-part="hero-text" className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">{c.talent}</p>
          <div className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <button type="button" className="btn btn-accent justify-center rounded-full px-7 py-3 text-base font-semibold " onClick={() => openAuth('signup')}>
              {c.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <InstallButton className="btn justify-center rounded-full border border-white/40 bg-white/10 px-7 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/20" label={t('download_kezzo')} />
          </div>
          <p className="mt-3 text-xs text-white/60">{c.ctaNote}</p>
        </div>
      </section>

      {/* A slow ticker of the things you can do on Kezzo */}
      <div className="overflow-hidden border-b border-stone-200 bg-white py-4" aria-hidden="true">
        <div className="marquee-track flex w-max gap-10 whitespace-nowrap font-display text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-base">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 gap-10">
              {catNames.map((n) => <span key={`${k}-${n}`} className="flex items-center gap-10">{n}<span className="h-1.5 w-1.5 rounded-full bg-accent" /></span>)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
      {/* Two lines that sum Kezzo up */}
      {on('tagline') && (
      <section className="bg-white px-4 py-14 sm:px-6 sm:py-20" aria-label="Kezzo" style={at('tagline')}>
        <Reveal>
          <ul className="mx-auto grid max-w-4xl gap-4 text-center">
            {c.lines.map((line, i) => <li key={line} data-part="tagline" className={`font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl ${i === 1 ? 'text-accent' : 'text-zinc-900'}`}>{line}</li>)}
          </ul>
        </Reveal>
      </section>
      )}

      {/* Photos and videos from the community, random order, visible before sign-in (likes work for everyone, comments need an account) */}
      {on('contest') && <div style={at('contest')}><ContestSection onJoin={() => { window.location.hash = '/contest'; openAuth('signup'); }} /></div>}
      {on('media') && <div style={at('media')}><LandingMedia words={c.media} /></div>}
      {on('video') && site.video.url && (
        <section className="bg-black px-4 py-8 sm:py-12" style={at('video')}>
          <div className="mx-auto max-w-4xl">
            {c.videoTitle && <h2 className="mb-3 text-center text-xl font-bold text-white sm:text-2xl">{c.videoTitle}</h2>}
            <video className="w-full rounded-2xl" src={site.video.url} poster={site.video.poster} autoPlay muted loop controls playsInline preload="auto" />
          </div>
        </section>
      )}

      {/* Solo, group, battle: three big alternating blocks */}
      {on('modes') && (
      <section className="bg-stone-50 py-14 text-zinc-900 sm:py-20 lg:py-24" style={at('modes')}>
        <div className={wrap}>
          <Reveal><SectionHead kicker={c.liveKicker} title={c.liveTitle} text={c.liveText} center /></Reveal>
          <ul className="mt-12 space-y-14 sm:mt-16 sm:space-y-20">
            {c.modes.map(([title, text], i) => {
              const Icon = MODE_ICONS[i];
              return (
                <li key={title}>
                  <Reveal className="grid items-center gap-6 md:grid-cols-2 md:gap-12 lg:gap-16">
                    <div className={`overflow-hidden rounded-3xl bg-stone-200 shadow-sm ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                      <div className="aspect-[4/3] w-full">
                        {i < 2
                          ? <LoopVideo name={['clip-solo', 'clip-group'][i]} className="h-full w-full object-cover" />
                          : <img src="/landing/mode-battle.jpg" alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />}
                      </div>
                    </div>
                    <div>
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                      <h3 className="mt-4 font-display text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">{title}</h3>
                      <p className="mt-3 max-w-md text-base leading-relaxed text-zinc-600 sm:text-lg">{text}</p>
                      <button type="button" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline" onClick={() => openAuth('signup')}>
                        {c.signup}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      )}

      {/* Groups: real featured groups when a group admin chose to feature one, otherwise clearly labelled examples */}
      {on('groups') && (
      <section className="bg-white py-14 text-zinc-900 sm:py-20" style={at('groups')}>
        <div className={wrap}>
          <Reveal><SectionHead kicker={c.groupsKicker} title={c.groupsTitle} text={c.groupsText} /></Reveal>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.length > 0 ? groups.map((g) => (
              <li key={g.id} data-part="card" className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:shadow-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-zinc-900"><Users className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{g.name}</h3>
                  <p className="truncate text-xs text-zinc-500">{c.cats[g.category] ?? c.cats.other} · {c.groupMembers(g.member_count)}</p>
                </div>
                <button type="button" className={`${outline} btn-sm shrink-0 rounded-full`} onClick={() => joinGroup(g.id)}>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{c.groupJoin}
                </button>
              </li>
            )) : c.exGroups.map(([name, text, n], i) => (
              <li key={name} data-part="card" className="group relative isolate overflow-hidden rounded-3xl bg-zinc-900 text-white">
                <img src={['/landing/group-podcast.jpg', '/landing/group-creators.jpg', '/landing/group-friends.jpg'][i]} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-zinc-950/85 via-zinc-950/25 to-transparent" aria-hidden="true" />
                <div className="flex min-h-56 flex-col justify-between p-4 sm:min-h-64">
                  <span className="self-start rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">{c.example}</span>
                  <div>
                    <h3 className="font-display text-lg font-bold leading-tight">{name}</h3>
                    <p className="mt-0.5 text-sm text-white/80">{text}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white/80">{c.groupMembers(n as number)}</span>
                      <button type="button" className="btn btn-sm rounded-full bg-white text-zinc-900 hover:bg-stone-100" onClick={() => openAuth('signup')}>{c.groupJoin}</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {/* Five things Kezzo is about: a card grid (2 across on tablets, 6-column mosaic on laptops) */}
      {on('about') && (
      <section className="bg-stone-50 py-14 text-zinc-900 sm:py-20 lg:py-24" aria-label="Kezzo" style={at('about')}>
        <div className={wrap}>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {c.pillars.map(([kicker, title, text], i) => (
              <li key={kicker} className={`${i < 3 ? 'lg:col-span-2' : 'lg:col-span-3'} ${i === 4 ? 'md:col-span-2 lg:col-span-3' : ''}`}>
                <Reveal className="h-full">
                  <article data-part="card" className="flex h-full flex-col rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{kicker}</p>
                    <h3 className="mt-3 font-display text-xl font-extrabold leading-tight sm:text-2xl">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">{text}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {/* Participation: photo, text and what is available now / coming soon */}
      {on('join') && (
      <section className="bg-white py-14 text-zinc-900 sm:py-20 lg:py-24" style={at('join')}>
        <div className={`${wrap} grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
          <Reveal>
            <SectionHead kicker={c.feedKicker} title={c.feedTitle} text={c.feedText} />
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">{c.feedNow}</h3>
                <ul className="mt-3 space-y-2">
                  {c.feedNowItems.map((item) => <li key={item} className="flex gap-2 text-sm text-zinc-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{item}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">{c.feedSoon}</h3>
                <ul className="mt-3 space-y-2">
                  {c.feedSoonItems.map((item) => <li key={item} className="flex gap-2 text-sm text-zinc-500"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" aria-hidden="true" />{item}</li>)}
                </ul>
              </div>
            </div>
          </Reveal>
          {!site.hidden.includes('feed') && (
            <Reveal><img src={site.images.feed ?? '/landing/feed.jpg'} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-sm" loading="lazy" decoding="async" /></Reveal>
          )}
        </div>
      </section>
      )}

      {/* Final call to action: a plain band, no card, no glow */}
      {on('cta') && (
      <section className="bg-stone-50 px-4 py-16 text-center text-zinc-900 sm:px-6 sm:py-24" style={at('cta')}>
        <div className="mx-auto max-w-3xl">
          <h2 data-part="section-title" className="font-display font-extrabold leading-[1.1] tracking-tight" style={{ fontSize: 'clamp(2rem, 5.5vw, 3.5rem)' }}>{c.finalTitle}</h2>
          <p data-part="section-text" className="mx-auto mt-4 max-w-xl text-base text-zinc-600 sm:text-lg">{c.finalSub}</p>
          <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <button type="button" className="btn btn-accent justify-center rounded-full px-8 py-3 text-base font-semibold" onClick={() => openAuth('signup')}>{c.signup}</button>
            <button type="button" className={`${outline} justify-center rounded-full px-8 py-3 text-base font-semibold`} onClick={() => openAuth('signin')}>{c.login}</button>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-xs text-zinc-500">{c.members}</p>
        </div>
      </section>
      )}
      </div>
      {hasAuto && (
        <p className="bg-white px-4 py-2 text-center text-xs text-zinc-500">
          <button type="button" className="underline hover:text-zinc-900" onClick={() => setShowOriginal(!showOrig)}>{showOrig ? TR[lang].translated : TR[lang].original}</button>
        </p>
      )}
    </PublicFrame>
  );
}
