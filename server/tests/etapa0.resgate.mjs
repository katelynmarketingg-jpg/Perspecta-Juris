// Teste do resgate (ETAPA 0.6) — simula um navegador com dados presos e
// exercita a lógica real de client/src/lib/resgateLocal.js contra o servidor.
const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }

// ── Ambiente de navegador falso ──────────────────────────────────────────
const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
globalThis.window = { location: { origin: BASE, href: '' } }
globalThis.document = { createElement: () => ({ click() {}, remove() {}, style: {} }), body: { appendChild() {} } }
globalThis.URL.createObjectURL = () => 'blob:falso'
globalThis.URL.revokeObjectURL = () => {}
globalThis.Blob = class { constructor(p) { this.p = p } }
globalThis.import_meta_env = { VITE_API_URL: BASE }

// api.js lê import.meta.env.VITE_API_URL; sem bundler apontamos pela BASE.
process.env.VITE_API_URL = BASE

// ── Login de verdade, para ter token ─────────────────────────────────────
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Alfa', nome: 'chefona', senha: 'senha-do-master' }),
})).json()
localStorage.setItem('pj_access_token', login.accessToken)
localStorage.setItem('pj_refresh_token', login.refreshToken)
localStorage.setItem('pj_auth', JSON.stringify({ state: { user: login.user, tenant: login.tenant } }))
localStorage.setItem('pj_session', JSON.stringify({ userId: login.user.id, tenantId: login.tenant.id }))

const TID = login.tenant.id

// ── Dados "presos no navegador" ──────────────────────────────────────────
localStorage.setItem('pj_local_clients', JSON.stringify([
  { id: 'c1', tenantId: TID, name: 'Maria da Silva', cpfCnpj: '111.444.777-35', phone: '51988887777', type: 'person', portalEnabled: true, portalPassword: 'seg' },
  { id: 'c2', tenantId: TID, name: 'Padaria Central LTDA', cpfCnpj: '11222333000181', phone: '5133332222', type: 'company' },
]))
localStorage.setItem('pj_local_processes', JSON.stringify([
  { id: 'p1', tenantId: TID, clientId: 'c1', title: 'Acao trabalhista', area: 'trabalhista', judicialNumber: '0001234-12.2025.5.04.0001', status: 'active' },
]))
localStorage.setItem('pj_local_deadlines', JSON.stringify([
  { id: 'd1', tenantId: TID, processId: 'p1', clientId: 'c1', title: 'Contestacao', dueDate: '2026-09-01', type: 'prazo', status: 'pending' },
]))
localStorage.setItem('pj_local_tasks', JSON.stringify([
  { id: 't1', tenantId: TID, processId: 'p1', title: 'Juntar documentos', status: 'todo', priority: 'normal' },
]))
localStorage.setItem('pj_local_movements', JSON.stringify([
  { id: 'm1', tenantId: TID, processId: 'p1', date: '2026-08-01', description: 'Peticao inicial protocolada' },
]))
localStorage.setItem('pj_local_financial_entries', JSON.stringify([
  { id: 'f1', tenantId: TID, clientId: 'c1', type: 'receivable', amount: 500, description: 'Honorarios (1/2)', dueDate: '2026-09-10', groupId: 'g1', parcela: { num: 1, total: 2 } },
  { id: 'f2', tenantId: TID, clientId: 'c1', type: 'receivable', amount: 500, description: 'Honorarios (2/2)', dueDate: '2026-10-10', groupId: 'g1', parcela: { num: 2, total: 2 } },
]))

const { resumo, enviarParaServidor, limparLocal, baixarBackup } =
  await import('../../client/src/lib/resgateLocal.js')

console.log('\n── 1. Detecção ──')
const r = resumo()
if (r.temAlgo) ok(`detectou ${r.totalGeral} registros presos`)
else bad('nao detectou nada')
if (r.totalEnviavel === 6) ok('6 enviaveis (2 clientes, 1 processo, 1 prazo, 1 tarefa, 1 movimentacao)')
else bad(`esperava 6 enviaveis, achei ${r.totalEnviavel}`)
if (r.linhas.find(l => l.nome === 'financial')?.pendente) ok('financeiro marcado como pendente (nao envia pela metade)')
else bad('financeiro nao foi marcado como pendente')

console.log('\n── 2. Backup inclui TUDO, inclusive o pendente ──')
const pacote = baixarBackup()
if (pacote.dados.financial.length === 2) ok('backup contem os 2 lancamentos financeiros')
else bad('backup nao contem o financeiro')

console.log('\n── 3. Envio ──')
const rel1 = await enviarParaServidor()
if (rel1.enviados.clients === 2) ok('2 clientes enviados')
else bad(`clientes enviados: ${rel1.enviados.clients} (erros: ${JSON.stringify(rel1.erros)})`)
if (rel1.enviados.processes === 1) ok('1 processo enviado')
else bad(`processos: ${rel1.enviados.processes} — ${JSON.stringify(rel1.erros)}`)
if (rel1.enviados.deadlines === 1) ok('1 prazo enviado')
else bad(`prazos: ${rel1.enviados.deadlines}`)
if (rel1.enviados.tasks === 1) ok('1 tarefa enviada')
else bad(`tarefas: ${rel1.enviados.tasks}`)
if (rel1.enviados.movements === 1) ok('1 movimentacao enviada')
else bad(`movimentacoes: ${rel1.enviados.movements}`)
if (rel1.erros.length === 0) ok('nenhum erro')
else bad(`erros: ${JSON.stringify(rel1.erros)}`)

console.log('\n── 4. Vinculos preservados (processo aponta pro cliente certo) ──')
const procs = await (await fetch(`${BASE}/api/processes?limit=100`, { headers: { Authorization: `Bearer ${login.accessToken}` } })).json()
const lista = Array.isArray(procs) ? procs : (procs.data ?? [])
const cls = await (await fetch(`${BASE}/api/clients?limit=100`, { headers: { Authorization: `Bearer ${login.accessToken}` } })).json()
const clientes = Array.isArray(cls) ? cls : (cls.data ?? [])
const maria = clientes.find(c => c.name === 'Maria da Silva')
const proc = lista.find(p => p.title === 'Acao trabalhista')
if (proc && maria && proc.clientId === maria.id) ok('processo ligado ao cliente correto (ids remapeados)')
else bad(`vinculo errado: proc.clientId=${proc?.clientId} maria.id=${maria?.id}`)
if (maria?.cpfCnpj === '11144477735') ok('CPF normalizado (so digitos)')
else bad(`cpf gravado: ${maria?.cpfCnpj}`)

console.log('\n── 5. IDEMPOTÊNCIA: rodar de novo nao duplica ──')
const rel2 = await enviarParaServidor()
const enviadosDeNovo = Object.values(rel2.enviados).reduce((s, n) => s + n, 0)
if (enviadosDeNovo === 0) ok('segunda execucao nao enviou nada de novo')
else bad(`segunda execucao enviou ${enviadosDeNovo} registros (DUPLICOU)`)
const cls2 = await (await fetch(`${BASE}/api/clients?limit=100`, { headers: { Authorization: `Bearer ${login.accessToken}` } })).json()
const total2 = (Array.isArray(cls2) ? cls2 : cls2.data ?? []).filter(c => c.name === 'Maria da Silva').length
if (total2 === 1) ok('continua existindo exatamente 1 "Maria da Silva"')
else bad(`existem ${total2} Marias — duplicou`)

console.log('\n── 6. Limpeza so libera quando nao ha pendencia ──')
if (rel2.tudoEnviado === false) ok('tudoEnviado=false (financeiro pendente) → botao de limpar fica bloqueado')
else bad('tudoEnviado=true mesmo com financeiro pendente')
const apagadas = limparLocal()
if (!apagadas.includes('pj_local_financial_entries')) ok('limpeza NAO apagou o financeiro pendente')
else bad('limpeza apagou dados que ainda nao subiram')
if (apagadas.includes('pj_local_clients')) ok('limpeza removeu os clientes ja enviados')
else bad('limpeza nao removeu o que ja subiu')

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
