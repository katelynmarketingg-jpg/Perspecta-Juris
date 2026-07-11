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
    const passwordHash = await bcrypt.hash('001', 12)
    await db.insert(users).values({
      id:           userId,
      tenantId:     tenantId,
      name:         'Katelyn',
      loginName:    'katelyn',
      email:        null,
      passwordHash,
      role:         'master',
      isActive:     true,
      createdAt:    now,
      updatedAt:    now,
    })
    console.log('✓ Usuário master "Katelyn" criado.')
    console.log('  Empresa: Perspecta Juris')
    console.log('  Nome: katelyn')
    console.log('  Senha: 001')
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
