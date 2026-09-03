// ETAPA 1 — o financeiro precisa ser UM só: o que a aba Pagamentos do cliente
// e a cobrança do processo gravam tem de aparecer no Financeiro, nos
// Relatórios e no Dashboard, que leem o Postgres.
import bcrypt from 'bcryptjs'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const j   = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const lista = (r) => Array.isArray(r) ? r : (r?.data ?? [])

const { db } = await import('../db/index.js')
const { tenants, users, financialEntries } = await import('../db/schema.js')
const { eq } = await import('drizzle-orm')
const now = new Date().toISOString()

const TID = 'tnt_fin', UID = 'usr_fin'
await db.insert(tenants).values({ id: TID, slug: 'fin', name: 'Escritorio Financeiro', plan: 'enterprise', isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: UID, tenantId: TID, name: 'Ana', loginName: 'ana',
  passwordHash: await bcrypt.hash('senha-forte-123', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now })

const login = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Financeiro', nome: 'ana', senha: 'senha-forte-123' }),
}))
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.accessToken}` }

const cliente = await j(await fetch(`${BASE}/api/clients`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ name: 'Joana Ré', phone: '51999990000', type: 'person', cpfCnpj: '52998224725' }),
}))

console.log('\n── 1. Parcelamento em lote (aba Pagamentos do cliente) ──')
const lote = [1, 2, 3].map(n => ({
  clientId: cliente.id, type: 'receivable', status: 'pending',
  description: `Honorários (${n}/3)`, amount: n === 3 ? 333.34 : 333.33,
  dueDate: `2026-0${8 + n}-10`, groupId: 'grp_teste', installmentOf: n, installmentTotal: 3,
  formaPagamento: 'parcelado', needsReview: false,
}))
const criadas = await j(await fetch(`${BASE}/api/financial/entries/lote`, { method: 'POST', headers: H, body: JSON.stringify({ entries: lote }) }))
if (Array.isArray(criadas) && criadas.length === 3) ok('3 parcelas criadas em uma chamada')
else bad(`lote devolveu ${JSON.stringify(criadas).slice(0, 200)}`)

const noBanco = await db.select().from(financialEntries).where(eq(financialEntries.tenantId, TID))
if (noBanco.length === 3) ok(`SELECT no banco confirma 3 linhas em financial_entries`)
else bad(`banco tem ${noBanco.length} linhas`)
const p2 = noBanco.find(e => e.installmentOf === 2)
if (p2?.groupId === 'grp_teste' && p2?.installmentTotal === 3) ok('parcelamento preservado (groupId + 2/3)')
else bad(`parcelamento perdido: ${JSON.stringify({ g: p2?.groupId, n: p2?.installmentOf, t: p2?.installmentTotal })}`)
if (p2?.formaPagamento === 'parcelado') ok('formaPagamento gravada')
else bad(`formaPagamento = ${p2?.formaPagamento}`)
const soma = noBanco.reduce((s, e) => s + e.amount, 0)
if (Math.abs(soma - 1000) < 0.001) ok(`centavos fecham: soma = ${soma.toFixed(2)}`)
else bad(`soma das parcelas = ${soma} (esperava 1000.00)`)

console.log('\n── 2. Lote é atômico: uma parcela inválida não deixa meio parcelamento ──')
const antes = (await db.select().from(financialEntries).where(eq(financialEntries.tenantId, TID))).length
const r = await fetch(`${BASE}/api/financial/entries/lote`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ entries: [
    { clientId: cliente.id, type: 'receivable', description: 'ok', amount: 10, dueDate: '2026-09-01', category: 'x' },
    { clientId: cliente.id, type: 'receivable', description: 'sem dueDate (NOT NULL)', amount: 10, category: 'x' },
  ] }),
})
const depois = (await db.select().from(financialEntries).where(eq(financialEntries.tenantId, TID))).length
if (r.status >= 400) ok(`lote inválido recusado (HTTP ${r.status})`)
else bad(`lote inválido aceito com ${r.status}`)
if (depois === antes) ok('nenhuma linha parcial gravada (transação respeitada)')
else bad(`gravou ${depois - antes} linha(s) do lote inválido`)

console.log('\n── 3. A tela Financeiro vê o que o cliente lançou ──')
const doFinanceiro = lista(await j(await fetch(`${BASE}/api/financial/entries?limit=100`, { headers: H })))
if (doFinanceiro.length === 3) ok('GET /api/financial/entries devolve as 3 parcelas')
else bad(`Financeiro vê ${doFinanceiro.length}`)
const porCliente = lista(await j(await fetch(`${BASE}/api/financial/entries?clientId=${cliente.id}`, { headers: H })))
if (porCliente.length === 3) ok('filtro por clientId funciona (é o que a aba do cliente usa)')
else bad(`filtro por cliente devolveu ${porCliente.length}`)

console.log('\n── 4. Dar baixa grava COMO e QUANTO entrou ──')
const alvo = noBanco.find(e => e.installmentOf === 1)
const pago = await j(await fetch(`${BASE}/api/financial/entries/${alvo.id}/pay`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ paidDate: '2026-09-05', receivedVia: 'pix', receivedAmount: 333.33 }),
}))
if (pago?.status === 'paid') ok('status virou paid')
else bad(`status = ${pago?.status}`)
if (pago?.receivedVia === 'pix' && Math.abs(pago?.receivedAmount - 333.33) < 0.001) ok('receivedVia e receivedAmount gravados')
else bad(`baixa incompleta: via=${pago?.receivedVia} valor=${pago?.receivedAmount}`)
if (pago?.paidDate === '2026-09-05') ok('data do recebimento gravada')
else bad(`paidDate = ${pago?.paidDate}`)

console.log('\n── 5. Relatórios e Dashboard refletem o mesmo número ──')
const resumo = await j(await fetch(`${BASE}/api/financial/summary`, { headers: H }))
if (Math.abs(resumo.totalReceived - 333.33) < 0.01) ok(`Financeiro: recebido = ${resumo.totalReceived}`)
else bad(`recebido = ${resumo.totalReceived} (esperava 333.33)`)
if (Math.abs(resumo.totalReceivable - 666.67) < 0.01) ok(`Financeiro: a receber = ${resumo.totalReceivable}`)
else bad(`a receber = ${resumo.totalReceivable} (esperava 666.67)`)

const rel = await j(await fetch(`${BASE}/api/reports/summary?months=6`, { headers: H }))
if (Math.abs((rel.totals?.aReceber ?? 0) - 666.67) < 0.01) ok(`Relatórios: a receber = ${rel.totals.aReceber}`)
else bad(`Relatórios a receber = ${rel.totals?.aReceber}`)

const kpis = await j(await fetch(`${BASE}/api/dashboard/kpis`, { headers: H }))
if (Math.abs((kpis.financial?.totalReceivable ?? 0) - 666.67) < 0.01) ok(`Dashboard: a receber = ${kpis.financial.totalReceivable}`)
else bad(`Dashboard a receber = ${kpis.financial?.totalReceivable}`)

console.log('\n── 6. Excluir o grupo apaga o parcelamento inteiro ──')
const r6 = await fetch(`${BASE}/api/financial/entries/${noBanco[0].id}?grupo=1`, { method: 'DELETE', headers: H })
if (r6.status === 204) ok('DELETE devolveu 204')
else bad(`DELETE devolveu ${r6.status}`)
const sobrou = await db.select().from(financialEntries).where(eq(financialEntries.tenantId, TID))
if (sobrou.length === 0) ok('as 3 parcelas do grupo saíram juntas')
else bad(`sobraram ${sobrou.length} linha(s)`)

console.log('\n── 7. Isolamento: outro escritório não vê nem apaga ──')
await db.insert(tenants).values({ id: 'tnt_outro', slug: 'outro', name: 'Outro Escritorio', plan: 'starter', isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: 'usr_outro', tenantId: 'tnt_outro', name: 'Bia', loginName: 'bia',
  passwordHash: await bcrypt.hash('senha-forte-456', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now })
const l2 = await j(await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Outro Escritorio', nome: 'bia', senha: 'senha-forte-456' }) }))
const H2 = { 'Content-Type': 'application/json', Authorization: `Bearer ${l2.accessToken}` }
const meu = await j(await fetch(`${BASE}/api/financial/entries/lote`, { method: 'POST', headers: H,
  body: JSON.stringify({ entries: [{ clientId: cliente.id, type: 'receivable', description: 'privado', amount: 99, dueDate: '2026-12-01' }] }) }))
const vistoPeloOutro = lista(await j(await fetch(`${BASE}/api/financial/entries?limit=100`, { headers: H2 })))
if (vistoPeloOutro.length === 0) ok('o outro escritório não vê o lançamento')
else bad(`VAZAMENTO: outro escritório viu ${vistoPeloOutro.length}`)
const rDel = await fetch(`${BASE}/api/financial/entries/${meu[0].id}`, { method: 'DELETE', headers: H2 })
if (rDel.status === 404) ok('o outro escritório não consegue apagar (404)')
else bad(`outro escritório apagou/acessou: HTTP ${rDel.status}`)

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
