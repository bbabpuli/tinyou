import { SpeechBubble } from './SpeechBubble'
import { IconGear, IconHeart, IconMail, IconMoon, IconRice } from './icons'
import { Shell } from './shell/Shell'
import { DEFAULT_SHELL } from './shell/shellTheme'

/** 개발용 아이콘 프리뷰 (?icons) — 실제 셸/LCD/말풍선 환경에서 아이콘을 눈으로 검증한다. AvatarGallery(?gallery)와 같은 성격. */
export function IconPreview() {
  return (
    <Shell theme={DEFAULT_SHELL}>
      <div className="lcd" style={{ padding: 12, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <IconRice size={26} />
          <IconHeart size={26} />
          <IconMoon size={26} />
          <IconMail size={15} />
          <IconGear size={15} />
          <img src="/icons/anger-noto.svg" width={34} height={34} alt="화남" />
        </div>
        <div style={{ position: 'relative', height: 140 }}>
          {/* 실제 화남 말풍선과 동일한 마크업 */}
          <SpeechBubble x={150} y={120} onClose={() => {}}>
            <img
              src="/icons/anger-noto.svg"
              width={34}
              height={34}
              alt="너무 많이 쓰다듬어서 화남"
              style={{ display: 'block' }}
            />
          </SpeechBubble>
        </div>
      </div>
    </Shell>
  )
}
