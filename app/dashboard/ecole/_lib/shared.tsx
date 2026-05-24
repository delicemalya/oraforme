'use client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type StatutEtu        = 'actif' | 'suspendu' | 'banni' | 'diplome'
export type Niveau           = 'primaire' | 'college' | 'lycee' | 'licence' | 'master' | 'doctorat'
export type Periode          = 'trimestre1' | 'trimestre2' | 'trimestre3' | 'semestre1' | 'semestre2'
export type StatutEnseignant = 'actif' | 'conge' | 'inactif'
export type TypeEvent        = 'examen' | 'conge_scolaire' | 'evenement' | 'conseil' | 'autre'

export interface Etudiant {
  id: string; numero_id: string; photo_url: string | null
  nom: string; prenom: string; date_naissance: string | null
  lieu_naissance: string | null; nationalite: string; adresse: string | null
  niveau: Niveau; classe: string | null; statut: StatutEtu
  nom_pere: string | null; nom_mere: string | null
  tel_parent: string | null; email_parent: string | null; profession_parent: string | null
  nom_tuteur: string | null; tel_tuteur: string | null; lien_tuteur: string | null
  annee_scolaire: string; code_deblocage: string | null; created_at: string
}
export interface FraisScolaire {
  id: string; libelle: string; montant: number; type_frais: string; obligatoire: boolean; actif: boolean; ordre: number
}
export interface PaiementScolaire {
  id: string; etudiant_id: string; frais_id: string | null; libelle: string
  montant: number; mois: number | null; annee: number; statut: string; methode: string; created_at: string
}
export interface Note {
  id: string; etudiant_id: string; matiere: string; type_note: string
  note: number; note_max: number; coefficient: number; periode: Periode
  annee_scolaire: string; commentaire: string | null; created_at: string
}
export interface Enseignant {
  id: string; tenant_id: string; nom: string; prenom: string
  matiere: string | null; telephone: string | null; email: string | null
  statut: StatutEnseignant; created_at: string
  photo_url:            string | null
  salaire_mensuel:      number | null
  taux_horaire:         number | null
  mobile_money_type:    string | null
  mobile_money_numero:  string | null
  banque:               string | null
  rib:                  string | null
  numero_cnss:          string | null
}
export interface ClasseEcole {
  id: string; tenant_id: string; nom: string; niveau: string
  annee_scolaire: string; enseignant_id: string | null; nb_places: number; created_at: string
}
export interface PlanningEcole {
  id: string; tenant_id: string; titre: string; description: string | null
  date_debut: string; date_fin: string | null; type: TypeEvent; created_at: string
}
export interface Absence {
  id: string; tenant_id: string; etudiant_id: string; date_absence: string
  matiere: string | null; justifiee: boolean; motif: string | null
  notifie_parent: boolean; created_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const STATUT_ETU: Record<StatutEtu, { label: string; color: string; bg: string }> = {
  actif:    { label: 'Actif',    color: '#FFFFFF', bg: '#00b9a7' },
  suspendu: { label: 'Suspendu', color: '#FFFFFF', bg: '#DC2626' },
  banni:    { label: 'Banni',    color: '#FFFFFF', bg: '#DC2626' },
  diplome:  { label: 'Diplômé', color: '#FFFFFF', bg: '#ff7000' },
}

export const NIVEAUX: { value: Niveau; label: string; system: 'points' | 'lmd' }[] = [
  { value: 'primaire',  label: 'Primaire',  system: 'points' },
  { value: 'college',   label: 'Collège',   system: 'points' },
  { value: 'lycee',     label: 'Lycée',     system: 'points' },
  { value: 'licence',   label: 'Licence',   system: 'lmd' },
  { value: 'master',    label: 'Master',    system: 'lmd' },
  { value: 'doctorat',  label: 'Doctorat',  system: 'lmd' },
]

export const PERIODES: { value: Periode; label: string }[] = [
  { value: 'trimestre1', label: 'Trimestre 1' },
  { value: 'trimestre2', label: 'Trimestre 2' },
  { value: 'trimestre3', label: 'Trimestre 3' },
  { value: 'semestre1',  label: 'Semestre 1' },
  { value: 'semestre2',  label: 'Semestre 2' },
]

export const MENTIONS = [
  { min: 16, label: 'Très Bien',  color: '#7C3AED' },
  { min: 14, label: 'Bien',        color: '#DC2626' },
  { min: 12, label: 'Assez Bien', color: '#7C3AED' },
  { min: 10, label: 'Passable',   color: '#DC2626' },
  { min: 0,  label: 'Insuffisant',color: '#DC2626' },
]

export const STATUT_ENS: Record<StatutEnseignant, { label: string; color: string; bg: string }> = {
  actif:   { label: 'Actif',    color: '#FFFFFF', bg: '#00b9a7' },
  conge:   { label: 'En congé', color: '#FFFFFF', bg: '#ff7000' },
  inactif: { label: 'Inactif',  color: '#6B7280', bg: '#F3F4F6' },
}

export const TYPE_EVENT: Record<TypeEvent, { label: string; color: string; bg: string }> = {
  examen:         { label: 'Examen',    color: '#DC2626', bg: '#DC262618' },
  conge_scolaire: { label: 'Congé',     color: '#DC2626', bg: '#DC262618' },
  evenement:      { label: 'Événement', color: '#7C3AED', bg: 'rgba(139,0,112,0.15)' },
  conseil:        { label: 'Conseil',   color: '#7C3AED', bg: '#7C3AED18' },
  autre:          { label: 'Autre',     color: '#8B949E', bg: '#8B949E18' },
}

export const DEFAULT_FRAIS = [
  { libelle: "Frais d'inscription",           type_frais: 'inscription', montant: 50000 },
  { libelle: 'Frais mensuel scolarité',       type_frais: 'mensuel',     montant: 30000 },
  { libelle: 'Frais bibliothèque',            type_frais: 'bibliotheque',montant: 10000 },
  { libelle: 'Frais examens / session',       type_frais: 'examen',      montant: 25000 },
  { libelle: 'Ordinateur portable',           type_frais: 'fourniture',  montant: 350000 },
  { libelle: 'Combinaison de travail',        type_frais: 'fourniture',  montant: 15000 },
  { libelle: 'Casque de sécurité',            type_frais: 'fourniture',  montant: 8000 },
  { libelle: 'Chaussures de sécurité',        type_frais: 'fourniture',  montant: 22000 },
]

// ── Utils ─────────────────────────────────────────────────────────────────────

export function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

export function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function calcMoyenne(notes: Note[], periode?: Periode) {
  const ns = periode ? notes.filter(n => n.periode === periode) : notes
  if (!ns.length) return null
  const totalCoeff = ns.reduce((s, n) => s + n.coefficient, 0)
  if (!totalCoeff) return null
  return ns.reduce((s, n) => s + (n.note / n.note_max) * 20 * n.coefficient, 0) / totalCoeff
}

export function getMention(m: number) {
  return MENTIONS.find(x => m >= x.min) ?? MENTIONS[MENTIONS.length - 1]
}

export function printBulletin(etudiant: Etudiant, notes: Note[], periode: Periode, nomEcole: string) {
  const pl = PERIODES.find(p => p.value === periode)?.label ?? periode
  const niv = NIVEAUX.find(n => n.value === etudiant.niveau)?.label ?? ''
  const byMatiere: Record<string, Note[]> = {}
  notes.filter(n => n.periode === periode).forEach(n => {
    if (!byMatiere[n.matiere]) byMatiere[n.matiere] = []
    byMatiere[n.matiere].push(n)
  })
  const moy = calcMoyenne(notes, periode) ?? 0
  const mention = getMention(moy)
  const w = window.open('', '_blank', 'width=800,height=1100')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Bulletin</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;font-size:11px;color:#111;background:#fff}.page{max-width:720px;margin:0 auto;padding:24px}.header{text-align:center;border-bottom:3px double #111;padding-bottom:12px;margin-bottom:16px}h1{font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:2px}h2{font-size:13px;margin-top:4px}h3{font-size:11px;color:#444;margin-top:2px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.info-box{border:1px solid #ccc;border-radius:4px;padding:10px}.info-box h4{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px}.info-box p{line-height:1.7;font-size:11px}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#111;color:#fff;padding:6px 8px;font-size:10px;text-transform:uppercase}td{padding:6px 8px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f9f9f9}.moy-box{border:2px solid #111;border-radius:6px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.sign-area{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:24px}.sign-box{text-align:center;border-top:1px solid #999;padding-top:6px;font-size:10px;color:#666}.footer{text-align:center;margin-top:20px;font-size:9px;color:#888;border-top:1px solid #ccc;padding-top:8px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body><div class="page">
<div class="header"><h1>${nomEcole}</h1><h2>BULLETIN DE NOTES — ${pl}</h2><h3>Année scolaire ${etudiant.annee_scolaire}</h3></div>
<div class="info-grid">
<div class="info-box"><h4>Élève</h4><p><strong>${etudiant.prenom} ${etudiant.nom}</strong></p><p>N° : ${etudiant.numero_id}</p><p>Classe : ${etudiant.classe || niv}</p></div>
<div class="info-box"><h4>Parents</h4><p>${etudiant.nom_pere ? 'Père : ' + etudiant.nom_pere : ''}</p><p>${etudiant.nom_mere ? 'Mère : ' + etudiant.nom_mere : ''}</p><p>${etudiant.tel_parent ? 'Tél : ' + etudiant.tel_parent : ''}</p></div>
</div>
<table><thead><tr><th>Matière</th><th>Notes</th><th>Coeff.</th><th>Moy /20</th><th>Mention</th></tr></thead><tbody>
${Object.entries(byMatiere).map(([mat, ns]) => {
  const moy2 = ns.reduce((s, n) => s + (n.note / n.note_max * 20), 0) / ns.length
  const m2 = getMention(moy2)
  return `<tr><td>${mat}</td><td>${ns.map(n => `${n.note}/${n.note_max}`).join(', ')}</td><td>${ns[0]?.coefficient || 1}</td><td style="font-weight:bold">${moy2.toFixed(2)}</td><td style="color:${m2.color}">${m2.label}</td></tr>`
}).join('')}
</tbody></table>
<div class="moy-box"><div><div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px">Moyenne Générale</div><div style="font-size:28px;font-weight:700">${moy.toFixed(2)} / 20</div></div><div style="text-align:right"><div style="font-size:14px;font-weight:700;text-transform:uppercase;color:${mention.color}">${mention.label}</div></div></div>
<div class="sign-area"><div class="sign-box">Visa Directeur/trice</div><div class="sign-box">Prof. Principal</div><div class="sign-box">Signature Parents</div></div>
<div class="footer">Bulletin généré le ${new Date().toLocaleDateString('fr-FR')} · ${nomEcole}</div>
</div><script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}

export function printReceipt(etudiant: Etudiant, paiement: PaiementScolaire, nomEcole: string) {
  const w = window.open('', '_blank', 'width=380,height=580')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Reçu</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace;font-size:12px;padding:20px;max-width:340px}h1{text-align:center;font-size:13px;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:12px}.row{display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px}.total{font-size:15px;font-weight:bold;border-top:2px dashed #000;padding-top:8px;margin-top:8px;display:flex;justify-content:space-between}.footer{text-align:center;margin-top:14px;font-size:9px;color:#666;border-top:1px solid #ccc;padding-top:6px}@media print{body{-webkit-print-color-adjust:exact}}</style>
</head><body>
<h1>${nomEcole}<br/><span style="font-size:10px;font-weight:normal">REÇU DE PAIEMENT</span></h1>
<div class="row"><span>Reçu N° :</span><span>${paiement.id.slice(0,8).toUpperCase()}</span></div>
<div class="row"><span>Date :</span><span>${new Date(paiement.created_at).toLocaleDateString('fr-FR')}</span></div>
<div style="border-top:1px dashed #000;margin:8px 0"></div>
<div class="row"><span>Étudiant :</span><span><b>${etudiant.prenom} ${etudiant.nom}</b></span></div>
<div class="row"><span>ID :</span><span>${etudiant.numero_id}</span></div>
<div class="row"><span>Classe :</span><span>${etudiant.classe ?? etudiant.niveau}</span></div>
<div style="border-top:1px dashed #000;margin:8px 0"></div>
<div class="row"><span>Libellé :</span><span>${paiement.libelle}</span></div>
<div class="row"><span>Mode :</span><span>${paiement.methode.replace('_',' ')}</span></div>
<div class="total"><span>TOTAL :</span><span>${new Intl.NumberFormat('fr-FR').format(paiement.montant)} FCFA</span></div>
<div class="footer">Merci de conserver ce reçu · Généré le ${new Date().toLocaleDateString('fr-FR')}<br/>${nomEcole}</div>
<script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}

// ── Academic Types ────────────────────────────────────────────────────────────

export interface Subject {
  id: string; tenant_id: string; nom: string; code: string | null
  coefficient: number; niveau: string | null; enseignant_id: string | null; created_at: string
}

export interface SessionEcole {
  id: string; tenant_id: string; nom: string
  type: 'trimestre1'|'trimestre2'|'trimestre3'|'semestre1'|'semestre2'|'annuel'
  annee_scolaire: string; date_debut: string; date_fin: string
  statut: 'en_cours'|'cloture'|'archive'; created_at: string
}

export interface Exam {
  id: string; tenant_id: string; session_id: string | null; classe_id: string | null
  subject_id: string | null; nom: string
  type_exam: 'devoir'|'composition'|'examen_final'|'rattrapage'|'tp'|'oral'
  date_exam: string | null; note_max: number; coefficient: number; created_at: string
}

export interface ExamGrade {
  id: string; exam_id: string; etudiant_id: string; note: number | null
  absent: boolean; commentaire: string | null; created_at: string
}

export interface ReportCard {
  id: string; etudiant_id: string; session_id: string | null; classe_id: string | null
  annee_scolaire: string; moyenne_generale: number | null; rang: number | null
  effectif_classe: number | null; appreciation: string | null; publie: boolean; generated_at: string
}

export interface Attestation {
  id: string; tenant_id: string; etudiant_id: string
  type_attestation: 'inscription'|'scolarite'|'reussite'|'frequentation'|'bonne_conduite'|'autre'
  annee_scolaire: string | null; date_emission: string; numero_ref: string | null
  motif: string | null; created_at: string
}

export interface Diploma {
  id: string; tenant_id: string; etudiant_id: string; type_diplome: string
  mention: 'passable'|'assez_bien'|'bien'|'tres_bien'|'excellent' | null
  annee_obtention: number; numero_diplome: string | null; date_emission: string
  statut: 'en_attente'|'valide'|'delivre'|'revoque'; observations: string | null; created_at: string
}

export interface Defense {
  id: string; tenant_id: string; etudiant_id: string; titre_memoire: string
  date_soutenance: string; salle: string | null; directeur_memoire: string | null
  membres_jury: string | null
  statut: 'planifie'|'en_cours'|'passe'|'reporte'|'annule'
  note_finale: number | null; mention: string | null; observations: string | null; created_at: string
}

// ── Academic Constants ────────────────────────────────────────────────────────

export const TYPES_EXAM: { value: Exam['type_exam']; label: string }[] = [
  { value: 'devoir',       label: 'Devoir' },
  { value: 'composition',  label: 'Composition' },
  { value: 'examen_final', label: 'Examen final' },
  { value: 'rattrapage',   label: 'Rattrapage' },
  { value: 'tp',           label: 'TP / Pratique' },
  { value: 'oral',         label: 'Oral' },
]

export const TYPES_ATTESTATION: { value: Attestation['type_attestation']; label: string }[] = [
  { value: 'inscription',    label: "Attestation d'inscription" },
  { value: 'scolarite',      label: 'Certificat de scolarité' },
  { value: 'reussite',       label: 'Attestation de réussite' },
  { value: 'frequentation',  label: 'Attestation de fréquentation' },
  { value: 'bonne_conduite', label: 'Attestation de bonne conduite' },
  { value: 'autre',          label: 'Autre attestation' },
]

export const STATUT_DIPLOME: Record<Diploma['statut'], { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#DC2626', bg: '#DC262618' },
  valide:     { label: 'Validé',     color: '#DC2626', bg: '#DC262618' },
  delivre:    { label: 'Délivré',    color: '#0F172A', bg: '#0F172A18' },
  revoque:    { label: 'Révoqué',    color: '#DC2626', bg: '#DC262618' },
}

export const STATUT_DEFENSE: Record<Defense['statut'], { label: string; color: string; bg: string }> = {
  planifie: { label: 'Planifiée',  color: '#DC2626', bg: '#DC262618' },
  en_cours: { label: 'En cours',   color: '#DC2626', bg: '#DC262618' },
  passe:    { label: 'Passée',     color: '#0F172A', bg: '#0F172A18' },
  reporte:  { label: 'Reportée',   color: '#7C3AED', bg: '#7C3AED18' },
  annule:   { label: 'Annulée',    color: '#DC2626', bg: '#DC262618' },
}

export const MENTIONS_DIPLOME: { value: string; label: string; color: string }[] = [
  { value: 'excellent',   label: 'Excellent',    color: '#0F172A' },
  { value: 'tres_bien',   label: 'Très Bien',    color: '#DC2626' },
  { value: 'bien',        label: 'Bien',          color: '#7C3AED' },
  { value: 'assez_bien',  label: 'Assez Bien',   color: '#DC2626' },
  { value: 'passable',    label: 'Passable',      color: '#DC2626' },
]

// ── Academic Settings ─────────────────────────────────────────────────────────

export interface AcademicSettings {
  id?: string
  tenant_id?: string
  system_type: 'classique' | 'lmd' | 'hybride'
  note_sur: 20 | 100
  moyenne_validation_ue: number
  moyenne_validation_semestre: number
  moyenne_validation_annee: number
  credits_par_semestre: number
  credits_par_annee: number
  compensation_matieres: boolean
  compensation_ue: boolean
  compensation_semestre: boolean
  compensation_annuelle: boolean
  seuil_note_compensable: number
  seuil_acces_rattrapage: number
  nb_max_matieres_rattrapage: number
  conservation_meilleure_note: boolean
  mentions: { min: number; label: string; color: string }[]
}

export function getMentionDynamic(
  note: number,
  mentions: { min: number; label: string; color: string }[]
) {
  const sorted = [...mentions].sort((a, b) => b.min - a.min)
  return sorted.find(m => note >= m.min) ?? sorted[sorted.length - 1]
}

// ── Academic Helpers ──────────────────────────────────────────────────────────

export function calcExamMoyenne(
  grades: ExamGrade[],
  exams: Exam[]
): number | null {
  const valid = grades.filter(g => !g.absent && g.note !== null)
  if (!valid.length) return null
  let sumCoeff = 0
  let sumWeighted = 0
  for (const g of valid) {
    const exam = exams.find(e => e.id === g.exam_id)
    if (!exam) continue
    const coeff = exam.coefficient
    sumWeighted += (g.note! / exam.note_max) * 20 * coeff
    sumCoeff    += coeff
  }
  return sumCoeff > 0 ? sumWeighted / sumCoeff : null
}

export function printAttestation(etudiant: Etudiant, attestation: Attestation, nomEcole: string) {
  const typeLabel = TYPES_ATTESTATION.find(t => t.value === attestation.type_attestation)?.label ?? 'Attestation'
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>${typeLabel}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;font-size:12px;color:#111;background:#fff}.page{max-width:680px;margin:40px auto;padding:40px;border:2px solid #111}.header{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:32px}h1{font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:3px}h2{font-size:13px;margin-top:6px;text-transform:uppercase;letter-spacing:1px}.body{line-height:2.2;font-size:13px;text-align:justify;margin-bottom:32px}.highlight{font-size:15px;font-weight:700;text-transform:uppercase}.sign{display:flex;justify-content:space-between;margin-top:48px}.sign-block{text-align:center;width:200px}.sign-block div:first-child{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:40px;border-bottom:1px solid #555}.footer{text-align:center;margin-top:32px;font-size:9px;color:#888;border-top:1px solid #ccc;padding-top:8px}@media print{body{-webkit-print-color-adjust:exact}}</style>
</head><body><div class="page">
<div class="header"><h1>${nomEcole}</h1><h2>${typeLabel}</h2><p style="font-size:10px;margin-top:4px">Réf. : ${attestation.numero_ref ?? '—'} · Le ${new Date(attestation.date_emission).toLocaleDateString('fr-FR')}</p></div>
<div class="body">
<p>Nous, soussignés, Directeur(trice) Général(e) de l'établissement <span class="highlight">${nomEcole}</span>, certifions par la présente que :</p>
<br/>
<p>L'étudiant(e) <span class="highlight">${etudiant.prenom} ${etudiant.nom}</span>,<br/>
N° d'immatriculation : <strong>${etudiant.numero_id}</strong><br/>
Niveau : <strong>${etudiant.classe ?? etudiant.niveau}</strong><br/>
Année scolaire : <strong>${attestation.annee_scolaire ?? etudiant.annee_scolaire}</strong></p>
<br/>
${attestation.type_attestation === 'inscription' ? '<p>est régulièrement inscrit(e) dans notre établissement pour l\'année scolaire en cours.</p>' : ''}
${attestation.type_attestation === 'scolarite' ? '<p>suit régulièrement les cours dispensés dans notre établissement.</p>' : ''}
${attestation.type_attestation === 'reussite' ? '<p>a satisfait aux examens de fin d\'année et a obtenu la mention requise pour passer en classe supérieure.</p>' : ''}
${attestation.type_attestation === 'frequentation' ? '<p>fréquente régulièrement notre établissement et fait preuve d\'assiduité.</p>' : ''}
${attestation.type_attestation === 'bonne_conduite' ? '<p>a fait preuve d\'une conduite exemplaire et respecte le règlement intérieur de l\'établissement.</p>' : ''}
${attestation.motif ? `<br/><p>Motif / observations : ${attestation.motif}</p>` : ''}
<br/>
<p>La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>
</div>
<div class="sign">
<div class="sign-block"><div>L'Étudiant(e)</div>${etudiant.prenom} ${etudiant.nom}</div>
<div class="sign-block"><div>Le Directeur / La Directrice</div>Cachet et signature</div>
</div>
<div class="footer">${nomEcole} · ${typeLabel} · Délivrée le ${new Date(attestation.date_emission).toLocaleDateString('fr-FR')}</div>
</div><script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}

export function printDiploma(etudiant: Etudiant, diploma: Diploma, nomEcole: string) {
  const mention = MENTIONS_DIPLOME.find(m => m.value === diploma.mention)
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Diplôme</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;background:#fff}.page{width:880px;height:620px;margin:auto;padding:48px 60px;border:8px double #7C3AED;position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;background:#f5f3ff;font-size:120px;color:#7C3AED20;font-weight:900;letter-spacing:-4px;pointer-events:none}.header{margin-bottom:24px}.school{font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:#1a1a2e}.title{font-size:36px;font-weight:700;text-transform:uppercase;letter-spacing:6px;color:#7C3AED;margin:16px 0;border-top:2px solid #7C3AED;border-bottom:2px solid #7C3AED;padding:8px 0}.name{font-size:28px;font-style:italic;font-weight:700;color:#1a1a2e;margin-bottom:8px}.level{font-size:16px;color:#444;margin-bottom:4px}.mention{font-size:20px;font-weight:700;color:${mention?.color ?? '#0F172A'};margin:16px 0}.details{font-size:12px;color:#666;line-height:2}.footer{display:flex;justify-content:space-between;width:100%;margin-top:auto;padding-top:24px}.sign-box{text-align:center;width:200px}.sign-line{border-top:1px solid #555;padding-top:6px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555}.num{position:absolute;bottom:16px;right:24px;font-size:9px;color:#aaa}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body><div class="page">
<div class="watermark">DIPLÔME</div>
<div class="header"><div class="school">${nomEcole}</div></div>
<div class="title">Diplôme de ${diploma.type_diplome}</div>
<p style="font-size:13px;color:#666;margin-bottom:16px">Est décerné à</p>
<div class="name">${etudiant.prenom} ${etudiant.nom}</div>
<div class="level">N° ${etudiant.numero_id} · Promotion ${diploma.annee_obtention}</div>
${mention ? `<div class="mention">Mention : ${mention.label}</div>` : ''}
<div class="details">
Pour avoir accompli avec succès le programme d'études de <strong>${diploma.type_diplome}</strong><br/>
au sein de <strong>${nomEcole}</strong>
</div>
<div class="footer">
<div class="sign-box"><div class="sign-line">Le Président du Jury</div></div>
<div style="text-align:center"><div style="font-size:10px;color:#888">Délivré le ${new Date(diploma.date_emission).toLocaleDateString('fr-FR')}</div></div>
<div class="sign-box"><div class="sign-line">Le Directeur Général</div></div>
</div>
<div class="num">N° ${diploma.numero_diplome ?? '—'}</div>
</div><script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}

// ── UI Components ─────────────────────────────────────────────────────────────

export function StatutBadge({ statut }: { statut: StatutEtu }) {
  const s = STATUT_ETU[statut] ?? STATUT_ETU.actif
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

const AVATAR_PALETTE = ['#00b9a7', '#ff7000', '#0F172A']

export function Avatar({ nom, prenom, photoUrl, size = 32, avatarIndex }: { nom: string; prenom: string; photoUrl: string | null; size?: number; avatarIndex?: number }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={nom} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  const idx = avatarIndex !== undefined
    ? avatarIndex % 3
    : (nom.charCodeAt(0) + prenom.charCodeAt(0)) % 3
  const bg = AVATAR_PALETTE[idx]
  return (
    <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: bg, fontSize: size * 0.35, fontWeight: 700, color: '#FFFFFF' }}>
      {((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase()}
    </div>
  )
}

export function FI({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#00b9a7]"
      />
    </div>
  )
}

export function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    '#DC2626': '#00b9a7',
    '#7C3AED': '#ff7000',
    '#F08900': '#ff7000',
    '#0F172A': '#0F172A',
  }
  const bg = color ? (colorMap[color] ?? color) : null
  const hasColorBg = !!bg
  return (
    <div className="relative rounded-xl overflow-hidden kpi-card" style={{
      padding: '20px 24px',
      background: hasColorBg ? bg : '#FFFFFF',
      border: hasColorBg ? 'none' : '1px solid #E5E7EB',
      boxShadow: hasColorBg ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div className="relative">
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: hasColorBg ? 'rgba(255,255,255,0.85)' : '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: hasColorBg ? '#FFFFFF' : '#101729', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: hasColorBg ? 'rgba(255,255,255,0.7)' : '#9CA3AF', marginTop: 4 }}>{sub}</p>}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
      <Icon size={32} className="mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
