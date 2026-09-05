// ─────────────────────────────────────────────────────────────────────────
//  Trava de execução para tarefas periódicas.
//
//  O servidor roda os jobs com setInterval dentro do próprio processo (é o
//  arranjo mais barato: não exige serviço extra). O risco disso é rodar em
//  duplicidade se um dia houver mais de uma instância no ar — e no caso do
//  DataJud, duplicar significa consumir cota do CNJ em dobro.
//
//  A trava é um UPDATE condicional, que no Postgres é atômico: só uma
//  instância consegue mudar a linha; as outras recebem 0 linhas e desistem.
//  Se o processo morrer no meio, a trava vence sozinha e o próximo ciclo pega.
// ─────────────────────────────────────────────────────────────────────────
import { hostname } from 'os'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'

const QUEM = `${hostname()}:${process.pid}`

/**
 * Tenta pegar a trava. Devolve true se conseguiu.
 * @param {string} nome        identificador do job
 * @param {number} validadeMin por quanto tempo a trava vale (minutos)
 */
export async function tentarTravar(nome, validadeMin = 30) {
  const agora = new Date().toISOString()
  const ate   = new Date(Date.now() + validadeMin * 60_000).toISOString()
  try {
    // Cria a linha se não existir; só sobrescreve se a trava atual já venceu.
    const r = await db.execute(sql`
      insert into job_locks (id, locked_until, locked_by)
      values (${nome}, ${ate}, ${QUEM})
      on conflict (id) do update
        set locked_until = ${ate}, locked_by = ${QUEM}
        where job_locks.locked_until < ${agora}
      returning id
    `)
    const linhas = Array.isArray(r) ? r : (r?.rows ?? [])
    return linhas.length > 0
  } catch (err) {
    console.warn(`[job:${nome}] não foi possível travar:`, err?.message ?? err)
    return false
  }
}

// Libera a trava e guarda o resultado da rodada (para diagnóstico).
export async function destravar(nome, resultado = null) {
  try {
    await db.execute(sql`
      update job_locks
         set locked_until = ${new Date().toISOString()},
             last_run_at  = ${new Date().toISOString()},
             last_result  = ${JSON.stringify(resultado)}::jsonb
       where id = ${nome}
    `)
  } catch { /* a trava vence sozinha */ }
}
