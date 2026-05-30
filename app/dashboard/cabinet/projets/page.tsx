'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'

interface Projet {
  id: string; nom: string; client_nom: string|null; type_mission: string|null
  budget_honoraires: number; montant_facture: number
  statut: string; date_debut: string|null; date_fin: string|null; chef_projet: string|null
}

const STATUTS: Record<string,string> = { devis:'Devis', en_cours:'En cours', termine:'Terminé', suspendu:'Suspendu', annule:'Annulé' }
const STATUT_COLORS: Record<string,string> = { devis:'#64748B', en_cours:'#2563EB', termine:'#16A34A', suspendu:'#F59E0B', annule:'#DC2626' }
const fmtFCFA = (v: number) => new Intl.NumberFormat('fr-CG', { style:'currency', currency:'XAF', maximumFractionDigits:0 }).format(v)
const fmtDate = (d: string|null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export default function CabinetProjetsPage() {
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]  = useState<Projet|null>(null)
  const [saving, setSaving]    = useState(false)
  const [form, setForm] = useState({ nom:'', client_nom:'', description:'', budget_honoraires:'', type_mission:'', date_debut:'', date_fin:'', chef_projet:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/cabinet/projets')
    const json = await res.json()
    setProjets(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ nom:'', client_nom:'', description:'', budget_honoraires:'', type_mission:'', date_debut:'', date_fin:'', chef_projet:'' }); setShowForm(true) }
  function openEdit(p: Projet) { setEditing(p); setForm({ nom:p.nom, client_nom:p.client_nom??'', description:'', budget_honoraires:p.budget_honoraires.toString(), type_mission:p.type_mission??'', date_debut:p.date_debut??'', date_fin:p.date_fin??'', chef_projet:p.chef_projet??'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom:form.nom, client_nom:form.client_nom||null, description:form.description||null, budget_honoraires:parseFloat(form.budget_honoraires)||0, type_mission:form.type_mission||null, date_debut:form.date_debut||null, date_fin:form.date_fin||null, chef_projet:form.chef_projet||null }
    if (editing) await fetch('/api/cabinet/projets', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    else await fetch('/api/cabinet/projets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce projet ?')) return
    await fetch(`/api/cabinet/projets?id=${id}`, { method:'DELETE' })
    load()
  }

  async function updateStatut(id: string, statut: string) {
    await fetch('/api/cabinet/projets', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, statut }) })
    load()
  }

  const totalBudget  = projets.reduce((s,p) => s + p.budget_honoraires, 0)
  const totalFacture = projets.reduce((s,p) => s + p.montant_facture, 0)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Projets & Missions</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Suivi de vos missions de conseil</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouveau projet
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Missions actives', value: projets.filter(p=>p.statut==='en_cours').length.toString(), color:'#2563EB' },
          { label:'Honoraires prévus', value:fmtFCFA(totalBudget), color:'#F59E0B' },
          { label:'Facturé', value:fmtFCFA(totalFacture), color:'#16A34A' },
          { label:'Total projets', value:projets.length.toString(), color:'#64748B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : projets.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📁</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun projet enregistré</div>
          <button onClick={openCreate} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Créer le premier projet</button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {projets.map(p => (
            <div key={p.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:18 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <span style={{ fontWeight:700, fontSize:15 }}>{p.nom}</span>
                    <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:STATUT_COLORS[p.statut]+'20', color:STATUT_COLORS[p.statut] }}>{STATUTS[p.statut]}</span>
                    {p.type_mission && <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, background:'#F1F5F9', color:'#64748B' }}>{p.type_mission}</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'3px 20px', fontSize:13, color:'#64748B' }}>
                    {p.client_nom && <span>Client : <b style={{color:'#0F172A'}}>{p.client_nom}</b></span>}
                    <span>Honoraires : <b style={{color:'#0F172A'}}>{fmtFCFA(p.budget_honoraires)}</b></span>
                    <span>Facturé : <b style={{color: p.montant_facture>=p.budget_honoraires&&p.budget_honoraires>0 ? '#16A34A':'#0F172A'}}>{fmtFCFA(p.montant_facture)}</b></span>
                    {p.date_debut && <span>Début : <b style={{color:'#0F172A'}}>{fmtDate(p.date_debut)}</b></span>}
                    {p.date_fin && <span>Fin : <b style={{color:'#0F172A'}}>{fmtDate(p.date_fin)}</b></span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <select value={p.statut} onChange={e => updateStatut(p.id, e.target.value)} style={{ border:'1px solid #E2E8F0', borderRadius:6, padding:'4px 8px', fontSize:12, background:'#fff' }}>
                    {Object.entries(STATUTS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={() => openEdit(p)} style={{ padding:'6px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B' }}><Pencil size={13} /></button>
                  <button onClick={() => handleDelete(p.id)} style={{ padding:'6px 8px', border:'none', borderRadius:6, cursor:'pointer', background:'#FEF2F2', color:'#DC2626' }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier le projet' : 'Nouveau projet'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            {[
              { label:'Nom du projet *', key:'nom', placeholder:'Ex: Audit financier 2026' },
              { label:'Client', key:'client_nom', placeholder:'Nom du client' },
              { label:'Type de mission', key:'type_mission', placeholder:'Audit, Conseil, Formation…' },
              { label:'Budget honoraires (FCFA)', key:'budget_honoraires', placeholder:'0' },
              { label:'Chef de projet', key:'chef_projet', placeholder:'Nom du responsable' },
              { label:'Date de début', key:'date_debut', type:'date' },
              { label:'Date de fin', key:'date_fin', type:'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type??'text'} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving||!form.nom.trim()} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.nom.trim()?.6:1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Créer le projet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
