import { useState, useMemo } from 'react'
import { IconSearch, IconBookOpen, IconExternalLink } from '../../components/ui'

// ─────────────────────────────────────────────────────────────────────────
//  Vade Mecum — legislação oficial (Planalto) + índice remissivo por tema.
//  Busque um assunto ("divórcio", "dano moral", "furto") e o sistema mostra
//  em quais artigos/códigos está, com link para o texto oficial.
// ─────────────────────────────────────────────────────────────────────────
const P = 'http://www.planalto.gov.br/ccivil_03'
const VADE = [
  { sigla: 'CF/88',  nome: 'Constituição Federal de 1988', cat: 'Constituição', url: `${P}/constituicao/constituicao.htm`, kw: ['constituição', 'direitos fundamentais'] },
  { sigla: 'CC',     nome: 'Código Civil (Lei 10.406/2002)', cat: 'Códigos', url: `${P}/leis/2002/l10406compilada.htm`, kw: ['civil', 'contratos', 'família', 'sucessões'] },
  { sigla: 'CPC',    nome: 'Código de Processo Civil (Lei 13.105/2015)', cat: 'Códigos', url: `${P}/_ato2015-2018/2015/lei/l13105.htm`, kw: ['processo civil', 'recurso', 'execução'] },
  { sigla: 'CP',     nome: 'Código Penal (Dec-Lei 2.848/1940)', cat: 'Códigos', url: `${P}/decreto-lei/del2848compilado.htm`, kw: ['penal', 'crime', 'pena'] },
  { sigla: 'CPP',    nome: 'Código de Processo Penal (Dec-Lei 3.689/1941)', cat: 'Códigos', url: `${P}/decreto-lei/del3689compilado.htm`, kw: ['processo penal', 'prisão'] },
  { sigla: 'CLT',    nome: 'CLT (Dec-Lei 5.452/1943)', cat: 'Códigos', url: `${P}/decreto-lei/del5452compilado.htm`, kw: ['trabalho', 'trabalhista'] },
  { sigla: 'CDC',    nome: 'Código de Defesa do Consumidor (Lei 8.078/1990)', cat: 'Códigos', url: `${P}/leis/l8078compilado.htm`, kw: ['consumidor'] },
  { sigla: 'CTN',    nome: 'Código Tributário Nacional (Lei 5.172/1966)', cat: 'Códigos', url: `${P}/leis/l5172compilado.htm`, kw: ['tributário', 'imposto'] },
  { sigla: 'CTB',    nome: 'Código de Trânsito (Lei 9.503/1997)', cat: 'Códigos', url: `${P}/leis/l9503compilado.htm`, kw: ['trânsito', 'multa'] },
  { sigla: 'ECA',    nome: 'Estatuto da Criança e do Adolescente (Lei 8.069/1990)', cat: 'Estatutos', url: `${P}/leis/l8069.htm`, kw: ['criança', 'adolescente'] },
  { sigla: 'Idoso',  nome: 'Estatuto da Pessoa Idosa (Lei 10.741/2003)', cat: 'Estatutos', url: `${P}/leis/2003/l10.741.htm`, kw: ['idoso'] },
  { sigla: 'OAB',    nome: 'Estatuto da OAB (Lei 8.906/1994)', cat: 'Estatutos', url: `${P}/leis/l8906.htm`, kw: ['oab', 'advogado', 'honorários'] },
  { sigla: 'EPD',    nome: 'Estatuto da Pessoa com Deficiência (Lei 13.146/2015)', cat: 'Estatutos', url: `${P}/_ato2015-2018/2015/lei/l13146.htm`, kw: ['deficiência'] },
  { sigla: 'LINDB',  nome: 'LINDB (Dec-Lei 4.657/1942)', cat: 'Leis', url: `${P}/decreto-lei/del4657compilado.htm`, kw: ['lindb', 'vigência'] },
  { sigla: 'Locação', nome: 'Lei do Inquilinato (Lei 8.245/1991)', cat: 'Leis', url: `${P}/leis/l8245.htm`, kw: ['locação', 'aluguel', 'despejo'] },
  { sigla: 'JEC',    nome: 'Juizados Especiais (Lei 9.099/1995)', cat: 'Leis', url: `${P}/leis/l9099.htm`, kw: ['juizado', 'pequenas causas'] },
  { sigla: 'MariaPenha', nome: 'Lei Maria da Penha (Lei 11.340/2006)', cat: 'Leis', url: `${P}/_ato2004-2006/2006/lei/l11340.htm`, kw: ['violência doméstica', 'mulher'] },
  { sigla: 'Drogas', nome: 'Lei de Drogas (Lei 11.343/2006)', cat: 'Leis', url: `${P}/_ato2004-2006/2006/lei/l11343.htm`, kw: ['drogas', 'tráfico'] },
  { sigla: 'LEP',    nome: 'Lei de Execução Penal (Lei 7.210/1984)', cat: 'Leis', url: `${P}/leis/l7210.htm`, kw: ['execução penal', 'regime'] },
  { sigla: 'L8213',  nome: 'Benefícios da Previdência (Lei 8.213/1991)', cat: 'Leis', url: `${P}/leis/l8213cons.htm`, kw: ['previdência', 'aposentadoria', 'inss'] },
  { sigla: 'Alimentos', nome: 'Lei de Alimentos (Lei 5.478/1968)', cat: 'Leis', url: `${P}/leis/l5478.htm`, kw: ['alimentos', 'pensão'] },
  { sigla: 'LGPD',   nome: 'LGPD (Lei 13.709/2018)', cat: 'Leis', url: `${P}/_ato2015-2018/2018/lei/l13709.htm`, kw: ['dados', 'privacidade'] },
  { sigla: 'MS',     nome: 'Mandado de Segurança (Lei 12.016/2009)', cat: 'Leis', url: `${P}/_ato2007-2010/2009/lei/l12016.htm`, kw: ['mandado de segurança'] },
]
const COD = Object.fromEntries(VADE.map(v => [v.sigla, v.url]))
const CATS = ['Constituição', 'Códigos', 'Estatutos', 'Leis']

// Índice remissivo: tema → artigos exatos em cada código/lei. r = [sigla, "arts. X a Y", "ementa", primeiroArtParaÂncora]
const INDICE = [
  // Família
  { tema: 'Divórcio', kw: ['divorcio', 'dissolução do casamento', 'separação'], refs: [['CC', 'arts. 1.571 a 1.582', 'Dissolução da sociedade e do vínculo conjugal', 1571], ['CPC', 'arts. 731 a 734', 'Divórcio e separação consensuais', 731]] },
  { tema: 'Casamento', kw: ['casamento', 'habilitação', 'impedimentos'], refs: [['CC', 'arts. 1.511 a 1.570', 'Do casamento', 1511]] },
  { tema: 'União estável', kw: ['uniao estavel', 'concubinato', 'companheiro'], refs: [['CC', 'arts. 1.723 a 1.727', 'Da união estável', 1723]] },
  { tema: 'Pensão alimentícia', kw: ['alimentos', 'pensao', 'pensão alimentícia'], refs: [['CC', 'arts. 1.694 a 1.710', 'Dos alimentos', 1694], ['Alimentos', 'Lei 5.478/68', 'Ação de alimentos (rito)', 1]] },
  { tema: 'Guarda dos filhos', kw: ['guarda', 'guarda compartilhada', 'visitas'], refs: [['CC', 'arts. 1.583 a 1.590', 'Da proteção dos filhos / guarda', 1583]] },
  { tema: 'Poder familiar', kw: ['poder familiar', 'patrio poder', 'destituição'], refs: [['CC', 'arts. 1.630 a 1.638', 'Do poder familiar', 1630]] },
  { tema: 'Regime de bens', kw: ['regime de bens', 'comunhão', 'separação de bens', 'pacto antenupcial'], refs: [['CC', 'arts. 1.639 a 1.688', 'Do regime de bens entre os cônjuges', 1639]] },
  { tema: 'Inventário e herança', kw: ['inventario', 'herança', 'sucessão', 'partilha', 'testamento'], refs: [['CC', 'arts. 1.784 a 2.027', 'Do direito das sucessões', 1784], ['CPC', 'arts. 610 a 673', 'Inventário e partilha (procedimento)', 610]] },

  // Obrigações / Contratos / Responsabilidade
  { tema: 'Contratos', kw: ['contrato', 'contratos'], refs: [['CC', 'arts. 421 a 480', 'Dos contratos em geral', 421]] },
  { tema: 'Compra e venda', kw: ['compra e venda', 'compra', 'venda'], refs: [['CC', 'arts. 481 a 532', 'Da compra e venda', 481]] },
  { tema: 'Responsabilidade civil / dano', kw: ['responsabilidade civil', 'dano', 'indenização', 'ato ilícito'], refs: [['CC', 'arts. 186, 187 e 927 a 954', 'Ato ilícito e obrigação de indenizar', 186]] },
  { tema: 'Dano moral', kw: ['dano moral', 'danos morais'], refs: [['CC', 'arts. 186 e 927', 'Dever de reparar o dano', 186], ['CF/88', 'art. 5º, V e X', 'Indenização por dano moral / intimidade', 5]] },
  { tema: 'Prescrição e decadência', kw: ['prescrição', 'decadência', 'prazo prescricional'], refs: [['CC', 'arts. 189 a 211', 'Da prescrição e da decadência', 189]] },
  { tema: 'Juros e mora', kw: ['juros', 'mora', 'correção'], refs: [['CC', 'arts. 394 a 405', 'Do inadimplemento / mora / juros', 394]] },

  // Direitos reais
  { tema: 'Posse', kw: ['posse', 'esbulho', 'reintegração de posse'], refs: [['CC', 'arts. 1.196 a 1.224', 'Da posse', 1196]] },
  { tema: 'Propriedade', kw: ['propriedade', 'domínio'], refs: [['CC', 'arts. 1.228 a 1.368', 'Da propriedade', 1228]] },
  { tema: 'Usucapião', kw: ['usucapiao', 'usucapião'], refs: [['CC', 'arts. 1.238 a 1.244', 'Da usucapião', 1238], ['CF/88', 'arts. 183 e 191', 'Usucapião urbana e rural', 183]] },

  // Consumidor
  { tema: 'Vício do produto/serviço', kw: ['vicio', 'defeito', 'garantia', 'produto', 'serviço'], refs: [['CDC', 'arts. 18 a 25', 'Da responsabilidade por vício', 18]] },
  { tema: 'Direito de arrependimento', kw: ['arrependimento', 'compra online', '7 dias'], refs: [['CDC', 'art. 49', 'Direito de arrependimento (7 dias)', 49]] },
  { tema: 'Práticas e cláusulas abusivas', kw: ['prática abusiva', 'cláusula abusiva', 'abusivo'], refs: [['CDC', 'arts. 39 e 51', 'Práticas e cláusulas abusivas', 39]] },
  { tema: 'Negativação indevida', kw: ['negativação', 'spc', 'serasa', 'nome sujo', 'cadastro'], refs: [['CDC', 'art. 43', 'Bancos de dados e cadastros', 43], ['Súmula', 'Súmula 385 STJ', 'Não cabe dano moral se há inscrição anterior legítima', 0]] },

  // Penal
  { tema: 'Homicídio', kw: ['homicidio', 'matar'], refs: [['CP', 'art. 121', 'Homicídio', 121]] },
  { tema: 'Furto', kw: ['furto'], refs: [['CP', 'art. 155', 'Furto', 155]] },
  { tema: 'Roubo', kw: ['roubo'], refs: [['CP', 'art. 157', 'Roubo', 157]] },
  { tema: 'Estelionato', kw: ['estelionato', 'golpe', 'fraude'], refs: [['CP', 'art. 171', 'Estelionato', 171]] },
  { tema: 'Lesão corporal', kw: ['lesão corporal', 'agressão'], refs: [['CP', 'art. 129', 'Lesão corporal', 129]] },
  { tema: 'Crimes contra a honra', kw: ['calúnia', 'difamação', 'injúria', 'honra'], refs: [['CP', 'arts. 138 a 145', 'Calúnia, difamação e injúria', 138]] },
  { tema: 'Legítima defesa', kw: ['legítima defesa', 'excludente'], refs: [['CP', 'arts. 23 a 25', 'Exclusão de ilicitude', 23]] },
  { tema: 'Prescrição penal', kw: ['prescrição penal'], refs: [['CP', 'arts. 109 a 119', 'Da prescrição', 109]] },

  // Processo Civil
  { tema: 'Petição inicial', kw: ['petição inicial', 'requisitos da inicial'], refs: [['CPC', 'arts. 319 a 321', 'Requisitos da petição inicial', 319]] },
  { tema: 'Tutela de urgência (liminar)', kw: ['tutela', 'liminar', 'urgência', 'antecipada'], refs: [['CPC', 'arts. 300 a 311', 'Tutela provisória de urgência e evidência', 300]] },
  { tema: 'Recursos / Apelação', kw: ['recurso', 'apelação', 'agravo', 'embargos'], refs: [['CPC', 'arts. 994 a 1.044', 'Dos recursos', 994]] },
  { tema: 'Cumprimento de sentença', kw: ['cumprimento de sentença', 'execução de título judicial'], refs: [['CPC', 'arts. 513 a 538', 'Cumprimento de sentença', 513]] },
  { tema: 'Execução', kw: ['execução', 'título extrajudicial', 'penhora'], refs: [['CPC', 'arts. 771 a 925', 'Do processo de execução', 771]] },
  { tema: 'Honorários de sucumbência', kw: ['honorários', 'sucumbência'], refs: [['CPC', 'art. 85', 'Honorários advocatícios', 85]] },
  { tema: 'Justiça gratuita', kw: ['justiça gratuita', 'gratuidade', 'hipossuficiente'], refs: [['CPC', 'arts. 98 a 102', 'Da gratuidade da justiça', 98]] },
  { tema: 'Prazos processuais', kw: ['prazo', 'prazos'], refs: [['CPC', 'arts. 218 a 235', 'Dos prazos', 218]] },

  // Processo Penal
  { tema: 'Prisão em flagrante', kw: ['flagrante', 'prisão'], refs: [['CPP', 'arts. 301 a 310', 'Da prisão em flagrante', 301]] },
  { tema: 'Habeas corpus', kw: ['habeas corpus', 'hc'], refs: [['CPP', 'arts. 647 a 667', 'Do habeas corpus', 647], ['CF/88', 'art. 5º, LXVIII', 'Garantia constitucional do HC', 5]] },

  // Trabalho
  { tema: 'Rescisão e verbas', kw: ['rescisão', 'verbas rescisórias', 'demissão'], refs: [['CLT', 'arts. 477 a 486', 'Rescisão do contrato de trabalho', 477]] },
  { tema: 'Justa causa', kw: ['justa causa'], refs: [['CLT', 'art. 482', 'Justa causa do empregado', 482]] },
  { tema: 'Horas extras', kw: ['horas extras', 'jornada'], refs: [['CLT', 'arts. 58 a 61', 'Jornada e horas extras', 58]] },
  { tema: 'Férias', kw: ['férias'], refs: [['CLT', 'arts. 129 a 153', 'Das férias', 129]] },
  { tema: 'Aviso prévio', kw: ['aviso prévio'], refs: [['CLT', 'arts. 487 a 491', 'Do aviso prévio', 487]] },

  // Previdenciário
  { tema: 'Aposentadoria', kw: ['aposentadoria', 'aposentar'], refs: [['L8213', 'arts. 42 a 58', 'Aposentadorias (RGPS)', 42], ['CF/88', 'art. 201', 'Previdência social', 201]] },
  { tema: 'Auxílio por incapacidade', kw: ['auxilio doença', 'auxílio-doença', 'incapacidade'], refs: [['L8213', 'arts. 59 a 63', 'Auxílio por incapacidade temporária', 59]] },
  { tema: 'Pensão por morte', kw: ['pensão por morte'], refs: [['L8213', 'arts. 74 a 79', 'Pensão por morte', 74]] },

  // Constitucional / outros
  { tema: 'Direitos fundamentais', kw: ['direitos fundamentais', 'garantias'], refs: [['CF/88', 'art. 5º', 'Direitos e deveres individuais e coletivos', 5]] },
  { tema: 'Mandado de segurança', kw: ['mandado de segurança', 'direito líquido e certo'], refs: [['MS', 'Lei 12.016/09', 'Mandado de segurança', 1], ['CF/88', 'art. 5º, LXIX', 'Garantia constitucional', 5]] },
  { tema: 'Despejo / locação', kw: ['despejo', 'locação', 'aluguel', 'inquilino'], refs: [['Locação', 'Lei 8.245/91', 'Locação de imóveis urbanos e despejo', 1]] },
  { tema: 'Violência doméstica', kw: ['violência doméstica', 'maria da penha', 'medida protetiva'], refs: [['MariaPenha', 'Lei 11.340/06', 'Medidas protetivas de urgência', 1]] },
]

const googleSite = (t) => `https://www.google.com/search?q=${encodeURIComponent('site:planalto.gov.br ' + t)}`
const googleTerm = (t) => `https://www.google.com/search?q=${encodeURIComponent(t)}`

export default function ThesesPage() {
  const [q, setQ] = useState('')
  const termo = q.trim()
  const t = termo.toLowerCase()

  const temas = useMemo(() => {
    if (!t) return []
    return INDICE.filter(x => x.tema.toLowerCase().includes(t) || x.kw.some(k => k.includes(t) || t.includes(k)))
  }, [t])

  const codigos = useMemo(() => {
    if (!t) return VADE
    return VADE.filter(v => v.sigla.toLowerCase().includes(t) || v.nome.toLowerCase().includes(t) || v.kw.some(k => k.includes(t) || t.includes(k)))
  }, [t])

  const abrir = (url) => window.open(url, '_blank', 'noopener')
  const abrirRef = ([sigla, arts]) => {
    if (sigla === 'Súmula') return abrir(googleTerm(arts))
    const base = COD[sigla]
    if (!base) return abrir(googleSite(`${arts} ${sigla}`))
    abrir(base) // abre o código; a busca abaixo localiza o artigo exato
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><IconBookOpen size={20} /> Vade Mecum — Legislação</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Busque um <b>assunto</b> (ex.: divórcio, dano moral, furto, horas extras) e veja em <b>quais artigos e códigos</b> está — com link para o texto oficial do Planalto.</p>
      </div>

      <div className="relative">
        <IconSearch size={16} className="absolute left-3 top-3 text-[var(--text-muted)]" />
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder='Ex.: "divórcio", "dano moral", "usucapião", "aposentadoria", "furto"…'
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
      </div>

      {/* Resultados temáticos (o "índice remissivo") */}
      {termo && temas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Onde está sobre “{termo}”</p>
          {temas.map(tm => (
            <div key={tm.tema} className="rounded-xl border border-brand-500/25 bg-brand-500/5 p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">{tm.tema}</p>
              <div className="space-y-1.5">
                {tm.refs.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-accent-400 flex-shrink-0">{r[0]}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{r[1]}</span>
                    <span className="text-xs text-[var(--text-muted)]">— {r[2]}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => abrirRef(r)} className="text-[11px] text-accent-400 hover:underline flex items-center gap-1">📖 Abrir</button>
                      <button onClick={() => abrir(googleSite(`${r[1]} ${r[0] === 'Súmula' ? '' : (VADE.find(v => v.sigla === r[0])?.nome ?? r[0])}`))} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">🔎 Localizar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fallback: sempre oferece a busca oficial */}
      {termo && (
        <button onClick={() => abrir(googleSite(termo))}
          className="w-full text-left text-sm px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-500/40 flex items-center gap-2">
          <IconSearch size={14} /> {temas.length ? 'Não achou? ' : ''}Buscar <b>“{termo}”</b> em toda a legislação do Planalto
          <IconExternalLink size={13} className="ml-auto" />
        </button>
      )}

      {/* Lista de códigos/leis para navegar */}
      {codigos.length > 0 && CATS.map(cat => {
        const itens = codigos.filter(v => v.cat === cat)
        if (!itens.length) return null
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">{cat}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {itens.map(v => (
                <div key={v.sigla} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0"><IconBookOpen size={16} className="text-accent-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{v.sigla}</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-snug">{v.nome}</p>
                    <button onClick={() => abrir(v.url)} className="text-[11px] text-accent-400 hover:underline mt-1.5">📖 Abrir texto oficial</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <p className="text-center text-[11px] text-[var(--text-muted)]">Índice remissivo curado + fonte oficial planalto.gov.br. Peça para ampliar os temas quando quiser.</p>
    </div>
  )
}
