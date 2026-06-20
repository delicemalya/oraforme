'use client'

import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'

interface Chantier {
  id: string; nom: string; client_nom: string | null; adresse: string | null
  budget: number; montant_depense: number; avancement_pct: number
  statut: string; date_debut: string | null; date_fin: string | null
  chef_projet: string | null; created_at: string
}

const STATUTS = ['planifie','en_cours','termine','suspendu','annule']
const STATUT_LABELS: Record<string, string> = { planifie:'Planifié', en_cours:'En cours', termine:'Terminé', suspendu:'Suspendu', annule:'Annulé' }
const STATUT_COLORS: Record<string, string> = { planifie:'#64748B', en_cours:'#2563EB', termine:'#16A34A', suspendu:'#F59E0B', annule:'#DC2626' }

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export default function BTPChantiersPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Chantier | null>(null)
  const [filterStatut, setFilter] = useState('')
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ nom:'', client_nom:'', adresse:'', budget:'', date_debut:'', date_fin:'', chef_projet:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const params = filterStatut ? `?statut=${filterStatut}` : ''
    const res = await fetch(`/api/btp/chantiers${params}`)
    const json = await res.json()
    setChantiers(json.data ?? [])
    setLoading(false)
  }, [filterStatut])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ nom:'', client_nom:'', adresse:'', budget:'', date_debut:'', date_fin:'', chef_projet:'', notes:'' }); setShowForm(true) }
  function openEdit(c: Chantier) { setEditing(c); setForm({ nom:c.nom, client_nom:c.client_nom??'', adresse:c.adresse??'', budget:c.budget.toString(), date_debut:c.date_debut??'', date_fin:c.date_fin??'', chef_projet:c.chef_projet??'', notes:'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom:form.nom, client_nom:form.client_nom||null, adresse:form.adresse||null, budget:parseFloat(form.budget)||0, date_debut:form.date_debut||null, date_fin:form.date_fin||null, chef_projet:form.chef_projet||null }
    if (editing) {
      await fetch('/api/btp/chantiers', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    } else {
      await fetch('/api/btp/chantiers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    }
    setSaving(false); setShowForm(false); load()
  }

  async function updateStatut(id: string, statut: string) {
    await fetch('/api/btp/chantiers', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, statut }) })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce chantier ?')) return
    await fetch(`/api/btp/chantiers?id=${id}`, { method:'DELETE' })
    load()
  }

  const totalBudget  = chantiers.reduce((s, c) => s + c.budget, 0)
  const totalDepense = chantiers.reduce((s, c) => s + c.montant_depense, 0)
  const actifs       = chantiers.filter(c => c.statut === 'en_cours').length

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Chantiers & Projets BTP</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Suivi de vos chantiers de construction</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouveau chantier
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Chantiers actifs', value:actifs.toString(), color:'#2563EB' },
          { label:'Budget total', value:fmtFCFA(totalBudget), color:'#F59E0B' },
          { label:'Dépensé', value:fmtFCFA(totalDepense), color:'#DC2626' },
          { label:'Total chantiers', value:chantiers.length.toString(), color:'#16A34A' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {['', ...STATUTS].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding:'6px 14px', borderRadius:20, border:'1px solid #E2E8F0', background: filterStatut===s ? '#2563EB' : '#fff', color: filterStatut===s ? '#fff' : '#64748B', cursor:'pointer', fontSize:13 }}>
            {s ? STATUT_LABELS[s] : 'Tous'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      ) : chantiers.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏗️</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun chantier</div>
          <button onClick={openCreate} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Créer le premier chantier</button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {chantiers.map(c => (
            <div key={c.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontWeight:700, fontSize:16 }}>{c.nom}</span>
                    <span style={{ padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600, background: STATUT_COLORS[c.statut]+'20', color: STATUT_COLORS[c.statut] }}>{STATUT_LABELS[c.statut]}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'4px 20px', fontSize:13, color:'#64748B' }}>
                    {c.client_nom && <span>Client : <b style={{color:'#0F172A'}}>{c.client_nom}</b></span>}
                    {c.chef_projet && <span>Chef : <b style={{color:'#0F172A'}}>{c.chef_projet}</b></span>}
                    <span>Budget : <b style={{color:'#0F172A'}}>{fmtFCFA(c.budget)}</b></span>
                    <span>Dépensé : <b style={{color:c.montant_depense>c.budget?'#DC2626':'#0F172A'}}>{fmtFCFA(c.montant_depense)}</b></span>
                    {c.date_debut && <span>Début : <b style={{color:'#0F172A'}}>{fmtDate(c.date_debut)}</b></span>}
                    {c.date_fin && <span>Fin prévue : <b style={{color:'#0F172A'}}>{fmtDate(c.date_fin)}</b></span>}
                  </div>
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'#64748B' }}>Avancement</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'#0F172A' }}>{c.avancement_pct}%</span>
                    </div>
                    <div style={{ height:6, background:'#F1F5F9', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${c.avancement_pct}%`, background: c.avancement_pct===100 ? '#16A34A' : '#2563EB', borderRadius:3 }} />
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <select value={c.statut} onChange={e => updateStatut(c.id, e.target.value)} style={{ border:'1px solid #E2E8F0', borderRadius:6, padding:'4px 8px', fontSize:12, cursor:'pointer', background:'#fff' }}>
                    {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                  </select>
                  <button onClick={() => openEdit(c)} style={{ padding:'6px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B' }}><Pencil size={13} /></button>
                  <button onClick={() => handleDelete(c.id)} style={{ padding:'6px 8px', border:'none', borderRadius:6, cursor:'pointer', background:'#FEF2F2', color:'#DC2626' }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier le chantier' : 'Nouveau chantier'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748B' }}><X size={20} /></button>
            </div>
            {[
              { label:'Nom du chantier *', key:'nom', type:'text', placeholder:'Ex: Construction villa Brazzaville' },
              { label:'Client', key:'client_nom', type:'text', placeholder:'Nom du client' },
              { label:'Adresse du chantier', key:'adresse', type:'text', placeholder:'Adresse ou lieu' },
              { label:'Budget (FCFA)', key:'budget', type:'number', placeholder:'0' },
              { label:'Chef de projet', key:'chef_projet', type:'text', placeholder:'Nom du chef de projet' },
              { label:'Date de début', key:'date_debut', type:'date', placeholder:'' },
              { label:'Date de fin prévue', key:'date_fin', type:'date', placeholder:'' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6, color:'#374151' }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'10px', border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:14 }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving || !form.nom.trim()} style={{ flex:2, padding:'10px', border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, fontSize:14, opacity: saving||!form.nom.trim() ? .6 : 1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Créer le chantier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
