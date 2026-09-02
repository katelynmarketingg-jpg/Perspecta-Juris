import bcrypt from 'bcryptjs'
import { eq, and, ilike } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, tenants } from '../db/schema.js'
import { menuAccessFor } from '../lib/permissions.js'
import {
  issueRefreshToken, findRefreshToken, revokeRefreshToken,
  revokeAllForUser, purgeExpiredTokens, isExpired,
} from '../lib/refreshTokens.js'
import { emitirEventoPerspecta } from '../lib/perspecta-webhook.js'

export default async function authRoutes(app) {
  // POST /api/auth/login  — empresa + nome + senha
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['empresa', 'nome', 'senha'],
        properties: {
          empresa: { type: 'string', minLength: 1 },
          nome:    { type: 'string', minLength: 1 },
          senha:   { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    const { empresa, nome, senha } = req.body

    // Find tenant by name (case-insensitive)
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(ilike(tenants.name, empresa.trim()))
      .limit(1)

    if (!tenant?.isActive) {
      emitirEventoPerspecta('login.novo', {
        empresa_ref: null, usuario_email: null, ip: req.ip,
        resultado: 'falha', motivo: 'empresa_nao_encontrada',
      })
      return reply.code(401).send({ message: 'Empresa não encontrada ou inativa.' })
    }

    // Find user by loginName within tenant
    const [user] = await db
      .select({
        id: users.id, name: users.name, loginName: users.loginName,
        email: users.email, passwordHash: users.passwordHash,
        role: users.role, tenantId: users.tenantId,
        isActive: users.isActive, avatarUrl: users.avatarUrl,
        oabNumber: users.oabNumber,
      })
      .from(users)
      .where(and(
        eq(users.tenantId, tenant.id),
        ilike(users.loginName, nome.trim()),
      ))
      .limit(1)

    if (!user?.isActive) {
      emitirEventoPerspecta('login.novo', {
        empresa_ref: tenant.id, usuario_email: user?.email ?? null, ip: req.ip,
        resultado: 'falha', motivo: 'usuario_inativo_ou_nao_encontrado',
      })
      return reply.code(401).send({ message: 'Credenciais inválidas.' })
    }

    const valid = await bcrypt.compare(senha, user.passwordHash)
    if (!valid) {
      emitirEventoPerspecta('login.novo', {
        empresa_ref: tenant.id, usuario_email: user.email ?? null, ip: req.ip,
        resultado: 'falha', motivo: 'senha_incorreta',
      })
      return reply.code(401).send({ message: 'Credenciais inválidas.' })
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id))
    emitirEventoPerspecta('login.novo', {
      empresa_ref: tenant.id, usuario_email: user.email ?? null, ip: req.ip, resultado: 'sucesso',
    })

    // Limpeza oportunista dos tokens já vencidos (não bloqueia o login).
    await purgeExpiredTokens()

    const payload = { userId: user.id, tenantId: user.tenantId, role: user.role }
    const accessToken  = app.jwt.sign(payload)
    const refreshToken = await issueRefreshToken(user.id)

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        tenantId:   user.tenantId,
        avatarUrl:  user.avatarUrl,
        oabNumber:  user.oabNumber,
        menuAccess: menuAccessFor(tenant, user.id, user.role),
      },
      tenant: {
        id: tenant.id, name: tenant.name, slug: tenant.slug,
        logoUrl: tenant.logoUrl,
      },
    })
  })

  // POST /api/auth/refresh
  app.post('/refresh', {
    schema: {
      body: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
    },
  }, async (req, reply) => {
    const { refreshToken } = req.body

    // Busca a linha EXATA deste token (igualdade sobre o hash, com índice).
    // O código anterior usava Array.find com um predicado async: uma função
    // async devolve sempre uma Promise (truthy), então o find casava sempre
    // a PRIMEIRA linha da tabela — qualquer string virava um token válido do
    // dono daquela linha. Era uma falha de autenticação, não um detalhe.
    const match = await findRefreshToken(refreshToken)

    if (!match || isExpired(match)) {
      if (match) await revokeRefreshToken(match.id)
      return reply.code(401).send({ message: 'Refresh token inválido ou expirado.' })
    }

    const [user] = await db.select().from(users).where(eq(users.id, match.userId)).limit(1)
    if (!user?.isActive) {
      // Usuário desativado: derruba todas as sessões dele.
      await revokeAllForUser(match.userId)
      return reply.code(401).send({ message: 'Usuário inativo.' })
    }

    // O escritório pode ter sido desativado depois que a sessão começou.
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1)
    if (!tenant?.isActive) {
      await revokeAllForUser(user.id)
      return reply.code(401).send({ message: 'Empresa inativa.' })
    }

    // Rotação: o token usado morre e um novo nasce.
    await revokeRefreshToken(match.id)
    const newRefreshToken = await issueRefreshToken(user.id)

    const payload = { userId: user.id, tenantId: user.tenantId, role: user.role }
    return reply.send({
      accessToken: app.jwt.sign(payload),
      refreshToken: newRefreshToken,
    })
  })

  // POST /api/auth/logout
  app.post('/logout', { preHandler: [app.authenticate] }, async (req, reply) => {
    await revokeAllForUser(req.user.userId)
    return reply.code(204).send()
  })

  // GET /api/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email,
                role: users.role, tenantId: users.tenantId, avatarUrl: users.avatarUrl,
                oabNumber: users.oabNumber, oabState: users.oabState, phone: users.phone })
      .from(users).where(eq(users.id, req.user.userId)).limit(1)
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    return { user: { ...user, menuAccess: menuAccessFor(tenant, user?.id, user?.role) }, tenant }
  })
}
