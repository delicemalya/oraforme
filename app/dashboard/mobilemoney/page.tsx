// Redirect: /dashboard/mobilemoney → /dashboard/tresorerie/mobile-money
import { redirect } from 'next/navigation'
export default function MobileMoneyRedirect() {
  redirect('/dashboard/tresorerie/mobile-money')
}
