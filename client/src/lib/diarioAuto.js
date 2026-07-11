// ─────────────────────────────────────────────────────────────────────────
//  Sincronização do Diário (DJEN) — reutilizada pela página Movimentações
//  e pelo auto-sync (a cada minuto) do AppShell.
//  Cada publicação vinculada a um processo gera: movimentação + tarefa + prazo.
// ─────────────────────────────────────────────────────────────────────────
import api from './api'
import { fetchPublicacoes, getOabConfig, getSeen, markSeen } from './diarioOficial'

const digits = (s) => String(s || '').replace(/\D/g, '')
const addDaysISO = (baseISO, n) => {
  const d = baseISO ? new Date(baseISO.slice(0, 10) + 'T00:00:00') : new Date()
  d.setDate(d.getDate() + (Number(n) || 15))
  return d.toISOString().slice(0, 10)
}
const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

export const matchProcesso = (pub, processos) =>
  processos.find(p => digits(p.judicialNumber) && digits(p.judicialNumber) === digits(pub.processo))

// Processa UMA publicação vinculada a um processo (movimentação + tarefa + prazo)
export async function processarPublicacao(pub, { processos, users, currentUser, prazoDias = 15 }) {
  const proc = matchProcesso(pub, processos)
  const pubDate = (pub.data || new Date().toISOString()).slice(0, 10)
  const prazoDate = addDaysISO(pubDate, prazoDias)
  const oQueE = pub.tipo || 'Publicação'
  const resumo = (pub.texto || '').slice(0, 400)

  if (proc) {
    await api.processes.addMovement(proc.id, {
      date: pubDate,
      description: `[DJEN — ${pub.tribunal || 'Diário'}] ${oQueE}: ${resumo}`,
      type: 'status', author: pub.orgao || pub.tribunal || 'Diário Oficial', isPublic: false,
    })
    const responsavel = users.find(u => u.id === proc.assignedTo) || currentUser
    await api.tasks.create({
      title: `📰 ${oQueE} — ${proc.title}`,
      description: `Publicação do DJEN. Prazo sugerido: ${fmt(prazoDate)}.\n\n${resumo}`,
      status: 'todo', dueDate: prazoDate, priority: 'high',
      assignedTo: responsavel?.id ?? currentUser?.id, assignedToName: responsavel?.name ?? currentUser?.name ?? '',
      createdBy: currentUser?.id ?? '', createdByName: 'Sistema (DJEN)', acknowledged: false,
      processId: proc.id, clientId: proc.clientId,
    })
    await api.deadlines.create({
      title: `${oQueE} — a confirmar`, dueDate: prazoDate, processId: proc.id,
      clientId: proc.clientId, status: 'pending', needsReview: true,
    })
  }
  markSeen(pub.id)
  return proc ? 'ok' : 'sem-processo'
}

// Sincroniza tudo: busca no DJEN e processa as novas publicações vinculadas
export async function sincronizarDiario({ currentUser, prazoDias = 15, auto = true } = {}) {
  const cfg = getOabConfig()
  if (!cfg.oab) return { ok: false, motivo: 'sem-oab' }
  let lista
  try { lista = await fetchPublicacoes({ oab: cfg.oab, uf: cfg.uf }) }
  catch (e) { return { ok: false, motivo: 'erro', erro: e.message } }

  localStorage.setItem('pj_movimentacoes', JSON.stringify(lista))
  localStorage.setItem('pj_diario_ultima_sync', new Date().toISOString())
  if (!auto) return { ok: true, lista, processadas: 0 }

  const [procsR, usersR] = await Promise.all([
    api.processes.list().catch(() => []),
    api.settings.users().catch(() => []),
  ])
  const processos = Array.isArray(procsR) ? procsR : (procsR?.data ?? [])
  const users = Array.isArray(usersR) ? usersR : (usersR?.data ?? [])
  const vistos = new Set(getSeen())
  const novas = lista.filter(p => !vistos.has(p.id) && matchProcesso(p, processos))
  for (const pub of novas) {
    try { await processarPublicacao(pub, { processos, users, currentUser, prazoDias }) } catch { /* segue */ }
  }
  return { ok: true, lista, processadas: novas.length }
}
