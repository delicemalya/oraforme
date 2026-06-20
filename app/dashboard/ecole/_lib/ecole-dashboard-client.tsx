'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  GraduationCap, Users, UserX, CalendarCheck, BookOpen,
  TrendingUp, Wallet, AlertTriangle, Clock, CheckCircle,
  FileText, Award, BarChart2, Bell, Plus, Download,
  ChevronRight, Activity, Star, ShieldCheck, Zap, Settings2,
} from 'lucide-react'
import type { EcoleRole, EcoleKpis } from '../page'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

function pct(n: number, total: number) {
  if (!total) return 0
  return Math.round((n / total) * 100)
}

function fade(i: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, delay: i * 0.06, ease: 'easeOut' as const },
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, href, i,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string
  color: string; href?: string; i: number
}) {
  const inner = (
    <div style={{
      padding: 20,
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      height: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {href && <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, opacity: 0.7 }}>{sub}</div>}
    </div>
  )
  return (
    <motion.div {...fade(i)}>
      {href ? <Link href={href} style={{ display: 'block', height: '100%' }}>{inner}</Link> : inner}
    </motion.div>
  )
}

function QuickAction({ icon: Icon, label, href, color }: { icon: React.ElementType; label: string; href: string; color: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textDecoration: 'none',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#DC2626' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)' }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${color}18` }}>
        <Icon size={15} style={{ color }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <ChevronRight size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
    </Link>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function AlertPill({ text, type }: { text: string; type: 'warn' | 'info' | 'ok' }) {
  const s = {
    warn: { bg: 'rgba(245,30,51,0.08)',   border: 'rgba(245,30,51,0.2)',   color: '#DC2626', Icon: AlertTriangle },
    info: { bg: 'rgba(245,30,51,0.08)',   border: 'rgba(245,30,51,0.2)',   color: '#DC2626', Icon: Bell },
    ok:   { bg: 'rgba(139,0,112,0.08)',   border: 'rgba(139,0,112,0.2)',   color: '#7C3AED', Icon: CheckCircle },
  }[type]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: `1px solid ${s.border}`, background: s.bg, fontSize: 12, color: s.color }}>
      <s.Icon size={12} />
      {text}
    </div>
  )
}

// ── ROLE VIEWS ────────────────────────────────────────────────────────────────

function DirectionView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  const tauxPresence = pct(k.nbActifs - k.nbAbsencesJour, k.nbActifs)
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Direction Générale</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole} — vue d&apos;ensemble</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {k.nbNotifs > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(245,30,51,0.1)', border: '1px solid rgba(245,30,51,0.2)', color: '#DC2626', fontSize: 12 }}>
              <Bell size={11} />
              {k.nbNotifs} alerte{k.nbNotifs > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </motion.div>

      <div>
        <SectionTitle title="Académique" sub="Données en temps réel" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard i={1} icon={GraduationCap} label="Étudiants inscrits"   value={k.nbEtudiants}    sub={`${k.nbActifs} actifs`}           color="#DC2626" href="/dashboard/ecole/scolarite" />
          <StatCard i={2} icon={Users}          label="Enseignants"          value={k.nbEnseignants}  sub="Personnel pédagogique"            color="#DC2626" href="/dashboard/ecole/rh" />
          <StatCard i={3} icon={UserX}          label="Absences aujourd'hui" value={k.nbAbsencesJour} sub={`Taux présence ${tauxPresence}%`}  color="#DC2626" href="/dashboard/ecole/scolarite" />
          <StatCard i={4} icon={BookOpen}       label="Examens à venir"      value={k.nbExamensAvenir}sub="Sessions programmées"             color="#7C3AED" href="/dashboard/ecole/scolarite" />
        </div>
      </div>

      <div>
        <SectionTitle title="Finances" sub="Ce mois-ci" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard i={5} icon={TrendingUp}    label="Recettes du mois"     value={`${fmt(k.revenuMois)} F`}      sub="Paiements scolaires"           color="#DC2626" href="/dashboard/ecole/comptabilite" />
          <StatCard i={6} icon={AlertTriangle} label="Impayés en attente"   value={`${fmt(k.montantImpayes)} F`}  sub={`${k.nbPaiementsEnAttente} dossiers`} color="#DC2626" href="/dashboard/ecole/comptabilite" />
          <StatCard i={7} icon={Wallet}        label="Solde trésorerie"     value={`${fmt(k.soldeTresorerie)} F`} sub="Cumul du mois"                color="#DC2626" href="/dashboard/ecole/comptabilite" />
          <StatCard i={8} icon={Users}         label="Employés"             value={k.nbEmployes}                  sub={`${k.nbHeurePending} heures à valider`} color="#7C3AED" href="/dashboard/ecole/rh" />
        </div>
      </div>

      {(k.nbAbsencesJour > 0 || k.nbPaiementsEnAttente > 0 || k.nbHeurePending > 0) && (
        <motion.div {...fade(9)}>
          <SectionTitle title="Alertes du jour" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {k.nbAbsencesJour > 0 && <AlertPill type="warn" text={`${k.nbAbsencesJour} absence${k.nbAbsencesJour > 1 ? 's' : ''} enregistrée${k.nbAbsencesJour > 1 ? 's' : ''} aujourd'hui`} />}
            {k.nbPaiementsEnAttente > 0 && <AlertPill type="warn" text={`${k.nbPaiementsEnAttente} paiement${k.nbPaiementsEnAttente > 1 ? 's' : ''} en attente`} />}
            {k.nbHeurePending > 0 && <AlertPill type="info" text={`${k.nbHeurePending} déclaration${k.nbHeurePending > 1 ? 's' : ''} d'heures à valider`} />}
          </div>
        </motion.div>
      )}

      <motion.div {...fade(10)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickAction icon={Plus}          label="Ajouter un étudiant"    href="/dashboard/ecole/scolarite"               color="#DC2626" />
          <QuickAction icon={Users}         label="Ajouter un enseignant"  href="/dashboard/ecole/rh"                      color="#DC2626" />
          <QuickAction icon={CalendarCheck} label="Marquer les présences"  href="/dashboard/ecole/scolarite"               color="#7C3AED" />
          <QuickAction icon={Award}         label="Valider un diplôme"     href="/dashboard/ecole/direction"               color="#7C3AED" />
          <QuickAction icon={FileText}      label="Générer un bulletin"    href="/dashboard/ecole/scolarite"               color="#DC2626" />
          <QuickAction icon={Settings2}     label="Paramètres académiques" href="/dashboard/ecole/parametres-academiques"  color="#DC2626" />
        </div>
      </motion.div>
    </div>
  )
}

function RafView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>RAF — Finances & Trésorerie</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>

      <div>
        <SectionTitle title="Situation financière" sub="Ce mois-ci" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard i={1} icon={TrendingUp}    label="Recettes du mois"   value={`${fmt(k.revenuMois)} F`}      color="#DC2626" href="/dashboard/ecole/comptabilite" />
          <StatCard i={2} icon={AlertTriangle} label="Impayés en attente" value={`${fmt(k.montantImpayes)} F`}  color="#DC2626" sub={`${k.nbPaiementsEnAttente} dossiers`} href="/dashboard/ecole/comptabilite" />
          <StatCard i={3} icon={Wallet}        label="Solde trésorerie"   value={`${fmt(k.soldeTresorerie)} F`} color="#DC2626" href="/dashboard/ecole/comptabilite" />
          <StatCard i={4} icon={CheckCircle}   label="Heures à valider"   value={k.nbHeurePending}              color="#7C3AED" sub="Déclarations formateurs" href="/dashboard/ecole/rh" />
        </div>
      </div>

      <div>
        <SectionTitle title="RH & Paie" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard i={5} icon={Users} label="Total employés" value={k.nbEmployes}     color="#DC2626" href="/dashboard/ecole/rh" />
          <StatCard i={6} icon={Clock} label="Heures à payer" value={k.nbHeurePending} sub="En attente de validation" color="#DC2626" href="/dashboard/ecole/rh" />
        </div>
      </div>

      {k.nbPaiementsEnAttente > 0 && (
        <motion.div {...fade(7)}>
          <AlertPill type="warn" text={`${k.nbPaiementsEnAttente} paiement${k.nbPaiementsEnAttente > 1 ? 's' : ''} scolaire${k.nbPaiementsEnAttente > 1 ? 's' : ''} en attente`} />
        </motion.div>
      )}

      <motion.div {...fade(8)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={Wallet}      label="Trésorerie"        href="/dashboard/ecole/comptabilite" color="#DC2626" />
          <QuickAction icon={CheckCircle} label="Valider heures"    href="/dashboard/ecole/rh"           color="#7C3AED" />
          <QuickAction icon={Download}    label="Export paie"       href="/dashboard/ecole/rh"           color="#7C3AED" />
          <QuickAction icon={FileText}    label="Journal comptable" href="/dashboard/ecole/comptabilite" color="#DC2626" />
        </div>
      </motion.div>
    </div>
  )
}

function ScolariteView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  const tauxPresence = pct(k.nbActifs - k.nbAbsencesJour, k.nbActifs)
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Service Scolarité</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard i={1} icon={GraduationCap} label="Étudiants actifs"     value={k.nbActifs}         color="#DC2626" href="/dashboard/ecole/scolarite" />
        <StatCard i={2} icon={UserX}         label="Absences aujourd'hui" value={k.nbAbsencesJour}   color="#DC2626" sub={`Présence ${tauxPresence}%`} href="/dashboard/ecole/scolarite" />
        <StatCard i={3} icon={BookOpen}      label="Examens à venir"      value={k.nbExamensAvenir}  color="#7C3AED" href="/dashboard/ecole/scolarite" />
        <StatCard i={4} icon={Users}         label="Total inscrits"       value={k.nbEtudiants}      color="#DC2626" href="/dashboard/ecole/scolarite" />
      </div>

      <motion.div {...fade(5)} className="space-y-2">
        <SectionTitle title="Alertes & Rappels" />
        {k.nbAbsencesJour > 5 && <AlertPill type="warn" text={`Taux d'absence élevé : ${k.nbAbsencesJour} absents aujourd'hui`} />}
        {k.nbExamensAvenir > 0 && <AlertPill type="info" text={`${k.nbExamensAvenir} examen${k.nbExamensAvenir > 1 ? 's' : ''} programmé${k.nbExamensAvenir > 1 ? 's' : ''} à venir`} />}
        {k.nbAbsencesJour === 0 && <AlertPill type="ok" text="Aucune absence enregistrée aujourd'hui" />}
      </motion.div>

      <motion.div {...fade(6)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickAction icon={CalendarCheck} label="Marquer les présences" href="/dashboard/ecole/scolarite" color="#DC2626" />
          <QuickAction icon={Plus}          label="Ajouter un étudiant"   href="/dashboard/ecole/scolarite" color="#DC2626" />
          <QuickAction icon={FileText}      label="Générer un bulletin"   href="/dashboard/ecole/scolarite" color="#DC2626" />
          <QuickAction icon={BookOpen}      label="Créer un examen"       href="/dashboard/ecole/scolarite" color="#7C3AED" />
          <QuickAction icon={Award}         label="Attestations"          href="/dashboard/ecole/scolarite" color="#7C3AED" />
          <QuickAction icon={BarChart2}     label="Rapports absences"     href="/dashboard/ecole/scolarite" color="#DC2626" />
        </div>
      </motion.div>
    </div>
  )
}

function RhView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>RH & Paie</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard i={1} icon={Users} label="Total employés"   value={k.nbEmployes}     color="#DC2626" href="/dashboard/ecole/rh" />
        <StatCard i={2} icon={Users} label="Enseignants"      value={k.nbEnseignants}  color="#DC2626" href="/dashboard/ecole/rh" />
        <StatCard i={3} icon={Clock} label="Heures à valider" value={k.nbHeurePending} color="#DC2626" sub="Déclarations en attente" href="/dashboard/ecole/rh" />
      </div>

      {k.nbHeurePending > 0 && (
        <motion.div {...fade(4)}>
          <AlertPill type="warn" text={`${k.nbHeurePending} déclaration${k.nbHeurePending > 1 ? 's' : ''} d'heures en attente de validation`} />
        </motion.div>
      )}

      <motion.div {...fade(5)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={CheckCircle} label="Valider heures formateurs" href="/dashboard/ecole/rh" color="#7C3AED" />
          <QuickAction icon={Plus}        label="Ajouter un employé"        href="/dashboard/ecole/rh" color="#DC2626" />
          <QuickAction icon={FileText}    label="Bulletin de paie"          href="/dashboard/ecole/rh" color="#DC2626" />
          <QuickAction icon={Download}    label="Exporter le livre de paie" href="/dashboard/ecole/rh" color="#7C3AED" />
        </div>
      </motion.div>
    </div>
  )
}

function FormateurView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  const pctValidees = k.myHeuresTotales > 0
    ? Math.round((k.myHeuresValidees / k.myHeuresTotales) * 100)
    : 0

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Mon espace Formateur</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard i={1} icon={Clock}       label="Heures déclarées" value={k.myHeuresTotales}  color="#DC2626" />
        <StatCard i={2} icon={CheckCircle} label="Heures validées"  value={k.myHeuresValidees} color="#7C3AED" sub={`${pctValidees}% validées`} />
        <StatCard i={3} icon={BookOpen}    label="Examens à venir"  value={k.nbExamensAvenir}  color="#DC2626" href="/dashboard/ecole/scolarite" />
      </div>

      {k.myHeuresTotales > 0 && (
        <motion.div {...fade(4)} style={{ padding: 16, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <span>Heures validées</span>
            <span style={{ color: '#DC2626', fontWeight: 600 }}>{pctValidees}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#DC2626', borderRadius: 999, width: `${pctValidees}%`, transition: 'width 0.4s ease' }} />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8 }}>
            {k.myHeuresValidees}h validées / {k.myHeuresTotales}h déclarées
          </p>
        </motion.div>
      )}

      <motion.div {...fade(5)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={Plus}     label="Déclarer des heures" href="/dashboard/ecole/rh"        color="#DC2626" />
          <QuickAction icon={BookOpen} label="Mes cours"           href="/dashboard/ecole/scolarite" color="#DC2626" />
          <QuickAction icon={FileText} label="Créer un examen"     href="/dashboard/ecole/scolarite" color="#7C3AED" />
          <QuickAction icon={Download} label="Mes paiements"       href="/dashboard/ecole/rh"        color="#7C3AED" />
        </div>
      </motion.div>
    </div>
  )
}

function EtudiantView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  const moyenneColor = k.myNotesMoyenne === null ? '#7C3AED'
    : k.myNotesMoyenne >= 14 ? '#DC2626'
    : k.myNotesMoyenne >= 10 ? '#7C3AED'
    : '#DC2626'

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Mon espace Étudiant</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard i={1}
          icon={Star}
          label="Moyenne générale"
          value={k.myNotesMoyenne !== null ? `${k.myNotesMoyenne.toFixed(2)}/20` : 'N/A'}
          color={moyenneColor}
        />
        <StatCard i={2} icon={UserX}       label="Mes absences"    value={k.myAbsences}      color="#DC2626" />
        <StatCard i={3} icon={BookOpen}    label="Examens à venir" value={k.nbExamensAvenir}  color="#DC2626" href="/dashboard/ecole/espace-etudiant" />
        <StatCard i={4}
          icon={k.myPaiementOk ? CheckCircle : AlertTriangle}
          label="Scolarité"
          value={k.myPaiementOk === null ? 'N/A' : k.myPaiementOk ? 'À jour' : 'En attente'}
          color={k.myPaiementOk ? '#7C3AED' : '#DC2626'}
        />
      </div>

      {k.myPaiementOk === false && (
        <motion.div {...fade(5)}>
          <AlertPill type="warn" text="Votre dossier de paiement est en attente. Rapprochez-vous du service scolarité." />
        </motion.div>
      )}

      <motion.div {...fade(6)}>
        <SectionTitle title="Accès rapide" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={FileText}      label="Mes bulletins"  href="/dashboard/ecole/espace-etudiant" color="#DC2626" />
          <QuickAction icon={BookOpen}      label="Mes cours"      href="/dashboard/ecole/espace-etudiant" color="#DC2626" />
          <QuickAction icon={CalendarCheck} label="Mon planning"   href="/dashboard/ecole/espace-etudiant" color="#7C3AED" />
          <QuickAction icon={Download}      label="Mon attestation"href="/dashboard/ecole/espace-etudiant" color="#7C3AED" />
        </div>
      </motion.div>
    </div>
  )
}

function ParentView({ _k, nomEcole }: { _k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Espace Parent</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>

      <motion.div {...fade(1)} style={{ padding: 20, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(139,0,112,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={16} style={{ color: '#7C3AED' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Suivi en temps réel</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Consultez le dossier de votre enfant</div>
          </div>
        </div>
        <Link
          href="/dashboard/ecole/espace-parent"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(139,0,112,0.1)', color: '#7C3AED', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
        >
          Accéder à l&apos;espace parent <ChevronRight size={14} />
        </Link>
      </motion.div>

      <motion.div {...fade(2)}>
        <SectionTitle title="Accès rapide" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={UserX}         label="Présences & absences" href="/dashboard/ecole/espace-parent" color="#DC2626" />
          <QuickAction icon={FileText}      label="Bulletins de notes"   href="/dashboard/ecole/espace-parent" color="#DC2626" />
          <QuickAction icon={AlertTriangle} label="Alertes"              href="/dashboard/ecole/espace-parent" color="#DC2626" />
          <QuickAction icon={CalendarCheck} label="Emploi du temps"      href="/dashboard/ecole/espace-parent" color="#7C3AED" />
        </div>
      </motion.div>
    </div>
  )
}

function DtiView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>DTI — Technologies</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard i={1} icon={Users}       label="Comptes actifs"   value={k.nbActifs}  color="#DC2626" />
        <StatCard i={2} icon={ShieldCheck} label="Rôles configurés" value="OK"          color="#7C3AED" />
        <StatCard i={3} icon={Zap}         label="Notifications"    value={k.nbNotifs}  color="#DC2626" />
      </div>
      <motion.div {...fade(4)}>
        <SectionTitle title="Administration" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={ShieldCheck} label="Gérer les rôles"    href="/dashboard/roles"      color="#7C3AED" />
          <QuickAction icon={Users}       label="Équipe & comptes"   href="/dashboard/equipe"     color="#DC2626" />
          <QuickAction icon={Bell}        label="Notifications"      href="/dashboard/parametres" color="#DC2626" />
          <QuickAction icon={Activity}    label="Paramètres système" href="/dashboard/parametres" color="#7C3AED" />
        </div>
      </motion.div>
    </div>
  )
}

function DaacView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>DAAC — Affaires Académiques</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nomEcole}</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard i={1} icon={GraduationCap} label="Étudiants inscrits" value={k.nbEtudiants}     color="#DC2626" href="/dashboard/ecole/scolarite" />
        <StatCard i={2} icon={Users}         label="Enseignants"        value={k.nbEnseignants}   color="#DC2626" href="/dashboard/ecole/rh" />
        <StatCard i={3} icon={BookOpen}      label="Examens à venir"    value={k.nbExamensAvenir} color="#DC2626" href="/dashboard/ecole/scolarite" />
        <StatCard i={4} icon={Award}         label="Diplômes en attente"value="—"                color="#7C3AED" href="/dashboard/ecole/direction" />
      </div>
      <motion.div {...fade(5)}>
        <SectionTitle title="Actions académiques" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickAction icon={Award}         label="Diplômes & soutenances"   href="/dashboard/ecole/direction"               color="#DC2626" />
          <QuickAction icon={BookOpen}      label="Programmes & sessions"    href="/dashboard/ecole/scolarite"               color="#DC2626" />
          <QuickAction icon={FileText}      label="Attestations"             href="/dashboard/ecole/scolarite"               color="#7C3AED" />
          <QuickAction icon={BarChart2}     label="Statistiques académiques" href="/dashboard/ecole/direction"               color="#7C3AED" />
          <QuickAction icon={GraduationCap} label="Étudiants"               href="/dashboard/ecole/scolarite"               color="#DC2626" />
          <QuickAction icon={Settings2}     label="Paramètres académiques"  href="/dashboard/ecole/parametres-academiques"  color="#DC2626" />
        </div>
      </motion.div>
    </div>
  )
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

const ROLE_BADGE: Record<EcoleRole, { label: string; color: string }> = {
  DIRECTION_GENERALE: { label: 'Direction Générale', color: '#DC2626' },
  RAF:                { label: 'RAF',                 color: '#DC2626' },
  SCOLARITE:          { label: 'Scolarité',           color: '#7C3AED' },
  RH_PAIE:            { label: 'RH & Paie',           color: '#7C3AED' },
  FORMATEUR:          { label: 'Formateur',           color: '#DC2626' },
  ETUDIANT:           { label: 'Étudiant',            color: '#7C3AED' },
  PARENT:             { label: 'Parent',              color: '#DC2626' },
  DTI:                { label: 'DTI',                 color: '#DC2626' },
  DAAC:               { label: 'DAAC',                color: '#DC2626' },
}

export default function EcoleDashboardClient({
  role, nomEcole, kpis,
}: {
  role: EcoleRole
  nomEcole: string
  isFinancial: boolean
  kpis: EcoleKpis
}) {
  const badge = ROLE_BADGE[role]

  return (
    <div className="pb-8">
      {/* Role badge */}
      <motion.div {...fade(0)} style={{ marginBottom: 20 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
            color: badge.color,
            borderColor: `${badge.color}30`,
            border: `1px solid ${badge.color}30`,
            background: `${badge.color}10`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.color, display: 'inline-block' }} />
          {badge.label}
        </span>
      </motion.div>

      {/* Role-specific view */}
      {role === 'DIRECTION_GENERALE' && <DirectionView k={kpis} nomEcole={nomEcole} />}
      {role === 'RAF'                && <RafView       k={kpis} nomEcole={nomEcole} />}
      {role === 'SCOLARITE'          && <ScolariteView k={kpis} nomEcole={nomEcole} />}
      {role === 'RH_PAIE'            && <RhView        k={kpis} nomEcole={nomEcole} />}
      {role === 'FORMATEUR'          && <FormateurView k={kpis} nomEcole={nomEcole} />}
      {role === 'ETUDIANT'           && <EtudiantView  k={kpis} nomEcole={nomEcole} />}
      {role === 'PARENT'             && <ParentView    _k={kpis} nomEcole={nomEcole} />}
      {role === 'DTI'                && <DtiView       k={kpis} nomEcole={nomEcole} />}
      {role === 'DAAC'               && <DaacView      k={kpis} nomEcole={nomEcole} />}
    </div>
  )
}
