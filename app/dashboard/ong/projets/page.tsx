'use client'

import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil } from 'lucide-react'

interface Programme {
  id: string; nom: string; bailleur: string|null; budget_total: number
  montant_depense: number; statut: string; date_debut: string|null; date_fin: string|null; zone: string|null
}

const STATUTS: Record<string,string> = { proposition:'Proposition', en_cours:'En cours', cloture:'Clôturé', suspendu:'Suspendu' }
const STATUT_COLORS: Record<string,string> = { proposition:'#64748B', en_cours:'#2563EB', cloture:'#16A34A', suspendu:'#F59E0B' }
const fmtDate = (d: string|null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export default function OngProjetsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Programme|null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ nom:'', bailleur:'', budget_total:'', date_debut:'', date_fin:'', zone:'', objectif:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/ong/programmes')
    const json = await res.json()
    setProgrammes(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ nom:'', bailleur:'', budget_total:'', date_debut:'', date_fin:'', zone:'', objectif:'' }); setShowForm(true) }
  function openEdit(p: Programme) { setEditing(p); setForm({ nom:p.nom, bailleur:p.bailleur??'', budget_total:p.budget_total.toString(), date_debut:p.date_debut??'', date_fin:p.date_fin??'', zone:p.zone??'', objectif:'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom:form.nom, bailleur:form.bailleur||null, budget_total:parseFloat(form.budget_total)||0, date_debut:form.date_debut||null, date_fin:form.date_fin||null, zone:form.zone||null, objectif:form.objectif||null }
    if (editing) await fetch('/api/ong/programmes', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    else await fetch('/api/ong/programmes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  const totalBudget = programmes.reduce((s,p) => s + p.budget_total, 0)
  const totalDepense = programmes.reduce((s,p) => s + p.montant_depense, 0)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Projets & Programmes</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Gestion des programmes par bailleur</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouveau programme
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Programmes actifs', value:programmes.filter(p=>p.statut==='en_cours').length.toString(), color:'#2563EB' },
          { label:'Budget total', value:fmtFCFA(totalBudget), color:'#F59E0B' },
          { label:'Dépensé', value:fmtFCFA(totalDepense), color:'#DC2626' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : programmes.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🤝</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun programme enregistré</div>
          <button onClick={openCreate} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Créer le premier programme</button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {programmes.map(p => {
            const pct = p.budget_total > 0 ? Math.round((p.montant_depense/p.budget_total)*100) : 0
            return (
              <div key={p.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:15 }}>{p.nom}</span>
                      <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:STATUT_COLORS[p.statut]+'20', color:STATUT_COLORS[p.statut] }}>{STATUTS[p.statut]}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'3px 20px', fontSize:13, color:'#64748B', marginBottom:10 }}>
                      {p.bailleur && <span>Bailleur : <b style={{color:'#0F172A'}}>{p.bailleur}</b></span>}
                      <span>Budget : <b style={{color:'#0F172A'}}>{fmtFCFA(p.budget_total)}</b></span>
                      <span>Dépensé : <b style={{color:'#0F172A'}}>{fmtFCFA(p.montant_depense)}</b></span>
                      {p.zone && <span>Zone : <b style={{color:'#0F172A'}}>{p.zone}</b></span>}
                      {p.date_debut && <span>Début : <b style={{color:'#0F172A'}}>{fmtDate(p.date_debut)}</b></span>}
                      {p.date_fin && <span>Fin : <b style={{color:'#0F172A'}}>{fmtDate(p.date_fin)}</b></span>}
                    </div>
                    <div style={{ height:6, background:'#F1F5F9', borderRadius:3, overflow:'hidden', maxWidth:400 }}>
                      <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background: pct>=100?'#DC2626':'#2563EB', borderRadius:3 }} />
                    </div>
                    <span style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>{pct}% du budget utilisé</span>
                  </div>
                  <button onClick={() => openEdit(p)} style={{ padding:'6px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B', flexShrink:0 }}><Pencil size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier le programme' : 'Nouveau programme'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            {[
              { label:'Nom du programme *', key:'nom', placeholder:'Ex: Santé communautaire 2026' },
              { label:'Bailleur de fonds', key:'bailleur', placeholder:'Ex: UNICEF, Banque Mondiale…' },
              { label:'Budget total (FCFA)', key:'budget_total', placeholder:'0' },
              { label:'Zone d\'intervention', key:'zone', placeholder:'Région ou zone géographique' },
              { label:'Date de début', key:'date_debut', type:'date' },
              { label:'Date de fin', key:'date_fin', type:'date' },
              { label:'Objectif principal', key:'objectif', placeholder:'Description de l\'objectif' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type??'text'} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving||!form.nom.trim()} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.nom.trim()?.6:1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Créer le programme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
