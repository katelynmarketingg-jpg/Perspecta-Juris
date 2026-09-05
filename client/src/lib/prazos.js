// ─────────────────────────────────────────────────────────────────────────
//  Contagem de prazo processual em dias úteis.
//
//  O módulo de Prazos exige que a data de vencimento seja digitada à mão.
//  Contar 15 dias úteis de cabeça, pulando feriado e o recesso de fim de ano,
//  é onde prazo se perde — e prazo perdido é ação perdida.
//
//  Regras aplicadas:
//    art. 219 CPC  — prazo processual em dias conta só os dias ÚTEIS;
//    art. 224 §1º  — exclui o dia do começo, inclui o do vencimento;
//    art. 224 §3º  — a contagem começa no primeiro dia útil seguinte;
//    art. 220      — de 20/12 a 20/01 os prazos ficam suspensos;
//    art. 216      — feriados são dias sem expediente forense.
//
//  Prazo de direito material (prescrição, decadência, contratos) conta em
//  dias CORRIDOS — daí a opção, e não um padrão escondido.
// ─────────────────────────────────────────────────────────────────────────

const DIA = 86400000
const iso = (d) => d.toISOString().slice(0, 10)

export function emUTC(s) {
  if (!s) return null
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(s)
  return isNaN(d) ? null : d
}

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher.
 * Carnaval, Sexta-feira Santa e Corpus Christi andam com ela todo ano —
 * uma lista fixa de feriados ficaria errada no ano seguinte.
 */
export function pascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}

const somaDias = (d, n) => new Date(d.getTime() + n * DIA)

/**
 * Feriados de um ano: os nacionais (Lei 662/49, Lei 10.607/2002 e Lei
 * 14.759/2023) mais Carnaval, Sexta-feira Santa e Corpus Christi, em que os
 * tribunais não abrem.
 *
 * O erro perigoso aqui tem direção: marcar como feriado um dia que teve
 * expediente joga o vencimento para DEPOIS do real, e a petição entra
 * intempestiva. Marcar como útil um dia que era feriado joga para ANTES, e a
 * pessoa protocola adiantada — chato, não fatal.
 *
 * Por isso a lista peca por escassez. A Quarta-feira de Cinzas, por exemplo,
 * fica de fora: na maioria dos tribunais há expediente, ainda que parcial.
 *
 * Feriado estadual, municipal e suspensão de expediente por portaria NÃO
 * entram — variam por comarca e por semana. Quem usa informa os seus.
 */
export function feriadosDoAno(ano) {
  const p = pascoa(ano)
  const fixos = [
    [0, 1, 'Confraternização Universal'],
    [3, 21, 'Tiradentes'],
    [4, 1, 'Dia do Trabalho'],
    [8, 7, 'Independência'],
    [9, 12, 'Nossa Senhora Aparecida'],
    [10, 2, 'Finados'],
    [10, 15, 'Proclamação da República'],
    [10, 20, 'Consciência Negra'],
    [11, 25, 'Natal'],
  ].map(([m, d, nome]) => ({ data: iso(new Date(Date.UTC(ano, m, d))), nome }))

  const moveis = [
    { data: iso(somaDias(p, -48)), nome: 'Carnaval (segunda)' },
    { data: iso(somaDias(p, -47)), nome: 'Carnaval (terça)' },
    { data: iso(somaDias(p, -2)),  nome: 'Sexta-feira Santa' },
    { data: iso(somaDias(p, 60)),  nome: 'Corpus Christi' },
  ]
  return [...fixos, ...moveis]
}

// Recesso forense: 20/12 a 20/01 (art. 220 CPC). Os prazos ficam suspensos.
export function noRecesso(d) {
  const m = d.getUTCMonth(), dia = d.getUTCDate()
  return (m === 11 && dia >= 20) || (m === 0 && dia <= 20)
}

const ehFimDeSemana = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6

/**
 * Dia útil forense: não é fim de semana, feriado, nem recesso.
 * `extras` é a lista de feriados locais que quem usa informa.
 */
export function ehDiaUtil(d, extras = new Set(), considerarRecesso = true) {
  if (!d) return false
  if (ehFimDeSemana(d)) return false
  if (considerarRecesso && noRecesso(d)) return false
  const s = iso(d)
  if (extras.has(s)) return false
  return !feriadosDoAno(d.getUTCFullYear()).some(f => f.data === s)
}

export function proximoDiaUtil(d, extras, recesso = true) {
  let x = d
  let guarda = 0
  while (!ehDiaUtil(x, extras, recesso) && guarda++ < 400) x = somaDias(x, 1)
  return x
}

/**
 * Calcula o vencimento de um prazo.
 *
 * @param {string} publicacaoISO  data da publicação/intimação
 * @param {number} dias           quantidade de dias do prazo
 * @param {object} opts
 *   uteis          true = dias úteis (processual, art. 219 CPC);
 *                  false = corridos (direito material)
 *   dobro          true = prazo em dobro (Fazenda, MP, Defensoria: art. 183,
 *                  186 CPC; litisconsortes com procuradores distintos: art. 229)
 *   feriadosExtras array de 'yyyy-mm-dd' — feriados locais da comarca
 *   recesso        aplica a suspensão de 20/12 a 20/01
 */
export function calcularPrazo(publicacaoISO, dias, opts = {}) {
  const {
    uteis = true, dobro = false, feriadosExtras = [], recesso = true,
    // Prazo processual começa no primeiro dia útil seguinte (art. 224, §3º,
    // CPC). Prazo de direito material começa no dia seguinte, útil ou não —
    // o art. 132 do Código Civil só prorroga o VENCIMENTO.
    inicioNoDiaUtil = uteis,
  } = opts

  const pub = emUTC(publicacaoISO)
  const n = Math.max(0, Math.floor(Number(dias) || 0))
  if (!pub || !n) return null

  const extras = new Set(feriadosExtras.filter(Boolean).map(s => String(s).slice(0, 10)))
  const total = dobro ? n * 2 : n

  // Art. 224, §3º: a contagem começa no primeiro dia útil seguinte ao da
  // publicação. Se a publicação cai numa sexta, o prazo começa na segunda.
  const diaSeguinte = somaDias(pub, 1)
  const inicio = inicioNoDiaUtil ? proximoDiaUtil(diaSeguinte, extras, recesso) : diaSeguinte

  const passos = []
  let atual = inicio, contados = 0, guarda = 0

  if (uteis) {
    // Art. 224, §1º: exclui o dia do começo, inclui o do vencimento — por isso
    // o primeiro dia útil já é o dia 1.
    while (contados < total && guarda++ < 5000) {
      if (ehDiaUtil(atual, extras, recesso)) {
        contados++
        if (contados === total) break
      }
      atual = somaDias(atual, 1)
    }
    // Se parou num dia não útil (não deve acontecer), empurra.
    atual = proximoDiaUtil(atual, extras, recesso)
  } else {
    // Corridos: conta tudo. Mas se o último dia não é útil, prorroga —
    // o protocolo não abre em feriado (art. 224, §1º).
    atual = somaDias(inicio, total - 1)
    const antes = iso(atual)
    atual = proximoDiaUtil(atual, extras, recesso)
    if (iso(atual) !== antes) passos.push(`Vencimento caiu em dia sem expediente (${fmt(antes)}) — prorrogado para o dia útil seguinte.`)
  }

  const pulados = diasPulados(inicio, atual, extras, recesso)
  return {
    inicio: iso(inicio),
    vencimento: iso(atual),
    diasCorridos: Math.round((atual - pub) / DIA),
    total,
    pulados,
    passos,
  }
}

// Lista o que não contou no meio do caminho — é isso que a pessoa quer ver
// quando desconfia do resultado.
function diasPulados(de, ate, extras, recesso) {
  const out = []
  let x = de, guarda = 0
  while (x <= ate && guarda++ < 5000) {
    if (!ehDiaUtil(x, extras, recesso)) {
      const s = iso(x)
      const nome = ehFimDeSemana(x)
        ? (x.getUTCDay() === 0 ? 'domingo' : 'sábado')
        : (recesso && noRecesso(x) ? 'recesso forense (art. 220 CPC)'
          : (extras.has(s) ? 'feriado informado'
            : feriadosDoAno(x.getUTCFullYear()).find(f => f.data === s)?.nome ?? 'sem expediente'))
      out.push({ data: s, motivo: nome })
    }
    x = somaDias(x, 1)
  }
  return out
}

export const fmt = (isoStr) => {
  const d = emUTC(isoStr)
  if (!d) return '—'
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()} (${dias[d.getUTCDay()]})`
}
