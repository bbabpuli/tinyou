import { expect, test } from 'vitest'
import { subjectJosa, withSubjectJosa } from './josa'

test('받침 있는 이름은 이', () => {
  expect(subjectJosa('동은')).toBe('이')
  expect(withSubjectJosa('동은')).toBe('동은이')
})

test('받침 없는 이름은 가', () => {
  expect(subjectJosa('나리')).toBe('가')
  expect(withSubjectJosa('나리')).toBe('나리가')
})

test('한글이 아닌 끝글자는 가', () => {
  expect(subjectJosa('Nari')).toBe('가')
  expect(subjectJosa('')).toBe('가')
  expect(withSubjectJosa('Nari')).toBe('Nari가')
})
