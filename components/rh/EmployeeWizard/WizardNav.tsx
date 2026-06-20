'use client'

import { CheckCircle, Circle, ChevronRight } from 'lucide-react'

export interface WizardStep {
  id:       number
  label:    string
  icon:     string
  visible:  boolean
  required: boolean
}

interface WizardNavProps {
  steps:          WizardStep[]
  currentStep:    number
  completedSteps: Set<number>
  onGoTo:         (step: number) => void
}

/** Barre mobile : progress bar + pastilles scrollables. Afficher uniquement sur sm/md (lg:hidden). */
export function WizardNavMobile({ steps, currentStep, completedSteps, onGoTo }: WizardNavProps) {
  const visible = steps.filter(s => s.visible)
  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{visible.findIndex(s => s.id === currentStep) + 1} / {visible.length}</span>
        <span className="font-medium text-slate-700">
          {visible.find(s => s.id === currentStep)?.icon}{' '}
          {visible.find(s => s.id === currentStep)?.label}
        </span>
        <span>{Math.round((completedSteps.size / visible.length) * 100)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${(completedSteps.size / visible.length) * 100}%` }}
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {visible.map(step => {
          const done   = completedSteps.has(step.id)
          const active = step.id === currentStep
          return (
            <button
              key={step.id}
              onClick={() => onGoTo(step.id)}
              className={[
                'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                active  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : done  ? 'bg-green-50  text-green-700'
                :         'bg-slate-100 text-slate-400',
              ].join(' ')}
            >
              <span>{step.icon}</span>
              {active && <span>{step.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Sidebar desktop : boutons verticaux avec icône + label + état. Afficher uniquement à partir de lg. */
export function WizardNavDesktop({ steps, currentStep, completedSteps, onGoTo }: WizardNavProps) {
  const visible = steps.filter(s => s.visible)
  return (
    <nav className="flex flex-col gap-0.5 w-52 shrink-0">
      {visible.map(step => {
        const done   = completedSteps.has(step.id)
        const active = step.id === currentStep
        return (
          <button
            key={step.id}
            onClick={() => onGoTo(step.id)}
            className={[
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-all',
              active
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : done
                ? 'text-green-700 hover:bg-green-50'
                : 'text-slate-500 hover:bg-slate-50',
            ].join(' ')}
          >
            <span className="text-base shrink-0">{step.icon}</span>
            <span className="flex-1 truncate">{step.label}</span>
            {done && !active ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
            ) : active ? (
              <ChevronRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            )}
          </button>
        )
      })}
    </nav>
  )
}

/** Composant unifié (legacy) — rend les deux variantes via CSS. */
export function WizardNav(props: WizardNavProps) {
  return (
    <>
      <div className="lg:hidden"><WizardNavMobile {...props} /></div>
      <div className="hidden lg:block"><WizardNavDesktop {...props} /></div>
    </>
  )
}
