'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Building2, Phone, Mail, Globe, MapPin,
  FileText, CheckSquare, DollarSign, MessageSquare, Settings,
  Plus, X, Upload, Send, Loader2, CheckCircle, AlertTriangle,
  ChevronDown, ChevronUp, Edit3, Trash2, Clock,
  BarChart3, RefreshCw, Download, Eye,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id: string; cabinet_tenant_id: string; nom_entreprise: string
  forme_juridique: string | null; secteur_activite: string | null
  pays: string | null; ville: string | null; adresse: string | null
  telephone: string | null; email: string | null; site_web: string | null
  niu: string | null; rccm: string | null; sciet: string | null; scien: string | null
  date_creation_entreprise: string | null
  contact_nom: string | null; contact_prenom: string | null
  contact_telephone: string | null; contact_email: string | null; contact_poste: string | null
  date_debut_mission: string | null; date_fin_mission: string | null
  types_mission: string[]; honoraires_mensuel: number; devise_honoraires: string
  periodicite: string; frais_oraforme: number; acces_actif: boolean
  statut: string; notes: string | null
}

interface Document {
  id: string; nom: string; type_document: string; description: string | null
  fichier_url: string | null; mois: number | null; annee: number | null
  statut: string; commentaire_cabinet: string | null; created_at: string
}

interface Tache {
  id: string; titre: string; description: string | null; type_tache: string | null
  priorite: string; statut: string; date_echeance: string | null; created_at: string
  temps_estime_heures: number | null
}

interface Facture {
  id: string; numero: string; date_facture: string; montant_ht: number
  tva: number; montant_ttc: number; statut: string; periode_debut: string | null; periode_fin: string | null
}

interface Message {
  id: string; expediteur: string; contenu: string; sujet: string | null
  lu: boolean; created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) { if (!s) return '—'; return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }

const TYPES_MISSION_OPT = [
  { value: 'comptabilite', label: 'Comptabilité SYSCOHADA' },
  { value: 'paie_rh',     label: 'Paie & RH' },
  { value: 'tva',         label: 'Déclarations TVA' },
  { value: 'cnss',        label: 'Déclarations CNSS' },
  { value: 'patente',     label: 'Déclaration Patente' },
  { value: 'is',          label: 'Déclaration IS' },
  { value: 'audit',       label: 'Audit' },
  { value: 'conseil',     label: 'Conseil fiscal' },
  { value: 'formation',   label: 'Formation' },
]

const DOC_TYPES = [
  { value: 'bilan', label: 'Bilan annuel' }, { value: 'compte_resultat', label: 'Compte de résultat' },
  { value: 'declaration_tva', label: 'Déclaration TVA' }, { value: 'declaration_cnss', label: 'Déclaration CNSS' },
  { value: 'declaration_patente', label: 'Déclaration Patente' }, { value: 'declaration_is', label: 'Déclaration IS' },
  { value: 'rapport_audit', label: 'Rapport d\'audit' }, { value: 'contrat', label: 'Contrat' },
  { value: 'lettre_mission', label: 'Lettre de mission' }, { value: 'facture_honoraires', label: 'Facture honoraires' },
  { value: 'releve_bancaire', label: 'Relevé bancaire' }, { value: 'autre', label: 'Autre' },
]

function statutDocColor(s: string) {
  const m: Record<string, { bg: string; text: string }> = {
    brouillon: { bg: '#F1F5F9', text: '#64748B' }, en_cours: { bg: '#EFF6FF', text: '#2563EB' },
    finalise: { bg: '#F0FDF4', text: '#16A34A' }, envoye_client: { bg: '#FFFBEB', text: '#F59E0B' },
    valide_client: { bg: '#F0FDF4', text: '#15803D' },
  }
  return m[s] ?? m.brouillon
}

function prioriteColor(p: string) {
  const m: Record<string, string> = { basse: '#64748B', normale: '#2563EB', haute: '#F59E0B', urgente: '#DC2626' }
  return m[p] ?? '#64748B'
}

function kanbanStatuts() {
  return ['a_faire','en_cours','en_attente','termine'] as const
}
const KANBAN_LABELS: Record<string, string> = {
  a_faire: 'À faire', en_cours: 'En cours', en_attente: 'En attente', termine: 'Terminé'
}
const KANBAN_COLORS: Record<string, string> = {
  a_faire: '#64748B', en_cours: '#2563EB', en_attente: '#F59E0B', termine: '#16A34A'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const params = useParams()
  const clientId = params.id as string

  const [tab, setTab] = useState<'general'|'documents'|'taches'|'honoraires'|'messages'|'parametres'>('general')
  const [client, setClient] = useState<Client | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
  const [taches, setTaches] = useState<Tache[]>([])
  const [factures, setFactures] = useState<Facture[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Accordéons
  const [accOpen, setAccOpen] = useState<Record<string, boolean>>({ general: true, contact: false, mission: false })

  // Modals
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [showNewTache, setShowNewTache] = useState(false)
  const [showNewFacture, setShowNewFacture] = useState(false)

  // Forms
  const [docForm, setDocForm] = useState({ nom: '', type_document: 'bilan', description: '', mois: '', annee: String(new Date().getFullYear()), commentaire_cabinet: '' })
  const [tacheForm, setTacheForm] = useState({ titre: '', description: '', type_tache: '', priorite: 'normale', date_echeance: '', temps_estime_heures: '' })
  const [msgForm, setMsgForm] = useState({ sujet: '', contenu: '' })
  const [factureForm, setFactureForm] = useState({ periode_debut: '', periode_fin: '', notes: '', lignes: [{ description: 'Tenue comptabilité', montant: 0 }] })

  const tid = tenant?.tenantId

  const loadAll = useCallback(async () => {
    if (!tid || !clientId) return
    setLoading(true)
    const [{ data: c }, { data: d }, { data: t }, { data: f }, { data: m }] = await Promise.all([
      supabase.from('cabinet_clients').select('*').eq('id', clientId).eq('cabinet_tenant_id', tid).maybeSingle(),
      supabase.from('cabinet_documents').select('*').eq('client_id', clientId).eq('cabinet_tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('cabinet_taches').select('*').eq('client_id', clientId).eq('cabinet_tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('cabinet_factures_honoraires').select('*').eq('client_id', clientId).eq('cabinet_tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('cabinet_messages').select('*').eq('client_id', clientId).eq('cabinet_tenant_id', tid).order('created_at', { ascending: true }),
    ])
    setClient(c as Client)
    setDocs((d ?? []) as Document[])
    setTaches((t ?? []) as Tache[])
    setFactures((f ?? []) as Facture[])
    setMessages((m ?? []) as Message[])
    setLoading(false)
  }, [tid, clientId])

  useEffect(() => { loadAll() }, [loadAll])

  function ok(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000) }

  async function saveDoc(e: React.FormEvent) {
    e.preventDefault(); if (!tid || !clientId) return; setSaving(true)
    await supabase.from('cabinet_documents').insert({
      cabinet_tenant_id: tid, client_id: clientId,
      nom: docForm.nom, type_document: docForm.type_document,
      description: docForm.description || null,
      mois: docForm.mois ? Number(docForm.mois) : null,
      annee: docForm.annee ? Number(docForm.annee) : null,
      commentaire_cabinet: docForm.commentaire_cabinet || null,
      statut: 'brouillon',
    })
    setSaving(false); setShowNewDoc(false)
    setDocForm({ nom: '', type_document: 'bilan', description: '', mois: '', annee: String(new Date().getFullYear()), commentaire_cabinet: '' })
    loadAll(); ok('Document ajouté')
  }

  async function saveTache(e: React.FormEvent) {
    e.preventDefault(); if (!tid || !clientId) return; setSaving(true)
    await supabase.from('cabinet_taches').insert({
      cabinet_tenant_id: tid, client_id: clientId,
      titre: tacheForm.titre, description: tacheForm.description || null,
      type_tache: tacheForm.type_tache || null, priorite: tacheForm.priorite,
      date_echeance: tacheForm.date_echeance || null,
      temps_estime_heures: tacheForm.temps_estime_heures ? Number(tacheForm.temps_estime_heures) : null,
      statut: 'a_faire',
    })
    setSaving(false); setShowNewTache(false)
    setTacheForm({ titre: '', description: '', type_tache: '', priorite: 'normale', date_echeance: '', temps_estime_heures: '' })
    loadAll(); ok('Tâche créée')
  }

  async function moveTask(id: string, statut: string) {
    if (!tid) return
    await supabase.from('cabinet_taches').update({ statut, ...(statut === 'termine' ? { date_completion: new Date().toISOString().split('T')[0] } : {}) }).eq('id', id).eq('cabinet_tenant_id', tid)
    loadAll()
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault(); if (!tid || !clientId || !msgForm.contenu.trim()) return; setSaving(true)
    await supabase.from('cabinet_messages').insert({
      cabinet_tenant_id: tid, client_id: clientId,
      expediteur: 'cabinet', sujet: msgForm.sujet || null, contenu: msgForm.contenu,
    })
    setSaving(false); setMsgForm({ sujet: '', contenu: '' })
    loadAll(); ok('Message envoyé')
  }

  async function saveFacture(e: React.FormEvent) {
    e.preventDefault(); if (!tid || !clientId || !client) return; setSaving(true)
    const ht = factureForm.lignes.reduce((s, l) => s + Number(l.montant), 0) + client.frais_oraforme
    const tva = Math.round(ht * 0.18)
    const ca  = Math.round(tva * 0.05)
    const ttc = ht + tva + ca
    const now = new Date()
    const num = `HON-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`
    await supabase.from('cabinet_factures_honoraires').insert({
      cabinet_tenant_id: tid, client_id: clientId,
      numero: num, date_facture: now.toISOString().split('T')[0],
      date_echeance: new Date(now.getFullYear(), now.getMonth()+1, 15).toISOString().split('T')[0],
      periode_debut: factureForm.periode_debut || null, periode_fin: factureForm.periode_fin || null,
      lignes: factureForm.lignes, montant_ht: ht, tva, ca_additionnel: ca, montant_ttc: ttc,
      statut: 'brouillon', frais_oraforme_inclus: true, frais_oraforme_montant: client.frais_oraforme,
      notes: factureForm.notes || null,
    })
    setSaving(false); setShowNewFacture(false)
    loadAll(); ok('Facture créée')
  }

  async function updateDocStatut(id: string, statut: string) {
    if (!tid) return
    await supabase.from('cabinet_documents').update({ statut }).eq('id', id).eq('cabinet_tenant_id', tid)
    loadAll()
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen gap-2 text-[#94A3B8]">
      <Loader2 size={20} className="animate-spin" /> Chargement...
    </div>
  )
  if (!client) return (
    <div className="p-8 text-center">
      <p className="text-[#DC2626] font-bold">Client introuvable</p>
      <Link href="/dashboard/cabinet/clients" className="mt-3 text-amber-600 hover:underline text-[13px]">← Retour</Link>
    </div>
  )

  const totalHonoraires = factures.reduce((s, f) => s + f.montant_ttc, 0)
  const totalEncaisse   = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + f.montant_ttc, 0)
  const totalDu         = totalHonoraires - totalEncaisse
  const nbMsgsNonLus    = messages.filter(m => m.expediteur === 'client' && !m.lu).length

  const TABS = [
    { id: 'general'    as const, label: 'Vue générale', icon: BarChart3 },
    { id: 'documents'  as const, label: `Documents (${docs.length})`, icon: FileText },
    { id: 'taches'     as const, label: `Tâches (${taches.length})`, icon: CheckSquare },
    { id: 'honoraires' as const, label: 'Honoraires', icon: DollarSign },
    { id: 'messages'   as const, label: `Messages${nbMsgsNonLus > 0 ? ` (${nbMsgsNonLus})` : ''}`, icon: MessageSquare },
    { id: 'parametres' as const, label: 'Paramètres', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/cabinet/clients" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
                <ArrowLeft size={14} /> Clients
              </Link>
              <span className="text-[#E2E8F0]">/</span>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-[13px] flex items-center justify-center">
                  {client.nom_entreprise.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-[16px] font-black text-[#0F172A]">{client.nom_entreprise}</h1>
                  <p className="text-[11px] text-[#64748B]">
                    {client.secteur_activite ?? ''}{client.ville ? ` · ${client.ville}` : ''}{client.niu ? ` · NIU: ${client.niu}` : ''}
                  </p>
                </div>
              </div>
            </div>
            <button onClick={loadAll} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Tabs — scroll horizontal sur mobile */}
          <div className="flex gap-0.5 overflow-x-auto pb-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-amber-100 text-amber-700' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
                  <Icon size={12} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Success message */}
        {successMsg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-[13px] font-semibold text-green-700 mb-4">
            <CheckCircle size={15} /> {successMsg}
          </div>
        )}

        {/* ── Onglet : Vue générale ── */}
        {tab === 'general' && (
          <div className="space-y-4">
            {/* KPIs mini */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Docs finalisés', value: docs.filter(d => d.statut === 'finalise' || d.statut === 'envoye_client').length, color: '#16A34A', icon: FileText },
                { label: 'Tâches en cours', value: taches.filter(t => t.statut === 'en_cours').length, color: '#2563EB', icon: CheckSquare },
                { label: 'Honoraires dûs', value: fmt(totalDu), color: totalDu > 0 ? '#DC2626' : '#16A34A', icon: DollarSign },
                { label: 'Msgs non lus', value: nbMsgsNonLus, color: nbMsgsNonLus > 0 ? '#F59E0B' : '#64748B', icon: MessageSquare },
              ].map(k => {
                const Icon = k.icon
                return (
                  <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
                        <Icon size={12} style={{ color: k.color }} />
                      </div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</span>
                    </div>
                    <p className="text-[18px] font-black" style={{ color: k.color }}>{k.value}</p>
                  </div>
                )
              })}
            </div>

            {/* Accordéons */}
            {[
              {
                key: 'general', label: 'Informations générales',
                content: (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    {[
                      ['Nom entreprise', client.nom_entreprise], ['Forme juridique', client.forme_juridique],
                      ['Secteur', client.secteur_activite], ['Pays', client.pays],
                      ['Ville', client.ville], ['Adresse', client.adresse],
                      ['Téléphone', client.telephone], ['Email', client.email],
                      ['Site web', client.site_web], ['NIU', client.niu],
                      ['RCCM', client.rccm], ['SCIET', client.sciet], ['SCIEN', client.scien],
                    ].map(([k, v]) => v ? (
                      <div key={k as string}><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-0.5">{k}</p><p className="text-[#0F172A]">{v}</p></div>
                    ) : null)}
                  </div>
                )
              },
              {
                key: 'contact', label: 'Contact principal',
                content: (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                    {[
                      ['Nom', `${client.contact_prenom ?? ''} ${client.contact_nom ?? ''}`.trim() || '—'],
                      ['Poste', client.contact_poste], ['Téléphone', client.contact_telephone], ['Email', client.contact_email],
                    ].map(([k, v]) => (
                      <div key={k as string}><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-0.5">{k}</p><p className="text-[#0F172A]">{v ?? '—'}</p></div>
                    ))}
                  </div>
                )
              },
              {
                key: 'mission', label: 'Mission & Contrat',
                content: (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                      <div><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-0.5">Début mission</p><p>{fmtDate(client.date_debut_mission)}</p></div>
                      <div><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-0.5">Honoraires</p><p className="font-bold text-[#0F172A]">{fmt(client.honoraires_mensuel)}<span className="text-[11px] font-normal text-[#64748B]">/{client.periodicite}</span></p></div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Missions confiées</p>
                      <div className="flex flex-wrap gap-2">
                        {TYPES_MISSION_OPT.map(m => (
                          <span key={m.value} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${client.types_mission.includes(m.value) ? 'bg-amber-100 text-amber-700' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                            {client.types_mission.includes(m.value) ? '✓ ' : ''}{m.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-[12px]">
                      <p className="font-bold text-amber-800">Frais Oraforme</p>
                      <p className="text-amber-700">{fmt(client.frais_oraforme)} / mois — Facturation automatique le 1er de chaque mois</p>
                    </div>
                  </div>
                )
              },
            ].map(acc => (
              <div key={acc.key} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button onClick={() => setAccOpen(p => ({ ...p, [acc.key]: !p[acc.key] }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFC]">
                  <p className="font-bold text-[13px] text-[#0F172A]">{acc.label}</p>
                  {accOpen[acc.key] ? <ChevronUp size={15} className="text-[#64748B]" /> : <ChevronDown size={15} className="text-[#64748B]" />}
                </button>
                {accOpen[acc.key] && <div className="px-4 pb-4 border-t border-[#F1F5F9]">{acc.content}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── Onglet : Documents ── */}
        {tab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">{docs.length} documents</p>
              <button onClick={() => setShowNewDoc(true)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
                <Plus size={13} /> Nouveau document
              </button>
            </div>

            {docs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center">
                <FileText size={36} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="font-bold text-[#0F172A]">Aucun document partagé</p>
                <button onClick={() => setShowNewDoc(true)} className="mt-3 text-amber-600 hover:underline text-[13px] font-semibold">+ Ajouter un document</button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {['Nom','Type','Période','Statut','Date','Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {docs.map(d => {
                        const { bg, text } = statutDocColor(d.statut)
                        return (
                          <tr key={d.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[13px] text-[#0F172A]">{d.nom}</p>
                              {d.description && <p className="text-[11px] text-[#64748B] line-clamp-1">{d.description}</p>}
                            </td>
                            <td className="px-4 py-3"><p className="text-[12px] text-[#475569]">{DOC_TYPES.find(t => t.value === d.type_document)?.label ?? d.type_document}</p></td>
                            <td className="px-4 py-3"><p className="text-[12px] text-[#64748B]">{d.mois ? `${d.mois}/${d.annee}` : d.annee ?? '—'}</p></td>
                            <td className="px-4 py-3">
                              <select value={d.statut} onChange={e => updateDocStatut(d.id, e.target.value)}
                                className="text-[11px] px-1.5 py-1 rounded-lg font-bold border-0 focus:ring-1 focus:ring-amber-300 cursor-pointer"
                                style={{ background: bg, color: text }}>
                                {['brouillon','en_cours','finalise','envoye_client','valide_client'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3"><p className="text-[11px] text-[#94A3B8]">{fmtDate(d.created_at)}</p></td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {d.fichier_url && (
                                  <a href={d.fichier_url} target="_blank" rel="noreferrer" className="p-1.5 border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F8FAFC]"><Download size={12} /></a>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Onglet : Tâches (Kanban) ── */}
        {tab === 'taches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">{taches.filter(t => t.statut !== 'annule').length} tâches actives</p>
              <button onClick={() => setShowNewTache(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:bg-[#1E293B]">
                <Plus size={13} /> Nouvelle tâche
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto">
              {kanbanStatuts().map(statut => {
                const items = taches.filter(t => t.statut === statut)
                const color = KANBAN_COLORS[statut]
                return (
                  <div key={statut} className="min-h-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <p className="text-[12px] font-bold" style={{ color }}>{KANBAN_LABELS[statut]}</p>
                      </div>
                      <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: color }}>{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map(t => {
                        const pc = prioriteColor(t.priorite)
                        const j = t.date_echeance ? Math.ceil((new Date(t.date_echeance).getTime() - Date.now()) / 86400000) : null
                        return (
                          <div key={t.id} className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm">
                            <p className="text-[12px] font-bold text-[#0F172A] leading-tight mb-1">{t.titre}</p>
                            {t.description && <p className="text-[10px] text-[#64748B] mb-1.5 line-clamp-2">{t.description}</p>}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: pc + '18', color: pc }}>{t.priorite}</span>
                              {j !== null && (
                                <span className="text-[10px] font-bold" style={{ color: j < 0 ? '#DC2626' : j <= 3 ? '#F59E0B' : '#94A3B8' }}>
                                  {j < 0 ? `J+${Math.abs(j)} retard` : j === 0 ? "Auj." : `J-${j}`}
                                </span>
                              )}
                            </div>
                            {/* Boutons déplacement */}
                            <div className="flex gap-1">
                              {statut !== 'en_cours'  && <button onClick={() => moveTask(t.id, 'en_cours')}  className="flex-1 py-1 text-[9px] font-bold rounded bg-blue-50 text-blue-700 hover:bg-blue-100">En cours</button>}
                              {statut !== 'termine'   && <button onClick={() => moveTask(t.id, 'termine')}   className="flex-1 py-1 text-[9px] font-bold rounded bg-green-50 text-green-700 hover:bg-green-100">✓ Fait</button>}
                              {statut === 'termine'   && <button onClick={() => moveTask(t.id, 'a_faire')}   className="flex-1 py-1 text-[9px] font-bold rounded bg-gray-50 text-gray-600 hover:bg-gray-100">Réouvrir</button>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Onglet : Honoraires ── */}
        {tab === 'honoraires' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total facturé', value: fmt(totalHonoraires), color: '#2563EB' },
                { label: 'Encaissé', value: fmt(totalEncaisse), color: '#16A34A' },
                { label: 'Dû', value: fmt(totalDu), color: totalDu > 0 ? '#DC2626' : '#16A34A' },
                { label: 'Frais Oraforme/mois', value: fmt(client.frais_oraforme), color: '#F59E0B' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
                  <p className="text-[18px] font-black" style={{ color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">{factures.length} factures honoraires</p>
              <button onClick={() => setShowNewFacture(true)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
                <Plus size={13} /> Émettre facture
              </button>
            </div>

            {factures.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center">
                <DollarSign size={36} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="font-bold text-[#0F172A]">Aucune facture d'honoraires</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {['N°','Période','HT','TVA (18%)','TTC','Statut'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {factures.map(f => {
                        const sc = { brouillon:'#64748B', envoyee:'#2563EB', payee:'#16A34A', retard:'#DC2626', annulee:'#94A3B8' }[f.statut] ?? '#64748B'
                        return (
                          <tr key={f.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3 font-bold text-[13px] text-[#0F172A]">{f.numero}</td>
                            <td className="px-4 py-3 text-[12px] text-[#64748B]">{f.periode_debut ? `${fmtDate(f.periode_debut)} → ${fmtDate(f.periode_fin)}` : fmtDate(f.date_facture)}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums">{fmt(f.montant_ht)}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums">{fmt(f.tva)}</td>
                            <td className="px-4 py-3 font-black text-[14px] tabular-nums">{fmt(f.montant_ttc)}</td>
                            <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc + '18', color: sc }}>{f.statut}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Onglet : Messages ── */}
        {tab === 'messages' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden" style={{ minHeight: 400 }}>
              {/* Historique messages */}
              <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 500 }}>
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare size={32} className="text-[#CBD5E1] mx-auto mb-3" />
                    <p className="text-[#64748B] font-semibold">Aucun message</p>
                  </div>
                ) : messages.map(m => {
                  const isCabinet = m.expediteur === 'cabinet'
                  return (
                    <div key={m.id} className={`flex ${isCabinet ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isCabinet ? 'bg-amber-500 text-white rounded-br-none' : 'bg-[#F1F5F9] text-[#0F172A] rounded-bl-none'}`}>
                        {m.sujet && <p className={`text-[10px] font-bold mb-1 ${isCabinet ? 'text-amber-100' : 'text-[#64748B]'}`}>{m.sujet}</p>}
                        <p className="text-[13px] whitespace-pre-wrap">{m.contenu}</p>
                        <p className={`text-[10px] mt-1 ${isCabinet ? 'text-amber-100' : 'text-[#94A3B8]'}`}>{fmtDate(m.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Zone saisie */}
              <form onSubmit={sendMessage} className="border-t border-[#E2E8F0] p-4 space-y-2">
                <input value={msgForm.sujet} onChange={e => setMsgForm(p => ({...p, sujet: e.target.value}))}
                  placeholder="Sujet (optionnel)"
                  className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                <div className="flex gap-2">
                  <textarea value={msgForm.contenu} onChange={e => setMsgForm(p => ({...p, contenu: e.target.value}))} required
                    placeholder="Votre message..." rows={3}
                    className="flex-1 px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
                  <button type="submit" disabled={saving || !msgForm.contenu.trim()}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5 text-[13px] font-bold self-end">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Envoyer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Onglet : Paramètres ── */}
        {tab === 'parametres' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
              <h3 className="font-bold text-[14px] text-[#0F172A] mb-3 flex items-center gap-2"><Settings size={15} /> Accès client</h3>
              <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9]">
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]">Accès au portail client</p>
                  <p className="text-[11px] text-[#64748B]">{client.email ?? 'Email non renseigné'}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[12px] font-bold ${client.acces_actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {client.acces_actif ? 'Actif' : 'Désactivé'}
                </div>
              </div>
              <p className="text-[12px] text-[#94A3B8] mt-3">Le client peut accéder à son espace via l'email renseigné et consulter les documents partagés et les messages.</p>
            </div>

            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <h3 className="font-bold text-[13px] text-amber-800 mb-2 flex items-center gap-2"><AlertTriangle size={13} /> Frais Oraforme</h3>
              <p className="text-[12px] text-amber-700">Ce client génère <strong>{fmt(client.frais_oraforme)}/mois</strong> de revenus pour Oraforme. Ces frais sont automatiquement inclus dans vos factures d'honoraires.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal : Nouveau document ── */}
      {showNewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouveau document</h2>
              <button onClick={() => setShowNewDoc(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={saveDoc} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Nom *</label>
                <input required value={docForm.nom} onChange={e => setDocForm(p=>({...p,nom:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="Bilan 2025..." />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Type</label>
                <select value={docForm.type_document} onChange={e => setDocForm(p=>({...p,type_document:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Mois</label>
                  <input type="number" min="1" max="12" value={docForm.mois} onChange={e => setDocForm(p=>({...p,mois:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="6" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Année</label>
                  <input type="number" value={docForm.annee} onChange={e => setDocForm(p=>({...p,annee:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Description</label>
                <textarea value={docForm.description} onChange={e => setDocForm(p=>({...p,description:e.target.value}))} rows={2}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Commentaire cabinet</label>
                <textarea value={docForm.commentaire_cabinet} onChange={e => setDocForm(p=>({...p,commentaire_cabinet:e.target.value}))} rows={2}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                  placeholder="Notes internes pour ce document..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewDoc(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">{saving ? 'Enregistrement...' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal : Nouvelle tâche ── */}
      {showNewTache && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouvelle tâche</h2>
              <button onClick={() => setShowNewTache(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={saveTache} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Titre *</label>
                <input required value={tacheForm.titre} onChange={e => setTacheForm(p=>({...p,titre:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="Déclaration TVA juin 2026..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Priorité</label>
                  <select value={tacheForm.priorite} onChange={e => setTacheForm(p=>({...p,priorite:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                    {['basse','normale','haute','urgente'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Échéance</label>
                  <input type="date" value={tacheForm.date_echeance} onChange={e => setTacheForm(p=>({...p,date_echeance:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Type</label>
                <select value={tacheForm.type_tache} onChange={e => setTacheForm(p=>({...p,type_tache:e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  <option value="">— Sélectionner —</option>
                  {[['declaration_tva','Déclaration TVA'],['declaration_cnss','Déclaration CNSS'],['declaration_patente','Déclaration Patente'],['bilan_annuel','Bilan annuel'],['audit','Audit'],['conseil','Conseil'],['formation','Formation'],['autre','Autre']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Description</label>
                <textarea value={tacheForm.description} onChange={e => setTacheForm(p=>({...p,description:e.target.value}))} rows={2}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewTache(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:bg-[#1E293B] disabled:opacity-50">{saving ? 'Enregistrement...' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal : Émettre facture honoraires ── */}
      {showNewFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Facture d'honoraires</h2>
              <button onClick={() => setShowNewFacture(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={saveFacture} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Période du</label>
                  <input type="date" value={factureForm.periode_debut} onChange={e => setFactureForm(p=>({...p,periode_debut:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Au</label>
                  <input type="date" value={factureForm.periode_fin} onChange={e => setFactureForm(p=>({...p,periode_fin:e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>

              {/* Lignes */}
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Lignes de services</label>
                <div className="mt-1 space-y-2">
                  {factureForm.lignes.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={l.description} onChange={e => setFactureForm(p => ({...p, lignes: p.lignes.map((x,j) => j===i ? {...x, description: e.target.value} : x)}))}
                        placeholder="Tenue comptabilité..."
                        className="flex-1 px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                      <input type="number" value={l.montant || ''} onChange={e => setFactureForm(p => ({...p, lignes: p.lignes.map((x,j) => j===i ? {...x, montant: Number(e.target.value)} : x)}))}
                        placeholder="Montant"
                        className="w-28 px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                      {factureForm.lignes.length > 1 && (
                        <button type="button" onClick={() => setFactureForm(p => ({...p, lignes: p.lignes.filter((_,j) => j!==i)}))} className="p-2 text-red-500 hover:bg-red-50 rounded-xl"><X size={13} /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setFactureForm(p => ({...p, lignes: [...p.lignes, { description: '', montant: 0 }]}))}
                    className="text-[12px] text-amber-600 hover:underline">+ Ajouter une ligne</button>
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-[12px]">
                {(() => {
                  const ht  = factureForm.lignes.reduce((s, l) => s + Number(l.montant), 0) + client.frais_oraforme
                  const tva = Math.round(ht * 0.18)
                  const ca  = Math.round(tva * 0.05)
                  const ttc = ht + tva + ca
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Services</span><span>{fmt(ht - client.frais_oraforme)}</span></div>
                      <div className="flex justify-between text-amber-700"><span>Frais Oraforme inclus</span><span>+ {fmt(client.frais_oraforme)}</span></div>
                      <div className="flex justify-between border-t border-amber-200 pt-1"><span>Total HT</span><span className="font-bold">{fmt(ht)}</span></div>
                      <div className="flex justify-between"><span>TVA 18%</span><span>{fmt(tva)}</span></div>
                      <div className="flex justify-between"><span>CA 5%</span><span>{fmt(ca)}</span></div>
                      <div className="flex justify-between text-[14px] font-black border-t border-amber-300 pt-1 text-amber-800"><span>TOTAL TTC</span><span>{fmt(ttc)}</span></div>
                    </div>
                  )
                })()}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewFacture(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">{saving ? 'Création...' : 'Créer la facture'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
