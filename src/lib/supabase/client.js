import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Every data request first awaits the auth session (initialize, then a single-flight
// token refresh). auth-js 2.108 is lockless by default (no navigator.locks), but if that
// refresh fetch stalls (ERR_TIMED_OUT can take minutes in Chrome), every later request
// waits on it silently and nothing reaches the network. Guard: no fetch from this client,
// auth refresh included, runs longer than FETCH_TIMEOUT_MS, so the session await always
// settles and queued requests proceed (or fail visibly).
export const FETCH_TIMEOUT_MS = 15000

function fetchWithTimeout(input, init = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(new DOMException('Request timed out', 'TimeoutError')), FETCH_TIMEOUT_MS)
  const outer = init.signal
  if (outer) {
    if (outer.aborted) ctl.abort(outer.reason)
    else outer.addEventListener('abort', () => ctl.abort(outer.reason), { once: true })
  }
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
})
