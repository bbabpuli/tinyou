import { useState } from 'react'
import { IconMail } from '../ui/icons'
import type { Message } from './useMessages'

const PAGE_SIZE = 5

interface InboxProps {
  inbox: Message[]
}

export function Inbox({ inbox }: InboxProps) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)

  // 새 쪽지 도착/삭제로 목록 길이가 바뀌어도 빈 페이지에 남지 않게 렌더 시점에 클램프
  const totalPages = Math.max(1, Math.ceil(inbox.length / PAGE_SIZE))
  const current = Math.min(page, totalPages - 1)
  const pageItems = inbox.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%' }}>
        <IconMail size={14} /> 쪽지함 ({inbox.length}) {open ? '▲' : '▼'}
      </button>
      {open && (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', display: 'grid', gap: 6 }}>
            {inbox.length === 0 && <li style={{ opacity: 0.6, textAlign: 'center' }}>아직 받은 쪽지가 없어요</li>}
            {pageItems.map((m) => (
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
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
                aria-label="이전 쪽지"
              >
                ◀
              </button>
              <span style={{ fontSize: 13 }}>
                {current + 1} / {totalPages}
              </span>
              <button
                disabled={current >= totalPages - 1}
                onClick={() => setPage(current + 1)}
                aria-label="다음 쪽지"
              >
                ▶
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
