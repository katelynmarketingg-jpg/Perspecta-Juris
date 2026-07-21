import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { processes, financialEntries, users, clients } from '../db/schema.js'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Relatórios calculados a partir dos dados REAIS do escritório.
export default async function reportRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/summary', auth, async (req) => {
    const tid = req.user.tenantId
    const meses = Math.min(Math.max(parseInt(req.query.months ?? '6', 10) || 6, 1), 24)

    const [procs, entries, equipe, cli] = await Promise.all([
      db.select().from(processes).where(eq(processes.tenantId, tid)),
      db.select().from(financialEntries).where(eq(financialEntries.tenantId, tid)),
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.tenantId, tid)),
      db.select({ id: clients.id }).from(clients).where(eq(clients.tenantId, tid)),
    ])

    const pago  = (e) => e.status === 'paid' || !!e.paidDate
    const valor = (e) => Number(e.paidAmount ?? e.amount ?? 0)

    // Receita efetivamente recebida, por processo
    const receitaPorProcesso = {}
    entries
      .filter(e => e.type === 'receivable' && pago(e) && e.processId)
      .forEach(e => { receitaPorProcesso[e.processId] = (receitaPorProcesso[e.processId] ?? 0) + valor(e) })

    // ── Por área jurídica ──
    const areas = {}
    procs.forEach(p => {
      const k = p.area || 'Sem área'
      areas[k] = areas[k] ?? { area: k, processos: 0, receita: 0 }
      areas[k].processos++
      areas[k].receita += receitaPorProcesso[p.id] ?? 0
    })

    // ── Por advogado responsável ──
    const nomes = Object.fromEntries(equipe.map(u => [u.id, u.name]))
    const advs = {}
    procs.forEach(p => {
      const k = p.assignedTo ?? '__sem__'
      advs[k] = advs[k] ?? { name: nomes[p.assignedTo] ?? 'Não atribuído', processos: 0, receita: 0 }
      advs[k].processos++
      advs[k].receita += receitaPorProcesso[p.id] ?? 0
    })

    // ── Mês a mês (recebido x pago) ──
    const hoje = new Date()
    const monthly = []
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const doMes = entries.filter(e => pago(e) && String(e.paidDate ?? e.dueDate ?? '').slice(0, 7) === chave)
      const honorarios = doMes.filter(e => e.type === 'receivable').reduce((s, e) => s + valor(e), 0)
      const custas     = doMes.filter(e => e.type === 'payable').reduce((s, e) => s + valor(e), 0)
      monthly.push({ month: MESES[d.getMonth()], honorarios, custas, liquido: honorarios - custas })
    }

    const aReceber = entries.filter(e => e.type === 'receivable' && !pago(e)).reduce((s, e) => s + Number(e.amount ?? 0), 0)

    return {
      byArea:   Object.values(areas).sort((a, b) => b.receita - a.receita),
      byLawyer: Object.values(advs).sort((a, b) => b.receita - a.receita),
      monthly,
      totals: {
        processos:    procs.length,
        processosAtivos: procs.filter(p => p.status === 'active').length,
        clientes:     cli.length,
        receitaTotal: Object.values(receitaPorProcesso).reduce((s, v) => s + v, 0),
        aReceber,
      },
    }
  })
}
