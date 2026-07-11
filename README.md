# Perspecta Juris

ERP jurídico (SaaS) para escritórios de advocacia — gestão de clientes, processos,
prazos, financeiro, documentos e uma calculadora jurídica completa (trabalhista,
previdenciária, cível e mais).

## Stack

- **Frontend:** React 18 + Vite (porta 3001), Zustand, Tailwind
- **Backend:** Fastify + Drizzle (Postgres) — em `server/`
- **Offline-first:** funciona via `localStorage` quando o backend está indisponível
- **Multi-tenant:** dados isolados por empresa; login master (admin do sistema) separado

## Rodando localmente

```bash
npm install
npm run dev          # frontend em http://localhost:3001
```

Build de produção:

```bash
npm run build        # gera client/dist
```

## Estrutura

```
client/        Aplicação React (SPA)
  src/modules/   Telas por domínio (clients, processes, financial, calculator, registros...)
  src/lib/       Regras de negócio (legalCalc, auditLog, printDoc, api...)
server/        API Fastify + schema Drizzle
```

## Módulos principais

- **Clientes** — cadastro, processos, pagamentos (à vista/parcelado/link, boletos, baixa, WhatsApp), documentos, tarefas
- **Calculadora Jurídica** — 50+ cálculos, planejamento previdenciário, importação de CNIS, parâmetros anuais (teto/salário mínimo/INPC/tábua IBGE)
- **Registros** — log de auditoria das atividades dos colaboradores, com filtros por tipo
- **Diário Oficial / Movimentações**, **Modelos de petições**, **Assinaturas**, **Relatórios**

## Variáveis de ambiente

Veja [`.env.example`](.env.example).

---

© Perspecta Juris. Uso interno.
