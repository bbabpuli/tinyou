import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface CoupleChannelHandlers {
  onMessage?(): void
  onCare?(): void
  onProfile?(): void
}

/**
 * 커플 방의 Realtime 변경(쪽지 도착 / 돌봄 액션 / 프로필-파트너 합류)을 구독해 handlers를 호출한다.
 *
 * 구독은 best-effort다: 채널 생성·구독이 실패해도 handlers는 각 훅이 이미 갖고 있는 기존
 * fetch/refresh 함수를 그대로 재사용하므로(낙관적 갱신 없이 서버를 다시 읽는 방식), 화면은
 * 수동 새로고침(버튼)이나 다음 effect 재실행으로 계속 정상 동작한다 — 이 훅은 그 refresh를
 * "더 빨리" 트리거해주는 부가 경로일 뿐이다.
 *
 * care_actions 필터에 대한 결정: 이 테이블에는 couple_id 컬럼이 없다(character_id만 보유).
 * characters를 거쳐야 couple_id를 알 수 있는데 postgres_changes의 filter는 단순 컬럼 비교만
 * 지원해 조인이 불가능하다. 대신 Supabase Realtime의 postgres_changes는 (private 채널이
 * 아니어도) 구독자의 RLS 정책을 그대로 적용해 행을 내려준다 — care_actions에 걸린 RLS가
 * "내 커플 소속 캐릭터의 기록만" 조회를 허용하므로, 필터를 생략해도 다른 커플의 이벤트는
 * RLS가 걸러 애초에 전달되지 않는다. 그래서 care_actions만 filter 없이 구독한다.
 *
 * 채널 토픽에 userId를 섞는 이유: 호스티드 Realtime에서 같은 토픽을 여러 클라이언트가 동시에
 * 구독하면 일부 구독자가 postgres_changes 이벤트를 못 받는 버그가 있다
 * (https://github.com/supabase/realtime/issues/1524). 커플 두 사람이 `couple:<id>`라는 동일
 * 토픽을 쓰면 정확히 이 조건에 걸리므로, 토픽을 `couple:<coupleId>:<userId>`로 유니크하게 만든다.
 * 토픽은 브로드캐스트 라우팅 키일 뿐 postgres_changes 구독 범위와 무관하므로 수신 내용은 동일하다.
 */
export function useCoupleChannel(
  coupleId: string | undefined,
  userId: string | undefined,
  handlers: CoupleChannelHandlers,
): void {
  // 매 렌더 새로 만들어지는 handlers 객체 때문에 채널을 매번 재구독하지 않도록 최신 값만 ref로 따라간다.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!coupleId || !userId) return

    const channel = supabase
      .channel(`couple:${coupleId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => handlersRef.current.onMessage?.(),
      )
      .on(
        // care_actions: couple_id 컬럼이 없어 filter 불가 — RLS가 커플 범위를 보장한다(상단 주석 참고)
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'care_actions' },
        () => handlersRef.current.onCare?.(),
      )
      .on(
        // 파트너 합류(INSERT) / 닉네임 등 갱신(UPDATE) 둘 다 대기 화면·닉네임 표시 자동 갱신 대상
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => handlersRef.current.onProfile?.(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => handlersRef.current.onProfile?.(),
      )
      // 구독 실패(CHANNEL_ERROR / TIMED_OUT / CLOSED)는 화면을 막지 않지만 조용히 죽으면 원인을
      // 못 찾으므로 콘솔에 남긴다. 갱신 자체는 수동 새로고침·폴링 경로로 계속 동작한다.
      .subscribe((status, err) => {
        if (status !== 'SUBSCRIBED') console.warn('[realtime]', status, err)
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [coupleId, userId])
}
