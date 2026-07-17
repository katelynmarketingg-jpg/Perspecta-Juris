import { pgTable, text, real, integer, boolean, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core'

// ── Tenants ───────────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id:           text('id').primaryKey(),
  slug:         text('slug').notNull().unique(),
  name:         text('name').notNull(),
  plan:         text('plan').notNull().default('starter'),
  planExpiresAt:text('plan_expires_at'),
  isActive:     boolean('is_active').notNull().default(true),
  settings:     jsonb('settings').notNull().default({}),
  logoUrl:      text('logo_url'),
  primaryColor: text('primary_color').default('#6366f1'),
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
})

// ── Users ─────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           text('id').primaryKey(),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  loginName:    text('login_name').notNull(),          // nome usado no login (sem espaço, lowercase)
  email:        text('email'),                         // e-mail de contato (opcional)
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('advogado'), // advogado | admin | master | financeiro | estagiario
  oabNumber:    text('oab_number'),
  oabState:     text('oab_state'),
  avatarUrl:    text('avatar_url'),
  phone:        text('phone'),
  unitId:       text('unit_id'),
  isActive:     boolean('is_active').notNull().default(true),
  lastLoginAt:  text('last_login_at'),
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
}, t => ({
  loginUniq: uniqueIndex('users_login_tenant_uidx').on(t.tenantId, t.loginName),
  tenantIdx: index('users_tenant_idx').on(t.tenantId),
}))

export const refreshTokens = pgTable('refresh_tokens', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
})

// ── Units / Filiais ───────────────────────────────────────────
export const units = pgTable('units', {
  id:        text('id').primaryKey(),
  tenantId:  text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  city:      text('city'),
  state:     text('state'),
  phone:     text('phone'),
  address:   text('address'),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: text('created_at').notNull(),
})

// ── Clients ───────────────────────────────────────────────────
export const clients = pgTable('clients', {
  id:                    text('id').primaryKey(),
  tenantId:              text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type:                  text('type').notNull().default('person'),  // 'person' | 'company'
  name:                  text('name').notNull(),
  cpfCnpj:               text('cpf_cnpj'),
  rg:                    text('rg'),
  birthDate:             text('birth_date'),
  nationality:           text('nationality'),
  maritalStatus:         text('marital_status'),
  profession:            text('profession'),
  email:                 text('email'),
  phone:                 text('phone'),
  phoneSecondary:        text('phone_secondary'),
  addressStreet:         text('address_street'),
  addressNumber:         text('address_number'),
  addressComplement:     text('address_complement'),
  addressDistrict:       text('address_district'),
  addressCity:           text('address_city'),
  addressState:          text('address_state'),
  addressZip:            text('address_zip'),
  // PJ fields
  companyName:           text('company_name'),
  fantasyName:           text('fantasy_name'),
  stateRegistration:     text('state_registration'),
  municipalRegistration: text('municipal_registration'),
  representativeName:    text('representative_name'),
  representativeCpf:     text('representative_cpf'),
  representativePhone:   text('representative_phone'),
  // Banking
  bankName:              text('bank_name'),
  bankAgency:            text('bank_agency'),
  bankAccount:           text('bank_account'),
  bankPixKey:            text('bank_pix_key'),
  // CRM
  source:                text('source'),
  assignedTo:            text('assigned_to').references(() => users.id),
  tags:                  jsonb('tags').notNull().default([]),
  notes:                 text('notes'),
  // Portal access
  portalAccess:          boolean('portal_access').notNull().default(false),
  portalEmail:           text('portal_email'),
  portalPasswordHash:    text('portal_password_hash'),
  // LGPD
  lgpdConsentAt:         text('lgpd_consent_at'),
  lgpdConsentIp:         text('lgpd_consent_ip'),
  isActive:              boolean('is_active').notNull().default(true),
  createdAt:             text('created_at').notNull(),
  updatedAt:             text('updated_at').notNull(),
}, t => ({
  tenantIdx:  index('clients_tenant_idx').on(t.tenantId),
  cpfCnpjIdx: index('clients_cpf_cnpj_idx').on(t.tenantId, t.cpfCnpj),
}))

// ── Processes ─────────────────────────────────────────────────
export const processes = pgTable('processes', {
  id:               text('id').primaryKey(),
  tenantId:         text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  clientId:         text('client_id').notNull().references(() => clients.id),
  internalNumber:   text('internal_number'),          // ex: "15/2025"
  judicialNumber:   text('judicial_number'),           // CNJ: "0001234-12.2025.8.21.0001"
  title:            text('title').notNull(),
  area:             text('area').notNull(),
  subArea:          text('sub_area'),
  processType:      text('process_type'),
  status:           text('status').notNull().default('active'),
  phase:            text('phase'),
  court:            text('court'),
  courtDistrict:    text('court_district'),
  courtCity:        text('court_city'),
  courtState:       text('court_state'),
  judgeName:        text('judge_name'),
  opposingParty:    text('opposing_party'),
  opposingLawyer:   text('opposing_lawyer'),
  opposingOab:      text('opposing_oab'),
  assignedTo:       text('assigned_to').references(() => users.id),
  team:             jsonb('team').notNull().default([]),
  feeType:          text('fee_type'),
  feeAmount:        real('fee_amount'),
  feePercentage:    real('fee_percentage'),
  feeNotes:         text('fee_notes'),
  priority:         text('priority').notNull().default('normal'),
  summary:          text('summary'),
  startedAt:        text('started_at'),
  closedAt:         text('closed_at'),
  unitId:           text('unit_id').references(() => units.id),
  customFields:     jsonb('custom_fields').notNull().default({}),
  createdAt:        text('created_at').notNull(),
  updatedAt:        text('updated_at').notNull(),
}, t => ({
  tenantIdx:  index('processes_tenant_idx').on(t.tenantId),
  clientIdx:  index('processes_client_idx').on(t.tenantId, t.clientId),
  numberIdx:  index('processes_number_idx').on(t.tenantId, t.judicialNumber),
}))

// ── Process Movements ─────────────────────────────────────────
export const processMovements = pgTable('process_movements', {
  id:          text('id').primaryKey(),
  tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  processId:   text('process_id').notNull().references(() => processes.id, { onDelete: 'cascade' }),
  date:        text('date').notNull(),
  description: text('description').notNull(),
  type:        text('type'),
  author:      text('author'),
  isPublic:    boolean('is_public').notNull().default(false),
  createdBy:   text('created_by').references(() => users.id),
  createdAt:   text('created_at').notNull(),
}, t => ({
  processIdx: index('movements_process_idx').on(t.tenantId, t.processId),
}))

// ── Deadlines ─────────────────────────────────────────────────
export const deadlines = pgTable('deadlines', {
  id:          text('id').primaryKey(),
  tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  processId:   text('process_id').references(() => processes.id, { onDelete: 'cascade' }),
  clientId:    text('client_id').references(() => clients.id),
  title:       text('title').notNull(),
  description: text('description'),
  type:        text('type').notNull().default('prazo'),
  dueDate:     text('due_date').notNull(),
  dueTime:     text('due_time'),
  alertDays:   integer('alert_days').notNull().default(3),
  assignedTo:  text('assigned_to').references(() => users.id),
  status:      text('status').notNull().default('pending'),
  completedAt: text('completed_at'),
  completedBy: text('completed_by').references(() => users.id),
  notes:       text('notes'),
  createdAt:   text('created_at').notNull(),
  updatedAt:   text('updated_at').notNull(),
}, t => ({
  tenantIdx:  index('deadlines_tenant_idx').on(t.tenantId),
  dueIdx:     index('deadlines_due_idx').on(t.tenantId, t.dueDate),
  processIdx: index('deadlines_process_idx').on(t.tenantId, t.processId),
}))

// ── Tasks ─────────────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id:          text('id').primaryKey(),
  tenantId:    text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  processId:   text('process_id').references(() => processes.id, { onDelete: 'cascade' }),
  clientId:    text('client_id').references(() => clients.id),
  title:       text('title').notNull(),
  description: text('description'),
  priority:    text('priority').notNull().default('normal'),
  status:      text('status').notNull().default('todo'),
  assignedTo:  text('assigned_to').references(() => users.id),
  createdBy:   text('created_by').references(() => users.id),
  dueDate:     text('due_date'),
  completedAt: text('completed_at'),
  tags:        jsonb('tags').notNull().default([]),
  createdAt:   text('created_at').notNull(),
  updatedAt:   text('updated_at').notNull(),
}, t => ({
  tenantIdx:   index('tasks_tenant_idx').on(t.tenantId),
  assignedIdx: index('tasks_assigned_idx').on(t.tenantId, t.assignedTo),
}))

// ── Financial Entries ─────────────────────────────────────────
export const financialEntries = pgTable('financial_entries', {
  id:              text('id').primaryKey(),
  tenantId:        text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type:            text('type').notNull(),               // 'receivable' | 'payable'
  category:        text('category').notNull(),
  description:     text('description').notNull(),
  amount:          real('amount').notNull(),
  status:          text('status').notNull().default('pending'),
  dueDate:         text('due_date').notNull(),
  paidDate:        text('paid_date'),
  paidAmount:      real('paid_amount'),
  processId:       text('process_id').references(() => processes.id),
  clientId:        text('client_id').references(() => clients.id),
  invoiceNumber:   text('invoice_number'),
  paymentMethod:   text('payment_method'),
  asaasPaymentId:  text('asaas_payment_id'),
  asaasInvoiceUrl: text('asaas_invoice_url'),
  recurrence:      text('recurrence'),
  recurrenceEnd:   text('recurrence_end'),
  parentEntryId:   text('parent_entry_id'),
  notes:           text('notes'),
  installmentOf:   integer('installment_of'),
  installmentTotal:integer('installment_total'),
  createdBy:       text('created_by').references(() => users.id),
  createdAt:       text('created_at').notNull(),
  updatedAt:       text('updated_at').notNull(),
}, t => ({
  tenantIdx:  index('financial_tenant_idx').on(t.tenantId),
  dueIdx:     index('financial_due_idx').on(t.tenantId, t.dueDate),
  processIdx: index('financial_process_idx').on(t.tenantId, t.processId),
}))

// ── Documents ─────────────────────────────────────────────────
export const documents = pgTable('documents', {
  id:           text('id').primaryKey(),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  processId:    text('process_id').references(() => processes.id),
  clientId:     text('client_id').references(() => clients.id),
  name:         text('name').notNull(),
  description:  text('description'),
  type:         text('type'),
  mimeType:     text('mime_type').notNull(),
  filePath:     text('file_path').notNull(),
  fileSize:     integer('file_size').notNull(),
  version:      integer('version').notNull().default(1),
  parentDocId:  text('parent_doc_id'),
  isTemplate:   boolean('is_template').notNull().default(false),
  tags:         jsonb('tags').notNull().default([]),
  uploadedBy:   text('uploaded_by').references(() => users.id),
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
}, t => ({
  tenantIdx:  index('documents_tenant_idx').on(t.tenantId),
  processIdx: index('documents_process_idx').on(t.tenantId, t.processId),
}))

// ── Signature Requests (coleta de assinaturas) ────────────────
export const signatureRequests = pgTable('signature_requests', {
  id:             text('id').primaryKey(),
  tenantId:       text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  processId:      text('process_id').references(() => processes.id),
  clientId:       text('client_id').references(() => clients.id),
  clientName:     text('client_name'),
  clientPhone:    text('client_phone'),
  documentos:     jsonb('documentos').notNull().default([]),  // [{ titulo, corpo }]
  modo:           text('modo').notNull().default('link'),
  status:         text('status').notNull().default('pendente'),
  validationCode: text('validation_code'),
  signerName:     text('signer_name'),
  signerCpf:      text('signer_cpf'),
  signatureImg:   text('signature_img'),   // dataURL
  photoImg:       text('photo_img'),        // dataURL
  signedAt:       text('signed_at'),
  signedIp:       text('signed_ip'),        // IP observado pelo servidor (autoritativo)
  documentHash:   text('document_hash'),    // SHA-256 do conteúdo assinado (integridade)
  consent:        boolean('consent').default(false),  // aceite LGPD
  consentText:    text('consent_text'),     // termo exato aceito
  evidencias:     jsonb('evidencias'),      // { ip, geo, userAgent, plataforma, idioma, tela, fuso, carimboTempo }
  createdBy:      text('created_by').references(() => users.id),
  createdAt:      text('created_at').notNull(),
  updatedAt:      text('updated_at').notNull(),
}, t => ({
  tenantIdx:  index('signatures_tenant_idx').on(t.tenantId),
  processIdx: index('signatures_process_idx').on(t.processId),
}))

// ── Legal Theses ──────────────────────────────────────────────
export const legalTheses = pgTable('legal_theses', {
  id:        text('id').primaryKey(),
  tenantId:  text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title:     text('title').notNull(),
  area:      text('area').notNull(),
  subArea:   text('sub_area'),
  content:   text('content').notNull(),
  tags:      jsonb('tags').notNull().default([]),
  source:    text('source'),
  isPublic:  boolean('is_public').notNull().default(false),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => ({
  tenantIdx: index('theses_tenant_idx').on(t.tenantId, t.area),
}))

// ── Automation Rules ──────────────────────────────────────────
export const automationRules = pgTable('automation_rules', {
  id:         text('id').primaryKey(),
  tenantId:   text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  trigger:    text('trigger').notNull(),
  conditions: jsonb('conditions').notNull().default([]),
  actions:    jsonb('actions').notNull().default([]),
  area:       text('area'),
  isActive:   boolean('is_active').notNull().default(true),
  lastRunAt:  text('last_run_at'),
  createdBy:  text('created_by').references(() => users.id),
  createdAt:  text('created_at').notNull(),
  updatedAt:  text('updated_at').notNull(),
})

export const automationLogs = pgTable('automation_logs', {
  id:             text('id').primaryKey(),
  tenantId:       text('tenant_id').notNull(),
  ruleId:         text('rule_id').notNull().references(() => automationRules.id, { onDelete: 'cascade' }),
  triggerEntity:  text('trigger_entity'),
  triggerId:      text('trigger_id'),
  status:         text('status').notNull(),
  output:         jsonb('output'),
  ranAt:          text('ran_at').notNull(),
})

// ── Audit Logs ────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id:         text('id').primaryKey(),
  tenantId:   text('tenant_id').notNull(),
  userId:     text('user_id'),
  action:     text('action').notNull(),
  resource:   text('resource').notNull(),
  resourceId: text('resource_id'),
  changes:    jsonb('changes'),
  ipAddress:  text('ip_address'),
  userAgent:  text('user_agent'),
  createdAt:  text('created_at').notNull(),
}, t => ({
  tenantIdx: index('audit_tenant_idx').on(t.tenantId, t.createdAt),
}))
