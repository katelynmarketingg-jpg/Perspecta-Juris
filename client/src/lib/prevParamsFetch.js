// ─────────────────────────────────────────────────────────────────────────
//  Busca assistida de parâmetros previdenciários.
//  INPC: série oficial do IBGE (número-índice, SIDRA t/1736 v/2289) via apisidra.
//  Calcula o fator acumulado de cada ano (julho) até o mês mais recente.
//  Em dev usa o proxy /sidra (vite.config.js). Em produção, aponte para um
//  backend que faça o mesmo proxy (a apisidra não envia cabeçalho CORS).
// ─────────────────────────────────────────────────────────────────────────
const SIDRA = '/sidra/values/t/1736/n1/all/v/2289/p/all'

// Busca a série do número-índice do INPC e devolve { fatores:{ano:fator}, ultimoPeriodo }
export async function buscarINPCdoIBGE() {
  const res = await fetch(SIDRA, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`IBGE retornou ${res.status}.`)
  const data = await res.json()
  if (!Array.isArray(data) || data.length < 2) throw new Error('Formato inesperado da resposta do IBGE.')

  // apisidra: 1ª linha é cabeçalho; demais têm D3C (competência AAAAMM) e V (valor)
  const entradas = data.slice(1)
    .map(x => [String(x.D3C ?? ''), parseFloat(String(x.V ?? '').replace(',', '.'))])
    .filter(([per, val]) => /^\d{6}$/.test(per) && isFinite(val) && val > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
  if (!entradas.length) throw new Error('Série do INPC vazia.')

  const indicePorPeriodo = Object.fromEntries(entradas)
  const ultimoPeriodo = entradas[entradas.length - 1][0]
  const indiceAtual = indicePorPeriodo[ultimoPeriodo]

  // Índice de referência de cada ano = julho (mês do reajuste); senão o 1º mês do ano.
  const fatores = {}
  const anoAtual = Number(ultimoPeriodo.slice(0, 4))
  for (let ano = 1994; ano <= anoAtual; ano++) {
    const jul = indicePorPeriodo[`${ano}07`]
    let ref = jul
    if (ref == null) {
      const primeiro = entradas.find(([p]) => p.slice(0, 4) === String(ano))
      ref = primeiro ? primeiro[1] : null
    }
    if (ref) fatores[ano] = Number((indiceAtual / ref).toFixed(4))
  }
  fatores[anoAtual] = 1  // ano corrente ≈ sem correção
  return { fatores, ultimoPeriodo, indiceAtual }
}

// Converte texto colado "chave separador valor" (uma linha por par) em objeto numérico.
export function parsePares(texto) {
  const out = {}
  for (const linha of String(texto || '').split('\n')) {
    const m = linha.trim().match(/^(\d+)\s*[=:;\t ]\s*([\d.,]+)/)
    if (m) {
      const k = Number(m[1])
      const v = parseFloat(m[2].replace(/\./g, m[2].includes(',') ? '' : '.').replace(',', '.'))
      if (isFinite(v)) out[k] = v
    }
  }
  return out
}
