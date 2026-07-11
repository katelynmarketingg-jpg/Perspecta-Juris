export const LEGAL_AREAS = [
  { value: 'civel',         label: 'Cível' },
  { value: 'trabalhista',   label: 'Trabalhista' },
  { value: 'criminal',      label: 'Criminal' },
  { value: 'tributario',    label: 'Tributário' },
  { value: 'familia',       label: 'Família e Sucessões' },
  { value: 'previdenciario',label: 'Previdenciário' },
  { value: 'empresarial',   label: 'Empresarial' },
  { value: 'consumidor',    label: 'Direito do Consumidor' },
  { value: 'ambiental',     label: 'Ambiental' },
  { value: 'administrativo',label: 'Administrativo' },
  { value: 'imobiliario',   label: 'Imobiliário' },
  { value: 'outro',         label: 'Outro' },
]

export const PROCESS_TYPES = {
  civel:          ['Ação Ordinária', 'Ação de Indenização', 'Danos Morais', 'Cobrança', 'Execução', 'Revisional', 'Monitória', 'Cautelar', 'Mandado de Segurança'],
  trabalhista:    ['Reclamação Trabalhista', 'Inquérito Judicial', 'Ação Civil Pública', 'Execução Trabalhista'],
  criminal:       ['Defesa Criminal', 'Habeas Corpus', 'Revisão Criminal', 'Execução Penal'],
  tributario:     ['Execução Fiscal', 'Mandado de Segurança Tributário', 'Ação Declaratória', 'Embargos à Execução Fiscal'],
  familia:        ['Divórcio', 'Inventário', 'Guarda e Tutela', 'Alimentos', 'União Estável', 'Adoção', 'Interdição'],
  previdenciario: ['Aposentadoria', 'BPC/LOAS', 'Pensão por Morte', 'Auxílio-Doença', 'Auxílio-Acidente', 'Revisão de Benefício'],
  empresarial:    ['Recuperação Judicial', 'Falência', 'Dissolução', 'Contratual'],
  consumidor:     ['Ação de Responsabilidade', 'Recall', 'Vício do Produto', 'CDC'],
  imobiliario:    ['Usucapião', 'Ação Possessória', 'Despejo', 'Distrato'],
}

export const PROCESS_STATUS = [
  { value: 'active',    label: 'Ativo',       color: 'blue' },
  { value: 'won',       label: 'Ganho',       color: 'green' },
  { value: 'lost',      label: 'Perdido',     color: 'red' },
  { value: 'settled',   label: 'Acordo',      color: 'purple' },
  { value: 'archived',  label: 'Arquivado',   color: 'gray' },
]

export const CONTRACT_TYPES = [
  { value: 'fixed',      label: 'Honorário Fixo' },
  { value: 'success',    label: 'Êxito' },
  { value: 'mixed',      label: 'Fixo + Êxito' },
  { value: 'hourly',     label: 'Por Hora' },
  { value: 'monthly',    label: 'Mensalidade' },
]

export const USER_ROLES = [
  { value: 'admin',        label: 'Administrador' },
  { value: 'advogado',     label: 'Advogado' },
  { value: 'estagiario',   label: 'Estagiário' },
  { value: 'financeiro',   label: 'Financeiro' },
  { value: 'recepcionista',label: 'Recepcionista / Secretária' },
]

export const LEAD_SOURCES = [
  { value: 'indicacao',   label: 'Indicação' },
  { value: 'google',      label: 'Google Ads' },
  { value: 'instagram',   label: 'Instagram' },
  { value: 'facebook',    label: 'Facebook' },
  { value: 'site',        label: 'Site' },
  { value: 'whatsapp',    label: 'WhatsApp Orgânico' },
  { value: 'linkedin',    label: 'LinkedIn' },
  { value: 'outro',       label: 'Outro' },
]

export const MARITAL_STATUS = [
  { value: 'solteiro',    label: 'Solteiro(a)' },
  { value: 'casado',      label: 'Casado(a)' },
  { value: 'divorciado',  label: 'Divorciado(a)' },
  { value: 'viuvo',       label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União Estável' },
  { value: 'separado',    label: 'Separado(a)' },
]

export const STATES_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

export const PRIORITY_LABELS = {
  urgent: { label: 'Urgente', color: 'red' },
  high:   { label: 'Alta',    color: 'amber' },
  normal: { label: 'Normal',  color: 'blue' },
  low:    { label: 'Baixa',   color: 'gray' },
}

export const FINANCIAL_CATEGORIES = [
  { value: 'honorario',          label: 'Honorários',         type: 'receivable' },
  { value: 'exito',              label: 'Êxito',              type: 'receivable' },
  { value: 'custas_processuais', label: 'Custas Processuais', type: 'payable' },
  { value: 'pericia',            label: 'Perícia',            type: 'payable' },
  { value: 'diligencia',         label: 'Diligência',         type: 'payable' },
  { value: 'aluguel',            label: 'Aluguel',            type: 'payable' },
  { value: 'folha',              label: 'Folha de Pagamento', type: 'payable' },
  { value: 'pro_labore',         label: 'Pró-labore',         type: 'payable' },
  { value: 'software',           label: 'Software / TI',      type: 'payable' },
  { value: 'outras_despesas',    label: 'Outras Despesas',    type: 'payable' },
  { value: 'outras_receitas',    label: 'Outras Receitas',    type: 'receivable' },
]

export const PAYMENT_METHODS = [
  { value: 'pix',          label: 'Pix' },
  { value: 'boleto',       label: 'Boleto' },
  { value: 'cartao',       label: 'Cartão' },
  { value: 'transferencia',label: 'Transferência' },
  { value: 'dinheiro',     label: 'Dinheiro' },
]

export const MOVEMENT_TYPES = [
  { value: 'despacho',    label: 'Despacho' },
  { value: 'sentenca',    label: 'Sentença' },
  { value: 'acordao',     label: 'Acórdão' },
  { value: 'audiencia',   label: 'Audiência' },
  { value: 'citacao',     label: 'Citação' },
  { value: 'intimacao',   label: 'Intimação' },
  { value: 'recurso',     label: 'Recurso' },
  { value: 'peticao',     label: 'Petição' },
  { value: 'acordo',      label: 'Acordo' },
  { value: 'outro',       label: 'Outro' },
  // automáticos (sistema)
  { value: 'system',      label: 'Sistema' },
  { value: 'status',      label: 'Mudança de Status' },
  { value: 'deadline',    label: 'Prazo' },
  { value: 'task',        label: 'Tarefa' },
  { value: 'financial',   label: 'Financeiro' },
]
