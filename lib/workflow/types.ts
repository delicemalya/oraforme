// ── Workflow Engine Types — Oraforme Automation Platform ──────────────────────

// ── Triggers ─────────────────────────────────────────────────────────────────

export type TriggerType =
  // Finance
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'expense.created'
  | 'expense.approved'
  | 'payment.received'
  // RH
  | 'employee.hired'
  | 'employee.offboarded'
  | 'contract.expiring'
  | 'payslip.generated'
  | 'leave.requested'
  | 'leave.approved'
  // École
  | 'student.enrolled'
  | 'grade.submitted'
  | 'payment.scolaire.received'
  | 'payment.scolaire.overdue'
  | 'absence.recorded'
  | 'report.generated'
  // Hôtel
  | 'reservation.created'
  | 'reservation.checkin'
  | 'reservation.checkout'
  | 'room.status.changed'
  // Restaurant
  | 'order.created'
  | 'order.completed'
  | 'order.cancelled'
  // Stock
  | 'stock.low'
  | 'stock.out'
  | 'stock.movement'
  // Système
  | 'scheduled.daily'
  | 'scheduled.weekly'
  | 'scheduled.monthly'
  | 'manual'
  | 'webhook.received'

// ── Conditions ────────────────────────────────────────────────────────────────

export type ConditionOperator =
  | 'equals' | 'not_equals'
  | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal'
  | 'contains' | 'not_contains'
  | 'is_empty' | 'is_not_empty'
  | 'in' | 'not_in'

export interface WorkflowCondition {
  field: string                     // e.g., 'montant', 'statut', 'trigger_data.total'
  operator: ConditionOperator
  value: string | number | boolean | string[]
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type ActionType =
  | 'notification.create'     // Notif in-app
  | 'email.send'              // Email via template
  | 'sms.send'                // SMS
  | 'webhook.trigger'         // POST to external URL
  | 'record.create'           // Insert into any table
  | 'record.update'           // Update record
  | 'status.update'           // Change status field
  | 'wait'                    // Delay before next action
  | 'workflow.trigger'        // Trigger another workflow
  | 'api.call'                // External HTTP call
  | 'log.create'              // Write to audit log
  | 'matrix.send'             // Matricule generation
  | 'pdf.generate'            // Generate + store PDF

export interface WorkflowAction {
  id: string
  type: ActionType
  label?: string
  config: Record<string, unknown>
  // e.g. for 'notification.create':
  //   { title: 'Facture payée', body: 'La facture {{invoice.number}} a été payée', type: 'success' }
  // for 'email.send':
  //   { to: '{{employee.email}}', subject: 'Bienvenue !', template: 'employee_welcome' }
  // for 'wait':
  //   { duration_ms: 86400000, unit: 'days', value: 1 }
  // for 'status.update':
  //   { table: 'factures', field: 'statut', value: 'archivee' }
}

// ── Workflow Definition ───────────────────────────────────────────────────────

export interface WorkflowDefinition {
  id: string
  tenant_id: string
  name: string
  description?: string
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>  // e.g., { module: 'ecole', statut: 'envoyee' }
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  is_active: boolean
  run_count: number
  last_run_at: string | null
  created_at: string
  updated_at: string
}

// ── Execution ─────────────────────────────────────────────────────────────────

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface WorkflowExecution {
  id: string
  workflow_id: string
  tenant_id: string
  status: ExecutionStatus
  trigger_data: Record<string, unknown>
  result: Record<string, unknown>
  error?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

// ── Log ───────────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warning' | 'error'

export interface WorkflowLog {
  id: string
  execution_id?: string
  workflow_id?: string
  tenant_id: string
  level: LogLevel
  message: string
  data: Record<string, unknown>
  created_at: string
}

// ── Trigger payload ───────────────────────────────────────────────────────────

export interface TriggerPayload {
  type: TriggerType
  tenant_id: string
  data: Record<string, unknown>
  timestamp: string
}

// ── Action result ─────────────────────────────────────────────────────────────

export interface ActionResult {
  action_id: string
  type: ActionType
  success: boolean
  data?: Record<string, unknown>
  error?: string
  duration_ms: number
}

// ── Preset (pre-built workflow template) ─────────────────────────────────────

export interface WorkflowPreset {
  id: string
  name: string
  description: string
  category: 'rh' | 'finance' | 'ecole' | 'hotel' | 'restaurant' | 'stock' | 'system'
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  icon: string    // Lucide icon name
  color: string   // Hex color
}
