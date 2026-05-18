import { redirect } from 'next/navigation'

// Unified treasury for all company types — redirect to the shared page
export default function EcoleTresorerieRedirect() {
  redirect('/dashboard/tresorerie')
}
