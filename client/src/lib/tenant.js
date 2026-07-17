// ─────────────────────────────────────────────────────────────────────────
//  Identidade do escritório logado (tenant) no lado do cliente.
//  Usado para escopar dados por empresa — garante que cada escritório
//  começa do zero e nunca enxerga dados de outro (timbrado, histórico, etc.).
// ─────────────────────────────────────────────────────────────────────────
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export function currentTenantId() {
  const s = lsGet('pj_session', null)
  if (s?.tenantId) return s.tenantId
  const a = lsGet('pj_auth', null)
  return a?.state?.tenant?.id ?? a?.state?.user?.tenantId ?? 'tenant_demo'
}

// Chave de localStorage escopada pelo tenant atual.
export const tkey = (base) => `${base}__${currentTenantId()}`

// ── Dados do escritório (timbrado, banco, PIX…) — por tenant ────────
// Lê a chave do tenant; o escritório demo herda a chave global antiga (migração única).
export function getOffice() {
  const scoped = lsGet(tkey('pj_local_office'), null)
  if (scoped) return scoped
  if (currentTenantId() === 'tenant_demo') {
    const legacy = lsGet('pj_local_office', null)
    if (legacy) { lsSet(tkey('pj_local_office'), legacy); return legacy }
  }
  return {}
}

export function setOffice(data) { lsSet(tkey('pj_local_office'), data) }
