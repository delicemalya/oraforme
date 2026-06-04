import { redirect } from 'next/navigation'

/** Les wallets Mobile Money sont dans /mobile-money */
export default function WalletsRedirect() {
  redirect('/dashboard/tresorerie/mobile-money')
}
