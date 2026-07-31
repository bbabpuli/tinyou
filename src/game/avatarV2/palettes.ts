export type PaletteKey =
  | 'pink' | 'mint' | 'lavender' | 'peach' | 'sky' | 'lemon' | 'cream' | 'taupe'

export const PALETTES: Record<PaletteKey, { B: string; S: string; C: string; D: string }> = {
  pink:     { B: '#ffb7c9', S: '#e896ab', C: '#ff6b9d', D: '#d97a94' },
  mint:     { B: '#a8e6cf', S: '#84c7ae', C: '#56b58c', D: '#5fae90' },
  lavender: { B: '#c9b6e4', S: '#a894c9', C: '#8f6fc0', D: '#9a7fc4' },
  peach:    { B: '#ffd3a5', S: '#e6b482', C: '#f08c5a', D: '#d99a66' },
  sky:      { B: '#a5d8ff', S: '#7fb8e6', C: '#5a9cf0', D: '#6fa8dd' },
  lemon:    { B: '#fff3a5', S: '#e6d67f', C: '#e6b800', D: '#d4bd55' },
  cream:    { B: '#f5e9d7', S: '#dcc9ac', C: '#d9a066', D: '#c9b190' },
  taupe:    { B: '#cbb8a9', S: '#a9927f', C: '#8f7261', D: '#9c8471' },
}
