// ─────────────────────────────────────────────────────────────────────────
//  Os perfis de acesso — uma lista só.
//
//  Havia dois vocabulários para a mesma coisa: a tela de Configurações
//  gravava 'lawyer' e 'staff', enquanto o resto do sistema falava 'advogado'
//  e 'estagiario'. O servidor aceitava os dois sem reclamar, e a cicatriz
//  aparecia em ProcessForm, que filtrava pelas CINCO variantes para não
//  perder ninguém do seletor de responsável.
//
//  Aqui o vocabulário é um só, em português — que já era o padrão do servidor
//  quando ninguém mandava perfil nenhum.
//
//  Importante: o servidor só distingue 'admin' e 'master'. Os demais perfis
//  não dão nem tiram permissão — quem manda nas abas é settings.permissions,
//  gravado por usuário (server/lib/permissions.js). Trocar o rótulo de
//  alguém não muda o que essa pessoa enxerga.
// ─────────────────────────────────────────────────────────────────────────

export const PAPEIS = [
  { valor: 'admin',         rotulo: 'Administrador' },
  { valor: 'advogado',      rotulo: 'Advogado(a)' },
  { valor: 'estagiario',    rotulo: 'Estagiário(a)' },
  { valor: 'financeiro',    rotulo: 'Financeiro' },
  { valor: 'recepcionista', rotulo: 'Recepção / Secretaria' },
]

export const PAPEL_PADRAO = 'advogado'

// Perfis que podem ser responsáveis por um processo. Financeiro e recepção
// ficam de fora: não é restrição de permissão, é só não poluir o seletor.
export const PAPEIS_JURIDICOS = ['admin', 'advogado', 'estagiario']

// Nomes antigos que o sistema chegou a gravar, e o que eles viraram.
const EQUIVALENTES = {
  lawyer: 'advogado',
  staff:  'estagiario',
}

const VALIDOS = new Set([...PAPEIS.map(p => p.valor), 'master'])

/**
 * Devolve o perfil canônico, traduzindo os nomes antigos.
 * Vazio vira o padrão; qualquer outra coisa devolve null — quem chama decide
 * se recusa. 'master' passa, mas nunca deve ser criado por rota: ele nasce no
 * seed e é protegido contra exclusão.
 */
export function normalizarPapel(valor) {
  const bruto = String(valor ?? '').trim().toLowerCase()
  if (!bruto) return PAPEL_PADRAO
  const canonico = EQUIVALENTES[bruto] ?? bruto
  return VALIDOS.has(canonico) ? canonico : null
}

// Rótulo para exibição. Um perfil desconhecido (vindo de um banco antigo)
// aparece como está, em vez de sumir da tela.
export function rotuloDoPapel(valor) {
  const canonico = EQUIVALENTES[String(valor ?? '').toLowerCase()] ?? valor
  if (canonico === 'master') return 'Administradora do sistema'
  return PAPEIS.find(p => p.valor === canonico)?.rotulo ?? String(valor ?? '—')
}
