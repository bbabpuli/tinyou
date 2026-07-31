import type { SpeciesKey } from '../matching'
import type { Species } from '../types'
import { axolotl } from './axolotl'
import { bear } from './bear'
import { bird } from './bird'
import { cat } from './cat'
import { dog } from './dog'
import { duck } from './duck'
import { frog } from './frog'
import { hamster } from './hamster'
import { penguin } from './penguin'
import { rabbit } from './rabbit'
import { seal } from './seal'
import { squirrel } from './squirrel'

export const SPECIES: Record<SpeciesKey, Species> = {
  hamster,
  rabbit,
  cat,
  dog,
  squirrel,
  frog,
  bird,
  axolotl,
  bear,
  penguin,
  duck,
  seal,
}
export const REGISTERED_SPECIES = Object.values(SPECIES)
