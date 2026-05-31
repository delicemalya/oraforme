'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil } from 'lucide-react'

interface Site {
  id: string; nom: string; localisation: string|null; type_site: string
  production_journaliere: number; unite_production: string; statut: string
  date_ouverture: string|null; operateur: string|null
}

const TYPE_LABELS: Record<string,string> = { puits:'Puits', mine:'Mine', raffinerie:'Raffinerie', depot:'Dépôt', autre:'Autre' }
const STATUT_COLORS: Record<string,string> = { actif:'#16A34A', inactif:'#94A3B8', maintenance:'#F59E0B', explore:'#2563EB' }
const fmtDate = (d: string|null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export default function PetroleSitesPage() {
  const { t } = useLocale()
  const [sites, setSites]       = useState<Site[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Site|null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ nom:'', localisation:'', type_site:'puits', production_journaliere:'', unite_production:'barils', date_ouverture:'', operateur:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/petrole/sites')
    const json = await res.json()
    setSites(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ nom:'', localisation:'', type_site:'puits', production_journaliere:'', unite_production:'barils', date_ouverture:'', operateur:'', notes:'' }); setShowForm(true) }
  function openEdit(s: Site) { setEditing(s); setForm({ nom:s.nom, localisation:s.localisation??'', type_site:s.type_site, production_journaliere:s.production_journaliere.toString(), unite_production:s.unite_production, date_ouverture:s.date_ouverture??'', operateur:s.operateur??'', notes:'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom:form.nom, localisation:form.localisation||null, type_site:form.type_site, production_journaliere:parseFloat(form.production_journaliere)||0, unite_production:form.unite_production, date_ouverture:form.date_ouverture||null, operateur:form.operateur||null, notes:form.notes||null }
    if (editing) await fetch('/api/petrole/sites', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    else await fetch('/api/petrole/sites', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function updateStatut(id: string, statut: string) {
    await fetch('/api/petrole/sites', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, statut }) })
    load()
  }

  const totalProd = sites.filter(s=>s.statut==='actif').reduce((sum,s) => sum + s.production_journaliere, 0)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Sites d'Extraction</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Gestion des puits, mines et sites d'exploitation</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouveau site
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Sites actifs', value:sites.filter(s=>s.statut==='actif').length.toString(), color:'#16A34A' },
          { label:'Production/jour', value:`${totalProd.toLocaleString('fr-FR')} barils`, color:'#F59E0B' },
          { label:'Total sites', value:sites.length.toString(), color:'#2563EB' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : sites.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🛢️</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun site enregistré</div>
          <button onClick={openCreate} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Ajouter le premier site</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
          {sites.map(s => (
            <div key={s.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <span style={{ fontWeight:700, fontSize:15 }}>{s.nom}</span>
                  <div style={{ display:'flex', gap:6, marginTop:4 }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:'#F1F5F9', color:'#64748B' }}>{TYPE_LABELS[s.type_site]}</span>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:STATUT_COLORS[s.statut]+'20', color:STATUT_COLORS[s.statut] }}>{s.statut}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={() => openEdit(s)} style={{ padding:'5px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B' }}><Pencil size={12} /></button>
                </div>
              </div>
              <div style={{ fontSize:13, color:'#64748B', lineHeight:'1.8' }}>
                {s.localisation && <div>Lieu : <b style={{color:'#0F172A'}}>{s.localisation}</b></div>}
                <div>Production/jour : <b style={{color:'#0F172A'}}>{s.production_journaliere.toLocaleString('fr-FR')} {s.unite_production}</b></div>
                {s.operateur && <div>Opérateur : <b style={{color:'#0F172A'}}>{s.operateur}</b></div>}
                {s.date_ouverture && <div>Ouvert le : <b style={{color:'#0F172A'}}>{fmtDate(s.date_ouverture)}</b></div>}
              </div>
              <div style={{ marginTop:10 }}>
                <select value={s.statut} onChange={e => updateStatut(s.id, e.target.value)} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:6, padding:'5px 8px', fontSize:12, background:'#fff' }}>
                  {['actif','inactif','maintenance','explore'].map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier le site' : 'Nouveau site'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            {[
              { label:'Nom du site *', key:'nom', placeholder:'Ex: Puits Nord-12' },
              { label:'Localisation', key:'localisation', placeholder:'Commune ou coordonnées' },
              { label:'Production journalière', key:'production_journaliere', placeholder:'0' },
              { label:'Unité de production', key:'unite_production', placeholder:'barils, tonnes…' },
              { label:'Opérateur', key:'operateur', placeholder:'Nom de l\'opérateur' },
              { label:'Date d\'ouverture', key:'date_ouverture', type:'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type??'text'} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Type de site</label>
              <select value={form.type_site} onChange={e => setForm(p => ({ ...p, type_site:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving||!form.nom.trim()} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.nom.trim()?.6:1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Créer le site'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
