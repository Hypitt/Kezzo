import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Mic, Swords, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { PENDING_GROUP, PENDING_JOIN } from '../lib/invite';
import { InstallButton } from '../components/InstallButton';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ContestBanner } from '../components/ContestBanner';
import { LandingMedia } from '../components/LandingMedia';

/**
 * The public page every visitor sees first. Everything else in Kezzo needs an account.
 * Plain markup and CSS (no pictures, no scripts beyond two tiny read-only calls) so it opens fast on any connection.
 * Palette: white and warm stone surfaces, near-black text, one brand red used only for the main buttons and small accents.
 */

const COPY = {
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
    terms: 'नियम', privacy: 'गोपनीयता', contact: 'संपर्क',
  },
} as const;

const MODE_ICONS: LucideIcon[] = [Mic, Users, Swords];

interface LandingGroup { id: string; name: string; tagline: string; category: string; member_count: number }

const outline = 'btn border border-zinc-300 bg-white text-zinc-900 hover:bg-stone-100';

/** White top bar with the logo, language switch and the Log in / Sign up buttons. */
function Header() {
  const { openAuth } = useAuth();
  const { lang } = useI18n();
  const { go } = useRouter();
  const c = COPY[lang];
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 text-zinc-900 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#/" onClick={(e) => { e.preventDefault(); go('search'); }} className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-zinc-900">
          <img src="/logo.svg" alt="" width="20" height="28" className="h-7 w-auto" decoding="async" />
          Kezzo
        </a>
        <div className="flex items-center gap-2">
          <LanguageSwitch className={`${outline} btn-sm`} />
          <InstallButton compact className={`${outline} btn-sm`} />
          <button type="button" className={`${outline} btn-sm`} onClick={() => openAuth('signin')}>{c.login}</button>
          <button type="button" className="btn btn-sm btn-accent" onClick={() => openAuth('signup')}>{c.signup}</button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { lang } = useI18n();
  const { go } = useRouter();
  const c = COPY[lang];
  return (
    <footer className="border-t border-stone-200 bg-stone-50 px-4 py-8 text-center text-xs text-zinc-500">
      <div className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <button type="button" className="underline hover:text-zinc-900" onClick={() => go('legal', 'terms')}>{c.terms}</button>
        <button type="button" className="underline hover:text-zinc-900" onClick={() => go('legal', 'privacy')}>{c.privacy}</button>
        <a className="underline hover:text-zinc-900" href="mailto:kezzo.app@gmail.com">{c.contact}</a>
      </div>
      <p>© {new Date().getFullYear()} WeDIL Inc., Montréal, Québec</p>
    </footer>
  );
}

/** Header and footer around a public page (the landing page, and the Terms and Privacy pages while signed out). */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
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

export function Landing({ invite }: { invite?: string }) {
  const { openAuth } = useAuth();
  const { lang, t } = useI18n();
  const c = COPY[lang];
  const [groups, setGroups] = useState<LandingGroup[]>([]);
  const [liveBattles, setLiveBattles] = useState(0);

  // A group invite opened while signed out: remember it and ask the person to sign up. They join right after.
  useEffect(() => {
    if (!invite) return;
    try { localStorage.setItem(PENDING_JOIN, invite); } catch { /* private mode: the link still works once signed in */ }
    openAuth('signup');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

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

  return (
    <PublicFrame>
      {/* Hero: warm light card with a group photo that fades into it */}
      <section className="bg-white px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff8f4] via-[#fdeee6] to-[#f8d9cb] text-zinc-900">
          <div className="relative grid gap-0 lg:grid-cols-[1fr_1.15fr]">
            <div className="px-4 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-7 lg:self-center">
              {liveBattles > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-800 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {c.live(liveBattles)}
                </span>
              )}
              <h1 className="mt-3 text-2xl font-bold leading-[1.1] text-zinc-900 sm:text-3xl">
                {c.h1a}<br /><span className="text-accent">{c.h1b}</span>
              </h1>
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-zinc-700 sm:text-sm">{c.lead}</p>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-snug text-zinc-900 sm:text-base">{c.leadTag}</p>
              <p className="mt-2 max-w-xl text-xs font-medium leading-snug text-black">{c.talent}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <InstallButton className="btn btn-accent px-4 py-2 text-sm" label={t('download_kezzo')} />
                <button type="button" className={`${outline} px-4 py-2 text-sm`} onClick={() => openAuth('signin')}>{c.login}</button>
              </div>
            </div>
            <div className="relative min-h-40 sm:min-h-52 lg:min-h-[17rem]">
              {/* the photo melts into the card: faded on its left edge (on phones: on its top edge) */}
              <img
                src="/landing/hero-photo.jpg"
                alt=""
                width="1400"
                height="905"
                className="absolute inset-0 h-full w-full object-cover object-[60%_35%] [mask-image:linear-gradient(to_right,transparent,black_32%)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_32%)] max-lg:[mask-image:linear-gradient(to_bottom,transparent,black_30%)] max-lg:[-webkit-mask-image:linear-gradient(to_bottom,transparent,black_30%)]"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Two lines that sum Kezzo up */}
      <section className="border-y border-stone-200 bg-stone-50 px-4 py-3" aria-label="Kezzo">
        <ul className="mx-auto grid max-w-3xl gap-x-6 gap-y-2 text-center sm:grid-cols-2">
          {c.lines.map((line) => <li key={line} className="font-display text-sm font-semibold leading-snug text-zinc-900 sm:text-base">{line}</li>)}
        </ul>
      </section>

      {/* Photos and videos from the community, random order, visible before sign-in (likes work for everyone, comments need an account) */}
      <div className="mx-auto w-full max-w-4xl px-3 pt-4 sm:px-4"><ContestBanner onOpen={() => { window.location.hash = '/contest'; openAuth('signup'); }} /></div>
      <LandingMedia words={c.media} />

      {/* Groups: real featured groups when a group admin chose to feature one, otherwise clearly labelled examples */}
      <section className="bg-white px-4 py-6 text-zinc-900">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{c.groupsKicker}</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{c.groupsTitle}</h2>
          <p className="mt-1 text-sm text-zinc-600">{c.groupsText}</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.length > 0 ? groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-zinc-900"><Users className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{g.name}</h3>
                  <p className="truncate text-xs text-zinc-500">{c.cats[g.category] ?? c.cats.other} · {c.groupMembers(g.member_count)}</p>
                </div>
                <button type="button" className={`${outline} btn-sm shrink-0`} onClick={() => joinGroup(g.id)}>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{c.groupJoin}
                </button>
              </li>
            )) : c.exGroups.map(([name, text, n], i) => (
              <li key={name} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="relative h-24">
                  <img src={['/landing/group-podcast.jpg', '/landing/group-creators.jpg', '/landing/group-friends.jpg'][i]} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">{c.example}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{name}</h3><p className="truncate text-xs text-zinc-500">{text}</p><p className="text-xs font-medium text-zinc-700">{c.groupMembers(n as number)}</p></div>
                  <button type="button" className={`${outline} btn-sm shrink-0`} onClick={() => openAuth('signup')}>{c.groupJoin}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Five things Kezzo is about */}
      <section className="bg-white px-4 py-10 text-zinc-900" aria-label="Kezzo">
        <ul className="mx-auto max-w-6xl divide-y divide-stone-200 border-y border-stone-200">
          {c.pillars.map(([kicker, title, text]) => (
            <li key={kicker} className="grid gap-2 py-6 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">{kicker}</p>
                <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{title}</h2>
              </div>
              <p className="leading-relaxed text-zinc-600 lg:pt-6">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Solo, group, battle */}
      <section className="bg-stone-50 px-4 py-12 text-zinc-900">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{c.liveKicker}</p>
            <h2 className="mt-2 text-3xl font-bold">{c.liveTitle}</h2>
            <p className="mt-3 leading-relaxed text-zinc-600">{c.liveText}</p>
          </div>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {c.modes.map(([title, text], i) => {
              const Icon = MODE_ICONS[i];
              return (
                <li key={title} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  {i < 2
                    ? <LoopVideo name={['clip-solo', 'clip-group'][i]} className="h-28 w-full object-cover" />
                    : <img src="/landing/mode-battle.jpg" alt="" className="h-28 w-full object-cover" loading="lazy" decoding="async" />}
                  <div className="p-4">
                    <h3 className="flex items-center gap-2 text-base font-semibold"><Icon className="h-4 w-4 text-accent" aria-hidden="true" />{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">{text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Participation */}
      <section className="bg-white px-4 py-12 text-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{c.feedKicker}</p>
            <h2 className="mt-2 text-3xl font-bold">{c.feedTitle}</h2>
            <p className="mt-3 leading-relaxed text-zinc-600">{c.feedText}</p>
          </div>
          <img src="/landing/feed.jpg" alt="" className="h-56 w-full rounded-xl object-cover sm:h-64" loading="lazy" decoding="async" />
        </div>
      </section>

      {/* Final call to action */}
      <section className="bg-zinc-900 px-4 py-16 text-center text-white">
        <h2 className="text-3xl font-bold sm:text-4xl">{c.finalTitle}</h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-300">{c.finalSub}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-accent px-6 py-3 text-base" onClick={() => openAuth('signup')}>{c.signup}</button>
          <button type="button" className="btn border border-zinc-500 bg-transparent px-6 py-3 text-base text-white hover:bg-zinc-800" onClick={() => openAuth('signin')}>{c.login}</button>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-xs text-zinc-400">{c.members}</p>
      </section>
    </PublicFrame>
  );
}
