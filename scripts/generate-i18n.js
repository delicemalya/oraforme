/**
 * Script de génération des traductions manquantes
 * Génère les clés manquantes pour PT, ES, DE, LN, KG
 */
const fs = require('fs')
const path = require('path')

const i18nPath = path.join(__dirname, '../lib/i18n.ts')
const content = fs.readFileSync(i18nPath, 'utf8')

function extractKV(c, s, e) {
  const b = c.substring(s, e); const kv = {}
  const r = /'([^']+)':\s*'([^']*)'/g; let m
  while ((m = r.exec(b)) !== null) kv[m[1]] = m[2]
  return kv
}

const frStart = content.indexOf('fr: {')
const enStart = content.indexOf('\n  en: {')
const ptStart = content.indexOf('\n  pt: {')
const esStart = content.indexOf('\n  es: {')
const lnStart = content.indexOf('\n  ln: {')
const swStart = content.indexOf('\n  sw: {')
const deStart = content.indexOf('\n  de: {')
const kgStart = content.indexOf('\n  kg: {')

const fr = extractKV(content, frStart, enStart)

// ─────────────────────────────────────────────────────────────
// Translation tables: French value → Target language value
// For ERP context
// ─────────────────────────────────────────────────────────────

// Common word replacements
const PT_MAP = {
  'Trésorerie': 'Tesouraria', 'Solde': 'Saldo', 'Compte': 'Conta', 'Comptes': 'Contas',
  'Encaissement': 'Recebimento', 'Décaissement': 'Pagamento', 'Facture': 'Fatura',
  'Factures': 'Faturas', 'Employé': 'Funcionário', 'Employés': 'Funcionários',
  'Contrat': 'Contrato', 'Salaire': 'Salário', 'Paie': 'Folha de pagamento',
  'Stock': 'Estoque', 'Produit': 'Produto', 'Produits': 'Produtos',
  'Fournisseur': 'Fornecedor', 'Client': 'Cliente', 'Clients': 'Clientes',
  'Caisse': 'Caixa', 'Banque': 'Banco', 'Banques': 'Bancos',
  'Restaurant': 'Restaurante', 'École': 'Escola', 'Hôtel': 'Hotel',
  'Rapport': 'Relatório', 'Rapports': 'Relatórios', 'Analyse': 'Análise',
  'Chargement': 'Carregando', 'Enregistrement': 'Salvando', 'Annuler': 'Cancelar',
  'Confirmer': 'Confirmar', 'Supprimer': 'Excluir', 'Modifier': 'Editar',
  'Ajouter': 'Adicionar', 'Créer': 'Criar', 'Sauvegarder': 'Salvar',
  'Fermer': 'Fechar', 'Retour': 'Voltar', 'Suivant': 'Próximo',
  'Précédent': 'Anterior', 'Valider': 'Validar', 'Soumettre': 'Enviar',
  'Rechercher': 'Pesquisar', 'Filtrer': 'Filtrar', 'Exporter': 'Exportar',
  'Importer': 'Importar', 'Télécharger': 'Descarregar', 'Imprimer': 'Imprimir',
  'Oui': 'Sim', 'Non': 'Não', 'Total': 'Total', 'Montant': 'Valor',
  'Date': 'Data', 'Période': 'Período', 'Mois': 'Mês', 'Année': 'Ano',
  'Semaine': 'Semana', 'Jour': 'Dia', 'Heure': 'Hora',
  'Actif': 'Ativo', 'Inactif': 'Inativo', 'Suspendu': 'Suspenso',
  'En cours': 'Em andamento', 'Terminé': 'Concluído', 'Annulé': 'Cancelado',
  'En attente': 'Pendente', 'Validé': 'Validado', 'Refusé': 'Recusado',
  'Aucun': 'Nenhum', 'Aucune': 'Nenhuma', 'Chargement…': 'Carregando…',
  'Tableau de bord': 'Painel', 'Dashboard': 'Painel',
  'Paramètres': 'Configurações', 'Profil': 'Perfil',
  'Notifications': 'Notificações', 'Alertes': 'Alertas',
  'Analytique': 'Análise', 'Analytics': 'Análise',
  'Paiement': 'Pagamento', 'Paiements': 'Pagamentos',
  'Impayé': 'Impago', 'Impayés': 'Impagos',
  'Achat': 'Compra', 'Achats': 'Compras',
  'Vente': 'Venda', 'Ventes': 'Vendas',
  'Dépense': 'Despesa', 'Dépenses': 'Despesas',
  'Recette': 'Receita', 'Recettes': 'Receitas',
  'Bénéfice': 'Lucro', 'Perte': 'Prejuízo',
  'Chiffre d\'affaires': 'Faturamento', 'CA': 'FA',
  'TVA': 'IVA', 'Taxe': 'Imposto',
  'Note': 'Nota', 'Notes': 'Notas',
  'Absence': 'Ausência', 'Absences': 'Ausências',
  'Présence': 'Presença', 'Présences': 'Presenças',
  'Classe': 'Turma', 'Étudiant': 'Estudante', 'Étudiants': 'Estudantes',
  'Enseignant': 'Professor', 'Enseignants': 'Professores',
  'Diplôme': 'Diploma', 'Diplômes': 'Diplomas',
  'Salle': 'Sala', 'Chambre': 'Quarto',
  'Réservation': 'Reserva', 'Réservations': 'Reservas',
  'Commande': 'Pedido', 'Commandes': 'Pedidos',
  'Menu': 'Cardápio', 'Table': 'Mesa', 'Tables': 'Mesas',
  'Plat': 'Prato', 'Plats': 'Pratos',
  'Service': 'Serviço', 'Services': 'Serviços',
  'Inventaire': 'Inventário', 'Article': 'Artigo', 'Articles': 'Artigos',
  'Catégorie': 'Categoria', 'Catégories': 'Categorias',
  'Mouvement': 'Movimento', 'Mouvements': 'Movimentos',
  'Entrée': 'Entrada', 'Sorties': 'Saídas', 'Sortie': 'Saída',
  'Ajustement': 'Ajuste', 'Transfert': 'Transferência',
  'Workflow': 'Fluxo de trabalho', 'Rôle': 'Função', 'Rôles': 'Funções',
  'Permission': 'Permissão', 'Permissions': 'Permissões',
  'Utilisateur': 'Utilizador', 'Utilisateurs': 'Utilizadores',
  'Équipe': 'Equipa', 'Membre': 'Membro', 'Membres': 'Membros',
  'Document': 'Documento', 'Documents': 'Documentos',
  'Fichier': 'Ficheiro', 'Fichiers': 'Ficheiros',
  'Téléversement': 'Upload', 'Aperçu': 'Visualizar',
  'Rechargement': 'Recarregando', 'Erreur': 'Erro',
  'Succès': 'Sucesso', 'Avertissement': 'Aviso',
  'Information': 'Informação', 'Aide': 'Ajuda',
  'Accueil': 'Início', 'Connexion': 'Iniciar sessão',
  'Déconnexion': 'Sair', 'Inscription': 'Registo',
  'Mot de passe': 'Palavra-passe', 'Email': 'Email',
}

const ES_MAP = {
  'Trésorerie': 'Tesorería', 'Solde': 'Saldo', 'Compte': 'Cuenta', 'Comptes': 'Cuentas',
  'Encaissement': 'Cobro', 'Décaissement': 'Pago', 'Facture': 'Factura',
  'Factures': 'Facturas', 'Employé': 'Empleado', 'Employés': 'Empleados',
  'Contrat': 'Contrato', 'Salaire': 'Salario', 'Paie': 'Nómina',
  'Stock': 'Inventario', 'Produit': 'Producto', 'Produits': 'Productos',
  'Fournisseur': 'Proveedor', 'Client': 'Cliente', 'Clients': 'Clientes',
  'Caisse': 'Caja', 'Banque': 'Banco', 'Banques': 'Bancos',
  'Restaurant': 'Restaurante', 'École': 'Escuela', 'Hôtel': 'Hotel',
  'Rapport': 'Informe', 'Rapports': 'Informes', 'Analyse': 'Análisis',
  'Chargement': 'Cargando', 'Enregistrement': 'Guardando', 'Annuler': 'Cancelar',
  'Confirmer': 'Confirmar', 'Supprimer': 'Eliminar', 'Modifier': 'Editar',
  'Ajouter': 'Añadir', 'Créer': 'Crear', 'Sauvegarder': 'Guardar',
  'Fermer': 'Cerrar', 'Retour': 'Volver', 'Suivant': 'Siguiente',
  'Précédent': 'Anterior', 'Valider': 'Validar', 'Soumettre': 'Enviar',
  'Rechercher': 'Buscar', 'Filtrer': 'Filtrar', 'Exporter': 'Exportar',
  'Importer': 'Importar', 'Télécharger': 'Descargar', 'Imprimer': 'Imprimir',
  'Oui': 'Sí', 'Non': 'No', 'Total': 'Total', 'Montant': 'Importe',
  'Date': 'Fecha', 'Période': 'Período', 'Mois': 'Mes', 'Année': 'Año',
  'Semaine': 'Semana', 'Jour': 'Día', 'Heure': 'Hora',
  'Actif': 'Activo', 'Inactif': 'Inactivo', 'Suspendu': 'Suspendido',
  'En cours': 'En curso', 'Terminé': 'Completado', 'Annulé': 'Cancelado',
  'En attente': 'Pendiente', 'Validé': 'Validado', 'Refusé': 'Rechazado',
  'Aucun': 'Ninguno', 'Aucune': 'Ninguna', 'Chargement…': 'Cargando…',
  'Tableau de bord': 'Panel', 'Dashboard': 'Panel',
  'Paramètres': 'Configuración', 'Profil': 'Perfil',
  'Notifications': 'Notificaciones', 'Alertes': 'Alertas',
  'Analytique': 'Analítica', 'Analytics': 'Análisis',
  'Paiement': 'Pago', 'Paiements': 'Pagos',
  'Impayé': 'Impago', 'Impayés': 'Impagos',
  'Achat': 'Compra', 'Achats': 'Compras',
  'Vente': 'Venta', 'Ventes': 'Ventas',
  'Dépense': 'Gasto', 'Dépenses': 'Gastos',
  'Recette': 'Ingreso', 'Recettes': 'Ingresos',
  'Bénéfice': 'Beneficio', 'Perte': 'Pérdida',
  'TVA': 'IVA', 'Taxe': 'Impuesto',
  'Note': 'Nota', 'Notes': 'Notas',
  'Absence': 'Ausencia', 'Absences': 'Ausencias',
  'Présence': 'Presencia', 'Présences': 'Asistencias',
  'Classe': 'Clase', 'Étudiant': 'Estudiante', 'Étudiants': 'Estudiantes',
  'Enseignant': 'Profesor', 'Enseignants': 'Profesores',
  'Diplôme': 'Diploma', 'Diplômes': 'Diplomas',
  'Salle': 'Sala', 'Chambre': 'Habitación',
  'Réservation': 'Reserva', 'Réservations': 'Reservas',
  'Commande': 'Pedido', 'Commandes': 'Pedidos',
  'Menu': 'Menú', 'Table': 'Mesa', 'Tables': 'Mesas',
  'Plat': 'Plato', 'Plats': 'Platos',
  'Service': 'Servicio', 'Services': 'Servicios',
  'Inventaire': 'Inventario', 'Article': 'Artículo', 'Articles': 'Artículos',
  'Catégorie': 'Categoría', 'Catégories': 'Categorías',
  'Mouvement': 'Movimiento', 'Mouvements': 'Movimientos',
  'Entrée': 'Entrada', 'Sorties': 'Salidas', 'Sortie': 'Salida',
  'Ajustement': 'Ajuste', 'Transfert': 'Transferencia',
  'Workflow': 'Flujo de trabajo', 'Rôle': 'Rol', 'Rôles': 'Roles',
  'Permission': 'Permiso', 'Permissions': 'Permisos',
  'Utilisateur': 'Usuario', 'Utilisateurs': 'Usuarios',
  'Équipe': 'Equipo', 'Membre': 'Miembro', 'Membres': 'Miembros',
  'Document': 'Documento', 'Documents': 'Documentos',
  'Fichier': 'Archivo', 'Fichiers': 'Archivos',
  'Erreur': 'Error', 'Succès': 'Éxito', 'Avertissement': 'Advertencia',
  'Connexion': 'Inicio de sesión', 'Déconnexion': 'Cerrar sesión',
  'Inscription': 'Registro', 'Mot de passe': 'Contraseña',
}

const DE_MAP = {
  'Trésorerie': 'Liquidität', 'Solde': 'Saldo', 'Compte': 'Konto', 'Comptes': 'Konten',
  'Encaissement': 'Einzahlung', 'Décaissement': 'Auszahlung', 'Facture': 'Rechnung',
  'Factures': 'Rechnungen', 'Employé': 'Mitarbeiter', 'Employés': 'Mitarbeiter',
  'Contrat': 'Vertrag', 'Salaire': 'Gehalt', 'Paie': 'Lohnabrechnung',
  'Stock': 'Lagerbestand', 'Produit': 'Produkt', 'Produits': 'Produkte',
  'Fournisseur': 'Lieferant', 'Client': 'Kunde', 'Clients': 'Kunden',
  'Caisse': 'Kasse', 'Banque': 'Bank', 'Banques': 'Banken',
  'Restaurant': 'Restaurant', 'École': 'Schule', 'Hôtel': 'Hotel',
  'Rapport': 'Bericht', 'Rapports': 'Berichte', 'Analyse': 'Analyse',
  'Chargement': 'Wird geladen', 'Enregistrement': 'Wird gespeichert',
  'Annuler': 'Abbrechen', 'Confirmer': 'Bestätigen', 'Supprimer': 'Löschen',
  'Modifier': 'Bearbeiten', 'Ajouter': 'Hinzufügen', 'Créer': 'Erstellen',
  'Sauvegarder': 'Speichern', 'Fermer': 'Schließen', 'Retour': 'Zurück',
  'Suivant': 'Weiter', 'Précédent': 'Zurück', 'Valider': 'Bestätigen',
  'Soumettre': 'Absenden', 'Rechercher': 'Suchen', 'Filtrer': 'Filtern',
  'Exporter': 'Exportieren', 'Importer': 'Importieren', 'Télécharger': 'Herunterladen',
  'Imprimer': 'Drucken', 'Oui': 'Ja', 'Non': 'Nein',
  'Total': 'Gesamt', 'Montant': 'Betrag', 'Date': 'Datum',
  'Période': 'Zeitraum', 'Mois': 'Monat', 'Année': 'Jahr',
  'Semaine': 'Woche', 'Jour': 'Tag', 'Heure': 'Stunde',
  'Actif': 'Aktiv', 'Inactif': 'Inaktiv', 'Suspendu': 'Gesperrt',
  'En cours': 'In Bearbeitung', 'Terminé': 'Abgeschlossen', 'Annulé': 'Storniert',
  'En attente': 'Ausstehend', 'Validé': 'Bestätigt', 'Refusé': 'Abgelehnt',
  'Aucun': 'Keine', 'Aucune': 'Keine', 'Chargement…': 'Wird geladen…',
  'Tableau de bord': 'Dashboard', 'Dashboard': 'Dashboard',
  'Paramètres': 'Einstellungen', 'Profil': 'Profil',
  'Notifications': 'Benachrichtigungen', 'Alertes': 'Warnungen',
  'Paiement': 'Zahlung', 'Paiements': 'Zahlungen',
  'Impayé': 'Unbezahlt', 'Impayés': 'Unbezahlte',
  'Achat': 'Kauf', 'Achats': 'Einkäufe', 'Vente': 'Verkauf', 'Ventes': 'Verkäufe',
  'Dépense': 'Ausgabe', 'Dépenses': 'Ausgaben',
  'Recette': 'Einnahme', 'Recettes': 'Einnahmen',
  'TVA': 'MwSt.', 'Taxe': 'Steuer',
  'Note': 'Note', 'Notes': 'Noten',
  'Absence': 'Abwesenheit', 'Absences': 'Abwesenheiten',
  'Classe': 'Klasse', 'Étudiant': 'Student', 'Étudiants': 'Studenten',
  'Enseignant': 'Lehrer', 'Enseignants': 'Lehrer',
  'Diplôme': 'Diplom', 'Diplômes': 'Diplome',
  'Salle': 'Saal', 'Chambre': 'Zimmer',
  'Réservation': 'Reservierung', 'Réservations': 'Reservierungen',
  'Commande': 'Bestellung', 'Commandes': 'Bestellungen',
  'Menu': 'Speisekarte', 'Table': 'Tisch', 'Tables': 'Tische',
  'Plat': 'Gericht', 'Plats': 'Gerichte',
  'Service': 'Service', 'Services': 'Dienste',
  'Inventaire': 'Inventar', 'Article': 'Artikel', 'Articles': 'Artikel',
  'Catégorie': 'Kategorie', 'Catégories': 'Kategorien',
  'Mouvement': 'Bewegung', 'Mouvements': 'Bewegungen',
  'Entrée': 'Eingang', 'Sortie': 'Ausgang', 'Sorties': 'Ausgänge',
  'Ajustement': 'Anpassung', 'Transfert': 'Übertrag',
  'Rôle': 'Rolle', 'Rôles': 'Rollen', 'Permission': 'Berechtigung',
  'Utilisateur': 'Benutzer', 'Utilisateurs': 'Benutzer',
  'Équipe': 'Team', 'Membre': 'Mitglied', 'Membres': 'Mitglieder',
  'Document': 'Dokument', 'Documents': 'Dokumente',
  'Fichier': 'Datei', 'Fichiers': 'Dateien',
  'Erreur': 'Fehler', 'Succès': 'Erfolg',
  'Connexion': 'Anmeldung', 'Déconnexion': 'Abmelden',
  'Inscription': 'Registrierung', 'Mot de passe': 'Passwort',
}

// Lingala: technical terms stay French, UI translated
const LN_MAP = {
  'Trésorerie': 'Caisse ya mbongo', 'Solde': 'Ntalo ya mbongo',
  'Compte': 'Compte (mbongo)', 'Comptes': 'Comptes',
  'Encaissement': 'Kokóta ya mbongo', 'Décaissement': 'Kobima ya mbongo',
  'Facture': 'Facture', 'Factures': 'Factures',
  'Employé': 'Mosali', 'Employés': 'Basali',
  'Contrat': 'Contrat', 'Salaire': 'Lifuta', 'Paie': 'Lifuta',
  'Stock': 'Biloko ya boutique', 'Produit': 'Eloko', 'Produits': 'Biloko',
  'Fournisseur': 'Mosalisi ya biloko', 'Client': 'Kliyenti', 'Clients': 'Bakliyenti',
  'Caisse': 'Caisse', 'Banque': 'Banque', 'Banques': 'Mbanque',
  'Restaurant': 'Resto', 'École': 'Koteya', 'Hôtel': 'Hôtel',
  'Rapport': 'Rapport', 'Rapports': 'Rapports', 'Analyse': 'Koluka koluka',
  'Chargement': 'Kozwa…', 'Enregistrement': 'Kotya…',
  'Annuler': 'Tika', 'Confirmer': 'Oui, sala yango',
  'Supprimer': 'Boma', 'Modifier': 'Bobongisi',
  'Ajouter': 'Yaka', 'Créer': 'Sálá', 'Sauvegarder': 'Bómela',
  'Fermer': 'Kanga', 'Retour': 'Zonga',
  'Suivant': 'Elandi', 'Précédent': 'Eyangi',
  'Valider': 'Kangama', 'Soumettre': 'Tinda',
  'Rechercher': 'Koluka', 'Filtrer': 'Pona',
  'Exporter': 'Bima na', 'Importer': 'Kota na',
  'Télécharger': 'Landisa', 'Imprimer': 'Printe',
  'Oui': 'Iyo', 'Non': 'Te',
  'Total': 'Nyonso', 'Montant': 'Ntalo', 'Date': 'Mokolo',
  'Période': 'Ntango', 'Mois': 'Sanza', 'Année': 'Mobu',
  'Semaine': 'Poso', 'Jour': 'Mokolo', 'Heure': 'Ngonga',
  'Actif': 'Azali', 'Inactif': 'Azali te', 'Suspendu': 'Ebandami',
  'En cours': 'Esalemi', 'Terminé': 'Esili', 'Annulé': 'Ekangisami',
  'En attente': 'Ozeli', 'Validé': 'Ekangamaki', 'Refusé': 'Eboyami',
  'Aucun': 'Eloko te', 'Aucune': 'Eloko te',
  'Tableau de bord': 'Ekoti ya mosala', 'Dashboard': 'Tableau de bord',
  'Paramètres': 'Bandeko ya mosala', 'Profil': 'Profil',
  'Notifications': 'Babiziseli', 'Alertes': 'Makila',
  'Paiement': 'Lifuta', 'Paiements': 'Balifuta',
  'Impayé': 'Elilembi te', 'Impayés': 'Bakolekisi te',
  'Achat': 'Koba', 'Achats': 'Kobola biloko',
  'Vente': 'Koteka', 'Ventes': 'Kobotela biloko',
  'Dépense': 'Mbongo ya kotia', 'Dépenses': 'Mbongo ya kotia',
  'Recette': 'Mbongo ya kokóta', 'Recettes': 'Mbongo ya kokóta',
  'TVA': 'TVA', 'Taxe': 'Mpako',
  'Note': 'Ntalo ya mateya', 'Notes': 'Bantalo ya mateya',
  'Absence': 'Kozala te', 'Absences': 'Bankosani',
  'Classe': 'Kelasi', 'Étudiant': 'Moteyi', 'Étudiants': 'Bateyi',
  'Enseignant': 'Moteyi monene', 'Enseignants': 'Bateyi banene',
  'Diplôme': 'Diplôme', 'Diplômes': 'Mabule',
  'Salle': 'Salle', 'Chambre': 'Chambre ya poso',
  'Réservation': 'Kobomba esika', 'Réservations': 'Kobomba bisika',
  'Commande': 'Commande', 'Commandes': 'Bacommande',
  'Menu': 'Biloko ya kolia', 'Table': 'Mesa', 'Tables': 'Bamesa',
  'Plat': 'Eloko ya kolia', 'Plats': 'Biloko ya kolia',
  'Service': 'Mosala', 'Services': 'Misala',
  'Inventaire': 'Inventaire', 'Article': 'Eloko', 'Articles': 'Biloko',
  'Catégorie': 'Bolutu', 'Catégories': 'Mabolutu',
  'Mouvement': 'Kobima ná kokóta', 'Mouvements': 'Kobima ná kokóta',
  'Entrée': 'Kokóta', 'Sortie': 'Kobima', 'Sorties': 'Kobima',
  'Ajustement': 'Kobongisa', 'Transfert': 'Kobonzisa',
  'Rôle': 'Mosala ya nzela', 'Permission': 'Ndingisa',
  'Utilisateur': 'Mosalisi', 'Utilisateurs': 'Basalisi',
  'Équipe': 'Ekóló', 'Membre': 'Membele', 'Membres': 'Bambele',
  'Document': 'Papier', 'Documents': 'Mapapier',
  'Fichier': 'Fichier', 'Erreur': 'Kosala libota',
  'Connexion': 'Kokota', 'Déconnexion': 'Kobima',
  'Inscription': 'Kotiya kombo', 'Mot de passe': 'Nlela ya bango',
}

// Kituba: similar to Lingala (both Bantu languages of Congo)
const KG_MAP = {
  'Trésorerie': 'Caisse ya mbongo', 'Solde': 'Ntalu ya mbongo',
  'Compte': 'Compte', 'Comptes': 'Bacompte',
  'Encaissement': 'Yizidi ya mbongo', 'Décaissement': 'Vutudi ya mbongo',
  'Facture': 'Facture', 'Factures': 'Bafacture',
  'Employé': 'Mfumu ya misalu', 'Employés': 'Bafumu ya misalu',
  'Contrat': 'Contrat', 'Salaire': 'Mvutu ya misalu', 'Paie': 'Mvutu ya misalu',
  'Stock': 'Biloko ya boutique', 'Produit': 'Biloko', 'Produits': 'Biloko',
  'Fournisseur': 'Muntu ya kumvana biloko', 'Client': 'Ntangu', 'Clients': 'Bantangu',
  'Caisse': 'Caisse', 'Banque': 'Banque', 'Banques': 'Mbanque',
  'Restaurant': 'Resto', 'École': 'Koteya', 'Hôtel': 'Hôtel',
  'Rapport': 'Rapport', 'Rapports': 'Birapport',
  'Chargement': 'Landa…', 'Enregistrement': 'Baka…',
  'Annuler': 'Sila', 'Confirmer': 'Nge, sala',
  'Supprimer': 'Boma', 'Modifier': 'Bongisa',
  'Ajouter': 'Yika', 'Créer': 'Sala', 'Sauvegarder': 'Baka',
  'Fermer': 'Kanga', 'Retour': 'Zonga',
  'Suivant': 'Landi', 'Précédent': 'Zi',
  'Valider': 'Kangama', 'Soumettre': 'Tinda',
  'Rechercher': 'Fula', 'Filtrer': 'Sele',
  'Exporter': 'Bima', 'Importer': 'Yiza',
  'Télécharger': 'Landisa', 'Imprimer': 'Printe',
  'Oui': 'Io', 'Non': 'Volo',
  'Total': 'Byonso', 'Montant': 'Ntalu', 'Date': 'Lumbu',
  'Période': 'Ntangu', 'Mois': 'Sanza', 'Année': 'Mvula',
  'Semaine': 'Nkandu', 'Jour': 'Lumbu', 'Heure': 'Ngondo',
  'Actif': 'Vivo', 'Inactif': 'Ko vivo te', 'Suspendu': 'Banda',
  'En cours': 'Salema', 'Terminé': 'Silidi', 'Annulé': 'Silisa',
  'En attente': 'Luzila', 'Validé': 'Kangidi', 'Refusé': 'Boyi',
  'Aucun': 'Eloko te', 'Aucune': 'Eloko te',
  'Tableau de bord': 'Tableau ya misalu', 'Dashboard': 'Tableau',
  'Paramètres': 'Bika ya misalu', 'Profil': 'Profil',
  'Notifications': 'Bilumbu', 'Alertes': 'Makila',
  'Paiement': 'Mvutu', 'Paiements': 'Mvutu',
  'Impayé': 'Ko vutu te', 'Impayés': 'Ko vutu te',
  'Achat': 'Sumb', 'Achats': 'Sumbidi',
  'Vente': 'Tekele', 'Ventes': 'Biteke',
  'Dépense': 'Mbongo ya vutudi', 'Dépenses': 'Mbongo ya vutudi',
  'TVA': 'TVA', 'Taxe': 'Mpako',
  'Note': 'Ntalu ya mateya', 'Notes': 'Bantalu ya mateya',
  'Absence': 'Ko kena te', 'Absences': 'Ko kena te',
  'Classe': 'Kelasi', 'Étudiant': 'Moteyi', 'Étudiants': 'Bateyi',
  'Enseignant': 'Mfumu ya mateya', 'Enseignants': 'Bafumu ya mateya',
  'Diplôme': 'Diplôme', 'Diplômes': 'Madiplôme',
  'Chambre': 'Chambre ya poso', 'Salle': 'Salle',
  'Réservation': 'Baka esika', 'Réservations': 'Baka bisika',
  'Commande': 'Commande', 'Commandes': 'Bicommande',
  'Menu': 'Biloko ya kia', 'Table': 'Mesa', 'Tables': 'Bamesa',
  'Plat': 'Eloko ya kia', 'Plats': 'Biloko ya kia',
  'Service': 'Misalu', 'Services': 'Misalu',
  'Inventaire': 'Inventaire', 'Article': 'Eloko', 'Articles': 'Biloko',
  'Catégorie': 'Ndenge', 'Catégories': 'Mindenge',
  'Mouvement': 'Kimbiambiami', 'Mouvements': 'Biambambi',
  'Entrée': 'Yizidi', 'Sortie': 'Vutudi', 'Sorties': 'Vutudi',
  'Ajustement': 'Bongisidi', 'Transfert': 'Vandidi',
  'Rôle': 'Nsamu', 'Permission': 'Ndingisa',
  'Utilisateur': 'Muntu ya kusala', 'Utilisateurs': 'Bantu ya kusala',
  'Équipe': 'Equipe', 'Membre': 'Membre', 'Membres': 'Bamembre',
  'Document': 'Papier', 'Documents': 'Mabapapier',
  'Fichier': 'Fichier', 'Erreur': 'Yika libota',
  'Connexion': 'Kena', 'Déconnexion': 'Bima',
  'Inscription': 'Funda nkumbu', 'Mot de passe': 'Nkondo ya bakala',
}

function translateValue(frVal, map) {
  let result = frVal
  // Apply word replacements (longest first to avoid partial matches)
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length)
  for (const [fr, tgt] of entries) {
    if (result.includes(fr)) {
      result = result.replace(new RegExp(fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tgt)
    }
  }
  return result
}

function escape(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// Generate additions for each language
const languages = [
  { code: 'pt', map: PT_MAP, existing: extractKV(content, ptStart, esStart) },
  { code: 'es', map: ES_MAP, existing: extractKV(content, esStart, lnStart) },
  { code: 'de', map: DE_MAP, existing: extractKV(content, deStart, kgStart) },
  { code: 'ln', map: LN_MAP, existing: extractKV(content, lnStart, swStart) },
  { code: 'kg', map: KG_MAP, existing: extractKV(content, kgStart, content.length) },
]

for (const { code, map, existing } of languages) {
  const missing = Object.entries(fr).filter(([k]) => !existing[k])
  let lines = [`    // ── Auto-generated translations (${missing.length} keys) ──`]
  for (const [k, v] of missing) {
    const translated = translateValue(v, map)
    const escaped = escape(translated)
    lines.push(`    '${k}': '${escaped}',`)
  }
  const output = lines.join('\n')
  fs.writeFileSync(`gen_${code}.ts`, output)
  console.log(`Generated gen_${code}.ts: ${missing.length} keys, ${output.length} chars`)
}

console.log('Done! Apply each gen_XX.ts to i18n.ts')
