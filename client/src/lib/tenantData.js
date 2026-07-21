// ─────────────────────────────────────────────────────────────────
//  Sincroniza dados que vivem no navegador (aparência/escritório e
//  modelos de documento) com o backend — por escritório (tenant).
//  Assim eles sincronizam entre computadores e ficam isolados.
// ─────────────────────────────────────────────────────────────────
import api from './api'
import { tkey } from './tenant'

const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* quota */ } }
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }

// Configurações do escritório que ficavam só no navegador (e sem separação
// por empresa): áreas, serviços e tipos de honorário.
export const CONFIG_KEYS = ['pj_local_areas', 'pj_local_services', 'pj_local_fee_types']

// Configurações simples (texto) que também ficavam soltas no navegador:
// OAB, UF, nome do advogado, chave do DataJud e auto-sync do Diário.
export const CFG_TEXT_KEYS = ['pj_cfg_oab', 'pj_cfg_oab_uf', 'pj_cfg_adv_nome', 'pj_cfg_datajud_key', 'pj_cfg_autosync']

// Lê/grava configuração de texto do escritório atual (e sincroniza no banco).
export function getCfg(base, fallback = '') {
  try { return localStorage.getItem(tkey(base)) ?? fallback } catch { return fallback }
}
export function setCfg(base, value) {
  try { localStorage.setItem(tkey(base), String(value ?? '')) } catch { /* quota */ }
  const payload = {}
  CFG_TEXT_KEYS.forEach(k => {
    try { const v = localStorage.getItem(tkey(k)); if (v !== null) payload[k] = v } catch { /* ignore */ }
  })
  api.settings.saveConfig(payload).catch(() => {})
}

// Grava uma chave de configuração no cache do escritório E no banco.
export function saveConfigKey(baseKey, value) {
  lsSet(tkey(baseKey), value)
  const payload = {}
  CONFIG_KEYS.forEach(k => { payload[k] = lsGet(tkey(k), null) })
  api.settings.saveConfig(payload).catch(() => {})
}

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
  try {
    const cfg = await api.settings.config()
    if (cfg && typeof cfg === 'object') {
      CONFIG_KEYS.forEach(k => { if (cfg[k] !== undefined && cfg[k] !== null) lsSet(tkey(k), cfg[k]) })
      CFG_TEXT_KEYS.forEach(k => { if (typeof cfg[k] === 'string') { try { localStorage.setItem(tkey(k), cfg[k]) } catch { /* quota */ } } })
    }
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
