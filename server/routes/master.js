import bcrypt from 'bcryptjs'
import { eq, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users } from '../db/schema.js'
import { validarSenha } from '../lib/senha.js'
import { getPlans, savePlans } from '../lib/plans.js'
import { menuAccessFor } from '../lib/permissions.js'
import { getBranding, setBranding } from '../lib/branding.js'
import { issueRefreshToken, revokeAllForUser } from '../lib/refreshTokens.js'
import { consumoAgregado, inicioDoMes } from '../lib/usage.js'
import { emitirEventoPerspecta } from '../lib/perspecta-webhook.js'
// As regras de criar escritório vivem no serviço: a porta /api/admin/* usada
// pela Perspecta Central chama exatamente as mesmas funções. Duas cópias
// seriam, na prática, duas regras — e uma ficaria para trás.
import { criarEscritorio, contagens as counts, ErroDeRegra } from '../services/provisionamento.js'

// Situação de cobrança de um escritório. Mora em settings.cobranca porque é
// informação comercial, não estrutura: muda de escritório para escritório e
// não vale uma coluna.
//
// `null` é de propósito: o sistema nunca soube quem paga e quem está testando,
// e não vai inventar. Escritório sem classificação aparece como "a definir"
// até alguém dizer o que é.
const SITUACOES = new Set(['teste', 'pagante', 'cortesia'])

function cobrancaDe(tenant) {
  const c = tenant?.settings?.cobranca ?? {}
  return {
    situacao:   SITUACOES.has(c.situacao) ? c.situacao : null,
    trialAte:   c.trialAte ?? null,
    valorMensal: Number.isFinite(Number(c.valorMensal)) ? Number(c.valorMensal) : null,
  }
}

export default async function masterRoutes(app) {
  // Todas as rotas exigem papel 'master'.
  const master = { preHandler: [app.requireRoles(['master'])] }

  // Nenhuma rota daqui pode tocar numa conta master: é a porta de entrada da
  // dona do sistema, e um engano aqui tranca ela para fora.
  const ehMaster = (u) => u?.role === 'master'

  // ── Planos ────────────────────────────────────────────────────
  // GET /api/master/plans — definição dos planos (nome + limite de acessos)
  app.get('/plans', master, async () => {
    return await getPlans()
  })
  // PUT /api/master/plans — salva a definição dos planos
  app.put('/plans', master, async (req, reply) => {
    if (!Array.isArray(req.body?.plans)) {
      return reply.code(400).send({ message: 'Envie { plans: [...] }.' })
    }
    return await savePlans(req.body.plans)
  })

  // ── Consumo por escritório ────────────────────────────────────
  // GET /api/master/usage?from=&to=  → o que cada escritório gastou.
  // É a base para cobrar por cota; antes não existia contador nenhum.
  app.get('/usage', master, async (req) => {
    const { from, to } = req.query
    const desde = from ?? inicioDoMes()
    const linhas = await consumoAgregado({ from: desde, to })

    // Agrupa por escritório, com o nome junto para a tela não precisar cruzar.
    const nomes = Object.fromEntries(
      (await db.select({ id: tenants.id, name: tenants.name, plan: tenants.plan }).from(tenants))
        .map(t => [t.id, t]),
    )
    const porTenant = {}
    for (const l of linhas) {
      const t = (porTenant[l.tenantId] ??= {
        tenantId: l.tenantId,
        name: nomes[l.tenantId]?.name ?? '(escritório removido)',
        plan: nomes[l.tenantId]?.plan ?? null,
        uso: {},
      })
      t.uso[l.kind] = { total: l.total, eventos: l.eventos }
    }
    return { desde, ate: to ?? null, escritorios: Object.values(porTenant) }
  })

  // ── Marca do sistema (logo, favicon, cor) ────────────────────
  app.get('/branding', master, async () => await getBranding())
  app.put('/branding', master, async (req) => await setBranding(req.body ?? {}))

  // GET /api/master/companies — lista escritórios (exceto o próprio master)
  app.get('/companies', master, async () => {
    const rows = await db.select().from(tenants).where(ne(tenants.plan, 'master'))
    const { u, c, p } = await counts()
    const plans = await getPlans()
    const limitOf = key => {
      const pl = plans.find(x => x.key === key)
      return pl ? (pl.maxUsers ?? null) : null
    }
    const precoOf = key => plans.find(x => x.key === key)?.price ?? null
    return rows.map(t => {
      const cob = cobrancaDe(t)
      return {
        ...t,
        cnpj:           t.settings?.cnpj ?? '',
        maxUsers:       limitOf(t.plan),   // null = ilimitado
        usersCount:     u[t.id] ?? 0,
        clientsCount:   c[t.id] ?? 0,
        processesCount: p[t.id] ?? 0,
        cobranca:       cob,
        precoDoPlano:   precoOf(t.plan),
        // O que este escritório vale por mês: o valor combinado com ele, se
        // houver; senão o preço de tabela do plano.
        valorMensal:    cob.valorMensal ?? precoOf(t.plan),
      }
    })
  })

  // POST /api/master/companies — cria escritório + usuário admin dele
  app.post('/companies', master, async (req, reply) => {
    let tenant
    try {
      ({ tenant } = await criarEscritorio(req.body ?? {}, { origem: 'nova-empresa' }))
    } catch (err) {
      if (err instanceof ErroDeRegra) return reply.code(err.status).send({ message: err.message })
      throw err
    }

    emitirEventoPerspecta('cadastro.novo', {
      empresa_ref: tenant.id, nome: tenant.name, plano: tenant.plan,
      cnpj: tenant.settings?.cnpj ?? '', admin_email: req.body?.adminEmail ?? null,
    })
    return reply.code(201).send({
      ...tenant,
      cnpj: tenant.settings?.cnpj ?? '',
      usersCount: 1, clientsCount: 0, processesCount: 0,
    })
  })

  // PUT /api/master/companies/:id — atualiza (ativar/desativar, nome, plano)
  app.put('/companies/:id', master, async (req, reply) => {
    const b = req.body ?? {}
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!t) return reply.code(404).send({ message: 'Empresa não encontrada.' })
    if (t.plan === 'master') return reply.code(403).send({ message: 'A empresa master não pode ser alterada.' })

    const patch = { updatedAt: new Date().toISOString() }
    if (typeof b.isActive === 'boolean') patch.isActive = b.isActive
    if (b.name?.trim()) patch.name = b.name.trim()
    if (b.plan) patch.plan = b.plan
    if (b.cnpj !== undefined) patch.settings = { ...(t.settings ?? {}), cnpj: b.cnpj }

    await db.update(tenants).set(patch).where(eq(tenants.id, req.params.id))
    const [row] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    return { ...row, cnpj: row.settings?.cnpj ?? '' }
  })

  // DELETE /api/master/companies/:id — remove escritório (cascata apaga usuários/clientes/processos)
  app.delete('/companies/:id', master, async (req, reply) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!t) return reply.code(404).send({ message: 'Empresa não encontrada.' })
    if (t.plan === 'master') return reply.code(403).send({ message: 'A empresa master não pode ser excluída.' })
    await db.delete(tenants).where(eq(tenants.id, req.params.id))
    return reply.code(204).send()
  })

  // ── Situação de cobrança do escritório ───────────────────────
  // PUT /api/master/companies/:id/cobranca
  app.put('/companies/:id/cobranca', master, async (req, reply) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!t) return reply.code(404).send({ message: 'Empresa não encontrada.' })
    if (t.plan === 'master') return reply.code(403).send({ message: 'A empresa master não tem cobrança.' })

    const b2 = req.body ?? {}
    if (b2.situacao !== undefined && b2.situacao !== null && !SITUACOES.has(b2.situacao)) {
      return reply.code(400).send({ message: `Situação inválida: "${b2.situacao}". Use teste, pagante ou cortesia.` })
    }
    const atual = cobrancaDe(t)
    const cobranca = {
      situacao:    b2.situacao !== undefined ? (b2.situacao || null) : atual.situacao,
      trialAte:    b2.trialAte !== undefined ? (b2.trialAte || null) : atual.trialAte,
      valorMensal: b2.valorMensal !== undefined
        ? (b2.valorMensal === null || b2.valorMensal === '' ? null : Number(b2.valorMensal))
        : atual.valorMensal,
    }
    if (cobranca.valorMensal !== null && !Number.isFinite(cobranca.valorMensal)) {
      return reply.code(400).send({ message: 'Valor mensal inválido.' })
    }

    const settings = { ...(t.settings ?? {}), cobranca }
    await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, t.id))
    return { id: t.id, cobranca }
  })

  // ── Acessos de um escritório ─────────────────────────────────
  // GET /api/master/companies/:id/users — quem entra naquele escritório.
  // Isto não existia: para ver (ou cortar) um acesso era preciso entrar no
  // escritório como se fosse a pessoa.
  app.get('/companies/:id/users', master, async (req, reply) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!t) return reply.code(404).send({ message: 'Empresa não encontrada.' })
    const rows = await db.select({
      id: users.id, name: users.name, loginName: users.loginName, email: users.email,
      role: users.role, isActive: users.isActive, lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.tenantId, t.id))
    return rows
  })

  // PUT /api/master/users/:id — redefinir a senha e/ou suspender um acesso.
  app.put('/users/:id', master, async (req, reply) => {
    const [alvo] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1)
    if (!alvo) return reply.code(404).send({ message: 'Acesso não encontrado.' })
    // A conta master se troca em /me/password, com a senha atual na mão.
    if (ehMaster(alvo)) return reply.code(403).send({ message: 'A conta master é alterada em "Minha conta".' })

    const b2 = req.body ?? {}
    const patch = { updatedAt: new Date().toISOString() }

    if (b2.password !== undefined) {
      const erro = validarSenha(b2.password)
      if (erro) return reply.code(400).send({ message: erro })
      patch.passwordHash = await bcrypt.hash(b2.password, 12)
    }
    if (typeof b2.isActive === 'boolean') patch.isActive = b2.isActive
    if (Object.keys(patch).length === 1) return reply.code(400).send({ message: 'Nada para alterar.' })

    await db.update(users).set(patch).where(eq(users.id, alvo.id))

    // Suspender tem de valer AGORA: sem isto a pessoa continuaria dentro do
    // sistema com o token que já tinha, até ele vencer.
    if (patch.isActive === false || patch.passwordHash) {
      await revokeAllForUser(alvo.id)
    }
    return { id: alvo.id, isActive: patch.isActive ?? alvo.isActive, senhaTrocada: !!patch.passwordHash }
  })

  // ── Minha conta ──────────────────────────────────────────────
  // PUT /api/master/me/password — a dona troca a própria senha.
  // Pede a senha atual: um painel aberto por engano não pode virar a chave
  // de casa na mão de quem passar pelo computador.
  app.put('/me/password', master, async (req, reply) => {
    const { senhaAtual, novaSenha } = req.body ?? {}
    const erro = validarSenha(novaSenha)
    if (erro) return reply.code(400).send({ message: erro })

    const [eu] = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1)
    if (!eu) return reply.code(404).send({ message: 'Usuário não encontrado.' })
    if (!await bcrypt.compare(String(senhaAtual ?? ''), eu.passwordHash)) {
      return reply.code(401).send({ message: 'A senha atual está errada.' })
    }
    if (await bcrypt.compare(novaSenha, eu.passwordHash)) {
      return reply.code(400).send({ message: 'A nova senha é igual à atual.' })
    }

    await db.update(users)
      .set({ passwordHash: await bcrypt.hash(novaSenha, 12), updatedAt: new Date().toISOString() })
      .where(eq(users.id, eu.id))
    // Derruba as outras sessões: se a senha foi trocada por desconfiança,
    // deixar as sessões antigas de pé não resolveria nada.
    await revokeAllForUser(eu.id)
    return { ok: true }
  })

  // POST /api/master/companies/:id/enter — o master "entra" no escritório
  // (gera um token como o admin daquele escritório, sem precisar deslogar).
  app.post('/companies/:id/enter', master, async (req, reply) => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!tenant?.isActive) return reply.code(404).send({ message: 'Empresa não encontrada ou inativa.' })

    const tUsers = await db.select().from(users).where(eq(users.tenantId, tenant.id))
    const target = tUsers.find(u => u.role === 'admin' && u.isActive)
      ?? tUsers.find(u => u.isActive)
    if (!target) return reply.code(404).send({ message: 'Este escritório não tem usuário de acesso.' })

    const payload = { userId: target.id, tenantId: tenant.id, role: target.role }
    const accessToken  = app.jwt.sign(payload)
    const refreshToken = await issueRefreshToken(target.id)

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: target.id, name: target.name, email: target.email,
        role: target.role, tenantId: tenant.id,
        avatarUrl: target.avatarUrl, oabNumber: target.oabNumber,
        menuAccess: menuAccessFor(tenant, target.id, target.role),
      },
      tenant: {
        id: tenant.id, name: tenant.name, slug: tenant.slug, logoUrl: tenant.logoUrl,
      },
    })
  })
}
