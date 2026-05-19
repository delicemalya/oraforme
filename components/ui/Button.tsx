'use client'

import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-[#F08900] text-[#142850] hover:bg-[#D4900A] active:scale-[0.98]',
    secondary: 'bg-[#1a2d50] text-[#FFFFFF] border border-[#30363D] hover:border-[#F08900] hover:text-[#F08900]',
    ghost: 'text-[#8B949E] hover:text-[#FFFFFF] hover:bg-[#1a2d50]',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
