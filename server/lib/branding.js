import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'

// A marca do SISTEMA (logo, favicon, cor) é global — guardada no tenant master.
async function masterTenant() {
  const [m] = await db.select().from(tenants).where(eq(tenants.plan, 'master')).limit(1)
  return m ?? null
}

export async function getBranding() {
  const m = await masterTenant()
  return m?.settings?.branding ?? {}
}

export async function setBranding(data) {
  const m = await masterTenant()
  if (!m) throw new Error('Empresa master não encontrada.')
  const branding = (data && typeof data === 'object') ? data : {}
  const settings = { ...(m.settings ?? {}), branding }
  await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, m.id))
  return branding
}
