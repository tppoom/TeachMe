import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../crypto'

describe('encrypt / decrypt', () => {
  it('round-trips a string', () => {
    const secret = 'sk-ant-test-key-12345'
    const encrypted = encrypt(secret)
    expect(decrypt(encrypted)).toBe(secret)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const a = encrypt('same-input')
    const b = encrypt('same-input')
    expect(a).not.toBe(b)
  })

  it('encrypted value does not contain the original plaintext', () => {
    const key = 'sk-ant-secret'
    expect(encrypt(key)).not.toContain(key)
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('original')
    const tampered = encrypted.slice(0, -4) + 'XXXX'
    expect(() => decrypt(tampered)).toThrow()
  })
})
