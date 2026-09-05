// ─────────────────────────────────────────────────────────────────────────
//  DataJud (CNJ) — o que é comum ao proxy (/api/datajud) e ao job que roda
//  sozinho no servidor. Antes essa lógica só existia no navegador
//  (client/src/lib/datajudSync.js), o que obrigava alguém a estar com o app
//  aberto para os processos serem acompanhados.
// ─────────────────────────────────────────────────────────────────────────
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'

export const DATAJUD = 'https://api-publica.datajud.cnj.jus.br'

// Chave pública do CNJ, usada só quando o escritório não cadastrou a dele.
// O CNJ pode invalidá-la a qualquer momento — daí o aviso em Configurações.
export const CHAVE_PADRAO = 'cDZHYzlZa0JadVREZDJCendBdUFWZz09cDZHYzlZa0JadVREZDJCendBdUFWZz09'

// Só letras e números: impede montar uma URL para outro destino.
export const TRIBUNAL_OK = /^[a-z0-9]{3,12}$/

export const AUTOR_DATAJUD = 'DataJud / CNJ'

// A chave do escritório (Configurações → Integrações) tem prioridade sobre a
// variável de ambiente e sobre a chave padrão.
export function chaveDoTenant(tenant) {
  const k = tenant?.settings?.config?.pj_cfg_datajud_key
  if (typeof k === 'string' && k.trim()) return k.trim()
  return process.env.DATAJUD_KEY || CHAVE_PADRAO
}

export async function chaveDoEscritorio(tenantId) {
  try {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    return chaveDoTenant(t)
  } catch {
    return process.env.DATAJUD_KEY || CHAVE_PADRAO
  }
}

// O escritório pode desligar o acompanhamento automático em
// Configurações → Integrações. O job respeita essa escolha.
export function autoSyncLigado(tenant) {
  return tenant?.settings?.config?.pj_cfg_autosync !== 'false'
}

// ── Número CNJ → índice do tribunal no DataJud ───────────────────────────
// Formato: NNNNNNN-DD.AAAA.J.TT.OOOO — J diz o ramo da Justiça, TT o tribunal.
const POR_SIGLA = {
  TJSP:'tjsp', TJRJ:'tjrj', TJMG:'tjmg', TJRS:'tjrs', TJPR:'tjpr', TJSC:'tjsc',
  TJBA:'tjba', TJGO:'tjgo', TJPE:'tjpe', TJCE:'tjce', TJMT:'tjmt', TJMS:'tjms',
  TJPA:'tjpa', TJES:'tjes', TJAM:'tjam', TJRN:'tjrn', TJPB:'tjpb', TJAL:'tjal',
  TJSE:'tjse', TJPI:'tjpi', TJMA:'tjma', TJRO:'tjro', TJAC:'tjac', TJAP:'tjap',
  TJRR:'tjrr', TJTO:'tjto', TJDFT:'tjdft',
  STF:'stf', STJ:'stj', TST:'tst',
  TRF1:'trf1', TRF2:'trf2', TRF3:'trf3', TRF4:'trf4', TRF5:'trf5', TRF6:'trf6',
}
const ESTADUAL = { '01':'tjac','02':'tjal','03':'tjam','04':'tjap','05':'tjba','06':'tjce',
  '07':'tjdft','08':'tjes','09':'tjgo','10':'tjma','11':'tjmg','12':'tjms','13':'tjmt',
  '14':'tjpa','15':'tjpb','16':'tjpe','17':'tjpi','18':'tjpr','19':'tjrj','20':'tjrn',
  '21':'tjro','22':'tjrr','23':'tjrs','24':'tjsc','25':'tjse','26':'tjsp','27':'tjto' }
const TRABALHO = Object.fromEntries(
  Array.from({ length: 24 }, (_, i) => [String(i + 1).padStart(2, '0'), `trt${i + 1}`]),
)
const FEDERAL = { '01':'trf1','02':'trf2','03':'trf3','04':'trf4','05':'trf5','06':'trf6' }

export function inferirTribunal(judicialNumber, court) {
  if (court && POR_SIGLA[String(court).toUpperCase()]) return POR_SIGLA[String(court).toUpperCase()]
  if (!judicialNumber) return null
  const m = String(judicialNumber).match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/)
  if (!m) return null
  const [, j, tt] = m
  if (j === '8') return ESTADUAL[tt] ?? null
  if (j === '5') return TRABALHO[tt] ?? 'tst'
  if (j === '4') return FEDERAL[tt] ?? null
  if (j === '1') return 'stf'
  if (j === '3') return 'stj'
  return null
}

// Consulta as movimentações de um processo no CNJ. Devolve [] em qualquer
// falha — quem chama decide o que fazer.
export async function buscarMovimentos(judicialNumber, tribunal, chave) {
  if (!TRIBUNAL_OK.test(tribunal)) return []
  try {
    const res = await fetch(`${DATAJUD}/api_publica_${tribunal}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `APIKey ${chave}` },
      body: JSON.stringify({
        query: { match: { numeroProcesso: judicialNumber } },
        size: 1,
        _source: ['movimentos', 'numeroProcesso'],
      }),
    })
    if (!res.ok) return []
    const json = await res.json()
    return json?.hits?.hits?.[0]?._source?.movimentos ?? []
  } catch {
    return []
  }
}

// Normaliza o formato do CNJ para o formato de process_movements.
export function normalizarMovimento(m) {
  return {
    description: m?.nome ?? m?.descricao ?? 'Movimentação',
    date: String(m?.dataHora ?? new Date().toISOString()).slice(0, 10),
    type: 'system',
    author: AUTOR_DATAJUD,
    isPublic: false,
  }
}

export const chaveDedup = (m) => `${String(m.date ?? '').slice(0, 10)}|${m.description}`
