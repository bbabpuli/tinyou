const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3
const JONGSEONG_COUNT = 28

/**
 * 이름 뒤에 붙일 주격 조사('이'/'가')를 고른다.
 * 마지막 글자가 한글 음절이면 종성 유무로 판정하고(받침 있으면 '이', 없으면 '가'),
 * 한글이 아니면(영문·숫자·이모지 등) 표기 관행상 '가'로 둔다 — 'Nari가 다녀갔어'.
 */
export function subjectJosa(name: string): '이' | '가' {
  const last = name.trim().slice(-1)
  if (!last) return '가'
  const code = last.charCodeAt(0)
  if (code < HANGUL_START || code > HANGUL_END) return '가'
  return (code - HANGUL_START) % JONGSEONG_COUNT === 0 ? '가' : '이'
}

/** 이름 + 주격 조사를 붙인 문자열 — "동은이", "나리가". */
export function withSubjectJosa(name: string): string {
  return `${name}${subjectJosa(name)}`
}
