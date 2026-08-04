import type { CSSProperties, ReactNode } from 'react'
import type { ShellTheme } from './shellTheme'

/** 뷰포트 전체를 차지하는 기기 셸 — 팔레트 파생 색을 CSS 변수로 주입한다. */
export function Shell({ theme, children }: { theme: ShellTheme; children: ReactNode }) {
  const vars = {
    '--shell-base': theme.base,
    '--shell-deep': theme.deep,
    '--shell-text': theme.text,
  } as CSSProperties
  return (
    <div className="shell" style={vars}>
      <div className="shell-logo">★ TINYOU ★</div>
      {children}
    </div>
  )
}
