import type { Lang } from './types';

/** Words for the Premium savings-group tools, in the five Kezzo languages. */
export interface VslaPremiumWords {
  roles: Record<string, string>; roleLabel: string; roleHelp: string;
  payT: string; payNote: string; addT: string; method: string; accName: string; accNumber: string; instr: string; add: string; del: string; copy: string; copied: string; premiumNeeded: string;
  agentT: string; agentHelp: string; agentMember: string; agentShares: string; agentSocial: string; agentAmount: string; agentCount: string; agentNote: string; agentSend: string; agentSent: string;
  exportCsv: string; reportT: string; reportHelp: string; colGroup: string; colMembers: string; colShares: string; colSocial: string; colFines: string; colOut: string; colOwed: string; totalLabel: string;
  err: string; done: string; errors: Record<string, string>;
}
const EN: VslaPremiumWords = {
  roles: { admin: 'Treasurer', secretary: 'Secretary', agent: 'Field agent', member: 'Member' }, roleLabel: 'Role', roleHelp: 'Secretary and field agent are Premium roles.',
  payT: 'Pay the group', payNote: 'Pay the group’s account yourself, then send your contribution below. Kezzo does not hold this money: the treasurer confirms each payment.', addT: 'Group payment method', method: 'Method (e.g. Lumicash)', accName: 'Account name', accNumber: 'Number', instr: 'Instructions (optional)', add: 'Add', del: 'Delete', copy: 'Copy', copied: 'Copied.', premiumNeeded: 'Showing the group’s payment method needs Premium on the group owner’s account.',
  agentT: 'Send for a member', agentHelp: 'As field agent you send a contribution for a member. A treasurer approves it.', agentMember: 'Member', agentShares: 'Shares', agentSocial: 'Social fund', agentAmount: 'Amount', agentCount: 'Number of shares', agentNote: 'Note (optional)', agentSend: 'Send for approval', agentSent: 'Sent. A treasurer will approve it.',
  exportCsv: 'Export CSV', reportT: 'Reports across your groups', reportHelp: 'Totals for the groups you manage as treasurer, all cycles together.', colGroup: 'Group', colMembers: 'Members', colShares: 'Savings', colSocial: 'Social', colFines: 'Fines', colOut: 'Loaned', colOwed: 'Still owed', totalLabel: 'Total',
  err: 'Something went wrong. Please try again.', done: 'Done.', errors: { premium_required: 'This needs Premium on the group owner’s account.', plan_limit_group_methods: 'A group can show up to 3 payment methods.', no_cycle: 'There is no running cycle.', bad_shares: 'Check the number of shares.', bad_amount: 'Enter a valid amount.', too_many_pending: 'This member already has many contributions waiting.', last_admin: 'The group needs at least one treasurer.', guest_no_role: 'A guest without an account can only be a member.', not_admin: 'You are not allowed to do this.' },
};
const FR: VslaPremiumWords = {
  roles: { admin: 'Trésorier', secretary: 'Secrétaire', agent: 'Agent de terrain', member: 'Membre' }, roleLabel: 'Rôle', roleHelp: 'Secrétaire et agent de terrain sont des rôles Premium.',
  payT: 'Payer le groupe', payNote: 'Payez vous-même sur le compte du groupe, puis envoyez votre cotisation ci-dessous. Kezzo ne détient pas cet argent : le trésorier confirme chaque paiement.', addT: 'Moyen de paiement du groupe', method: 'Méthode (ex. Lumicash)', accName: 'Nom du compte', accNumber: 'Numéro', instr: 'Instructions (facultatif)', add: 'Ajouter', del: 'Supprimer', copy: 'Copier', copied: 'Copié.', premiumNeeded: 'Afficher le moyen de paiement du groupe demande Premium sur le compte du propriétaire du groupe.',
  agentT: 'Envoyer pour un membre', agentHelp: 'En tant qu’agent de terrain, vous envoyez une cotisation pour un membre. Un trésorier l’approuve.', agentMember: 'Membre', agentShares: 'Parts', agentSocial: 'Fonds social', agentAmount: 'Montant', agentCount: 'Nombre de parts', agentNote: 'Note (facultatif)', agentSend: 'Envoyer pour approbation', agentSent: 'Envoyé. Un trésorier l’approuvera.',
  exportCsv: 'Exporter en CSV', reportT: 'Rapports de vos groupes', reportHelp: 'Totaux des groupes que vous gérez comme trésorier, tous cycles confondus.', colGroup: 'Groupe', colMembers: 'Membres', colShares: 'Épargne', colSocial: 'Social', colFines: 'Amendes', colOut: 'Prêté', colOwed: 'Reste dû', totalLabel: 'Total',
  err: 'Une erreur est survenue. Réessayez.', done: 'Fait.', errors: { premium_required: 'Cela demande Premium sur le compte du propriétaire du groupe.', plan_limit_group_methods: 'Un groupe peut afficher jusqu’à 3 moyens de paiement.', no_cycle: 'Aucun cycle en cours.', bad_shares: 'Vérifiez le nombre de parts.', bad_amount: 'Entrez un montant valide.', too_many_pending: 'Ce membre a déjà beaucoup de cotisations en attente.', last_admin: 'Le groupe a besoin d’au moins un trésorier.', guest_no_role: 'Un invité sans compte ne peut être que membre.', not_admin: 'Vous n’avez pas le droit de faire cela.' },
};
const ES: VslaPremiumWords = {
  roles: { admin: 'Tesorero', secretary: 'Secretario', agent: 'Agente de campo', member: 'Miembro' }, roleLabel: 'Rol', roleHelp: 'Secretario y agente de campo son roles Premium.',
  payT: 'Pagar al grupo', payNote: 'Paga tú mismo a la cuenta del grupo y luego envía tu aporte abajo. Kezzo no retiene este dinero: el tesorero confirma cada pago.', addT: 'Método de pago del grupo', method: 'Método (p. ej. Lumicash)', accName: 'Nombre de la cuenta', accNumber: 'Número', instr: 'Instrucciones (opcional)', add: 'Añadir', del: 'Eliminar', copy: 'Copiar', copied: 'Copiado.', premiumNeeded: 'Mostrar el método de pago del grupo requiere Premium en la cuenta del dueño del grupo.',
  agentT: 'Enviar por un miembro', agentHelp: 'Como agente de campo envías un aporte por un miembro. Un tesorero lo aprueba.', agentMember: 'Miembro', agentShares: 'Acciones', agentSocial: 'Fondo social', agentAmount: 'Importe', agentCount: 'Número de acciones', agentNote: 'Nota (opcional)', agentSend: 'Enviar para aprobación', agentSent: 'Enviado. Un tesorero lo aprobará.',
  exportCsv: 'Exportar CSV', reportT: 'Informes de tus grupos', reportHelp: 'Totales de los grupos que gestionas como tesorero, todos los ciclos juntos.', colGroup: 'Grupo', colMembers: 'Miembros', colShares: 'Ahorro', colSocial: 'Social', colFines: 'Multas', colOut: 'Prestado', colOwed: 'Aún se debe', totalLabel: 'Total',
  err: 'Algo salió mal. Inténtalo de nuevo.', done: 'Listo.', errors: { premium_required: 'Esto requiere Premium en la cuenta del dueño del grupo.', plan_limit_group_methods: 'Un grupo puede mostrar hasta 3 métodos de pago.', no_cycle: 'No hay un ciclo en curso.', bad_shares: 'Revisa el número de acciones.', bad_amount: 'Introduce un importe válido.', too_many_pending: 'Este miembro ya tiene muchos aportes en espera.', last_admin: 'El grupo necesita al menos un tesorero.', guest_no_role: 'Un invitado sin cuenta solo puede ser miembro.', not_admin: 'No tienes permiso para hacer esto.' },
};
const PT: VslaPremiumWords = {
  roles: { admin: 'Tesoureiro', secretary: 'Secretário', agent: 'Agente de campo', member: 'Membro' }, roleLabel: 'Função', roleHelp: 'Secretário e agente de campo são funções Premium.',
  payT: 'Pagar ao grupo', payNote: 'Pague você mesmo na conta do grupo e depois envie sua contribuição abaixo. A Kezzo não retém este dinheiro: o tesoureiro confirma cada pagamento.', addT: 'Forma de pagamento do grupo', method: 'Método (ex.: Lumicash)', accName: 'Nome da conta', accNumber: 'Número', instr: 'Instruções (opcional)', add: 'Adicionar', del: 'Excluir', copy: 'Copiar', copied: 'Copiado.', premiumNeeded: 'Mostrar a forma de pagamento do grupo exige Premium na conta do dono do grupo.',
  agentT: 'Enviar por um membro', agentHelp: 'Como agente de campo você envia uma contribuição por um membro. Um tesoureiro aprova.', agentMember: 'Membro', agentShares: 'Cotas', agentSocial: 'Fundo social', agentAmount: 'Valor', agentCount: 'Número de cotas', agentNote: 'Nota (opcional)', agentSend: 'Enviar para aprovação', agentSent: 'Enviado. Um tesoureiro vai aprovar.',
  exportCsv: 'Exportar CSV', reportT: 'Relatórios dos seus grupos', reportHelp: 'Totais dos grupos que você gere como tesoureiro, todos os ciclos juntos.', colGroup: 'Grupo', colMembers: 'Membros', colShares: 'Poupança', colSocial: 'Social', colFines: 'Multas', colOut: 'Emprestado', colOwed: 'Ainda devido', totalLabel: 'Total',
  err: 'Algo deu errado. Tente de novo.', done: 'Pronto.', errors: { premium_required: 'Isto exige Premium na conta do dono do grupo.', plan_limit_group_methods: 'Um grupo pode mostrar até 3 formas de pagamento.', no_cycle: 'Não há ciclo em andamento.', bad_shares: 'Confira o número de cotas.', bad_amount: 'Informe um valor válido.', too_many_pending: 'Este membro já tem muitas contribuições em espera.', last_admin: 'O grupo precisa de pelo menos um tesoureiro.', guest_no_role: 'Um convidado sem conta só pode ser membro.', not_admin: 'Você não tem permissão para isso.' },
};
const HI: VslaPremiumWords = {
  roles: { admin: 'कोषाध्यक्ष', secretary: 'सचिव', agent: 'फ़ील्ड एजेंट', member: 'सदस्य' }, roleLabel: 'भूमिका', roleHelp: 'सचिव और फ़ील्ड एजेंट प्रीमियम भूमिकाएँ हैं।',
  payT: 'समूह को भुगतान करें', payNote: 'समूह के खाते में खुद भुगतान करें, फिर नीचे अपना योगदान भेजें। Kezzo यह पैसा नहीं रखता: कोषाध्यक्ष हर भुगतान की पुष्टि करता है।', addT: 'समूह का भुगतान तरीका', method: 'तरीका (जैसे Lumicash)', accName: 'खाते का नाम', accNumber: 'नंबर', instr: 'निर्देश (वैकल्पिक)', add: 'जोड़ें', del: 'हटाएँ', copy: 'कॉपी', copied: 'कॉपी हो गया।', premiumNeeded: 'समूह का भुगतान तरीका दिखाने के लिए समूह मालिक के खाते पर प्रीमियम चाहिए।',
  agentT: 'सदस्य के लिए भेजें', agentHelp: 'फ़ील्ड एजेंट के रूप में आप किसी सदस्य के लिए योगदान भेजते हैं। कोषाध्यक्ष उसे मंज़ूर करता है।', agentMember: 'सदस्य', agentShares: 'शेयर', agentSocial: 'सामाजिक कोष', agentAmount: 'राशि', agentCount: 'शेयरों की संख्या', agentNote: 'नोट (वैकल्पिक)', agentSend: 'मंज़ूरी के लिए भेजें', agentSent: 'भेज दिया। कोषाध्यक्ष मंज़ूर करेगा।',
  exportCsv: 'CSV निर्यात', reportT: 'आपके समूहों की रिपोर्ट', reportHelp: 'कोषाध्यक्ष के रूप में आप जिन समूहों को चलाते हैं, उनके कुल, सभी चक्र मिलाकर।', colGroup: 'समूह', colMembers: 'सदस्य', colShares: 'बचत', colSocial: 'सामाजिक', colFines: 'जुर्माने', colOut: 'उधार दिया', colOwed: 'अब भी बकाया', totalLabel: 'कुल',
  err: 'कुछ गलत हो गया। फिर कोशिश करें।', done: 'हो गया।', errors: { premium_required: 'इसके लिए समूह मालिक के खाते पर प्रीमियम चाहिए।', plan_limit_group_methods: 'एक समूह अधिकतम 3 भुगतान तरीके दिखा सकता है।', no_cycle: 'कोई चक्र नहीं चल रहा।', bad_shares: 'शेयरों की संख्या जाँचें।', bad_amount: 'सही राशि लिखें।', too_many_pending: 'इस सदस्य के कई योगदान पहले से प्रतीक्षा में हैं।', last_admin: 'समूह में कम से कम एक कोषाध्यक्ष चाहिए।', guest_no_role: 'बिना खाते का मेहमान केवल सदस्य हो सकता है।', not_admin: 'आपको यह करने की अनुमति नहीं है।' },
};
export const VSLA_PREMIUM: Record<Lang, VslaPremiumWords> = { en: EN, fr: FR, es: ES, pt: PT, hi: HI };

export function vslaPremiumError(lang: Lang, message: string): string {
  const w = VSLA_PREMIUM[lang];
  const k = Object.keys(w.errors).find((e) => message.includes(e));
  return k ? w.errors[k] : w.err;
}

/** Turns rows into a CSV file the person can open in Excel (comma separated, quotes escaped). */
export function toCsv(rows: Array<Array<string | number>>): string {
  const cell = (v: string | number) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
