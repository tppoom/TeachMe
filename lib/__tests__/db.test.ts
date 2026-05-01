import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function () {
    return { $connect: vi.fn() }
  }),
}))

describe('db singleton', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (globalThis as Record<string, unknown>).prisma
  })

  it('exports a db object', async () => {
    const { db } = await import('../db')
    expect(db).toBeDefined()
  })

  it('returns the same instance on repeated imports', async () => {
    const { db: db1 } = await import('../db')
    const { db: db2 } = await import('../db')
    expect(db1).toBe(db2)
  })
})
