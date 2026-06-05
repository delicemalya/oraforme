'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  MapPin, Briefcase, Clock, Users, DollarSign, GraduationCap,
  Upload, Loader2, Check, X, AlertCircle, ChevronRight,
  Languages, Award, Monitor,
} from 'lucide-react'

interface Offre {
  id: string
  titre: string
  departement: string | null
  localisation: string | null
  type_contrat: string | null
  nombre_postes: number
  salaire_min: number | null
  salaire_max: number | null
  date_limite: string | null
  diplome_requis: string | null
  experience_min: number
  competences_obligatoires: string[] | null
  competences_souhaitees: string[] | null
  langues: string[] | null
  certifications: string[] | null
  logiciels: string[] | null
  description: string | null
  statut: string
  created_at: string
  tenant_nom: string
  tenant_secteur: string | null
  slug: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Aujourd\'hui'
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`
  return `Il y a ${Math.floor(days / 30)} mois`
}

function Chip({ children, color = '#64748B' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{ color, borderColor: `${color}35`, background: `${color}08` }}>
      {children}
    </span>
  )
}

export default function JobPage() {
  const params = useParams<{ entreprise: string; poste: string }>()
  const router = useRouter()
  const [offre, setOffre] = useState<Offre | null>(null)
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'expired'>('loading')

  // Form state
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [message, setMessage] = useState('')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [drag, setDrag] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!params.entreprise || !params.poste) return
    const slug = `${params.entreprise}-${params.poste}`
    fetch(`/api/jobs/offre?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setStatus(data.expired ? 'expired' : 'not_found')
        } else {
          setOffre(data)
          setStatus('found')
        }
      })
      .catch(() => setStatus('not_found'))
  }, [params.entreprise, params.poste])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!offre || !nom || !prenom || !email) { setFormError('Nom, prénom et email sont obligatoires.'); return }
    setFormError(''); setSubmitting(true)

    const fd = new FormData()
    fd.append('offreSlug', offre.slug)
    fd.append('nom', nom)
    fd.append('prenom', prenom)
    fd.append('email', email)
    fd.append('telephone', telephone)
    fd.append('message', message)
    if (cvFile) fd.append('cv', cvFile)

    const res = await fetch('/api/jobs/candidature', { method: 'POST', body: fd })
    const data = await res.json()
    setSubmitting(false)

    if (data.success === false && data.doublon) {
      setFormError(data.message)
      return
    }
    if (!res.ok || !data.success) {
      setFormError(data.error ?? 'Erreur lors de l\'envoi. Veuillez réessayer.')
      return
    }
    router.push(`/jobs/suivi/${data.id}`)
  }

  const initiales = offre?.tenant_nom?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '??'
  const bgColors = ['#F59E0B', '#2563EB', '#16A34A', '#DC2626', '#8B5CF6', '#0891B2']
  const logoColor = bgColors[(offre?.tenant_nom?.charCodeAt(0) ?? 0) % bgColors.length]

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#F59E0B]" />
      </div>
    )
  }

  if (status === 'not_found' || status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF3C7] flex items-center justify-center mx-auto mb-4">
            <Briefcase size={28} className="text-[#F59E0B]" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] mb-2">
            {status === 'expired' ? 'Offre expirée' : 'Offre introuvable'}
          </h1>
          <p className="text-sm text-[#64748B]">
            {status === 'expired'
              ? 'Cette offre d\'emploi n\'est plus disponible.'
              : 'Cette offre n\'existe pas ou a été supprimée.'}
          </p>
          <p className="text-xs text-[#94A3B8] mt-4">Propulsé par <span className="font-bold text-[#F59E0B]">oraforme</span></p>
        </div>
      </div>
    )
  }

  if (!offre) return null

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Top bar */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-[#0F172A]">
            oraforme <span className="text-[#F59E0B]">·</span> <span className="font-normal text-[#64748B] text-sm">Portail emploi</span>
          </span>
          <a href="#apply"
            className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors">
            Postuler <ChevronRight size={12} />
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
        {/* Hero */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 sm:p-8 mb-6">
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Company logo */}
            <div
              className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl shadow-sm"
              style={{ background: logoColor }}
            >
              {initiales}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#64748B] mb-1">{offre.tenant_nom}</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] leading-tight mb-3">
                {offre.titre}
              </h1>

              <div className="flex flex-wrap gap-2 text-xs text-[#64748B]">
                {offre.localisation && (
                  <span className="flex items-center gap-1"><MapPin size={12} />{offre.localisation}</span>
                )}
                {offre.type_contrat && (
                  <span className="flex items-center gap-1"><Briefcase size={12} />{offre.type_contrat}</span>
                )}
                {offre.experience_min > 0 && (
                  <span className="flex items-center gap-1"><Clock size={12} />{offre.experience_min}+ ans d&apos;expérience</span>
                )}
                {offre.nombre_postes > 1 && (
                  <span className="flex items-center gap-1"><Users size={12} />{offre.nombre_postes} postes</span>
                )}
                <span className="text-[#94A3B8]">· {daysSince(offre.created_at)}</span>
              </div>

              {(offre.salaire_min || offre.salaire_max) && (
                <div className="flex items-center gap-1 mt-3 text-[#16A34A] font-semibold text-sm">
                  <DollarSign size={14} />
                  {offre.salaire_min && offre.salaire_max
                    ? `${fmt(offre.salaire_min)} – ${fmt(offre.salaire_max)} FCFA`
                    : offre.salaire_min
                    ? `À partir de ${fmt(offre.salaire_min)} FCFA`
                    : `Jusqu\'à ${fmt(offre.salaire_max!)} FCFA`}
                </div>
              )}
            </div>
          </div>

          {/* Mobile apply button */}
          <a href="#apply" className="sm:hidden mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#F59E0B] text-white rounded-xl text-sm font-bold hover:bg-[#E09000] transition-colors">
            Postuler maintenant <ChevronRight size={14} />
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Job details */}
          <div className="lg:col-span-3 space-y-5">
            {/* Description */}
            {offre.description && (
              <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Description du poste</h2>
                <div className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{offre.description}</div>
              </section>
            )}

            {/* Requirements */}
            {(offre.diplome_requis || offre.experience_min > 0 || offre.departement) && (
              <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Profil recherché</h2>
                <div className="space-y-3">
                  {offre.diplome_requis && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                        <GraduationCap size={15} className="text-[#64748B]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-0.5">Diplôme</p>
                        <p className="text-sm text-[#0F172A] font-medium">{offre.diplome_requis}</p>
                      </div>
                    </div>
                  )}
                  {offre.experience_min > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                        <Clock size={15} className="text-[#64748B]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-0.5">Expérience</p>
                        <p className="text-sm text-[#0F172A] font-medium">{offre.experience_min} an{offre.experience_min > 1 ? 's' : ''} minimum</p>
                      </div>
                    </div>
                  )}
                  {offre.departement && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                        <Briefcase size={15} className="text-[#64748B]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-0.5">Département</p>
                        <p className="text-sm text-[#0F172A] font-medium">{offre.departement}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Compétences */}
            {((offre.competences_obligatoires?.length ?? 0) > 0 || (offre.competences_souhaitees?.length ?? 0) > 0) && (
              <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
                <h2 className="text-base font-bold text-[#0F172A] mb-4">Compétences</h2>
                {(offre.competences_obligatoires?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Obligatoires</p>
                    <div className="flex flex-wrap gap-2">
                      {offre.competences_obligatoires!.map((c, i) => <Chip key={i} color="#DC2626">{c}</Chip>)}
                    </div>
                  </div>
                )}
                {(offre.competences_souhaitees?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Souhaitées</p>
                    <div className="flex flex-wrap gap-2">
                      {offre.competences_souhaitees!.map((c, i) => <Chip key={i} color="#2563EB">{c}</Chip>)}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Langues + certifications + logiciels */}
            {((offre.langues?.length ?? 0) > 0 || (offre.certifications?.length ?? 0) > 0 || (offre.logiciels?.length ?? 0) > 0) && (
              <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4">
                {(offre.langues?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Languages size={14} className="text-[#64748B]" />
                      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Langues</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {offre.langues!.map((l, i) => <Chip key={i} color="#16A34A">{l}</Chip>)}
                    </div>
                  </div>
                )}
                {(offre.certifications?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Award size={14} className="text-[#64748B]" />
                      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Certifications</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {offre.certifications!.map((c, i) => <Chip key={i} color="#8B5CF6">{c}</Chip>)}
                    </div>
                  </div>
                )}
                {(offre.logiciels?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor size={14} className="text-[#64748B]" />
                      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Logiciels</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {offre.logiciels!.map((l, i) => <Chip key={i} color="#0891B2">{l}</Chip>)}
                    </div>
                  </div>
                )}
              </section>
            )}

            {offre.date_limite && (
              <p className="text-xs text-[#94A3B8] text-center pb-4">
                Date limite de candidature : <span className="font-semibold text-[#64748B]">{new Date(offre.date_limite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </p>
            )}
          </div>

          {/* Right: Application form */}
          <div className="lg:col-span-2">
            <div id="apply" className="bg-white rounded-2xl border border-[#E2E8F0] p-6 lg:sticky lg:top-20">
              <h2 className="text-base font-bold text-[#0F172A] mb-1">Postuler maintenant</h2>
              <p className="text-xs text-[#64748B] mb-5">Votre candidature sera examinée par {offre.tenant_nom}</p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1 block">Prénom *</label>
                    <input value={prenom} onChange={e => setPrenom(e.target.value)} required
                      placeholder="Jean"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1 block">Nom *</label>
                    <input value={nom} onChange={e => setNom(e.target.value)} required
                      placeholder="Dupont"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1 block">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="jean.dupont@email.com"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1 block">Téléphone</label>
                  <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
                    placeholder="+242 06 XXX XX XX"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
                  />
                </div>

                {/* CV Upload */}
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1 block">CV / Résumé</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDrag(true) }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setCvFile(f) }}
                    onClick={() => inputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      drag ? 'border-[#F59E0B] bg-[#FEF3C7]/40'
                      : cvFile ? 'border-[#16A34A] bg-[#16A34A]/5'
                      : 'border-[#E2E8F0] hover:border-[#F59E0B]/50 hover:bg-[#FEF3C7]/10'
                    }`}
                  >
                    {cvFile ? (
                      <div className="flex items-center gap-2 justify-center">
                        <Check size={14} className="text-[#16A34A]" />
                        <span className="text-xs font-medium text-[#16A34A] truncate max-w-[140px]">{cvFile.name}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); setCvFile(null) }}
                          className="text-[#94A3B8] hover:text-[#DC2626] transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={18} className="mx-auto mb-1.5 text-[#94A3B8]" />
                        <p className="text-xs font-medium text-[#64748B]">Déposez votre CV ici</p>
                        <p className="text-[10px] text-[#94A3B8]">PDF, DOC, DOCX, PNG, JPG</p>
                      </>
                    )}
                    <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f) }} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1 block">Message (optionnel)</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                    placeholder="Présentez-vous brièvement, motivations..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors resize-none"
                  />
                </div>

                {formError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{formError}</p>
                  </div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#F59E0B] text-white rounded-xl text-sm font-bold hover:bg-[#E09000] transition-colors disabled:opacity-60">
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</> : <><Check size={16} /> Envoyer ma candidature</>}
                </button>

                <p className="text-[10px] text-[#94A3B8] text-center">
                  Vos données sont transmises directement à {offre.tenant_nom}.<br />
                  Un email de confirmation vous sera envoyé.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-[11px] text-[#94A3B8]">
        Propulsé par <span className="font-bold text-[#F59E0B]">oraforme</span> — Portail emploi MIAA Job
      </footer>
    </div>
  )
}
