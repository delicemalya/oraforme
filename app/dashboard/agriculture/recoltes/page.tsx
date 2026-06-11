'use client'

import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'

interface Parcelle { id: string; nom: string }
interface Recolte {
  id: string; culture: string; quantite_kg: number; prix_unitaire: number
  montant_total: number; date_recolte: string; destination: string|null
  agriculture_parcelles: { nom: string }|null
}

const DEST_LABELS: Record<string,string> = { vente:'Vente', stockage:'Stockage', autoconsommation:'Autoconsommation' }
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

export default function AgriRecoltesPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()
  const [recoltes, setRecoltes]   = useState<Recolte[]>([])
  const [parcelles, setParcelles] = useState<Parcelle[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ parcelle_id:'', culture:'', quantite_kg:'', prix_unitaire:'', date_recolte:'', destination:'vente' })

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch('/api/agriculture/recoltes').then(r => r.json()),
      fetch('/api/agriculture/parcelles').then(r => r.json()),
    ])
    setRecoltes(r1.data ?? [])
    setParcelles(r2.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.culture.trim() || !form.quantite_kg) return
    setSaving(true)
    await fetch('/api/agriculture/recoltes', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, quantite_kg:parseFloat(form.quantite_kg)||0, prix_unitaire:parseFloat(form.prix_unitaire)||0, parcelle_id:form.parcelle_id||null })
    })
    setSaving(false); setShowForm(false)
    setForm({ parcelle_id:'', culture:'', quantite_kg:'', prix_unitaire:'', date_recolte:'', destination:'vente' })
    load()
  }

  const totalKg     = recoltes.reduce((s,r) => s + r.quantite_kg, 0)
  const totalValeur = recoltes.reduce((s,r) => s + (r.montant_total ?? 0), 0)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Récoltes & Production</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Saisie et suivi de vos récoltes</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display:'flex', alignItems:'center', gap:8, background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Enregistrer une récolte
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Récoltes enregistrées', value:recoltes.length.toString(), color:'#16A34A' },
          { label:'Total produit (kg)', value:`${totalKg.toLocaleString('fr-FR')} kg`, color:'#2563EB' },
          { label:'Valeur estimée', value:fmtFCFA(totalValeur), color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : recoltes.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🌽</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucune récolte enregistrée</div>
          <button onClick={() => setShowForm(true)} style={{ background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Enregistrer la première récolte</button>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
              {['Date','Culture','Parcelle','Quantité','Prix unit.','Valeur','Destination'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#64748B' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {recoltes.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < recoltes.length-1 ? '1px solid #F1F5F9':'none' }}>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{fmtDate(r.date_recolte)}</td>
                  <td style={{ padding:'11px 14px', fontWeight:600 }}>{r.culture}</td>
                  <td style={{ padding:'11px 14px', color:'#64748B' }}>{r.agriculture_parcelles?.nom ?? '—'}</td>
                  <td style={{ padding:'11px 14px', fontWeight:600 }}>{r.quantite_kg.toLocaleString('fr-FR')} kg</td>
                  <td style={{ padding:'11px 14px', color:'#64748B' }}>{r.prix_unitaire > 0 ? fmtFCFA(r.prix_unitaire) : '—'}</td>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:'#16A34A' }}>{r.montant_total > 0 ? fmtFCFA(r.montant_total) : '—'}</td>
                  <td style={{ padding:'11px 14px' }}><span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, background:'#F0FDF4', color:'#16A34A', fontWeight:600 }}>{r.destination ? DEST_LABELS[r.destination] : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Enregistrer une récolte</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Parcelle (optionnel)</label>
              <select value={form.parcelle_id} onChange={e => setForm(p => ({ ...p, parcelle_id:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                <option value="">— Aucune parcelle —</option>
                {parcelles.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            {[
              { label:'Culture *', key:'culture', placeholder:'Ex: Manioc, Cacao, Maïs…' },
              { label:'Quantité récoltée (kg) *', key:'quantite_kg', placeholder:'0' },
              { label:'Prix unitaire (FCFA/kg)', key:'prix_unitaire', placeholder:'0' },
              { label:'Date de récolte', key:'date_recolte', type:'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type??'text'} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Destination</label>
              <select value={form.destination} onChange={e => setForm(p => ({ ...p, destination:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                <option value="vente">Vente</option>
                <option value="stockage">Stockage</option>
                <option value="autoconsommation">Autoconsommation</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving||!form.culture.trim()||!form.quantite_kg} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#16A34A', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.culture.trim()||!form.quantite_kg?.6:1 }}>
                {saving ? 'Enregistrement…' : 'Enregistrer la récolte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
