import type { SpeciesKey } from './matching'

export type Stamp = [dr: number, dc: number, ch: string][]

export interface Anchors {
  eyes: [number, number][]
  mouth: [number, number]
  cheeks: [number, number][]
  accessory: [number, number]
}

export interface Species {
  key: SpeciesKey
  baseMap: string[]
  anchors: Anchors
}

export interface Variant {
  eyes: number
  mouth: number
  cheeks: number
  accessory: number
}
