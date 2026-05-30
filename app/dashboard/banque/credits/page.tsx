'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil } from 'lucide-react'

interface Membre { id: string; nom: string; numero_compte: string }
interface Credit {
  id: string; membre_id: string; montant_demande: number; montant_accorde: number
  taux_interet: number; duree_mois: number; statut: string
  date_demande: string; date_accord: string|null; motif: string|null
  banque_membres: { nom: string; numero_compte: string }|null
}

const STATUTS: Record<string,string> = { en_attente:'En attente', accorde:'Accordé', en_cours:'En cours', solde:'Soldé', refuse:'Refusé' }
const STATUT_COLORS: Record<string,string> = { en_attente:'#F59E0B', accorde:'#2563EB', en_cours:'#16A34A', solde:'#64748B', refuse:'#DC2626' }
const fmtFCFA = (v: number) => new Intl.NumberFormat('fr-CG', { style:'currency', currency:'XAF', maximumFractionDigits:0 }).format(v)
const fmtDate = (d: string|null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export default function BanqueCreditsPage() {
  const [credits, setCredits]   = useState<Credit[]>([])
  const [membres, setMembres]   = useState<Membre[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Credit|null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ membre_id:'', montant_demande:'', taux_interet:'12', duree_mois:'12', motif:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch('/api/banque/credits').then(r => r.json()),
      fetch('/api/banque/membres').then(r => r.json()),
    ])
    setCredits(r1.data ?? [])
    setMembres(r2.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ membre_id:'', montant_demande:'', taux_interet:'12', duree_mois:'12', motif:'' }); setShowForm(true) }
  function openEdit(c: Credit) { setEditing(c); setForm({ membre_id:c.membre_id, montant_demande:c.montant_demande.toString(), taux_interet:c.taux_interet.toString(), duree_mois:c.duree_mois.toString(), motif:c.motif??'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.membre_id || !form.montant_demande) return
    setSaving(true)
    const payload = { membre_id:form.membre_id, montant_demande:parseFloat(form.montant_demande)||0, montant_accorde:parseFloat(form.montant_demande)||0, taux_interet:parseFloat(form.taux_interet)||12, duree_mois:parseInt(form.duree_mois)||12, motif:form.motif||null }
    if (editing) await fetch('/api/banque/credits', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    else await fetch('/api/banque/credits', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function updateStatut(id: string, statut: string) {
    await fetch('/api/banque/credits', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, statut }) })
    load()
  }

  const actifs       = credits.filter(c => c.statut === 'en_cours')
  const totalDecaisse = actifs.reduce((s,c) => s + c.montant_accorde, 0)
  const enSouffrance = credits.filter(c => c.statut === 'en_attente').length

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Crédits & Prêts</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Octroi, suivi et remboursement des crédits</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouveau crédit
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Crédits actifs',    value:actifs.length.toString(),       color:'#2563EB' },
          { label:'Montant décaissé',  value:fmtFCFA(totalDecaisse),         color:'#DC2626' },
          { label:'En souffrance',     value:enSouffrance.toString(),        color:'#F59E0B' },
          { label:'Total dossiers',    value:credits.length.toString(),      color:'#64748B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : credits.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun crédit enregistré</div>
          <button onClick={openCreate} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Accorder le premier crédit</button>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
              {['Membre','Montant accordé','Taux','Durée','Statut','Date demande','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#64748B' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {credits.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i<credits.length-1?'1px solid #F1F5F9':'none' }}>
                  <td style={{ padding:'11px 14px' }}>
                    <div style={{ fontWeight:600 }}>{c.banque_membres?.nom ?? '—'}</div>
                    <div style={{ fontSize:11, color:'#94A3B8' }}>{c.banque_membres?.numero_compte}</div>
                  </td>
                  <td style={{ padding:'11px 14px', fontWeight:700 }}>{fmtFCFA(c.montant_accorde)}</td>
                  <td style={{ padding:'11px 14px', color:'#64748B' }}>{c.taux_interet}%</td>
                  <td style={{ padding:'11px 14px', color:'#64748B' }}>{c.duree_mois} mois</td>
                  <td style={{ padding:'11px 14px' }}>
                    <select value={c.statut} onChange={e => updateStatut(c.id, e.target.value)} style={{ border:'1px solid #E2E8F0', borderRadius:6, padding:'3px 6px', fontSize:12, background:'#fff', color:STATUT_COLORS[c.statut] }}>
                      {Object.entries(STATUTS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:'11px 14px', color:'#64748B', fontSize:13 }}>{fmtDate(c.date_demande)}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <button onClick={() => openEdit(c)} style={{ padding:'5px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B' }}><Pencil size={12} /></button>
                  </td>
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
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier le crédit' : 'Nouveau crédit'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Membre *</label>
              <select value={form.membre_id} onChange={e => setForm(p => ({ ...p, membre_id:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, background:'#fff' }}>
                <option value="">— Choisir un membre —</option>
                {membres.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.numero_compte})</option>)}
              </select>
            </div>
            {[
              { label:'Montant demandé (FCFA) *', key:'montant_demande', placeholder:'0' },
              { label:'Taux d\'intérêt (%)', key:'taux_interet', placeholder:'12' },
              { label:'Durée (mois)', key:'duree_mois', placeholder:'12' },
              { label:'Motif du crédit', key:'motif', placeholder:'Ex: Achat matériel, fonds de roulement…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving||!form.membre_id||!form.montant_demande} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.membre_id||!form.montant_demande?0.6:1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Accorder le crédit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
