// Os avisos do sistema não apareciam.
//
// O uiStore tinha showToast() desde sempre e 23 telas o chamavam — cerca de
// 140 vezes. Mas NENHUM componente lia `toast` para desenhar alguma coisa.
// Todo aviso de sucesso e todo aviso de erro caía no vazio.
//
// O sintoma que denunciou: "Calcular Planejamento Previdenciário" não fazia
// nada. Sem a data de nascimento o código dizia "Informe a data de nascimento"
// e voltava — mas a frase não tinha onde aparecer, e a tela ficava parada.
//
// Roda sem servidor e sem banco: lê o código e simula o store.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)

const SRC = 'client/src'
const arquivos = []
;(function varrer(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) varrer(caminho)
    else if (/\.(jsx?|mjs)$/.test(nome)) arquivos.push(caminho)
  }
})(SRC)
const ler = (f) => readFileSync(f, 'utf8')
const semComentarios = (t) => t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

console.log('\n── 1. Alguém desenha o aviso na tela ──')
{
  const chamadores = arquivos.filter(f => /showToast\s*\(/.test(semComentarios(ler(f))))
  if (chamadores.length >= 20) ok(`${chamadores.length} telas dependem do aviso para se explicar`)
  else bad(`só ${chamadores.length} chamam showToast — a varredura falhou?`)

  // O que faltava: alguém que LEIA o toast do store.
  const leitores = arquivos.filter(f => {
    const t = semComentarios(ler(f))
    return /useUiStore\s*\(\s*s\s*=>\s*s\.toast\s*\)/.test(t) || /\bs\.toast\b/.test(t)
  }).filter(f => !f.includes('stores/uiStore'))

  if (leitores.length) ok(`o aviso é lido e desenhado em ${leitores.map(f => f.split('/').pop()).join(', ')}`)
  else bad('ninguém lê `toast` do store — os avisos continuam invisíveis')
}

console.log('\n── 2. O Toaster está montado na raiz do app ──')
{
  const app = semComentarios(ler(`${SRC}/App.jsx`))
  if (/import\s+Toaster\s+from/.test(app)) ok('App.jsx importa o Toaster')
  else bad('App.jsx não importa o Toaster')
  if (/<Toaster\s*\/>/.test(app)) ok('e o renderiza')
  else bad('importa mas não renderiza')

  // Fora do RouterProvider: dentro, o aviso morreria na troca de tela.
  const posRouter = app.indexOf('<RouterProvider')
  const posToaster = app.indexOf('<Toaster')
  if (posToaster > posRouter) ok('fica ao lado do router, não dentro dele — sobrevive à troca de tela')
  else bad('está dentro do router e some ao navegar')
}

console.log('\n── 3. O comportamento do store, exercitado ──')
{
  // O store real, com o mínimo de navegador que ele precisa.
  const memoria = new Map()
  globalThis.localStorage = {
    getItem: (k) => memoria.get(k) ?? null,
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  }
  globalThis.document = { documentElement: { classList: { toggle() {} } } }
  const { useUiStore } = await import('../../client/src/stores/uiStore.js')

  const { showToast, clearToast } = useUiStore.getState()
  eq(useUiStore.getState().toast, null, 'começa sem aviso nenhum')

  showToast('Informe a data de nascimento.', 'error')
  const t = useUiStore.getState().toast
  if (t?.message === 'Informe a data de nascimento.') ok('a mensagem chega ao store')
  else bad(`store recebeu ${JSON.stringify(t)}`)
  eq(t?.type, 'error', 'com o tipo certo')
  if (typeof t?.id === 'number') ok('e um id, para o fechamento automático saber qual fechar')
  else bad('sem id')

  clearToast()
  eq(useUiStore.getState().toast, null, 'fechar limpa o aviso')

  // Um aviso novo substitui o anterior — não empilha nem se perde.
  showToast('primeiro', 'info')
  showToast('segundo', 'success')
  eq(useUiStore.getState().toast?.message, 'segundo', 'o aviso mais recente é o que aparece')
  clearToast()
}

console.log('\n── 4. O Toaster cobre os quatro tipos usados no sistema ──')
{
  const toaster = ler(`${SRC}/components/layout/Toaster.jsx`)
  for (const tipo of ['success', 'error', 'warning', 'info']) {
    if (toaster.includes(tipo)) ok(`trata '${tipo}'`)
    else bad(`não trata '${tipo}'`)
  }
  // Tipo desconhecido não pode virar tela em branco.
  if (/\?\?\s*ESTILOS\.info/.test(toaster)) ok('tipo desconhecido cai no padrão em vez de quebrar')
  else bad('sem fallback para tipo desconhecido')
  if (/aria-live/.test(toaster)) ok('anunciado por leitor de tela (aria-live)')
  else bad('sem aria-live')
}

console.log('\n── 5. O erro do planejamento não depende só do aviso que some ──')
{
  const pp = semComentarios(ler(`${SRC}/modules/calculator/PrevidenciarioPlanner.jsx`))

  if (/setErro\(/.test(pp)) ok('o erro também fica guardado na tela')
  else bad('só existe o aviso passageiro')
  if (/\{erro && \(/.test(pp)) ok('e é desenhado junto do botão, onde a pessoa está olhando')
  else bad('o erro guardado não é mostrado')
  if (/setErro\(''\)/.test(pp)) ok('e some quando o problema é resolvido')
  else bad('o erro nunca é limpo')

  // O campo obrigatório vazio precisa se destacar sozinho.
  if (/border-amber-500/.test(pp)) ok('o campo obrigatório vazio fica marcado')
  else bad('nada distingue o campo que falta')
  if (/\.focus\(\)/.test(pp)) ok('e o cursor vai para ele')
  else bad('não leva o foco ao campo')
}

console.log('\n── 6. O cliente pode ser vinculado desde o começo ──')
{
  const pp = semComentarios(ler(`${SRC}/modules/calculator/PrevidenciarioPlanner.jsx`))
  if (/api\.clients\.list/.test(pp)) ok('a lista de clientes é carregada')
  else bad('não busca clientes')
  if (/escolherCliente/.test(pp)) ok('escolher o cliente preenche os dados dele')
  else bad('não há vínculo com cliente')
  // Não pode atropelar o que já foi digitado ou veio do CNIS.
  if (/s\.nascimento \|\|/.test(pp)) ok('não sobrescreve o que já estava preenchido')
  else bad('sobrescreveria dados digitados à mão')
  if (/avulso/.test(pp)) ok('e dá para seguir sem cliente nenhum')
  else bad('força escolher um cliente')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
