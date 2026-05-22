'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2.5 rounded-lg bg-[var(--surface-alt)] border ${
            error ? 'border-red-500' : 'border-[var(--border)]'
          } text-[var(--text)] placeholder-[#484F58] focus:outline-none focus:border-[#F51E33] focus:ring-1 focus:ring-[#F51E33] transition-colors text-sm ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
