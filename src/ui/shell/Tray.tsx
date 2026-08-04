import { useState, type ReactNode } from 'react'
import { IconGear, IconMail } from '../icons'

/**
 * 셸 하단 쪽지 트레이 (바텀시트). 손잡이를 탭하면 열리고 내용은 내부 스크롤.
 * 미읽음 수는 손잡이 배지로 — 닫혀 있어도 도착을 놓치지 않는다.
 */
export function Tray({ unreadCount, children }: { unreadCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="tray">
      <button
        className="tray-handle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="grip" aria-hidden />
        <IconMail size={15} /> 쪽지{' '}
        {unreadCount > 0 && <span className="tray-badge">{unreadCount}</span>}
        {' · '}
        <IconGear size={15} label="설정" /> {open ? '▼' : '▲'}
      </button>
      {open && <div className="tray-body">{children}</div>}
    </div>
  )
}
