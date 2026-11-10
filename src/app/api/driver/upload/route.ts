import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireDriver } from '@/lib/auth';
import { createSupabaseAdmin, RECEIPTS_BUCKET } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

/** Envia a foto do recibo para o bucket PRIVADO 'receipts', em uma pasta com o id do usuário. */
export async function POST(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
  if (!EXT[file.type]) return NextResponse.json({ error: 'Envie uma imagem (JPG, PNG, WEBP ou HEIC).' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Imagem acima de 8 MB.' }, { status: 413 });

  const admin = createSupabaseAdmin();
  // Cria o bucket privado na primeira vez (erro "já existe" é ignorado).
  await admin.storage.createBucket(RECEIPTS_BUCKET, { public: false, fileSizeLimit: MAX_BYTES }).catch(() => null);

  const path = `${guard.profile.id}/${randomUUID()}.${EXT[file.type]}`;
  const { error } = await admin.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Falha ao enviar a imagem.' }, { status: 500 });
  }
  return NextResponse.json({ path });
}
