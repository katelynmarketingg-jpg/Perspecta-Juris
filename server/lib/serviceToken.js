// ─────────────────────────────────────────────────────────────────────────
//  Autenticação máquina-a-máquina para /api/admin/*.
//
//  As rotas do painel master exigem um JWT de usuário, que dura 2h e nasce de
//  um login humano. A Perspecta Central não é uma pessoa: precisa de uma
//  credencial fixa, que não expira e não pertence a ninguém.
//
//  A comparação é de tempo constante. Um `===` vaza, pelo tempo de resposta,
//  quantos caracteres do token o atacante já acertou — dá para descobrir o
//  segredo caractere a caractere. `timingSafeEqual` sempre gasta o mesmo
//  tempo, independentemente de onde está a diferença.
// ─────────────────────────────────────────────────────────────────────────
import { timingSafeEqual, createHash } from 'crypto'

const TAMANHO_MINIMO = 32

function iguaisEmTempoConstante(a, b) {
  // Hash antes de comparar: iguala o comprimento (timingSafeEqual exige
  // buffers do mesmo tamanho) sem vazar o tamanho do segredo real.
  const ha = createHash('sha256').update(String(a ?? ''), 'utf8').digest()
  const hb = createHash('sha256').update(String(b ?? ''), 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

// Lê o token do cabeçalho, aceitando "Bearer <token>" ou o token puro.
function tokenDoPedido(req) {
  const h = req.headers?.authorization ?? req.headers?.['x-admin-token'] ?? ''
  const m = String(h).match(/^Bearer\s+(.+)$/i)
  return (m ? m[1] : String(h)).trim()
}

/**
 * preHandler para as rotas de serviço. Recusa se:
 *  - ADMIN_API_TOKEN não estiver configurado (a porta nasce fechada);
 *  - o token for curto demais para ser levado a sério;
 *  - o token enviado não bater.
 */
export function requireServiceToken(req, reply, done) {
  const esperado = process.env.ADMIN_API_TOKEN

  if (!esperado) {
    reply.code(503).send({
      message: 'Porta administrativa desligada: ADMIN_API_TOKEN não está configurado no servidor.',
    })
    return
  }
  if (esperado.length < TAMANHO_MINIMO) {
    // Configuração fraca é problema de quem opera, não de quem chama — mas
    // aceitar seria pior do que recusar.
    req.log?.error?.(`ADMIN_API_TOKEN tem menos de ${TAMANHO_MINIMO} caracteres — porta administrativa recusada.`)
    reply.code(503).send({ message: 'Porta administrativa mal configurada no servidor.' })
    return
  }

  const enviado = tokenDoPedido(req)
  if (!enviado || !iguaisEmTempoConstante(enviado, esperado)) {
    reply.code(401).send({ message: 'Credencial de serviço inválida.' })
    return
  }

  req.viaServico = true
  done()
}
