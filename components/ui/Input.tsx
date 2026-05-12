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
          <label className="text-sm font-medium text-[#8B949E]">{label}</label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2.5 rounded-lg bg-[#21262D] border ${
            error ? 'border-red-500' : 'border-[#30363D]'
          } text-[#E6EDF3] placeholder-[#484F58] focus:outline-none focus:border-[#F0A30A] focus:ring-1 focus:ring-[#F0A30A] transition-colors text-sm ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
