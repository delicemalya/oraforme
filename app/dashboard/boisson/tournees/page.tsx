'use client'

import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil } from 'lucide-react'

interface Tournee {
  id: string; chauffeur_nom: string; vehicule: string|null; zone: string|null
  date_tournee: string; statut: string; montant_prevu: number
  montant_collecte: number; nombre_clients: number
}

const STATUTS: Record<string,string> = { planifiee:'Planifiée', en_cours:'En cours', terminee:'Terminée', annulee:'Annulée' }
const STATUT_COLORS: Record<string,string> = { planifiee:'#64748B', en_cours:'#2563EB', terminee:'#16A34A', annulee:'#DC2626' }
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

export default function BoissonTourneesPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()
  const [tournees, setTournees] = useState<Tournee[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Tournee|null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ chauffeur_nom:'', vehicule:'', zone:'', date_tournee:'', montant_prevu:'', nombre_clients:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/boisson/tournees')
    const json = await res.json()
    setTournees(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm({ chauffeur_nom:'', vehicule:'', zone:'', date_tournee:'', montant_prevu:'', nombre_clients:'', notes:'' }); setShowForm(true) }
  function openEdit(t: Tournee) { setEditing(t); setForm({ chauffeur_nom:t.chauffeur_nom, vehicule:t.vehicule??'', zone:t.zone??'', date_tournee:t.date_tournee, montant_prevu:t.montant_prevu.toString(), nombre_clients:t.nombre_clients.toString(), notes:'' }); setShowForm(true) }

  async function handleSave() {
    if (!form.chauffeur_nom.trim()) return
    setSaving(true)
    const payload = { chauffeur_nom:form.chauffeur_nom, vehicule:form.vehicule||null, zone:form.zone||null, date_tournee:form.date_tournee||null, montant_prevu:parseFloat(form.montant_prevu)||0, nombre_clients:parseInt(form.nombre_clients)||0 }
    if (editing) await fetch('/api/boisson/tournees', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:editing.id, ...payload }) })
    else await fetch('/api/boisson/tournees', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); load()
  }

  async function updateStatut(id: string, statut: string, collecte?: number) {
    const payload: Record<string,unknown> = { id, statut }
    if (collecte !== undefined) payload.montant_collecte = collecte
    await fetch('/api/boisson/tournees', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    load()
  }

  const totalPrevu    = tournees.reduce((s,t) => s + t.montant_prevu, 0)
  const totalCollecte = tournees.reduce((s,t) => s + t.montant_collecte, 0)

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Tournées & Livraisons</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Planification et suivi des tournées chauffeurs</p>
        </div>
        <button onClick={openCreate} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouvelle tournée
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Tournées du jour', value: tournees.filter(t=>t.date_tournee===new Date().toISOString().split('T')[0]).length.toString(), color:'#2563EB' },
          { label:'Montant prévu', value:fmtFCFA(totalPrevu), color:'#F59E0B' },
          { label:'Collecté', value:fmtFCFA(totalCollecte), color:'#16A34A' },
          { label:'Total tournées', value:tournees.length.toString(), color:'#64748B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      : tournees.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🚚</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucune tournée planifiée</div>
          <button onClick={openCreate} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Planifier la première tournée</button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {tournees.map(t => (
            <div key={t.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <span style={{ fontWeight:700 }}>{t.chauffeur_nom}</span>
                    {t.vehicule && <span style={{ fontSize:12, color:'#64748B', padding:'1px 8px', border:'1px solid #E2E8F0', borderRadius:20 }}>{t.vehicule}</span>}
                    <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:STATUT_COLORS[t.statut]+'20', color:STATUT_COLORS[t.statut] }}>{STATUTS[t.statut]}</span>
                  </div>
                  <div style={{ display:'flex', gap:20, fontSize:13, color:'#64748B', flexWrap:'wrap' }}>
                    <span>📅 {fmtDate(t.date_tournee)}</span>
                    {t.zone && <span>📍 {t.zone}</span>}
                    <span>👥 {t.nombre_clients} clients</span>
                    <span>Prévu : <b style={{color:'#0F172A'}}>{fmtFCFA(t.montant_prevu)}</b></span>
                    {t.statut === 'terminee' && <span>Collecté : <b style={{color:'#16A34A'}}>{fmtFCFA(t.montant_collecte)}</b></span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {t.statut === 'planifiee' && (
                    <button onClick={() => updateStatut(t.id, 'en_cours')} style={{ padding:'6px 12px', border:'none', borderRadius:6, cursor:'pointer', background:'#EFF6FF', color:'#2563EB', fontSize:12, fontWeight:600 }}>Démarrer</button>
                  )}
                  {t.statut === 'en_cours' && (
                    <button onClick={() => { const c = prompt('Montant collecté (FCFA) :'); if (c) updateStatut(t.id, 'terminee', parseFloat(c)||0) }} style={{ padding:'6px 12px', border:'none', borderRadius:6, cursor:'pointer', background:'#F0FDF4', color:'#16A34A', fontSize:12, fontWeight:600 }}>Terminer</button>
                  )}
                  <button onClick={() => openEdit(t)} style={{ padding:'6px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B' }}><Pencil size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{editing ? 'Modifier la tournée' : 'Planifier une tournée'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} /></button>
            </div>
            {[
              { label:'Chauffeur *', key:'chauffeur_nom', placeholder:'Nom du chauffeur' },
              { label:'Véhicule', key:'vehicule', placeholder:'Immatriculation ou modèle' },
              { label:'Zone de livraison', key:'zone', placeholder:'Ex: Bacongo, Makélékélé…' },
              { label:'Date de tournée', key:'date_tournee', type:'date' },
              { label:'Montant prévu (FCFA)', key:'montant_prevu', placeholder:'0' },
              { label:'Nombre de clients', key:'nombre_clients', placeholder:'0' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type??'text'} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} placeholder={f.placeholder} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving||!form.chauffeur_nom.trim()} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, opacity:saving||!form.chauffeur_nom.trim()?.6:1 }}>
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Planifier la tournée'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
