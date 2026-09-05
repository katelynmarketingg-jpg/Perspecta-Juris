// ─────────────────────────────────────────────────────────────────────────
//  Acompanhamento automático de processos (DataJud/CNJ) — NO SERVIDOR.
//
//  Antes isto rodava no navegador: sincronizava 5s após o login e a cada 1h,
//  mas SÓ enquanto alguém estivesse com o app aberto. Num escritório de
//  advocacia isso é grave — a movimentação processual é o que dispara o
//  prazo, e ninguém abre o sistema no fim de semana. Agora o servidor, que
//  fica ligado, faz a ronda de todos os escritórios ativos.
// ─────────────────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, processes, processMovements } from '../db/schema.js'
import {
  inferirTribunal, buscarMovimentos, normalizarMovimento, chaveDedup,
  chaveDoTenant, autoSyncLigado, AUTOR_DATAJUD,
} from '../lib/datajudCnj.js'
import { registrarUso, TIPOS } from '../lib/usage.js'
import { tentarTravar, destravar } from '../lib/jobLock.js'

const JOB = 'datajud_sync'
const TEM_CNJ = /\d{7}-\d{2}\.\d{4}/

// Pausa entre consultas, para não martelar a API do CNJ.
const PAUSA_MS = parseInt(process.env.DATAJUD_SYNC_PAUSA_MS ?? '300', 10)
const pausar = (ms) => new Promise(r => setTimeout(r, ms))

// Sincroniza um escritório. Devolve quantas movimentações novas entraram.
async function sincronizarEscritorio(tenant) {
  const chave = chaveDoTenant(tenant)

  const doTenant = await db.select().from(processes).where(eq(processes.tenantId, tenant.id))
  const comCnj = doTenant.filter(p => TEM_CNJ.test(p.judicialNumber ?? ''))
  if (!comCnj.length) return { consultados: 0, novas: 0 }

  let consultados = 0, novas = 0

  for (const proc of comCnj) {
    const tribunal = inferirTribunal(proc.judicialNumber, proc.court)
    if (!tribunal) continue

    // Conta a consulta ANTES de fazer: é ela que gasta cota no CNJ,
    // dê certo ou não. Nunca derruba o job.
    await registrarUso(tenant.id, TIPOS.DATAJUD, 1, { tribunal, origem: 'job' })
    consultados++

    const movimentos = await buscarMovimentos(proc.judicialNumber, tribunal, chave)
    await pausar(PAUSA_MS)
    if (!movimentos.length) continue

    // O que já está no banco, para não duplicar.
    const existentes = await db.select().from(processMovements)
      .where(and(
        eq(processMovements.tenantId, tenant.id),
        eq(processMovements.processId, proc.id),
      ))
    const conhecidas = new Set(
      existentes.filter(m => m.author === AUTOR_DATAJUD).map(chaveDedup),
    )

    const inedito = movimentos
      .map(normalizarMovimento)
      .filter(m => !conhecidas.has(chaveDedup(m)))
    if (!inedito.length) continue

    const agora = new Date().toISOString()
    try {
      await db.insert(processMovements).values(inedito.map(m => ({
        ...m,
        id: nanoid(),
        tenantId: tenant.id,
        processId: proc.id,
        createdAt: agora,
      })))
      novas += inedito.length
    } catch (err) {
      console.warn(`[${JOB}] falha ao gravar movimentações de ${proc.judicialNumber}:`, err?.message ?? err)
    }
  }

  return { consultados, novas }
}

// Uma rodada completa: todos os escritórios ativos que não desligaram o
// acompanhamento automático.
export async function rodarSync() {
  const travou = await tentarTravar(JOB, 30)
  if (!travou) {
    console.log(`[${JOB}] outra instância está rodando — pulando esta rodada.`)
    return { pulado: true }
  }

  const inicio = Date.now()
  const resumo = { escritorios: 0, consultados: 0, novas: 0, erros: 0 }
  try {
    const ativos = (await db.select().from(tenants).where(eq(tenants.isActive, true)))
      .filter(t => t.plan !== 'master' && autoSyncLigado(t))

    for (const t of ativos) {
      try {
        const r = await sincronizarEscritorio(t)
        resumo.escritorios++
        resumo.consultados += r.consultados
        resumo.novas += r.novas
      } catch (err) {
        resumo.erros++
        console.warn(`[${JOB}] escritório ${t.id} falhou:`, err?.message ?? err)
      }
    }

    resumo.segundos = Math.round((Date.now() - inicio) / 1000)
    console.log(
      `[${JOB}] ${resumo.escritorios} escritório(s), ${resumo.consultados} consulta(s), ` +
      `${resumo.novas} movimentação(ões) nova(s) em ${resumo.segundos}s.`,
    )
    return resumo
  } finally {
    await destravar(JOB, resumo)
  }
}

// Liga o relógio. Chamado uma vez, na subida do servidor.
export function agendarSync() {
  if (process.env.DATAJUD_SYNC_ENABLED === 'false') {
    console.log(`[${JOB}] desligado por DATAJUD_SYNC_ENABLED=false.`)
    return () => {}
  }

  const minutos = Math.max(5, parseInt(process.env.DATAJUD_SYNC_INTERVALO_MIN ?? '60', 10) || 60)
  const atrasoInicial = parseInt(process.env.DATAJUD_SYNC_ATRASO_MS ?? '30000', 10)

  console.log(`[${JOB}] acompanhamento automático ligado — a cada ${minutos} min.`)

  // Espera um pouco na subida: o deploy não deve competir com o primeiro sync.
  const t0 = setTimeout(() => { rodarSync().catch(e => console.warn(`[${JOB}]`, e?.message ?? e)) }, atrasoInicial)
  const iv = setInterval(() => { rodarSync().catch(e => console.warn(`[${JOB}]`, e?.message ?? e)) }, minutos * 60_000)

  return () => { clearTimeout(t0); clearInterval(iv) }
}
