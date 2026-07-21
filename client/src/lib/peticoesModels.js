// ─────────────────────────────────────────────────────────────────────────
//  Banco de Modelos de Petições — Perspecta Juris
//  Modelos com variáveis {{cliente.nome}}, {{advogado.oab}}, etc.
//  (mesmo motor de templateEngine.js). Placeholders [ASSIM] são preenchidos
//  manualmente pelo advogado.
// ─────────────────────────────────────────────────────────────────────────

import { tkey } from './tenant'
import { pushTemplates } from './tenantData'
// Modelos personalizados são escopados por escritório (tenant) — um escritório
// nunca enxerga os modelos de outro, mesmo no mesmo navegador.
const KEY = () => tkey('pj_peticoes')
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const uid = () => 'pet_' + Math.random().toString(36).slice(2, 10)

export const PETICAO_CATEGORIAS = [
  { value: 'inicial',      label: 'Petição Inicial' },
  { value: 'contestacao',  label: 'Contestação' },
  { value: 'recurso',      label: 'Recurso' },
  { value: 'incidental',   label: 'Petição Incidental' },
  { value: 'execucao',     label: 'Execução / Cumprimento' },
  { value: 'outro',        label: 'Outro' },
]

export const PETICAO_AREAS = [
  { value: 'civel',          label: 'Cível' },
  { value: 'trabalhista',    label: 'Trabalhista' },
  { value: 'familia',        label: 'Família' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'consumidor',     label: 'Consumidor' },
  { value: 'criminal',       label: 'Criminal' },
  { value: 'tributario',     label: 'Tributário' },
  { value: 'geral',          label: 'Geral' },
]

// ── Modelos pré-carregados ──────────────────────────────────────────────────
export const PETICOES_PADRAO = [
  {
    id: 'pet-inicial-cobranca', titulo: 'Petição Inicial — Ação de Cobrança', categoria: 'inicial', area: 'civel',
    tags: ['cobrança', 'cível', 'inicial'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

{{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, inscrito(a) no CPF/CNPJ sob o nº {{cliente.cpf_cnpj}}, residente e domiciliado(a) em {{cliente.endereco}}, por seu advogado que esta subscreve (procuração anexa), vem, respeitosamente, à presença de Vossa Excelência, propor a presente

AÇÃO DE COBRANÇA

em face de [NOME DA PARTE CONTRÁRIA], [qualificação], pelos fatos e fundamentos a seguir expostos.

I – DOS FATOS
[DESCREVER OS FATOS QUE ORIGINARAM A DÍVIDA]

II – DO DIREITO
O(A) Requerido(a) encontra-se em mora quanto ao pagamento da quantia devida, sendo aplicável o disposto nos arts. 389 e 394 do Código Civil, bem como a correção monetária e os juros de mora desde o vencimento.

III – DOS PEDIDOS
Ante o exposto, requer:
a) a citação do(a) Requerido(a) para, querendo, contestar a presente ação;
b) a condenação ao pagamento da quantia de R$ [VALOR], acrescida de correção monetária e juros de mora;
c) a condenação em custas processuais e honorários advocatícios;
d) a produção de todas as provas em direito admitidas.

Dá-se à causa o valor de R$ [VALOR DA CAUSA].

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-inicial-danos-morais', titulo: 'Petição Inicial — Indenização por Danos Morais', categoria: 'inicial', area: 'consumidor',
    tags: ['danos morais', 'indenização', 'consumidor'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

{{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, CPF nº {{cliente.cpf_cnpj}}, residente em {{cliente.endereco}}, por seu advogado (procuração anexa), vem propor

AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS

em face de [NOME DA PARTE CONTRÁRIA], pelas razões a seguir.

I – DOS FATOS
[DESCREVER A CONDUTA ILÍCITA E O DANO SOFRIDO]

II – DO DIREITO
A conduta do(a) Requerido(a) violou direitos da personalidade do(a) Autor(a), configurando dano moral indenizável (arts. 186 e 927 do Código Civil; art. 5º, V e X, da CF). Tratando-se de relação de consumo, aplica-se o Código de Defesa do Consumidor, com responsabilidade objetiva do fornecedor (art. 14 do CDC).

III – DOS PEDIDOS
a) a citação do(a) Requerido(a);
b) a condenação ao pagamento de indenização por danos morais em valor não inferior a R$ [VALOR];
c) a condenação em custas e honorários advocatícios;
d) a inversão do ônus da prova (art. 6º, VIII, CDC).

Dá-se à causa o valor de R$ [VALOR DA CAUSA].

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-contestacao', titulo: 'Contestação (modelo geral)', categoria: 'contestacao', area: 'civel',
    tags: ['contestação', 'defesa'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

Processo nº {{processo.numero}}

{{cliente.nome}}, já qualificado(a) nos autos da ação em epígrafe que lhe move [PARTE AUTORA], por seu advogado (procuração anexa), vem apresentar

CONTESTAÇÃO

pelos fundamentos a seguir.

I – DAS PRELIMINARES
[ARGUIR EVENTUAIS PRELIMINARES: ilegitimidade, inépcia da inicial, prescrição, etc.]

II – DO MÉRITO
[IMPUGNAR ESPECIFICAMENTE OS FATOS ALEGADOS NA INICIAL]

III – DOS PEDIDOS
Ante o exposto, requer:
a) o acolhimento das preliminares, com a extinção do feito;
b) no mérito, a total improcedência dos pedidos;
c) a condenação da parte autora em custas e honorários advocatícios;
d) a produção de todas as provas admitidas.

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-apelacao', titulo: 'Recurso de Apelação', categoria: 'recurso', area: 'civel',
    tags: ['apelação', 'recurso'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

Processo nº {{processo.numero}}

{{cliente.nome}}, já qualificado(a) nos autos, inconformado(a) com a r. sentença de fls. ___, vem, tempestivamente, interpor

RECURSO DE APELAÇÃO

com fundamento no art. 1.009 do CPC, requerendo o recebimento e a remessa das inclusas razões ao Egrégio Tribunal de Justiça.

Requer o recebimento do recurso em ambos os efeitos e a intimação da parte contrária para contrarrazões.

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}

_______________________________________________

RAZÕES DE APELAÇÃO

Egrégio Tribunal,
Colenda Câmara,

I – SÍNTESE DA DEMANDA
[RESUMIR O PROCESSO]

II – DAS RAZÕES DE REFORMA
[FUNDAMENTAR OS MOTIVOS PELOS QUAIS A SENTENÇA DEVE SER REFORMADA]

III – DO PEDIDO
Requer o conhecimento e provimento do recurso para reformar integralmente a r. sentença.

{{advogado.nome}} — OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-trabalhista', titulo: 'Reclamação Trabalhista', categoria: 'inicial', area: 'trabalhista',
    tags: ['trabalhista', 'reclamação', 'verbas'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) JUIZ(A) DO TRABALHO DA ___ VARA DO TRABALHO DE {{cliente.cidade}}/{{cliente.uf}}

{{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, CPF nº {{cliente.cpf_cnpj}}, residente em {{cliente.endereco}}, por seu advogado (procuração anexa), vem propor

RECLAMAÇÃO TRABALHISTA

em face de [NOME DA RECLAMADA], CNPJ [___], pelas razões a seguir.

I – DO CONTRATO DE TRABALHO
Admissão: [DATA] | Função: [FUNÇÃO] | Último salário: R$ [VALOR] | Saída: [DATA/MOTIVO]

II – DOS FATOS E DIREITOS
[DESCREVER AS VERBAS NÃO PAGAS: saldo de salário, aviso-prévio, férias + 1/3, 13º, FGTS + 40%, horas extras, etc.]

III – DOS PEDIDOS
Requer a condenação da Reclamada ao pagamento de:
a) verbas rescisórias;
b) horas extras e reflexos;
c) multa dos arts. 467 e 477 da CLT;
d) FGTS e multa de 40%;
e) honorários de sucumbência.

Dá-se à causa o valor de R$ [VALOR DA CAUSA].

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-alimentos', titulo: 'Ação de Alimentos', categoria: 'inicial', area: 'familia',
    tags: ['alimentos', 'família', 'pensão'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA DE FAMÍLIA DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

{{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, CPF nº {{cliente.cpf_cnpj}}, residente em {{cliente.endereco}}, [representando o(a) menor ___], por seu advogado (procuração anexa), vem propor

AÇÃO DE ALIMENTOS

em face de [NOME DO ALIMENTANTE], com fundamento na Lei nº 5.478/68 e nos arts. 1.694 e ss. do Código Civil.

I – DOS FATOS
[DESCREVER O VÍNCULO E A NECESSIDADE DOS ALIMENTOS]

II – DO DIREITO E DO BINÔMIO NECESSIDADE-POSSIBILIDADE
Os alimentos são devidos na proporção das necessidades do(a) alimentando(a) e dos recursos do(a) alimentante (art. 1.694, §1º, CC).

III – DOS PEDIDOS
a) a fixação de alimentos provisórios em [PERCENTUAL/VALOR];
b) a citação do(a) Requerido(a);
c) a fixação definitiva dos alimentos ao final;
d) os benefícios da gratuidade da justiça.

Dá-se à causa o valor de R$ [VALOR DA CAUSA] (12 prestações).

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-previdenciario', titulo: 'Ação Previdenciária — Concessão de Benefício', categoria: 'inicial', area: 'previdenciario',
    tags: ['INSS', 'aposentadoria', 'benefício'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) FEDERAL DA ___ VARA DA SEÇÃO JUDICIÁRIA DE {{cliente.uf}}
(ou Juizado Especial Federal)

{{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, CPF nº {{cliente.cpf_cnpj}}, residente em {{cliente.endereco}}, por seu advogado (procuração anexa), vem propor

AÇÃO DE CONCESSÃO DE BENEFÍCIO PREVIDENCIÁRIO

em face do INSTITUTO NACIONAL DO SEGURO SOCIAL – INSS.

I – DOS FATOS
[DESCREVER O REQUERIMENTO ADMINISTRATIVO E O INDEFERIMENTO / DER]

II – DO DIREITO
O(A) Autor(a) preenche os requisitos legais para a concessão do benefício, conforme a Lei nº 8.213/91 e a EC 103/2019, demonstrando tempo de contribuição e carência.

III – DOS PEDIDOS
a) a concessão do benefício [ESPECIFICAR] desde a DER;
b) o pagamento das parcelas vencidas, corrigidas e com juros;
c) a antecipação de tutela, dada a natureza alimentar;
d) os benefícios da gratuidade da justiça.

Dá-se à causa o valor de R$ [VALOR DA CAUSA].

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-embargos-decl', titulo: 'Embargos de Declaração', categoria: 'recurso', area: 'geral',
    tags: ['embargos', 'omissão', 'contradição'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

Processo nº {{processo.numero}}

{{cliente.nome}}, já qualificado(a) nos autos, vem, tempestivamente, opor

EMBARGOS DE DECLARAÇÃO

com fundamento no art. 1.022 do CPC, em face da r. decisão de fls. ___, pelas razões a seguir.

I – DA [OMISSÃO / CONTRADIÇÃO / OBSCURIDADE / ERRO MATERIAL]
[APONTAR O VÍCIO ESPECÍFICO DA DECISÃO]

II – DO PEDIDO
Requer o acolhimento dos embargos para sanar o vício apontado, com efeitos [infringentes, se o caso].

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-juntada', titulo: 'Petição de Juntada de Documentos', categoria: 'incidental', area: 'geral',
    tags: ['juntada', 'documentos'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

Processo nº {{processo.numero}}

{{cliente.nome}}, já qualificado(a) nos autos, por seu advogado, vem respeitosamente à presença de Vossa Excelência requerer a JUNTADA dos documentos anexos, referentes a [DESCREVER OS DOCUMENTOS], para que produzam seus regulares efeitos.

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
  {
    id: 'pet-gratuidade', titulo: 'Pedido de Justiça Gratuita', categoria: 'incidental', area: 'geral',
    tags: ['gratuidade', 'hipossuficiência'], readonly: true,
    corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA DA COMARCA DE {{cliente.cidade}}/{{cliente.uf}}

Processo nº {{processo.numero}}

{{cliente.nome}}, já qualificado(a) nos autos, por seu advogado, vem requerer a concessão dos benefícios da JUSTIÇA GRATUITA, com fundamento no art. 98 do CPC e na Lei nº 1.060/50, por não dispor de condições de arcar com as custas processuais e honorários sem prejuízo do próprio sustento, conforme declaração de hipossuficiência anexa.

Termos em que,
Pede deferimento.

{{cliente.cidade}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
  },
]

// ── CRUD (defaults + modelos do usuário) ────────────────────────────────────
// Cada alteração grava no cache local E no banco (write-through), pra
// sincronizar entre computadores e manter isolado por escritório.
function persist(list) {
  lsSet(KEY(), list)
  pushTemplates(list)
}
export function getPeticoes() {
  const custom = lsGet(KEY(), [])
  return [...PETICOES_PADRAO, ...custom]
}
export function savePeticao(p) {
  const custom = lsGet(KEY(), [])
  if (p.id && custom.some(x => x.id === p.id)) {
    persist(custom.map(x => x.id === p.id ? { ...x, ...p } : x))
    return p
  }
  const novo = { ...p, id: p.id || uid(), readonly: false, createdAt: new Date().toISOString() }
  persist([...custom, novo])
  return novo
}
export function deletePeticao(id) {
  const custom = lsGet(KEY(), [])
  persist(custom.filter(x => x.id !== id))
}
