import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('lib/i18n.ts', 'utf8');

const insertions = [
  // PT block
  {
    anchor: "'nav.boisson_tournees':  'Rotas de Entrega',",
    keys: `
    'action.ajouter': 'Adicionar', 'action.modifier': 'Editar', 'action.supprimer': 'Excluir',
    'action.enregistrer': 'Salvar', 'action.annuler': 'Cancelar', 'action.confirmer': 'Confirmar',
    'action.telecharger': 'Baixar', 'action.imprimer': 'Imprimir', 'action.exporter': 'Exportar',
    'action.rechercher': 'Pesquisar…', 'action.voir_tout': 'Ver tudo', 'action.actualiser': 'Atualizar',
    'action.fermer': 'Fechar', 'action.nouveau': 'Novo', 'action.charger': 'Carregando…',
    'action.envoyer': 'Enviar', 'action.generer': 'Gerar',
    'statut.actif': 'Ativo', 'statut.inactif': 'Inativo', 'statut.paye': 'Pago',
    'statut.impaye': 'Não pago', 'statut.brouillon': 'Rascunho', 'statut.envoye': 'Enviado', 'statut.retard': 'Atrasado',
    'msg.succes': 'Operação bem-sucedida', 'msg.erreur': 'Ocorreu um erro',
    'msg.aucune_donnee': 'Nenhum dado disponível', 'msg.chargement': 'Carregando…',
    'msg.confirmer_suppression': 'Confirmar exclusão?', 'msg.sauvegarde': 'Alterações salvas',
    'dashboard.bienvenue_matin': 'Bom dia', 'dashboard.bienvenue_aprem': 'Boa tarde',
    'dashboard.bienvenue_soir': 'Boa noite', 'dashboard.revenus': 'Receitas',
    'dashboard.employes': 'Funcionários ativos', 'dashboard.alertes': 'Alertas ativos',
    'dashboard.modules': 'módulos ativos', 'dashboard.activite': 'Atividade recente',`
  },
  // ES block
  {
    anchor: "'nav.boisson_tournees':  'Rutas de Entrega',",
    keys: `
    'action.ajouter': 'Agregar', 'action.modifier': 'Editar', 'action.supprimer': 'Eliminar',
    'action.enregistrer': 'Guardar', 'action.annuler': 'Cancelar', 'action.confirmer': 'Confirmar',
    'action.telecharger': 'Descargar', 'action.imprimer': 'Imprimir', 'action.exporter': 'Exportar',
    'action.rechercher': 'Buscar…', 'action.voir_tout': 'Ver todo', 'action.actualiser': 'Actualizar',
    'action.fermer': 'Cerrar', 'action.nouveau': 'Nuevo', 'action.charger': 'Cargando…',
    'action.envoyer': 'Enviar', 'action.generer': 'Generar',
    'statut.actif': 'Activo', 'statut.inactif': 'Inactivo', 'statut.paye': 'Pagado',
    'statut.impaye': 'Impagado', 'statut.brouillon': 'Borrador', 'statut.envoye': 'Enviado', 'statut.retard': 'Vencido',
    'msg.succes': 'Operación exitosa', 'msg.erreur': 'Ocurrió un error',
    'msg.aucune_donnee': 'Sin datos disponibles', 'msg.chargement': 'Cargando…',
    'msg.confirmer_suppression': 'Confirmar eliminación?', 'msg.sauvegarde': 'Cambios guardados',
    'dashboard.bienvenue_matin': 'Buenos días', 'dashboard.bienvenue_aprem': 'Buenas tardes',
    'dashboard.bienvenue_soir': 'Buenas noches', 'dashboard.revenus': 'Ingresos',
    'dashboard.employes': 'Empleados activos', 'dashboard.alertes': 'Alertas activas',
    'dashboard.modules': 'módulos activos', 'dashboard.activite': 'Actividad reciente',`
  },
  // LN block
  {
    anchor: "'nav.boisson_tournees':  'Balabala ya Kotinda',",
    keys: `
    'action.ajouter': 'Kobakisa', 'action.modifier': 'Kobongola', 'action.supprimer': 'Koboma',
    'action.enregistrer': 'Kobomba', 'action.annuler': 'Kotika', 'action.confirmer': 'Kolakisa',
    'action.telecharger': 'Kokitisa', 'action.rechercher': 'Koluka…', 'action.charger': 'Kozwa…',
    'action.envoyer': 'Kotinda', 'action.nouveau': 'Ya sika',
    'statut.actif': 'Azali', 'statut.paye': 'Alipeli', 'statut.brouillon': 'Ebandeli',
    'msg.succes': 'Esali malamu', 'msg.erreur': 'Likama ekomi',
    'msg.aucune_donnee': 'Ebele ya data te', 'msg.chargement': 'Kozwa…',
    'dashboard.bienvenue_matin': 'Mbote na ntongo', 'dashboard.bienvenue_aprem': 'Mbote na midi',
    'dashboard.bienvenue_soir': 'Mbote na mpokwa', 'dashboard.revenus': 'Mbongo ekoti',
    'dashboard.employes': 'Basali ya mosala', 'dashboard.alertes': 'Bilakisi',
    'dashboard.modules': 'ba module ya mosala', 'dashboard.activite': 'Misala ya sika',`
  },
  // SW block
  {
    anchor: "'nav.boisson_tournees':  'Njia za Utoaji',",
    keys: `
    'action.ajouter': 'Ongeza', 'action.modifier': 'Hariri', 'action.supprimer': 'Futa',
    'action.enregistrer': 'Hifadhi', 'action.annuler': 'Ghairi', 'action.confirmer': 'Thibitisha',
    'action.telecharger': 'Pakua', 'action.rechercher': 'Tafuta…', 'action.charger': 'Inapakia…',
    'action.envoyer': 'Tuma', 'action.nouveau': 'Mpya',
    'statut.actif': 'Amilifu', 'statut.paye': 'Amelipa', 'statut.brouillon': 'Rasimu',
    'msg.succes': 'Imefanikiwa', 'msg.erreur': 'Kosa limetokea',
    'msg.aucune_donnee': 'Hakuna data', 'msg.chargement': 'Inapakia…',
    'dashboard.bienvenue_matin': 'Habari za asubuhi', 'dashboard.bienvenue_aprem': 'Habari za mchana',
    'dashboard.bienvenue_soir': 'Habari za jioni', 'dashboard.revenus': 'Mapato',
    'dashboard.employes': 'Wafanyakazi amilifu', 'dashboard.alertes': 'Tahadhari',
    'dashboard.modules': 'moduli amilifu', 'dashboard.activite': 'Shughuli za hivi karibuni',`
  },
  // DE block
  {
    anchor: "'nav.boisson_tournees':  'Liefertouren',",
    keys: `
    'action.ajouter': 'Hinzufügen', 'action.modifier': 'Bearbeiten', 'action.supprimer': 'Löschen',
    'action.enregistrer': 'Speichern', 'action.annuler': 'Abbrechen', 'action.confirmer': 'Bestätigen',
    'action.telecharger': 'Herunterladen', 'action.imprimer': 'Drucken', 'action.exporter': 'Exportieren',
    'action.rechercher': 'Suchen…', 'action.voir_tout': 'Alle anzeigen', 'action.actualiser': 'Aktualisieren',
    'action.fermer': 'Schließen', 'action.nouveau': 'Neu', 'action.charger': 'Laden…',
    'action.envoyer': 'Senden', 'action.generer': 'Generieren',
    'statut.actif': 'Aktiv', 'statut.inactif': 'Inaktiv', 'statut.paye': 'Bezahlt',
    'statut.impaye': 'Unbezahlt', 'statut.brouillon': 'Entwurf', 'statut.envoye': 'Gesendet', 'statut.retard': 'Überfällig',
    'msg.succes': 'Vorgang erfolgreich', 'msg.erreur': 'Ein Fehler ist aufgetreten',
    'msg.aucune_donnee': 'Keine Daten verfügbar', 'msg.chargement': 'Laden…',
    'msg.confirmer_suppression': 'Löschen bestätigen?', 'msg.sauvegarde': 'Änderungen gespeichert',
    'dashboard.bienvenue_matin': 'Guten Morgen', 'dashboard.bienvenue_aprem': 'Guten Tag',
    'dashboard.bienvenue_soir': 'Guten Abend', 'dashboard.revenus': 'Einnahmen',
    'dashboard.employes': 'Aktive Mitarbeiter', 'dashboard.alertes': 'Aktive Warnungen',
    'dashboard.modules': 'aktive Module', 'dashboard.activite': 'Letzte Aktivität',`
  },
];

let count = 0;
for (const { anchor, keys } of insertions) {
  if (content.includes(anchor)) {
    content = content.replace(anchor, anchor + keys);
    count++;
    console.log('OK: inserted after:', anchor.slice(0, 45));
  } else {
    console.log('WARN anchor not found:', anchor.slice(0, 45));
  }
}

writeFileSync('lib/i18n.ts', content, 'utf8');
console.log(`Done: inserted into ${count} language blocks`);
