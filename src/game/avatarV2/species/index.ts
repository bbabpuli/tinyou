import type { SpeciesKey } from '../matching'
import type { Species } from '../types'
import { cat } from './cat'
import { dog } from './dog'
import { frog } from './frog'
import { hamster } from './hamster'
import { rabbit } from './rabbit'
import { squirrel } from './squirrel'

// Task 4가 나머지 6종을 추가한다. 등록 즉시 species.test.ts 구조 검증이 자동 적용됨
export const SPECIES = { hamster, rabbit, cat, dog, squirrel, frog } as Partial<Record<SpeciesKey, Species>> as Record<
  SpeciesKey,
  Species
>
export const REGISTERED_SPECIES = Object.values(SPECIES) as Species[]
