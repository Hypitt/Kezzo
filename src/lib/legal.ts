import type { Lang } from './types';

/** A paragraph, a bullet list (array of strings), or a table. */
export type LegalBlock = string | string[] | { head: string[]; rows: string[][] };
export interface LegalSection { h: string; body: LegalBlock[] }
export interface LegalDoc { title: string; updated: string; sections: LegalSection[] }

export const LEGAL: Record<Lang, { privacy: LegalDoc; terms: LegalDoc }> = {
  en: {
    terms: {
      title: 'Terms of Service',
      updated: 'Effective October 19, 2026',
      sections: [
        { h: '1. Introduction', body: [
          'Welcome to Kezzo. These Terms of Service (“Terms”) govern your access to and use of the Kezzo website, platform and related services (the “Platform”). Kezzo is a social and creator platform where you can discover and share videos, photos and audio, take part in live battles, host solo or group livestreams, join groups, chat and call other users, and publish video highlights.',
          'Kezzo is operated by WeDIL Inc., based in Montréal, Québec, Canada (“Kezzo”, “we”, “us”). Contact us at kezzo.app@gmail.com. By creating an account or using Kezzo, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Platform.',
        ] },
        { h: '2. Eligibility and accounts', body: [
          'You must be at least 16 years old to create an account. We may close accounts we believe belong to someone under 16. You can sign up with Google or with an email and password. You agree to:',
          [
            'give accurate registration information, and not impersonate another person or brand',
            'keep your login credentials secure and private',
            'hold only accounts our policies allow (no fake or duplicate accounts used to vote or manipulate)',
            'tell us at kezzo.app@gmail.com if you suspect unauthorized access',
            'take responsibility for activity on your account, subject to applicable law',
          ],
          'We may suspend or restrict accounts that break these Terms or create security risks.',
        ] },
        { h: '3. Your content', body: [
          'You may upload, publish, stream or share videos, audio, photos, status pictures, profile information, comments, messages, group files and other material (“User Content”). You keep ownership of it. You give Kezzo a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, process, display and distribute your User Content only as needed to operate, secure and improve the Platform, subject to your settings and applicable law.',
          'This licence does not transfer ownership to Kezzo. It ends when you delete the content or close your account, except where keeping it is needed for legal, security, fraud-prevention or dispute-resolution purposes. You must have the rights and permissions needed to upload, stream, record or share your content, including music, images and the faces or voices of other people.',
        ] },
        { h: '4. Live battles and livestreaming', body: [
          'Kezzo lets you take part in live battles, broadcast solo livestreams, host group livestreams, and interact through chat, votes and reactions.',
          [
            'The optional AI recap is written by an AI model. It may contain mistakes and does not decide the winner.',
            'Do not assume a livestream or battle is private or unrecorded unless Kezzo clearly says so.',
            'We may restrict or end streams that break these Terms, the law, or other users’ rights.',
          ],
        ] },
        { h: '5. Recordings and highlights', body: [
          'Where available, hosts may record their livestreams and battles, download those recordings, and create and post highlight clips of up to 90 seconds. Hosts must tell participants when they are recording and get any permission the law requires before recording or publishing other people’s voices, images or contributions. By staying in a room you know is being recorded, you agree to being recorded. Do not publish recordings or highlights that reveal private information, infringe someone’s rights, or break the rules in section 7.',
        ] },
        { h: '6. Virtual coins', body: [
          'Coins are virtual points used to vote, enter battles and unlock paid posts. Every account receives free voting coins each month; coins earned from battles or unlocks are reward coins.',
          [
            'Coins cannot be bought, sold, transferred outside Kezzo, or exchanged for money, goods or services. They have no cash value and are not your property.',
            'Unused coins may expire or reset. We may change how coins work, or correct, remove or reset balances to fix errors, prevent abuse or close an account.',
            'Unlocking a paid post gives you personal access to view it on Kezzo, not the right to download, share or resell it.',
          ],
        ] },
        { h: '7. Community rules', body: [
          'You must not use Kezzo to post, stream or share:',
          [
            'any sexual content, including nudity, sexually explicit or suggestive material, and anything sexual involving a person under 18',
            'any violent content, including real violence, gore, threats, or content that promotes or glorifies violence, self-harm or terrorism',
            'harassment, bullying, intimidation, doxxing, stalking, or hate against people based on protected characteristics',
            'unlawful, fraudulent or defamatory content, or another person’s private information without permission',
            'content that infringes copyright, trademarks or other rights',
            'recordings or screenshots of someone else’s private messages, group content or calls without their permission',
          ],
          'You also must not impersonate others, spam or scam, manipulate battles, votes, coins or engagement (for example with bots or multiple accounts), distribute malware, scrape, hack or overload the Platform, or evade account restrictions. Roasts and comedy battles must follow these rules: joke about the performance, not about someone’s race, religion, disability, gender or sexuality.',
        ] },
        { h: '8. Moderation and enforcement', body: [
          'Use Report and Block when something is wrong. We may review reports, investigate, remove or restrict content, end livestreams, take back coins, and suspend or close accounts that break these Terms, with or without notice where the law allows. We do not review all content and cannot promise every violation will be caught. To ask us to review a moderation decision, write to kezzo.app@gmail.com.',
        ] },
        { h: '9. Copyright complaints', body: [
          'If you believe content on Kezzo infringes your copyright, email kezzo.app@gmail.com with the content’s link, the work you own and your contact details. We will forward notices to the poster as Canada’s notice-and-notice rules require and remove infringing content where appropriate. Repeat infringers lose their accounts.',
        ] },
        { h: '10. Kezzo’s intellectual property', body: [
          'The Kezzo name, branding, design, software and other Platform materials belong to WeDIL Inc. or its licensors, except User Content and third-party material. Do not copy, modify, distribute, reverse-engineer or commercially use them without our permission, except as the law allows.',
        ] },
        { h: '11. Third-party services', body: [
          'Kezzo relies on our third-party providers for sign-in, hosting, storage, livestreaming, email delivery and AI features. Their own terms and privacy policies may also apply. We are not responsible for their outages or changes beyond what the law requires.',
        ] },
        { h: '12. Availability and changes', body: [
          'We may update, change, suspend or discontinue features. We do not guarantee uninterrupted or error-free service, or that content, streams or recordings will always be available; keep your own copies of anything important. If we make significant changes to these Terms, we will notify you in the app at least 15 days before they take effect. If you keep using Kezzo after that, the new Terms apply.',
        ] },
        { h: '13. Disclaimers and liability', body: [
          'Kezzo is provided “as is” and “as available”. To the extent the law allows, WeDIL Inc. is not liable for indirect or consequential losses, lost data, or content posted by other users, and because Kezzo is free, our total liability to you is limited to CAD $100. Nothing in these Terms removes rights you have under Québec’s Consumer Protection Act or other law that cannot be waived.',
        ] },
        { h: '14. Suspension and account deletion', body: [
          'You can stop using Kezzo and delete your account at any time with the Delete account button at the bottom of your profile page, or by emailing kezzo.app@gmail.com. Deleting your account removes your profile, content, messages and coins and cannot be undone. We may suspend or end your access for breaking these Terms or for other legitimate reasons, subject to the law. Some information may be kept after deletion where the law requires it or for security, fraud prevention or disputes.',
        ] },
        { h: '15. Governing law', body: [
          'These Terms are governed by the laws of Québec and the federal laws of Canada that apply there. Disputes go to the courts of the district of Montréal, unless your local consumer law lets you sue where you live.',
        ] },
        { h: '16. Language', body: [
          'These Terms are available in English and French. The parties have required that these Terms be drawn up in English and French. Les parties ont exigé que les présentes conditions soient rédigées en anglais et en français.',
        ] },
        { h: '17. Contact', body: ['WeDIL Inc., Montréal, Québec — kezzo.app@gmail.com'] },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      updated: 'Effective October 19, 2026 · Last updated October 20, 2026',
      sections: [
        { h: '1. Introduction and who is responsible', body: [
          'Kezzo respects your privacy. This Policy explains how we collect, use, share, keep and protect personal information when you use Kezzo, including sign-up, feeds, posts, live battles, solo and group livestreams, recordings, highlights, groups, chat and calls. Kezzo is operated by WeDIL Inc., Montréal, Québec, which is responsible for your personal information. Under Québec law, the person with the highest authority at WeDIL Inc. is in charge of protecting personal information; reach them at kezzo.app@gmail.com. We follow Québec’s Act respecting the protection of personal information in the private sector (Law 25) and Canada’s PIPEDA.',
        ] },
        { h: '2. What we collect', body: [
          'What we collect depends on the features you use.',
          { head: ['Category', 'What', 'Where it comes from'], rows: [
            ['Account', 'Email address, password (stored encrypted), or your Google name, email and profile picture', 'You, or Google when you sign in with Google'],
            ['Profile', 'Handle, display name, bio, avatar, 16+ confirmation, language, message settings', 'You'],
            ['Your content', 'Posts (text, photo, audio, video), comments, likes, status pictures, livestreams, recordings and highlights you post, group files', 'You'],
            ['Messages', 'Direct messages, group chat, battle and stream chat, files shared in chats. When someone messages you, we may send you a short email saying who wrote (never the message text), at most once every 30 minutes per sender; you can turn this off in Settings', 'You'],
            ['Social activity', 'Follows, blocks, groups and roles, battles joined, votes, judge scores, reports you file, and the in-app notifications about activity involving you (message senders, likes, new followers, live sessions). Notifications never contain message text and are cleared automatically after about 60 days', 'Your use of Kezzo'],
            ['Coins', 'Balance, monthly grants, votes cast, unlocks, battle payouts', 'Your use of Kezzo'],
            ['Technical', 'IP address, browser and device type, diagnostic and error logs, login times, security events', 'Your browser, via our third-party providers'],
            ['Usage statistics', 'A random visitor ID, pages viewed (without the ids in the address), visit time, referring site, country, device, browser and language, page load time, sign-in events and a few error messages. If you are signed in, your account ID is attached so we can count active members. Your IP address and full browser string are not saved.', 'Your browser, only if “Do Not Track” and “Global Privacy Control” are off'],
          ] },
        ] },
        { h: '3. Camera, microphone, livestreams and recordings', body: [
          'Your browser asks permission before Kezzo uses your camera or microphone, only when you go live or join a battle, stream or call. Audio and video travel in real time through our third-party providers to the people in that room. Kezzo does not record rooms on its servers. A host can record a battle or stream in their own browser, download it, and post highlight clips of up to 90 seconds; hosts must tell participants when they are recording. A clip the host posts becomes their post and follows this Policy and our Terms.',
        ] },
        { h: '4. How we use it', body: [
          'To create and secure your account; deliver feeds, battles, livestreams, groups, chat and calls; store and show your content and authorized recordings; enable clipping and publishing; calculate scores and coin balances; detect spam, fraud and abuse and enforce our Terms; fix technical problems; answer support requests; and meet legal obligations. We will not use your information for a new purpose without telling you and getting consent where the law requires. We do not sell your personal information and do not use it for ads or marketing profiles.',
        ] },
        { h: '5. Who can see what', body: [[
          'Public: your profile, handle, avatar, posts, comments, likes, follows, status, livestreams, highlights, battles and results',
          'Signed-in users: battle and stream chat',
          'Group members: group chat, files and calls in that group',
          'Only the people in the conversation: direct messages and 1:1 calls',
          'Owner and buyers only: paid media files',
        ], 'Viewers can copy, screenshot or record what they see. Deleting content from Kezzo cannot remove copies other people already saved, so think before you share personal or confidential information.'] },
        { h: '6. Who we share it with', body: [
          'We share information only with: our third-party providers, who run Kezzo for us and may not use it for their own purposes; other users, for what you choose to share; authorities, when the law or a valid legal process requires it; and others when needed to protect someone’s safety, investigate fraud or enforce our Terms. If Kezzo is transferred to a new operator, they must keep this Policy.',
        ] },
        { h: '7. Data stored outside Québec', body: [
          'Our providers store and process data outside Québec, including in the United States. Before using them we assessed that your information stays adequately protected. Data held abroad may be accessible to authorities there under local law.',
        ] },
        { h: '8. Cookies and browser storage', body: [
          'Kezzo uses only essential browser storage (local storage and similar) to keep you signed in, protect your account, remember your language and settings, and hold recordings a host has not posted yet. We do not use advertising or cross-site tracking cookies. For our own anonymous usage statistics (how many people visit, which pages are used, how fast Kezzo loads), we keep a random visitor ID in your browser’s local storage and a visit ID in session storage. They contain no personal information, are used only by Kezzo, and are never shared with advertisers. If your browser sends “Do Not Track” or “Global Privacy Control”, Kezzo sends no usage statistics at all, and you can also clear your browser storage at any time. Usage statistics are kept for up to 13 months and are visible only to Kezzo administrators. If we ever add advertising, we will update this Policy and ask for your consent where required.',
        ] },
        { h: '9. How long we keep it', body: [
          'We keep your information while your account is open. When you delete a post, message or your account, it is removed from Kezzo right away and erased from backups within 30 days. We keep reports and records of rule violations for up to 1 year to prevent repeat abuse, and server logs for up to 90 days, unless the law requires longer.',
        ] },
        { h: '10. Security', body: [
          'We use encrypted connections (HTTPS), row-level security on every database table, server-only secret keys, and private storage for paid media. No system is perfectly secure. If a breach creates a risk of serious harm, we will notify you and the Commission d’accès à l’information as the law requires.',
        ] },
        { h: '11. Your rights', body: [
          'You can view and edit your profile, delete your content, control who can message you, block people, and delete your account with the Delete account button at the bottom of your profile page. You can also ask us at kezzo.app@gmail.com to:',
          [
            'access the information we hold about you and learn how it is used and shared',
            'get a copy in a structured, commonly used format',
            'correct inaccurate information',
            'delete your information, subject to legal exceptions',
            'withdraw consent, or object to or restrict certain uses',
          ],
          'We may need to verify your identity, and we answer within 30 days.',
        ] },
        { h: '12. Account deletion', body: [
          'Delete your account with the Delete account button at the bottom of your profile page (a typed confirmation is required) or by emailing kezzo.app@gmail.com. Your profile, content, messages and coins are removed, and backup copies are erased within the period in section 9. Some records may be kept where the law requires it or for security, fraud prevention or disputes. Content other users already downloaded or shared cannot be removed from their devices.',
        ] },
        { h: '13. Age', body: [
          'Kezzo is for people 16 and over, and sign-up asks you to confirm your age. We do not knowingly collect information from anyone younger. If you think a child under 16 has an account, email kezzo.app@gmail.com and we will delete it.',
        ] },
        { h: '14. Changes', body: [
          'We may update this Policy as Kezzo or the law changes. We will change the date above and notify you in the app before significant changes take effect, and ask for consent where required.',
        ] },
        { h: '15. Contact', body: ['Privacy questions, access or deletion requests, or complaints: WeDIL Inc., Montréal, Québec — kezzo.app@gmail.com'] },
      ],
    },
  },
  fr: {
    terms: {
      title: 'Conditions d’utilisation',
      updated: 'En vigueur le 19 octobre 2026',
      sections: [
        { h: '1. Introduction', body: [
          'Bienvenue sur Kezzo. Les présentes conditions d’utilisation (les « Conditions ») régissent votre accès au site Web, à la plateforme et aux services connexes de Kezzo (la « Plateforme ») et leur utilisation. Kezzo est une plateforme sociale pour créateurs où vous pouvez découvrir et partager des vidéos, des photos et des fichiers audio, participer à des battles en direct, animer des diffusions en direct en solo ou en groupe, rejoindre des groupes, clavarder et appeler d’autres utilisateurs, et publier des faits saillants vidéo.',
          'Kezzo est exploitée par WeDIL Inc., établie à Montréal (Québec) Canada (« Kezzo », « nous »). Écrivez-nous à kezzo.app@gmail.com. En créant un compte ou en utilisant Kezzo, vous acceptez ces Conditions et notre Politique de confidentialité. Si vous n’êtes pas d’accord, n’utilisez pas la Plateforme.',
        ] },
        { h: '2. Admissibilité et comptes', body: [
          'Vous devez avoir au moins 16 ans pour créer un compte. Nous pouvons fermer les comptes qui, selon nous, appartiennent à une personne de moins de 16 ans. Vous pouvez vous inscrire avec Google ou avec un courriel et un mot de passe. Vous vous engagez à :',
          [
            'fournir des renseignements d’inscription exacts et ne pas vous faire passer pour une autre personne ou une autre marque',
            'garder vos identifiants de connexion sécurisés et confidentiels',
            'n’avoir que les comptes permis par nos politiques (aucun faux compte ni compte en double servant à voter ou à manipuler)',
            'nous écrire à kezzo.app@gmail.com si vous soupçonnez un accès non autorisé',
            'assumer la responsabilité de l’activité de votre compte, sous réserve de la loi applicable',
          ],
          'Nous pouvons suspendre ou restreindre les comptes qui enfreignent ces Conditions ou créent des risques de sécurité.',
        ] },
        { h: '3. Votre contenu', body: [
          'Vous pouvez téléverser, publier, diffuser ou partager des vidéos, des fichiers audio, des photos, des images de statut, des renseignements de profil, des commentaires, des messages, des fichiers de groupe et d’autres contenus (le « Contenu utilisateur »). Vous en demeurez propriétaire. Vous accordez à Kezzo une licence non exclusive, mondiale et gratuite pour héberger, stocker, reproduire, traiter, afficher et distribuer votre Contenu utilisateur uniquement dans la mesure nécessaire pour exploiter, sécuriser et améliorer la Plateforme, sous réserve de vos paramètres et de la loi applicable.',
          'Cette licence ne transfère pas la propriété à Kezzo. Elle prend fin lorsque vous supprimez le contenu ou fermez votre compte, sauf si sa conservation est nécessaire pour des raisons juridiques, de sécurité, de prévention de la fraude ou de règlement de différends. Vous devez détenir les droits et autorisations nécessaires pour téléverser, diffuser, enregistrer ou partager votre contenu, y compris la musique, les images ainsi que le visage ou la voix d’autres personnes.',
        ] },
        { h: '4. Battles en direct et diffusion en direct', body: [
          'Kezzo vous permet de participer à des battles en direct, de diffuser en solo, d’animer des diffusions de groupe et d’interagir par le clavardage, les votes et les réactions.',
          [
            'Le résumé IA facultatif est rédigé par un modèle d’intelligence artificielle. Il peut contenir des erreurs et ne désigne pas le gagnant.',
            'Ne présumez pas qu’une diffusion ou un battle est privé ou non enregistré, sauf si Kezzo l’indique clairement.',
            'Nous pouvons restreindre ou interrompre les diffusions qui enfreignent ces Conditions, la loi ou les droits d’autres utilisateurs.',
          ],
        ] },
        { h: '5. Enregistrements et faits saillants', body: [
          'Lorsque la fonction est offerte, les hôtes peuvent enregistrer leurs diffusions et leurs battles, télécharger ces enregistrements, et créer et publier des extraits de faits saillants d’au plus 90 secondes. Les hôtes doivent informer les participants lorsqu’ils enregistrent et obtenir toute autorisation exigée par la loi avant d’enregistrer ou de publier la voix, l’image ou les contributions d’autres personnes. En demeurant dans une salle dont vous savez qu’elle est enregistrée, vous acceptez d’être enregistré. Ne publiez pas d’enregistrements ni de faits saillants qui révèlent des renseignements privés, portent atteinte aux droits d’autrui ou enfreignent les règles de l’article 7.',
        ] },
        { h: '6. Pièces virtuelles', body: [
          'Les pièces sont des points virtuels servant à voter, à entrer dans des battles et à débloquer des publications payantes. Chaque compte reçoit chaque mois des pièces de vote gratuites; les pièces gagnées dans les battles ou par des déblocages sont des pièces de récompense.',
          [
            'Les pièces ne peuvent être ni achetées, ni vendues, ni transférées à l’extérieur de Kezzo, ni échangées contre de l’argent, des biens ou des services. Elles n’ont aucune valeur monétaire et ne vous appartiennent pas.',
            'Les pièces inutilisées peuvent expirer ou être réinitialisées. Nous pouvons modifier le fonctionnement des pièces, ou corriger, retirer ou réinitialiser des soldes pour réparer des erreurs, prévenir les abus ou fermer un compte.',
            'Débloquer une publication payante vous donne un accès personnel pour la consulter sur Kezzo, et non le droit de la télécharger, de la partager ou de la revendre.',
          ],
        ] },
        { h: '7. Règles de la communauté', body: [
          'Vous ne devez pas utiliser Kezzo pour publier, diffuser ou partager :',
          [
            'tout contenu sexuel, y compris la nudité, le matériel sexuellement explicite ou suggestif, et tout ce qui est sexuel et implique une personne de moins de 18 ans',
            'tout contenu violent, y compris la violence réelle, les scènes sanglantes, les menaces, ou le contenu qui fait la promotion ou l’apologie de la violence, de l’automutilation ou du terrorisme',
            'le harcèlement, l’intimidation, la divulgation de renseignements personnels, le traquage ou la haine envers des personnes en raison de caractéristiques protégées',
            'du contenu illégal, frauduleux ou diffamatoire, ou les renseignements privés d’une autre personne sans sa permission',
            'du contenu qui porte atteinte au droit d’auteur, aux marques de commerce ou à d’autres droits',
            'des enregistrements ou des captures d’écran des messages privés, du contenu de groupe ou des appels de quelqu’un d’autre sans sa permission',
          ],
          'Vous ne devez pas non plus usurper l’identité d’autrui, envoyer du pourriel ou faire des arnaques, manipuler les battles, les votes, les pièces ou l’engagement (par exemple avec des robots ou plusieurs comptes), distribuer des logiciels malveillants, extraire des données, pirater ou surcharger la Plateforme, ni contourner les restrictions de compte. Les roasts et les battles d’humour doivent respecter ces règles : moquez-vous de la prestation, pas de la race, de la religion, du handicap, du genre ou de la sexualité de quelqu’un.',
        ] },
        { h: '8. Modération et application', body: [
          'Utilisez Signaler et Bloquer en cas de problème. Nous pouvons examiner les signalements, enquêter, retirer ou restreindre du contenu, interrompre des diffusions, reprendre des pièces, et suspendre ou fermer les comptes qui enfreignent ces Conditions, avec ou sans préavis lorsque la loi le permet. Nous n’examinons pas tout le contenu et ne pouvons promettre que chaque infraction sera détectée. Pour demander la révision d’une décision de modération, écrivez à kezzo.app@gmail.com.',
        ] },
        { h: '9. Plaintes relatives au droit d’auteur', body: [
          'Si vous croyez qu’un contenu de Kezzo porte atteinte à votre droit d’auteur, écrivez à kezzo.app@gmail.com en indiquant le lien du contenu, l’œuvre dont vous êtes titulaire et vos coordonnées. Nous transmettrons les avis à la personne qui a publié, comme l’exige le régime canadien d’avis et avis, et retirerons le contenu contrefait s’il y a lieu. Les récidivistes perdent leur compte.',
        ] },
        { h: '10. Propriété intellectuelle de Kezzo', body: [
          'Le nom Kezzo, l’image de marque, le design, les logiciels et les autres éléments de la Plateforme appartiennent à WeDIL Inc. ou à ses concédants, à l’exception du Contenu utilisateur et du matériel de tiers. Ne les copiez pas, ne les modifiez pas, ne les distribuez pas, ne les désassemblez pas et ne les utilisez pas à des fins commerciales sans notre permission, sauf dans la mesure permise par la loi.',
        ] },
        { h: '11. Services de tiers', body: [
          'Kezzo s’appuie sur des fournisseurs tiers pour la connexion, l’hébergement, le stockage, la diffusion en direct, l’envoi de courriels et les fonctions d’IA. Leurs propres conditions et politiques de confidentialité peuvent aussi s’appliquer. Nous ne sommes pas responsables de leurs pannes ou de leurs changements au-delà de ce que la loi exige.',
        ] },
        { h: '12. Disponibilité et modifications', body: [
          'Nous pouvons mettre à jour, modifier, suspendre ou abandonner des fonctions. Nous ne garantissons pas un service ininterrompu ou sans erreur, ni que le contenu, les diffusions ou les enregistrements seront toujours disponibles; conservez vos propres copies de tout ce qui est important. Si nous apportons des modifications importantes à ces Conditions, nous vous en aviserons dans l’application au moins 15 jours avant leur entrée en vigueur. Si vous continuez à utiliser Kezzo par la suite, les nouvelles Conditions s’appliquent.',
        ] },
        { h: '13. Exclusions de garantie et responsabilité', body: [
          'Kezzo est fournie « telle quelle » et « selon la disponibilité ». Dans la mesure permise par la loi, WeDIL Inc. n’est pas responsable des pertes indirectes ou consécutives, des pertes de données ni du contenu publié par d’autres utilisateurs et, comme Kezzo est gratuite, notre responsabilité totale envers vous est limitée à 100 $ CA. Rien dans ces Conditions ne supprime les droits que vous confère la Loi sur la protection du consommateur du Québec ou toute autre loi à laquelle on ne peut renoncer.',
        ] },
        { h: '14. Suspension et suppression du compte', body: [
          'Vous pouvez cesser d’utiliser Kezzo et supprimer votre compte en tout temps avec le bouton Supprimer le compte au bas de votre page de profil, ou en écrivant à kezzo.app@gmail.com. La suppression de votre compte retire votre profil, votre contenu, vos messages et vos pièces, et est irréversible. Nous pouvons suspendre ou mettre fin à votre accès si vous enfreignez ces Conditions ou pour d’autres motifs légitimes, sous réserve de la loi. Certains renseignements peuvent être conservés après la suppression lorsque la loi l’exige ou pour la sécurité, la prévention de la fraude ou le règlement de différends.',
        ] },
        { h: '15. Droit applicable', body: [
          'Ces Conditions sont régies par les lois du Québec et les lois fédérales du Canada qui s’y appliquent. Les différends relèvent des tribunaux du district de Montréal, sauf si votre loi locale sur la protection du consommateur vous permet de poursuivre là où vous habitez.',
        ] },
        { h: '16. Langue', body: [
          'Ces Conditions sont offertes en anglais et en français. Les parties ont exigé que les présentes conditions soient rédigées en anglais et en français. The parties have required that these Terms be drawn up in English and French.',
        ] },
        { h: '17. Contact', body: ['WeDIL Inc., Montréal (Québec) — kezzo.app@gmail.com'] },
      ],
    },
    privacy: {
      title: 'Politique de confidentialité',
      updated: 'En vigueur le 19 octobre 2026 · Dernière mise à jour le 20 octobre 2026',
      sections: [
        { h: '1. Introduction et responsable', body: [
          'Kezzo respecte votre vie privée. La présente Politique explique comment nous recueillons, utilisons, communiquons, conservons et protégeons les renseignements personnels lorsque vous utilisez Kezzo, y compris l’inscription, les fils, les publications, les battles en direct, les diffusions en solo et en groupe, les enregistrements, les faits saillants, les groupes, le clavardage et les appels. Kezzo est exploitée par WeDIL Inc., Montréal (Québec), qui est responsable de vos renseignements personnels. En vertu du droit québécois, la personne ayant la plus haute autorité chez WeDIL Inc. veille à la protection des renseignements personnels; vous pouvez la joindre à kezzo.app@gmail.com. Nous respectons la Loi sur la protection des renseignements personnels dans le secteur privé du Québec (Loi 25) et la LPRPDE du Canada.',
        ] },
        { h: '2. Ce que nous recueillons', body: [
          'Ce que nous recueillons dépend des fonctions que vous utilisez.',
          { head: ['Catégorie', 'Quoi', 'Provenance'], rows: [
            ['Compte', 'Adresse courriel, mot de passe (stocké chiffré), ou votre nom, courriel et photo de profil Google', 'Vous, ou Google lorsque vous vous connectez avec Google'],
            ['Profil', 'Identifiant, nom affiché, bio, avatar, confirmation 16 ans et plus, langue, paramètres de messages', 'Vous'],
            ['Votre contenu', 'Publications (texte, photo, audio, vidéo), commentaires, mentions j’aime, images de statut, diffusions, enregistrements et faits saillants que vous publiez, fichiers de groupe', 'Vous'],
            ['Messages', 'Messages privés, clavardage de groupe, de battle et de diffusion, fichiers partagés dans les conversations. Lorsque quelqu’un vous écrit, nous pouvons vous envoyer un court courriel indiquant qui a écrit (jamais le texte du message), au plus une fois toutes les 30 minutes par expéditeur; vous pouvez le désactiver dans les paramètres', 'Vous'],
            ['Activité sociale', 'Abonnements, blocages, groupes et rôles, battles auxquels vous participez, votes, notes des juges, signalements que vous faites, et les notifications dans l’application sur l’activité qui vous concerne (auteurs de messages, J’aime, nouveaux abonnés, directs). Les notifications ne contiennent jamais le texte des messages et sont effacées automatiquement après environ 60 jours', 'Votre utilisation de Kezzo'],
            ['Pièces', 'Solde, attributions mensuelles, votes donnés, déblocages, gains de battles', 'Votre utilisation de Kezzo'],
            ['Technique', 'Adresse IP, type de navigateur et d’appareil, journaux de diagnostic et d’erreurs, heures de connexion, événements de sécurité', 'Votre navigateur, par l’intermédiaire de nos fournisseurs tiers'],
            ['Statistiques d’utilisation', 'Un identifiant de visiteur aléatoire, les pages consultées (sans les identifiants dans l’adresse), l’heure de la visite, le site de provenance, le pays, l’appareil, le navigateur et la langue, le temps de chargement, les événements de connexion et quelques messages d’erreur. Si vous êtes connecté, l’identifiant de votre compte y est associé pour compter les membres actifs. Votre adresse IP et la chaîne complète du navigateur ne sont pas enregistrées.', 'Votre navigateur, seulement si « Ne pas suivre » et « Global Privacy Control » sont désactivés'],
          ] },
        ] },
        { h: '3. Caméra, micro, diffusions et enregistrements', body: [
          'Votre navigateur demande votre autorisation avant que Kezzo utilise votre caméra ou votre micro, seulement lorsque vous passez en direct ou rejoignez un battle, une diffusion ou un appel. L’audio et la vidéo transitent en temps réel par nos fournisseurs tiers jusqu’aux personnes présentes dans la salle. Kezzo n’enregistre pas les salles sur ses serveurs. Un hôte peut enregistrer un battle ou une diffusion dans son propre navigateur, le télécharger et publier des extraits de faits saillants d’au plus 90 secondes; les hôtes doivent informer les participants lorsqu’ils enregistrent. Un extrait publié par l’hôte devient sa publication et est assujetti à la présente Politique et à nos Conditions.',
        ] },
        { h: '4. Comment nous l’utilisons', body: [
          'Pour créer et sécuriser votre compte; offrir les fils, battles, diffusions, groupes, clavardages et appels; stocker et afficher votre contenu et les enregistrements autorisés; permettre le découpage et la publication; calculer les scores et les soldes de pièces; détecter le pourriel, la fraude et les abus et appliquer nos Conditions; corriger les problèmes techniques; répondre aux demandes de soutien; et respecter nos obligations légales. Nous n’utiliserons pas vos renseignements à une nouvelle fin sans vous en informer et sans obtenir votre consentement lorsque la loi l’exige. Nous ne vendons pas vos renseignements personnels et ne les utilisons pas pour de la publicité ou des profils de marketing.',
        ] },
        { h: '5. Qui voit quoi', body: [[
          'Public : votre profil, identifiant, avatar, publications, commentaires, mentions j’aime, abonnements, statut, diffusions, faits saillants, battles et résultats',
          'Utilisateurs connectés : clavardage des battles et des diffusions',
          'Membres d’un groupe : clavardage, fichiers et appels de ce groupe',
          'Seulement les personnes de la conversation : messages privés et appels individuels',
          'Propriétaire et acheteurs seulement : fichiers médias payants',
        ], 'Les spectateurs peuvent copier, capturer ou enregistrer ce qu’ils voient. Supprimer du contenu de Kezzo ne retire pas les copies que d’autres personnes ont déjà sauvegardées; réfléchissez donc avant de partager des renseignements personnels ou confidentiels.'] },
        { h: '6. Avec qui nous les partageons', body: [
          'Nous ne partageons des renseignements qu’avec : nos fournisseurs tiers, qui font fonctionner Kezzo pour nous et ne peuvent pas les utiliser à leurs propres fins; les autres utilisateurs, pour ce que vous choisissez de partager; les autorités, lorsque la loi ou une procédure légale valide l’exige; et d’autres personnes lorsque c’est nécessaire pour protéger la sécurité de quelqu’un, enquêter sur une fraude ou faire respecter nos Conditions. Si Kezzo est transférée à un nouvel exploitant, celui-ci devra respecter la présente Politique.',
        ] },
        { h: '7. Données stockées à l’extérieur du Québec', body: [
          'Nos fournisseurs stockent et traitent des données à l’extérieur du Québec, notamment aux États-Unis. Avant de les utiliser, nous avons évalué que vos renseignements demeurent adéquatement protégés. Les données conservées à l’étranger peuvent être accessibles aux autorités de ces pays en vertu de leur droit local.',
        ] },
        { h: '8. Témoins et stockage du navigateur', body: [
          'Kezzo n’utilise que le stockage essentiel du navigateur (stockage local et équivalents) pour vous garder connecté, protéger votre compte, mémoriser votre langue et vos paramètres, et conserver les enregistrements qu’un hôte n’a pas encore publiés. Nous n’utilisons pas de témoins publicitaires ni de suivi intersites. Pour nos statistiques d’utilisation anonymes (nombre de visiteurs, pages utilisées, rapidité de Kezzo), nous conservons un identifiant de visiteur aléatoire dans le stockage local de votre navigateur et un identifiant de visite dans le stockage de session. Ils ne contiennent aucun renseignement personnel, ne servent qu’à Kezzo et ne sont jamais communiqués à des annonceurs. Si votre navigateur envoie « Ne pas suivre » ou « Global Privacy Control », Kezzo n’envoie aucune statistique d’utilisation, et vous pouvez aussi vider le stockage de votre navigateur en tout temps. Les statistiques d’utilisation sont conservées au plus 13 mois et ne sont visibles que des administrateurs de Kezzo. Si nous ajoutons un jour de la publicité, nous mettrons à jour la présente Politique et demanderons votre consentement lorsque requis.',
        ] },
        { h: '9. Durée de conservation', body: [
          'Nous conservons vos renseignements tant que votre compte est ouvert. Lorsque vous supprimez une publication, un message ou votre compte, l’élément est retiré de Kezzo immédiatement et effacé des sauvegardes dans un délai de 30 jours. Nous conservons les signalements et les registres d’infractions aux règles jusqu’à 1 an pour prévenir les abus répétés, et les journaux de serveur jusqu’à 90 jours, sauf si la loi exige une durée plus longue.',
        ] },
        { h: '10. Sécurité', body: [
          'Nous utilisons des connexions chiffrées (HTTPS), la sécurité au niveau des lignes sur chaque table de la base de données, des clés secrètes réservées au serveur et un stockage privé pour les médias payants. Aucun système n’est parfaitement sécurisé. Si une atteinte présente un risque de préjudice sérieux, nous vous en aviserons ainsi que la Commission d’accès à l’information, comme la loi l’exige.',
        ] },
        { h: '11. Vos droits', body: [
          'Vous pouvez consulter et modifier votre profil, supprimer votre contenu, choisir qui peut vous écrire, bloquer des personnes et supprimer votre compte avec le bouton Supprimer le compte au bas de votre page de profil. Vous pouvez aussi nous demander, à kezzo.app@gmail.com, de :',
          [
            'vous donner accès aux renseignements que nous détenons sur vous et vous expliquer comment ils sont utilisés et communiqués',
            'vous remettre une copie dans un format structuré et couramment utilisé',
            'corriger les renseignements inexacts',
            'supprimer vos renseignements, sous réserve des exceptions légales',
            'retirer votre consentement, ou vous opposer à certains usages ou les restreindre',
          ],
          'Nous pouvons devoir vérifier votre identité, et nous répondons dans un délai de 30 jours.',
        ] },
        { h: '12. Suppression du compte', body: [
          'Supprimez votre compte avec le bouton Supprimer le compte au bas de votre page de profil (une confirmation saisie au clavier est exigée) ou en écrivant à kezzo.app@gmail.com. Votre profil, votre contenu, vos messages et vos pièces sont retirés, et les copies de sauvegarde sont effacées dans le délai prévu à l’article 9. Certains registres peuvent être conservés lorsque la loi l’exige ou pour la sécurité, la prévention de la fraude ou le règlement de différends. Le contenu que d’autres utilisateurs ont déjà téléchargé ou partagé ne peut pas être retiré de leurs appareils.',
        ] },
        { h: '13. Âge', body: [
          'Kezzo s’adresse aux personnes de 16 ans et plus, et l’inscription vous demande de confirmer votre âge. Nous ne recueillons pas sciemment de renseignements auprès de personnes plus jeunes. Si vous croyez qu’un enfant de moins de 16 ans a un compte, écrivez à kezzo.app@gmail.com et nous le supprimerons.',
        ] },
        { h: '14. Modifications', body: [
          'Nous pouvons modifier la présente Politique à mesure que Kezzo ou la loi évolue. Nous changerons la date ci-dessus et vous aviserons dans l’application avant l’entrée en vigueur de modifications importantes, et demanderons votre consentement lorsque requis.',
        ] },
        { h: '15. Contact', body: ['Questions sur la vie privée, demandes d’accès ou de suppression, ou plaintes : WeDIL Inc., Montréal (Québec) — kezzo.app@gmail.com'] },
      ],
    },
  },
};
