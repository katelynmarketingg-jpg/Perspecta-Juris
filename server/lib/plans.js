import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users } from '../db/schema.js'

// Planos padrão — a admin pode renomear e mudar os limites na aba "Planos".
// maxUsers = null  →  ilimitado.
// price = mensalidade de tabela, em reais. null = ainda não definida — o
// sistema não inventa preço, e o painel mostra "a definir" até alguém dizer.
export const DEFAULT_PLANS = [
  { key: 'starter',      name: 'Starter',      maxUsers: 2,    price: null },
  { key: 'professional', name: 'Profissional', maxUsers: 5,    price: null },
  { key: 'enterprise',   name: 'Enterprise',   maxUsers: null, price: null },
]

// Sem ORDER BY, o Postgres não promete QUAL linha volta num limit(1). Com
// mais de uma empresa master (acontece nos testes, e aconteceria numa
// migração malfeita), ler e gravar podiam cair em linhas diferentes: os
// planos salvos sumiam na leitura seguinte. Ordenar torna isso determinístico.
async function masterTenant() {
  const [m] = await db.select().from(tenants).where(eq(tenants.plan, 'master'))
    .orderBy(tenants.createdAt, tenants.id).limit(1)
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
      price: (p.price === null || p.price === '' || p.price === undefined || !Number.isFinite(Number(p.price)))
        ? null
        : Math.max(0, Number(p.price)),
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
