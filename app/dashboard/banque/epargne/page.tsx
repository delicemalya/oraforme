'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'

interface Membre {
  id: string; nom: string; prenom: string|null; numero_compte: string
  type_compte: string; solde: number; statut: string; date_adhesion: string
}

const TYPE_LABELS: Record<string,string> = { epargne:'Épargne', courant:'Courant', depot_terme:'Dépôt à terme', credit:'Crédit' }
const STATUT_COLORS: Record<string,string> = { actif:'#16A34A', suspendu:'#F59E0B', cloture:'#DC2626' }
const fmtFCFA = (v: number) => new Intl.NumberFormat('fr-CG', { style:'currency', currency:'XAF', maximumFractionDigits:0 }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

export default function BanqueEpargnePage() {
  const { t } = useLocale()
  const [membres, setMembres]   = useState<Membre[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [form, setForm] = useState({ membre_id:'', type_operation:'depot', montant:'', description:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/banque/membres')
    const json = await res.json()
    setMembres(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleOperation() {
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

  const epargne = membres.filter(m => m.type_compte === 'epargne' || m.type_compte === 'depot_terme')
  const totalEpargne = epargne.reduce((s,m) => s + m.solde, 0)
  const filtered = search ? membres.filter(m => m.nom.toLowerCase().includes(search.toLowerCase()) || m.numero_compte.includes(search)) : membres
  const selectedMembre = membres.find(m => m.id === form.membre_id)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Épargne & Dépôts</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Soldes membres et mouvements d'épargne</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display:'flex', alignItems:'center', gap:8, background:'#16A34A', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Dépôt / Retrait
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Comptes épargne',   value:epargne.length.toString(),          color:'#16A34A' },
          { label:'Total épargne',     value:fmtFCFA(totalEpargne),              color:'#2563EB' },
          { label:'Membres actifs',    value:membres.filter(m=>m.statut==='actif').length.toString(), color:'#F59E0B' },
          { label:'Total membres',     value:membres.length.toString(),           color:'#64748B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre…" style={{ width:'100%', maxWidth:340, border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏦</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun membre trouvé</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {filtered.map(m => (
            <div key={m.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{m.nom}{m.prenom ? ` ${m.prenom}` : ''}</div>
                  <div style={{ fontSize:12, color:'#94A3B8', marginTop:2 }}>{m.numero_compte}</div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:'#F1F5F9', color:'#64748B' }}>{TYPE_LABELS[m.type_compte]}</span>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:STATUT_COLORS[m.statut]||'#94A3B8', display:'inline-block' }} />
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:12, color:'#64748B' }}>Solde</div>
                  <div style={{ fontSize:18, fontWeight:700, color: m.solde > 0 ? '#16A34A' : '#94A3B8' }}>{fmtFCFA(m.solde)}</div>
                </div>
                <button onClick={() => { setForm(p => ({ ...p, membre_id:m.id })); setShowForm(true) }} style={{ padding:'6px 12px', border:'none', borderRadius:6, cursor:'pointer', background:'#EFF6FF', color:'#2563EB', fontSize:12, fontWeight:600 }}>Opération</button>
              </div>
              <div style={{ marginTop:8, fontSize:11, color:'#94A3B8' }}>Adhésion : {fmtDate(m.date_adhesion)}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Dépôt / Retrait</h2>
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
                Solde : <b style={{ color:'#16A34A' }}>{fmtFCFA(selectedMembre.solde)}</b>
              </div>
            )}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Opération</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['depot','Dépôt','#16A34A'],['retrait','Retrait','#DC2626']].map(([k,l,c]) => (
                  <button key={k} onClick={() => setForm(p => ({ ...p, type_operation:k }))} style={{ padding:'10px', border:`2px solid ${form.type_operation===k?c:'#E2E8F0'}`, borderRadius:8, cursor:'pointer', background:form.type_operation===k?c+'10':'#fff', color:form.type_operation===k?(c as string):'#64748B', fontWeight:600, fontSize:14 }}>{l as string}</button>
                ))}
              </div>
            </div>
            {[
              { label:'Montant (FCFA) *', key:'montant', placeholder:'0' },
              { label:'Description', key:'description', placeholder:'Motif…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleOperation} disabled={saving||!form.membre_id||!form.montant} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#16A34A', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.membre_id||!form.montant?0.6:1 }}>
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
