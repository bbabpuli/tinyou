import type { ReactNode } from 'react'

export function SpeechBubble({
  x, y, onClose, children,
}: { x: number; y: number; onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        maxWidth: 220,
        background: '#ffffff',
        border: '3px solid #4a3f35',
        borderRadius: 12,
        padding: '8px 12px',
        fontFamily: 'PixelKR, monospace',
        fontSize: 14,
        lineHeight: 1.5,
        cursor: 'pointer',
        boxShadow: '2px 2px 0 #4a3f3533',
        wordBreak: 'break-all',
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -12,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '12px solid #4a3f35',
        }}
      />
    </div>
  )
}
