// ─────────────────────────────────────────────────────────────────
//  Sincroniza dados que vivem no navegador (aparência/escritório e
//  modelos de documento) com o backend — por escritório (tenant).
//  Assim eles sincronizam entre computadores e ficam isolados.
// ─────────────────────────────────────────────────────────────────
import api from './api'
import { tkey } from './tenant'

const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* quota */ } }

// Baixa office + modelos do banco e grava no cache local do tenant atual.
export async function hydrateTenantData() {
  try {
    const office = await api.settings.office()
    if (office && typeof office === 'object') lsSet(tkey('pj_local_office'), office)
  } catch { /* offline: mantém cache */ }
  try {
    const tpls = await api.settings.templates()
    if (Array.isArray(tpls)) lsSet(tkey('pj_peticoes'), tpls)
  } catch { /* offline: mantém cache */ }
}

// Salva a lista de modelos no banco (write-through). Fire-and-forget.
export function pushTemplates(list) {
  api.settings.saveTemplates(Array.isArray(list) ? list : []).catch(() => {})
}

// Salva os dados do escritório no banco (write-through). Fire-and-forget.
export function pushOffice(data) {
  api.settings.saveOffice(data ?? {}).catch(() => {})
}
