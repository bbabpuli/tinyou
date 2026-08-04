import { supabase } from '../lib/supabase'
import { useGame } from '../state/store'
import { IconGear } from './icons'

/** 트레이의 설정 구역 — 지금은 로그아웃 하나. (구 우상단 플로팅 버튼에서 이사) */
export function SettingsCorner() {
  const reset = useGame((s) => s.reset)

  const handleLogout = async () => {
    if (!window.confirm('로그아웃할까요?')) return
    await supabase.auth.signOut()
    reset()
    localStorage.removeItem('tinyou-last-trace-check')
  }

  return (
    <div>
      <div className="tray-section-label">설정</div>
      <button onClick={() => void handleLogout()} style={{ width: '100%' }}>
        <IconGear size={14} /> 로그아웃
      </button>
    </div>
  )
}
