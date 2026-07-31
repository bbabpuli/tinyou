import { useEffect, useRef } from 'react'
import { composeAvatar } from '../game/avatarV2/compose'
import { PALETTES, type PaletteKey } from '../game/avatarV2/palettes'
import { REGISTERED_SPECIES } from '../game/avatarV2/species'
import { drawPixelMap } from '../game/sprite'

function Cell({ speciesIdx, palette, variant }: { speciesIdx: number; palette: PaletteKey; variant: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 32, 32)
    const sp = REGISTERED_SPECIES[speciesIdx]
    const { map, palette: colors } = composeAvatar(sp, palette, {
      eyes: variant, mouth: variant, cheeks: variant, accessory: variant,
    })
    drawPixelMap(ctx, map, colors, 0, 0, 1)
  }, [speciesIdx, palette, variant])
  return <canvas ref={ref} width={32} height={32} style={{ width: 96, imageRendering: 'pixelated' }} />
}

export function AvatarGallery() {
  const paletteKeys = Object.keys(PALETTES) as PaletteKey[]
  return (
    <main style={{ padding: 16 }}>
      {REGISTERED_SPECIES.map((sp, si) => (
        <section key={sp.key}>
          <h3 style={{ fontFamily: 'monospace' }}>{sp.key}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {paletteKeys.map((pk) =>
              [0, 1, 2, 3, 4].map((v) => <Cell key={`${pk}-${v}`} speciesIdx={si} palette={pk} variant={v} />),
            )}
          </div>
        </section>
      ))}
    </main>
  )
}
