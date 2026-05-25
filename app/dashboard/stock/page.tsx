// Redirect permanent : ancienne URL /dashboard/stock → nouveau module enterprise /dashboard/stocks
import { redirect } from 'next/navigation'

export default function StockRedirectPage() {
  redirect('/dashboard/stocks')
}
