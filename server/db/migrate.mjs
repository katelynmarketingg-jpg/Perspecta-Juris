import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// ssl: o banco de produção (Supabase) exige conexão cifrada, igual ao que
// db/index.js faz. Rodando à mão contra produção sem isto, a conexão é
// recusada e parece que o banco está fora do ar.
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
})
const db = drizzle(client)

console.log('Running migrations...')
await migrate(db, { migrationsFolder: './server/db/migrations' })
console.log('Migrations complete.')
await client.end()
