import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** 실제 접근 시점에만 env를 검증하고 클라이언트를 만든다 (모듈 로드 시 throw 금지). */
export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 .env.local에 필요합니다')
  }
  client = createClient(url, anonKey)
  return client
}

/**
 * 기존 `supabase.xxx` 호출부를 그대로 두기 위한 lazy 프록시.
 * 모듈 import만으로는 env를 요구하지 않으므로 env 없는 환경(테스트)에서도 로드된다.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getSupabase() as unknown as Record<string | symbol, unknown>
    const value = real[prop]
    // 메서드는 실제 클라이언트에 바인딩해 내부 this 참조가 깨지지 않게 한다
    return typeof value === 'function' ? value.bind(real) : value
  },
})
