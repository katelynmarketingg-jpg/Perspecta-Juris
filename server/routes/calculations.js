// ─────────────────────────────────────────────────────────────────────────
//  Cálculos salvos da Calculadora Jurídica.
//
//  Antes o histórico vivia em `localStorage` e só quando a pessoa clicava em
//  "Salvar no histórico". Três problemas num escritório de verdade:
//
//   1. quem calculou no computador da recepção não via nada no da sala;
//   2. não havia como saber QUEM fez o cálculo;
//   3. quem só clicou em "Calcular" perdia o cálculo — e a tela não avisava.
//
//  Agora o cálculo é do escritório: fica no banco, guarda o autor e pode
//  ser vinculado ao cliente (e ao processo).
// ─────────────────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { calculations, clients, processes, users } from '../db/schema.js'

const CAMPOS = ['clientId', 'processId', 'calcId', 'titulo', 'ramo', 'headline', 'inputs', 'resultado']

function limpar(body) {
  const out = {}
  for (const c of CAMPOS) if (body?.[c] !== undefined) out[c] = body[c]
  // String vazia vinda de um <select> não é um id: vira "sem vínculo".
  if (out.clientId === '')  out.clientId = null
  if (out.processId === '') out.processId = null
  for (const j of ['headline', 'inputs', 'resultado']) {
    if (out[j] !== undefined && (out[j] === null || typeof out[j] !== 'object')) out[j] = {}
  }
  return out
}

// Um vínculo só vale se o cliente/processo for da mesma empresa. Sem esta
// conferência, um id adivinhado ligaria o cálculo ao cliente de outro
// escritório.
async function confereVinculos(campos, tenantId) {
  if (campos.clientId) {
    const [c] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, campos.clientId), eq(clients.tenantId, tenantId))).limit(1)
    if (!c) return 'Cliente não encontrado.'
  }
  if (campos.processId) {
    const [p] = await db.select({ id: processes.id }).from(processes)
      .where(and(eq(processes.id, campos.processId), eq(processes.tenantId, tenantId))).limit(1)
    if (!p) return 'Processo não encontrado.'
  }
  return null
}

export default async function calculationRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // GET /api/calculations?clientId=&processId=&calcId=&de=&ate=&autor=
  app.get('/', auth, async (req) => {
    const cond = [eq(calculations.tenantId, req.user.tenantId)]
    if (req.query.clientId)  cond.push(eq(calculations.clientId, req.query.clientId))
    if (req.query.processId) cond.push(eq(calculations.processId, req.query.processId))
    if (req.query.calcId)    cond.push(eq(calculations.calcId, req.query.calcId))
    if (req.query.autor)     cond.push(eq(calculations.createdBy, req.query.autor))

    const linhas = await db
      .select({
        id: calculations.id,
        clientId: calculations.clientId,
        processId: calculations.processId,
        calcId: calculations.calcId,
        titulo: calculations.titulo,
        ramo: calculations.ramo,
        headline: calculations.headline,
        inputs: calculations.inputs,
        resultado: calculations.resultado,
        createdBy: calculations.createdBy,
        createdByName: calculations.createdByName,
        createdAt: calculations.createdAt,
        updatedAt: calculations.updatedAt,
        clientName: clients.name,
        processNumber: processes.number,
        // O nome atual do acesso, quando ele ainda existe; se foi apagado,
        // sobra o nome gravado na hora do cálculo.
        autorAtual: users.name,
      })
      .from(calculations)
      .leftJoin(clients, eq(clients.id, calculations.clientId))
      .leftJoin(processes, eq(processes.id, calculations.processId))
      .leftJoin(users, eq(users.id, calculations.createdBy))
      .where(and(...cond))
      .orderBy(desc(calculations.createdAt))

    const de  = req.query.de  ? String(req.query.de)  : null
    const ate = req.query.ate ? String(req.query.ate) + 'T23:59:59' : null

    return linhas
      .filter(l => (!de || l.createdAt >= de) && (!ate || l.createdAt <= ate))
      .map(l => ({ ...l, autor: l.autorAtual || l.createdByName || '—' }))
  })

  app.post('/', auth, async (req, reply) => {
    const campos = limpar(req.body)
    if (!campos.calcId?.trim()) return reply.code(400).send({ message: 'Informe qual cálculo foi feito.' })
    if (!campos.titulo?.trim()) return reply.code(400).send({ message: 'Informe o título do cálculo.' })

    const erro = await confereVinculos(campos, req.user.tenantId)
    if (erro) return reply.code(400).send({ message: erro })

    // O nome de quem calculou é gravado junto: se o acesso for desativado
    // ou apagado, o histórico continua dizendo quem fez.
    const [autor] = await db.select({ name: users.name }).from(users)
      .where(eq(users.id, req.user.userId)).limit(1)

    const now = new Date().toISOString()
    const id = nanoid()
    await db.insert(calculations).values({
      id, tenantId: req.user.tenantId,
      clientId: campos.clientId ?? null,
      processId: campos.processId ?? null,
      calcId: campos.calcId.trim(),
      titulo: campos.titulo.trim(),
      ramo: campos.ramo ?? null,
      headline: campos.headline ?? {},
      inputs: campos.inputs ?? {},
      resultado: campos.resultado ?? {},
      createdBy: req.user.userId,
      createdByName: autor?.name ?? null,
      createdAt: now, updatedAt: now,
    })
    const [linha] = await db.select().from(calculations).where(eq(calculations.id, id)).limit(1)
    return reply.code(201).send(linha)
  })

  // Recalcular o mesmo cálculo atualiza a linha em vez de criar outra —
  // senão mexer num campo e clicar "Calcular" três vezes encheria o
  // histórico de três entradas quase iguais.
  app.put('/:id', auth, async (req, reply) => {
    const [atual] = await db.select({ id: calculations.id }).from(calculations)
      .where(and(eq(calculations.id, req.params.id), eq(calculations.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Cálculo não encontrado.' })

    const campos = limpar(req.body)
    if (!Object.keys(campos).length) return reply.code(400).send({ message: 'Nada para alterar.' })

    const erro = await confereVinculos(campos, req.user.tenantId)
    if (erro) return reply.code(400).send({ message: erro })

    await db.update(calculations).set({ ...campos, updatedAt: new Date().toISOString() })
      .where(eq(calculations.id, req.params.id))
    const [linha] = await db.select().from(calculations).where(eq(calculations.id, req.params.id)).limit(1)
    return linha
  })

  app.delete('/:id', auth, async (req, reply) => {
    const [atual] = await db.select({ id: calculations.id }).from(calculations)
      .where(and(eq(calculations.id, req.params.id), eq(calculations.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Cálculo não encontrado.' })
    await db.delete(calculations).where(eq(calculations.id, req.params.id))
    return reply.code(204).send()
  })
}
