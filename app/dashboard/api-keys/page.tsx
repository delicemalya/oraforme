'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Plus, Copy, Trash2, Eye, EyeOff, CheckCircle,
  XCircle, RefreshCw, AlertTriangle, Loader2, Shield,
  Clock, Activity,
} from 'lucide-react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#F5F7FB'
const CARD = '#FFFFFF'
const PRIMARY = '#DC2626'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const BORDER = '#E5E7EB'

interface ApiKey {
  id: string
  name: string
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

const ALL_SCOPES = ['read', 'write', 'delete', 'webhooks', 'workflows']

// ── Create key modal ──────────────────────────────────────────────────────────
function CreateKeyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, scopes: string[], expires: string) => void
}) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read'])
  const [expires, setExpires] = useState('')

  const toggleScope = (s: string) => {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          background: CARD, borderRadius: 18, padding: 28,
          width: '100%', maxWidth: 440,
          boxShadow: '0 24px 60px rgba(0,0,0,.15)',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: TEXT }}>
          Nouvelle clé API
        </h2>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>NOM</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ex: Intégration Salesforce"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: `1px solid ${BORDER}`, fontSize: 14, color: TEXT,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </label>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 8 }}>PERMISSIONS</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ALL_SCOPES.map(s => (
              <button
                key={s}
                onClick={() => toggleScope(s)}
                style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${scopes.includes(s) ? PRIMARY : BORDER}`,
                  background: scopes.includes(s) ? PRIMARY + '10' : CARD,
                  color: scopes.includes(s) ? PRIMARY : MUTED,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>
            EXPIRATION (optionnel)
          </span>
          <input
            type="date"
            value={expires}
            onChange={e => setExpires(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: `1px solid ${BORDER}`, fontSize: 14, color: TEXT,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              border: `1px solid ${BORDER}`, background: CARD,
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: MUTED,
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => { if (name.trim() && scopes.length) onCreate(name.trim(), scopes, expires) }}
            disabled={!name.trim() || !scopes.length}
            style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: name.trim() && scopes.length ? PRIMARY : BORDER,
              cursor: name.trim() && scopes.length ? 'pointer' : 'not-allowed',
              fontSize: 14, fontWeight: 600, color: '#fff',
            }}
          >
            Créer la clé
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Revealed key display ──────────────────────────────────────────────────────
function RevealedKey({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          background: CARD, borderRadius: 18, padding: 28,
          width: '100%', maxWidth: 480,
          boxShadow: '0 24px 60px rgba(0,0,0,.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <CheckCircle size={22} color="#16A34A" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>Clé créée avec succès</h2>
        </div>

        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 10, padding: 12, marginBottom: 16,
          fontSize: 12, color: '#DC2626', fontWeight: 600,
        }}>
          Copiez cette clé maintenant. Elle ne sera plus affichée.
        </div>

        <div style={{
          background: '#0F172A', borderRadius: 10, padding: '14px 16px',
          fontFamily: 'monospace', fontSize: 13, color: '#E2E8F0',
          wordBreak: 'break-all', marginBottom: 16,
        }}>
          {rawKey}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={copy}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
              background: copied ? '#16A34A' : PRIMARY, color: '#fff',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {copied ? <><CheckCircle size={15} /> Copié !</> : <><Copy size={15} /> Copier</>}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              border: `1px solid ${BORDER}`, background: CARD,
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: MUTED,
            }}
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok })
    setTimeout(() => setFeedback(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/api-keys')
    if (res.ok) {
      const d = await res.json()
      setKeys(d.keys ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (name: string, scopes: string[], expires: string) => {
    setShowCreate(false)
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scopes, expires_at: expires || null }),
    })
    const d = await res.json()
    if (res.ok) {
      setRevealedKey(d.key)
      load()
    } else {
      showFeedback(d.error ?? 'Erreur', false)
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    const res = await fetch(`/api/api-keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active }),
    })
    if (res.ok) {
      setKeys(ks => ks.map(k => k.id === id ? { ...k, is_active: active } : k))
      showFeedback(active ? 'Clé activée' : 'Clé révoquée')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement cette clé ?')) return
    const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setKeys(ks => ks.filter(k => k.id !== id))
      showFeedback('Clé supprimée')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '32px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: '#2563EB15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Key size={22} color="#2563EB" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>Clés API</h1>
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                Authentification pour les intégrations externes
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: PRIMARY, color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={15} /> Nouvelle clé
          </button>
        </div>

        {/* Security notice */}
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <Shield size={16} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>
            Les clés API accordent un accès programmatique à votre compte. Gardez-les secrètes.
            Chaque clé n'est affichée qu'une seule fois à la création.
          </p>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                marginBottom: 16, padding: '12px 16px', borderRadius: 10,
                background: feedback.ok ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${feedback.ok ? '#BBF7D0' : '#FECACA'}`,
                color: feedback.ok ? '#16A34A' : '#DC2626',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {feedback.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
              {feedback.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keys list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : keys.length === 0 ? (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: 60, textAlign: 'center',
          }}>
            <Key size={40} color={BORDER} style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: '0 0 8px' }}>Aucune clé API</p>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px' }}>
              Créez votre première clé pour intégrer Oraforme à vos outils
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: PRIMARY, color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <Plus size={14} /> Créer une clé
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {keys.map(key => (
              <motion.div
                key={key.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: CARD, border: `1px solid ${BORDER}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  opacity: key.is_active ? 1 : 0.6,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: key.is_active ? '#16A34A' : BORDER,
                  flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{key.name}</span>
                    {!key.is_active && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px',
                        borderRadius: 20, background: '#FEF2F2', color: '#DC2626',
                      }}>RÉVOQUÉE</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    {key.scopes.map(s => (
                      <span key={s} style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 20, background: '#EFF6FF', color: '#2563EB',
                      }}>{s}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: MUTED }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> Créée {new Date(key.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    {key.last_used_at && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Activity size={11} /> Utilisée {new Date(key.last_used_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {key.expires_at && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: new Date(key.expires_at) < new Date() ? '#DC2626' : MUTED }}>
                        <AlertTriangle size={11} /> Expire {new Date(key.expires_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleToggle(key.id, !key.is_active)}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: `1px solid ${BORDER}`, background: CARD,
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      color: key.is_active ? '#DC2626' : '#16A34A',
                    }}
                  >
                    {key.is_active ? 'Révoquer' : 'Activer'}
                  </button>
                  <button
                    onClick={() => handleDelete(key.id)}
                    style={{
                      padding: '6px 10px', borderRadius: 8,
                      border: `1px solid #FECACA`, background: '#FEF2F2',
                      cursor: 'pointer', color: '#DC2626',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateKeyModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
      {revealedKey && (
        <RevealedKey rawKey={revealedKey} onClose={() => setRevealedKey(null)} />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
