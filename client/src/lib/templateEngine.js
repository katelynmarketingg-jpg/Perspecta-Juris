// ─────────────────────────────────────────────────────────────────
// Template Engine — substitui variáveis {{campo}} nos modelos de
// documentos com dados reais de clientes e processos.
// ─────────────────────────────────────────────────────────────────

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v)  => localStorage.setItem(k, JSON.stringify(v))
const uid   = () => Math.random().toString(36).slice(2,9) + Math.random().toString(36).slice(2,9)

// ── Formatadores ──────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

function fmtDateExtenso(iso) {
  const d = iso ? new Date(iso) : new Date()
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

function fmtCurrency(v) {
  if (!v) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtCpfCnpj(v) {
  if (!v) return ''
  const d = v.replace(/\D/g,'')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}

// ── Resolve variáveis a partir dos dados ──────────────────────────
export function buildVars(client, process, user, tenant) {
  const c = client ?? {}
  const p = process ?? {}
  const u = user ?? {}
  const t = tenant ?? {}

  // Compatível com o cadastro atual (addressStreet/addressCity/...) e nomes antigos
  const rua      = c.addressStreet ?? c.address ?? ''
  const numero   = c.addressNumber ?? ''
  const compl    = c.addressComplement ?? ''
  const bairro   = c.addressDistrict ?? c.neighborhood ?? ''
  const cidade   = c.addressCity ?? c.city ?? ''
  const uf       = c.addressState ?? c.state ?? ''
  const cep      = c.addressZip ?? c.zipCode ?? ''
  const cidadeUf = [cidade, uf].filter(Boolean).join('/')
  const addr = [
    [rua, numero && `nº ${numero}`].filter(Boolean).join(', '),
    compl, bairro, cidadeUf, cep && `CEP ${cep}`,
  ].filter(Boolean).join(', ')

  const ESTADO_CIVIL = { solteiro:'solteiro(a)', casado:'casado(a)', divorciado:'divorciado(a)', viuvo:'viúvo(a)', uniao_estavel:'em união estável', separado:'separado(a)', single:'solteiro(a)', married:'casado(a)' }

  const storedOffice = lsGet('pj_office_settings', {})

  return {
    // Cliente
    'cliente.nome':         c.name ?? '',
    'cliente.cpf_cnpj':     fmtCpfCnpj(c.cpfCnpj ?? ''),
    'cliente.rg':           c.rg ?? '',
    'cliente.nacionalidade':c.nationality ?? 'brasileiro(a)',
    'cliente.estado_civil': ESTADO_CIVIL[c.maritalStatus] ?? c.maritalStatus ?? '',
    'cliente.profissao':    c.profession ?? '',
    'cliente.endereco':     addr,
    'cliente.cep':          cep,
    'cliente.cidade':       cidade,
    'cliente.uf':           uf,
    'cliente.email':        c.email ?? '',
    'cliente.telefone':     c.phone ?? '',

    // Processo
    'processo.numero':      p.judicialNumber ?? '',
    'processo.numero_interno': p.internalNumber ?? '',
    'processo.titulo':      p.title ?? '',
    'processo.area':        p.area ?? '',
    'processo.tipo':        p.processType ?? '',
    'processo.tribunal':    p.court ?? '',
    'processo.vara':        p.courtDistrict ?? '',
    'processo.cidade':      p.courtCity ?? '',
    'processo.uf':          p.courtState ?? '',
    'processo.juiz':        p.judgeName ?? '',
    'processo.parte_contraria': p.opposingParty ?? '',
    'processo.advogado_contrario': p.opposingLawyer ?? '',
    'processo.honorarios':  fmtCurrency(p.feeAmount) ?? '',
    'processo.percentual_exito': p.feePercentage ? `${p.feePercentage}%` : '',

    // Advogado / usuário atual
    'advogado.nome':        u.name ?? storedOffice.lawyerName ?? '',
    'advogado.oab':         u.oabNumber ?? storedOffice.oab ?? '',
    'advogado.oab_uf':      u.oabState ?? storedOffice.oabUF ?? '',
    'advogado.email':       u.email ?? '',

    // Escritório
    'escritorio.nome':      t.name ?? storedOffice.name ?? '',
    'escritorio.cnpj':      fmtCpfCnpj(t.cnpj ?? storedOffice.cnpj ?? ''),
    'escritorio.endereco':  storedOffice.address ?? '',
    'escritorio.cidade':    storedOffice.city ?? '',
    'escritorio.uf':        storedOffice.state ?? '',
    'escritorio.telefone':  storedOffice.phone ?? '',
    'escritorio.email':     storedOffice.email ?? '',

    // Datas
    'data.hoje':            fmtDate(new Date().toISOString()),
    'data.extenso':         fmtDateExtenso(),
    'data.ano':             String(new Date().getFullYear()),
    'data.processo_inicio': fmtDate(p.startedAt),
  }
}

// ── Campos amigáveis (nome humano → chave técnica) ────────────────
// Usados no editor como {nome do cliente}, {oab}, {data por extenso}...
export const FRIENDLY_FIELDS = [
  { group: 'Cliente', items: [
    ['nome do cliente', 'cliente.nome'], ['cpf/cnpj do cliente', 'cliente.cpf_cnpj'],
    ['rg do cliente', 'cliente.rg'], ['nacionalidade', 'cliente.nacionalidade'],
    ['estado civil', 'cliente.estado_civil'], ['profissão', 'cliente.profissao'],
    ['endereço do cliente', 'cliente.endereco'], ['cidade do cliente', 'cliente.cidade'],
    ['e-mail do cliente', 'cliente.email'], ['telefone do cliente', 'cliente.telefone'],
  ]},
  { group: 'Processo', items: [
    ['número do processo', 'processo.numero'], ['título do processo', 'processo.titulo'],
    ['tribunal', 'processo.tribunal'], ['vara', 'processo.vara'],
    ['parte contrária', 'processo.parte_contraria'], ['honorários', 'processo.honorarios'],
  ]},
  { group: 'Advogado', items: [
    ['nome do advogado', 'advogado.nome'], ['oab', 'advogado.oab'], ['uf da oab', 'advogado.oab_uf'],
  ]},
  { group: 'Escritório', items: [
    ['nome do escritório', 'escritorio.nome'], ['cidade do escritório', 'escritorio.cidade'],
  ]},
  { group: 'Datas', items: [
    ['data de hoje', 'data.hoje'], ['data por extenso', 'data.extenso'], ['ano', 'data.ano'],
  ]},
]

const FRIENDLY_MAP = Object.fromEntries(
  FRIENDLY_FIELDS.flatMap(g => g.items.map(([label, key]) => [label.toLowerCase(), key])),
)

// ── Substitui variáveis no texto/HTML ─────────────────────────────
export function renderTemplate(body, vars) {
  let out = String(body ?? '')
  // 1) técnico: {{cliente.nome}}
  out = out.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    const v = vars[key.trim()]
    return v !== undefined ? v : `{{${key}}}`
  })
  // 2) amigável: {nome do cliente}
  out = out.replace(/\{([^{}]+)\}/g, (m, phrase) => {
    const key = FRIENDLY_MAP[phrase.trim().toLowerCase()]
    if (!key) return m
    const v = vars[key]
    return (v !== undefined && v !== '') ? v : m
  })
  return out
}

// ── CRUD de modelos ────────────────────────────────────────────────
const KEY = 'pj_doc_templates'

export function getTemplates() {
  const stored = lsGet(KEY, null)
  if (stored && stored.length > 0) return stored
  // Seed modelos padrão
  const defaults = getDefaultTemplates()
  lsSet(KEY, defaults)
  return defaults
}

export function saveTemplate(tpl) {
  const list = getTemplates()
  const existing = list.findIndex(t => t.id === tpl.id)
  if (existing >= 0) {
    list[existing] = { ...tpl, updatedAt: new Date().toISOString() }
  } else {
    list.push({ ...tpl, id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
  lsSet(KEY, list)
  return list
}

export function deleteTemplate(id) {
  const list = getTemplates().filter(t => t.id !== id)
  lsSet(KEY, list)
  return list
}

// ── Modelos padrão ────────────────────────────────────────────────
function getDefaultTemplates() {
  const id = uid
  return [
    {
      id: 'tpl_procuracao',
      name: 'Procuração Ad Judicia',
      category: 'procuracao',
      description: 'Procuração geral para representação judicial em todas as instâncias',
      body: `PROCURAÇÃO AD JUDICIA ET EXTRA

OUTORGANTE: {{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, portador(a) do CPF nº {{cliente.cpf_cnpj}}, RG nº {{cliente.rg}}, residente e domiciliado(a) na {{cliente.endereco}}.

OUTORGADO(A): {{advogado.nome}}, inscrito(a) na Ordem dos Advogados do Brasil, Seccional {{advogado.oab_uf}}, sob o nº {{advogado.oab}}.

PODERES: Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) OUTORGADO(A) acima qualificado(a), para representá-lo(a) em juízo ou fora dele, podendo propor ações, contestar, recorrer, acordar, desistir, transigir, receber e dar quitação, substabelecer com ou sem reserva de iguais poderes, praticar todos os atos necessários ao fiel cumprimento deste mandato, inclusive aqueles que exijam poderes especiais.

{{escritorio.cidade}}, {{data.extenso}}.


_________________________________________________
{{cliente.nome}}
CPF: {{cliente.cpf_cnpj}}`,
      variables: ['cliente.nome','cliente.nacionalidade','cliente.estado_civil','cliente.profissao','cliente.cpf_cnpj','cliente.rg','cliente.endereco','advogado.nome','advogado.oab','advogado.oab_uf','escritorio.cidade','data.extenso'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl_contrato_fixo',
      name: 'Contrato de Honorários (Fixo)',
      category: 'contrato',
      description: 'Contrato de prestação de serviços advocatícios com honorários fixos',
      body: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

Pelo presente instrumento particular, as partes abaixo qualificadas têm entre si justo e contratado o seguinte:

CONTRATANTE: {{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, portador(a) do CPF nº {{cliente.cpf_cnpj}}, residente na {{cliente.endereco}}.

CONTRATADO(A): {{advogado.nome}}, advogado(a) inscrito(a) na OAB/{{advogado.oab_uf}} sob o nº {{advogado.oab}}, com escritório profissional em {{escritorio.cidade}}/{{escritorio.uf}}.

CLÁUSULA 1ª — DO OBJETO
O(A) CONTRATADO(A) prestará ao(à) CONTRATANTE serviços de advocacia referentes a: {{processo.titulo}}, nº {{processo.numero}}, perante {{processo.tribunal}} — {{processo.vara}}.

CLÁUSULA 2ª — DOS HONORÁRIOS
Pelos serviços prestados, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) honorários advocatícios no valor de {{processo.honorarios}}.

CLÁUSULA 3ª — DO PRAZO
O presente contrato vigorará enquanto durar a demanda objeto desta contratação.

CLÁUSULA 4ª — DA RESCISÃO
Qualquer das partes poderá rescindir o presente contrato, mediante notificação prévia de 15 (quinze) dias.

CLÁUSULA 5ª — DO FORO
As partes elegem o foro da comarca de {{escritorio.cidade}} para dirimir quaisquer controvérsias oriundas do presente contrato.

{{escritorio.cidade}}, {{data.extenso}}.


_________________________________________________          _________________________________________________
{{cliente.nome}}                                                {{advogado.nome}}
CPF: {{cliente.cpf_cnpj}}                                   OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
      variables: ['cliente.nome','cliente.cpf_cnpj','cliente.nacionalidade','cliente.estado_civil','cliente.endereco','advogado.nome','advogado.oab','advogado.oab_uf','processo.titulo','processo.numero','processo.tribunal','processo.vara','processo.honorarios','escritorio.cidade','escritorio.uf','data.extenso'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl_contrato_exito',
      name: 'Contrato de Honorários (Êxito)',
      category: 'contrato',
      description: 'Contrato de prestação de serviços advocatícios com honorários de êxito',
      body: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS
(Honorários de Êxito)

CONTRATANTE: {{cliente.nome}}, portador(a) do CPF nº {{cliente.cpf_cnpj}}, residente na {{cliente.endereco}}.

CONTRATADO(A): {{advogado.nome}}, OAB/{{advogado.oab_uf}} nº {{advogado.oab}}.

CLÁUSULA 1ª — DO OBJETO
O(A) CONTRATADO(A) prestará serviços advocatícios na causa: {{processo.titulo}}, perante {{processo.tribunal}}.

CLÁUSULA 2ª — DOS HONORÁRIOS DE ÊXITO
Fica ajustado que os honorários advocatícios serão de {{processo.percentual_exito}} sobre o valor obtido ao final da demanda, a título de êxito, sem qualquer adiantamento. Em caso de derrota, nenhum valor será cobrado.

CLÁUSULA 3ª — DAS DESPESAS PROCESSUAIS
As custas processuais, honorários periciais e demais despesas correrão por conta do(a) CONTRATANTE, salvo se arcadas pelo(a) adversário(a) por força de decisão judicial.

{{escritorio.cidade}}, {{data.extenso}}.


_________________________________________________          _________________________________________________
{{cliente.nome}}                                                {{advogado.nome}}
CPF: {{cliente.cpf_cnpj}}                                   OAB/{{advogado.oab_uf}} nº {{advogado.oab}}`,
      variables: ['cliente.nome','cliente.cpf_cnpj','cliente.endereco','advogado.nome','advogado.oab','advogado.oab_uf','processo.titulo','processo.tribunal','processo.percentual_exito','escritorio.cidade','data.extenso'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl_declaracao_hipossuficiencia',
      name: 'Declaração de Hipossuficiência',
      category: 'declaracao',
      description: 'Declaração de hipossuficiência econômica para concessão de justiça gratuita',
      body: `DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA

Eu, {{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, portador(a) do CPF nº {{cliente.cpf_cnpj}}, RG nº {{cliente.rg}}, residente e domiciliado(a) na {{cliente.endereco}}, DECLARO, sob as penas da lei, que não possuo condições financeiras de arcar com as custas do processo e os honorários advocatícios sem prejuízo do próprio sustento e de minha família, razão pela qual requer a concessão dos benefícios da JUSTIÇA GRATUITA, nos termos do art. 98 do CPC.

{{escritorio.cidade}}, {{data.extenso}}.


_________________________________________________
{{cliente.nome}}
CPF: {{cliente.cpf_cnpj}}`,
      variables: ['cliente.nome','cliente.nacionalidade','cliente.estado_civil','cliente.cpf_cnpj','cliente.rg','cliente.endereco','escritorio.cidade','data.extenso'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl_notificacao',
      name: 'Notificação Extrajudicial',
      category: 'notificacao',
      description: 'Notificação extrajudicial para cumprimento de obrigação',
      body: `NOTIFICAÇÃO EXTRAJUDICIAL

{{cliente.cidade}}/{{cliente.uf}}, {{data.extenso}}.

{{processo.parte_contraria}}

PREZADO(A) SENHOR(A),

Vimos, por meio desta notificação extrajudicial, em nome de nosso(a) cliente {{cliente.nome}}, portador(a) do CPF nº {{cliente.cpf_cnpj}}, NOTIFICÁ-LO(A) acerca do seguinte:

{{processo.titulo}}

Diante do exposto, solicitamos que V.Sa. adote as providências cabíveis no prazo de 10 (dez) dias contados do recebimento desta notificação, sob pena de adotarmos as medidas judiciais cabíveis para resguardar os direitos de nosso(a) cliente.

Atenciosamente,

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}
{{escritorio.nome}}
{{escritorio.telefone}} | {{escritorio.email}}`,
      variables: ['cliente.nome','cliente.cpf_cnpj','cliente.cidade','cliente.uf','processo.parte_contraria','processo.titulo','advogado.nome','advogado.oab','advogado.oab_uf','escritorio.nome','escritorio.telefone','escritorio.email','data.extenso'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl_acordo',
      name: 'Termo de Acordo / Distrato',
      category: 'acordo',
      description: 'Termo de acordo extrajudicial entre as partes',
      body: `TERMO DE ACORDO EXTRAJUDICIAL

As partes abaixo identificadas, de comum acordo e por livre e espontânea vontade, celebram o presente TERMO DE ACORDO:

PARTE 1: {{cliente.nome}}, portador(a) do CPF nº {{cliente.cpf_cnpj}}, residente na {{cliente.endereco}}.

PARTE 2: {{processo.parte_contraria}}.

CONSIDERANDO que as partes desejam resolver amigavelmente a controvérsia referente a {{processo.titulo}};

As partes acordam o seguinte:

1. [Descreva aqui as condições do acordo]

2. Com o cumprimento integral deste acordo, as partes declaram extintas quaisquer obrigações e créditos decorrentes da relação que lhe deu origem, outorgando entre si plena, geral e irrevogável quitação.

3. Em caso de descumprimento deste acordo, a parte inadimplente ficará sujeita a multa de 10% (dez por cento) sobre o valor total acordado, sem prejuízo das demais cominações legais.

{{escritorio.cidade}}, {{data.extenso}}.


_________________________________________________          _________________________________________________
{{cliente.nome}}                                                {{processo.parte_contraria}}
CPF: {{cliente.cpf_cnpj}}


Testemunhas:

_________________________________________________          _________________________________________________
Nome:                                                           Nome:
CPF:                                                            CPF:`,
      variables: ['cliente.nome','cliente.cpf_cnpj','cliente.endereco','processo.parte_contraria','processo.titulo','escritorio.cidade','data.extenso'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tpl_carta_apresentacao',
      name: 'Carta de Apresentação',
      category: 'carta',
      description: 'Carta de apresentação do advogado ao cliente',
      body: `{{escritorio.cidade}}, {{data.extenso}}.

{{cliente.nome}}
{{cliente.endereco}}

Prezado(a) {{cliente.nome}},

É com grande satisfação que nos apresentamos. Nosso escritório, {{escritorio.nome}}, está à sua disposição para prestar serviços jurídicos de excelência nas áreas de {{processo.area}}.

Informamos que assumimos a condução do processo {{processo.titulo}} — nº {{processo.numero}}, perante {{processo.tribunal}}, e comprometemo-nos a mantê-lo(a) informado(a) sobre todos os andamentos processuais relevantes.

Qualquer dúvida ou informação adicional, estamos à sua disposição pelos contatos abaixo.

Atenciosamente,

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}
{{escritorio.nome}}
Tel.: {{escritorio.telefone}}
E-mail: {{escritorio.email}}`,
      variables: ['cliente.nome','cliente.endereco','processo.titulo','processo.numero','processo.tribunal','processo.area','advogado.nome','advogado.oab','advogado.oab_uf','escritorio.nome','escritorio.cidade','escritorio.telefone','escritorio.email','data.extenso'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
}

export const TEMPLATE_CATEGORIES = [
  { value: 'procuracao',   label: 'Procuração' },
  { value: 'contrato',     label: 'Contrato' },
  { value: 'declaracao',   label: 'Declaração' },
  { value: 'notificacao',  label: 'Notificação' },
  { value: 'acordo',       label: 'Acordo' },
  { value: 'carta',        label: 'Carta' },
  { value: 'peticao',      label: 'Petição' },
  { value: 'recurso',      label: 'Recurso' },
  { value: 'outro',        label: 'Outro' },
]

export const ALL_VARIABLES = [
  { group: 'Cliente', vars: [
    { key: 'cliente.nome', label: 'Nome do cliente' },
    { key: 'cliente.cpf_cnpj', label: 'CPF/CNPJ' },
    { key: 'cliente.rg', label: 'RG' },
    { key: 'cliente.nacionalidade', label: 'Nacionalidade' },
    { key: 'cliente.estado_civil', label: 'Estado civil' },
    { key: 'cliente.profissao', label: 'Profissão' },
    { key: 'cliente.endereco', label: 'Endereço completo' },
    { key: 'cliente.cidade', label: 'Cidade' },
    { key: 'cliente.uf', label: 'Estado (UF)' },
    { key: 'cliente.email', label: 'E-mail' },
    { key: 'cliente.telefone', label: 'Telefone' },
  ]},
  { group: 'Processo', vars: [
    { key: 'processo.numero', label: 'Número CNJ' },
    { key: 'processo.titulo', label: 'Título do processo' },
    { key: 'processo.area', label: 'Área jurídica' },
    { key: 'processo.tribunal', label: 'Tribunal' },
    { key: 'processo.vara', label: 'Vara/Câmara' },
    { key: 'processo.juiz', label: 'Juiz(a)' },
    { key: 'processo.parte_contraria', label: 'Parte contrária' },
    { key: 'processo.honorarios', label: 'Honorários (R$)' },
    { key: 'processo.percentual_exito', label: 'Percentual de êxito' },
  ]},
  { group: 'Advogado', vars: [
    { key: 'advogado.nome', label: 'Nome do advogado' },
    { key: 'advogado.oab', label: 'Número OAB' },
    { key: 'advogado.oab_uf', label: 'Estado OAB' },
    { key: 'advogado.email', label: 'E-mail do advogado' },
  ]},
  { group: 'Escritório', vars: [
    { key: 'escritorio.nome', label: 'Nome do escritório' },
    { key: 'escritorio.cnpj', label: 'CNPJ' },
    { key: 'escritorio.endereco', label: 'Endereço' },
    { key: 'escritorio.cidade', label: 'Cidade' },
    { key: 'escritorio.telefone', label: 'Telefone' },
    { key: 'escritorio.email', label: 'E-mail' },
  ]},
  { group: 'Datas', vars: [
    { key: 'data.hoje', label: 'Data de hoje (dd/mm/aaaa)' },
    { key: 'data.extenso', label: 'Data por extenso' },
    { key: 'data.ano', label: 'Ano atual' },
    { key: 'data.processo_inicio', label: 'Data de início do processo' },
  ]},
]
