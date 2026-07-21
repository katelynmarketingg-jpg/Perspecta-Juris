import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'

// Retorna a lista de abas (paths) que o usuário pode acessar.
// null = acesso total (admin/master, ou usuário sem restrição definida).
export function menuAccessFor(tenant, userId, role) {
  if (role === 'admin' || role === 'master') return null
  const list = tenant?.settings?.permissions?.[userId]
  return Array.isArray(list) ? list : null
}

// Define/limpa as permissões de abas de um usuário (guardadas em settings.permissions do tenant).
export async function setMenuAccess(tenantId, userId, list) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!t) return
  const settings = { ...(t.settings ?? {}) }
  const permissions = { ...(settings.permissions ?? {}) }
  if (Array.isArray(list)) {
    permissions[userId] = [...new Set(list.map(String))]
  } else {
    delete permissions[userId] // null/undefined = acesso total
  }
  settings.permissions = permissions
  await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, tenantId))
}
