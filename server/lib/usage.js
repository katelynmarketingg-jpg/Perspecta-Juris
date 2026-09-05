// ─────────────────────────────────────────────────────────────────────────
//  Medição de consumo por escritório.
//
//  Regra de ouro: registrar consumo NUNCA pode derrubar a operação real.
//  Se a gravação da métrica falhar, a consulta ao DataJud (ou o upload, ou o
//  que for) tem de seguir normalmente — o cliente não pode perder trabalho
//  porque o nosso contador teve um problema.
// ─────────────────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid'
import { sql, and, eq, gte, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { usageEvents } from '../db/schema.js'

export const TIPOS = {
  DATAJUD:   'datajud_query',
  DJEN:      'djen_query',
  DOCUMENTO: 'document_bytes',
  IA:        'ai_tokens',
  USUARIO:   'user_created',
}

/**
 * Registra um evento de consumo. Não lança: falha vira aviso no log.
 * @param {string} tenantId
 * @param {string} kind      um dos TIPOS
 * @param {number} qty       quantidade (1 consulta, N bytes, N tokens…)
 * @param {object} meta      contexto livre (tribunal, documento, modelo…)
 */
export async function registrarUso(tenantId, kind, qty = 1, meta = null, userId = null) {
  if (!tenantId || !kind) return
  try {
    await db.insert(usageEvents).values({
      id:        nanoid(),
      tenantId,
      kind,
      qty:       Number(qty) || 0,
      meta:      meta && typeof meta === 'object' ? meta : null,
      userId:    userId ?? null,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[uso] não foi possível registrar', kind, '-', err?.message ?? err)
  }
}

// Consumo de UM escritório num período. Usado para aplicar cota.
export async function consumoDoTenant(tenantId, kind, desde) {
  const cond = [eq(usageEvents.tenantId, tenantId), eq(usageEvents.kind, kind)]
  if (desde) cond.push(gte(usageEvents.createdAt, desde))
  const [linha] = await db
    .select({ total: sql`coalesce(sum(${usageEvents.qty}), 0)::float8`, eventos: sql`count(*)::int` })
    .from(usageEvents).where(and(...cond))
  return { total: linha?.total ?? 0, eventos: linha?.eventos ?? 0 }
}

// Consumo de TODOS os escritórios, agrupado por tenant e tipo.
export async function consumoAgregado({ from, to } = {}) {
  const cond = []
  if (from) cond.push(gte(usageEvents.createdAt, from))
  if (to)   cond.push(lte(usageEvents.createdAt, to))
  return db
    .select({
      tenantId: usageEvents.tenantId,
      kind:     usageEvents.kind,
      total:    sql`sum(${usageEvents.qty})::float8`,
      eventos:  sql`count(*)::int`,
    })
    .from(usageEvents)
    .where(cond.length ? and(...cond) : undefined)
    .groupBy(usageEvents.tenantId, usageEvents.kind)
}

// Primeiro dia do mês corrente, em ISO — janela padrão de cota mensal.
export function inicioDoMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}
