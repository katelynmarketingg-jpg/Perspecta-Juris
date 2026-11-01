// ─────────────────────────────────────────────────────────────────────────
//  Fila de atendimento e histórico de atendimentos.
//
//  Isto aqui era `localStorage`. Num escritório com recepção, não servia:
//  quem cadastrava era o único a enxergar a fila. A pessoa escolhida em
//  "atender com" nunca via o chamado, porque ele estava no navegador da
//  recepção. Agora é o servidor, e todo mundo vê a mesma fila.
//
//  As funções são ASSÍNCRONAS. As telas que usam esta biblioteca precisam
//  esperar o servidor — e, quando a escrita falhar, dizer que falhou em
//  vez de fingir que deu certo.
// ─────────────────────────────────────────────────────────────────────────
import api from './api'

export const TIPOS_ATEND = [
  { value: 'presencial', label: 'Presencial', icone: '🏢' },
  { value: 'online',     label: 'Online',     icone: '💻' },
  { value: 'whatsapp',   label: 'WhatsApp',   icone: '💬' },
  { value: 'telefone',   label: 'Telefone',   icone: '📞' },
]
export const tipoAtend = (t) => TIPOS_ATEND.find(x => x.value === t) ?? { label: t, icone: '•' }

/** Quem está esperando agora, por ordem de chegada. */
export const getFila = () => api.atendimentos.list({ status: 'fila' })

/**
 * Quantos estão na fila — para o selo do menu.
 * Devolve 0 quando o servidor não responde: um selo é enfeite, e não vale
 * derrubar a tela inteira por causa dele.
 */
export async function filaCount() {
  try { return (await getFila()).length } catch { return 0 }
}

/** Coloca alguém na fila. `assignedToId` é o acesso que vai atender. */
export const addToFila = ({ clientId, clientName, assignedToId, tipo = 'presencial', obs }) =>
  api.atendimentos.create({ clientId: clientId ?? null, clientName, assignedToId: assignedToId ?? null, tipo, obs, status: 'fila' })

/** Chama da fila. Quem clica é quem atendeu. */
export const atender = (id) => api.atendimentos.atender(id)

export const removerAtendimento = (id) => api.atendimentos.remove(id)

/** Registra um atendimento já concluído (online, WhatsApp respondido). */
export const registrarAtendimento = ({ clientId, clientName, tipo = 'online', obs }) =>
  api.atendimentos.create({ clientId: clientId ?? null, clientName, tipo, obs, status: 'atendido' })

/** Histórico de um cliente, do mais recente para o mais antigo. */
export const getAtendimentosCliente = (clientId) => api.atendimentos.list({ clientId })

/** Relatório dos concluídos, com filtro por período e por quem atendeu. */
export const getRelatorioAtendimentos = ({ de, ate, atendidoPor } = {}) =>
  api.atendimentos.list({ status: 'atendido', ...(de ? { de } : {}), ...(ate ? { ate } : {}), ...(atendidoPor ? { atendidoPor } : {}) })

/** Minutos entre a chegada e o atendimento (ou até agora, se ainda espera). */
export function esperaMin(a) {
  if (!a?.createdAt) return 0
  const fim = a.attendedAt ? new Date(a.attendedAt) : new Date()
  return Math.max(0, Math.round((fim - new Date(a.createdAt)) / 60000))
}
