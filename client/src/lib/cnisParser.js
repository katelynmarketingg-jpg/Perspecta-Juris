// ─────────────────────────────────────────────────────────────────────────
//  Parser de CNIS (Cadastro Nacional de Informações Sociais)
//  Extrai vínculos, remunerações e dados do segurado a partir do texto.
//  Heurístico: o CNIS não tem layout único — SEMPRE revisar o resultado.
// ─────────────────────────────────────────────────────────────────────────

const isoFromBr = (br) => {
  // "dd/mm/yyyy" -> "yyyy-mm-dd"
  const m = String(br).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
// competência "mm/yyyy" -> {ano, mes, iso início/fim do mês}
const compToDates = (mm, yyyy) => ({
  inicio: `${yyyy}-${mm}-01`,
  fim: `${yyyy}-${mm}-${new Date(Number(yyyy), Number(mm), 0).getDate()}`,
})
const brToNum = (s) => {
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
  return isFinite(n) ? n : 0
}

// Carrega pdf.js sob demanda e extrai o texto de todas as páginas
export async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  let text = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    // Reconstrói linhas aproximando por posição Y
    let lastY = null, line = ''
    const lines = []
    for (const item of content.items) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 3) { lines.push(line); line = '' }
      line += (line ? ' ' : '') + item.str
      lastY = y
    }
    if (line) lines.push(line)
    text += lines.join('\n') + '\n'
  }
  return text
}

// ── Parser principal do texto do CNIS ──────────────────────────────────────
export function parseCnisText(raw) {
  const text = String(raw || '').replace(/\r/g, '')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // ── Dados do segurado ──
  const segurado = { nome: '', nascimento: '', nit: '' }
  const nomeMatch = text.match(/Nome[:\s]+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú' ]{4,60})/)
  if (nomeMatch) segurado.nome = nomeMatch[1].trim().replace(/\s{2,}/g, ' ')
  const nascMatch = text.match(/(?:Data de Nascimento|Nascimento|Nasc\.?)[:\s]+(\d{2}\/\d{2}\/\d{4})/i)
  if (nascMatch) segurado.nascimento = isoFromBr(nascMatch[1])
  const nitMatch = text.match(/NIT[:\s]+([\d.\-]{10,})/i)
  if (nitMatch) segurado.nit = nitMatch[1]

  // ── Vínculos ──
  // Estratégia: localizar blocos de vínculo. No CNIS há linhas com
  // "Data Início" e "Data Fim" (ou intervalo dd/mm/yyyy a dd/mm/yyyy).
  const vinculos = []
  const seen = new Set()

  // Padrão A: "Início ... dd/mm/yyyy" seguido de "Fim ... dd/mm/yyyy"
  const inicioRe = /(?:in[íi]cio)[^0-9]{0,20}(\d{2}\/\d{2}\/\d{4})/i
  const fimRe = /(?:fim|t[ée]rmino)[^0-9]{0,20}(\d{2}\/\d{2}\/\d{4})/i

  // Extrai o nome do empregador/empresa de uma janela de texto.
  // O nome vem ANTES das datas → pega a ocorrência mais próxima (a última).
  const limpaEmp = (s) => String(s)
    .split(/\s+(?:Data|NIT|Tipo|C[óo]d|CNPJ|CEI|Matr|Seq|In[íi]cio|Fim|Remunera)/i)[0]
    .replace(/\s{2,}/g, ' ').trim()
  const empregadorDe = (win) => {
    const labeled = [...win.matchAll(/(?:origem do v[íi]nculo|empregador|raz[ãa]o social|nome empresarial)\s*[:\-]?\s+([A-ZÀ-Ú][A-ZÀ-Ú0-9 .,&'ºª\-/]{3,70})/gi)]
    const suffix  = [...win.matchAll(/([A-ZÀ-Ú][A-ZÀ-Ú0-9 .,&'ºª\-/]{3,70}(?:LTDA|EIRELI|EPP|MEI|S\/A|S\.?A\.?|- ?ME|\bME\b|\bSA\b|MUNIC[IÍ]PIO|PREFEITURA|ESTADO))/g)]
    const pool = labeled.length ? labeled : suffix
    return pool.length ? limpaEmp(pool[pool.length - 1][1]) : ''
  }

  // Ancora na LINHA onde está a data de início; a empresa está nas linhas acima
  for (let i = 0; i < lines.length; i++) {
    const ini = lines[i].match(inicioRe)
    if (!ini) continue
    let fim = lines[i].match(fimRe)
    if (!fim) { for (let j = i + 1; j <= i + 2 && j < lines.length; j++) { const f = lines[j].match(fimRe); if (f) { fim = f; break } } }
    const key = ini[1] + (fim ? fim[1] : '')
    if (seen.has(key)) continue
    seen.add(key)
    const janela = lines.slice(Math.max(0, i - 5), i + 1).join('\n')  // empresa vem antes das datas
    vinculos.push({ inicio: isoFromBr(ini[1]), fim: fim ? isoFromBr(fim[1]) : '', origem: empregadorDe(janela) })
  }

  // Padrão B (fallback): intervalos "dd/mm/yyyy a dd/mm/yyyy" ou "dd/mm/yyyy - dd/mm/yyyy"
  if (vinculos.length === 0) {
    const rangeRe = /(\d{2}\/\d{2}\/\d{4})\s*(?:a|à|-|até)\s*(\d{2}\/\d{2}\/\d{4})/gi
    let m
    while ((m = rangeRe.exec(text)) !== null) {
      const key = m[1] + m[2]
      if (!seen.has(key)) {
        const ctx = text.slice(Math.max(0, m.index - 120), m.index + 40)
        seen.add(key)
        vinculos.push({ inicio: isoFromBr(m[1]), fim: isoFromBr(m[2]), origem: empregadorDe(ctx) })
      }
    }
  }

  // ── Remunerações (competências) ──
  // Linhas do tipo: "01/2010   1.234,56"  (mm/yyyy  valor)
  const remuneracoes = []
  const compRe = /(\d{2})\/(\d{4})\s+([\d.]+,\d{2})/g
  let cm
  while ((cm = compRe.exec(text)) !== null) {
    const mes = cm[1], ano = cm[2], valor = brToNum(cm[3])
    if (Number(mes) >= 1 && Number(mes) <= 12 && Number(ano) >= 1970 && Number(ano) <= 2100 && valor > 0) {
      remuneracoes.push({ mes, ano, valor, ...compToDates(mes, ano) })
    }
  }

  // ── Atribui salário médio a cada vínculo pelas competências no intervalo ──
  for (const v of vinculos) {
    if (!v.inicio) continue
    const ini = new Date(v.inicio), fim = v.fim ? new Date(v.fim) : new Date()
    const dentro = remuneracoes.filter(r => {
      const d = new Date(r.inicio)
      return d >= new Date(ini.getFullYear(), ini.getMonth(), 1) && d <= fim
    })
    if (dentro.length) v.salario = (dentro.reduce((s, r) => s + r.valor, 0) / dentro.length).toFixed(2)
    v.atividade = 'comum'
    v.grau = '25'
    v.ppp = false
    v.pendencia = ''
    v.id = Math.random().toString(36).slice(2, 10)
  }

  // Se não achou vínculos mas achou competências, cria um vínculo por bloco contínuo
  if (vinculos.length === 0 && remuneracoes.length) {
    const ordenadas = [...remuneracoes].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
    let bloco = [ordenadas[0]]
    const push = (arr) => {
      const salario = (arr.reduce((s, r) => s + r.valor, 0) / arr.length).toFixed(2)
      vinculos.push({ id: Math.random().toString(36).slice(2, 10), inicio: arr[0].inicio, fim: arr[arr.length - 1].fim, salario, atividade: 'comum', grau: '25', ppp: false, pendencia: '', origem: 'Reconstruído por competências' })
    }
    for (let i = 1; i < ordenadas.length; i++) {
      const prev = new Date(ordenadas[i - 1].inicio), cur = new Date(ordenadas[i].inicio)
      const gapMeses = (cur.getFullYear() - prev.getFullYear()) * 12 + (cur.getMonth() - prev.getMonth())
      if (gapMeses > 2) { push(bloco); bloco = [] }
      bloco.push(ordenadas[i])
    }
    if (bloco.length) push(bloco)
  }

  return {
    segurado,
    vinculos: vinculos.filter(v => v.inicio),
    remuneracoes,
    stats: { vinculos: vinculos.length, competencias: remuneracoes.length },
  }
}
