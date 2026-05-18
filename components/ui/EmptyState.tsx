import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F0F4FF] flex items-center justify-center mb-4">
        <Icon size={24} className="text-[#6B7280]" />
      </div>
      <p className="text-sm font-medium text-[#111827] mb-1">{title}</p>
      <p className="text-xs text-[#4B5563] mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  )
}
