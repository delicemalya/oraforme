'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Building2, Layers, MapPin, Plus, X, Save,
  ChevronRight, AlertCircle, Loader2, Trash2, Edit3,
  Settings, ArrowLeft, CheckCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityRow {
  id:               string
  nomEntreprise:    string
  typeEntite:       string
  pays:             string | null
  secteurActivite:  string | null
  parentTenantId:   string | null
  ordreAffichage:   number
  allowConsolidation: boolean
}

type TypeEntite = 'societe' | 'filiale' | 'agence'

interface FormState {
  nom:              string
  typeEntite:       TypeEntite
  pays:             string
  secteur:          string
  parentId:         string
  ordre:            string
  allowConsol:      boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  groupe:  Globe,
  societe: Building2,
  filiale: Layers,
  agence:  MapPin,
}
const TYPE_COLOR: Record<string, string> = {
  groupe:  '#2563EB',
  societe: '#F59E0B',
  filiale: '#16A34A',
  agence:  '#7C3AED',
}
const TYPE_LABEL: Record<string, string> = {
  groupe:  'Groupe',
  societe: 'Pays / Société',
  filiale: 'Filiale',
  agence:  'Agence',
}

const PAYS_OPTIONS = [
  'Congo-Brazzaville', 'RDC', 'Cameroun', 'Gabon', 'Sénégal',
  'Côte d\'Ivoire', 'Mali', 'Burkina Faso', 'Togo', 'Bénin',
  'Madagascar', 'Rwanda', 'Kenya', 'Nigeria', 'Ghana', 'Autre',
]

const SECTEUR_OPTIONS = [
  'Recrutement & Placement RH', 'Interim & MAD', 'Cabinet RH',
  'Commerce & Distribution', 'BTP', 'Santé', 'Transport',
  'Banque & Finance', 'Hôtellerie', 'Restaurant', 'Autre',
]

const EMPTY_FORM: FormState = {
  nom: '', typeEntite: 'societe', pays: '', secteur: 'Recrutement & Placement RH',
  parentId: '', ordre: '0', allowConsol: true,
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GestionGroupePage() {
  const { tenant } = useTenantContext()
  const { tenantId } = useTenant()
  const router = useRouter()

  const [entities,  setEntities]  = useState<EntityRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)

  // Guard
  useEffect(() => {
    if (tenant && tenant.typeEntite === 'standalone') router.replace('/dashboard')
  }, [tenant, router])

  const loadEntities = useCallback(async () => {
    if (!tenantId) return
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('v_entity_tree')
        .select('id, nom_entreprise, type_entite, pays, secteur_activite, parent_tenant_id, ordre_affichage, allow_consolidation')
        .order('depth').order('ordre_affichage').order('nom_entreprise')
      if (err) throw err
      setEntities((data ?? []).map((r: Record<string, unknown>) => ({
        id:               r.id as string,
        nomEntreprise:    r.nom_entreprise as string,
        typeEntite:       r.type_entite as string,
        pays:             r.pays as string | null,
        secteurActivite:  r.secteur_activite as string | null,
        parentTenantId:   r.parent_tenant_id as string | null,
        ordreAffichage:   r.ordre_affichage as number,
        allowConsolidation: r.allow_consolidation as boolean,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { void loadEntities() }, [loadEntities])

  function startCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setError(null); setSuccess(null)
  }

  function startEdit(e: EntityRow) {
    setEditId(e.id)
    setForm({
      nom:         e.nomEntreprise,
      typeEntite:  e.typeEntite as TypeEntite,
      pays:        e.pays ?? '',
      secteur:     e.secteurActivite ?? '',
      parentId:    e.parentTenantId ?? '',
      ordre:       String(e.ordreAffichage),
      allowConsol: e.allowConsolidation,
    })
    setShowForm(true)
    setError(null); setSuccess(null)
  }

  async function handleSave() {
    if (!tenantId || !form.nom.trim()) { setError('Le nom est requis'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        nom_entreprise:      form.nom.trim(),
        type_entite:         form.typeEntite,
        pays:                form.pays || null,
        secteur_activite:    form.secteur || null,
        parent_tenant_id:    form.parentId || null,
        ordre_affichage:     parseInt(form.ordre) || 0,
        allow_consolidation: form.allowConsol,
      }

      if (editId) {
        const { error: err } = await supabase.from('tenants').update(payload).eq('id', editId)
        if (err) throw err
        setSuccess('Entité mise à jour')
      } else {
        // Create a new tenant as a child entity
        const { error: err } = await supabase.from('tenants').insert({
          ...payload,
          taille:    tenant?.taille ?? 'grande',
          secteur:   'recrutement',
          // auth_user_id will be inherited from group owner — handled by RLS
        })
        if (err) throw err
        setSuccess('Entité créée')
      }

      setShowForm(false)
      setEditId(null)
      await loadEntities()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setSaving(true); setError(null)
    try {
      const { error: err } = await supabase.from('tenants')
        .update({ parent_tenant_id: null, type_entite: 'standalone' })
        .eq('id', deleteId)
      if (err) throw err
      setSuccess('Entité détachée du groupe')
      setDeleteId(null)
      await loadEntities()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // Parent options: can only pick entities of a type above the chosen type
  const parentOptions = entities.filter(e => {
    if (form.typeEntite === 'societe') return e.typeEntite === 'groupe'
    if (form.typeEntite === 'filiale') return e.typeEntite === 'societe' || e.typeEntite === 'groupe'
    if (form.typeEntite === 'agence')  return e.typeEntite === 'filiale'  || e.typeEntite === 'societe'
    return false
  })

  if (!tenant || tenant.typeEntite === 'standalone') return null

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/groupe')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/20 flex items-center justify-center">
              <Settings size={18} className="text-[#F59E0B]" />
            </div>
            <div>
              <h1 className="text-white font-black text-[17px]">Gestion du Groupe</h1>
              <p className="text-[#94A3B8] text-[11px]">
                Créer et organiser : Pays · Filiales · Agences
              </p>
            </div>
          </div>
          <button onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[13px]
              text-white bg-[#F59E0B] hover:bg-[#D97706] transition-colors">
            <Plus size={14} />Ajouter une entité
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-5">

        {/* ── Entity list ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-700">
              <AlertCircle size={14} />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-[13px] text-green-700">
              <CheckCircle size={14} />{success}
            </div>
          )}

          {/* Architecture guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-[12px] font-bold text-blue-800 mb-2">Structure recommandée</p>
            <div className="flex items-center gap-2 text-[11px] text-blue-700">
              <Globe size={12} /><span>Groupe</span>
              <ChevronRight size={10} />
              <Building2 size={12} /><span>Pays/Société</span>
              <ChevronRight size={10} />
              <Layers size={12} /><span>Filiale</span>
              <ChevronRight size={10} />
              <MapPin size={12} /><span>Agence</span>
            </div>
            <p className="text-[10px] text-blue-600 mt-1.5">
              Exemple : Groupe RH Afrique → Congo → Filiale Brazzaville → Agence Centre-Ville
            </p>
          </div>

          {/* Entities */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
              <p className="text-[13px] font-bold text-[#0F172A]">
                Entités du groupe
              </p>
              <span className="text-[11px] text-[#94A3B8]">{entities.length} entité{entities.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={22} className="text-[#F59E0B] animate-spin" />
              </div>
            ) : entities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                <Globe size={32} className="text-[#E2E8F0]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#64748B]">Aucune entité configurée</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Commencez par ajouter un pays ou une société</p>
                </div>
                <button onClick={startCreate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[12px] text-white bg-[#F59E0B] hover:bg-[#D97706]">
                  <Plus size={13} />Ajouter
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#F8FAFC]">
                {entities.map(e => {
                  const Icon = TYPE_ICON[e.typeEntite] ?? Building2
                  const color = TYPE_COLOR[e.typeEntite] ?? '#64748B'
                  const parent = entities.find(p => p.id === e.parentTenantId)
                  return (
                    <div key={e.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: color + '15' }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-[#0F172A] truncate">{e.nomEntreprise}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ color, background: color + '18' }}>
                            {TYPE_LABEL[e.typeEntite]}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#94A3B8]">
                          {e.pays ? `${e.pays}` : ''}
                          {parent ? ` · sous ${parent.nomEntreprise}` : ''}
                          {e.secteurActivite ? ` · ${e.secteurActivite}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {e.allowConsolidation && (
                          <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                            Consolidé
                          </span>
                        )}
                        <button onClick={() => startEdit(e)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B]
                            hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={() => router.push(`/dashboard/groupe/${e.id}`)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B]
                            hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
                          <ChevronRight size={12} />
                        </button>
                        <button onClick={() => setDeleteId(e.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#DC2626]/40
                            hover:bg-red-50 hover:text-[#DC2626] transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Form panel ── */}
        {showForm && (
          <div className="w-[340px] shrink-0">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm sticky top-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
                <p className="text-[13px] font-bold text-[#0F172A]">
                  {editId ? 'Modifier l\'entité' : 'Nouvelle entité'}
                </p>
                <button onClick={() => setShowForm(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]">
                  <X size={14} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Nom */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">
                    Nom de l&apos;entité <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="ex: Filiale Congo SA"
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px]
                      focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 focus:border-[#F59E0B] bg-[#FAFAFA]"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">
                    Type d&apos;entité
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['societe', 'filiale', 'agence'] as TypeEntite[]).map(type => {
                      const Icon = TYPE_ICON[type] ?? Building2
                      const color = TYPE_COLOR[type]
                      const active = form.typeEntite === type
                      return (
                        <button key={type} onClick={() => setForm(f => ({ ...f, typeEntite: type, parentId: '' }))}
                          className="flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all"
                          style={{
                            borderColor: active ? color : '#E2E8F0',
                            background:  active ? color + '12' : 'transparent',
                          }}>
                          <Icon size={14} style={{ color: active ? color : '#94A3B8' }} />
                          <span className="text-[9px] font-bold" style={{ color: active ? color : '#94A3B8' }}>
                            {TYPE_LABEL[type]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Parent */}
                {parentOptions.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">
                      Rattachement hiérarchique
                    </label>
                    <select value={form.parentId}
                      onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                      className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px]
                        focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 bg-[#FAFAFA]">
                      <option value="">Rattacher directement au groupe</option>
                      {parentOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.nomEntreprise} ({TYPE_LABEL[p.typeEntite]})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pays */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">Pays</label>
                  <select value={form.pays}
                    onChange={e => setForm(f => ({ ...f, pays: e.target.value }))}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px]
                      focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 bg-[#FAFAFA]">
                    <option value="">Sélectionner…</option>
                    {PAYS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Secteur */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">Secteur</label>
                  <select value={form.secteur}
                    onChange={e => setForm(f => ({ ...f, secteur: e.target.value }))}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px]
                      focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 bg-[#FAFAFA]">
                    {SECTEUR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Consolidation */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div onClick={() => setForm(f => ({ ...f, allowConsol: !f.allowConsol }))}
                    className="relative w-9 h-5 rounded-full transition-colors"
                    style={{ background: form.allowConsol ? '#16A34A' : '#D1D5DB' }}>
                    <div className="absolute top-0.5 transition-transform rounded-full w-4 h-4 bg-white shadow"
                      style={{ left: form.allowConsol ? '18px' : '2px' }} />
                  </div>
                  <span className="text-[12px] font-medium text-[#374151]">
                    Inclure dans les consolidations
                  </span>
                </label>

                {error && (
                  <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button onClick={handleSave} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px]
                    text-white bg-[#F59E0B] hover:bg-[#D97706] transition-colors disabled:opacity-50">
                  {saving
                    ? <><Loader2 size={14} className="animate-spin" />Enregistrement…</>
                    : <><Save size={14} />{editId ? 'Mettre à jour' : 'Créer l\'entité'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirm modal ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#0F172A]">Détacher cette entité ?</p>
                <p className="text-[12px] text-[#64748B]">
                  Elle sera détachée du groupe (ses données restent intactes).
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
                {saving ? 'Détachement…' : 'Détacher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
