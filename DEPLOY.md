# 🚀 Publicar o Perspecta Juris na nuvem (Supabase + Render)

Depois disto, o sistema deixa de ser "offline" e passa a funcionar **de verdade**: um único endereço, cada escritório com seu login, **dados isolados por escritório** e sincronizados entre computadores.

> **Importante:** os passos abaixo usam **suas contas** (Supabase e Render). Eu não posso criar contas nem digitar senhas por você — mas é só seguir na ordem. O código já está 100% pronto no GitHub.

O deploy é **1 serviço** no Render (serve a API **e** o site juntos) + **1 banco** no Supabase.

---

## Passo 1 — Banco de dados no Supabase

1. Crie conta em **https://supabase.com** → **New project**.
2. Dê um nome (ex.: `perspecta-juris`), escolha uma **senha do banco** (guarde) e a região **South America (São Paulo)**.
3. Espere o projeto subir (~2 min).
4. Vá em **Project Settings → Database → Connection string → URI**.
5. Copie a URI. Ela é assim:
   ```
   postgresql://postgres:[SUA-SENHA]@db.xxxxx.supabase.co:5432/postgres
   ```
   Troque `[SUA-SENHA]` pela senha do banco que você definiu. **Essa é a sua `DATABASE_URL`.**

---

## Passo 2 — Publicar no Render (a partir do GitHub)

1. Crie conta em **https://render.com** → **New → Web Service**.
2. Conecte sua conta do GitHub e escolha o repositório **`Perspecta-Juris`**.
3. O Render lê o arquivo **`render.yaml`** do projeto e já preenche o build/start. Confirme:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server/index.mjs`
   - **Health Check Path:** `/api/health`
4. Em **Environment / Environment Variables**, defina:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | *(a URI do Passo 1)* |
   | `JWT_SECRET` | deixe o Render **gerar** (ou cole uma senha longa aleatória) |
   | `MASTER_LOGIN` | `admin` |
   | `MASTER_PASSWORD` | **uma senha forte (mín. 8 caracteres)** — este é o SEU acesso master |
   | `MASTER_EMAIL` | seu e-mail |
   | `NODE_ENV` | `production` |

5. Clique **Create Web Service** e espere o primeiro deploy terminar. Anote o endereço, ex.: `https://perspecta-juris.onrender.com`.

---

## Passo 3 — Criar as tabelas e o admin (uma vez)

No Render, abra o **Shell** do serviço (aba *Shell*) e rode, na ordem:

```bash
npm run db:migrate   # cria todas as tabelas no Supabase
npm run db:seed      # cria o seu login master (admin) com a MASTER_PASSWORD
```

> Se preferir, dá pra rodar do seu computador: crie um arquivo `.env` com a `DATABASE_URL` e a `MASTER_PASSWORD` e rode os dois comandos.

---

## Passo 4 — Entrar e criar os escritórios

1. Abra o endereço do Render.
2. Faça login como **Empresa:** *(em branco)* · **Nome:** `admin` · **Senha:** *(a MASTER_PASSWORD)*.
3. Você cai no **Painel Master** → **Empresas** → **Nova empresa**:
   - Crie **Perspecta** (o seu) e o **KN Advocacia Criminal**.
   - Ao criar cada empresa, o painel já gera o **login de admin** dela (você define nome e senha — ex.: `kat`, `karen`, `nathi`).
4. Cada escritório nasce **limpo** (sem clientes/processos).

---

## Passo 5 — Mandar o link (cada um no seu escritório)

- É **o mesmo link** para todo mundo (o endereço do Render).
- Cada pessoa entra com **o seu login** (kat / karen / nathi …) e vê **apenas os dados do seu escritório** — o sistema isola por empresa em toda consulta.
- Você, no `admin`, administra todas as empresas e cria novas quando quiser.
- **Portal do cliente:** o mesmo endereço + `/portal` — o cliente entra com **nome + senha** que você habilita no cadastro dele.

---

## 🔒 Segurança (importante)

- **Nunca** suba o arquivo `.env` para o GitHub (ele já está no `.gitignore`).
- Guarde bem `DATABASE_URL`, `JWT_SECRET` e `MASTER_PASSWORD`.
- Quando integrar **Asaas** (boletos/link) e **CRM (Perspecta Hub)**, as chaves entram **como variáveis de ambiente no Render** — nunca no site/navegador.

## 💡 Domínio próprio (opcional)
No Render → **Settings → Custom Domains** dá para usar algo como `app.perspectajuris.com.br`.

---

### Resumo do que cada conta faz
- **GitHub** → guarda o código (já está lá).
- **Supabase** → guarda os dados (banco).
- **Render** → roda o sistema (site + API) e liga tudo.
