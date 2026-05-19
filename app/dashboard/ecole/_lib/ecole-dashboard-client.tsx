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
    <div className="p-5 bg-[#161B22] border border-[#21262D] rounded-xl hover:border-[#30363D] transition-all group h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {href && <ChevronRight size={14} className="text-[#484F58] group-hover:text-[#8B949E] transition-colors" />}
      </div>
      <div className="text-2xl font-bold text-[#E6EDF3] mb-0.5">{value}</div>
      <div className="text-xs text-[#8B949E]">{label}</div>
      {sub && <div className="text-[10px] text-[#484F58] mt-0.5">{sub}</div>}
    </div>
  )
  return (
    <motion.div {...fade(i)}>
      {href ? <Link href={href}>{inner}</Link> : inner}
    </motion.div>
  )
}

function QuickAction({ icon: Icon, label, href, color }: { icon: React.ElementType; label: string; href: string; color: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 bg-[#161B22] border border-[#21262D] rounded-xl hover:border-[#30363D] transition-all group"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon size={15} style={{ color }} />
      </div>
      <span className="text-sm text-[#8B949E] group-hover:text-[#E6EDF3] transition-colors truncate">{label}</span>
      <ChevronRight size={12} className="ml-auto text-[#484F58] shrink-0 group-hover:text-[#8B949E]" />
    </Link>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-[#E6EDF3]">{title}</h2>
      {sub && <p className="text-xs text-[#8B949E] mt-0.5">{sub}</p>}
    </div>
  )
}

function AlertPill({ text, type }: { text: string; type: 'warn' | 'info' | 'ok' }) {
  const styles = {
    warn: 'bg-[#F0A30A]/8 border-[#F0A30A]/20 text-[#F0A30A]',
    info: 'bg-blue-500/8 border-blue-500/20 text-blue-400',
    ok:   'bg-[#0D2147]/8 border-[#0D2147]/20 text-[#0D2147]',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${styles[type]}`}>
      {type === 'warn' ? <AlertTriangle size={12} /> : type === 'ok' ? <CheckCircle size={12} /> : <Bell size={12} />}
      {text}
    </div>
  )
}

// ── ROLE VIEWS ────────────────────────────────────────────────────────────────

function DirectionView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  const tauxPresence = pct(k.nbActifs - k.nbAbsencesJour, k.nbActifs)
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div {...fade(0)} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#E6EDF3]">Direction Générale</h1>
          <p className="text-sm text-[#8B949E]">{nomEcole} — vue d&apos;ensemble</p>
        </div>
        <div className="flex items-center gap-2">
          {k.nbNotifs > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F0A30A]/10 border border-[#F0A30A]/20 text-[#F0A30A] text-xs">
              <Bell size={11} />
              {k.nbNotifs} alerte{k.nbNotifs > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </motion.div>

      {/* KPIs académiques */}
      <div>
        <SectionTitle title="Académique" sub="Données en temps réel" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard i={1} icon={GraduationCap} label="Étudiants inscrits"  value={k.nbEtudiants}    sub={`${k.nbActifs} actifs`}        color="#F0A30A" href="/dashboard/ecole/scolarite" />
          <StatCard i={2} icon={Users}          label="Enseignants"         value={k.nbEnseignants}  sub="Personnel pédagogique"         color="#F07900" href="/dashboard/ecole/rh" />
          <StatCard i={3} icon={UserX}          label="Absences aujourd'hui"value={k.nbAbsencesJour} sub={`Taux présence ${tauxPresence}%`} color="#F01F38" href="/dashboard/ecole/scolarite" />
          <StatCard i={4} icon={BookOpen}        label="Examens à venir"    value={k.nbExamensAvenir}sub="Sessions programmées"          color="#0D2147" href="/dashboard/ecole/scolarite" />
        </div>
      </div>

      {/* KPIs financiers */}
      <div>
        <SectionTitle title="Finances" sub="Ce mois-ci" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard i={5} icon={TrendingUp} label="Recettes du mois"     value={`${fmt(k.revenuMois)} F`}     sub="Paiements scolaires"    color="#0D2147" href="/dashboard/ecole/comptabilite" />
          <StatCard i={6} icon={AlertTriangle} label="Impayés en attente" value={`${fmt(k.montantImpayes)} F`} sub={`${k.nbPaiementsEnAttente} dossiers`} color="#F0A30A" href="/dashboard/ecole/comptabilite" />
          <StatCard i={7} icon={Wallet}      label="Solde trésorerie"    value={`${fmt(k.soldeTresorerie)} F`} sub="Cumul du mois"          color="#F07900" href="/dashboard/ecole/comptabilite" />
          <StatCard i={8} icon={Users}       label="Employés"            value={k.nbEmployes}                  sub={`${k.nbHeurePending} heures à valider`} color="#8B0073" href="/dashboard/ecole/rh" />
        </div>
      </div>

      {/* Alertes */}
      {(k.nbAbsencesJour > 0 || k.nbPaiementsEnAttente > 0 || k.nbHeurePending > 0) && (
        <motion.div {...fade(9)}>
          <SectionTitle title="Alertes du jour" />
          <div className="flex flex-wrap gap-2">
            {k.nbAbsencesJour > 0 && <AlertPill type="warn" text={`${k.nbAbsencesJour} absence${k.nbAbsencesJour > 1 ? 's' : ''} enregistrée${k.nbAbsencesJour > 1 ? 's' : ''} aujourd'hui`} />}
            {k.nbPaiementsEnAttente > 0 && <AlertPill type="warn" text={`${k.nbPaiementsEnAttente} paiement${k.nbPaiementsEnAttente > 1 ? 's' : ''} en attente`} />}
            {k.nbHeurePending > 0 && <AlertPill type="info" text={`${k.nbHeurePending} déclaration${k.nbHeurePending > 1 ? 's' : ''} d'heures à valider`} />}
          </div>
        </motion.div>
      )}

      {/* Actions rapides */}
      <motion.div {...fade(10)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickAction icon={Plus}          label="Ajouter un étudiant"    href="/dashboard/ecole/scolarite"                    color="#F0A30A" />
          <QuickAction icon={Users}         label="Ajouter un enseignant"  href="/dashboard/ecole/rh"                           color="#F07900" />
          <QuickAction icon={CalendarCheck} label="Marquer les présences"  href="/dashboard/ecole/scolarite"                    color="#0D2147" />
          <QuickAction icon={Award}         label="Valider un diplôme"     href="/dashboard/ecole/direction"                    color="#8B0073" />
          <QuickAction icon={FileText}      label="Générer un bulletin"    href="/dashboard/ecole/scolarite"                    color="#0D2147" />
          <QuickAction icon={Settings2}     label="Paramètres académiques" href="/dashboard/ecole/parametres-academiques"       color="#EF4444" />
        </div>
      </motion.div>
    </div>
  )
}

function RafView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 className="text-xl font-bold text-[#E6EDF3]">RAF — Finances & Trésorerie</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>

      <div>
        <SectionTitle title="Situation financière" sub="Ce mois-ci" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard i={1} icon={TrendingUp}    label="Recettes du mois"    value={`${fmt(k.revenuMois)} F`}     color="#0D2147" href="/dashboard/ecole/comptabilite" />
          <StatCard i={2} icon={AlertTriangle} label="Impayés en attente"  value={`${fmt(k.montantImpayes)} F`} color="#F0A30A" sub={`${k.nbPaiementsEnAttente} dossiers`} href="/dashboard/ecole/comptabilite" />
          <StatCard i={3} icon={Wallet}        label="Solde trésorerie"    value={`${fmt(k.soldeTresorerie)} F`} color="#F07900" href="/dashboard/ecole/comptabilite" />
          <StatCard i={4} icon={CheckCircle}   label="Heures à valider"    value={k.nbHeurePending}              color="#8B0073" sub="Déclarations formateurs" href="/dashboard/ecole/rh" />
        </div>
      </div>

      <div>
        <SectionTitle title="RH & Paie" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard i={5} icon={Users}  label="Total employés" value={k.nbEmployes}  color="#F0A30A" href="/dashboard/ecole/rh" />
          <StatCard i={6} icon={Clock}  label="Heures à payer" value={k.nbHeurePending} sub="En attente de validation" color="#F01F38" href="/dashboard/ecole/rh" />
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
          <QuickAction icon={Wallet}    label="Trésorerie"           href="/dashboard/ecole/comptabilite" color="#F07900" />
          <QuickAction icon={CheckCircle} label="Valider heures"     href="/dashboard/ecole/rh"           color="#0D2147" />
          <QuickAction icon={Download}  label="Export paie"          href="/dashboard/ecole/rh"           color="#8B0073" />
          <QuickAction icon={FileText}  label="Journal comptable"    href="/dashboard/ecole/comptabilite" color="#F0A30A" />
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
        <h1 className="text-xl font-bold text-[#E6EDF3]">Service Scolarité</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard i={1} icon={GraduationCap} label="Étudiants actifs"     value={k.nbActifs}          color="#F0A30A" href="/dashboard/ecole/scolarite" />
        <StatCard i={2} icon={UserX}         label="Absences aujourd'hui" value={k.nbAbsencesJour}    color="#F01F38" sub={`Présence ${tauxPresence}%`} href="/dashboard/ecole/scolarite" />
        <StatCard i={3} icon={BookOpen}      label="Examens à venir"      value={k.nbExamensAvenir}   color="#0D2147" href="/dashboard/ecole/scolarite" />
        <StatCard i={4} icon={Users}         label="Total inscrits"        value={k.nbEtudiants}       color="#F07900" href="/dashboard/ecole/scolarite" />
      </div>

      {/* Alertes du jour */}
      <motion.div {...fade(5)} className="space-y-2">
        <SectionTitle title="Alertes & Rappels" />
        {k.nbAbsencesJour > 5 && <AlertPill type="warn" text={`Taux d'absence élevé : ${k.nbAbsencesJour} absents aujourd'hui`} />}
        {k.nbExamensAvenir > 0 && <AlertPill type="info" text={`${k.nbExamensAvenir} examen${k.nbExamensAvenir > 1 ? 's' : ''} programmé${k.nbExamensAvenir > 1 ? 's' : ''} à venir`} />}
        {k.nbAbsencesJour === 0 && <AlertPill type="ok" text="Aucune absence enregistrée aujourd'hui" />}
      </motion.div>

      <motion.div {...fade(6)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickAction icon={CalendarCheck} label="Marquer les présences"  href="/dashboard/ecole/scolarite" color="#F0A30A" />
          <QuickAction icon={Plus}          label="Ajouter un étudiant"    href="/dashboard/ecole/scolarite" color="#0D2147" />
          <QuickAction icon={FileText}      label="Générer un bulletin"    href="/dashboard/ecole/scolarite" color="#F07900" />
          <QuickAction icon={BookOpen}      label="Créer un examen"        href="/dashboard/ecole/scolarite" color="#8B0073" />
          <QuickAction icon={Award}         label="Attestations"           href="/dashboard/ecole/scolarite" color="#0D2147" />
          <QuickAction icon={BarChart2}     label="Rapports absences"      href="/dashboard/ecole/scolarite" color="#F97316" />
        </div>
      </motion.div>
    </div>
  )
}

function RhView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 className="text-xl font-bold text-[#E6EDF3]">RH & Paie</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard i={1} icon={Users}   label="Total employés"        value={k.nbEmployes}      color="#F0A30A" href="/dashboard/ecole/rh" />
        <StatCard i={2} icon={Users}   label="Enseignants"           value={k.nbEnseignants}   color="#F07900" href="/dashboard/ecole/rh" />
        <StatCard i={3} icon={Clock}   label="Heures à valider"      value={k.nbHeurePending}  color="#F01F38" sub="Déclarations en attente" href="/dashboard/ecole/rh" />
      </div>

      {k.nbHeurePending > 0 && (
        <motion.div {...fade(4)}>
          <AlertPill type="warn" text={`${k.nbHeurePending} déclaration${k.nbHeurePending > 1 ? 's' : ''} d'heures en attente de validation`} />
        </motion.div>
      )}

      <motion.div {...fade(5)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={CheckCircle} label="Valider heures formateurs" href="/dashboard/ecole/rh"     color="#0D2147" />
          <QuickAction icon={Plus}        label="Ajouter un employé"         href="/dashboard/ecole/rh"     color="#F0A30A" />
          <QuickAction icon={FileText}    label="Bulletin de paie"           href="/dashboard/ecole/rh"     color="#F07900" />
          <QuickAction icon={Download}    label="Exporter le livre de paie"  href="/dashboard/ecole/rh"     color="#8B0073" />
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
        <h1 className="text-xl font-bold text-[#E6EDF3]">Mon espace Formateur</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard i={1} icon={Clock}        label="Heures déclarées"   value={k.myHeuresTotales}  color="#F0A30A" />
        <StatCard i={2} icon={CheckCircle}  label="Heures validées"    value={k.myHeuresValidees} color="#0D2147" sub={`${pctValidees}% validées`} />
        <StatCard i={3} icon={BookOpen}     label="Examens à venir"    value={k.nbExamensAvenir}  color="#F07900" href="/dashboard/ecole/scolarite" />
      </div>

      {/* Progress bar heures */}
      {k.myHeuresTotales > 0 && (
        <motion.div {...fade(4)} className="p-4 bg-[#161B22] border border-[#21262D] rounded-xl">
          <div className="flex justify-between text-xs text-[#8B949E] mb-2">
            <span>Heures validées</span>
            <span className="text-[#0D2147] font-medium">{pctValidees}%</span>
          </div>
          <div className="h-2 bg-[#21262D] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0D2147] rounded-full transition-all"
              style={{ width: `${pctValidees}%` }}
            />
          </div>
          <p className="text-xs text-[#484F58] mt-2">
            {k.myHeuresValidees}h validées / {k.myHeuresTotales}h déclarées
          </p>
        </motion.div>
      )}

      <motion.div {...fade(5)}>
        <SectionTitle title="Actions rapides" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={Plus}      label="Déclarer des heures"   href="/dashboard/ecole/rh"         color="#F0A30A" />
          <QuickAction icon={BookOpen}  label="Mes cours"             href="/dashboard/ecole/scolarite"  color="#F07900" />
          <QuickAction icon={FileText}  label="Créer un examen"       href="/dashboard/ecole/scolarite"  color="#0D2147" />
          <QuickAction icon={Download}  label="Mes paiements"         href="/dashboard/ecole/rh"         color="#8B0073" />
        </div>
      </motion.div>
    </div>
  )
}

function EtudiantView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  const moyenneColor = k.myNotesMoyenne === null ? '#8B949E'
    : k.myNotesMoyenne >= 14 ? '#0D2147'
    : k.myNotesMoyenne >= 10 ? '#F0A30A'
    : '#F01F38'

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 className="text-xl font-bold text-[#E6EDF3]">Mon espace Étudiant</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard i={1}
          icon={Star}
          label="Moyenne générale"
          value={k.myNotesMoyenne !== null ? `${k.myNotesMoyenne.toFixed(2)}/20` : 'N/A'}
          color={moyenneColor}
        />
        <StatCard i={2} icon={UserX}       label="Mes absences"      value={k.myAbsences}     color="#F01F38" />
        <StatCard i={3} icon={BookOpen}    label="Examens à venir"   value={k.nbExamensAvenir} color="#F07900" href="/dashboard/ecole/espace-etudiant" />
        <StatCard i={4}
          icon={k.myPaiementOk ? CheckCircle : AlertTriangle}
          label="Scolarité"
          value={k.myPaiementOk === null ? 'N/A' : k.myPaiementOk ? 'À jour' : 'En attente'}
          color={k.myPaiementOk ? '#0D2147' : '#F0A30A'}
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
          <QuickAction icon={FileText}  label="Mes bulletins"       href="/dashboard/ecole/espace-etudiant" color="#F0A30A" />
          <QuickAction icon={BookOpen}  label="Mes cours"           href="/dashboard/ecole/espace-etudiant" color="#F07900" />
          <QuickAction icon={CalendarCheck} label="Mon planning"   href="/dashboard/ecole/espace-etudiant" color="#0D2147" />
          <QuickAction icon={Download}  label="Mon attestation"    href="/dashboard/ecole/espace-etudiant" color="#8B0073" />
        </div>
      </motion.div>
    </div>
  )
}

function ParentView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 className="text-xl font-bold text-[#E6EDF3]">Espace Parent</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>

      <motion.div {...fade(1)} className="p-5 bg-[#161B22] border border-[#21262D] rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[#EC4899]/15 flex items-center justify-center">
            <Activity size={16} className="text-[#EC4899]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#E6EDF3]">Suivi en temps réel</div>
            <div className="text-xs text-[#8B949E]">Consultez le dossier de votre enfant</div>
          </div>
        </div>
        <Link
          href="/dashboard/ecole/espace-parent"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EC4899]/10 text-[#EC4899] text-sm font-medium hover:bg-[#EC4899]/15 transition-colors"
        >
          Accéder à l&apos;espace parent <ChevronRight size={14} />
        </Link>
      </motion.div>

      <motion.div {...fade(2)}>
        <SectionTitle title="Accès rapide" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={UserX}        label="Présences & absences"  href="/dashboard/ecole/espace-parent" color="#F0A30A" />
          <QuickAction icon={FileText}     label="Bulletins de notes"    href="/dashboard/ecole/espace-parent" color="#F07900" />
          <QuickAction icon={AlertTriangle}label="Alertes"               href="/dashboard/ecole/espace-parent" color="#F01F38" />
          <QuickAction icon={CalendarCheck}label="Emploi du temps"       href="/dashboard/ecole/espace-parent" color="#0D2147" />
        </div>
      </motion.div>
    </div>
  )
}

function DtiView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 className="text-xl font-bold text-[#E6EDF3]">DTI — Technologies</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard i={1} icon={Users}         label="Comptes actifs"     value={k.nbActifs}       color="#84CC16" />
        <StatCard i={2} icon={ShieldCheck}   label="Rôles configurés"   value="OK"               color="#0D2147" />
        <StatCard i={3} icon={Zap}           label="Notifications"       value={k.nbNotifs}      color="#F0A30A" />
      </div>
      <motion.div {...fade(4)}>
        <SectionTitle title="Administration" />
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={ShieldCheck} label="Gérer les rôles"    href="/dashboard/roles"           color="#84CC16" />
          <QuickAction icon={Users}       label="Équipe & comptes"   href="/dashboard/equipe"          color="#F0A30A" />
          <QuickAction icon={Bell}        label="Notifications"      href="/dashboard/parametres"      color="#F07900" />
          <QuickAction icon={Activity}    label="Paramètres système" href="/dashboard/parametres"      color="#8B0073" />
        </div>
      </motion.div>
    </div>
  )
}

function DaacView({ k, nomEcole }: { k: EcoleKpis; nomEcole: string }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div {...fade(0)}>
        <h1 className="text-xl font-bold text-[#E6EDF3]">DAAC — Affaires Académiques</h1>
        <p className="text-sm text-[#8B949E]">{nomEcole}</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard i={1} icon={GraduationCap} label="Étudiants inscrits" value={k.nbEtudiants}    color="#EF4444" href="/dashboard/ecole/scolarite" />
        <StatCard i={2} icon={Users}         label="Enseignants"        value={k.nbEnseignants}  color="#F0A30A" href="/dashboard/ecole/rh" />
        <StatCard i={3} icon={BookOpen}      label="Examens à venir"    value={k.nbExamensAvenir}color="#F07900" href="/dashboard/ecole/scolarite" />
        <StatCard i={4} icon={Award}         label="Diplômes en attente"value="—"               color="#8B0073" href="/dashboard/ecole/direction" />
      </div>
      <motion.div {...fade(5)}>
        <SectionTitle title="Actions académiques" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickAction icon={Award}         label="Diplômes & soutenances"  href="/dashboard/ecole/direction"                  color="#EF4444" />
          <QuickAction icon={BookOpen}      label="Programmes & sessions"   href="/dashboard/ecole/scolarite"                  color="#F07900" />
          <QuickAction icon={FileText}      label="Attestations"            href="/dashboard/ecole/scolarite"                  color="#0D2147" />
          <QuickAction icon={BarChart2}     label="Statistiques académiques" href="/dashboard/ecole/direction"                 color="#8B0073" />
          <QuickAction icon={GraduationCap} label="Étudiants"               href="/dashboard/ecole/scolarite"                 color="#F0A30A" />
          <QuickAction icon={Settings2}     label="Paramètres académiques"  href="/dashboard/ecole/parametres-academiques"    color="#0D2147" />
        </div>
      </motion.div>
    </div>
  )
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

const ROLE_BADGE: Record<EcoleRole, { label: string; color: string }> = {
  DIRECTION_GENERALE: { label: 'Direction Générale', color: '#F0A30A' },
  RAF:                { label: 'RAF',                 color: '#F07900' },
  SCOLARITE:          { label: 'Scolarité',           color: '#0D2147' },
  RH_PAIE:            { label: 'RH & Paie',          color: '#8B0073' },
  FORMATEUR:          { label: 'Formateur',           color: '#0D2147' },
  ETUDIANT:           { label: 'Étudiant',            color: '#EC4899' },
  PARENT:             { label: 'Parent',              color: '#F97316' },
  DTI:                { label: 'DTI',                 color: '#84CC16' },
  DAAC:               { label: 'DAAC',                color: '#EF4444' },
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
      <motion.div {...fade(0)} className="mb-5">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
          style={{
            color: badge.color,
            borderColor: `${badge.color}30`,
            background:  `${badge.color}10`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
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
      {role === 'PARENT'             && <ParentView    k={kpis} nomEcole={nomEcole} />}
      {role === 'DTI'                && <DtiView       k={kpis} nomEcole={nomEcole} />}
      {role === 'DAAC'               && <DaacView      k={kpis} nomEcole={nomEcole} />}
    </div>
  )
}
