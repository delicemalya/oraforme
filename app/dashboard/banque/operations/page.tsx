'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'

interface Membre { id: string; nom: string; numero_compte: string; solde: number }
interface Operation {
  id: string; membre_id: string; type_operation: string; montant: number
  solde_avant: number; solde_apres: number; date_operation: string
  reference: string|null; description: string|null
  banque_membres: { nom: string; numero_compte: string }|null
}

const TYPE_LABELS: Record<string,string> = { depot:'Dépôt', retrait:'Retrait', virement:'Virement', frais:'Frais' }
const TYPE_COLORS: Record<string,string> = { depot:'#16A34A', retrait:'#DC2626', virement:'#2563EB', frais:'#F59E0B' }
const fmtFCFA = (v: number) => new Intl.NumberFormat('fr-CG', { style:'currency', currency:'XAF', maximumFractionDigits:0 }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

export default function BanqueOperationsPage() {
  const { t } = useLocale()
  const [operations, setOperations] = useState<Operation[]>([])
  const [membres, setMembres]       = useState<Membre[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({ membre_id:'', type_operation:'depot', montant:'', description:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch('/api/banque/operations').then(r => r.json()),
      fetch('/api/banque/membres').then(r => r.json()),
    ])
    setOperations(r1.data ?? [])
    setMembres(r2.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.membre_id || !form.montant) return
    setSaving(true)
    const res = await fetch('/api/banque/operations', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ membre_id:form.membre_id, type_operation:form.type_operation, montant:parseFloat(form.montant)||0, description:form.description||null })
    })
    const json = await res.json()
    setSaving(false)
    if (json.error) { alert(json.error); return }
    setShowForm(false)
    setForm({ membre_id:'', type_operation:'depot', montant:'', description:'' })
    load()
  }

  const totalDepots   = operations.filter(o=>o.type_operation==='depot').reduce((s,o)=>s+o.montant,0)
  const totalRetraits = operations.filter(o=>o.type_operation==='retrait').reduce((s,o)=>s+o.montant,0)
  const selectedMembre = membres.find(m => m.id === form.membre_id)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Opérations & Transactions</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Dépôts, retraits et mouvements de fonds</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouvelle opération
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Opérations totales', value:operations.length.toString(),   color:'#64748B' },
          { label:'Total dépôts',       value:fmtFCFA(totalDepots),           color:'#16A34A' },
          { label:'Total retraits',     value:fmtFCFA(totalRetraits),         color:'#DC2626' },
          { label:'Membres actifs',     value:membres.filter(m=>m.solde>0).length.toString(), color:'#2563EB' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : operations.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>↔️</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucune opération enregistrée</div>
          <button onClick={() => setShowForm(true)} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Enregistrer la première opération</button>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
              {['Date','Membre','Type','Montant','Solde avant','Solde après','Description'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#64748B' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {operations.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: i<operations.length-1?'1px solid #F1F5F9':'none' }}>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{fmtDate(o.date_operation)}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <div style={{ fontWeight:600 }}>{o.banque_membres?.nom ?? '—'}</div>
                    <div style={{ fontSize:11, color:'#94A3B8' }}>{o.banque_membres?.numero_compte}</div>
                  </td>
                  <td style={{ padding:'11px 14px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:TYPE_COLORS[o.type_operation]+'20', color:TYPE_COLORS[o.type_operation] }}>{TYPE_LABELS[o.type_operation]}</span>
                  </td>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:o.type_operation==='retrait'?'#DC2626':'#16A34A' }}>
                    {o.type_operation==='retrait'?'- ':''}{fmtFCFA(o.montant)}
                  </td>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{fmtFCFA(o.solde_avant)}</td>
                  <td style={{ padding:'11px 14px', fontWeight:600 }}>{fmtFCFA(o.solde_apres)}</td>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{o.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Nouvelle opération</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Membre *</label>
              <select value={form.membre_id} onChange={e => setForm(p => ({ ...p, membre_id:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                <option value="">— Choisir un membre —</option>
                {membres.map(m => <option key={m.id} value={m.id}>{m.nom} – {fmtFCFA(m.solde)}</option>)}
              </select>
            </div>
            {selectedMembre && (
              <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:13 }}>
                Solde actuel : <b style={{ color:'#16A34A' }}>{fmtFCFA(selectedMembre.solde)}</b>
              </div>
            )}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Type d'opération</label>
              <select value={form.type_operation} onChange={e => setForm(p => ({ ...p, type_operation:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {[
              { label:'Montant (FCFA) *', key:'montant', placeholder:'0' },
              { label:'Description', key:'description', placeholder:'Motif de l\'opération…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving||!form.membre_id||!form.montant} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.membre_id||!form.montant?0.6:1 }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
