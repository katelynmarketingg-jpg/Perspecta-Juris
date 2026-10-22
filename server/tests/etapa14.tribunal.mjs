// As sessões dos portais dos tribunais não tinham dono.
//
// A sessão de um portal É a pessoa: quem tem os cookies dela consulta o
// tribunal como ela — processos sigilosos inclusive.
//
// `listSessions()` devolvia TODAS as sessões vivas no servidor, com o
// sessionId, para qualquer usuário autenticado, de qualquer escritório.
// Bastava chamar a rota, copiar o id e consultar o tribunal com a credencial
// do advogado de outro escritório. Derrubar a sessão alheia também passava.
//
// Este teste não entra em tribunal nenhum: exercita a regra que decide quem
// vê, quem usa e quem derruba a sessão de quem. A sessão é montada à mão,
// porque entrar de verdade exigiria credencial real e deixaria a suíte refém
// do portal estar no ar.
import bcrypt from 'bcryptjs'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)

const servicoTrib = await import('../services/tribunalService.js')
const { createSession, listSessions, logout, cookiesDaSessao, __sessoes } = servicoTrib

const DONA   = { tenantId: 'tnt_trib_a', userId: 'usr_trib_a' }
const VIZINHO = { tenantId: 'tnt_trib_b', userId: 'usr_trib_b' }
// Mesmo escritório, outra pessoa: a credencial do portal é pessoal, não do
// escritório — quem entrou com o próprio CPF não emprestou nada a ninguém.
const COLEGA = { tenantId: 'tnt_trib_a', userId: 'usr_trib_a2' }

const montarSessao = (id, dono, tribunal = 'tjrs') => {
  __sessoes.set(id, {
    tribunal, cookies: { JSESSIONID: 'segredo-da-advogada' },
    tenantId: dono.tenantId, userId: dono.userId,
    expiresAt: Date.now() + 3600_000,
  })
}

console.log('\n── 1. Sessão sem dono não nasce ──')
{
  let erro = null
  try { await createSession('tjrs', { cpf: '1', password: 'x' }, null) }
  catch (e) { erro = e.message }
  if (erro?.includes('dono')) ok('recusada na origem, antes de tocar no portal')
  else bad(`deu: ${erro}`)
}

console.log('\n── 2. Só a dona enxerga a sessão dela ──')
{
  __sessoes.clear()
  montarSessao('sess_a', DONA)

  eq(listSessions(DONA).tjrs?.sessionId, 'sess_a', 'a dona vê a sessão')
  eq(Object.keys(listSessions(VIZINHO)).length, 0, 'o outro escritório não vê nada')
  eq(Object.keys(listSessions(COLEGA)).length, 0, 'nem o colega do mesmo escritório')
  if (!JSON.stringify(listSessions(VIZINHO)).includes('sess_a')) ok('e o id não aparece em lugar nenhum da resposta dele')
  else bad('o sessionId vazou')
}

console.log('\n── 3. Sessão alheia não vira credencial de busca ──')
{
  __sessoes.clear()
  montarSessao('sess_a', DONA)

  eq(Object.keys(cookiesDaSessao('tjrs', 'sess_a', VIZINHO)).length, 0,
     'o vizinho não recebe os cookies da sessão alheia')
  eq(Object.keys(cookiesDaSessao('tjrs', 'sess_a', COLEGA)).length, 0,
     'o colega do mesmo escritório também não')
  eq(cookiesDaSessao('tjrs', 'sess_a', DONA).JSESSIONID, 'segredo-da-advogada',
     'a dona recebe os dela')
  eq(Object.keys(cookiesDaSessao('trt4', 'sess_a', DONA)).length, 0,
     'e sessão do TJRS não serve para o TRT-4')
  eq(Object.keys(cookiesDaSessao('tjrs', 'inventado', DONA)).length, 0,
     'id inventado não devolve nada')
}

console.log('\n── 4. Derrubar sessão: só a própria ──')
{
  __sessoes.clear()
  montarSessao('sess_a', DONA)

  eq(logout('sess_a', VIZINHO), false, 'o vizinho não derruba')
  eq(__sessoes.has('sess_a'), true, 'e a sessão continua de pé')
  eq(logout('sess_a', COLEGA), false, 'o colega também não')
  eq(logout('sess_a', DONA), true, 'a dona derruba a própria')
  eq(__sessoes.has('sess_a'), false, 'e ela some de verdade')
}

console.log('\n── 5. Sessão vencida não vale, nem para a dona ──')
{
  __sessoes.clear()
  __sessoes.set('sess_velha', {
    tribunal: 'tjrs', cookies: { JSESSIONID: 'x' },
    tenantId: DONA.tenantId, userId: DONA.userId,
    expiresAt: Date.now() - 1000,
  })
  eq(Object.keys(listSessions(DONA)).length, 0, 'não aparece na lista')
  eq(__sessoes.has('sess_velha'), false, 'e é descartada do cofre')
}

console.log('\n── 6. As rotas passam o dono adiante ──')
{
  // De nada adianta o serviço checar o dono se a rota não disser quem é.
  const { readFileSync } = await import('node:fs')
  const rota = readFileSync('server/routes/tribunal.js', 'utf8')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

  for (const trecho of [
    'createSession(tribunal, { cpf, password }, dono)',
    'getProcessesByOAB(tribunal, oabNum, oabUF, sessionId, dono)',
    'listSessions({ tenantId: req.user.tenantId, userId: req.user.userId })',
    'logout(req.params.id, { tenantId: req.user.tenantId, userId: req.user.userId })',
  ]) {
    if (rota.includes(trecho)) ok(`a rota identifica o dono em ${trecho.split('(')[0]}`)
    else bad(`a rota não passa o dono em ${trecho.split('(')[0]}`)
  }
}

console.log('\n── 7. "Entrou" tem de significar entrou ──')
{
  // A checagem antiga procurava duas frases de erro específicas e, fora isso,
  // aceitava qualquer cookie de sessão como prova. Só que o cookie de sessão
  // vem no primeiro GET, ANTES de qualquer senha — não prova nada. Resultado:
  // senha errada podia virar "Conectado", e a pessoa confiaria que os
  // sigilosos vieram.
  const { aindaNaTelaDeLogin, pedeVerificacaoHumana, conferirEntrada } = servicoTrib

  const telaDeLogin = `<html><form action="/login">
    <input name="username" type="text"><input name="password" type="password">
    <input type="submit" value="Entrar"></form></html>`
  const jaDentro = `<html><div id="menu">Bem-vindo, Dra. Karen</div>
    <a href="/sair">Sair</a><table id="processos"></table></html>`
  const comCaptcha = `<html><form><input type="password" name="senha">
    <div class="g-recaptcha" data-sitekey="x"></div></form></html>`

  eq(aindaNaTelaDeLogin(telaDeLogin), true, 'reconhece a tela de login pelo campo de senha')
  eq(aindaNaTelaDeLogin(jaDentro), false, 'e não confunde a página de dentro')
  eq(aindaNaTelaDeLogin(''), false, 'resposta vazia não vira tela de login')
  eq(pedeVerificacaoHumana(comCaptcha), true, 'reconhece captcha')
  eq(pedeVerificacaoHumana(jaDentro), false, 'e não vê captcha onde não tem')

  // O caso que o código antigo deixava passar: erro com outra redação.
  const erroComOutraRedacao = `<html><p>Dados de acesso não conferem.</p>
    <form><input name="password" type="password"></form></html>`
  let recusou = false
  try { conferirEntrada('TJRS', erroComOutraRedacao) } catch { recusou = true }
  eq(recusou, true, 'erro com redação diferente é recusado (o antigo aceitaria)')

  let msgCaptcha = ''
  try { conferirEntrada('TRT-4', comCaptcha) } catch (e) { msgCaptcha = e.message }
  if (/captcha|verificação humana/i.test(msgCaptcha)) ok('captcha dá mensagem própria, não "confira a senha"')
  else bad(`mensagem do captcha: ${msgCaptcha}`)

  let passou = true
  try { conferirEntrada('TJRS', jaDentro) } catch { passou = false }
  eq(passou, true, 'página de dentro passa')
}

console.log('\n── 8. O cliente manda o token certo ──')
{
  // As quatro chamadas liam localStorage.pj_token — chave que não existe (o
  // token mora em pj_access_token). Iam sempre sem credencial, e o servidor
  // respondia 401 antes de qualquer coisa: esta tela nunca entrou em tribunal
  // nenhum. Agora passam pelo api.js, que sabe o nome da chave e renova token
  // vencido.
  const { readFileSync } = await import('node:fs')
  const cli = readFileSync('client/src/lib/tribunalScraper.js', 'utf8')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

  if (!/localStorage\.getItem\(['\"]pj_token['\"]\)/.test(cli)) ok('não lê mais a chave que não existe')
  else bad('ainda lê localStorage.pj_token')
  if (!/fetch\(\s*['\"`]\/api\/tribunal/.test(cli)) ok('não chama fetch na mão para /api/tribunal')
  else bad('ainda chama fetch direto, sem o api.js')
  for (const chamada of ['api.post(\'/api/tribunal/login\'', 'api.get(\'/api/tribunal/sessions\'']) {
    if (cli.includes(chamada)) ok(`usa ${chamada.split('(')[0]} para falar com o servidor`)
    else bad(`não encontrei ${chamada}`)
  }
}

console.log('\n── 9. Sem login não se chega perto ──')
{
  for (const [rota, metodo] of [['/api/tribunal/sessions', 'GET'], ['/api/tribunal/login', 'POST']]) {
    const r = await fetch(`${BASE}${rota}`, {
      method: metodo, headers: { 'Content-Type': 'application/json' },
      body: metodo === 'POST' ? JSON.stringify({ tribunal: 'tjrs', cpf: '1', password: 'x' }) : undefined,
    })
    eq(r.status, 401, `${metodo} ${rota} sem token`)
  }
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
