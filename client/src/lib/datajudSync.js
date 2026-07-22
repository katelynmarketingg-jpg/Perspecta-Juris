// ─────────────────────────────────────────────────────────────────
// DataJud Sync — consulta movimentações novas para processos com
// número CNJ e persiste automaticamente no localStorage.
// ─────────────────────────────────────────────────────────────────

import { currentTenantId } from './tenant'
import { getCfg } from './tenantData'
import api from './api'
const LS = 'pj_local_'
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v)  => localStorage.setItem(k, JSON.stringify(v))
const uid   = () => Math.random().toString(36).slice(2,9) + Math.random().toString(36).slice(2,9)

// Mapa tribunal (campo court salvo no processo) → índice DataJud
const COURT_TO_INDEX = {
  TJSP:'tjsp', TJRJ:'tjrj', TJMG:'tjmg', TJRS:'tjrs', TJPR:'tjpr', TJSC:'tjsc',
  TJBA:'tjba', TJGO:'tjgo', TJPE:'tjpe', TJCE:'tjce', TJMT:'tjmt', TJMS:'tjms',
  TJPA:'tjpa', TJES:'tjes', TJAM:'tjam', TJRN:'tjrn', TJPB:'tjpb', TJAL:'tjal',
  TJSE:'tjse', TJPI:'tjpi', TJMA:'tjma', TJRO:'tjro', TJAC:'tjac', TJAP:'tjap',
  TJRR:'tjrr', TJTO:'tjto', TJDFT:'tjdft',
  STF:'stf', STJ:'stj', TST:'tst',
  TRF1:'trf1', TRF2:'trf2', TRF3:'trf3', TRF4:'trf4', TRF5:'trf5', TRF6:'trf6',
}

// Extrai sigla do tribunal do número CNJ (posição J.TT)
// Formato: NNNNNNN-DD.AAAA.J.TT.OOOO
function inferTribunal(judicialNumber, court) {
  if (court && COURT_TO_INDEX[court.toUpperCase()]) return COURT_TO_INDEX[court.toUpperCase()]
  if (!judicialNumber) return null
  const m = judicialNumber.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/)
  if (!m) return null
  const j = m[1], tt = String(m[2]).padStart(2, '0')
  if (j === '8') {
    // Justiça Estadual — TT é o código do TJ
    const map = { '01':'tjac','02':'tjal','03':'tjam','04':'tjap','05':'tjba','06':'tjce',
                  '07':'tjdft','08':'tjes','09':'tjgo','10':'tjma','11':'tjmg','12':'tjms',
                  '13':'tjmt','14':'tjpa','15':'tjpb','16':'tjpe','17':'tjpi','18':'tjpr',
                  '19':'tjrj','20':'tjrn','21':'tjro','22':'tjrr','23':'tjrs','24':'tjsc',
                  '25':'tjse','26':'tjsp','27':'tjto' }
    return map[tt] ?? null
  }
  if (j === '5') {
    const map = { '01':'trt1','02':'trt2','03':'trt3','04':'trt4','05':'trt5','06':'trt6',
                  '07':'trt7','08':'trt8','09':'trt9','10':'trt10','11':'trt11','12':'trt12',
                  '13':'trt13','14':'trt14','15':'trt15','16':'trt16','17':'trt17','18':'trt18',
                  '19':'trt19','20':'trt20','21':'trt21','22':'trt22','23':'trt23','24':'trt24' }
    return map[tt] ?? 'tst'
  }
  if (j === '4') return { '01':'trf1','02':'trf2','03':'trf3','04':'trf4','05':'trf5','06':'trf6' }[tt] ?? null
  if (j === '1') return 'stf'
  if (j === '3') return 'stj'
  return null
}

// Busca movimentações de um processo específico no DataJud
async function fetchMovimentos(judicialNumber, tribunal) {
  // Vai pelo servidor (/api/datajud): antes chamava '/datajud/...', que só
  // existe no modo de desenvolvimento — em produção falhava em silêncio.
  try {
    const json = await api.post(`/api/datajud/${tribunal}/_search`, {
      query: { match: { numeroProcesso: judicialNumber } },
      size: 1,
      _source: ['movimentos', 'numeroProcesso'],
    })
    return json?.hits?.hits?.[0]?._source?.movimentos ?? []
  } catch { return [] }
}

// Sincroniza um processo: traz movimentações novas e persiste
async function syncProcess(process) {
  const tribunal = inferTribunal(process.judicialNumber, process.court)
  if (!tribunal || !process.judicialNumber) return 0

  let movimentos
  try {
    movimentos = await fetchMovimentos(process.judicialNumber, tribunal)
  } catch {
    return 0
  }

  if (!movimentos.length) return 0

  const existing = lsGet(LS + 'movements', [])
  const knownDates = new Set(
    existing
      .filter(m => m.processId === process.id && m.author === 'DataJud / CNJ')
      .map(m => `${m.date}|${m.description}`)
  )

  const toAdd = movimentos
    .filter(m => {
      const date = (m.dataHora ?? '').slice(0, 10)
      const desc = m.nome ?? m.descricao ?? ''
      return !knownDates.has(`${date}|${desc}`)
    })
    .map(m => ({
      id: uid(),
      tenantId: currentTenantId(),
      processId: process.id,
      description: m.nome ?? m.descricao ?? 'Movimentação',
      date: (m.dataHora ?? new Date().toISOString()).slice(0, 10),
      type: 'system',
      author: 'DataJud / CNJ',
      isPublic: false,
      isAutomatic: true,
      createdAt: m.dataHora ?? new Date().toISOString(),
    }))

  if (toAdd.length > 0) {
    lsSet(LS + 'movements', [...existing, ...toAdd])
  }

  return toAdd.length
}

// Sincroniza todos os processos com número CNJ cadastrados
export async function syncAllProcesses(onProgress) {
  const processes = lsGet(LS + 'processes', [])
  const withCnj   = processes.filter(p => p.judicialNumber?.match(/\d{7}-\d{2}\.\d{4}/))

  if (!withCnj.length) return { synced: 0, newMovements: 0 }

  let newMovements = 0
  let synced = 0

  for (const proc of withCnj) {
    try {
      const added = await syncProcess(proc)
      newMovements += added
      synced++
      onProgress?.({ synced, total: withCnj.length, newMovements })
    } catch {
      // ignora erros por processo
    }
    // Pequena pausa para não sobrecarregar a API
    await new Promise(r => setTimeout(r, 300))
  }

  // Salva timestamp da última sincronização
  lsSet('pj_datajud_last_sync', new Date().toISOString())

  return { synced, total: withCnj.length, newMovements }
}

// Verifica se deve sincronizar automaticamente (a cada 1h)
export function shouldAutoSync() {
  if (getCfg('pj_cfg_autosync', 'true') === 'false') return false
  const last = localStorage.getItem('pj_datajud_last_sync')
  if (!last) return true
  return (Date.now() - new Date(last).getTime()) > 60 * 60 * 1000 // 1 hora
}

export function getLastSyncInfo() {
  const last = localStorage.getItem('pj_datajud_last_sync')
  const processes = lsGet(LS + 'processes', []).filter(p => p.judicialNumber?.match(/\d{7}-\d{2}\.\d{4}/))
  return { lastSync: last ? new Date(last) : null, processCount: processes.length }
}
