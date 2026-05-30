// ── Trigger helpers — called from module APIs ──────────────────────────────
// Each function maps a domain event to the workflow trigger system.

import { fireTrigger } from './engine'
import type { TriggerType } from './types'

export async function trigger(
  type: TriggerType,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await fireTrigger({
    type,
    tenant_id: tenantId,
    data,
    timestamp: new Date().toISOString(),
  })
}

// ── Finance ───────────────────────────────────────────────────────────────────

export const invoiceCreated  = (tid: string, d: Record<string, unknown>) => trigger('invoice.created',  tid, d)
export const invoicePaid     = (tid: string, d: Record<string, unknown>) => trigger('invoice.paid',     tid, d)
export const invoiceOverdue  = (tid: string, d: Record<string, unknown>) => trigger('invoice.overdue',  tid, d)
export const expenseCreated  = (tid: string, d: Record<string, unknown>) => trigger('expense.created',  tid, d)
export const expenseApproved = (tid: string, d: Record<string, unknown>) => trigger('expense.approved', tid, d)
export const paymentReceived = (tid: string, d: Record<string, unknown>) => trigger('payment.received', tid, d)

// ── RH ────────────────────────────────────────────────────────────────────────

export const employeeHired       = (tid: string, d: Record<string, unknown>) => trigger('employee.hired',       tid, d)
export const employeeOffboarded  = (tid: string, d: Record<string, unknown>) => trigger('employee.offboarded',  tid, d)
export const contractExpiring    = (tid: string, d: Record<string, unknown>) => trigger('contract.expiring',    tid, d)
export const payslipGenerated    = (tid: string, d: Record<string, unknown>) => trigger('payslip.generated',    tid, d)
export const leaveRequested      = (tid: string, d: Record<string, unknown>) => trigger('leave.requested',      tid, d)
export const leaveApproved       = (tid: string, d: Record<string, unknown>) => trigger('leave.approved',       tid, d)

// ── École ─────────────────────────────────────────────────────────────────────

export const studentEnrolled        = (tid: string, d: Record<string, unknown>) => trigger('student.enrolled',        tid, d)
export const gradeSubmitted         = (tid: string, d: Record<string, unknown>) => trigger('grade.submitted',         tid, d)
export const paymentScolaireReceived= (tid: string, d: Record<string, unknown>) => trigger('payment.scolaire.received', tid, d)
export const paymentScolaireOverdue = (tid: string, d: Record<string, unknown>) => trigger('payment.scolaire.overdue',  tid, d)
export const absenceRecorded        = (tid: string, d: Record<string, unknown>) => trigger('absence.recorded',        tid, d)
export const reportGenerated        = (tid: string, d: Record<string, unknown>) => trigger('report.generated',        tid, d)

// ── Hôtel ─────────────────────────────────────────────────────────────────────

export const reservationCreated = (tid: string, d: Record<string, unknown>) => trigger('reservation.created', tid, d)
export const reservationCheckin = (tid: string, d: Record<string, unknown>) => trigger('reservation.checkin', tid, d)
export const reservationCheckout= (tid: string, d: Record<string, unknown>) => trigger('reservation.checkout',tid, d)
export const roomStatusChanged  = (tid: string, d: Record<string, unknown>) => trigger('room.status.changed', tid, d)

// ── Restaurant ────────────────────────────────────────────────────────────────

export const orderCreated   = (tid: string, d: Record<string, unknown>) => trigger('order.created',   tid, d)
export const orderCompleted = (tid: string, d: Record<string, unknown>) => trigger('order.completed', tid, d)
export const orderCancelled = (tid: string, d: Record<string, unknown>) => trigger('order.cancelled', tid, d)

// ── Stock ─────────────────────────────────────────────────────────────────────

export const stockLow      = (tid: string, d: Record<string, unknown>) => trigger('stock.low',      tid, d)
export const stockOut      = (tid: string, d: Record<string, unknown>) => trigger('stock.out',      tid, d)
export const stockMovement = (tid: string, d: Record<string, unknown>) => trigger('stock.movement', tid, d)
