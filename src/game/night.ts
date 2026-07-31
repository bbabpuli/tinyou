import { dateKeySeoul } from '../domain/dateKey'

const seoulHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  hourCycle: 'h23',
})

/** Asia/Seoul 기준 시(0~23)를 뽑는다. "지금이 밤인가"류 판정은 반드시 이 함수를 거친다. */
export function hourSeoul(date: Date): number {
  return Number(seoulHourFormatter.format(date))
}

/** 굿나잇 인사 창(서울 기준 21~23시 또는 0~2시)인지 */
export function isGoodnightWindow(now: Date): boolean {
  const h = hourSeoul(now)
  return h >= 21 || h <= 2
}

/**
 * 취침 장면(서울 기준 21~06시)인지 — hasGoodnightToday는 호출부가 "적용 대상 날짜"의
 * goodnight 기록 존재 여부를 넘긴다. 0~06시 구간은 자정을 넘겨도 "어젯밤 인사"가 여전히
 * 유효하므로, 호출부에서 dateKeySeoul(now)와 dateKeySeoul(now - 9h) 두 날짜의 goodnight을
 * OR로 검사해 hasGoodnightToday를 만들어야 한다(이 함수는 그 결과만 받는다).
 */
export function isSleepScene(now: Date, hasGoodnightToday: boolean): boolean {
  if (!hasGoodnightToday) return false
  const h = hourSeoul(now)
  return h >= 21 || h < 6
}

const NINE_HOURS_MS = 9 * 60 * 60 * 1000

/**
 * now 시점에 "오늘 굿나잇으로 인정되는" 날짜 키 목록 — dateKeySeoul(now)과
 * dateKeySeoul(now - 9h) 두 날짜를 모두 후보로 둔다(브리프 명세). 0~06시엔 두 값이 갈라져
 * "어젯밤 인사"도 포함되고, 그 외 시간대엔 대개 같은 날짜라 사실상 단일 키로 수렴한다.
 */
export function goodnightDateKeys(now: Date): string[] {
  const today = dateKeySeoul(now)
  const nineHoursAgo = dateKeySeoul(new Date(now.getTime() - NINE_HOURS_MS))
  return nineHoursAgo === today ? [today] : [today, nineHoursAgo]
}
