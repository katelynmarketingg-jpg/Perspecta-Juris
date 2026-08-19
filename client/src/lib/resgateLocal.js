// ─────────────────────────────────────────────────────────────────────────
//  Resgate de dados presos no navegador
//
//  Durante um bom tempo o sistema gravou dados de trabalho no localStorage
//  em vez do banco — por causa do fallback silencioso do api.js (corrigido)
//  e de telas que escreviam direto no navegador. O resultado é que pode
//  haver trabalho real preso na máquina de alguém, invisível para todo mundo
//  e condenado a sumir na primeira limpeza de navegador.
//
//  Este módulo encontra esses dados, gera um backup e envia para o servidor.
//  Regras que ele respeita:
//   • nunca apaga nada por conta própria;
//   • é idempotente — rodar duas vezes não duplica;
//   • prefere não enviar a enviar pela metade (ver PENDENTE_ETAPA1).
// ─────────────────────────────────────────────────────────────────────────
import api from './api'
import { currentTenantId } from './tenant'

const DEMO = 'tenant_demo'

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }

// Linhas sem tenantId vieram de antes da separação por escritório: contam
// como do escritório demo, e só aparecem para quem está logado nele.
const doTenantAtual = (linhas) => {
  const tid = currentTenantId()
  return (Array.isArray(linhas) ? linhas : []).filter(r => (r?.tenantId ?? DEMO) === tid)
}

export const CHAVES = {
  clients:   'pj_local_clients',
  processes: 'pj_local_processes',
  deadlines: 'pj_local_deadlines',
  tasks:     'pj_local_tasks',
  movements: 'pj_local_movements',
  financial: 'pj_local_financial_entries',
  atendimentos: 'pj_atendimentos',
  auditoria:    'pj_audit_log',
}

// Lançamentos financeiros esperam colunas que o banco ainda não tem
// (groupId, parcela, needsReview…). Enviar agora gravaria o valor e perderia
// o parcelamento — em silêncio. Ficam no backup e aguardam a etapa que
// acrescenta essas colunas.
export const PENDENTE_ETAPA1 = ['financial']

// Só existem no navegador (não há tabela correspondente): entram no backup.
export const SO_BACKUP = ['atendimentos', 'auditoria']

export function lerTudo() {
  const out = {}
  for (const [nome, chave] of Object.entries(CHAVES)) {
    out[nome] = doTenantAtual(lsGet(chave, []))
  }
  return out
}

export function resumo() {
  const dados = lerTudo()
  const linhas = Object.entries(dados).map(([nome, rows]) => ({
    nome,
    total: rows.length,
    enviavel: !PENDENTE_ETAPA1.includes(nome) && !SO_BACKUP.includes(nome),
    pendente: PENDENTE_ETAPA1.includes(nome),
    soBackup: SO_BACKUP.includes(nome),
  }))
  return {
    linhas,
    totalGeral:   linhas.reduce((s, l) => s + l.total, 0),
    totalEnviavel: linhas.filter(l => l.enviavel).reduce((s, l) => s + l.total, 0),
    temAlgo: linhas.some(l => l.total > 0),
  }
}

export function baixarBackup() {
  const pacote = {
    geradoEm:  new Date().toISOString(),
    tenantId:  currentTenantId(),
    origem:    'localStorage do navegador',
    aviso:     'Backup bruto. Guarde antes de limpar o navegador.',
    dados:     lerTudo(),
  }
  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `perspecta-backup-${currentTenantId()}-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return pacote
}

// ── Chaves de identidade, para não duplicar em re-execuções ──────────────
const soDigitos = (s) => String(s ?? '').replace(/\D/g, '')
const chaveCliente  = (c) => soDigitos(c.cpfCnpj) || `nome:${String(c.name ?? '').trim().toLowerCase()}`
const chaveProcesso = (p) => soDigitos(p.judicialNumber) || `titulo:${String(p.title ?? '').trim().toLowerCase()}`
const chavePrazo    = (d) => `${String(d.title ?? '').trim().toLowerCase()}|${d.dueDate ?? ''}`
const chaveTarefa   = (t) => `${String(t.title ?? '').trim().toLowerCase()}|${t.dueDate ?? ''}`
const chaveMovim    = (m) => `${m.processId ?? ''}|${m.date ?? ''}|${String(m.description ?? '').trim().toLowerCase()}`

const listaDe = (r) => Array.isArray(r) ? r : (r?.data ?? [])

/**
 * Envia para o servidor o que ainda não está lá.
 * onProgresso({ etapa, feitos, total })
 */
export async function enviarParaServidor(onProgresso = () => {}) {
  const local = lerTudo()
  const rel = {
    enviados:  {},
    jaExistiam: {},
    erros:     [],
    pendentes: {},
  }
  const conta = (m, nome) => { rel[m][nome] = (rel[m][nome] ?? 0) + 1 }

  // ── 1. Clientes ────────────────────────────────────────────────────────
  const clientesServidor = listaDe(await api.clients.list({ limit: 1000 }))
  const mapaCliente = new Map()   // id local → id do servidor
  const porChaveCli = new Map(clientesServidor.map(c => [chaveCliente(c), c.id]))

  let feitos = 0
  for (const c of local.clients) {
    onProgresso({ etapa: 'Clientes', feitos: feitos++, total: local.clients.length })
    const k = chaveCliente(c)
    if (porChaveCli.has(k)) { mapaCliente.set(c.id, porChaveCli.get(k)); conta('jaExistiam', 'clients'); continue }
    try {
      // id/tenantId locais não vão junto: o servidor gera os dele.
      const { id: _i, tenantId: _t, createdAt: _c, updatedAt: _u, ...campos } = c
      const criado = await api.clients.create({ ...campos, cpfCnpj: soDigitos(c.cpfCnpj) })
      mapaCliente.set(c.id, criado.id)
      porChaveCli.set(k, criado.id)
      conta('enviados', 'clients')
    } catch (e) {
      rel.erros.push({ tipo: 'cliente', nome: c.name, motivo: e?.message ?? String(e) })
    }
  }

  // ── 2. Processos (dependem do cliente) ─────────────────────────────────
  const processosServidor = listaDe(await api.processes.list({ limit: 1000 }))
  const mapaProcesso = new Map()
  const porChaveProc = new Map(processosServidor.map(p => [chaveProcesso(p), p.id]))

  feitos = 0
  for (const p of local.processes) {
    onProgresso({ etapa: 'Processos', feitos: feitos++, total: local.processes.length })
    const k = chaveProcesso(p)
    if (porChaveProc.has(k)) { mapaProcesso.set(p.id, porChaveProc.get(k)); conta('jaExistiam', 'processes'); continue }
    const clientId = mapaCliente.get(p.clientId)
    if (!clientId) {
      rel.erros.push({ tipo: 'processo', nome: p.title, motivo: 'cliente correspondente não foi encontrado nem criado' })
      continue
    }
    try {
      const { id: _i, tenantId: _t, createdAt: _c, updatedAt: _u, ...campos } = p
      const criado = await api.processes.create({ ...campos, clientId })
      mapaProcesso.set(p.id, criado.id)
      porChaveProc.set(k, criado.id)
      conta('enviados', 'processes')
    } catch (e) {
      rel.erros.push({ tipo: 'processo', nome: p.title, motivo: e?.message ?? String(e) })
    }
  }

  // ── 3. Prazos ──────────────────────────────────────────────────────────
  const prazosServidor = new Set(listaDe(await api.deadlines.list({ limit: 1000 })).map(chavePrazo))
  feitos = 0
  for (const d of local.deadlines) {
    onProgresso({ etapa: 'Prazos', feitos: feitos++, total: local.deadlines.length })
    if (prazosServidor.has(chavePrazo(d))) { conta('jaExistiam', 'deadlines'); continue }
    try {
      const { id: _i, tenantId: _t, createdAt: _c, updatedAt: _u, ...campos } = d
      await api.deadlines.create({
        ...campos,
        processId: mapaProcesso.get(d.processId) ?? null,
        clientId:  mapaCliente.get(d.clientId) ?? null,
      })
      prazosServidor.add(chavePrazo(d))
      conta('enviados', 'deadlines')
    } catch (e) {
      rel.erros.push({ tipo: 'prazo', nome: d.title, motivo: e?.message ?? String(e) })
    }
  }

  // ── 4. Tarefas ─────────────────────────────────────────────────────────
  const tarefasServidor = new Set(listaDe(await api.tasks.list({ limit: 1000 })).map(chaveTarefa))
  feitos = 0
  for (const t of local.tasks) {
    onProgresso({ etapa: 'Tarefas', feitos: feitos++, total: local.tasks.length })
    if (tarefasServidor.has(chaveTarefa(t))) { conta('jaExistiam', 'tasks'); continue }
    try {
      const { id: _i, tenantId: _t2, createdAt: _c, updatedAt: _u, ...campos } = t
      await api.tasks.create({
        ...campos,
        processId: mapaProcesso.get(t.processId) ?? null,
        clientId:  mapaCliente.get(t.clientId) ?? null,
      })
      tarefasServidor.add(chaveTarefa(t))
      conta('enviados', 'tasks')
    } catch (e) {
      rel.erros.push({ tipo: 'tarefa', nome: t.title, motivo: e?.message ?? String(e) })
    }
  }

  // ── 5. Movimentações (só as de processos que existem) ──────────────────
  feitos = 0
  for (const m of local.movements) {
    onProgresso({ etapa: 'Movimentações', feitos: feitos++, total: local.movements.length })
    const processId = mapaProcesso.get(m.processId)
    if (!processId) { conta('jaExistiam', 'movements'); continue }
    try {
      const jaTem = listaDe(await api.processes.movements(processId)).map(chaveMovim)
      if (jaTem.includes(chaveMovim({ ...m, processId }))) { conta('jaExistiam', 'movements'); continue }
      const { id: _i, tenantId: _t, createdAt: _c, ...campos } = m
      await api.processes.addMovement(processId, campos)
      conta('enviados', 'movements')
    } catch (e) {
      rel.erros.push({ tipo: 'movimentação', nome: m.description, motivo: e?.message ?? String(e) })
    }
  }

  // ── 6. O que fica para depois ──────────────────────────────────────────
  for (const nome of PENDENTE_ETAPA1) rel.pendentes[nome] = local[nome].length

  rel.tudoEnviado = rel.erros.length === 0 &&
    Object.values(rel.pendentes).every(n => n === 0)

  return rel
}

// Só deve ser chamado depois de um envio sem erros e sem pendências.
export function limparLocal() {
  const apagadas = []
  for (const [nome, chave] of Object.entries(CHAVES)) {
    if (PENDENTE_ETAPA1.includes(nome)) continue   // ainda não subiu: não apaga
    if (localStorage.getItem(chave) !== null) { localStorage.removeItem(chave); apagadas.push(chave) }
  }
  return apagadas
}
