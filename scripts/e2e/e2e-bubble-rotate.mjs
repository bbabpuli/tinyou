// 말풍선 자동 회전 표적 검증 — e2e-plan3.mjs가 만든 p3a/p3b 커플 재사용
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'

const SCRATCH = process.env.TMPDIR ?? '/tmp'
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
    headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers ?? {}) },
  })
  return { status: res.status, body: await res.json().catch(() => null) }
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

// 준비: B 수신자, A 발신자. 기존 미읽음 정리 후 3통 삽입
const sessB = await signIn('p3b@tinyou-e2e.test')
const bUid = sessB.user.id
const prof = await api(`/rest/v1/profiles?user_id=eq.${bUid}&select=couple_id`)
const coupleId = prof.body?.[0]?.couple_id
if (!coupleId) throw new Error('커플 미발견 — e2e-plan3를 먼저 실행')
const others = await api(`/rest/v1/profiles?couple_id=eq.${coupleId}&user_id=neq.${bUid}&select=user_id`)
const aUid = others.body?.[0]?.user_id
await api(`/rest/v1/messages?couple_id=eq.${coupleId}`, { method: 'DELETE' })
const NOTES = ['회전1번쪽지', '회전2번쪽지', '회전3번쪽지']
for (const [i, body] of NOTES.entries()) {
  const r = await api('/rest/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ couple_id: coupleId, sender_user_id: aUid, body, created_at: new Date(Date.now() - (3 - i) * 60000).toISOString() }),
  })
  if (r.status >= 400) throw new Error(`insert failed: ${JSON.stringify(r)}`)
}
console.log('SEED_OK: 미읽음 3통')

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
})
const page = await (await browser.createBrowserContext()).newPage()
await page.setViewport({ width: 480, height: 950 })
await page.evaluateOnNewDocument((k, s) => localStorage.setItem(k, JSON.stringify(s)), `sb-${REF}-auth-token`, sessB)
await page.goto(APP, { waitUntil: 'networkidle0' })
const waitText = (t, ms = 20000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t)
await waitText('밥 주기')

// 자동 오픈: 탭 없이 말풍선 1번이 스스로 떠야 한다
await waitText(NOTES[0], 10000)
console.log('AUTO_OPEN: OK (탭 없이 1번 쪽지 표시)')

// 봉투는 제거됨(2026-07-31) — 배달 중에도 캔버스에 봉투색(#fff8e7)이 없어야 한다
const hasEnvelope = () => page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  for (let p = 0; p < data.length; p += 4) {
    if (data[p] === 0xff && data[p + 1] === 0xf8 && data[p + 2] === 0xe7 && data[p + 3] > 200) return true
  }
  return false
})
console.log('NO_ENVELOPE_DURING:', !(await hasEnvelope()) ? 'OK (배달 중에도 봉투 없음)' : '실패!! 봉투 표시됨')

// 4초 후 자동으로 2번 쪽지로
await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 7000 }, NOTES[1])
const gone1 = await page.evaluate((t) => !document.body.innerText.includes(t), NOTES[0])
console.log('ROTATE_2:', gone1 ? 'OK (2번 표시, 1번 사라짐)' : '실패!! 1번이 아직 표시됨')

// 또 4초 후 3번 쪽지로
await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 7000 }, NOTES[2])
console.log('ROTATE_3: OK (3번 쪽지 표시)')
await page.screenshot({ path: `${SCRATCH}/e2e3-shots/rotate-3rd.png` })

// 마지막 쪽지는 유지되다가 클릭으로 닫힘
await sleep(5000)
const still3 = await page.evaluate((t) => document.body.innerText.includes(t), NOTES[2])
console.log('LAST_STAYS:', still3 ? 'OK (마지막 쪽지 클릭까지 유지)' : '실패!! 마지막 쪽지가 사라짐')
await page.evaluate((t) => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent.includes(t) && d.style.position === 'absolute')
  el?.click()
}, NOTES[2])
await sleep(2000)
const bubbleGone = await page.evaluate((t) => !document.body.innerText.includes(t), NOTES[2])
console.log('CLICK_CLOSES:', bubbleGone ? 'OK (클릭으로 말풍선 닫힘)' : '실패!!')

console.log('NO_ENVELOPE_AFTER:', !(await hasEnvelope()) ? 'OK (읽은 후에도 봉투 없음)' : '실패!! 봉투 표시됨')

const msgs = await api(`/rest/v1/messages?couple_id=eq.${coupleId}&select=body,read_at&order=created_at`)
console.log('DB_READ_FLAGS:', JSON.stringify(msgs.body?.map((m) => ({ body: m.body, read: !!m.read_at }))))

await browser.close()
console.log('E2E_ROTATE_DONE')
