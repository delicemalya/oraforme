'use client'

import { motion } from 'framer-motion'
import type { Enseignant, Etudiant } from '../../_lib/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmployeFull = {
  id: string; nom: string; postnom: string | null; prenom: string
  poste: string; departement: string | null; type_employe: string; statut: string
  salaire_base: number; prime_logement: number; prime_transport: number
  prime_risque: number; prime_rendement: number; taux_horaire: number | null
  photo_url: string | null; email_pro: string | null
  telephone: string | null; telephone2: string | null
  adresse: string | null; ville: string | null; pays: string | null
  date_debut_contrat: string | null; date_recrutement: string | null
  date_fin_contrat: string | null; nationalite: string | null
  sexe: string | null; date_naissance: string | null
  situation_matrimoniale: string | null; nb_enfants: number
  numero_cnss: string | null; numero_fiscal: string | null
  mode_paiement: string; banque: string | null; rib: string | null
  mobile_money_type: string | null; mobile_money_numero: string | null
  created_at: string
}

export type StaffFull = {
  id: string; nom: string; prenom: string; poste: string
  telephone: string | null; email: string | null; salaire: number
  statut: string; created_at: string; photo_url: string | null
  mobile_money_type: string | null; mobile_money_numero: string | null
  banque: string | null; rib: string | null; numero_cnss: string | null
}

export type ProfilPerson =
  | { type: 'employe';    data: EmployeFull }
  | { type: 'enseignant'; data: Enseignant  }
  | { type: 'etudiant';   data: Etudiant    }
  | { type: 'staff';      data: StaffFull   }

// ── Tokens ────────────────────────────────────────────────────────────────────

const G  = '#DC2626'
const BG = '#FFFFFF'
const CARD    = '#F9FAFB'
const BORDER  = '#E5E7EB'
const ORG_DIM = 'rgba(245,30,51,0.10)'
const ORG_BDR = 'rgba(245,30,51,0.22)'
const T1 = '#101729'
const T2 = '#6B7280'
const T3 = '#9CA3AF'
const GREEN  = '#16A34A'
const RED    = '#DC2626'
const BLUE   = '#00b9a7'
const PURPLE = '#ff7000'

const fmtN   = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtD   = (d: string | null | undefined) =>
  d ? new Date(d.includes('T') ? d : d + 'T00:00').toLocaleDateString('fr-FR') : '—'

// ── Micro components ──────────────────────────────────────────────────────────

function Avatar({ name, size = 78 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#DC2626',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size / 2.5, fontWeight: 800, color: '#FFFFFF',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function StatChip({
  label, value, sub, color = G, icon,
}: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
      padding: '14px 16px', transition: 'border-color .2s',
    }}>
      <p style={{ fontSize: 9, color: T3, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 7 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: T3, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px' }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: T1, marginBottom: 14 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: ORG_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{icon}</span>
        {title}
      </p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
      <span style={{ fontSize: 11, color: T3, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: value != null && value !== '' ? T1 : T3, textAlign: 'right' }}>
        {value != null && value !== '' ? String(value) : '—'}
      </span>
    </div>
  )
}

function PayRow({ label, value, color = T2, mono = false }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12, color: T2 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: mono ? "'JetBrains Mono',monospace" : 'inherit' }}>{value}</span>
    </div>
  )
}

function TlItem({ color, icon, text, time, last = false }: { color: string; icon: string; text: string; time: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', position: 'relative' }}>
      {!last && <div style={{ position: 'absolute', left: 10, top: 28, bottom: -9, width: 1, background: BORDER }} />}
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, zIndex: 1, color }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, color: T1, lineHeight: 1.4 }}>{text}</p>
        <p style={{ fontSize: 10, color: T3, marginTop: 2 }}>{time}</p>
      </div>
    </div>
  )
}

const DOCS = [
  { icon: '📄', label: "Pièce d'identité", hint: 'CNI ou passeport · PDF / image',  color: RED    },
  { icon: '📋', label: 'Contrat signé',    hint: 'Document PDF signé',               color: BLUE   },
  { icon: '🎓', label: 'Diplôme(s)',        hint: 'PDF ou scans',                    color: PURPLE },
  { icon: '📊', label: 'Attestations',      hint: 'Formations, habilitations',       color: GREEN  },
]

function DocList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DOCS.map(d => (
        <div key={d.label} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
          background: '#F9FAFB', border: `1px solid ${BORDER}`,
          borderRadius: 10, cursor: 'pointer',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: `${d.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{d.icon}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T1 }}>{d.label}</p>
            <p style={{ fontSize: 10, color: T3, marginTop: 2 }}>{d.hint}</p>
          </div>
          <span style={{ fontSize: 11, color: T3 }}>+ Ajouter</span>
        </div>
      ))}
    </div>
  )
}

// ── Profil Employé ────────────────────────────────────────────────────────────

function ProfilEmploye({ d }: { d: EmployeFull }) {
  const brut = (d.salaire_base || 0) + (d.prime_logement || 0) + (d.prime_transport || 0) + (d.prime_risque || 0) + (d.prime_rendement || 0)
  const since = d.date_recrutement
    ? Math.floor((Date.now() - new Date(d.date_recrutement).getTime()) / (365.25 * 24 * 3600e3))
    : null

  return (
    <>
      {/* KPI chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <StatChip label="Salaire brut"  value={fmtN(brut)} sub="FCFA / mois"  color={G}      icon="💰" />
        <StatChip label="Type contrat"  value={d.type_employe}                 color={PURPLE} icon="📋" />
        <StatChip label="Ancienneté"    value={since != null ? `${since} an${since !== 1 ? 's' : ''}` : '—'} color={BLUE} icon="📅" />
        <StatChip label="Statut"        value={d.statut}  color={d.statut === 'actif' ? RED : T2} icon="✦" />
      </div>

      {/* Rémunération détaillée */}
      <Card title="Rémunération" icon="💰">
        <div>
          {d.salaire_base    > 0 && <PayRow label="Salaire de base"  value={`${fmtN(d.salaire_base)} FCFA`}    color={T1}   mono />}
          {d.prime_logement  > 0 && <PayRow label="Prime logement"   value={`+${fmtN(d.prime_logement)} FCFA`}  color={GREEN} mono />}
          {d.prime_transport > 0 && <PayRow label="Prime transport"  value={`+${fmtN(d.prime_transport)} FCFA`} color={GREEN} mono />}
          {d.prime_risque    > 0 && <PayRow label="Prime de risque"  value={`+${fmtN(d.prime_risque)} FCFA`}    color={GREEN} mono />}
          {d.prime_rendement > 0 && <PayRow label="Prime rendement"  value={`+${fmtN(d.prime_rendement)} FCFA`} color={GREEN} mono />}
          {d.taux_horaire && d.taux_horaire > 0 && <PayRow label="Taux horaire" value={`${fmtN(d.taux_horaire)} FCFA/h`} color={BLUE} mono />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: `1px solid rgba(245,30,51,0.25)`, marginTop: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: T1 }}>SALAIRE BRUT</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: G, fontFamily: "'JetBrains Mono',monospace" }}>{fmtN(brut)} FCFA</span>
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InfoRow label="Mode paiement"  value={(d.mode_paiement || '').replace('_', ' ')} />
          <InfoRow label="Banque"         value={d.banque} />
          <InfoRow label="RIB"            value={d.rib} />
          <InfoRow label="Mobile Money"   value={d.mobile_money_type ? `${d.mobile_money_type} — ${d.mobile_money_numero ?? ''}` : null} />
          <InfoRow label="N° CNSS"        value={d.numero_cnss} />
          <InfoRow label="N° Fiscal NIF"  value={d.numero_fiscal} />
        </div>
      </Card>

      {/* Identité & Contrat */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card title="Identité civile" icon="👤">
          <InfoRow label="Sexe"                  value={d.sexe} />
          <InfoRow label="Date de naissance"     value={fmtD(d.date_naissance)} />
          <InfoRow label="Nationalité"           value={d.nationalite} />
          <InfoRow label="Situation mat."        value={d.situation_matrimoniale} />
          <InfoRow label="Nb enfants"            value={d.nb_enfants} />
          <InfoRow label="Adresse"               value={d.adresse} />
          <InfoRow label="Ville"                 value={d.ville} />
          <InfoRow label="Pays"                  value={d.pays} />
        </Card>
        <Card title="Contrat" icon="📋">
          <InfoRow label="Poste"           value={d.poste} />
          <InfoRow label="Département"     value={d.departement} />
          <InfoRow label="Type employé"    value={d.type_employe} />
          <InfoRow label="Date recrutement" value={fmtD(d.date_recrutement)} />
          <InfoRow label="Début contrat"   value={fmtD(d.date_debut_contrat)} />
          <InfoRow label="Fin contrat"     value={fmtD(d.date_fin_contrat)} />
          <InfoRow label="Téléphone 2"     value={d.telephone2} />
          <InfoRow label="Email pro"       value={d.email_pro} />
        </Card>
      </div>

      {/* Documents */}
      <Card title="Documents" icon="📁">
        <DocList />
      </Card>

      {/* Timeline */}
      <Card title="Historique" icon="⚡">
        <TlItem color={GREEN}  icon="✓" text={`Dossier enregistré — ${d.prenom} ${d.nom}`} time={fmtD(d.created_at)} />
        <TlItem color={G}      icon="💼" text={`${d.poste}${d.departement ? ` · ${d.departement}` : ''}`} time={fmtD(d.date_debut_contrat)} />
        <TlItem color={BLUE}   icon="💰" text={`Base salariale configurée : ${fmtN(d.salaire_base)} FCFA`} time="Mensuel" />
        <TlItem color={PURPLE} icon="📋" text={`Mode de paiement : ${(d.mode_paiement || '').replace('_', ' ')}`} time={d.banque ?? d.mobile_money_type ?? 'Non renseigné'} last />
      </Card>
    </>
  )
}

// ── Profil Enseignant ─────────────────────────────────────────────────────────

function ProfilEnseignant({ d }: { d: Enseignant }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <StatChip label="Salaire mensuel" value={d.salaire_mensuel ? fmtN(d.salaire_mensuel) : '—'} sub="FCFA"    color={G}      icon="💰" />
        <StatChip label="Taux horaire"    value={d.taux_horaire    ? fmtN(d.taux_horaire)    : '—'} sub="FCFA/h"  color={BLUE}   icon="⏱" />
        <StatChip label="Matière"         value={d.matiere ?? '—'}                                   color={PURPLE} icon="📚" />
        <StatChip label="Statut"          value={d.statut} color={d.statut === 'actif' ? RED : T2}               icon="✦" />
      </div>

      <Card title="Rémunération & Paiement" icon="💰">
        <div>
          {d.salaire_mensuel != null && <PayRow label="Salaire mensuel" value={`${fmtN(d.salaire_mensuel)} FCFA`} color={G}    mono />}
          {d.taux_horaire    != null && <PayRow label="Taux horaire"    value={`${fmtN(d.taux_horaire)} FCFA/h`}  color={BLUE} mono />}
        </div>
        {d.salaire_mensuel != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: `1px solid rgba(245,30,51,0.25)`, marginTop: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: T1 }}>TOTAL MENSUEL</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: G, fontFamily: "'JetBrains Mono',monospace" }}>{fmtN(d.salaire_mensuel)} FCFA</span>
          </div>
        )}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InfoRow label="Banque"       value={d.banque} />
          <InfoRow label="RIB"          value={d.rib} />
          <InfoRow label="Mobile Money" value={d.mobile_money_type} />
          <InfoRow label="Numéro MM"    value={d.mobile_money_numero} />
          <InfoRow label="N° CNSS"      value={d.numero_cnss} />
        </div>
      </Card>

      <Card title="Informations" icon="👤">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <InfoRow label="Prénom"     value={d.prenom} />
          <InfoRow label="Nom"        value={d.nom} />
          <InfoRow label="Téléphone"  value={d.telephone} />
          <InfoRow label="Email"      value={d.email} />
          <InfoRow label="Matière"    value={d.matiere} />
          <InfoRow label="Statut"     value={d.statut} />
        </div>
      </Card>

      <Card title="Documents" icon="📁">
        <DocList />
      </Card>

      <Card title="Historique" icon="⚡">
        <TlItem color={GREEN} icon="✓" text={`Formateur ${d.prenom} ${d.nom} enregistré`} time={fmtD(d.created_at)} />
        <TlItem color={G}     icon="📚" text={`Matière : ${d.matiere ?? 'Non définie'}`}   time="Affectation actuelle" />
        <TlItem color={BLUE}  icon="💳" text={`Rémunération configurée`} time={d.banque ? `Banque : ${d.banque}` : d.mobile_money_type ? `MM : ${d.mobile_money_type}` : 'Mode de paiement non renseigné'} last />
      </Card>
    </>
  )
}

// ── Profil Étudiant ───────────────────────────────────────────────────────────

function ProfilEtudiant({ d }: { d: Etudiant }) {
  const statusColor = d.statut === 'actif' ? GREEN : d.statut === 'diplome' ? PURPLE : RED
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <StatChip label="Niveau"      value={d.niveau}         color={BLUE}   icon="🏫" />
        <StatChip label="Classe"      value={d.classe ?? '—'}  color={G}      icon="📖" />
        <StatChip label="Année"       value={d.annee_scolaire} color={PURPLE} icon="📅" />
        <StatChip label="Statut"      value={d.statut}         color={statusColor} icon="✦" />
      </div>

      <Card title="Identité" icon="👤">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <InfoRow label="Prénom"            value={d.prenom} />
          <InfoRow label="Nom"               value={d.nom} />
          <InfoRow label="N° étudiant"       value={d.numero_id} />
          <InfoRow label="Date de naissance" value={fmtD(d.date_naissance)} />
          <InfoRow label="Lieu de naissance" value={d.lieu_naissance} />
          <InfoRow label="Nationalité"       value={d.nationalite} />
          <InfoRow label="Adresse"           value={d.adresse} />
          <InfoRow label="Niveau"            value={d.niveau} />
          <InfoRow label="Classe"            value={d.classe} />
          <InfoRow label="Année scolaire"    value={d.annee_scolaire} />
        </div>
      </Card>

      <Card title="Parents & Tuteur" icon="👨‍👩‍👦">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <InfoRow label="Père"              value={d.nom_pere} />
          <InfoRow label="Mère"              value={d.nom_mere} />
          <InfoRow label="Téléphone parent"  value={d.tel_parent} />
          <InfoRow label="Email parent"      value={d.email_parent} />
          <InfoRow label="Profession"        value={d.profession_parent} />
          <InfoRow label="Tuteur"            value={d.nom_tuteur} />
          <InfoRow label="Tél. tuteur"       value={d.tel_tuteur} />
          <InfoRow label="Lien tuteur"       value={d.lien_tuteur} />
        </div>
      </Card>

      <Card title="Documents" icon="📁">
        <DocList />
      </Card>

      <Card title="Historique" icon="⚡">
        <TlItem color={GREEN}  icon="🎓" text={`Inscription : ${d.prenom} ${d.nom}`} time={fmtD(d.created_at)} />
        <TlItem color={G}      icon="🏫" text={`Classe : ${d.classe ?? 'Non affectée'} — ${d.niveau}`} time={d.annee_scolaire} />
        <TlItem color={BLUE}   icon="👨‍👩‍👦" text={`Parent : ${[d.nom_pere, d.nom_mere].filter(Boolean).join(' / ') || 'Non renseigné'}`} time={d.tel_parent ?? '—'} last />
      </Card>
    </>
  )
}

// ── Profil Staff ──────────────────────────────────────────────────────────────

function ProfilStaff({ d }: { d: StaffFull }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <StatChip label="Salaire mensuel" value={fmtN(d.salaire)} sub="FCFA / mois"  color={G}      icon="💰" />
        <StatChip label="Poste"           value={d.poste}                             color={PURPLE} icon="💼" />
        <StatChip label="Statut"          value={d.statut} color={d.statut === 'actif' ? RED : T2} icon="✦" />
      </div>

      <Card title="Informations & Contact" icon="👤">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <InfoRow label="Prénom"     value={d.prenom} />
          <InfoRow label="Nom"        value={d.nom} />
          <InfoRow label="Poste"      value={d.poste} />
          <InfoRow label="Téléphone"  value={d.telephone} />
          <InfoRow label="Email"      value={d.email} />
          <InfoRow label="N° CNSS"    value={d.numero_cnss} />
        </div>
      </Card>

      <Card title="Paiement" icon="💳">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: `1px solid rgba(245,30,51,0.25)`, marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: T1 }}>SALAIRE MENSUEL</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: G, fontFamily: "'JetBrains Mono',monospace" }}>{fmtN(d.salaire)} FCFA</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <InfoRow label="Banque"       value={d.banque} />
          <InfoRow label="RIB"          value={d.rib} />
          <InfoRow label="Mobile Money" value={d.mobile_money_type} />
          <InfoRow label="Numéro MM"    value={d.mobile_money_numero} />
        </div>
      </Card>

      <Card title="Documents" icon="📁">
        <DocList />
      </Card>

      <Card title="Historique" icon="⚡">
        <TlItem color={GREEN} icon="✓" text={`Agent ${d.prenom} ${d.nom} enregistré`} time={fmtD(d.created_at)} />
        <TlItem color={G}     icon="💼" text={`Poste : ${d.poste}`} time="Actuel" last />
      </Card>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<ProfilPerson['type'], string> = {
  employe: 'Employé', enseignant: 'Formateur', etudiant: 'Étudiant', staff: 'Agent',
}

export function ProfilDrawer({ person, onClose }: { person: ProfilPerson; onClose: () => void }) {
  // Extract header info per type
  const { nom, prenom, roleTag, statusColor, phone, email } = (() => {
    switch (person.type) {
      case 'employe': {
        const d = person.data
        return { nom: d.nom, prenom: d.prenom, roleTag: `${d.poste}${d.departement ? ` · ${d.departement}` : ''}`, statusColor: d.statut === 'actif' ? RED : G, phone: d.telephone, email: d.email_pro }
      }
      case 'enseignant': {
        const d = person.data
        return { nom: d.nom, prenom: d.prenom, roleTag: d.matiere ?? 'Formateur', statusColor: d.statut === 'actif' ? RED : G, phone: d.telephone, email: d.email }
      }
      case 'etudiant': {
        const d = person.data
        return { nom: d.nom, prenom: d.prenom, roleTag: `${d.niveau}${d.classe ? ` · ${d.classe}` : ''}`, statusColor: d.statut === 'actif' ? RED : PURPLE, phone: d.tel_parent, email: d.email_parent }
      }
      case 'staff': {
        const d = person.data
        return { nom: d.nom, prenom: d.prenom, roleTag: d.poste, statusColor: d.statut === 'actif' ? RED : G, phone: d.telephone, email: d.email }
      }
    }
  })()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)' }}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          position: 'relative', width: 720, maxWidth: '96vw', height: '100%',
          background: BG, borderLeft: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          fontFamily: "'Sora',system-ui,-apple-system,sans-serif",
        }}>

        {/* Orange accent line top */}
        <div style={{ height: 2, background: '#DC2626', flexShrink: 0 }} />

        {/* ── Profile header ─────────────────────────────────────────────── */}
        <div style={{
          padding: '22px 26px 20px',
          background: BG, flexShrink: 0,
          borderBottom: `1px solid ${BORDER}`,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Radial glow */}
          <div style={{ position: 'absolute', top: -60, right: 80, width: 220, height: 220, background: 'transparent', pointerEvents: 'none' }} />

          {/* Close + type badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: ORG_DIM, border: `1px solid ${ORG_BDR}`, color: G, letterSpacing: 0.6 }}>
                {TYPE_LABEL[person.type].toUpperCase()}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: statusColor }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                Actif
              </span>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: '#F3F4F6', border: `1px solid ${BORDER}`, color: T2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
              ✕
            </button>
          </div>

          {/* Avatar + identity */}
          <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar name={prenom} size={78} />
              <div style={{ position: 'absolute', bottom: 3, right: 3, width: 15, height: 15, borderRadius: '50%', background: statusColor, border: `3px solid ${BG}` }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: T1, letterSpacing: -0.4, lineHeight: 1.1, marginBottom: 8 }}>
                {prenom} <span style={{ color: G }}>{nom.toUpperCase()}</span>
              </h2>
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: ORG_DIM, border: `1px solid ${ORG_BDR}`, color: G, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                  {roleTag}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T2 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>📱</span>
                    {phone}
                  </div>
                )}
                {email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T2 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>📧</span>
                    {email}
                  </div>
                )}
              </div>
            </div>

            {/* Modifier button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
              <button style={{ padding: '8px 16px', borderRadius: 9, background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
                ✏️ Modifier
              </button>
              <button style={{ padding: '7px 16px', borderRadius: 9, background: CARD, color: T2, fontWeight: 600, fontSize: 12, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                📥 Exporter
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {person.type === 'employe'    && <ProfilEmploye   d={person.data} />}
          {person.type === 'enseignant' && <ProfilEnseignant d={person.data} />}
          {person.type === 'etudiant'   && <ProfilEtudiant   d={person.data} />}
          {person.type === 'staff'      && <ProfilStaff      d={person.data} />}
        </div>

      </motion.div>
    </div>
  )
}
