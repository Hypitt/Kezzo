import type { Lang } from './types';

export interface LegalDoc { title: string; sections: { h: string; p: string }[] }

const contact = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || 'the contact address shown by the site operator';

export const LEGAL: Record<Lang, { privacy: LegalDoc; terms: LegalDoc; updated: string }> = {
  en: {
    updated: 'Template text. Have a lawyer review it before launch.',
    privacy: {
      title: 'Privacy Policy',
      sections: [
        { h: '1. What we collect', p: 'When you sign in with Google we receive your name, email address and profile picture through Supabase Authentication. You choose a handle and may add a bio and avatar. We store what you create: posts and uploaded media, comments, likes, follows, battle activity, chat messages, direct messages, reports you file and your virtual coin balance and history.' },
        { h: '2. Camera and microphone', p: 'Your browser asks for permission only when you turn on your camera or microphone in a live room. Audio and video are sent in real time through LiveKit to the other people in that room. We do not record live rooms. You can turn the devices off or leave the room at any time, which stops them.' },
        { h: '3. Who processes your data', p: 'Supabase (database, authentication and file storage), Vercel (hosting), LiveKit (real-time audio and video), Google (sign-in) and, if the host requests an AI recap, Google Gemini, which receives battle titles, vote totals and recent public chat text from that battle. We do not sell your data and we do not show ads.' },
        { h: '4. Who can see what', p: 'Profiles, posts, comments, likes, follows and battles are visible to anyone. Battle chat is visible to signed-in users. Squad chat is visible to squad members. Direct messages are visible only to the two people in the conversation. Paid media files are visible only to their owner and to users who unlocked them.' },
        { h: '5. Your rights', p: 'You can edit your profile, delete your posts and comments, and delete your whole account from your profile page. Deleting your account removes your profile, content, messages and wallet. You may also ask us to access or export your data. Contact: ' + contact + '.' },
        { h: '6. Minimum age', p: 'Kezzo is for people aged 16 and over. If you are younger, do not create an account.' },
      ],
    },
    terms: {
      title: 'Terms of Service',
      sections: [
        { h: '1. Using Kezzo', p: 'By creating an account you agree to these terms and confirm you are at least 16. You are responsible for what you post and for your account.' },
        { h: '2. Virtual coins', p: 'Coins are virtual points used to vote, enter battles and unlock media. They cannot be bought, sold, transferred or exchanged for money, and they have no cash value. Voting coins are granted monthly. Reward coins record what you earn in battles and from unlocks. We may adjust or reset balances to prevent abuse.' },
        { h: '3. Battles', p: 'The host runs a battle and can remove contenders. Prize pools are made of coins spent by participants and voters. When the host ends a battle, 20% of the pool goes to the host and 80% is shared among contenders in proportion to their votes. The AI recap is a summary of votes and chat; it does not decide the winner.' },
        { h: '4. Your content', p: 'You keep ownership of what you post, and you give Kezzo permission to host and show it. Only post content you have the right to share. Videos are limited to 90 seconds and files to 50 MB.' },
        { h: '5. Rules', p: 'No harassment, hate, threats, sexual content involving minors, non-consensual content, spam, or illegal content. Use Report and Block when you see a problem. We may remove content and suspend accounts that break these rules.' },
        { h: '6. Changes and contact', p: 'We may update these terms; continued use means you accept the update. Questions: ' + contact + '.' },
      ],
    },
  },
  fr: {
    updated: 'Texte modèle. Faites-le relire par un juriste avant le lancement.',
    privacy: {
      title: 'Politique de confidentialité',
      sections: [
        { h: '1. Ce que nous collectons', p: 'Quand vous vous connectez avec Google, nous recevons votre nom, votre adresse courriel et votre photo de profil via Supabase Authentication. Vous choisissez un identifiant et pouvez ajouter une bio et un avatar. Nous conservons ce que vous créez : publications et médias, commentaires, mentions j’aime, abonnements, activité de battles, messages de chat, messages privés, signalements et votre solde de pièces virtuelles avec son historique.' },
        { h: '2. Caméra et microphone', p: 'Votre navigateur demande l’autorisation seulement lorsque vous activez votre caméra ou votre micro dans une salle en direct. L’audio et la vidéo sont transmis en temps réel par LiveKit aux autres personnes de la salle. Nous n’enregistrons pas les salles en direct. Vous pouvez couper les appareils ou quitter la salle à tout moment, ce qui les arrête.' },
        { h: '3. Qui traite vos données', p: 'Supabase (base de données, authentification et stockage), Vercel (hébergement), LiveKit (audio et vidéo en temps réel), Google (connexion) et, si l’hôte demande un résumé IA, Google Gemini, qui reçoit le titre du battle, les totaux de votes et les derniers messages du chat public. Nous ne vendons pas vos données et n’affichons pas de publicité.' },
        { h: '4. Qui voit quoi', p: 'Les profils, publications, commentaires, mentions j’aime, abonnements et battles sont visibles par tous. Le chat des battles est visible par les utilisateurs connectés. Le chat d’une escouade est visible par ses membres. Les messages privés ne sont visibles que par les deux personnes. Les fichiers payants ne sont visibles que par leur propriétaire et par les utilisateurs qui les ont débloqués.' },
        { h: '5. Vos droits', p: 'Vous pouvez modifier votre profil, supprimer vos publications et commentaires, et supprimer votre compte depuis votre page de profil. La suppression retire votre profil, votre contenu, vos messages et votre portefeuille. Vous pouvez aussi demander l’accès à vos données ou leur exportation. Contact : ' + contact + '.' },
        { h: '6. Âge minimum', p: 'Kezzo s’adresse aux personnes de 16 ans et plus. Si vous êtes plus jeune, ne créez pas de compte.' },
      ],
    },
    terms: {
      title: 'Conditions d’utilisation',
      sections: [
        { h: '1. Utiliser Kezzo', p: 'En créant un compte, vous acceptez ces conditions et confirmez avoir au moins 16 ans. Vous êtes responsable de ce que vous publiez et de votre compte.' },
        { h: '2. Pièces virtuelles', p: 'Les pièces sont des points virtuels servant à voter, entrer dans des battles et débloquer des médias. Elles ne peuvent être ni achetées, ni vendues, ni transférées, ni échangées contre de l’argent, et n’ont aucune valeur monétaire. Les pièces de vote sont accordées chaque mois. Les pièces de récompense enregistrent vos gains en battles et par déblocages. Nous pouvons ajuster ou réinitialiser des soldes pour prévenir les abus.' },
        { h: '3. Battles', p: 'L’hôte dirige un battle et peut retirer des participants. Les cagnottes sont formées des pièces dépensées par les participants et les votants. Quand l’hôte termine un battle, 20 % de la cagnotte va à l’hôte et 80 % est partagé entre les participants selon leurs votes. Le résumé IA résume les votes et le chat; il ne décide pas du gagnant.' },
        { h: '4. Votre contenu', p: 'Vous restez propriétaire de ce que vous publiez et autorisez Kezzo à l’héberger et à l’afficher. Ne publiez que du contenu que vous avez le droit de partager. Les vidéos sont limitées à 90 secondes et les fichiers à 50 Mo.' },
        { h: '5. Règles', p: 'Aucun harcèlement, discours haineux, menace, contenu sexuel impliquant des mineurs, contenu non consenti, pourriel ni contenu illégal. Utilisez Signaler et Bloquer en cas de problème. Nous pouvons retirer du contenu et suspendre les comptes qui enfreignent ces règles.' },
        { h: '6. Modifications et contact', p: 'Nous pouvons modifier ces conditions; continuer à utiliser le service vaut acceptation. Questions : ' + contact + '.' },
      ],
    },
  },
};
