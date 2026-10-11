// Profile pictures. Whatever is uploaded is decoded and re-encoded here, so
// only a 256×256 WebP made by this server is ever stored or served.
import crypto from 'node:crypto';
import fs from 'node:fs';
import sharp from 'sharp';
import { dataPath } from './config.ts';

export const AVATAR_SIZE = 256;
/** Largest upload accepted. The page shrinks images before sending, so real uploads are far smaller. */
export const MAX_UPLOAD_BYTES = 512 * 1024;

const isImage = (b: Buffer) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // JPEG
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || // PNG
  (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP');

export const avatarFile = (sha: string) => dataPath('avatars', `${sha}.webp`);

/** Store an uploaded picture and return its content hash. Throws a message suitable for showing to the user. */
export async function saveAvatar(upload: Buffer): Promise<string> {
  if (upload.length === 0) throw new Error('没有收到图片');
  if (upload.length > MAX_UPLOAD_BYTES) throw new Error('图片太大了');
  if (!isImage(upload)) throw new Error('只支持 JPEG、PNG 或 WebP 图片');
  let out: Buffer;
  try {
    // limitInputPixels guards against small files that decode into enormous images.
    out = await sharp(upload, { limitInputPixels: 16_000_000, pages: 1 })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new Error('这张图片无法处理，请换一张');
  }
  const sha = crypto.createHash('sha256').update(out).digest('hex');
  fs.mkdirSync(dataPath('avatars'), { recursive: true });
  if (!fs.existsSync(avatarFile(sha))) fs.writeFileSync(avatarFile(sha), out);
  return sha;
}