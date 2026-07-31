import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'fs'

const SCRATCH = process.env.TMPDIR ?? '/tmp'
const OUT = `${SCRATCH}/e2e3-shots`
mkdirSync(OUT, { recursive: true })

const URL_BASE = 'https://hhdspjlnxgcwpbughsdb.supabase.co'
const REF = 'hhdspjlnxgcwpbughsdb'
// 서비스롤 키는 환경변수로 주입한다 (절대 커밋 금지): TINYOU_SR_KEY=... node <script>
const SR_KEY = (process.env.TINYOU_SR_KEY ?? '').trim()
if (!SR_KEY) throw new Error('TINYOU_SR_KEY 환경변수가 필요합니다 (Supabase service_role 키)')
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZHNwamxueGdjd3BidWdoc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODE5ODUsImV4cCI6MjEwMDk1Nzk4NX0.gcs-Kyr1Ul2dpcxeZUit-54VU4bVSE-uhjSPFPUByc8'
const APP = 'http://localhost:5173'
const PASS = 'tinyou-e2e-Passw0rd!'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(path, opts = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    ...opts,
    headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function purgeUserData(uid) {
  const prof = await api(`/rest/v1/profiles?user_id=eq.${uid}&select=couple_id`)
  const coupleId = prof.body?.[0]?.couple_id
  await api(`/rest/v1/care_actions?user_id=eq.${uid}`, { method: 'DELETE' })
  if (coupleId) {
    const chars = await api(`/rest/v1/characters?couple_id=eq.${coupleId}&select=id`)
    for (const c of chars.body ?? []) await api(`/rest/v1/care_actions?character_id=eq.${c.id}`, { method: 'DELETE' })
    await api(`/rest/v1/messages?couple_id=eq.${coupleId}`, { method: 'DELETE' })
    await api(`/rest/v1/characters?couple_id=eq.${coupleId}`, { method: 'DELETE' })
    await api(`/rest/v1/profiles?couple_id=eq.${coupleId}`, { method: 'DELETE' })
    await api(`/rest/v1/couples?id=eq.${coupleId}`, { method: 'DELETE' })
  } else {
    await api(`/rest/v1/profiles?user_id=eq.${uid}`, { method: 'DELETE' })
  }
}

async function freshUser(email) {
  const list = await api(`/auth/v1/admin/users?page=1&per_page=100`)
  const found = (list.body?.users ?? []).find((u) => u.email === email)
  if (found) {
    await purgeUserData(found.id)
    const del = await api(`/auth/v1/admin/users/${found.id}`, { method: 'DELETE' })
    if (del.status >= 400) throw new Error(`user delete failed: ${JSON.stringify(del)}`)
  }
  const created = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASS, email_confirm: true }),
  })
  if (!created.body?.id) throw new Error(`user create failed: ${JSON.stringify(created)}`)
  return created.body.id
}

async function signIn(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  })
  const s = await res.json()
  if (!s.access_token) throw new Error(`signin failed: ${JSON.stringify(s)}`)
  return s
}

console.log('== 준비: 테스트 계정 ==')
await freshUser('p3a@tinyou-e2e.test')
await freshUser('p3b@tinyou-e2e.test')
const sessA = await signIn('p3a@tinyou-e2e.test')
const sessB = await signIn('p3b@tinyou-e2e.test')
console.log('USERS_OK')

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
})
const errors = { A: [], B: [] }
async function newPage(session, tag) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') errors[tag].push(m.text()) })
  page.on('pageerror', (e) => errors[tag].push(String(e)))
  await page.setViewport({ width: 480, height: 950 })
  await page.evaluateOnNewDocument((k, s) => localStorage.setItem(k, JSON.stringify(s)), `sb-${REF}-auth-token`, session)
  await page.goto(APP, { waitUntil: 'networkidle0' })
  return page
}
const waitText = (page, text, ms = 20000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, text)
const clickByText = async (page, text) => {
  const ok = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t))
    if (btn && !btn.disabled) { btn.click(); return true }
    return false
  }, text)
  if (!ok) throw new Error(`button not clickable: ${text}`)
}
const typeInto = async (page, sel, val) => {
  await page.waitForSelector(sel)
  await page.click(sel, { clickCount: 3 })
  await page.type(sel, val)
}
// 캐릭터 위치: canvas의 어두운 외곽선 픽셀 bbox 중심 (CSS 좌표로 변환)
async function findCharacter(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const ctx = canvas.getContext('2d')
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
    for (let p = 0; p < data.length; p += 4) {
      const [r, g, b] = [data[p], data[p + 1], data[p + 2]]
      if (r < 100 && g < 100 && b < 100 && data[p + 3] > 200) {
        const x = (p / 4) % width, y = Math.floor(p / 4 / width)
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
    if (maxX < 0) return null
    const rect = canvas.getBoundingClientRect()
    const sx = rect.width / canvas.width
    return {
      cssX: rect.left + ((minX + maxX) / 2) * sx,
      cssY: rect.top + ((minY + maxY) / 2) * sx,
      bodyColors: (() => {
        const counts = {}
        for (let p = 0; p < data.length; p += 4) {
          if (data[p + 3] > 200) {
            const hex = '#' + [data[p], data[p + 1], data[p + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
            counts[hex] = (counts[hex] ?? 0) + 1
          }
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([h]) => h)
      })(),
    }
  })
}

console.log('== A: 둥지 → B 합류 ==')
const pageA = await newPage(sessA, 'A')
await waitText(pageA, '둥지 만들기')
await typeInto(pageA, 'input[placeholder="내 닉네임"]', '동은')
await clickByText(pageA, '새 둥지 만들기')
await waitText(pageA, '연인에게 이 코드를')
await pageA.waitForFunction(() => /^\d{6}$/.test(document.querySelector('strong')?.textContent?.trim() ?? ''), { timeout: 15000 })
const code = await pageA.evaluate(() => document.querySelector('strong').textContent.trim())
const pageB = await newPage(sessB, 'B')
await waitText(pageB, '둥지 만들기')
await typeInto(pageB, 'input[placeholder="내 닉네임"]', '나리')
await clickByText(pageB, '초대 코드로 합류')
await typeInto(pageB, 'input[placeholder="6자리 코드"]', code)
await clickByText(pageB, '합류하기')
await waitText(pageB, '연인을 들려주세요')
console.log('== Realtime: A 대기화면 자동 진행 확인 (버튼 클릭 없이) ==')
await pageA.waitForFunction(() => document.body.innerText.includes('연인을 들려주세요'), { timeout: 15000 })
  .then(() => console.log('A_AUTO_ADVANCE: OK (Realtime)'))
  .catch(async () => { console.log('A_AUTO_ADVANCE: 실패 → 수동 버튼 폴백'); await clickByText(pageA, '들어왔는지 확인'); await waitText(pageA, '연인을 들려주세요') })

console.log('== A: 노란 햄스터 생성 ==')
const answersA = ['웃음이 많은 사람', '볼이 빵빵한 햄스터', '햇살 같은 노란색', '눈 비비는 모습']
const tas = await pageA.$$('textarea')
for (let i = 0; i < tas.length; i++) { await tas[i].click(); await tas[i].type(answersA[i]) }
await clickByText(pageA, '분신 만나러 가기')
await waitText(pageA, '다시 뽑기')
await pageA.screenshot({ path: `${OUT}/1-A-preview.png` })
const prev1 = await pageA.$eval('canvas', (c) => c.toDataURL())
await clickByText(pageA, '다시 뽑기')
await sleep(300)
const prev2 = await pageA.$eval('canvas', (c) => c.toDataURL())
console.log('REROLL_CHANGED:', prev1 !== prev2)
await typeInto(pageA, 'input[placeholder="이름 지어주기"]', '노랑쓰')
await clickByText(pageA, '이 아이로 할래요')
await waitText(pageA, '밥 주기', 25000)
await sleep(1500)
const charA = await findCharacter(pageA)
console.log('A_STAGE_COLORS(상위6):', JSON.stringify(charA?.bodyColors))
console.log('LEMON_PRESENT:', charA?.bodyColors?.some((h) => h === '#fff3a5') ?? false)
await pageA.screenshot({ path: `${OUT}/2-A-stage.png` })

console.log('== B: 생성 (개구리·민트) ==')
const answersB = ['차분한 사람', '청개구리 같음', '민트색', '요리할 때 콧노래']
const tbs = await pageB.$$('textarea')
for (let i = 0; i < tbs.length; i++) { await tbs[i].click(); await tbs[i].type(answersB[i]) }
await clickByText(pageB, '분신 만나러 가기')
await waitText(pageB, '다시 뽑기')
await typeInto(pageB, 'input[placeholder="이름 지어주기"]', '개굴이')
await clickByText(pageB, '이 아이로 할래요')
await waitText(pageB, '밥 주기', 25000)
await sleep(1200)

console.log('== A→B 쪽지 배달 (Realtime) ==')
const NOTE = '오늘도 사랑해 우리 개굴이 잘 부탁해'
await typeInto(pageA, 'input[placeholder="분신에게 전할 마음을 적어주세요"]', NOTE)
await pageA.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')]
  const noteInput = inputs.find((i) => i.placeholder.includes('분신에게'))
  const btn = noteInput.parentElement.querySelector('button') ?? noteInput.closest('div').querySelector('button')
  btn.click()
})
await sleep(4000) // Realtime 전파 대기
const charB1 = await findCharacter(pageB)
await pageB.screenshot({ path: `${OUT}/3-B-envelope.png` })
if (!charB1) throw new Error('B 캐릭터 미발견')
await pageB.mouse.click(charB1.cssX, charB1.cssY)
await waitText(pageB, NOTE, 10000)
console.log('BUBBLE_TEXT: OK (말풍선에 쪽지 내용)')
await pageB.screenshot({ path: `${OUT}/4-B-bubble.png` })
await pageB.evaluate((t) => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent === t && d.style.position === 'absolute')
  ;(el ?? [...document.querySelectorAll('div')].find((d) => d.textContent.includes(t))).click()
}, NOTE)
await sleep(2500)
const msgs = await api(`/rest/v1/messages?select=body,read_at`)
console.log('DB_MSG_READ:', JSON.stringify(msgs.body?.map((m) => ({ read: !!m.read_at }))))

console.log('== 흔적 토스트: A 돌봄 → B 리로드 ==')
await clickByText(pageA, '밥 주기')
await sleep(1500)
await pageB.reload({ waitUntil: 'networkidle0' })
await waitText(pageB, '다녀갔', 20000).then(() => console.log('TRACE_TOAST: OK')).catch(() => console.log('TRACE_TOAST: 미표시!!'))
await pageB.screenshot({ path: `${OUT}/5-B-trace.png` })

console.log('== 쪽지함 ==')
await clickByText(pageB, '쪽지함')
await waitText(pageB, NOTE, 5000)
console.log('INBOX: OK')

console.log('== B→A 쪽지 (먼저 구독한 A의 수신 — 토픽 픽스 검증) ==')
const NOTE2 = '고마워 나도 사랑해'
await typeInto(pageB, 'input[placeholder="분신에게 전할 마음을 적어주세요"]', NOTE2)
await pageB.evaluate(() => {
  const noteInput = [...document.querySelectorAll('input')].find((i) => i.placeholder.includes('분신에게'))
  const btn = noteInput.parentElement.querySelector('button') ?? noteInput.closest('div').querySelector('button')
  btn.click()
})
await sleep(5000)
const charA2 = await findCharacter(pageA)
if (!charA2) throw new Error('A 캐릭터 미발견')
await pageA.mouse.click(charA2.cssX, charA2.cssY)
await waitText(pageA, NOTE2, 10000)
  .then(() => console.log('A_RECEIVES_REALTIME: OK (먼저 구독자 수신 성공)'))
  .catch(() => console.log('A_RECEIVES_REALTIME: 실패!!'))
await pageA.screenshot({ path: `${OUT}/6-A-bubble.png` })
await pageA.evaluate((t) => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent === t && d.style.position === 'absolute')
  ;(el ?? [...document.querySelectorAll('div')].find((d) => d.textContent.includes(t)))?.click()
}, NOTE2)
await sleep(1500)

console.log('== 단장 플로우 (A) ==')
const charsRes = await api(`/rest/v1/characters?select=id,name&order=created_at.desc`)
const aCharRow = charsRes.body.find((c) => c.name === '노랑쓰')
if (!aCharRow) throw new Error('노랑쓰 캐릭터 미발견')
await api(`/rest/v1/characters?id=eq.${aCharRow.id}`, { method: 'PATCH', body: JSON.stringify({ regen_count: 0 }) })
await pageA.reload({ waitUntil: 'networkidle0' })
await waitText(pageA, '단장하고 싶어해요', 15000)
console.log('REDECOR_BANNER: OK')
await clickByText(pageA, '단장')
await waitText(pageA, '나중에 할래요', 10000)
await clickByText(pageA, '나중에 할래요')
await waitText(pageA, '밥 주기', 10000)
console.log('REDECOR_CANCEL: OK (스테이지 복귀)')
await clickByText(pageA, '단장')
await waitText(pageA, '연인을 들려주세요', 10000)
const tas2 = await pageA.$$('textarea')
const answersA2 = ['여전히 웃음 많은', '볼 빵빵 햄스터', '노란색', '귀여움']
for (let i = 0; i < tas2.length; i++) { await tas2[i].click(); await tas2[i].type(answersA2[i]) }
await clickByText(pageA, '분신 만나러 가기')
await waitText(pageA, '다시 뽑기')
await typeInto(pageA, 'input[placeholder="이름 지어주기"]', '노랑쓰')
await clickByText(pageA, '이 아이로 할래요')
await waitText(pageA, '밥 주기', 25000)
const noBanner = await pageA.evaluate(() => !document.body.innerText.includes('단장하고 싶어해요'))
console.log('REDECOR_DONE_BANNER_GONE:', noBanner)
await pageA.screenshot({ path: `${OUT}/7-A-redecorated.png` })

console.log('== 로그아웃 (A) ==')
pageA.on('dialog', (d) => d.accept())
await pageA.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('⚙️')).click())
await sleep(500)
await pageA.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('로그아웃')); if (b) b.click() })
await waitText(pageA, '어서오세요', 10000).then(() => console.log('LOGOUT: OK')).catch(() => console.log('LOGOUT: 로그인 화면 미도달'))

console.log('CONSOLE_ERRORS_A:', errors.A.length ? errors.A.slice(0, 3) : 'none')
console.log('CONSOLE_ERRORS_B:', errors.B.length ? errors.B.slice(0, 3) : 'none')
await browser.close()
console.log('E2E3_DONE')
