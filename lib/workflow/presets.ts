// ── Pre-built workflow templates ────────────────────────────────────────────

import type { WorkflowPreset } from './types'

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  // ── Finance ──────────────────────────────────────────────────────────────

  {
    id: 'invoice-paid-notify',
    name: 'Notification paiement reçu',
    description: 'Envoie une notification et un SMS quand une facture est payée.',
    category: 'finance',
    trigger_type: 'invoice.paid',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'notification.create',
        label: 'Notif paiement',
        config: {
          title: 'Paiement reçu — {{invoice.number}}',
          body: 'La facture {{invoice.number}} de {{invoice.montant}} FCFA a été payée par {{client.nom}}.',
          type: 'success',
        },
      },
      {
        id: 'a2',
        type: 'log.create',
        label: 'Audit log',
        config: { message: 'Facture {{invoice.number}} marquée payée', level: 'info' },
      },
    ],
    icon: 'CheckCircle',
    color: '#16A34A',
  },

  {
    id: 'invoice-overdue-reminder',
    name: 'Relance facture impayée',
    description: 'Envoie un email + SMS de relance automatique pour les factures en retard.',
    category: 'finance',
    trigger_type: 'invoice.overdue',
    trigger_config: {},
    conditions: [
      { field: 'montant', operator: 'greater_than', value: 0 },
    ],
    actions: [
      {
        id: 'a1',
        type: 'email.send',
        label: 'Email relance',
        config: {
          to: '{{client.email}}',
          subject: 'Rappel : Facture {{invoice.number}} en attente de paiement',
          template: 'invoice_overdue',
          data: { invoice_number: '{{invoice.number}}', montant: '{{invoice.montant}}', echeance: '{{invoice.echeance}}' },
        },
      },
      {
        id: 'a2',
        type: 'sms.send',
        label: 'SMS relance',
        config: {
          to: '{{client.telephone}}',
          message: 'Rappel : votre facture {{invoice.number}} de {{invoice.montant}} FCFA est en retard. Merci de régulariser.',
        },
      },
      {
        id: 'a3',
        type: 'notification.create',
        label: 'Notif interne',
        config: {
          title: 'Facture en retard — {{invoice.number}}',
          body: 'Client {{client.nom}} — {{invoice.montant}} FCFA',
          type: 'warning',
        },
      },
    ],
    icon: 'AlertCircle',
    color: '#D97706',
  },

  {
    id: 'expense-approval-flow',
    name: 'Approbation dépense',
    description: 'Notifie le manager quand une dépense dépasse un seuil.',
    category: 'finance',
    trigger_type: 'expense.created',
    trigger_config: {},
    conditions: [
      { field: 'montant', operator: 'greater_than', value: 100000 },
    ],
    actions: [
      {
        id: 'a1',
        type: 'notification.create',
        label: 'Notif manager',
        config: {
          title: 'Dépense à approuver — {{expense.libelle}}',
          body: 'Montant : {{expense.montant}} FCFA — demandé par {{employee.nom}}',
          type: 'warning',
        },
      },
      {
        id: 'a2',
        type: 'email.send',
        label: 'Email approbation',
        config: {
          to: '{{manager.email}}',
          subject: 'Demande d\'approbation dépense #{{expense.id}}',
          template: 'expense_approval',
        },
      },
    ],
    icon: 'FileCheck',
    color: '#2563EB',
  },

  // ── RH ────────────────────────────────────────────────────────────────────

  {
    id: 'employee-onboarding',
    name: 'Onboarding nouvel employé',
    description: 'Génère le matricule, envoie l\'email de bienvenue, crée les accès.',
    category: 'rh',
    trigger_type: 'employee.hired',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'matrix.send',
        label: 'Génération matricule',
        config: { table: 'employees', id: '{{employee.id}}', prefix: 'EMP', field: 'matricule' },
      },
      {
        id: 'a2',
        type: 'email.send',
        label: 'Email bienvenue',
        config: {
          to: '{{employee.email}}',
          subject: 'Bienvenue chez {{company.nom}} !',
          template: 'employee_welcome',
        },
      },
      {
        id: 'a3',
        type: 'notification.create',
        label: 'Notif RH',
        config: {
          title: 'Nouvel employé : {{employee.prenom}} {{employee.nom}}',
          body: 'Poste : {{employee.poste}} — Département : {{employee.departement}}',
          type: 'info',
        },
      },
      {
        id: 'a4',
        type: 'log.create',
        label: 'Audit RH',
        config: { message: 'Onboarding employé {{employee.nom}} — matricule généré', level: 'info' },
      },
    ],
    icon: 'UserPlus',
    color: '#7C3AED',
  },

  {
    id: 'contract-expiry-alert',
    name: 'Alerte expiration contrat',
    description: 'Notifie le RH et l\'employé 30 jours avant l\'expiration du contrat.',
    category: 'rh',
    trigger_type: 'contract.expiring',
    trigger_config: {},
    conditions: [
      { field: 'days_remaining', operator: 'less_or_equal', value: 30 },
    ],
    actions: [
      {
        id: 'a1',
        type: 'notification.create',
        label: 'Alerte expiration',
        config: {
          title: 'Contrat expirant — {{employee.nom}}',
          body: '{{contract.days_remaining}} jours restants. Type : {{contract.type}}',
          type: 'warning',
          link: '/dashboard/rh/contrats/{{contract.id}}',
        },
      },
      {
        id: 'a2',
        type: 'email.send',
        label: 'Email RH',
        config: {
          to: '{{rh.email}}',
          subject: 'Action requise : contrat {{employee.nom}} expire dans {{contract.days_remaining}} jours',
          template: 'contract_expiry',
        },
      },
    ],
    icon: 'Clock',
    color: '#DC2626',
  },

  {
    id: 'payslip-distribution',
    name: 'Distribution bulletins de paie',
    description: 'Envoie le bulletin de paie par email à chaque employé après génération.',
    category: 'rh',
    trigger_type: 'payslip.generated',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'pdf.generate',
        label: 'Générer PDF bulletin',
        config: { template: 'payslip', record_id: '{{payslip.id}}', table: 'payslips' },
      },
      {
        id: 'a2',
        type: 'email.send',
        label: 'Email bulletin',
        config: {
          to: '{{employee.email}}',
          subject: 'Votre bulletin de paie — {{payslip.mois}} {{payslip.annee}}',
          template: 'payslip_email',
        },
      },
    ],
    icon: 'FileText',
    color: '#0891B2',
  },

  // ── École ─────────────────────────────────────────────────────────────────

  {
    id: 'student-enrollment-welcome',
    name: 'Accueil nouvel élève',
    description: 'Envoie un email de bienvenue et une notification à l\'inscription.',
    category: 'ecole',
    trigger_type: 'student.enrolled',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'email.send',
        label: 'Email bienvenue parent',
        config: {
          to: '{{parent.email}}',
          subject: 'Inscription confirmée — {{student.prenom}} {{student.nom}}',
          template: 'student_enrollment',
        },
      },
      {
        id: 'a2',
        type: 'notification.create',
        label: 'Notif direction',
        config: {
          title: 'Nouvel élève inscrit',
          body: '{{student.prenom}} {{student.nom}} — {{classe.nom}}',
          type: 'success',
        },
      },
    ],
    icon: 'GraduationCap',
    color: '#059669',
  },

  {
    id: 'school-payment-overdue',
    name: 'Relance frais scolaires',
    description: 'Notifie les parents pour les frais scolaires impayés.',
    category: 'ecole',
    trigger_type: 'payment.scolaire.overdue',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'sms.send',
        label: 'SMS parent',
        config: {
          to: '{{parent.telephone}}',
          message: 'Rappel : les frais scolaires de {{student.prenom}} ({{montant}} FCFA) sont en retard. Merci de régulariser.',
        },
      },
      {
        id: 'a2',
        type: 'email.send',
        label: 'Email relance',
        config: {
          to: '{{parent.email}}',
          subject: 'Frais scolaires en attente — {{student.prenom}} {{student.nom}}',
          template: 'school_payment_overdue',
        },
      },
      {
        id: 'a3',
        type: 'notification.create',
        label: 'Notif secrétariat',
        config: {
          title: 'Impayé scolaire — {{student.nom}}',
          body: 'Montant : {{montant}} FCFA',
          type: 'warning',
        },
      },
    ],
    icon: 'AlertTriangle',
    color: '#D97706',
  },

  {
    id: 'bulletin-publication',
    name: 'Publication bulletins scolaires',
    description: 'Génère et envoie les bulletins aux parents après la délibération.',
    category: 'ecole',
    trigger_type: 'report.generated',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'pdf.generate',
        label: 'Générer bulletin PDF',
        config: { template: 'bulletin_scolaire', record_id: '{{bulletin.id}}', table: 'bulletins' },
      },
      {
        id: 'a2',
        type: 'email.send',
        label: 'Email parents',
        config: {
          to: '{{parent.email}}',
          subject: 'Bulletin de {{student.prenom}} — {{periode}}',
          template: 'bulletin_email',
        },
      },
    ],
    icon: 'BookOpen',
    color: '#7C3AED',
  },

  // ── Hôtel ─────────────────────────────────────────────────────────────────

  {
    id: 'reservation-confirmation',
    name: 'Confirmation réservation',
    description: 'Envoie un email de confirmation immédiatement après la réservation.',
    category: 'hotel',
    trigger_type: 'reservation.created',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'email.send',
        label: 'Email confirmation',
        config: {
          to: '{{client.email}}',
          subject: 'Réservation confirmée — {{hotel.nom}}',
          template: 'reservation_confirmation',
        },
      },
      {
        id: 'a2',
        type: 'sms.send',
        label: 'SMS confirmation',
        config: {
          to: '{{client.telephone}}',
          message: 'Réservation confirmée au {{hotel.nom}}. Chambre : {{chambre.numero}}. Arrivée : {{reservation.checkin_date}}. Bienvenue !',
        },
      },
      {
        id: 'a3',
        type: 'notification.create',
        label: 'Notif réception',
        config: {
          title: 'Nouvelle réservation',
          body: '{{client.nom}} — Chambre {{chambre.numero}} — du {{reservation.checkin_date}} au {{reservation.checkout_date}}',
          type: 'info',
        },
      },
    ],
    icon: 'BedDouble',
    color: '#0891B2',
  },

  {
    id: 'checkin-notification',
    name: 'Notification check-in',
    description: 'Notifie la réception au check-in et met à jour le statut de la chambre.',
    category: 'hotel',
    trigger_type: 'reservation.checkin',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'status.update',
        label: 'Chambre occupée',
        config: { table: 'chambres', id: '{{chambre.id}}', field: 'statut', value: 'occupee' },
      },
      {
        id: 'a2',
        type: 'notification.create',
        label: 'Notif check-in',
        config: {
          title: 'Check-in — {{client.nom}}',
          body: 'Chambre {{chambre.numero}} maintenant occupée.',
          type: 'success',
        },
      },
    ],
    icon: 'LogIn',
    color: '#16A34A',
  },

  // ── Restaurant ────────────────────────────────────────────────────────────

  {
    id: 'order-kitchen-notify',
    name: 'Notification cuisine nouvelle commande',
    description: 'Alerte la cuisine immédiatement à chaque nouvelle commande.',
    category: 'restaurant',
    trigger_type: 'order.created',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'notification.create',
        label: 'Notif cuisine',
        config: {
          title: 'Nouvelle commande #{{order.numero}}',
          body: 'Table {{order.table}} — {{order.items_count}} article(s)',
          type: 'info',
        },
      },
    ],
    icon: 'UtensilsCrossed',
    color: '#EA580C',
  },

  // ── Stock ─────────────────────────────────────────────────────────────────

  {
    id: 'low-stock-alert',
    name: 'Alerte stock bas',
    description: 'Notifie le gestionnaire quand un article passe sous le seuil minimum.',
    category: 'stock',
    trigger_type: 'stock.low',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'notification.create',
        label: 'Alerte stock',
        config: {
          title: 'Stock bas — {{article.nom}}',
          body: 'Quantité restante : {{article.quantite}} {{article.unite}}. Seuil minimum : {{article.seuil_min}}',
          type: 'warning',
          link: '/dashboard/stock/articles/{{article.id}}',
        },
      },
      {
        id: 'a2',
        type: 'email.send',
        label: 'Email gestionnaire',
        config: {
          to: '{{gestionnaire.email}}',
          subject: 'Stock bas : {{article.nom}} — action requise',
          template: 'stock_low_alert',
        },
      },
    ],
    icon: 'Package',
    color: '#DC2626',
  },

  {
    id: 'out-of-stock-alert',
    name: 'Alerte rupture de stock',
    description: 'Notifie immédiatement en cas de rupture de stock.',
    category: 'stock',
    trigger_type: 'stock.out',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'a1',
        type: 'notification.create',
        label: 'Alerte rupture',
        config: {
          title: 'RUPTURE — {{article.nom}}',
          body: 'Stock épuisé. Commande de réapprovisionnement requise.',
          type: 'warning',
        },
      },
      {
        id: 'a2',
        type: 'sms.send',
        label: 'SMS gestionnaire',
        config: {
          to: '{{gestionnaire.telephone}}',
          message: 'URGENT : Rupture de stock sur {{article.nom}}. Réapprovisionnement requis immédiatement.',
        },
      },
    ],
    icon: 'PackageX',
    color: '#DC2626',
  },
]

export function getPresetsByCategory(
  category: WorkflowPreset['category'],
): WorkflowPreset[] {
  return WORKFLOW_PRESETS.filter(p => p.category === category)
}

export function getPresetById(id: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS.find(p => p.id === id)
}
