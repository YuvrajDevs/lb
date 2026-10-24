import { createClient } from '@supabase/supabase-js'

// The NeighBoxed Supabase project. Both values are public by design (the publishable key only allows what the
// database's row level security allows); a deployment can override them with VITE_SUPABASE_URL / _KEY.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://ecbodzfhvtdnrjcjwitc.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_hiT4AVmNDOzVKcF3L9LOgA_RUmmkfch'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 20 } },
})

/** call a server function; throws an Error with a readable message */
export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(friendly(error.message))
  return data
}

// the database's messages are already plain English; trim the technical prefix some carry
const friendly = msg => (msg || 'Something went wrong').replace(/^.*?ERROR:\s*/, '')
