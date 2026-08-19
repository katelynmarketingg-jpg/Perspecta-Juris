// ─────────────────────────────────────────────────────────────────────────
//  Refresh tokens — emissão, validação e rotação.
//
//  Por que SHA-256 e não bcrypt: o token é um nanoid(64) aleatório, com
//  entropia alta demais para ser adivinhado por força bruta. bcrypt existe
//  para proteger segredos de baixa entropia (senhas humanas) e, por ser
//  salgado, torna IMPOSSÍVEL procurar a linha pelo hash — foi exatamente
//  isso que levou o código anterior a varrer a tabela inteira e casar sempre
//  a primeira linha. Com SHA-256 o hash é determinístico: dá para buscar por
//  igualdade, com índice, em uma única linha.
// ─────────────────────────────────────────────────────────────────────────
import { createHash } from 'crypto'
import { nanoid } from 'nanoid'
import { eq, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { refreshTokens } from '../db/schema.js'

const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? '7')

// Hash determinístico usado como chave de busca.
export function hashRefreshToken(token) {
  return createHash('sha256').update(String(token ?? ''), 'utf8').digest('hex')
}

export function refreshExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_EXPIRES_DAYS)
  return d.toISOString()
}

// Cria um refresh token novo para o usuário e devolve o valor em claro
// (que só o dono verá — o banco guarda apenas o hash).
export async function issueRefreshToken(userId) {
  const token = nanoid(64)
  await db.insert(refreshTokens).values({
    id:        nanoid(),
    userId,
    tokenHash: hashRefreshToken(token),
    expiresAt: refreshExpiry(),
    createdAt: new Date().toISOString(),
  })
  return token
}

// Encontra o token pelo hash. Devolve a linha ou null.
// Busca por IGUALDADE — uma linha, usando o índice.
export async function findRefreshToken(token) {
  if (typeof token !== 'string' || !token) return null
  const [row] = await db.select().from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)))
    .limit(1)
  return row ?? null
}

export async function revokeRefreshToken(id) {
  await db.delete(refreshTokens).where(eq(refreshTokens.id, id))
}

export async function revokeAllForUser(userId) {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
}

// Limpeza barata de tokens vencidos. Chamada no login; falha nunca derruba
// a operação principal.
export async function purgeExpiredTokens() {
  try {
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date().toISOString()))
  } catch { /* limpeza é oportunista */ }
}

export function isExpired(row) {
  return !row?.expiresAt || new Date(row.expiresAt) < new Date()
}
