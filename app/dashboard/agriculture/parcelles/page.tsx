'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'

interface Parcelle {
  id: string; nom: string; superficie_ha: number; culture: string|null
  localisation: string|null; statut: string; proprietaire: string|null; created_at: string
}

const STATUT_LABELS: Record<string,string> = { active:'Active', jachere:'Jachère', en_preparation:'En préparation', archive:'Archivée' }
const STATUT_COLORS: Record<string,string> = { active:'#16A34A', jachere:'#F59E0B', en_preparation:'#2563EB', archive:'#94A3B8' }

export default function AgriParcellesPage() {
  const { t } = useLocale()
  const [parcelles, setParcelles] = useState<Parcelle[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Parcelle|null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ nom:'', superficie_ha:'', culture:'', localisation:'', proprietaire:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/agriculture/parcelles')
    const json = await res.json()
    setParcelles(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ nom:'', superficie_ha:'', culture:'', localisation:'', proprietaire:'' }); setShowForm(true) }
  function openEdit(p: Parcelle) { setEditing(p); setForm({ nom:p.nom, superficie_ha:p.superficie_ha.toString(), culture:p.culture??'', localisation:p.localisation??'', proprietaire:p.proprietaire??'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom:form.nom, superficie_ha:parseFloat(form.superficie_ha)||0, culture:form.culture||null, localisation:form.localisation||null, proprietaire:form.proprietaire||null }
    if (editing) await fetch('/api/agriculture/parcelles', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    else await fetch('/api/agriculture/parcelles', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette parcelle ?')) return
    await fetch(`/api/agriculture/parcelles?id=${id}`, { method:'DELETE' })
    load()
  }

  async function updateStatut(id: string, statut: string) {
    await fetch('/api/agriculture/parcelles', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, statut }) })
    load()
  }

  const totalHa = parcelles.reduce((s, p) => s + p.superficie_ha, 0)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Parcelles & Cultures</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Cartographie de vos terres agricoles</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouvelle parcelle
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Parcelles actives', value: parcelles.filter(p=>p.statut==='active').length.toString(), color:'#16A34A' },
          { label:'Surface totale', value:`${totalHa.toFixed(1)} ha`, color:'#2563EB' },
          { label:'Total parcelles', value: parcelles.length.toString(), color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : parcelles.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🌾</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucune parcelle enregistrée</div>
          <button onClick={openCreate} style={{ background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Ajouter la première parcelle</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {parcelles.map(p => (
            <div key={p.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <span style={{ fontWeight:700, fontSize:15 }}>{p.nom}</span>
                <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: STATUT_COLORS[p.statut]+'20', color: STATUT_COLORS[p.statut] }}>{STATUT_LABELS[p.statut]}</span>
              </div>
              <div style={{ fontSize:13, color:'#64748B', lineHeight:'1.8' }}>
                <div>Surface : <b style={{color:'#0F172A'}}>{p.superficie_ha} ha</b></div>
                {p.culture && <div>Culture : <b style={{color:'#0F172A'}}>{p.culture}</b></div>}
                {p.localisation && <div>Lieu : <b style={{color:'#0F172A'}}>{p.localisation}</b></div>}
                {p.proprietaire && <div>Propriétaire : <b style={{color:'#0F172A'}}>{p.proprietaire}</b></div>}
              </div>
              <div style={{ display:'flex', gap:6, marginTop:12 }}>
                <select value={p.statut} onChange={e => updateStatut(p.id, e.target.value)} style={{ flex:1, border:'1px solid #E2E8F0', borderRadius:6, padding:'5px 8px', fontSize:12, background:'#fff' }}>
                  {Object.entries(STATUT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => openEdit(p)} style={{ padding:'5px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B' }}><Pencil size={12} /></button>
                <button onClick={() => handleDelete(p.id)} style={{ padding:'5px 8px', border:'none', borderRadius:6, cursor:'pointer', background:'#FEF2F2', color:'#DC2626' }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:460 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier la parcelle' : 'Nouvelle parcelle'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            {[
              { label:'Nom de la parcelle *', key:'nom', placeholder:'Ex: Parcelle Nord-1' },
              { label:'Superficie (ha)', key:'superficie_ha', placeholder:'Ex: 2.5' },
              { label:'Culture principale', key:'culture', placeholder:'Ex: Manioc, Maïs, Cacao…' },
              { label:'Localisation', key:'localisation', placeholder:'Village ou commune' },
              { label:'Propriétaire', key:'proprietaire', placeholder:'Nom du propriétaire' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving||!form.nom.trim()} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#16A34A', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.nom.trim()?.6:1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Créer la parcelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
