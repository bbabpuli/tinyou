import { supabase } from '../lib/supabase'
import { useGame } from '../state/store'

export function SettingsCorner() {
  const reset = useGame((s) => s.reset)

  const handleLogout = async () => {
    if (!window.confirm('로그아웃할까요?')) return
    await supabase.auth.signOut()
    reset()
    localStorage.removeItem('tinyou-last-trace-check')
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: 'none',
        background: '#f0f0f0',
        cursor: 'pointer',
        fontSize: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
      title="설정"
    >
      ⚙️
    </button>
  )
}
