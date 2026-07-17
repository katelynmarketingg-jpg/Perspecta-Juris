# Deploy — Perspecta Juris na nuvem (seguro e profissional)

Arquitetura, do jeito que os grandes SaaS fazem:

```
Frontend (React/Vite estático)  ──►  Backend (Fastify, JWT)  ──►  Postgres gerenciado (Supabase)
        VITE_API_URL                  segredos em env             isolamento por tenant (tenant_id)
```

- **Segredos ficam só no servidor** (env vars). Nunca no frontend, nunca no git.
- **Senhas** com hash bcrypt; sessões com **JWT** + refresh token.
- **Isolamento por escritório**: toda query filtra por `tenant_id` do usuário logado.
- **Fail-fast**: em produção o servidor não sobe com `JWT_SECRET` padrão/curto nem sem `DATABASE_URL`.

---

## 1. Banco de dados — Supabase

1. Crie um projeto em https://supabase.com (região São Paulo).
2. **Project Settings → Database → Connection string → URI** e copie a string do **Connection pooler** (porta 6543).
3. Guarde — será a `DATABASE_URL`.

> Neon.tech também funciona (mesmo formato `postgresql://`).

## 2. Segredos

Gere um segredo forte para o JWT:

```bash
openssl rand -base64 48
```

Copie `.env.example` para `.env` e preencha (local) — em produção, cadastre como **variáveis de ambiente no host** (não use arquivo):

- `DATABASE_URL` — string do Supabase
- `JWT_SECRET` — o valor gerado acima
- `NODE_ENV=production`
- `CLIENT_ORIGIN` — domínio do frontend (ex.: `https://app.perspectajuris.com.br`)
- `MASTER_PASSWORD` — sua senha de administradora (≥8 caracteres)
- (opcional) `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT=production`, `ASAAS_WEBHOOK_TOKEN`

## 3. Criar as tabelas e o admin

```bash
npm install
npm run db:migrate      # cria todas as tabelas no Supabase
node server/db/seed.mjs # cria seu tenant master + login de administradora
```

Cada escritório novo é criado **vazio** por você, no painel master (`/master/companies`).

## 4. Publicar o backend (Render)

O repositório já tem `render.yaml`. No Render:

1. **New → Blueprint** apontando para o repositório.
2. Em **Environment**, cadastre as variáveis do passo 2.
3. Build: `npm install` · Start: `npm start` (roda `server/index.mjs`).
4. Anote a URL pública, ex.: `https://perspecta-juris.onrender.com`.

## 5. Publicar o frontend

Build apontando para o backend:

```bash
VITE_API_URL=https://perspecta-juris.onrender.com npm run build
```

Publique a pasta `dist/` (Render Static Site, Vercel ou Netlify). Pronto — o app passa a
salvar **tudo na nuvem**; o modo offline (localStorage) vira apenas cache de contingência.

## 6. Pagamentos por link (Asaas) — quando for ativar

1. Conta em https://www.asaas.com → **Integrações → Chave de API**.
2. Cadastre `ASAAS_API_KEY` **no servidor** (env), nunca no frontend.
3. Configure o **webhook** do Asaas apontando para `POST /api/integrations/asaas/webhook`
   protegido por `ASAAS_WEBHOOK_TOKEN` (rota a implementar quando você tiver a conta).

---

### Checklist de segurança (produção)
- [ ] `JWT_SECRET` forte e único (nunca o padrão)
- [ ] `.env` fora do git (já está no `.gitignore`)
- [ ] `NODE_ENV=production` (ativa HSTS + fail-fast)
- [ ] `CLIENT_ORIGIN` restrito ao seu domínio
- [ ] `MASTER_PASSWORD` forte; troque a senha `001` de desenvolvimento
- [ ] Backups automáticos do Supabase habilitados
