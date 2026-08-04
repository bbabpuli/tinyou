import { useTick } from '../hooks/useTick'
import { isPetToastVisible, type PetToastState } from '../traces/petToast'

/**
 * 쓰다듬 실시간 토스트 — 상태 관리(applyPetEvent)는 App이, 표시 판정·소멸은 여기서.
 *
 * 자체 조회 없이 props만 그리는 표시 전용이라 traces/가 아닌 ui/에 둔다. 파일명이
 * traces/petToast.ts와 대소문자만 다르면 대소문자 비구분 파일시스템(macOS)에서
 * 같은 파일로 해석돼 빌드가 깨지는 것도 이 배치가 함께 피한다.
 */
export function PetToast({ state }: { state: PetToastState | null }) {
  useTick(1000) // 이벤트가 멎으면 표시 시간이 끝났을 때 리렌더로 사라져야 한다
  if (!isPetToastVisible(state, Date.now())) return null
  return (
    <div
      role="status"
      style={{ padding: '8px 12px', borderRadius: 8, background: '#ffe4ef', textAlign: 'center' }}
    >
      {state!.text}
    </div>
  )
}
