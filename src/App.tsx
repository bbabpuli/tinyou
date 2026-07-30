import { CareButtons } from './ui/CareButtons'
import { Hud } from './ui/Hud'
import { Stage } from './ui/Stage'

export function App() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <h1 style={{ fontFamily: 'monospace', textAlign: 'center' }}>Tinyou</h1>
      <Stage />
      <Hud />
      <CareButtons />
    </main>
  )
}
