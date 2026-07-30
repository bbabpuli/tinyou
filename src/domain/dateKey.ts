const seoulFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Asia/Seoul 달력 날짜 키 ("YYYY-MM-DD"). "오늘" 판정은 반드시 이 함수로 통일한다. */
export function dateKeySeoul(date: Date): string {
  return seoulFormatter.format(date)
}
