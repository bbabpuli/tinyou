import type { SpeciesKey } from '../matching'
import type { Species } from '../types'
import { hamster } from './hamster'

// Task 3·4가 나머지 11종을 추가한다. 등록 즉시 species.test.ts 구조 검증이 자동 적용됨
export const SPECIES = { hamster } as Partial<Record<SpeciesKey, Species>> as Record<SpeciesKey, Species>
export const REGISTERED_SPECIES = Object.values(SPECIES) as Species[]
