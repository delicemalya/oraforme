'use client'

import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil } from 'lucide-react'

interface Intrant {
  id: string; nom: string; type_intrant: string; quantite_stock: number
  unite: string; prix_unitaire: number; fournisseur: string|null
  date_achat: string|null; date_expiration: string|null; notes: string|null
}

const TYPE_LABELS: Record<string,string> = { semence:'Semence', engrais:'Engrais', pesticide:'Pesticide', herbicide:'Herbicide', equipement:'Équipement', carburant:'Carburant', autre:'Autre' }
const TYPE_COLORS: Record<string,string> = { semence:'#16A34A', engrais:'#F59E0B', pesticide:'#DC2626', herbicide:'#7C3AED', equipement:'#2563EB', carburant:'#EA580C', autre:'#64748B' }
const fmtDate = (d: string|null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export default function AgricultureIntrantsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()
  const [intrants, setIntrants] = useState<Intrant[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Intrant|null>(null)
  const [saving, setSaving]     = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [form, setForm] = useState({ nom:'', type_intrant:'semence', quantite_stock:'', unite:'kg', prix_unitaire:'', fournisseur:'', date_achat:'', date_expiration:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/agriculture/intrants')
    const json = await res.json()
    setIntrants(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ nom:'', type_intrant:'semence', quantite_stock:'', unite:'kg', prix_unitaire:'', fournisseur:'', date_achat:'', date_expiration:'', notes:'' }); setShowForm(true) }
  function openEdit(i: Intrant) { setEditing(i); setForm({ nom:i.nom, type_intrant:i.type_intrant, quantite_stock:i.quantite_stock.toString(), unite:i.unite, prix_unitaire:i.prix_unitaire.toString(), fournisseur:i.fournisseur??'', date_achat:i.date_achat??'', date_expiration:i.date_expiration??'', notes:i.notes??'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom:form.nom, type_intrant:form.type_intrant, quantite_stock:parseFloat(form.quantite_stock)||0, unite:form.unite, prix_unitaire:parseFloat(form.prix_unitaire)||0, fournisseur:form.fournisseur||null, date_achat:form.date_achat||null, date_expiration:form.date_expiration||null, notes:form.notes||null }
    if (editing) await fetch('/api/agriculture/intrants', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    else await fetch('/api/agriculture/intrants', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  const filtered = filterType === 'all' ? intrants : intrants.filter(i => i.type_intrant === filterType)
  const totalValeur = intrants.reduce((s,i) => s + i.quantite_stock * i.prix_unitaire, 0)
  const stockBas = intrants.filter(i => i.quantite_stock < 10).length

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Intrants & Équipements</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Semences, engrais, pesticides et matériel agricole</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Ajouter un intrant
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Références',     value:intrants.length.toString(),  color:'#2563EB' },
          { label:'Valeur stock',   value:fmtFCFA(totalValeur),        color:'#F59E0B' },
          { label:'Stock bas (<10)',value:stockBas.toString(),         color:'#DC2626' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[['all','Tous'], ...Object.entries(TYPE_LABELS)].map(([k,v]) => (
          <button key={k} onClick={() => setFilterType(k)} style={{ padding:'6px 14px', border:`1px solid ${filterType===k?'#16A34A':'#E2E8F0'}`, borderRadius:20, cursor:'pointer', background:filterType===k?'#16A34A':'#fff', color:filterType===k?'#fff':'#64748B', fontSize:13, fontWeight:filterType===k?600:400 }}>{v}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🌱</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun intrant enregistré</div>
          <button onClick={openCreate} style={{ background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Ajouter le premier intrant</button>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:14, minWidth:700 }}>
            <thead><tr style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
              {['Intrant','Type','Stock','Unité','Prix unitaire','Valeur','Fournisseur','Expiration',''].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#64748B' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((i, idx) => (
                <tr key={i.id} style={{ borderBottom: idx<filtered.length-1?'1px solid #F1F5F9':'none' }}>
                  <td style={{ padding:'11px 14px', fontWeight:600 }}>{i.nom}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:(TYPE_COLORS[i.type_intrant]||'#64748B')+'20', color:TYPE_COLORS[i.type_intrant]||'#64748B' }}>{TYPE_LABELS[i.type_intrant]}</span>
                  </td>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:i.quantite_stock<10?'#DC2626':'#0F172A' }}>{i.quantite_stock.toLocaleString('fr-FR')}</td>
                  <td style={{ padding:'11px 14px', color:'#64748B' }}>{i.unite}</td>
                  <td style={{ padding:'11px 14px' }}>{fmtFCFA(i.prix_unitaire)}</td>
                  <td style={{ padding:'11px 14px', fontWeight:600, color:'#16A34A' }}>{fmtFCFA(i.quantite_stock * i.prix_unitaire)}</td>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{i.fournisseur ?? '—'}</td>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{fmtDate(i.date_expiration)}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <button onClick={() => openEdit(i)} style={{ padding:'5px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B' }}><Pencil size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier l\'intrant' : 'Nouvel intrant'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Type d'intrant</label>
              <select value={form.type_intrant} onChange={e => setForm(p => ({ ...p, type_intrant:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {[
              { label:'Nom *', key:'nom', placeholder:'Ex: Maïs hybride NK6410' },
              { label:'Quantité en stock', key:'quantite_stock', placeholder:'0' },
              { label:'Unité', key:'unite', placeholder:'kg, L, sac, pièce…' },
              { label:'Prix unitaire (FCFA)', key:'prix_unitaire', placeholder:'0' },
              { label:'Fournisseur', key:'fournisseur', placeholder:'Nom du fournisseur' },
              { label:'Date d\'achat', key:'date_achat', type:'date' },
              { label:'Date d\'expiration', key:'date_expiration', type:'date' },
              { label:'Notes', key:'notes', placeholder:'Observations…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type??'text'} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving||!form.nom.trim()} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#16A34A', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.nom.trim()?0.6:1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Ajouter l\'intrant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
