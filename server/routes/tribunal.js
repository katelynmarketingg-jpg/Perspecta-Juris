// ─────────────────────────────────────────────────────────────────
// Tribunal Routes — autenticação e busca de processos nos portais
// dos tribunais brasileiros via scraping autenticado (acessa sigilosos).
// ─────────────────────────────────────────────────────────────────

import {
  createSession,
  getProcessesByOAB,
  listSessions,
  logout,
} from '../services/tribunalService.js'

export default async function tribunalRoutes(app) {

  // POST /api/tribunal/login
  // Faz login no portal do tribunal e retorna sessionId
  app.post('/login', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['tribunal', 'cpf', 'password'],
        properties: {
          tribunal: { type: 'string', enum: ['tjrs', 'trt4', 'trf4'] },
          cpf:      { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { tribunal, cpf, password } = req.body
    try {
      // A sessão nasce com dono: só quem a criou pode usá-la ou vê-la.
      const dono = { tenantId: req.user.tenantId, userId: req.user.userId }
      const sessionId = await createSession(tribunal, { cpf, password }, dono)
      reply.send({ ok: true, sessionId, tribunal })
    } catch (err) {
      reply.code(400).send({ ok: false, message: err.message })
    }
  })

  // GET /api/tribunal/processes
  // Busca processos por OAB, usando sessão autenticada se disponível
  app.get('/processes', {
    preHandler: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['tribunal', 'oabNum'],
        properties: {
          tribunal:  { type: 'string' },
          oabNum:    { type: 'string' },
          oabUF:     { type: 'string', default: 'RS' },
          sessionId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { tribunal, oabNum, oabUF = 'RS', sessionId } = req.query
    try {
      const dono = { tenantId: req.user.tenantId, userId: req.user.userId }
      const processes = await getProcessesByOAB(tribunal, oabNum, oabUF, sessionId, dono)
      reply.send({ ok: true, tribunal, total: processes.length, processes })
    } catch (err) {
      reply.code(400).send({ ok: false, message: err.message })
    }
  })

  // GET /api/tribunal/sessions
  // Lista sessões ativas por tribunal
  app.get('/sessions', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    reply.send({ ok: true, sessions: listSessions({ tenantId: req.user.tenantId, userId: req.user.userId }) })
  })

  // DELETE /api/tribunal/sessions/:id
  // Encerra uma sessão (logout do portal)
  app.delete('/sessions/:id', {
    preHandler: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const ok = logout(req.params.id, { tenantId: req.user.tenantId, userId: req.user.userId })
    if (!ok) return reply.code(404).send({ ok: false, message: 'Sessão não encontrada.' })
    reply.send({ ok: true })
  })
}
