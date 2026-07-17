/**
 * Seed inicial — cria o tenant master e a conta Katelyn.
 * Executar: node server/db/seed.mjs
 */
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { db } from './index.js'
import { tenants, users } from './schema.js'
import { eq } from 'drizzle-orm'

const now = new Date().toISOString()

async function seed() {
  console.log('Iniciando seed...')

  // ── Tenant master ─────────────────────────────────────────
  const tenantId = 'tnt_master_pj'
  const [existing] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)

  if (!existing) {
    await db.insert(tenants).values({
      id:        tenantId,
      slug:      'perspecta-juris',
      name:      'Perspecta Juris',
      plan:      'master',
      isActive:  true,
      settings:  {},
      createdAt: now,
      updatedAt: now,
    })
    console.log('✓ Tenant "Perspecta Juris" criado.')
  } else {
    console.log('— Tenant "Perspecta Juris" já existe.')
  }

  // ── Usuário master Katelyn ────────────────────────────────
  const userId = 'usr_katelyn_master'
  const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!existingUser) {
    // Senha do master vem do ambiente em produção; '001' só para dev local.
    const senhaMaster = process.env.MASTER_PASSWORD ?? '001'
    if (process.env.NODE_ENV === 'production' && (!process.env.MASTER_PASSWORD || process.env.MASTER_PASSWORD.length < 8)) {
      console.error('❌ Defina MASTER_PASSWORD (≥8 caracteres) para criar o administrador em produção.')
      process.exit(1)
    }
    const passwordHash = await bcrypt.hash(senhaMaster, 12)
    await db.insert(users).values({
      id:           userId,
      tenantId:     tenantId,
      name:         'Katelyn',
      loginName:    process.env.MASTER_LOGIN ?? 'katelyn',
      email:        process.env.MASTER_EMAIL ?? null,
      passwordHash,
      role:         'master',
      isActive:     true,
      createdAt:    now,
      updatedAt:    now,
    })
    console.log('✓ Usuário master "Katelyn" criado.')
    console.log('  Empresa: Perspecta Juris')
    console.log('  Login: ' + (process.env.MASTER_LOGIN ?? 'katelyn'))
    console.log('  Senha: ' + (process.env.MASTER_PASSWORD ? '(definida via MASTER_PASSWORD)' : '001 (troque em produção!)'))
  } else {
    console.log('— Usuário "Katelyn" já existe.')
  }

  console.log('\nSeed concluído.')
  process.exit(0)
}

seed().catch(err => {
  console.error('Erro no seed:', err)
  process.exit(1)
})
