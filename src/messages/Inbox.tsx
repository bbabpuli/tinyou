import { useState } from 'react'
import type { Message } from './useMessages'

interface InboxProps {
  inbox: Message[]
}

export function Inbox({ inbox }: InboxProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%' }}>
        💌 쪽지함 ({inbox.length}) {open ? '▲' : '▼'}
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', display: 'grid', gap: 6 }}>
          {inbox.length === 0 && <li style={{ opacity: 0.6, textAlign: 'center' }}>아직 받은 쪽지가 없어요</li>}
          {inbox.map((m) => (
            <li
              key={m.id}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: m.readAt ? '#f5f0ea' : '#fff3cd',
              }}
            >
              <div style={{ wordBreak: 'break-all' }}>{m.body}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{m.createdAt.toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
