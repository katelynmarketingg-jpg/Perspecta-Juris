// ─────────────────────────────────────────────────────────────────────────
//  Migrações no arranque do servidor.
//
//  O deploy só rodava `npm install && npm run build` — nunca `db:migrate`.
//  Ou seja: coluna nova no código, banco antigo em produção, e o erro
//  aparecia só quando alguém usasse a tela (500 engolido pela interface).
//
//  Rodar aqui garante que o banco acompanha o código sem ninguém precisar
//  lembrar. O migrador do Drizzle guarda o que já aplicou, então repetir é
//  inofensivo: no arranque seguinte não há nada a fazer.
//
//  Falha NÃO derruba o servidor: um banco momentaneamente fora do ar na hora
//  do arranque não pode deixar o escritório sem sistema. Mas grita no log,
//  porque seguir com o banco atrasado é problema de verdade.
// ─────────────────────────────────────────────────────────────────────────
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export async function migrarNoArranque(log = console) {
  if (process.env.AUTO_MIGRATE === 'false') {
    log.warn?.('[banco] AUTO_MIGRATE=false — migrações não foram verificadas.')
    return { rodou: false, motivo: 'desligado' }
  }
  if (!process.env.DATABASE_URL) return { rodou: false, motivo: 'sem DATABASE_URL' }

  // Conexão própria, fechada no fim: não mexe no pool que a aplicação usa.
  // Duas coisas aqui que não são detalhe:
  //
  // ssl: o banco de produção (Supabase) só aceita conexão cifrada — é o mesmo
  // que db/index.js faz. Sem isto, a migração do arranque falharia logo na
  // conexão, e o aviso no log seria tratado como "banco fora do ar" quando na
  // verdade era configuração faltando aqui.
  //
  // onnotice: o migrador faz CREATE ... IF NOT EXISTS e o Postgres responde
  // "já existe, pulando" a cada arranque. Isso enchia o log de ruído.
  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
    onnotice: () => {},
  })
  try {
    await migrate(drizzle(client), { migrationsFolder: './server/db/migrations' })
    log.info?.('[banco] migrações em dia.')
    return { rodou: true }
  } catch (err) {
    log.error?.(`[banco] FALHA ao aplicar migrações: ${err?.message ?? err}. ` +
      'O servidor vai subir, mas telas que dependem de colunas novas podem falhar. ' +
      'Rode `npm run db:migrate` com a DATABASE_URL de produção.')
    return { rodou: false, motivo: err?.message ?? String(err) }
  } finally {
    await client.end().catch(() => {})
  }
}
