// Central ERP module registry.
// Defines which module IDs belong to the mandatory Core ERP layer
// vs sector-specific Business modules.

// Module IDs that appear in the "Core ERP" sidebar section.
// These are universal across all business sectors.
export const CORE_MODULE_IDS = new Set([
  'rh',           // RH & Paie
  'comptabilite', // Comptabilité OHADA
  'tresorerie',   // Trésorerie (includes Mobile Money as payment method)
  'stock',        // Gestion de Stock
  'direction',    // Direction Générale (école sector specific ID)
])

// Mobile Money is NOT a standalone module — it's a payment method inside Trésorerie.
// Transactions with mode_paiement 'Airtel Money' or 'MTN MoMo' are already tracked there.
export const MOBILE_MONEY_MODES = ['Airtel Money', 'MTN MoMo', 'Mobile Money']

// Sector-agnostic label for the Core ERP section
export const CORE_SECTION_LABEL = 'Core ERP'
