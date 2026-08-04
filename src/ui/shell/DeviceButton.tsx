import type { ReactNode } from 'react'

/** 셸에 박힌 원형 물리 버튼 — 누르면 캡이 실제로 내려간다. */
export function DeviceButton({
  icon, label, disabled, onClick,
}: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="device-button" disabled={disabled} onClick={onClick}>
      <span className="cap">{icon}</span>
      <span className="cap-label">{label}</span>
    </button>
  )
}
