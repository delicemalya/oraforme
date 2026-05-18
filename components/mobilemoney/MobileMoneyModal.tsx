'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Smartphone, Send, CheckCircle2, Copy, X, AlertCircle } from 'lucide-react'

interface MobileMoneyModalProps {
  open: boolean
  onClose: () => void
  montant?: number
  reference?: string
  tenantId?: string
}

type Operator = 'airtel' | 'mtn' | 'wave' | 'orange'

const OPERATORS: { id: Operator; name: string; color: string; prefix: string }[] = [
  { id: 'airtel', name: 'Airtel Money', color: '#E60026', prefix: '+242 06' },
  { id: 'mtn',    name: 'MTN MoMo',    color: '#FFCC00', prefix: '+243 09' },
  { id: 'wave',   name: 'Wave',         color: '#00BFFF', prefix: '+221 77' },
  { id: 'orange', name: 'Orange Money', color: '#FF6600', prefix: '+242 05' },
]

export default function MobileMoneyModal({ open, onClose, montant, reference }: MobileMoneyModalProps) {
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form')
  const [operator, setOperator] = useState<Operator>('airtel')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState(montant?.toString() ?? '')
  const [loading, setLoading] = useState(false)
  const [paymentLink, setPaymentLink] = useState('')
  const [copied, setCopied] = useState(false)

  const selectedOp = OPERATORS.find(o => o.id === operator)!

  const handleSend = async () => {
    setLoading(true)
    // Simulate API call — in production, integrate Airtel/MTN API
    await new Promise(r => setTimeout(r, 1500))
    const link = `https://pay.oraforme.com/mm/${operator}/${phone.replace(/\s/g, '')}/${amount}?ref=${reference ?? 'direct'}`
    setPaymentLink(link)
    setLoading(false)
    setStep('done')
  }

  const copyLink = () => {
    navigator.clipboard.writeText(paymentLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setStep('form')
    setPhone('')
    setPaymentLink('')
    setCopied(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E2E8F0]">
              <div className="w-9 h-9 rounded-xl bg-[#F0A30A] flex items-center justify-center">
                <Smartphone size={18} className="text-[#0D1117]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111827]">Lien de paiement Mobile Money</h3>
                <p className="text-[10px] text-[#6B7280]">Airtel Money · MTN MoMo · Wave · Orange</p>
              </div>
              <button onClick={onClose} className="ml-auto text-[#6B7280] hover:text-[#4B5563] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">

                {/* FORM */}
                {step === 'form' && (
                  <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    {/* Operator selection */}
                    <div>
                      <label className="block text-xs font-semibold text-[#4B5563] mb-2">Opérateur</label>
                      <div className="grid grid-cols-4 gap-2">
                        {OPERATORS.map(op => (
                          <button
                            key={op.id}
                            onClick={() => setOperator(op.id)}
                            className={`py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                              operator === op.id
                                ? 'border-[#F0A30A] bg-[#F0A30A15] text-[#111827]'
                                : 'border-[#E2E8F0] text-[#6B7280] hover:border-[#8B0073]'
                            }`}
                            style={{ borderColor: operator === op.id ? op.color : undefined }}
                          >
                            <div className="w-5 h-5 rounded-full mx-auto mb-1 flex items-center justify-center text-[10px] font-bold" style={{ background: op.color + '30', color: op.color }}>
                              {op.name[0]}
                            </div>
                            {op.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-[#4B5563] mb-2">
                        Numéro {selectedOp.name}
                      </label>
                      <div className="flex gap-2">
                        <span className="px-3 py-2.5 rounded-xl bg-[#F0F4FF] border border-[#E2E8F0] text-xs text-[#4B5563] whitespace-nowrap">
                          {selectedOp.prefix}
                        </span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                          placeholder="XX XXX XXX"
                          className="flex-1 px-3 py-2.5 rounded-xl bg-[#F0F4FF] border border-[#E2E8F0] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#F0A30A] focus:ring-1 focus:ring-[#F0A30A20] transition-all"
                        />
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-semibold text-[#4B5563] mb-2">Montant (FCFA)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2.5 rounded-xl bg-[#F0F4FF] border border-[#E2E8F0] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#F0A30A] focus:ring-1 focus:ring-[#F0A30A20] transition-all"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F0790010] border border-[#F0790020] text-xs text-[#8B0073]">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span>Un lien de paiement sécurisé sera généré et peut être envoyé par SMS/WhatsApp au client.</span>
                    </div>

                    <button
                      onClick={() => setStep('confirm')}
                      disabled={!phone || !amount}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-[#0D1117] bg-[#F0A30A] rounded-xl hover:bg-[#E09000] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Send size={15} /> Générer le lien
                    </button>
                  </motion.div>
                )}

                {/* CONFIRM */}
                {step === 'confirm' && (
                  <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <div className="bg-[#F0F4FF] rounded-xl p-4 space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#4B5563]">Opérateur</span>
                        <span className="text-[#111827] font-semibold">{selectedOp.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#4B5563]">Numéro</span>
                        <span className="text-[#111827] font-semibold">{selectedOp.prefix} {phone}</span>
                      </div>
                      <div className="h-px bg-[#E2EAFA]" />
                      <div className="flex justify-between">
                        <span className="text-[#4B5563] text-sm">Montant</span>
                        <span className="text-[#F0A30A] font-bold text-lg">
                          {new Intl.NumberFormat('fr-FR').format(Number(amount))} FCFA
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setStep('form')} className="flex-1 py-2.5 text-xs text-[#4B5563] bg-[#F0F4FF] border border-[#E2E8F0] rounded-xl hover:border-[#8B0073] transition-all">
                        Modifier
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-[#0D1117] bg-[#F0A30A] rounded-xl hover:bg-[#E09000] disabled:opacity-60 transition-all"
                      >
                        {loading ? <div className="w-4 h-4 border-2 border-[#0D1117] border-t-transparent rounded-full animate-spin" /> : <><Send size={13} /> Confirmer</>}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* DONE */}
                {step === 'done' && (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <div className="text-center py-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#2EA04320] flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 size={24} className="text-[#2EA043]" />
                      </div>
                      <p className="text-sm font-bold text-[#111827]">Lien généré avec succès !</p>
                      <p className="text-xs text-[#6B7280] mt-1">Partagez ce lien par SMS ou WhatsApp</p>
                    </div>
                    <div className="flex gap-2 items-center bg-[#F0F4FF] border border-[#E2E8F0] rounded-xl px-3 py-2.5">
                      <span className="text-xs text-[#4B5563] flex-1 truncate">{paymentLink}</span>
                      <button
                        onClick={copyLink}
                        className="shrink-0 flex items-center gap-1 text-xs text-[#F0A30A] hover:text-[#E09000] transition-colors font-semibold"
                      >
                        <Copy size={12} /> {copied ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                    <a
                      href={`https://wa.me/${selectedOp.prefix.replace(/\s/g, '')}${phone.replace(/\s/g, '')}?text=${encodeURIComponent(`Voici votre lien de paiement Oraforme : ${paymentLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-[#25D366] rounded-xl hover:bg-[#128C7E] transition-all"
                    >
                      📲 Envoyer via WhatsApp
                    </a>
                    <button onClick={reset} className="w-full py-2 text-xs text-[#4B5563] bg-[#F0F4FF] border border-[#E2E8F0] rounded-xl hover:border-[#8B0073] transition-all">
                      Nouveau paiement
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
