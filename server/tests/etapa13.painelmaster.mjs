// O Painel Master só sabia criar, renomear e excluir escritório.
//
// O que faltava, e que ela precisava para tocar o negócio:
//
//  1. VER OS ACESSOS de cada escritório. Para olhar quem entra num escritório
//     era preciso ENTRAR nele como se fosse a pessoa.
//  2. TROCAR A SENHA de um acesso. Quando alguém da equipe esquecia a senha,
//     não havia saída dentro do sistema — era mexer no banco à mão.
//  3. INTERROMPER o acesso de uma pessoa (e não do escritório inteiro).
//  4. TROCAR A PRÓPRIA SENHA. O painel não tinha essa opção, e as
//     Configurações só eram alcançáveis digitando /app no endereço.
//  5. SABER QUEM PAGA e quem está em teste grátis. O sistema nunca guardou.
//
// Duas regras que os testes cobram, porque são as que machucam se falharem:
// suspender ou trocar senha tem de DERRUBAR as sessões abertas (senão a
// pessoa continua dentro com o token que já tinha), e nada aqui pode tocar na
// conta master — é a porta de entrada da dona.
import bcrypt from 'bcryptjs'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

const { db } = await import('../db/index.js')
const { tenants, users, refreshTokens } = await import('../db/schema.js')
const { eq: dbEq, inArray } = await import('drizzle-orm')

// ── fixtures ──────────────────────────────────────────────────────────────
const MST = 'tnt_pm_master', ESC = 'tnt_pm_escritorio', OUTRO = 'tnt_pm_outro'
const now = new Date().toISOString()
await db.delete(tenants).where(inArray(tenants.id, [MST, ESC, OUTRO]))

await db.insert(tenants).values({ id: MST, slug: 'pm-master', name: 'Perspecta PM', plan: 'master',
  isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: 'usr_pm_master', tenantId: MST, name: 'Katelyn', loginName: 'kat',
  passwordHash: await bcrypt.hash('senha-da-dona-123', 12), role: 'master', isActive: true, createdAt: now, updatedAt: now })

for (const [id, slug, nome] of [[ESC, 'pm-escritorio', 'Escritorio PM'], [OUTRO, 'pm-outro', 'Outro PM']]) {
  await db.insert(tenants).values({ id, slug, name: nome, plan: 'starter', isActive: true,
    settings: {}, createdAt: now, updatedAt: now })
}
await db.insert(users).values({ id: 'usr_pm_adm', tenantId: ESC, name: 'Diovana', loginName: 'diovana',
  passwordHash: await bcrypt.hash('senha-dela-0000', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: 'usr_pm_est', tenantId: ESC, name: 'Estagiario', loginName: 'tulio',
  passwordHash: await bcrypt.hash('senha-dele-0000', 12), role: 'estagiario', isActive: true, createdAt: now, updatedAt: now })

const entrar = async (empresa, nome, senha) => {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresa, nome, senha }) })
  return { status: r.status, body: await j(r) }
}
const tkMaster = (await entrar('Perspecta PM', 'kat', 'senha-da-dona-123')).body.accessToken
const tkAdmin  = (await entrar('Escritorio PM', 'diovana', 'senha-dela-0000')).body.accessToken
const HM = { 'Content-Type': 'application/json', Authorization: `Bearer ${tkMaster}` }
const HA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tkAdmin}` }
const soMaster = { Authorization: `Bearer ${tkMaster}` }

const sessoesDe = async (id) => (await db.select().from(refreshTokens).where(dbEq(refreshTokens.userId, id))).length

console.log('\n── 1. O painel enxerga os acessos de cada escritório ──')
{
  const r = await fetch(`${BASE}/api/master/companies/${ESC}/users`, { headers: soMaster })
  eq(r.status, 200, 'lista os acessos')
  const lista = await j(r)
  eq(lista.length, 2, 'dois acessos no escritório')
  const dio = lista.find(u => u.loginName === 'diovana')
  if (dio?.name === 'Diovana' && dio?.role === 'admin') ok('com nome, login e perfil')
  else bad(`acesso veio como ${JSON.stringify(dio)}`)
  if (!('passwordHash' in (dio ?? {}))) ok('e NUNCA devolve o hash da senha')
  else bad('a senha (hash) vazou na listagem')
  if ('lastLoginAt' in (dio ?? {})) ok('mostra quando a pessoa entrou pela última vez')
  else bad('sem o último acesso')

  // Escritório vazio continua respondendo, só que sem ninguém.
  const vazio = await j(await fetch(`${BASE}/api/master/companies/${OUTRO}/users`, { headers: soMaster }))
  eq(vazio.length, 0, 'escritório sem acesso devolve lista vazia')

  const naoExiste = await fetch(`${BASE}/api/master/companies/nao-existe/users`, { headers: soMaster })
  eq(naoExiste.status, 404, 'empresa inexistente: 404')
}

console.log('\n── 2. Trocar a senha de um acesso, do painel ──')
{
  const antes = await sessoesDe('usr_pm_adm')
  if (antes > 0) ok(`a pessoa está logada agora (${antes} sessão)`)
  else bad('fixture sem sessão aberta — o teste do corte não valeria nada')

  const r = await fetch(`${BASE}/api/master/users/usr_pm_adm`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ password: 'senha-nova-do-painel' }) })
  eq(r.status, 200, 'troca a senha')

  // O que interessa: a senha nova entra, a velha não.
  eq((await entrar('Escritorio PM', 'diovana', 'senha-nova-do-painel')).status, 200, 'entra com a senha nova')
  eq((await entrar('Escritorio PM', 'diovana', 'senha-dela-0000')).status, 401, 'a senha antiga para de funcionar')

  // Senha curta é recusada com explicação, não com 500.
  const curta = await fetch(`${BASE}/api/master/users/usr_pm_est`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ password: 'abc' }) })
  eq(curta.status, 400, 'senha curta: 400')
  if (String((await j(curta)).message).includes('8')) ok('e diz o mínimo de caracteres')
  else bad('a mensagem não explica o motivo')
}

console.log('\n── 3. Interromper o acesso de UMA pessoa ──')
{
  // Antes só dava para desativar o escritório inteiro — ou seja, para tirar
  // um estagiário era preciso derrubar o escritório junto.
  const antes = await sessoesDe('usr_pm_est')
  if (antes === 0) { await entrar('Escritorio PM', 'tulio', 'senha-dele-0000') }

  const r = await fetch(`${BASE}/api/master/users/usr_pm_est`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ isActive: false }) })
  eq(r.status, 200, 'interrompe o acesso')
  eq((await entrar('Escritorio PM', 'tulio', 'senha-dele-0000')).status, 401, 'a pessoa não entra mais')
  eq(await sessoesDe('usr_pm_est'), 0, 'e as sessões abertas dela foram derrubadas na hora')

  // O escritório continua de pé, e os outros acessos também.
  const [esc] = await db.select().from(tenants).where(dbEq(tenants.id, ESC))
  eq(esc.isActive, true, 'o escritório continua ativo')
  eq((await entrar('Escritorio PM', 'diovana', 'senha-nova-do-painel')).status, 200, 'o outro acesso segue entrando')

  const voltar = await fetch(`${BASE}/api/master/users/usr_pm_est`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ isActive: true }) })
  eq(voltar.status, 200, 'liberar de novo')
  eq((await entrar('Escritorio PM', 'tulio', 'senha-dele-0000')).status, 200, 'e a pessoa volta a entrar')
}

console.log('\n── 4. A conta master não se mexe por esta porta ──')
{
  // Um engano aqui tranca a dona para fora do próprio sistema.
  const r = await fetch(`${BASE}/api/master/users/usr_pm_master`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ isActive: false }) })
  eq(r.status, 403, 'não dá para suspender a conta master')
  const s = await fetch(`${BASE}/api/master/users/usr_pm_master`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ password: 'tentando-trocar-1234' }) })
  eq(s.status, 403, 'nem trocar a senha dela por aqui')
  eq((await entrar('Perspecta PM', 'kat', 'senha-da-dona-123')).status, 200, 'a dona continua entrando')
}

console.log('\n── 5. Minha conta: a dona troca a própria senha ──')
{
  const semAtual = await fetch(`${BASE}/api/master/me/password`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ senhaAtual: 'chute-errado', novaSenha: 'outra-senha-9999' }) })
  eq(semAtual.status, 401, 'sem a senha atual correta: recusa')

  const curta = await fetch(`${BASE}/api/master/me/password`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ senhaAtual: 'senha-da-dona-123', novaSenha: 'curta' }) })
  eq(curta.status, 400, 'senha nova curta: 400')

  const igual = await fetch(`${BASE}/api/master/me/password`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ senhaAtual: 'senha-da-dona-123', novaSenha: 'senha-da-dona-123' }) })
  eq(igual.status, 400, 'repetir a mesma senha: 400')

  const r = await fetch(`${BASE}/api/master/me/password`, { method: 'PUT', headers: HM,
    body: JSON.stringify({ senhaAtual: 'senha-da-dona-123', novaSenha: 'senha-nova-da-dona-77' }) })
  eq(r.status, 200, 'troca a própria senha')
  eq((await entrar('Perspecta PM', 'kat', 'senha-nova-da-dona-77')).status, 200, 'entra com a nova')
  eq((await entrar('Perspecta PM', 'kat', 'senha-da-dona-123')).status, 401, 'a antiga morre')
}

console.log('\n── 6. Quem paga e quem está testando ──')
{
  const tk2 = (await entrar('Perspecta PM', 'kat', 'senha-nova-da-dona-77')).body.accessToken
  const H2 = { 'Content-Type': 'application/json', Authorization: `Bearer ${tk2}` }
  const so2 = { Authorization: `Bearer ${tk2}` }

  // Nasce sem classificação: o sistema não inventa que alguém é pagante.
  const antes = await j(await fetch(`${BASE}/api/master/companies`, { headers: so2 }))
  const esc0 = antes.find(c => c.id === ESC)
  eq(esc0.cobranca?.situacao, null, 'escritório nasce sem classificação')

  const r = await fetch(`${BASE}/api/master/companies/${ESC}/cobranca`, { method: 'PUT', headers: H2,
    body: JSON.stringify({ situacao: 'pagante', valorMensal: 149.9 }) })
  eq(r.status, 200, 'marca como pagante')

  const t = await fetch(`${BASE}/api/master/companies/${OUTRO}/cobranca`, { method: 'PUT', headers: H2,
    body: JSON.stringify({ situacao: 'teste', trialAte: '2026-12-01' }) })
  eq(t.status, 200, 'marca o outro como teste grátis')

  const depois = await j(await fetch(`${BASE}/api/master/companies`, { headers: so2 }))
  const pag = depois.find(c => c.id === ESC)
  const tst = depois.find(c => c.id === OUTRO)
  eq(pag.cobranca.situacao, 'pagante', 'a classificação volta na listagem')
  eq(pag.valorMensal, 149.9, 'com o valor combinado')
  eq(tst.cobranca.situacao, 'teste', 'e o do teste')
  eq(tst.cobranca.trialAte, '2026-12-01', 'com a data de fim do teste')

  const invalida = await fetch(`${BASE}/api/master/companies/${ESC}/cobranca`, { method: 'PUT', headers: H2,
    body: JSON.stringify({ situacao: 'inventado' }) })
  eq(invalida.status, 400, 'situação inventada: 400')

  // Preço de tabela no plano — é dele que sai o previsto quando não há
  // valor combinado com o escritório.
  //
  // Os planos são do SISTEMA, não deste teste: sobrescrever e ir embora
  // quebraria as outras suítes (os limites de acesso saem daqui). Guarda o
  // que estava, mexe, confere e devolve no lugar.
  const planosAntes = await j(await fetch(`${BASE}/api/master/plans`, { headers: so2 }))
  try {
    const comPreco = planosAntes.map(p => p.key === 'starter' ? { ...p, price: 99.9 } : p)
    const sp = await fetch(`${BASE}/api/master/plans`, { method: 'PUT', headers: H2,
      body: JSON.stringify({ plans: comPreco }) })
    eq(sp.status, 200, 'salva o preço do plano')
    eq((await j(sp)).find(p => p.key === 'starter')?.price, 99.9, 'e o preço volta gravado')

    const lista = await j(await fetch(`${BASE}/api/master/companies`, { headers: so2 }))
    eq(lista.find(c => c.id === OUTRO).precoDoPlano, 99.9, 'o escritório mostra o preço do plano dele')
  } finally {
    await fetch(`${BASE}/api/master/plans`, { method: 'PUT', headers: H2,
      body: JSON.stringify({ plans: planosAntes }) })
  }
}

console.log('\n── 7. Só a dona entra nesta porta ──')
{
  // O admin de um escritório não pode listar nem mexer em acesso nenhum.
  const lista = await fetch(`${BASE}/api/master/companies/${ESC}/users`, { headers: HA })
  eq(lista.status, 403, 'admin de escritório: 403 ao listar acessos')
  const mexer = await fetch(`${BASE}/api/master/users/usr_pm_est`, { method: 'PUT', headers: HA,
    body: JSON.stringify({ isActive: false }) })
  eq(mexer.status, 403, '403 ao tentar suspender alguém')
  const cob = await fetch(`${BASE}/api/master/companies/${ESC}/cobranca`, { method: 'PUT', headers: HA,
    body: JSON.stringify({ situacao: 'cortesia' }) })
  eq(cob.status, 403, '403 ao tentar mexer na cobrança')
  const sem = await fetch(`${BASE}/api/master/companies/${ESC}/users`)
  eq(sem.status, 401, 'sem login nenhum: 401')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
