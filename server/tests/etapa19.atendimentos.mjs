// ─────────────────────────────────────────────────────────────────────────
//  Fila de atendimento, observações do cliente e tarefas.
//
//  As três coisas viviam em `localStorage`, e num escritório isso não é
//  um detalhe técnico — é o recurso não funcionar:
//
//   · a fila só existia no navegador da recepção, então o advogado nunca
//     via que tinha gente esperando por ele. O campo "atender com" estava
//     na tela e não servia para nada;
//   · o mural de observações dizia "todos da equipe podem ver" e cada
//     pessoa via o próprio;
//   · a ficha do cliente tinha uma lista de tarefas PARALELA à tabela
//     `tasks` do servidor: tarefa criada ali nunca chegava em quem foi
//     atribuída, que é o ponto inteiro de atribuir uma tarefa.
//
//  Estes testes cobram as três no servidor, e o isolamento entre
//  escritórios em cada uma.
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
const { tenants, users, clients } = await import('../db/schema.js')
const { inArray } = await import('drizzle-orm')

const A = 'tnt_at_a', B = 'tnt_at_b'
const now = new Date().toISOString()
await db.delete(tenants).where(inArray(tenants.id, [A, B]))
for (const [id, slug, nome] of [[A, 'at-a', 'Escritorio AT A'], [B, 'at-b', 'Escritorio AT B']]) {
  await db.insert(tenants).values({ id, slug, name: nome, plan: 'starter', isActive: true, settings: {}, createdAt: now, updatedAt: now })
}
await db.insert(users).values([
  { id: 'usr_at_recep', tenantId: A, name: 'Rita Recepção', loginName: 'rita',
    passwordHash: await bcrypt.hash('senha-da-rita-0000', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now },
  { id: 'usr_at_adv', tenantId: A, name: 'Alice Advogada', loginName: 'alice',
    passwordHash: await bcrypt.hash('senha-da-alice-000', 12), role: 'advogado', isActive: true, createdAt: now, updatedAt: now },
  { id: 'usr_at_outro', tenantId: B, name: 'Bruno Outro', loginName: 'bruno',
    passwordHash: await bcrypt.hash('senha-do-bruno-000', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now },
])
await db.insert(clients).values([
  { id: 'cli_at_1', tenantId: A, name: 'Dair Souza Oliveira', createdAt: now, updatedAt: now },
  { id: 'cli_at_b', tenantId: B, name: 'Cliente do Outro', createdAt: now, updatedAt: now },
])

const entrar = async (empresa, nome, senha) => (await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa, nome, senha }) }))).accessToken
const H = (tk) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` })
const tkRita  = await entrar('Escritorio AT A', 'rita',  'senha-da-rita-0000')
const tkAlice = await entrar('Escritorio AT A', 'alice', 'senha-da-alice-000')
const tkBruno = await entrar('Escritorio AT B', 'bruno', 'senha-do-bruno-000')

console.log('\n── 1. A fila é do escritório, não do navegador ────────')
let idFila
{
  const r = await fetch(`${BASE}/api/atendimentos`, { method: 'POST', headers: H(tkRita),
    body: JSON.stringify({ clientId: 'cli_at_1', clientName: 'Dair Souza Oliveira',
      assignedToId: 'usr_at_adv', tipo: 'presencial', obs: 'Trouxe os documentos do INSS' }) })
  eq(r.status, 201, 'a recepção põe o cliente na fila')
  const linha = await j(r); idFila = linha.id
  eq(linha.assignedToName, 'Alice Advogada', 'o "atender com" guarda o acesso certo')
  eq(linha.createdByName, 'Rita Recepção', 'e quem cadastrou')
  eq(linha.status, 'fila', 'entra como fila')

  // Era isto que não funcionava: a advogada nunca via o chamado.
  const daAlice = await j(await fetch(`${BASE}/api/atendimentos?status=fila`, { headers: H(tkAlice) }))
  eq(daAlice.length, 1, 'a advogada vê a fila do outro computador')
  eq(daAlice[0].obs, 'Trouxe os documentos do INSS', 'com a observação que o cliente deixou')

  const paraEla = await j(await fetch(`${BASE}/api/atendimentos?status=fila&para=usr_at_adv`, { headers: H(tkAlice) }))
  eq(paraEla.length, 1, 'e consegue filtrar só o que é para ela')
}

console.log('\n── 2. Atender registra quem atendeu ──────────────────')
{
  const r = await fetch(`${BASE}/api/atendimentos/${idFila}/atender`, { method: 'PUT', headers: H(tkAlice) })
  eq(r.status, 200, 'a advogada atende')
  const linha = await j(r)
  eq(linha.status, 'atendido', 'sai da fila')
  eq(linha.attendedByName, 'Alice Advogada', 'quem clicou é quem atendeu')
  if (linha.attendedAt) ok('com hora registrada, para o tempo de espera')
  else bad('não gravou a hora do atendimento')

  // Dois recepcionistas podem chamar a mesma pessoa ao mesmo tempo.
  const denovo = await fetch(`${BASE}/api/atendimentos/${idFila}/atender`, { method: 'PUT', headers: H(tkRita) })
  eq(denovo.status, 409, 'atender de novo é recusado em vez de sobrescrever quem atendeu')

  const fila = await j(await fetch(`${BASE}/api/atendimentos?status=fila`, { headers: H(tkRita) }))
  eq(fila.length, 0, 'a fila esvaziou')
}

console.log('\n── 3. Histórico do cliente ───────────────────────────')
{
  await fetch(`${BASE}/api/atendimentos`, { method: 'POST', headers: H(tkAlice),
    body: JSON.stringify({ clientId: 'cli_at_1', clientName: 'Dair Souza Oliveira', tipo: 'whatsapp', obs: 'Respondeu no zap', status: 'atendido' }) })
  const hist = await j(await fetch(`${BASE}/api/atendimentos?clientId=cli_at_1`, { headers: H(tkRita) }))
  eq(hist.length, 2, 'a ficha mostra os dois atendimentos')
  eq(hist[0].tipo, 'whatsapp', 'do mais recente para o mais antigo')

  // Avulso: quem chegou sem cadastro.
  const avulso = await fetch(`${BASE}/api/atendimentos`, { method: 'POST', headers: H(tkRita),
    body: JSON.stringify({ clientName: 'Moço que chegou agora', tipo: 'presencial' }) })
  eq(avulso.status, 201, 'aceita quem chegou sem cadastro')
  eq((await j(avulso)).clientId, null, 'e fica sem vínculo, não com id inventado')
}

console.log('\n── 4. Observações: uma lista do escritório ───────────')
{
  const r = await fetch(`${BASE}/api/client-notes`, { method: 'POST', headers: H(tkRita),
    body: JSON.stringify({ clientId: 'cli_at_1', assunto: 'Reunião', texto: 'Cliente quer revisar o contrato' }) })
  eq(r.status, 201, 'a recepção escreve uma observação')
  eq((await j(r)).createdByName, 'Rita Recepção', 'com o autor')

  const daAlice = await j(await fetch(`${BASE}/api/client-notes?clientId=cli_at_1`, { headers: H(tkAlice) }))
  eq(daAlice.length, 1, 'e a advogada vê — era o que a tela prometia e não cumpria')

  const semCliente = await fetch(`${BASE}/api/client-notes`, { headers: H(tkRita) })
  eq(semCliente.status, 400, 'sem cliente, recusa em vez de devolver tudo')
  const vazia = await fetch(`${BASE}/api/client-notes`, { method: 'POST', headers: H(tkRita),
    body: JSON.stringify({ clientId: 'cli_at_1', texto: '   ' }) })
  eq(vazia.status, 400, 'observação em branco é recusada')
}

console.log('\n── 5. Tarefas: uma lista só, a do servidor ───────────')
let idTarefa
{
  const r = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: H(tkRita),
    body: JSON.stringify({ clientId: 'cli_at_1', title: 'Protocolar petição inicial',
      description: 'Até sexta', assignedTo: 'usr_at_adv', dueDate: '2026-11-30' }) })
  eq(r.status, 201, 'cria a tarefa na ficha do cliente')
  idTarefa = (await j(r)).id

  // A tarefa precisa CHEGAR em quem foi atribuída — era o que não
  // acontecia com a lista do localStorage.
  const daAlice = await j(await fetch(`${BASE}/api/tasks?assignedTo=usr_at_adv`, { headers: H(tkAlice) }))
  if (daAlice.some(t => t.id === idTarefa)) ok('a tarefa chega em quem foi atribuída')
  else bad('a tarefa não chegou na advogada')

  const doCliente = await j(await fetch(`${BASE}/api/tasks?clientId=cli_at_1`, { headers: H(tkRita) }))
  const t = doCliente.find(x => x.id === idTarefa)
  eq(t.createdByName, 'Rita Recepção', 'a lista diz quem criou')
  eq(t.assignedToName, 'Alice Advogada', 'e para quem é')
  eq(t.dueDate, '2026-11-30', 'com o prazo')
  eq(t.title, 'Protocolar petição inicial', 'e sobre o que é')

  const semTitulo = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: H(tkRita),
    body: JSON.stringify({ clientId: 'cli_at_1', title: '  ' }) })
  eq(semTitulo.status, 400, 'tarefa sem título é recusada')
}

console.log('\n── 6. Isolamento entre escritórios ───────────────────')
{
  const fila = await j(await fetch(`${BASE}/api/atendimentos`, { headers: H(tkBruno) }))
  eq(fila.length, 0, 'o outro escritório não vê a fila daqui')
  const notas = await j(await fetch(`${BASE}/api/client-notes?clientId=cli_at_1`, { headers: H(tkBruno) }))
  eq(notas.length, 0, 'nem as observações')
  const tar = await j(await fetch(`${BASE}/api/tasks?clientId=cli_at_1`, { headers: H(tkBruno) }))
  eq(tar.length, 0, 'nem as tarefas')

  // Vincular a cliente ou acesso de outra empresa.
  const vinc = await fetch(`${BASE}/api/atendimentos`, { method: 'POST', headers: H(tkBruno),
    body: JSON.stringify({ clientId: 'cli_at_1', clientName: 'invasão' }) })
  eq(vinc.status, 400, 'recusa pôr na fila um cliente de outro escritório')
  const acesso = await fetch(`${BASE}/api/atendimentos`, { method: 'POST', headers: H(tkBruno),
    body: JSON.stringify({ clientName: 'avulso', assignedToId: 'usr_at_adv' }) })
  eq(acesso.status, 400, 'recusa encaminhar para acesso de outro escritório')

  // O defeito que estava na rota de tarefas: `...req.body` vinha DEPOIS
  // de `tenantId`, então o corpo sobrescrevia o escritório da sessão.
  const invasao = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: H(tkBruno),
    body: JSON.stringify({ title: 'tarefa plantada', tenantId: A, clientId: 'cli_at_b' }) })
  if (invasao.status === 201) {
    const plantada = await j(invasao)
    const noA = await j(await fetch(`${BASE}/api/tasks`, { headers: H(tkRita) }))
    if (noA.some(t => t.id === plantada.id)) bad('⚠️ o corpo conseguiu criar tarefa no escritório alheio')
    else ok('o tenantId do corpo é ignorado — a tarefa ficou no escritório de quem pediu')
  } else ok('o corpo com tenantId alheio foi recusado')

  const atender = await fetch(`${BASE}/api/atendimentos/${idFila}/atender`, { method: 'PUT', headers: H(tkBruno) })
  eq(atender.status, 404, 'não consegue atender chamado de outro escritório')
  const apagar = await fetch(`${BASE}/api/tasks/${idTarefa}`, { method: 'DELETE', headers: H(tkBruno) })
  eq(apagar.status, 404, 'nem apagar tarefa alheia')
}

console.log('\n── 7. Sem login, nada ────────────────────────────────')
{
  for (const [rota, nome] of [['/api/atendimentos', 'fila'], ['/api/client-notes?clientId=cli_at_1', 'observações']]) {
    const r = await fetch(`${BASE}${rota}`)
    r.status === 401 ? ok(`${nome}: exige login`) : bad(`${nome} sem token devolveu ${r.status}`)
  }
}

await db.delete(tenants).where(inArray(tenants.id, [A, B]))
console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : '\n✅ Fila, observações e tarefas inteiras\n')
process.exit(falhas ? 1 : 0)
