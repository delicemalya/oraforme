'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, FileText, Package, UserCheck,
  ChefHat, GraduationCap, Hotel, Bot,
  LogOut, Menu, X, Building2, Lock,
  Settings, ShieldAlert, ShieldCheck, Store,
  Wallet, BookOpen, Smartphone, ShoppingCart,
  Receipt, BarChart2, Truck,
  BookMarked, Calculator, HeartHandshake, Users, UsersRound,
  Layers, CreditCard,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { SUPER_ADMIN_EMAIL } from '@/lib/admin-config'
import type { LucideIcon } from 'lucide-react'
import type { UserRole, ModulePermission } from '@/lib/hooks/usePermissions'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Generic modules (tenants sans secteur défini) ─────────────────────────────

const ALL_MODULES = [
  { id: 'facturation',  label: 'FacturePro',         icon: FileText,      href: '/dashboard/facturation' },
  { id: 'tresorerie',   label: 'Trésorerie',          icon: Wallet,        href: '/dashboard/tresorerie' },
  { id: 'comptabilite', label: 'Comptabilité',        icon: BookOpen,      href: '/dashboard/comptabilite' },
  { id: 'mobilemoney',  label: 'Mobile Money',        icon: Smartphone,    href: '/dashboard/mobilemoney' },
  { id: 'stock',        label: 'Stock & Inventaire',  icon: Package,       href: '/dashboard/stock' },
  { id: 'rh',           label: 'RH Premium',          icon: UserCheck,     href: '/dashboard/rh' },
  { id: 'ecole',        label: 'École & Université',  icon: GraduationCap, href: '/dashboard/ecole' },
  { id: 'restaurant',   label: 'Resto POS',           icon: ChefHat,       href: '/dashboard/restaurant' },
  { id: 'achats',       label: 'Achats & Fourn.',     icon: ShoppingCart,  href: '/dashboard/achats' },
  { id: 'depenses',     label: 'Dépenses',            icon: Receipt,       href: '/dashboard/depenses' },
  { id: 'rapports',     label: 'Rapports IA',         icon: BarChart2,     href: '/dashboard/rapports' },
  { id: 'hotel',        label: 'Hôtel & Hébergement', icon: Hotel,         href: '/dashboard/hotel' },
  { id: 'transport',    label: 'Transport VTC',       icon: Truck,         href: '/dashboard/transport' },
  { id: 'bizbot',       label: 'MIAA+ Assistant',     icon: Bot,           href: '/dashboard/miaa' },
]

// ── Navigation par secteur métier ─────────────────────────────────────────────

type NavItem = {
  id: string
  label: string
  sublabel: string
  icon: LucideIcon
  href: string
  color: string
}

// ── Visibilité par rôle école ─────────────────────────────────────────────────
// Clé = id de l'item, valeur = rôles autorisés (tableau vide = tout le monde)

const ECOLE_ROLE_VISIBILITY: Record<string, string[]> = {
  'direction':              ['DIRECTION_GENERALE'],
  'daac':                   ['DIRECTION_GENERALE', 'DAAC'],
  'rh':                     ['DIRECTION_GENERALE', 'RAF', 'RH_PAIE'],
  'comptabilite':           ['DIRECTION_GENERALE', 'RAF'],
  'tresorerie':             ['DIRECTION_GENERALE', 'RAF'],
  'scolarite':              ['DIRECTION_GENERALE', 'SCOLARITE', 'DAAC'],
  'espace-formateur':       ['FORMATEUR', 'DIRECTION_GENERALE', 'DAAC', 'RH_PAIE'],
  'espace-etudiant':        ['ETUDIANT'],
  'espace-parent':          ['PARENT'],
  'parametres-academiques': ['DIRECTION_GENERALE', 'DAAC'],
  'miaa':                   [], // visible à tous
}

const SECTOR_NAV: Record<string, NavItem[]> = {
  ecole: [
    { id: 'direction',              label: 'Direction Générale',     sublabel: 'Pilotage & finances',     icon: BarChart2,      href: '/dashboard/ecole/direction',              color: '#F0A30A' },
    { id: 'daac',                   label: 'DAAC',                   sublabel: 'Affaires académiques',     icon: Layers,         href: '/dashboard/ecole/daac',                   color: '#EF4444' },
    { id: 'rh',                     label: 'RH & Paie',              sublabel: 'Personnel & salaires',     icon: Users,          href: '/dashboard/ecole/rh',                     color: '#8B5CF6' },
    { id: 'comptabilite',           label: 'Comptabilité',           sublabel: 'Journal OHADA',            icon: Calculator,     href: '/dashboard/ecole/comptabilite',           color: '#2EA043' },
    { id: 'tresorerie',             label: 'Trésorerie',             sublabel: 'Wallets & encaissements',  icon: Wallet,         href: '/dashboard/ecole/tresorerie',             color: '#06B6D4' },
    { id: 'scolarite',              label: 'Scolarité',              sublabel: 'Inscriptions & frais',     icon: BookMarked,     href: '/dashboard/ecole/scolarite',              color: '#F0A30A' },
    { id: 'espace-formateur',       label: 'Formateurs',             sublabel: 'Cours & heures',           icon: BookOpen,       href: '/dashboard/ecole/espace-formateur',       color: '#2EA043' },
    { id: 'espace-etudiant',        label: 'Espace Étudiant',        sublabel: 'Mon dossier',              icon: GraduationCap,  href: '/dashboard/ecole/espace-etudiant',        color: '#06B6D4' },
    { id: 'espace-parent',          label: 'Espace Parent',          sublabel: 'Suivi de mes enfants',     icon: HeartHandshake, href: '/dashboard/ecole/espace-parent',          color: '#EC4899' },
    { id: 'parametres-academiques', label: 'Paramètres académ.',     sublabel: 'LMD & mentions',           icon: Settings,       href: '/dashboard/ecole/parametres-academiques', color: '#8B949E' },
    { id: 'miaa',                   label: 'MIAA+',                  sublabel: 'IA scolaire',              icon: Bot,            href: '/dashboard/ecole/miaa',                   color: '#F97316' },
  ],
  restaurant: [
    { id: 'pos',        label: 'Caisse POS',   sublabel: 'Ventes & commandes', icon: ChefHat,   href: '/dashboard/restaurant',  color: '#F0A30A' },
    { id: 'stock',      label: 'Stock',        sublabel: 'Inventaire',         icon: Package,   href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'rh',         label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,     href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie', label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',       label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  commerce: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Devis & factures',  icon: FileText,  href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',       label: 'Stock',        sublabel: 'Inventaire',        icon: Package,   href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',         icon: Users,     href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',          icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',      icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  supermarche: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Caisse & ventes',   icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',       label: 'Stock',        sublabel: 'Rayons & inventaire',icon: Package,    href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',      label: 'Achats',       sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',     color: '#06B6D4' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',         color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie', color: '#8B5CF6' },
  ],
  boisson: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Ventes & livraisons',icon: FileText,   href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',       label: 'Stock',        sublabel: 'Inventaire boissons',icon: Package,    href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',      label: 'Achats',       sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',     color: '#06B6D4' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',         color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie', color: '#8B5CF6' },
  ],
  transport_public: [
    { id: 'transport',   label: 'Transport',    sublabel: 'Lignes & voyageurs', icon: Truck,       href: '/dashboard/transport',  color: '#F0A30A' },
    { id: 'facturation', label: 'Facturation',  sublabel: 'Billets & recettes', icon: FileText,    href: '/dashboard/facturation', color: '#388BFD' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Chauffeurs & agents',icon: Users,       href: '/dashboard/rh',         color: '#2EA043' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie', color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,         href: '/dashboard/miaa',       color: '#F97316' },
  ],
  sante: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Consultations',      icon: FileText,  href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel médical',  icon: Users,     href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'stock',       label: 'Pharmacie',    sublabel: 'Médicaments',        icon: Package,   href: '/dashboard/stock',       color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  transport: [
    { id: 'transport',   label: 'Transport',    sublabel: 'Flotte & courses',  icon: Truck,     href: '/dashboard/transport',   color: '#F0A30A' },
    { id: 'facturation', label: 'Facturation',  sublabel: 'Devis & factures',  icon: FileText,  href: '/dashboard/facturation', color: '#388BFD' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Chauffeurs',        icon: Users,     href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',          icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',      icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  hotel: [
    { id: 'hotel',       label: 'Hébergement',  sublabel: 'Réservations',       icon: Hotel,       href: '/dashboard/hotel',       color: '#F0A30A' },
    { id: 'facturation', label: 'Facturation',  sublabel: 'Devis & factures',   icon: FileText,    href: '/dashboard/facturation', color: '#388BFD' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,         href: '/dashboard/miaa',        color: '#F97316' },
  ],
  boutique: [
    { id: 'facturation',  label: 'Caisse & Ventes', sublabel: 'Factures & reçus',  icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock',            sublabel: 'Inventaire',         icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  btp: [
    { id: 'facturation',  label: 'Facturation',      sublabel: 'Devis & travaux',    icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock chantier',   sublabel: 'Matériaux',          icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Équipes',    sublabel: 'Personnel chantier', icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  cabinet: [
    { id: 'facturation',  label: 'Facturation',      sublabel: 'Devis & honoraires', icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#388BFD' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#8B5CF6' },
    { id: 'miaa',         label: 'MIAA+',            sublabel: 'Assistant IA',       icon: Bot,         href: '/dashboard/miaa',        color: '#F97316' },
  ],
  petrole: [
    { id: 'facturation',  label: 'Facturation',      sublabel: 'Ventes & contrats',  icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock',            sublabel: 'Inventaire',         icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  ong: [
    { id: 'facturation',  label: 'Projets & Budget', sublabel: 'Rapports bailleurs', icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'depenses',     label: 'Dépenses',         sublabel: 'Suivi des charges',  icon: Receipt,     href: '/dashboard/depenses',    color: '#2EA043' },
    { id: 'stock',        label: 'Stock & Matériel', sublabel: 'Inventaire',         icon: Package,     href: '/dashboard/stock',       color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Bénévoles',  sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  banque: [
    { id: 'facturation',  label: 'Comptes clients',  sublabel: 'Prêts & épargne',    icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA & reporting',  icon: Calculator,  href: '/dashboard/comptabilite',color: '#388BFD' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Liquidités',         icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
  ],
  pharmacie: [
    { id: 'facturation',  label: 'Caisse',           sublabel: 'Ventes & ordonnances',icon: FileText,   href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock médicaments',sublabel: 'Inventaire & péremption',icon: Package, href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  agriculture: [
    { id: 'facturation',  label: 'Ventes & Récoltes',sublabel: 'Clients & marchés',  icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock & Cheptel',  sublabel: 'Inventaire agricole',icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats & Intrants',sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'depenses',     label: 'Dépenses',         sublabel: 'Charges exploitation',icon: Receipt,    href: '/dashboard/depenses',    color: '#F97316' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Saisonniers & agents',icon: Users,      href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
}

const SECTOR_LABEL: Record<string, string> = {
  ecole:            'École & Université',
  restaurant:       'Restauration',
  commerce:         'Commerce',
  supermarche:      'Supermarché',
  boutique:         'Boutique',
  boisson:          'Boissons',
  sante:            'Santé',
  transport:        'Transport',
  transport_public: 'Transport Public',
  hotel:            'Hôtellerie',
  btp:              'BTP & Industrie',
  cabinet:          'Cabinet & Conseil',
  petrole:          'Pétrole & Mines',
  ong:              'ONG & Association',
  banque:           'Banque & Microfinance',
  pharmacie:        'Pharmacie',
  agriculture:      'Agriculture',
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { t }    = useLocale()

  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [nomEntreprise, setNomEntreprise] = useState<string | null>(null)
  const [secteur,       setSecteur]       = useState<string | null>(null)
  const [role,          setRole]          = useState<UserRole | null>(null)
  const [ecoleRole,     setEcoleRole]     = useState<string | null>(null)
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [permissions,   setPermissions]   = useState<Record<string, ModulePermission>>({})
  const [loaded,        setLoaded]        = useState(false)
  const [userEmail,     setUserEmail]     = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoaded(true); return }
      setUserEmail(user.email ?? null)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, tenant_id, ecole_role_name, tenants(nom_entreprise, modules_actifs, secteur_activite)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile) { setLoaded(true); return }

      const t = profile.tenants as unknown as {
        nom_entreprise:   string
        modules_actifs:   string[]
        secteur_activite: string | null
      } | null

      setNomEntreprise(t?.nom_entreprise ?? null)
      setSecteur(t?.secteur_activite ?? null)
      setRole(profile.role as UserRole)

      // Pour le secteur école : résoudre le rôle école
      if (t?.secteur_activite === 'ecole') {
        if (profile.role === 'owner') {
          setEcoleRole('DIRECTION_GENERALE')
        } else {
          setEcoleRole((profile as unknown as { ecole_role_name?: string }).ecole_role_name ?? null)
        }
      }

      // Pour les tenants sans secteur : l'owner voit tout, les autres voient leur tenant_modules
      if (!t?.secteur_activite) {
        if (profile.role === 'owner') {
          setModulesActifs(ALL_MODULES.map(m => m.id))
        } else {
          const { data: tmRows } = await supabase
            .from('tenant_modules')
            .select('module_key')
            .eq('tenant_id', profile.tenant_id)
            .eq('enabled', true)

          setModulesActifs(
            tmRows && tmRows.length > 0
              ? tmRows.map((r: { module_key: string }) => r.module_key)
              : (t?.modules_actifs ?? [])
          )
        }
      }

      // Charger les permissions pour admin / membre
      if (profile.role !== 'owner') {
        const { data: perms } = await supabase
          .from('user_permissions')
          .select('module_key, can_view, can_edit, can_delete')
          .eq('profile_id', profile.id)

        const map: Record<string, ModulePermission> = {}
        for (const p of perms ?? []) {
          map[p.module_key] = {
            can_view:   p.can_view,
            can_edit:   p.can_edit,
            can_delete: p.can_delete,
          }
        }
        setPermissions(map)
      }

      setLoaded(true)
    })
  }, [])

  const isOwner  = role === 'owner'
  const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Résolution de la navigation selon secteur + permissions ────────────────

  const rawSectorItems = secteur ? (SECTOR_NAV[secteur] ?? null) : null

  // Filtrer : owner voit tout, secteur école → rôle école, autres → user_permissions
  const sectorNav = rawSectorItems
    ? rawSectorItems.filter(item => {
        if (isOwner) return true
        if (secteur === 'ecole') {
          const allowed = ECOLE_ROLE_VISIBILITY[item.id]
          if (!allowed || allowed.length === 0) return true // visible à tous
          return ecoleRole ? allowed.includes(ecoleRole) : false
        }
        return permissions[item.id]?.can_view === true
      })
    : null

  // Modules actifs pour les tenants sans secteur (filtrage identique)
  const activeModules   = ALL_MODULES.filter(m =>
    modulesActifs.includes(m.id) && (isOwner || permissions[m.id]?.can_view !== false)
  )
  const inactiveModules = ALL_MODULES.filter(m => !modulesActifs.includes(m.id))

  // ── Render ─────────────────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo + entreprise */}
      <div className="px-4 py-4 border-b border-[#30363D] shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="oraforme" className="w-7 h-7 shrink-0" />
          <span className="text-base font-bold text-[#E6EDF3]">oraforme</span>
        </div>
        {nomEntreprise && (
          <div className="flex items-center gap-1.5">
            <Building2 size={10} className="text-[#484F58] shrink-0" />
            <span className="text-xs text-[#8B949E] truncate">{nomEntreprise}</span>
            {isSuperAdmin && (
              <span className="text-[9px] bg-[#F85149]/20 text-[#F85149] border border-[#F85149]/30 rounded px-1 py-0.5 font-bold tracking-wide shrink-0">
                Owner
              </span>
            )}
          </div>
        )}
        {/* Badge rôle */}
        {role && role !== 'owner' && (
          <div className="mt-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
              role === 'admin'
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-white/5 text-white/30'
            }`}>
              {role === 'admin' ? 'Administrateur' : 'Membre'}
            </span>
          </div>
        )}
        {secteur && (
          <div className="mt-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[#484F58]">
              {SECTOR_LABEL[secteur] ?? secteur}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">

        {/* Direction Générale — s'adapte au secteur */}
        {(() => {
          const hasSector = loaded && !!sectorNav
          const href  = hasSector && secteur === 'ecole' ? '/dashboard/ecole' : '/dashboard'
          const label = t('nav.dashboard')
          const sub   = hasSector ? t('nav.directionSub') : null
          const active = href === '/dashboard/ecole'
            ? isActive('/dashboard/ecole', true)
            : isActive('/dashboard', true)
          return (
            <Link
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
              }`}
            >
              <LayoutDashboard size={15} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{label}</div>
                {sub && <div className="text-[10px] text-[#484F58] truncate">{sub}</div>}
              </div>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F0A30A]" />}
            </Link>
          )
        })()}

        {/* ── Navigation SECTEUR ───────────────────────────────────────────── */}
        {loaded && sectorNav && (
          <>
            <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">
              {SECTOR_LABEL[secteur!] ?? secteur}
            </p>
            {sectorNav.length === 0 && (
              <p className="text-xs text-[#484F58] px-3 py-2">Aucun module assigné.</p>
            )}
            {sectorNav.map(item => {
              const Icon = item.icon
              const active = isActive(item.href)
              const canEdit = isOwner || permissions[item.id]?.can_edit
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group"
                  style={{ background: active ? `${item.color}18` : 'transparent' }}
                >
                  <Icon
                    size={15}
                    className="shrink-0 transition-colors"
                    style={{ color: active ? item.color : '#484F58' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium leading-tight truncate"
                      style={{ color: active ? item.color : '#8B949E' }}
                    >
                      {item.label}
                    </div>
                    <div className="text-[10px] text-[#484F58] truncate flex items-center gap-1">
                      {item.sublabel}
                      {/* Lecture seule : icône cadenas discret */}
                      {!isOwner && !canEdit && (
                        <Lock size={8} className="text-[#30363D]" />
                      )}
                    </div>
                  </div>
                  {active && (
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                  )}
                </Link>
              )
            })}
          </>
        )}

        {/* ── Navigation GÉNÉRIQUE (pas de secteur) ───────────────────────── */}
        {loaded && !sectorNav && (
          <>
            {activeModules.length > 0 && (
              <>
                <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">{t('nav.myModules')}</p>
                {activeModules.map(mod => {
                  const Icon = mod.icon
                  const active = isActive(mod.href)
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
                          : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{mod.label}</span>
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F0A30A]" />}
                    </Link>
                  )
                })}
              </>
            )}
            {isOwner && inactiveModules.length > 0 && (
              <>
                <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">{t('nav.inactive')}</p>
                {inactiveModules.map(mod => {
                  const Icon = mod.icon
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      title={`Accéder à ${mod.label}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#484F58] hover:text-[#8B949E] hover:bg-[#21262D]/60 transition-all group"
                    >
                      <Icon size={15} className="shrink-0 group-hover:text-[#8B949E]" />
                      <span className="truncate flex-1">{mod.label}</span>
                      <span className="text-[8px] font-bold border border-[#30363D] text-[#30363D] group-hover:border-[#484F58] group-hover:text-[#484F58] rounded px-1 py-0.5 shrink-0 transition-colors">
                        ACTIVER
                      </span>
                    </Link>
                  )
                })}
              </>
            )}
          </>
        )}

        {!loaded && (
          <div className="space-y-1 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-[#21262D] animate-pulse mx-1" />
            ))}
          </div>
        )}
      </nav>

      {/* Bas */}
      <div className="px-2 py-3 border-t border-[#30363D] shrink-0 space-y-0.5">

        {/* Équipe — owner + Direction Générale école */}
        {(isOwner || ecoleRole === 'DIRECTION_GENERALE') && (
          <Link
            href="/dashboard/equipe"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive('/dashboard/equipe')
                ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
            }`}
          >
            <UsersRound size={15} className="shrink-0" />
            <span>{t('nav.team')}</span>
          </Link>
        )}

        {/* Rôles — owner + Direction Générale école */}
        {(isOwner || ecoleRole === 'DIRECTION_GENERALE') && (
          <Link
            href="/dashboard/roles"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive('/dashboard/roles')
                ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
            }`}
          >
            <ShieldCheck size={15} className="shrink-0" />
            <span>{t('nav.roles')}</span>
          </Link>
        )}

        {/* Modules store — uniquement pour les tenants sans secteur */}
        {isOwner && !secteur && (
          <Link
            href="/dashboard/modules"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive('/dashboard/modules')
                ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
            }`}
          >
            <Store size={15} className="shrink-0" />
            <span>{t('nav.modules')}</span>
          </Link>
        )}

        <Link
          href="/dashboard/parametres"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
            isActive('/dashboard/parametres')
              ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
              : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
          }`}
        >
          <Settings size={15} className="shrink-0" />
          <span>Paramètres</span>
        </Link>

        {isSuperAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#F85149] hover:bg-[#F85149]/5 transition-all"
          >
            <ShieldAlert size={15} className="shrink-0" />
            <span>Admin oraforme</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F85149] animate-pulse" />
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#8B949E] hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={15} className="shrink-0" />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-[#161B22] border-r border-[#30363D] h-screen sticky top-0">
        <SidebarContent />
      </aside>

      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#161B22] border border-[#30363D] text-[#8B949E]"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-[#161B22] border-r border-[#30363D] h-full">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
