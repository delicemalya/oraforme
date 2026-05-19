"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useState } from "react";

const sectors = [
  { name: "Commerce & Distribution", desc: "Ventes, stock, clients, trésorerie", icon: "🏪" },
  { name: "Restaurant & Hôtellerie", desc: "Commandes, caisse, personnel", icon: "🍽️" },
  { name: "École & Université", desc: "Élèves, paiements, bulletins", icon: "🎓" },
  { name: "Santé & Clinique", desc: "Patients, rendez-vous, facturation", icon: "🏥" },
  { name: "Transport & Logistique", desc: "Livraisons, flotte, suivi", icon: "🚚" },
  { name: "BTP & Industrie", desc: "Chantiers, matériel, équipes", icon: "🏗️" },
];

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.94 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring", stiffness: 280, damping: 22 },
  },
};

export default function Step1() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#080C14] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Ambient background orbs */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-yellow-500/6 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-60 h-60 bg-amber-400/4 rounded-full blur-[80px] pointer-events-none" />

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-12 text-center max-w-2xl relative z-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-yellow-400/8 border border-yellow-400/20 rounded-full px-4 py-1.5 text-xs font-medium text-yellow-400 tracking-widest uppercase mb-6"
        >
          <motion.span
            className="w-1.5 h-1.5 bg-yellow-400 rounded-full"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          Configuration intelligente · MIAA+
        </motion.div>

        <h1 className="text-4xl md:text-5xl font-bold leading-[1.15] tracking-tight">
          <span className="text-[#FFFFFF]">Votre espace prêt en</span>
          <br />
          <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
            30 secondes
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-[#6B7280] mt-5 text-base leading-relaxed"
        >
          Choisissez votre secteur — MIAA+ adapte automatiquement les modules,
          <br className="hidden md:block" /> la fiscalité Congo et les workflows à votre activité.
        </motion.p>
      </motion.div>

      {/* GRID */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-w-4xl w-full relative z-10"
      >
        {sectors.map((sector, i) => {
          const isSelected = selected === sector.name;
          return (
            <motion.div
              key={i}
              variants={cardVariants}
              whileHover={{ scale: 1.03, y: -3, transition: { type: "spring", stiffness: 400, damping: 20 } }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelected(sector.name)}
              className="relative group cursor-pointer"
            >
              {/* Selected glow border — shared layout animation */}
              {isSelected && (
                <motion.div
                  layoutId="cardGlow"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(250,204,21,0.12) 0%, rgba(249,115,22,0.06) 100%)",
                    border: "1px solid rgba(250,204,21,0.5)",
                    boxShadow: "0 0 40px rgba(250,204,21,0.18), inset 0 0 40px rgba(250,204,21,0.04)",
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}

              {/* Card body */}
              <div
                className={`relative p-5 rounded-2xl h-full transition-colors duration-200
                  ${isSelected
                    ? "bg-transparent border border-transparent"
                    : "bg-white/[0.025] border border-white/[0.07] hover:bg-white/[0.04] hover:border-white/[0.12]"
                  }`}
              >
                {/* Icon container */}
                <motion.div
                  animate={isSelected ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.35 }}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-4 transition-colors duration-200
                    ${isSelected ? "bg-yellow-400/15" : "bg-white/[0.04] group-hover:bg-white/[0.07]"}`}
                >
                  {sector.icon}
                </motion.div>

                <h2 className={`font-semibold text-sm leading-snug transition-colors duration-200
                  ${isSelected ? "text-white" : "text-[#C9D1D9]"}`}
                >
                  {sector.name}
                </h2>
                <p className="text-xs text-[#484F58] mt-1.5 leading-relaxed">{sector.desc}</p>

                {/* Checkmark badge */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.4 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_2px_8px_rgba(250,204,21,0.4)]"
                    >
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.2 5.8L8 1" stroke="#142850" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* MIAA FEEDBACK */}
      <div className="mt-8 h-16 flex items-center relative z-10">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="flex items-center gap-3 bg-[#142850] border border-yellow-400/20 rounded-2xl px-5 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
            >
              <div className="w-8 h-8 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-sm shrink-0">
                ✨
              </div>
              <div>
                <p className="text-[10px] text-[#484F58] uppercase tracking-widest mb-0.5 font-medium">MIAA+ Intelligence</p>
                <p className="text-sm text-[#C9D1D9]">
                  Espace{" "}
                  <span className="text-yellow-400 font-semibold">{selected}</span>{" "}
                  configuré — TVA Congo, modules et workflows prêts.
                </p>
              </div>
              <div className="flex gap-1 ml-1 shrink-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 rounded-full bg-yellow-400"
                    animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-[#30363D] text-center"
            >
              Sélectionnez un secteur pour continuer
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 relative z-10 flex flex-col items-center gap-3"
      >
        <motion.button
          whileHover={selected ? { scale: 1.04, y: -1 } : {}}
          whileTap={selected ? { scale: 0.96 } : {}}
          disabled={!selected}
          className={`relative px-10 py-3.5 rounded-2xl font-semibold text-sm overflow-hidden transition-all duration-400
            ${selected
              ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-[#142850] shadow-[0_8px_32px_rgba(250,204,21,0.3)] cursor-pointer"
              : "bg-white/[0.04] text-[#30363D] border border-white/[0.07] cursor-default"
            }`}
        >
          {/* Shimmer on active */}
          {selected && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12"
              animate={{ x: ["-120%", "220%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Continuer
            <motion.span
              animate={selected ? { x: [0, 3, 0] } : {}}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              →
            </motion.span>
          </span>
        </motion.button>

        <p className="text-xs text-[#1a2d50]">Vous pourrez modifier ces choix plus tard</p>
      </motion.div>
    </div>
  );
}
