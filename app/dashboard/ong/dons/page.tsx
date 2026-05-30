'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'

interface Programme { id: string; nom: string }
interface Don {
  id: string; donateur: string; type_don: string; montant: number
  date_reception: string; mode_paiement: string; recu_emis: boolean
  ong_programmes: { nom: string }|null
}

const TYPE_LABELS: Record<string,string> = { ponctuel:'Ponctuel', regulier:'Régulier', subvention:'Subvention', materiel:'Matériel' }
const fmtFCFA = (v: number) => new Intl.NumberFormat('fr-CG', { style:'currency', currency:'XAF', maximumFractionDigits:0 }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

export default function OngDonsPage() {
  const [dons, setDons]             = useState<Don[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState({ donateur:'', type_don:'ponctuel', montant:'', date_reception:'', mode_paiement:'virement', programme_id:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch('/api/ong/dons').then(r => r.json()),
      fetch('/api/ong/programmes').then(r => r.json()),
    ])
    setDons(r1.data ?? [])
    setProgrammes(r2.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.donateur.trim() || !form.montant) return
    setSaving(true)
    await fetch('/api/ong/dons', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, montant:parseFloat(form.montant)||0, programme_id:form.programme_id||null })
    })
    setSaving(false); setShowForm(false)
    setForm({ donateur:'', type_don:'ponctuel', montant:'', date_reception:'', mode_paiement:'virement', programme_id:'', notes:'' })
    load()
  }

  const totalDons = dons.reduce((s,d) => s + d.montant, 0)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Dons & Subventions</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Collecte de fonds et affectation aux programmes</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display:'flex', alignItems:'center', gap:8, background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Enregistrer un don
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Dons reçus', value:dons.length.toString(), color:'#16A34A' },
          { label:'Total collecté', value:fmtFCFA(totalDons), color:'#2563EB' },
          { label:'Reçus émis', value:dons.filter(d=>d.recu_emis).length.toString(), color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : dons.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💝</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun don enregistré</div>
          <button onClick={() => setShowForm(true)} style={{ background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Enregistrer le premier don</button>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
              {['Date','Donateur','Type','Programme','Montant','Mode','Reçu'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#64748B' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {dons.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i<dons.length-1?'1px solid #F1F5F9':'none' }}>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{fmtDate(d.date_reception)}</td>
                  <td style={{ padding:'11px 14px', fontWeight:600 }}>{d.donateur}</td>
                  <td style={{ padding:'11px 14px' }}><span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, background:'#EFF6FF', color:'#2563EB', fontWeight:600 }}>{TYPE_LABELS[d.type_don]}</span></td>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{d.ong_programmes?.nom ?? '—'}</td>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:'#16A34A' }}>{fmtFCFA(d.montant)}</td>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{d.mode_paiement}</td>
                  <td style={{ padding:'11px 14px' }}>{d.recu_emis ? '✅' : '—'}</td>
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
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Enregistrer un don</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            {[
              { label:'Donateur / Bailleur *', key:'donateur', placeholder:'Nom du donateur' },
              { label:'Montant (FCFA) *', key:'montant', placeholder:'0' },
              { label:'Date de réception', key:'date_reception', type:'date' },
              { label:'Notes', key:'notes', placeholder:'Observations…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type??'text'} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            {[
              { label:'Type de don', key:'type_don', options:[['ponctuel','Ponctuel'],['regulier','Régulier'],['subvention','Subvention'],['materiel','Matériel']] },
              { label:'Mode de paiement', key:'mode_paiement', options:[['virement','Virement'],['especes','Espèces'],['cheque','Chèque'],['mobile','Mobile Money']] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <select value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                  {f.options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Affecter à un programme</label>
              <select value={form.programme_id} onChange={e => setForm(p => ({ ...p, programme_id:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                <option value="">— Non affecté —</option>
                {programmes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving||!form.donateur.trim()||!form.montant} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#16A34A', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.donateur.trim()||!form.montant?.6:1 }}>
                {saving ? 'Enregistrement…' : 'Enregistrer le don'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
