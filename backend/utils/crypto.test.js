const { encrypt, decrypt } = require('./crypto')

describe('crypto utils', () => {
  it('encrypts text and returns encrypted, key, iv, tag', () => {
    const result = encrypt('hello world')
    expect(result).toHaveProperty('encrypted')
    expect(result).toHaveProperty('key')
    expect(result).toHaveProperty('iv')
    expect(result).toHaveProperty('tag')
    expect(typeof result.encrypted).toBe('string')
    expect(typeof result.key).toBe('string')
  })

  it('decrypts ciphertext back to original plaintext', () => {
    const plain = 'super secret value'
    const { encrypted, key, iv, tag } = encrypt(plain)
    const decrypted = decrypt(encrypted, key, iv, tag)
    expect(decrypted).toBe(plain)
  })

  it('produces different ciphertext on each encrypt call', () => {
    const text = 'same input'
    const a = encrypt(text)
    const b = encrypt(text)
    expect(a.encrypted).not.toBe(b.encrypted)
    expect(a.key).not.toBe(b.key)
    expect(a.iv).not.toBe(b.iv)
  })

  it('throws when decrypting with a wrong key', () => {
    const { encrypted, iv, tag } = encrypt('secret')
    const wrongKey = '0'.repeat(64) // 32 bytes as hex
    expect(() => decrypt(encrypted, wrongKey, iv, tag)).toThrow()
  })

  it('throws when decrypting with a wrong tag', () => {
    const { encrypted, key, iv } = encrypt('secret')
    const wrongTag = '0'.repeat(32)
    expect(() => decrypt(encrypted, key, iv, wrongTag)).toThrow()
  })

  it('handles empty string', () => {
    const { encrypted, key, iv, tag } = encrypt('')
    const decrypted = decrypt(encrypted, key, iv, tag)
    expect(decrypted).toBe('')
  })

  it('handles unicode text', () => {
    const text = '🔐 café résumé'
    const { encrypted, key, iv, tag } = encrypt(text)
    const decrypted = decrypt(encrypted, key, iv, tag)
    expect(decrypted).toBe(text)
  })
})
