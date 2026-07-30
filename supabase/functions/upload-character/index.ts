import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_UPLOADS = 4 // 확정(업로드) 한도 — 로컬 미리보기는 무제한
const MAX_BYTES = 32 * 1024
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'UNAUTHORIZED' })

  const { imageBase64, name } = (await req.json()) as { imageBase64?: string; name?: string }
  if (!imageBase64 || !name?.trim()) return json(400, { error: 'BAD_REQUEST' })

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
  } catch {
    return json(400, { error: 'BAD_REQUEST' })
  }
  if (bytes.length > MAX_BYTES) return json(413, { error: 'IMAGE_TOO_LARGE' })
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return json(415, { error: 'NOT_PNG' })

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: me } = await admin
    .from('profiles').select('couple_id').eq('user_id', user.id).single()
  if (!me?.couple_id) return json(403, { error: 'NO_COUPLE' })
  const { data: partner } = await admin
    .from('profiles').select('user_id')
    .eq('couple_id', me.couple_id).neq('user_id', user.id).maybeSingle()
  if (!partner) return json(403, { error: 'PARTNER_NOT_JOINED' })

  const { data: existing } = await admin
    .from('characters').select('id, regen_count')
    .eq('couple_id', me.couple_id).eq('owner_user_id', user.id).maybeSingle()
  const used = existing?.regen_count ?? 0
  if (used >= MAX_UPLOADS) return json(429, { error: 'GENERATION_LIMIT' })

  const characterId = existing?.id ?? crypto.randomUUID()
  const imagePath = `${characterId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await admin.storage
    .from('characters')
    .upload(imagePath, bytes, { contentType: 'image/png' })
  if (uploadError) {
    console.error('upload error', uploadError)
    return json(502, { error: 'UPLOAD_FAILED' })
  }

  const { error: upsertError } = await admin.from('characters').upsert({
    id: characterId,
    couple_id: me.couple_id,
    owner_user_id: user.id,
    subject_user_id: partner.user_id,
    name: name.trim(),
    image_path: imagePath,
    regen_count: used + 1,
  })
  if (upsertError) {
    console.error('upsert error', upsertError)
    return json(502, { error: 'SAVE_FAILED' })
  }

  const { data: pub } = admin.storage.from('characters').getPublicUrl(imagePath)
  return json(200, { imageUrl: pub.publicUrl })
})
