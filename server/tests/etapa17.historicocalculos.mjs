// ─────────────────────────────────────────────────────────────────────────
//  Histórico de cálculos — o que a dona reportou: "calculei e também não
//  ficou no histórico, quero que apareça qual login fez... e se possível
//  vincular ao cálculo ao cadastro do cliente".
//
//  O histórico vivia em `localStorage` e só era gravado se a pessoa
//  clicasse em "Salvar no histórico". Três consequências:
//
//   1. quem calculou na recepção não via nada no computador da sala;
//   2. não havia como saber QUEM fez a conta;
//   3. quem só clicou em "Calcular" perdia o cálculo, sem nenhum aviso.
//
//  Agora é tabela no banco, com autor e vínculo opcional ao cliente e ao
//  processo. Estes testes cobram as três coisas e, principalmente, o
//  isolamento entre escritórios.
// ─────────────────────────────────────────────────────────────────────────
import bcrypt from 'bcryptjs'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

const { db } = await import('../db/index.js')
const { tenants, users, clients, calculations } = await import('../db/schema.js')
const { inArray } = await import('drizzle-orm')

// ── fixtures ──────────────────────────────────────────────────────────────
const A = 'tnt_hc_a', B = 'tnt_hc_b'
const now = new Date().toISOString()
await db.delete(tenants).where(inArray(tenants.id, [A, B]))   // cascata limpa o resto

for (const [id, slug, nome] of [[A, 'hc-a', 'Escritorio HC A'], [B, 'hc-b', 'Escritorio HC B']]) {
  await db.insert(tenants).values({ id, slug, name: nome, plan: 'starter', isActive: true,
    settings: {}, createdAt: now, updatedAt: now })
}
await db.insert(users).values([
  { id: 'usr_hc_ana',  tenantId: A, name: 'Ana Recepção', loginName: 'ana',
    passwordHash: await bcrypt.hash('senha-da-ana-0000', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now },
  { id: 'usr_hc_bia',  tenantId: A, name: 'Bia Advogada', loginName: 'bia',
    passwordHash: await bcrypt.hash('senha-da-bia-0000', 12), role: 'advogado', isActive: true, createdAt: now, updatedAt: now },
  { id: 'usr_hc_caio', tenantId: B, name: 'Caio Outro', loginName: 'caio',
    passwordHash: await bcrypt.hash('senha-do-caio-000', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now },
])
await db.insert(clients).values([
  { id: 'cli_hc_a1', tenantId: A, name: 'Cliente da Casa', createdAt: now, updatedAt: now },
  { id: 'cli_hc_b1', tenantId: B, name: 'Cliente do Outro', createdAt: now, updatedAt: now },
])

const entrar = async (empresa, nome, senha) => (await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa, nome, senha }) }))).accessToken
const H = (tk) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` })
const tkAna  = await entrar('Escritorio HC A', 'ana',  'senha-da-ana-0000')
const tkBia  = await entrar('Escritorio HC A', 'bia',  'senha-da-bia-0000')
const tkCaio = await entrar('Escritorio HC B', 'caio', 'senha-do-caio-000')

const CALCULO = {
  calcId: 'verbas-rescisorias', titulo: 'Verbas rescisórias', ramo: 'trabalhista',
  headline: { label: 'Líquido a receber', value: 'R$ 22.315,07' },
  inputs: { salario: '3000', saida: '2026-10-30' },
  resultado: { linhas: [{ label: 'Saldo de salário', value: 'R$ 3.000,00' }], memoria: ['conta'], criterios: [] },
}

console.log('\n── 1. O cálculo fica gravado e diz quem fez ──────────')
let idDaAna
{
  const r = await fetch(`${BASE}/api/calculations`, { method: 'POST', headers: H(tkAna), body: JSON.stringify(CALCULO) })
  eq(r.status, 201, 'grava o cálculo')
  const linha = await j(r)
  idDaAna = linha.id
  eq(linha.createdBy, 'usr_hc_ana', 'guarda o id de quem calculou')
  eq(linha.createdByName, 'Ana Recepção', 'e o nome, congelado na hora do cálculo')

  const lista = await j(await fetch(`${BASE}/api/calculations`, { headers: H(tkAna) }))
  eq(lista.length, 1, 'aparece no histórico')
  eq(lista[0].autor, 'Ana Recepção', 'a listagem diz quem calculou')
}

console.log('\n── 2. Outro login do MESMO escritório enxerga ────────')
{
  // Era isto que não funcionava: localStorage não atravessa computador.
  const lista = await j(await fetch(`${BASE}/api/calculations`, { headers: H(tkBia) }))
  eq(lista.length, 1, 'a Bia vê o cálculo que a Ana fez')
  eq(lista[0].autor, 'Ana Recepção', 'e continua dizendo que foi a Ana')
}

console.log('\n── 3. Vínculo com o cliente ──────────────────────────')
{
  const r = await fetch(`${BASE}/api/calculations`, { method: 'POST', headers: H(tkBia),
    body: JSON.stringify({ ...CALCULO, clientId: 'cli_hc_a1', titulo: 'Horas extras' }) })
  eq(r.status, 201, 'grava vinculado ao cliente')

  const doCliente = await j(await fetch(`${BASE}/api/calculations?clientId=cli_hc_a1`, { headers: H(tkAna) }))
  eq(doCliente.length, 1, 'a ficha do cliente lista só os cálculos dele')
  eq(doCliente[0].clientName, 'Cliente da Casa', 'e traz o nome do cliente junto')
  eq(doCliente[0].autor, 'Bia Advogada', 'com o autor certo')

  const todos = await j(await fetch(`${BASE}/api/calculations`, { headers: H(tkAna) }))
  eq(todos.length, 2, 'o histórico geral tem os dois')
}

console.log('\n── 4. Filtros do histórico ───────────────────────────')
{
  const porAutor = await j(await fetch(`${BASE}/api/calculations?autor=usr_hc_bia`, { headers: H(tkAna) }))
  eq(porAutor.length, 1, 'filtra por quem calculou')
  eq(porAutor[0].autor, 'Bia Advogada', 'trouxe o cálculo certo')

  const porCalc = await j(await fetch(`${BASE}/api/calculations?calcId=verbas-rescisorias`, { headers: H(tkAna) }))
  eq(porCalc.length, 2, 'filtra por tipo de cálculo')

  const hoje = new Date().toISOString().slice(0, 10)
  const noPeriodo = await j(await fetch(`${BASE}/api/calculations?de=${hoje}&ate=${hoje}`, { headers: H(tkAna) }))
  eq(noPeriodo.length, 2, 'filtra por período')
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const foraDoPeriodo = await j(await fetch(`${BASE}/api/calculations?de=${ontem}&ate=${ontem}`, { headers: H(tkAna) }))
  eq(foraDoPeriodo.length, 0, 'período que não contém nada volta vazio')
}

console.log('\n── 5. Isolamento entre escritórios ───────────────────')
{
  const doOutro = await j(await fetch(`${BASE}/api/calculations`, { headers: H(tkCaio) }))
  eq(doOutro.length, 0, 'o outro escritório não vê nada daqui')

  // Vincular a um cliente de OUTRA empresa tem de ser recusado: um id
  // adivinhado ligaria o cálculo à ficha de quem não é cliente dele.
  const r = await fetch(`${BASE}/api/calculations`, { method: 'POST', headers: H(tkCaio),
    body: JSON.stringify({ ...CALCULO, clientId: 'cli_hc_a1' }) })
  eq(r.status, 400, 'recusa vincular a cliente de outro escritório')

  const up = await fetch(`${BASE}/api/calculations/${idDaAna}`, { method: 'PUT', headers: H(tkCaio),
    body: JSON.stringify({ titulo: 'invadido' }) })
  eq(up.status, 404, 'não consegue alterar cálculo de outro escritório')

  const del = await fetch(`${BASE}/api/calculations/${idDaAna}`, { method: 'DELETE', headers: H(tkCaio) })
  eq(del.status, 404, 'nem apagar')
}

console.log('\n── 6. Recalcular atualiza a mesma linha ──────────────')
{
  const antes = (await j(await fetch(`${BASE}/api/calculations`, { headers: H(tkAna) }))).length
  const r = await fetch(`${BASE}/api/calculations/${idDaAna}`, { method: 'PUT', headers: H(tkAna),
    body: JSON.stringify({ headline: { label: 'Líquido a receber', value: 'R$ 25.315,07' }, clientId: 'cli_hc_a1' }) })
  eq(r.status, 200, 'atualiza o cálculo')
  const depois = await j(await fetch(`${BASE}/api/calculations`, { headers: H(tkAna) }))
  eq(depois.length, antes, 'não criou linha nova')
  const atualizado = depois.find(c => c.id === idDaAna)
  eq(atualizado.headline.value, 'R$ 25.315,07', 'o valor novo entrou')
  eq(atualizado.autor, 'Ana Recepção', 'e o autor continua sendo quem calculou')
}

console.log('\n── 7. Sem autenticação, nada ─────────────────────────')
{
  const r = await fetch(`${BASE}/api/calculations`)
  if (r.status === 401) ok('exige login')
  else bad(`sem token devolveu ${r.status}`)
}

console.log('\n── 8. Validação ──────────────────────────────────────')
{
  const semCalc = await fetch(`${BASE}/api/calculations`, { method: 'POST', headers: H(tkAna),
    body: JSON.stringify({ titulo: 'sem id' }) })
  eq(semCalc.status, 400, 'recusa cálculo sem identificação')
  const semTitulo = await fetch(`${BASE}/api/calculations`, { method: 'POST', headers: H(tkAna),
    body: JSON.stringify({ calcId: 'x' }) })
  eq(semTitulo.status, 400, 'recusa cálculo sem título')
  // String vazia vinda do <select> não pode virar id.
  const semVinculo = await fetch(`${BASE}/api/calculations`, { method: 'POST', headers: H(tkAna),
    body: JSON.stringify({ ...CALCULO, clientId: '', processId: '' }) })
  eq(semVinculo.status, 201, 'cliente em branco é aceito como "sem vínculo"')
  eq((await j(semVinculo)).clientId, null, 'e grava null, não string vazia')
}

await db.delete(tenants).where(inArray(tenants.id, [A, B]))
console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : '\n✅ Histórico de cálculos inteiro\n')
process.exit(falhas ? 1 : 0)
