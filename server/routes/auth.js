import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { eq, and, ilike } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, tenants, refreshTokens } from '../db/schema.js'

const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? '7')

function refreshExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_EXPIRES_DAYS)
  return d.toISOString()
}

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
      return reply.code(401).send({ message: 'Credenciais inválidas.' })
    }

    const valid = await bcrypt.compare(senha, user.passwordHash)
    if (!valid) return reply.code(401).send({ message: 'Credenciais inválidas.' })

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id))

    const payload = { userId: user.id, tenantId: user.tenantId, role: user.role }
    const accessToken  = app.jwt.sign(payload)
    const refreshToken = nanoid(64)
    const tokenHash    = await bcrypt.hash(refreshToken, 8)

    await db.insert(refreshTokens).values({
      id: nanoid(),
      userId: user.id,
      tokenHash,
      expiresAt: refreshExpiry(),
      createdAt: new Date().toISOString(),
    })

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id:        user.id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        tenantId:  user.tenantId,
        avatarUrl: user.avatarUrl,
        oabNumber: user.oabNumber,
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
    const tokens = await db.select().from(refreshTokens)
    const match = tokens.find(async t => await bcrypt.compare(refreshToken, t.tokenHash))

    if (!match || new Date(match.expiresAt) < new Date()) {
      return reply.code(401).send({ message: 'Refresh token inválido ou expirado.' })
    }

    const [user] = await db.select().from(users).where(eq(users.id, match.userId)).limit(1)
    if (!user?.isActive) return reply.code(401).send({ message: 'Usuário inativo.' })

    await db.delete(refreshTokens).where(eq(refreshTokens.id, match.id))

    const newRefreshToken = nanoid(64)
    const tokenHash = await bcrypt.hash(newRefreshToken, 8)
    await db.insert(refreshTokens).values({
      id: nanoid(),
      userId: user.id,
      tokenHash,
      expiresAt: refreshExpiry(),
      createdAt: new Date().toISOString(),
    })

    const payload = { userId: user.id, tenantId: user.tenantId, role: user.role }
    return reply.send({
      accessToken: app.jwt.sign(payload),
      refreshToken: newRefreshToken,
    })
  })

  // POST /api/auth/logout
  app.post('/logout', { preHandler: [app.authenticate] }, async (req, reply) => {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, req.user.userId))
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
    return { user, tenant }
  })
}
