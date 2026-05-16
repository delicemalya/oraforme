'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:     '#080E1A',
  card:   'rgba(255,255,255,0.03)',
  hover:  'rgba(255,255,255,0.055)',
  border: 'rgba(255,255,255,0.07)',
  gold:   '#F4B400',
  goldDim:'rgba(244,180,0,0.18)',
  goldBdr:'rgba(244,180,0,0.30)',
  t1:     '#F0F4FF',
  t2:     '#8E9AB8',
  t3:     '#4A5572',
  green:  '#22C55E',
  red:    '#EF4444',
  blue:   '#3B82F6',
  purple: '#A855F7',
}

const fmtN = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtDate = (d: string | null) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00')).toLocaleDateString('fr-FR') : '—'

// ── Shared micro-components ───────────────────────────────────────────────────

function AvatarCircle({ name, size = 72 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#F4B400,#E07800)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size / 2.6, fontWeight: 800, color: '#000',
      boxShadow: '0 0 0 4px rgba(244,180,0,0.2),0 0 30px rgba(244,180,0,0.12)',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function SCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}

function IField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p style={{ fontSize: 9.5, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: value != null && value !== '' ? C.t1 : C.t3 }}>
        {value != null && value !== '' ? String(value) : '—'}
      </p>
    </div>
  )
}

function Chip({ label, value, sub, color = C.gold }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 14px' }}>
      <p style={{ fontSize: 9.5, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

function Timeline({ items }: { items: { color: string; icon: string; text: string; time: string }[] }) {
  return (
    <SCard title="Historique">
      <div>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', position: 'relative' }}>
            {i < items.length - 1 && (
              <div style={{ position: 'absolute', left: 10, top: 26, bottom: -8, width: 1, background: C.border }} />
            )}
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${it.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, zIndex: 1 }}>
              {it.icon}
            </div>
            <div>
              <p style={{ fontSize: 12, color: C.t1 }}>{it.text}</p>
              <p style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{it.time}</p>
            </div>
          </div>
        ))}
      </div>
    </SCard>
  )
}

function PayLine({ label, value, color = C.t2 }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
      <span style={{ color: C.t2 }}>{label}</span>
      <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function BrutBox({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'linear-gradient(135deg,rgba(244,180,0,0.12),rgba(244,180,0,0.04))', borderRadius: 10, border: `1px solid rgba(244,180,0,0.2)`, marginTop: 8 }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: C.t1 }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 16, color: C.gold }}>{fmtN(value)} FCFA</span>
    </div>
  )
}

// ── Tab contents ──────────────────────────────────────────────────────────────

function TabGeneral({ person }: { person: ProfilPerson }) {
  if (person.type === 'employe') {
    const d = person.data
    const brut = (d.salaire_base || 0) + (d.prime_logement || 0) + (d.prime_transport || 0) + (d.prime_risque || 0) + (d.prime_rendement || 0)
    const since = d.date_recrutement
      ? Math.floor((Date.now() - new Date(d.date_recrutement).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <Chip label="Salaire brut" value={fmtN(brut)} sub="FCFA/mois" color={C.gold} />
          <Chip label="Type" value={d.type_employe} sub="contrat" color={C.purple} />
          {since !== null
            ? <Chip label="Ancienneté" value={`${since} an${since !== 1 ? 's' : ''}`} color={C.blue} />
            : <Chip label="Statut" value={d.statut} color={d.statut === 'actif' ? C.green : C.gold} />}
        </div>
        <Timeline items={[
          { color: C.green,  icon: '✓', text: `Dossier enregistré — ${d.prenom} ${d.nom}`, time: fmtDate(d.created_at) },
          { color: C.gold,   icon: '💼', text: `${d.poste}${d.departement ? ` · ${d.departement}` : ''}`, time: d.date_debut_contrat ? `Début contrat ${fmtDate(d.date_debut_contrat)}` : 'Date contrat non renseignée' },
          { color: C.blue,   icon: '💰', text: `Base : ${fmtN(d.salaire_base)} FCFA — Mode : ${(d.mode_paiement || '—').replace('_', ' ')}`, time: 'Mensuel' },
        ]} />
      </div>
    )
  }

  if (person.type === 'enseignant') {
    const d = person.data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <Chip label="Salaire mensuel" value={d.salaire_mensuel ? fmtN(d.salaire_mensuel) : '—'} sub="FCFA" />
          <Chip label="Taux horaire" value={d.taux_horaire ? fmtN(d.taux_horaire) : '—'} sub="FCFA/h" color={C.blue} />
          <Chip label="Statut" value={d.statut} color={d.statut === 'actif' ? C.green : C.gold} />
        </div>
        <Timeline items={[
          { color: C.green,  icon: '✓', text: `Formateur ${d.prenom} ${d.nom} — actif`, time: fmtDate(d.created_at) },
          { color: C.gold,   icon: '📚', text: `Matière : ${d.matiere ?? 'Non définie'}`, time: 'Affectation actuelle' },
          { color: C.blue,   icon: '💳', text: `Rémunération configurée`, time: d.banque ? `Banque : ${d.banque}` : d.mobile_money_type ? `MM : ${d.mobile_money_type}` : 'Mode de paiement non renseigné' },
        ]} />
      </div>
    )
  }

  if (person.type === 'etudiant') {
    const d = person.data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <Chip label="Niveau" value={d.niveau} color={C.blue} />
          <Chip label="Classe" value={d.classe ?? '—'} />
          <Chip label="Statut" value={d.statut} color={d.statut === 'actif' ? C.green : C.red} />
        </div>
        <Timeline items={[
          { color: C.green, icon: '🎓', text: `Inscription ${d.prenom} ${d.nom}`, time: fmtDate(d.created_at) },
          { color: C.gold,  icon: '🏫', text: `${d.classe ?? 'Classe non affectée'} — ${d.niveau}`, time: d.annee_scolaire },
          { color: C.blue,  icon: '👨‍👩‍👦', text: `Parent : ${[d.nom_pere, d.nom_mere].filter(Boolean).join(' / ') || 'Non renseigné'}`, time: d.tel_parent ?? '—' },
        ]} />
      </div>
    )
  }

  // staff
  const d = person.data
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <Chip label="Salaire" value={fmtN(d.salaire)} sub="FCFA/mois" />
        <Chip label="Poste" value={d.poste} color={C.purple} />
        <Chip label="Statut" value={d.statut} color={d.statut === 'actif' ? C.green : C.gold} />
      </div>
      <Timeline items={[
        { color: C.green, icon: '✓', text: `Agent ${d.prenom} ${d.nom} enregistré`, time: fmtDate(d.created_at) },
        { color: C.gold,  icon: '💼', text: `Poste : ${d.poste}`, time: 'Actuel' },
      ]} />
    </div>
  )
}

function TabInfos({ person }: { person: ProfilPerson }) {
  if (person.type === 'employe') {
    const d = person.data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SCard title="Identité civile">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Prénom" value={d.prenom} />
            <IField label="Nom" value={d.nom} />
            <IField label="Postnom" value={d.postnom} />
            <IField label="Sexe" value={d.sexe} />
            <IField label="Date de naissance" value={fmtDate(d.date_naissance)} />
            <IField label="Nationalité" value={d.nationalite} />
            <IField label="Situation matrimoniale" value={d.situation_matrimoniale} />
            <IField label="Nb enfants" value={d.nb_enfants} />
          </div>
        </SCard>
        <SCard title="Coordonnées">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Téléphone" value={d.telephone} />
            <IField label="Téléphone 2" value={d.telephone2} />
            <IField label="Email professionnel" value={d.email_pro} />
            <IField label="Adresse" value={d.adresse} />
            <IField label="Ville" value={d.ville} />
            <IField label="Pays" value={d.pays} />
          </div>
        </SCard>
        <SCard title="Poste & Contrat">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Poste" value={d.poste} />
            <IField label="Département" value={d.departement} />
            <IField label="Type employé" value={d.type_employe} />
            <IField label="Statut" value={d.statut} />
            <IField label="Date recrutement" value={fmtDate(d.date_recrutement)} />
            <IField label="Début contrat" value={fmtDate(d.date_debut_contrat)} />
            <IField label="Fin contrat" value={fmtDate(d.date_fin_contrat)} />
            <IField label="N° CNSS" value={d.numero_cnss} />
            <IField label="N° Fiscal NIF" value={d.numero_fiscal} />
          </div>
        </SCard>
      </div>
    )
  }

  if (person.type === 'enseignant') {
    const d = person.data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SCard title="Identité & Contact">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Prénom" value={d.prenom} />
            <IField label="Nom" value={d.nom} />
            <IField label="Téléphone" value={d.telephone} />
            <IField label="Email" value={d.email} />
            <IField label="Matière" value={d.matiere} />
            <IField label="Statut" value={d.statut} />
            <IField label="N° CNSS" value={d.numero_cnss} />
          </div>
        </SCard>
        <SCard title="Coordonnées bancaires">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Banque" value={d.banque} />
            <IField label="RIB" value={d.rib} />
            <IField label="Mobile Money" value={d.mobile_money_type} />
            <IField label="Numéro MM" value={d.mobile_money_numero} />
          </div>
        </SCard>
      </div>
    )
  }

  if (person.type === 'etudiant') {
    const d = person.data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SCard title="Identité">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Prénom" value={d.prenom} />
            <IField label="Nom" value={d.nom} />
            <IField label="Date de naissance" value={fmtDate(d.date_naissance)} />
            <IField label="Lieu de naissance" value={d.lieu_naissance} />
            <IField label="Nationalité" value={d.nationalite} />
            <IField label="Adresse" value={d.adresse} />
          </div>
        </SCard>
        <SCard title="Scolarité">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="N° étudiant" value={d.numero_id} />
            <IField label="Niveau" value={d.niveau} />
            <IField label="Classe" value={d.classe} />
            <IField label="Année scolaire" value={d.annee_scolaire} />
            <IField label="Statut" value={d.statut} />
          </div>
        </SCard>
        <SCard title="Parents & Tuteur">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Père" value={d.nom_pere} />
            <IField label="Mère" value={d.nom_mere} />
            <IField label="Tél. parent" value={d.tel_parent} />
            <IField label="Email parent" value={d.email_parent} />
            <IField label="Profession" value={d.profession_parent} />
            <IField label="Tuteur" value={d.nom_tuteur} />
            <IField label="Tél. tuteur" value={d.tel_tuteur} />
            <IField label="Lien tuteur" value={d.lien_tuteur} />
          </div>
        </SCard>
      </div>
    )
  }

  const d = person.data
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SCard title="Identité & Contact">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <IField label="Prénom" value={d.prenom} />
          <IField label="Nom" value={d.nom} />
          <IField label="Poste" value={d.poste} />
          <IField label="Téléphone" value={d.telephone} />
          <IField label="Email" value={d.email} />
          <IField label="N° CNSS" value={d.numero_cnss} />
        </div>
      </SCard>
      <SCard title="Coordonnées bancaires">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <IField label="Banque" value={d.banque} />
          <IField label="RIB" value={d.rib} />
          <IField label="Mobile Money" value={d.mobile_money_type} />
          <IField label="Numéro MM" value={d.mobile_money_numero} />
        </div>
      </SCard>
    </div>
  )
}

function TabFinances({ person }: { person: ProfilPerson }) {
  if (person.type === 'employe') {
    const d = person.data
    const brut = (d.salaire_base || 0) + (d.prime_logement || 0) + (d.prime_transport || 0) + (d.prime_risque || 0) + (d.prime_rendement || 0)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SCard title="Détail rémunération">
          <div>
            {d.salaire_base > 0   && <PayLine label="Salaire de base"  value={`${fmtN(d.salaire_base)} FCFA`}  color={C.t1} />}
            {d.prime_logement > 0 && <PayLine label="Prime logement"   value={`+${fmtN(d.prime_logement)} FCFA`}  color={C.green} />}
            {d.prime_transport> 0 && <PayLine label="Prime transport"  value={`+${fmtN(d.prime_transport)} FCFA`} color={C.green} />}
            {d.prime_risque > 0   && <PayLine label="Prime de risque"  value={`+${fmtN(d.prime_risque)} FCFA`}   color={C.green} />}
            {d.prime_rendement> 0 && <PayLine label="Prime rendement"  value={`+${fmtN(d.prime_rendement)} FCFA`} color={C.green} />}
            {d.taux_horaire && d.taux_horaire > 0 && <PayLine label="Taux horaire" value={`${fmtN(d.taux_horaire)} FCFA/h`} color={C.blue} />}
            <BrutBox label="SALAIRE BRUT" value={brut} />
          </div>
        </SCard>
        <SCard title="Mode de paiement">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Mode" value={(d.mode_paiement || '—').replace('_', ' ')} />
            <IField label="Banque" value={d.banque} />
            <IField label="RIB" value={d.rib} />
            <IField label="Mobile Money" value={d.mobile_money_type ? `${d.mobile_money_type} — ${d.mobile_money_numero ?? ''}` : null} />
          </div>
        </SCard>
      </div>
    )
  }

  if (person.type === 'enseignant') {
    const d = person.data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SCard title="Rémunération">
          <div>
            {d.salaire_mensuel != null && <PayLine label="Salaire mensuel" value={`${fmtN(d.salaire_mensuel)} FCFA`} color={C.gold} />}
            {d.taux_horaire    != null && <PayLine label="Taux horaire"    value={`${fmtN(d.taux_horaire)} FCFA/h`}  color={C.blue} />}
            {d.salaire_mensuel != null && <BrutBox label="TOTAL MENSUEL" value={d.salaire_mensuel} />}
          </div>
        </SCard>
        <SCard title="Coordonnées bancaires">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <IField label="Banque" value={d.banque} />
            <IField label="RIB" value={d.rib} />
            <IField label="Mobile Money" value={d.mobile_money_type} />
            <IField label="Numéro MM" value={d.mobile_money_numero} />
          </div>
        </SCard>
      </div>
    )
  }

  if (person.type === 'etudiant') {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>💳</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 6 }}>Finances scolaires</p>
        <p style={{ fontSize: 11, color: C.t2 }}>Consultez la section Scolarité → Paiements pour l'historique complet des frais.</p>
      </div>
    )
  }

  const d = person.data
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SCard title="Salaire mensuel">
        <BrutBox label="SALAIRE MENSUEL" value={d.salaire} />
      </SCard>
      <SCard title="Coordonnées bancaires">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <IField label="Banque" value={d.banque} />
          <IField label="RIB" value={d.rib} />
          <IField label="Mobile Money" value={d.mobile_money_type} />
          <IField label="Numéro MM" value={d.mobile_money_numero} />
        </div>
      </SCard>
    </div>
  )
}

function TabDocuments() {
  const docs = [
    { icon: '📄', label: "Pièce d'identité", hint: 'CNI ou passeport · PDF / image', color: C.red },
    { icon: '📋', label: 'Contrat signé',    hint: 'Document PDF signé',             color: C.blue },
    { icon: '🎓', label: 'Diplôme(s)',        hint: 'PDF ou scan',                   color: C.purple },
    { icon: '📊', label: 'Attestations',      hint: 'Formations, habilitations',     color: C.green },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 11, color: C.t3, marginBottom: 4 }}>Documents attachés au dossier.</p>
      {docs.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.025)', border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${d.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{d.icon}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{d.label}</p>
            <p style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{d.hint}</p>
          </div>
          <span style={{ fontSize: 11, color: C.t3 }}>+ Ajouter</span>
        </div>
      ))}
      <p style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>Stockage de documents disponible dans une prochaine mise à jour.</p>
    </div>
  )
}

function TabPresence() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 6 }}>Module de présence</p>
      <p style={{ fontSize: 11, color: C.t2 }}>Les données de présence seront synchronisées depuis le pointage biométrique ou manuel.</p>
    </div>
  )
}

// ── Main ProfilDrawer ─────────────────────────────────────────────────────────

type TabId = 'general' | 'infos' | 'finances' | 'documents' | 'presence'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'general',   icon: '👤', label: 'Vue générale' },
  { id: 'infos',     icon: '📋', label: 'Informations' },
  { id: 'finances',  icon: '💰', label: 'Finances'     },
  { id: 'documents', icon: '📁', label: 'Documents'    },
  { id: 'presence',  icon: '📊', label: 'Présence'     },
]

const TYPE_LABEL: Record<ProfilPerson['type'], string> = {
  employe:    'Employé',
  enseignant: 'Formateur',
  etudiant:   'Étudiant',
  staff:      'Staff',
}

export function ProfilDrawer({ person, onClose }: { person: ProfilPerson; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>('general')

  const { nom, prenom, roleTag, statusColor, phone, email } = (() => {
    switch (person.type) {
      case 'employe': {
        const d = person.data
        return {
          nom: d.nom, prenom: d.prenom,
          roleTag: `${d.poste}${d.departement ? ` · ${d.departement}` : ''}`,
          statusColor: d.statut === 'actif' ? C.green : C.gold,
          phone: d.telephone, email: d.email_pro,
        }
      }
      case 'enseignant': {
        const d = person.data
        return {
          nom: d.nom, prenom: d.prenom,
          roleTag: d.matiere ?? 'Formateur',
          statusColor: d.statut === 'actif' ? C.green : C.gold,
          phone: d.telephone, email: d.email,
        }
      }
      case 'etudiant': {
        const d = person.data
        return {
          nom: d.nom, prenom: d.prenom,
          roleTag: `${d.niveau}${d.classe ? ` · ${d.classe}` : ''}`,
          statusColor: d.statut === 'actif' ? C.green : C.red,
          phone: d.tel_parent, email: d.email_parent,
        }
      }
      case 'staff': {
        const d = person.data
        return {
          nom: d.nom, prenom: d.prenom,
          roleTag: d.poste,
          statusColor: d.statut === 'actif' ? C.green : C.gold,
          phone: d.telephone, email: d.email,
        }
      }
    }
  })()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          position: 'relative', width: 680, maxWidth: '96vw', height: '100%',
          background: C.bg, borderLeft: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Sora',system-ui,-apple-system,sans-serif",
          overflowY: 'auto',
        }}>

        {/* Gold accent line */}
        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(244,180,0,0.45),transparent)', flexShrink: 0 }} />

        {/* Sticky header */}
        <div style={{ padding: '18px 22px 0', flexShrink: 0, background: C.bg, position: 'sticky', top: 0, zIndex: 2 }}>

          {/* Type badge + status + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: C.goldDim, border: `1px solid ${C.goldBdr}`, color: C.gold, letterSpacing: 0.5,
              }}>
                {TYPE_LABEL[person.type]}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: statusColor }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                Actif
              </span>
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
              color: C.t2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>✕</button>
          </div>

          {/* Profile header card */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '18px 20px', display: 'flex', gap: 18, alignItems: 'center',
            marginBottom: 16, position: 'relative', overflow: 'hidden',
          }}>
            {/* Gold glow */}
            <div style={{ position: 'absolute', top: -50, right: 60, width: 160, height: 160, background: 'radial-gradient(circle,rgba(244,180,0,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />

            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <AvatarCircle name={prenom} size={68} />
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: statusColor, border: `2.5px solid ${C.bg}` }} />
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.t1, letterSpacing: -0.3, marginBottom: 5, lineHeight: 1.2 }}>
                {prenom} <span style={{ color: C.gold }}>{nom.toUpperCase()}</span>
              </h2>
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: C.goldDim, border: `1px solid ${C.goldBdr}`,
                  color: C.gold, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                }}>
                  {roleTag}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.t2 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>📱</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phone}</span>
                  </div>
                )}
                {email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.t2 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>📧</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 3,
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 3, marginBottom: 18,
          }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 7,
                fontSize: 10.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
                background: tab === t.id ? C.gold : 'transparent',
                color: tab === t.id ? '#000' : C.t2,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, padding: '0 22px 28px' }}>
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.14 }}>

              {tab === 'general'   && <TabGeneral  person={person} />}
              {tab === 'infos'     && <TabInfos    person={person} />}
              {tab === 'finances'  && <TabFinances person={person} />}
              {tab === 'documents' && <TabDocuments />}
              {tab === 'presence'  && <TabPresence />}

            </motion.div>
          </AnimatePresence>
        </div>

      </motion.div>
    </div>
  )
}
