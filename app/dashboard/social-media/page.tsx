'use client'

import { useState } from 'react'
import {
  Plus, Send, Calendar, Image, BarChart2, Settings,
  ThumbsUp, MessageCircle, Share2, Eye, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertCircle, X, Repeat2,
  Link as LinkIcon, Hash, AtSign,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'facebook' | 'instagram' | 'whatsapp' | 'linkedin' | 'twitter'
type PostStatus = 'published' | 'scheduled' | 'draft' | 'failed'

interface SocialAccount {
  id:        string
  platform:  Platform
  name:      string
  handle:    string
  followers: number
  connected: boolean
}

interface Post {
  id:        string
  platform:  Platform[]
  content:   string
  image?:    string
  status:    PostStatus
  date:      string
  likes:     number
  comments:  number
  shares:    number
  reach:     number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string; bg: string; emoji: string }> = {
  facebook:  { label: 'Facebook',        color: '#1877F2', bg: '#EFF6FF', emoji: '📘' },
  instagram: { label: 'Instagram',       color: '#E1306C', bg: '#FFF0F6', emoji: '📷' },
  whatsapp:  { label: 'WhatsApp Business',color: '#25D366', bg: '#F0FDF4', emoji: '💬' },
  linkedin:  { label: 'LinkedIn',        color: '#0A66C2', bg: '#EFF6FF', emoji: '💼' },
  twitter:   { label: 'X (Twitter)',     color: '#000000', bg: '#F8FAFC', emoji: '𝕏' },
}

// ─── Données demo ──────────────────────────────────────────────────────────────

const DEMO_ACCOUNTS: SocialAccount[] = [
  { id: 's1', platform: 'facebook',  name: 'Mon Entreprise', handle: '@monentreprise',  followers: 4820,  connected: true  },
  { id: 's2', platform: 'instagram', name: 'Mon Entreprise', handle: '@monentreprise_',  followers: 3210,  connected: true  },
  { id: 's3', platform: 'whatsapp',  name: 'Oraforme Business', handle: '+242 06 XXX XX XX', followers: 1450, connected: true  },
  { id: 's4', platform: 'linkedin',  name: 'Mon Entreprise SA', handle: 'monentreprise-sa', followers: 890,  connected: false },
  { id: 's5', platform: 'twitter',   name: 'Mon Entreprise', handle: '@MonEntreprise',   followers: 320,   connected: false },
]

const DEMO_POSTS: Post[] = [
  {
    id: 'p1', platform: ['facebook', 'instagram'], status: 'published',
    content: '🚀 Nous sommes heureux d\'annoncer l\'ouverture de notre nouvelle agence à Pointe-Noire !\n\nVenez nous rendre visite du lundi au samedi, 8h–18h.\n\n📍 Avenue de la Paix, Pointe-Noire\n📞 06 000 00 00\n\n#NouvelleAgence #PointeNoire #Congo',
    date: '2026-06-18T10:00:00Z', likes: 284, comments: 43, shares: 67, reach: 8420,
  },
  {
    id: 'p2', platform: ['facebook', 'whatsapp'], status: 'published',
    content: '💰 PROMOTION EXCEPTIONNELLE jusqu\'au 30 juin !\n\nBénéficiez de -20% sur toute notre gamme de produits bureautiques.\n\nN\'attendez pas, stocks limités !\n\n👉 Contactez-nous : 06 000 00 00\n\n#Promotion #Bureautique #Congo',
    date: '2026-06-15T09:00:00Z', likes: 512, comments: 89, shares: 134, reach: 15200,
  },
  {
    id: 'p3', platform: ['instagram'], status: 'scheduled',
    content: '📸 Nos équipes en action !\n\nDécouvrez le quotidien de nos collaborateurs dévoués qui travaillent chaque jour pour vous offrir le meilleur service.\n\n#TeamWork #Collaboration #Oraforme',
    date: '2026-06-20T11:00:00Z', likes: 0, comments: 0, shares: 0, reach: 0,
  },
  {
    id: 'p4', platform: ['linkedin'], status: 'draft',
    content: 'Nous recherchons un(e) Directeur(trice) Commercial(e) pour rejoindre notre équipe en pleine croissance.\n\nProfil recherché :\n✅ 5 ans d\'expérience minimum\n✅ Maîtrise des marchés africains\n✅ Leadership et vision stratégique\n\nEnvoyez votre CV à : rh@monentreprise.com',
    date: '2026-06-21T08:00:00Z', likes: 0, comments: 0, shares: 0, reach: 0,
  },
]

// ─── Composants stat ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, trend, color }: {
  icon: React.FC<{ size: number; className?: string }>
  label: string; value: string; trend?: number; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF0] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        {/* color set on wrapper so lucide icon inherits via currentColor */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '18', color }}>
          <Icon size={16} className="opacity-80" />
        </div>
        {trend !== undefined && (
          <span className={`text-[11px] font-bold flex items-center gap-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[22px] font-extrabold text-[#0F172A]">{value}</p>
      <p className="text-xs text-[#64748B] mt-0.5">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SocialMediaPage() {
  const [activeTab,   setActiveTab]   = useState<'feed' | 'calendar' | 'analytics' | 'accounts'>('feed')
  const [showCompose, setShowCompose] = useState(false)
  const [compose, setCompose] = useState({
    content:   '',
    platforms: ['facebook'] as Platform[],
    scheduleDate: '',
    scheduleTime: '',
  })
  const [posts, setPosts] = useState(DEMO_POSTS)

  const totalFollowers = DEMO_ACCOUNTS.filter((a) => a.connected).reduce((s, a) => s + a.followers, 0)
  const totalReach     = posts.filter((p) => p.status === 'published').reduce((s, p) => s + p.reach, 0)
  const totalLikes     = posts.filter((p) => p.status === 'published').reduce((s, p) => s + p.likes, 0)
  const publishedCount = posts.filter((p) => p.status === 'published').length

  function togglePlatform(p: Platform) {
    setCompose((c) => ({
      ...c,
      platforms: c.platforms.includes(p)
        ? c.platforms.filter((x) => x !== p)
        : [...c.platforms, p],
    }))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const STATUS_CONFIG = {
    published: { label: 'Publié',     bg: '#F0FDF4', color: '#16A34A', icon: CheckCircle2 },
    scheduled:  { label: 'Planifié',   bg: '#EFF6FF', color: '#2563EB', icon: Clock       },
    draft:      { label: 'Brouillon',  bg: '#F8FAFC', color: '#64748B', icon: AlertCircle  },
    failed:     { label: 'Échec',      bg: '#FEF2F2', color: '#DC2626', icon: AlertCircle  },
  }

  const TABS = [
    { id: 'feed' as const,      label: 'Publications',  icon: Send },
    { id: 'calendar' as const,  label: 'Calendrier',    icon: Calendar },
    { id: 'analytics' as const, label: 'Statistiques',  icon: BarChart2 },
    { id: 'accounts' as const,  label: 'Comptes',       icon: Settings },
  ]

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Réseaux Sociaux</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Gérez toutes vos présences sociales depuis Oraforme</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}
        >
          <Plus size={15} /> Nouvelle publication
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Eye}           label="Abonnés total"      value={totalFollowers.toLocaleString('fr-FR')} trend={+8}  color="#2563EB" />
        <StatCard icon={TrendingUp}    label="Portée ce mois"     value={totalReach.toLocaleString('fr-FR')}     trend={+24} color="#DC2626" />
        <StatCard icon={ThumbsUp}      label="J'aime total"       value={totalLikes.toLocaleString('fr-FR')}     trend={+12} color="#7C3AED" />
        <StatCard icon={Send}          label="Posts publiés"      value={publishedCount.toString()}              color="#16A34A" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === id
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-[#64748B] hover:text-[#374151]'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ── Feed ── */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs bg-white border border-[#E8ECF0] px-3 py-1 rounded-full text-[#374151] font-medium">
              Tous ({posts.length})
            </span>
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const count = posts.filter((p) => p.status === status as PostStatus).length
              if (!count) return null
              return (
                <span key={status} className="text-xs px-3 py-1 rounded-full font-bold"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.label} ({count})
                </span>
              )
            })}
          </div>

          {/* Posts */}
          <div className="space-y-3">
            {posts.map((post) => {
              const st = STATUS_CONFIG[post.status]
              const StatusIcon = st.icon
              return (
                <div key={post.id} className="bg-white rounded-2xl border border-[#E8ECF0] p-5 shadow-sm">
                  {/* Post header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {post.platform.map((p) => (
                        <span key={p}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: PLATFORM_CONFIG[p].bg, color: PLATFORM_CONFIG[p].color }}
                        >
                          {PLATFORM_CONFIG[p].emoji} {PLATFORM_CONFIG[p].label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: st.bg, color: st.color }}
                      >
                        <StatusIcon size={10} />
                        {st.label}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {post.content}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F1F5F9]">
                    <div className="flex items-center gap-4 text-[#64748B]">
                      {post.status === 'published' ? (
                        <>
                          <span className="flex items-center gap-1 text-xs">
                            <ThumbsUp size={13} className="text-[#2563EB]" /> {post.likes.toLocaleString('fr-FR')}
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            <MessageCircle size={13} className="text-[#7C3AED]" /> {post.comments}
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            <Repeat2 size={13} className="text-[#16A34A]" /> {post.shares}
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            <Eye size={13} /> {post.reach.toLocaleString('fr-FR')} portée
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                          <Clock size={12} /> {post.status === 'scheduled' ? `Planifié le ${formatDate(post.date)}` : 'Brouillon non publié'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {post.status === 'draft' && (
                        <button
                          onClick={() => setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, status: 'published' as PostStatus, date: new Date().toISOString(), likes: 0, comments: 0, shares: 0, reach: 0 } : p))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors"
                        >
                          <Send size={11} /> Publier
                        </button>
                      )}
                      <button className="p-1.5 rounded-lg hover:bg-[#F8FAFC] text-[#94A3B8] hover:text-[#374151] transition-colors">
                        <Share2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Calendrier ── */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl border border-[#E8ECF0] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-bold text-[#0F172A]">Calendrier Editorial — Juin 2026</h2>
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#DC2626]"
            >
              <Plus size={12} /> Planifier
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d) => (
              <div key={d} className="text-[10px] font-bold text-[#94A3B8] py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
              const dayPosts = posts.filter((p) => {
                const d = new Date(p.date)
                return d.getDate() === day && d.getMonth() === 5
              })
              const isToday = day === 19
              return (
                <div key={day}
                  className={`min-h-[64px] rounded-xl p-1.5 border text-left cursor-pointer hover:border-[#DC2626]/30 transition-all ${
                    isToday ? 'border-[#DC2626] bg-[#FEF2F2]' : 'border-[#F1F5F9] bg-[#FAFBFC]'
                  }`}
                >
                  <p className={`text-[11px] font-bold mb-1 ${isToday ? 'text-[#DC2626]' : 'text-[#374151]'}`}>{day}</p>
                  {dayPosts.map((p) => (
                    <div key={p.id} className="text-[9px] font-semibold rounded px-1 py-0.5 mb-0.5 truncate"
                      style={{ background: STATUS_CONFIG[p.status].bg, color: STATUS_CONFIG[p.status].color }}>
                      {p.platform[0] && PLATFORM_CONFIG[p.platform[0]].emoji}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#F1F5F9]">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <span key={status} className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
                <span className="w-2.5 h-2.5 rounded" style={{ background: cfg.color }} />
                {cfg.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Analytics ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          {/* Platform breakdown */}
          <div className="bg-white rounded-2xl border border-[#E8ECF0] p-6 shadow-sm">
            <h2 className="text-[15px] font-bold text-[#0F172A] mb-4">Performance par plateforme</h2>
            <div className="space-y-4">
              {DEMO_ACCOUNTS.filter((a) => a.connected).map((acc) => {
                const accPosts = posts.filter((p) => p.platform.includes(acc.platform) && p.status === 'published')
                const accLikes = accPosts.reduce((s, p) => s + p.likes, 0)
                const maxFollowers = Math.max(...DEMO_ACCOUNTS.map((a) => a.followers))
                const pct = Math.round((acc.followers / maxFollowers) * 100)
                const cfg = PLATFORM_CONFIG[acc.platform]
                return (
                  <div key={acc.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cfg.emoji}</span>
                        <div>
                          <span className="text-sm font-bold text-[#0F172A]">{cfg.label}</span>
                          <span className="text-xs text-[#94A3B8] ml-2">{acc.handle}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-[#0F172A]">{acc.followers.toLocaleString('fr-FR')}</span>
                        <span className="text-xs text-[#94A3B8] ml-1">abonnés</span>
                        {accLikes > 0 && (
                          <span className="text-xs text-[#2563EB] ml-3">{accLikes.toLocaleString('fr-FR')} J'aime</span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: cfg.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top posts */}
          <div className="bg-white rounded-2xl border border-[#E8ECF0] p-6 shadow-sm">
            <h2 className="text-[15px] font-bold text-[#0F172A] mb-4">Top publications</h2>
            <div className="space-y-3">
              {posts
                .filter((p) => p.status === 'published')
                .sort((a, b) => b.reach - a.reach)
                .map((post, idx) => (
                  <div key={post.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white"
                      style={{ background: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : '#CD7F32' }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {post.platform.map((p) => (
                          <span key={p} className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: PLATFORM_CONFIG[p].bg, color: PLATFORM_CONFIG[p].color }}>
                            {PLATFORM_CONFIG[p].emoji}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-[#374151] truncate">{post.content.substring(0, 80)}...</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#0F172A]">{post.reach.toLocaleString('fr-FR')}</p>
                      <p className="text-[10px] text-[#94A3B8]">portée</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Comptes ── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_ACCOUNTS.map((acc) => {
              const cfg = PLATFORM_CONFIG[acc.platform]
              return (
                <div key={acc.id} className="bg-white rounded-2xl border border-[#E8ECF0] p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{cfg.emoji}</span>
                      <div>
                        <p className="text-sm font-bold text-[#0F172A]">{cfg.label}</p>
                        <p className="text-xs text-[#94A3B8]">{acc.handle}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      acc.connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {acc.connected ? 'Connecté' : 'Non connecté'}
                    </span>
                  </div>

                  {acc.connected ? (
                    <>
                      <div className="flex justify-between py-3 border-y border-[#F1F5F9]">
                        <div className="text-center">
                          <p className="text-[16px] font-extrabold text-[#0F172A]">{acc.followers.toLocaleString('fr-FR')}</p>
                          <p className="text-[10px] text-[#94A3B8]">Abonnés</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[16px] font-extrabold text-[#0F172A]">
                            {posts.filter((p) => p.platform.includes(acc.platform) && p.status === 'published').length}
                          </p>
                          <p className="text-[10px] text-[#94A3B8]">Publications</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[16px] font-extrabold text-[#0F172A]">4.2%</p>
                          <p className="text-[10px] text-[#94A3B8]">Engagement</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="flex-1 py-2 text-xs font-bold text-[#64748B] bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-xl border border-[#E8ECF0] transition-colors">
                          Voir profil
                        </button>
                        <button className="flex-1 py-2 text-xs font-bold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-xl transition-colors">
                          Déconnecter
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="w-full mt-2 py-2.5 text-xs font-bold text-white rounded-xl transition-all hover:opacity-90"
                      style={{ background: cfg.color }}
                    >
                      Connecter {cfg.label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Info */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4 flex gap-3">
            <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 leading-relaxed">
              <strong>3 comptes actifs</strong> sur 5 plateformes. L'intégration OAuth native avec Facebook, Instagram et WhatsApp Business est disponible. LinkedIn et X seront intégrés dans la prochaine version.
            </p>
          </div>
        </div>
      )}

      {/* ── Modal Composer ── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8ECF0] shrink-0"
              style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}>
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={15} /> Nouvelle publication
              </span>
              <button onClick={() => setShowCompose(false)} className="text-white/70 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Platform selector */}
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Publier sur</p>
                <div className="flex flex-wrap gap-2">
                  {DEMO_ACCOUNTS.filter((a) => a.connected).map((acc) => {
                    const cfg = PLATFORM_CONFIG[acc.platform]
                    const selected = compose.platforms.includes(acc.platform)
                    return (
                      <button
                        key={acc.id}
                        onClick={() => togglePlatform(acc.platform)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          selected ? 'text-white' : 'text-[#374151] border-[#E8ECF0] hover:border-[#CBD5E1]'
                        }`}
                        style={selected ? { background: cfg.color, borderColor: cfg.color } : {}}
                      >
                        {cfg.emoji} {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content */}
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Contenu</p>
                <textarea
                  value={compose.content}
                  onChange={(e) => setCompose((c) => ({ ...c, content: e.target.value }))}
                  placeholder="Rédigez votre publication... Utilisez # pour les hashtags et @ pour mentionner"
                  rows={6}
                  className="w-full px-4 py-3 border border-[#E8ECF0] rounded-xl text-sm text-[#374151] outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] resize-none placeholder-[#9CA3AF] leading-relaxed"
                />
                <div className="flex items-center justify-between mt-1">
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#374151] transition-colors">
                      <Image size={12} /> Photo
                    </button>
                    <button className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#374151] transition-colors">
                      <LinkIcon size={12} /> Lien
                    </button>
                    <button className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#374151] transition-colors">
                      <Hash size={12} /> Hashtag
                    </button>
                    <button className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#374151] transition-colors">
                      <AtSign size={12} /> Mention
                    </button>
                  </div>
                  <span className={`text-xs font-medium ${compose.content.length > 2200 ? 'text-red-500' : 'text-[#94A3B8]'}`}>
                    {compose.content.length}/2200
                  </span>
                </div>
              </div>

              {/* Scheduling */}
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Planification</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-1">Date</label>
                    <input
                      type="date"
                      value={compose.scheduleDate}
                      onChange={(e) => setCompose((c) => ({ ...c, scheduleDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E8ECF0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-1">Heure</label>
                    <input
                      type="time"
                      value={compose.scheduleTime}
                      onChange={(e) => setCompose((c) => ({ ...c, scheduleTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#E8ECF0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {compose.platforms.length > 0 && compose.content && (
                <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E8ECF0]">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-2">Aperçu</p>
                  <p className="text-xs text-[#374151] whitespace-pre-wrap leading-relaxed">
                    {compose.content}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-[#E8ECF0] flex gap-3 shrink-0">
              <button
                onClick={() => {
                  setPosts((prev) => [{
                    id: `p${Date.now()}`,
                    platform: compose.platforms,
                    content: compose.content,
                    status: 'draft',
                    date: new Date().toISOString(),
                    likes: 0, comments: 0, shares: 0, reach: 0,
                  }, ...prev])
                  setShowCompose(false)
                  setCompose({ content: '', platforms: ['facebook'], scheduleDate: '', scheduleTime: '' })
                }}
                disabled={!compose.content.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#374151] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors disabled:opacity-50"
              >
                Sauvegarder brouillon
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] border border-[#E8ECF0] hover:bg-[#F8FAFC]"
              >
                Annuler
              </button>
              <button
                disabled={!compose.content.trim() || compose.platforms.length === 0}
                onClick={() => {
                  const isScheduled = compose.scheduleDate && compose.scheduleTime
                  setPosts((prev) => [{
                    id: `p${Date.now()}`,
                    platform: compose.platforms,
                    content: compose.content,
                    status: isScheduled ? 'scheduled' : 'published',
                    date: isScheduled
                      ? new Date(`${compose.scheduleDate}T${compose.scheduleTime}`).toISOString()
                      : new Date().toISOString(),
                    likes: 0, comments: 0, shares: 0, reach: 0,
                  }, ...prev])
                  setShowCompose(false)
                  setCompose({ content: '', platforms: ['facebook'], scheduleDate: '', scheduleTime: '' })
                }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all"
                style={{ background: '#DC2626' }}
              >
                {compose.scheduleDate ? (
                  <><Calendar size={13} /> Planifier</>
                ) : (
                  <><Send size={13} /> Publier maintenant</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
