// O laço de recarregamento na abertura do sistema.
//
// Sintoma: "carrega, para e carrega, para e carrega" — a tela nunca assenta.
//
// Causa: clearTokens() apagava só `pj_access_token` e `pj_refresh_token`, e
// deixava `pj_auth` — onde o zustand guarda o usuário — intacto. Com o usuário
// ainda guardado:
//
//   RequireAuth vê o usuário            → deixa entrar no app
//   o app chama a API sem token válido  → 401
//   o refresh falha                     → location.href = '/login'
//   a tela de login vê o usuário        → navega de volta para /app
//   ... e recomeça, com um recarregamento inteiro a cada volta.
//
// Este arquivo roda sem servidor: simula o localStorage e observa o que
// sobra depois de cada passo.
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }

// ── localStorage e window de mentira, para exercitar o código de verdade ──
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
  clear: () => memoria.clear(),
}
let navegacoes = []
globalThis.window = {
  location: {
    pathname: '/app/dashboard',
    replace(destino) { navegacoes.push(destino); this.pathname = destino },
  },
  addEventListener() {},
}

const { sanearSessao, clearTokens, setTokens } =
  await import('../../client/src/lib/api.js')

// Como uma sessão de verdade fica guardada.
const sessaoCompleta = () => {
  memoria.clear()
  setTokens({ access: 'jwt-de-mentira', refresh: 'refresh-de-mentira' })
  localStorage.setItem('pj_auth', JSON.stringify({
    state: { user: { id: 'usr_1', name: 'Ana', role: 'admin' }, tenant: { id: 'tnt_1' } },
  }))
}
const temUsuario = () => !!localStorage.getItem('pj_auth')
const temRefresh = () => !!localStorage.getItem('pj_refresh_token')

console.log('\n── 1. O estado que produzia o laço ──')
{
  sessaoCompleta()
  // O que o clearTokens ANTIGO fazia: só os dois tokens.
  localStorage.removeItem('pj_access_token')
  localStorage.removeItem('pj_refresh_token')

  if (temUsuario() && !temRefresh())
    ok('usuário guardado sem refresh token — é exatamente daqui que o laço saía')
  else bad('não consegui reproduzir o estado ruim')

  // O app abriria assim: RequireAuth vê usuário, entra, chama API, 401,
  // refresh falha, volta para o login, o login vê usuário, entra de novo...
  if (sanearSessao()) ok('sanearSessao() detecta a sessão pela metade na partida')
  else bad('sanearSessao() não detectou nada')
  if (!temUsuario()) ok('e apaga o usuário — o app não entra mais, cai no login limpo')
  else bad('o usuário sobreviveu; o laço continuaria')
}

console.log('\n── 2. clearTokens agora leva a sessão inteira ──')
{
  sessaoCompleta()
  localStorage.setItem('pj_master_backup', '{"user":{"role":"master"}}')
  clearTokens()

  if (!localStorage.getItem('pj_access_token')) ok('access token apagado')
  else bad('access token sobreviveu')
  if (!temRefresh()) ok('refresh token apagado')
  else bad('refresh token sobreviveu')
  if (!temUsuario()) ok('usuário apagado (era o que faltava)')
  else bad('usuário sobreviveu — o laço voltaria')
  if (!localStorage.getItem('pj_master_backup')) ok('backup do "entrar como" do master apagado junto')
  else bad('backup do master ficou para trás')
}

console.log('\n── 3. Sessão sã não é tocada ──')
{
  sessaoCompleta()
  if (sanearSessao() === false) ok('com os dois tokens no lugar, não mexe em nada')
  else bad('saneou uma sessão que estava boa')
  if (temUsuario() && temRefresh()) ok('usuário e refresh continuam lá')
  else bad('apagou o que não devia')

  // Ninguém logado: nada a sanear, e nada a apagar.
  memoria.clear()
  if (sanearSessao() === false) ok('sem sessão nenhuma, não faz nada')
  else bad('inventou trabalho com o armazenamento vazio')
}

console.log('\n── 4. O redirecionamento não recarrega em cima de si mesmo ──')
{
  // A outra metade do laço: `location.href = '/login'` estando em /login já
  // é um recarregamento inteiro, à toa.
  // Sem os comentários: este arquivo de teste e o próprio api.js EXPLICAM o
  // laço citando `location.href = '/login'` em prosa. Procurar no texto cru
  // encontraria a explicação e acusaria o código errado.
  const semComentarios = (txt) => txt
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const fonte = semComentarios(await import('node:fs').then(fs =>
    fs.readFileSync('client/src/lib/api.js', 'utf8')))

  if (!fonte.includes("location.href = '/login'"))
    ok("location.href para /login não existe mais")
  else bad("ainda usa location.href, que empilha histórico e recarrega")
  if (fonte.includes("window.location.pathname === '/login'"))
    ok('e o código verifica se já está no login antes de navegar')
  else bad('não há guarda contra redirecionar para onde já se está')
  if (fonte.includes('location.replace'))
    ok('usa replace: o botão voltar não devolve para a tela quebrada')
  else bad('não usa replace')
}

console.log('\n── 5. O app limpa a sessão ANTES de montar ──')
{
  const main = await import('node:fs').then(fs =>
    fs.readFileSync('client/src/main.jsx', 'utf8'))
  // `createRoot` também aparece na linha do import, lá em cima — o que conta
  // é onde ele é CHAMADO.
  const posSanear = main.indexOf('\nsanearSessao()')
  const posRender = main.indexOf('createRoot(document')

  if (posSanear > 0 && posRender > 0 && posSanear < posRender)
    ok('sanearSessao() roda antes do createRoot — o laço nunca chega a começar')
  else bad('a limpeza não acontece antes de montar o app')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
