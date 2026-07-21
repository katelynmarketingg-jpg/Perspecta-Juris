import 'dotenv/config'
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
// O build do Vite pode cair em <raiz>/dist ou em <raiz>/client/dist
// dependendo de como o outDir é resolvido. Procuramos nos dois.
const DIST = [join(ROOT, 'dist'), join(ROOT, 'client', 'dist')].find(existsSync) ?? join(ROOT, 'dist')
const FILES_DIR = process.env.FILES_DIR ?? join(ROOT, 'data', 'files')

// Ensure dirs exist
;[join(ROOT, 'data'), FILES_DIR].forEach(d => !existsSync(d) && mkdirSync(d, { recursive: true }))

// ── Fail-fast de segurança (produção) ─────────────────────────
// Grandes sistemas se recusam a subir com segredos padrão/ausentes.
const IS_PROD = process.env.NODE_ENV === 'production'
if (IS_PROD) {
  const secret = process.env.JWT_SECRET
  const fatal = []
  if (!secret || secret === 'dev-secret-change-in-production' || secret.length < 32)
    fatal.push('JWT_SECRET ausente, padrão ou curto demais (use ≥32 caracteres aleatórios).')
  if (!process.env.DATABASE_URL) fatal.push('DATABASE_URL ausente.')
  if (fatal.length) {
    console.error('❌ Configuração insegura — abortando:\n  - ' + fatal.join('\n  - '))
    process.exit(1)
  }
}

const app = Fastify({
  logger: process.env.NODE_ENV !== 'production',
  trustProxy: true,
})

// ── Plugins ──────────────────────────────────────────────────
await app.register(fastifyCors, {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CLIENT_ORIGIN ?? true)
    : true,
  credentials: true,
})

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '2h' },
})

await app.register(fastifyRateLimit, {
  max: 200,
  timeWindow: '1 minute',
})

await app.register(fastifyMultipart, {
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }, // 50 MB max
})

// ── Cabeçalhos de segurança (helmet-equivalente, sem dependência) ──
app.addHook('onSend', async (req, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('X-XSS-Protection', '0')
  if (IS_PROD) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  return payload
})

// ── Auth decorator ────────────────────────────────────────────
app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ message: 'Token inválido ou expirado.' })
  }
})

app.decorate('requireRoles', (roles) => async (req, reply) => {
  await app.authenticate(req, reply)
  if (!roles.includes(req.user?.role)) {
    reply.code(403).send({ message: 'Permissão insuficiente.' })
  }
})

// ── Routes ────────────────────────────────────────────────────
const { default: authRoutes }      = await import('./routes/auth.js')
const { default: clientRoutes }    = await import('./routes/clients.js')
const { default: processRoutes }   = await import('./routes/processes.js')
const { default: deadlineRoutes }  = await import('./routes/deadlines.js')
const { default: taskRoutes }      = await import('./routes/tasks.js')
const { default: financialRoutes } = await import('./routes/financial.js')
const { default: documentRoutes }  = await import('./routes/documents.js')
const { default: settingsRoutes }  = await import('./routes/settings.js')
const { default: dashboardRoutes } = await import('./routes/dashboard.js')
const { default: tribunalRoutes }  = await import('./routes/tribunal.js')
const { default: signatureRoutes } = await import('./routes/signatures.js')
const { default: diarioRoutes }    = await import('./routes/diario.js')
const { default: masterRoutes }    = await import('./routes/master.js')

await app.register(authRoutes,      { prefix: '/api/auth' })
await app.register(clientRoutes,    { prefix: '/api/clients' })
await app.register(processRoutes,   { prefix: '/api/processes' })
await app.register(deadlineRoutes,  { prefix: '/api/deadlines' })
await app.register(taskRoutes,      { prefix: '/api/tasks' })
await app.register(financialRoutes, { prefix: '/api/financial' })
await app.register(documentRoutes,  { prefix: '/api/documents' })
await app.register(settingsRoutes,  { prefix: '/api/settings' })
await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
await app.register(tribunalRoutes,  { prefix: '/api/tribunal' })
await app.register(signatureRoutes, { prefix: '/api/signatures' })
await app.register(diarioRoutes,    { prefix: '/api/diario' })
await app.register(masterRoutes,    { prefix: '/api/master' })

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', async () => ({
  status: 'ok',
  service: 'perspecta-juris',
  version: '0.1.0',
  ts: new Date().toISOString(),
}))

// ── Marca do sistema (PÚBLICA — tela de login e todo o app) ────
const { getBranding } = await import('./lib/branding.js')
app.get('/api/branding', async () => getBranding())

// ── Static files (production) ─────────────────────────────────
if (existsSync(DIST)) {
  await app.register(fastifyStatic, { root: DIST, wildcard: false })
  app.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api')) {
      reply.sendFile('index.html', DIST)
    } else {
      reply.code(404).send({ message: 'Not found' })
    }
  })
}

// ── Start ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '8788')
const HOST = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`\n🚀 Perspecta Juris rodando em http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
