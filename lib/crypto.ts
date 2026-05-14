import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * AES-256-GCM at-rest encryption for user-provided API keys persisted in the
 * Config table. The master key is derived from `ENCRYPTION_SECRET` (env) so
 * the same DB file is portable across machines if the secret travels with it.
 *
 * If `ENCRYPTION_SECRET` is unset, we fall back to a stable per-install secret
 * derived from the working directory — good enough for a self-hosted single-
 * user app, and avoids forcing setup before the app boots.
 */

const ALGO = 'aes-256-gcm' as const
const IV_LEN = 12
const TAG_LEN = 16
const SALT = Buffer.from('teachme-key-store-v1')

function masterKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || `teachme-${process.cwd()}`
  return scryptSync(secret, SALT, 32)
}

export function encryptString(plain: string): string {
  if (!plain) return ''
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, masterKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Layout: iv | tag | ciphertext, all base64url
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function decryptString(blob: string): string {
  if (!blob) return ''
  try {
    const buf = Buffer.from(blob, 'base64url')
    if (buf.length < IV_LEN + TAG_LEN + 1) return ''
    const iv = buf.subarray(0, IV_LEN)
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const ct = buf.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, masterKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}
