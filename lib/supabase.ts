import { createBrowserClient } from '@supabase/ssr'

// In dev, React Strict Mode double-mounts cause concurrent getUser() calls that
// contend for the IndexedDB navigator.lock → NavigatorLockAcquireTimeoutError.
// Using a simple in-memory lock avoids the contention without affecting auth correctness.
let _pending: Promise<unknown> | null = null
async function devLock<R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> {
  const run = (_pending ?? Promise.resolve()).then(() => fn()).finally(() => { _pending = null })
  _pending = run
  return run
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // Replace navigator.locks with a simple in-process queue.
  // Concurrent auth calls (TenantContext getUser + page queries) race for the
  // navigator lock and the losing caller gets AbortError after 5 s.  devLock
  // serializes them instead, so no call ever waits more than the previous one's
  // actual duration — and no steal / abort ever happens.
  { auth: { lock: devLock } }
)
