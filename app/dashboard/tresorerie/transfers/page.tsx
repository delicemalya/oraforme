// Redirect: /dashboard/tresorerie/transfers → /dashboard/tresorerie/transferts
import { redirect } from 'next/navigation'
export default function TransfersRedirect() {
  redirect('/dashboard/tresorerie/transferts')
}
