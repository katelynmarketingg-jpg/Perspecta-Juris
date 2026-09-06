// ─────────────────────────────────────────────────────────────────────────
//  Reporta pro Perspecta Central quanto cada escritório consumiu no mês —
//  reaproveita a agregação que já existe em lib/usage.js (consumoAgregado),
//  não mede nada a mais. Mesmo padrão de trava/agenda do datajudSync.js.
// ─────────────────────────────────────────────────────────────────────────
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'
import { consumoAgregado, inicioDoMes, TIPOS } from '../lib/usage.js'
import { planLimitFor, userCount, getPlans } from '../lib/plans.js'
import { emitirEventoPerspecta } from '../lib/perspecta-webhook.js'
import { tentarTravar, destravar } from '../lib/jobLock.js'

const JOB = 'uso_report'

// Uma rodada: todo escritório ativo (menos o master) manda o consumo do
// mês corrente pro Central, mês a mês recomeçando do zero em inicioDoMes().
export async function rodarRelatorioUso() {
  const travou = await tentarTravar(JOB, 30)
  if (!travou) {
    console.log(`[${JOB}] outra instância está rodando — pulando esta rodada.`)
    return { pulado: true }
  }

  const resumo = { escritorios: 0, erros: 0 }
  try {
    const ativos = (await db.select().from(tenants).where(eq(tenants.isActive, true)))
      .filter(t => t.plan !== 'master')
    const agregado = await consumoAgregado({ from: inicioDoMes() })
    const plans = await getPlans()

    for (const t of ativos) {
      try {
        const doTenant = agregado.filter(a => a.tenantId === t.id)
        const soma = (kind) => doTenant.find(a => a.kind === kind)?.total ?? 0
        const used = await userCount(t.id)
        const limit = await planLimitFor(t)
        const planName = plans.find(p => p.key === t.plan)?.name ?? t.plan ?? null

        emitirEventoPerspecta('uso.medido', {
          empresa_ref: t.id,
          plano: planName,
          metricas: {
            usuarios: used,
            datajud_consultas: soma(TIPOS.DATAJUD),
            djen_consultas: soma(TIPOS.DJEN),
            documentos_bytes: soma(TIPOS.DOCUMENTO),
            ia_tokens: soma(TIPOS.IA),
          },
          limites: limit == null ? {} : { usuarios: limit },
        })
        resumo.escritorios++
      } catch (err) {
        resumo.erros++
        console.warn(`[${JOB}] escritório ${t.id} falhou:`, err?.message ?? err)
      }
    }
    console.log(`[${JOB}] ${resumo.escritorios} escritório(s) reportado(s), ${resumo.erros} erro(s).`)
    return resumo
  } finally {
    await destravar(JOB, resumo)
  }
}

// Liga o relógio. Chamado uma vez, na subida do servidor.
export function agendarRelatorioUso() {
  if (process.env.USO_REPORT_ENABLED === 'false') {
    console.log(`[${JOB}] desligado por USO_REPORT_ENABLED=false.`)
    return () => {}
  }

  const minutos = Math.max(30, parseInt(process.env.USO_REPORT_INTERVALO_MIN ?? '360', 10) || 360)
  const atrasoInicial = parseInt(process.env.USO_REPORT_ATRASO_MS ?? '45000', 10)

  console.log(`[${JOB}] relatório de consumo pro Central ligado — a cada ${minutos} min.`)

  const t0 = setTimeout(() => { rodarRelatorioUso().catch(e => console.warn(`[${JOB}]`, e?.message ?? e)) }, atrasoInicial)
  const iv = setInterval(() => { rodarRelatorioUso().catch(e => console.warn(`[${JOB}]`, e?.message ?? e)) }, minutos * 60_000)

  return () => { clearTimeout(t0); clearInterval(iv) }
}
