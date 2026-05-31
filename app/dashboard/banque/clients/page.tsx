'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Search, Pencil, CreditCard } from 'lucide-react'

interface Membre {
  id: string; numero_compte: string; nom: string; prenom: string
  telephone: string|null; type_compte: string; solde: number
  statut: string; date_ouverture: string; created_at: string
}

const TYPE_LABELS: Record<string,string> = { epargne:'Épargne', courant:'Courant', depot_terme:'Dépôt à terme' }
const STATUT_COLORS: Record<string,string> = { actif:'#16A34A', suspendu:'#F59E0B', cloture:'#DC2626' }
const fmtFCFA = (v: number) => new Intl.NumberFormat('fr-CG', { style:'currency', currency:'XAF', maximumFractionDigits:0 }).format(v)

export default function BanqueClientsPage() {
  const { t } = useLocale()
  const [membres, setMembres]   = useState<Membre[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ nom:'', prenom:'', telephone:'', adresse:'', type_compte:'epargne', date_naissance:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const q = search ? `?q=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/banque/membres${q}`)
    const json = await res.json()
    setMembres(json.data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.nom.trim() || !form.prenom.trim()) return
    setSaving(true)
    await fetch('/api/banque/membres', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
    setSaving(false); setShowForm(false)
    setForm({ nom:'', prenom:'', telephone:'', adresse:'', type_compte:'epargne', date_naissance:'' })
    load()
  }

  const totalSolde = membres.reduce((s, m) => s + m.solde, 0)
  const actifs     = membres.filter(m => m.statut === 'actif').length

  return (
    <div style={{ fontFamily:'Inter,sans-serif', color:'#0F172A' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Membres & Comptes</h1>
          <p style={{ color:'#64748B', margin:'4px 0 0', fontSize:14 }}>Gestion des membres de la microfinance</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display:'flex', alignItems:'center', gap:8, background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 }}>
          <Plus size={16} /> Nouveau membre
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Membres actifs', value:actifs.toString(), color:'#16A34A' },
          { label:'Total membres', value:membres.length.toString(), color:'#2563EB' },
          { label:'Épargne totale', value:fmtFCFA(totalSolde), color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid #E2E8F0', borderRadius:8, padding:'8px 12px', marginBottom:16 }}>
        <Search size={14} style={{ color:'#94A3B8', flexShrink:0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre…" style={{ border:'none', outline:'none', fontSize:14, flex:1, background:'transparent' }} />
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>
      ) : membres.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94A3B8', border:'2px dashed #E2E8F0', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Aucun membre enregistré</div>
          <button onClick={() => setShowForm(true)} style={{ background:'#2563EB', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>Ajouter le premier membre</button>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead>
              <tr style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
                {['N° Compte','Membre','Téléphone','Type','Solde','Statut',''].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {membres.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: i < membres.length-1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding:'12px 14px', fontFamily:'monospace', fontSize:12, color:'#64748B' }}>{m.numero_compte}</td>
                  <td style={{ padding:'12px 14px', fontWeight:600 }}>{m.prenom} {m.nom}</td>
                  <td style={{ padding:'12px 14px', color:'#64748B' }}>{m.telephone ?? '—'}</td>
                  <td style={{ padding:'12px 14px' }}><span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'#EFF6FF', color:'#2563EB' }}>{TYPE_LABELS[m.type_compte]}</span></td>
                  <td style={{ padding:'12px 14px', fontWeight:700, color: m.solde>0 ? '#16A34A' : '#0F172A' }}>{fmtFCFA(m.solde)}</td>
                  <td style={{ padding:'12px 14px' }}><span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: STATUT_COLORS[m.statut]+'20', color: STATUT_COLORS[m.statut] }}>{m.statut}</span></td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button title="Opérations" style={{ padding:'4px 8px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', background:'#fff', color:'#64748B', fontSize:11 }} onClick={() => window.location.href='/dashboard/banque/operations'}>
                        <CreditCard size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Nouveau membre</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748B' }}><X size={20} /></button>
            </div>
            {[
              { label:'Nom *', key:'nom', type:'text' },
              { label:'Prénom *', key:'prenom', type:'text' },
              { label:'Téléphone', key:'telephone', type:'tel' },
              { label:'Adresse', key:'adresse', type:'text' },
              { label:'Date de naissance', key:'date_naissance', type:'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>Type de compte</label>
              <select value={form.type_compte} onChange={e => setForm(p => ({ ...p, type_compte:e.target.value }))} style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', background:'#fff' }}>
                <option value="epargne">Épargne</option>
                <option value="courant">Courant</option>
                <option value="depot_terme">Dépôt à terme</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer' }}>{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving || !form.nom.trim() || !form.prenom.trim()} style={{ flex:2, padding:10, border:'none', borderRadius:8, background:'#2563EB', color:'#fff', cursor:'pointer', fontWeight:600, opacity: saving||!form.nom.trim()||!form.prenom.trim() ? .6 : 1 }}>
                {saving ? 'Enregistrement…' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
