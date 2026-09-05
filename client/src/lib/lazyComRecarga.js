// ─────────────────────────────────────────────────────────────────────────
//  lazy() que sobrevive a um deploy no meio da sessão.
//
//  O Vite gera nomes com hash (DashboardPage-PneTvznC.js) e o build apaga os
//  arquivos antigos. Quem estava com o sistema aberto na hora da publicação
//  fica com um index.html que aponta para arquivos que não existem mais: ao
//  trocar de tela, o import falha e o app inteiro cai com
//  "Failed to fetch dynamically imported module".
//
//  Não é erro de código nem de rede — é o app tentando carregar uma versão
//  que acabou de ser substituída. A correção é recarregar a página uma vez,
//  que traz o index.html novo com os nomes certos.
//
//  A trava em sessionStorage existe porque um recarregamento automático sem
//  limite vira laço infinito quando o arquivo some de verdade. Na segunda
//  falha seguida, deixa o erro aparecer — mentir que está tudo bem seria pior.
// ─────────────────────────────────────────────────────────────────────────
import { lazy } from 'react'

const CHAVE = 'pj_recarregou_por_chunk'

// A mensagem varia por navegador: Chrome fala em "dynamically imported
// module", Firefox em "error loading dynamically imported module", Safari em
// "Importing a module script failed".
function ehFalhaDeChunk(err) {
  const m = String(err?.message ?? err ?? '').toLowerCase()
  return m.includes('dynamically imported module')
    || m.includes('importing a module script failed')
    || m.includes('failed to fetch')
    || m.includes('error loading')
}

export function lazyComRecarga(carregar) {
  return lazy(async () => {
    try {
      const mod = await carregar()
      // Carregou: a sessão está sã de novo, libera a trava para a próxima vez.
      try { sessionStorage.removeItem(CHAVE) } catch { /* modo privado */ }
      return mod
    } catch (err) {
      if (!ehFalhaDeChunk(err)) throw err

      let jaTentou = false
      try { jaTentou = sessionStorage.getItem(CHAVE) === '1' } catch { /* modo privado */ }
      if (jaTentou) throw err

      try { sessionStorage.setItem(CHAVE, '1') } catch { /* modo privado */ }
      // `true` força buscar do servidor em vez do cache.
      window.location.reload(true)

      // A página está indo embora; esta Promise nunca resolve, e é isso que
      // evita o erro piscar na tela antes do recarregamento.
      return new Promise(() => {})
    }
  })
}
