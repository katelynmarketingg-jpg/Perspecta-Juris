import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users } from '../db/schema.js'

// Planos padrão — a admin pode renomear e mudar os limites na aba "Planos".
// maxUsers = null  →  ilimitado.
export const DEFAULT_PLANS = [
  { key: 'starter',      name: 'Starter',      maxUsers: 2 },
  { key: 'professional', name: 'Profissional', maxUsers: 5 },
  { key: 'enterprise',   name: 'Enterprise',   maxUsers: null },
]

async function masterTenant() {
  const [m] = await db.select().from(tenants).where(eq(tenants.plan, 'master')).limit(1)
  return m ?? null
}

// Lê a definição de planos (guardada em settings.plans da empresa master).
export async function getPlans() {
  const m = await masterTenant()
  const plans = m?.settings?.plans
  return Array.isArray(plans) && plans.length ? plans : DEFAULT_PLANS
}

// Salva a definição de planos.
export async function savePlans(rawPlans) {
  const m = await masterTenant()
  if (!m) throw new Error('Empresa master não encontrada.')
  // Normaliza/sanitiza cada plano.
  const plans = (Array.isArray(rawPlans) ? rawPlans : [])
    .map(p => ({
      key:  String(p.key ?? p.name ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('plano-' + Math.random().toString(36).slice(2, 7)),
      name: String(p.name ?? 'Plano').trim() || 'Plano',
      maxUsers: (p.maxUsers === null || p.maxUsers === '' || p.maxUsers === undefined)
        ? null
        : Math.max(1, parseInt(p.maxUsers, 10) || 1),
    }))
  const settings = { ...(m.settings ?? {}), plans }
  await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, m.id))
  return plans
}

// Limite de acessos do plano de um tenant. null = ilimitado.
export async function planLimitFor(tenant) {
  if (!tenant) return null
  const plans = await getPlans()
  const plan = plans.find(p => p.key === tenant.plan)
  return plan ? (plan.maxUsers ?? null) : null
}

// Quantos usuários o tenant já tem.
export async function userCount(tenantId) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.tenantId, tenantId))
  return rows.length
}
