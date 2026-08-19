# Testes de integração

Rodam contra um **Postgres descartável local** e o servidor real. Não tocam no
banco de produção.

## Subir o banco de teste

Requer `postgresql` instalado (binários em `/usr/lib/postgresql/<versão>/bin`).
O Postgres recusa rodar como root — daí o usuário separado.

```bash
export PATH=/usr/lib/postgresql/16/bin:$PATH
id pgtest >/dev/null 2>&1 || useradd -M -s /bin/bash pgtest
rm -rf /var/tmp/pgt && mkdir -p /var/tmp/pgt/data /var/tmp/pgt/run
chown -R pgtest /var/tmp/pgt && chmod 755 /var/tmp/pgt

su pgtest -c "PATH=/usr/lib/postgresql/16/bin:\$PATH initdb -D /var/tmp/pgt/data -U postgres --auth=trust"
su pgtest -c "PATH=/usr/lib/postgresql/16/bin:\$PATH pg_ctl -D /var/tmp/pgt/data \
  -o '-p 55432 -k /var/tmp/pgt/run -c listen_addresses=127.0.0.1' -l /var/tmp/pgt/data/log start"
su pgtest -c "psql -h 127.0.0.1 -p 55432 -U postgres -c 'create database perspecta;'"

export DATABASE_URL="postgresql://postgres@127.0.0.1:55432/perspecta"
npm run db:migrate
```

## Subir o servidor de teste

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:55432/perspecta"
export JWT_SECRET="qualquer-coisa-com-mais-de-32-caracteres-aqui-ok"
export PORT=8799 NODE_ENV=development
node server/index.mjs &
```

## Rodar

```bash
# Servidor: auth, allowlist do tenant, validação de senha
node server/tests/etapa0.integracao.mjs

# Cliente: ferramenta de resgate do localStorage.
# Precisa de bundle porque o código do cliente usa imports sem extensão (Vite).
node_modules/.bin/esbuild server/tests/etapa0.resgate.mjs \
  --bundle --platform=node --format=esm --outfile=/tmp/resgate.bundle.mjs \
  --define:import.meta.env.VITE_API_URL='"http://127.0.0.1:8799"' \
  --define:import.meta.env.DEV=false
node /tmp/resgate.bundle.mjs
```

Ambos saem com código 0 se tudo passar.

**Atenção:** os dois testes escrevem no banco apontado por `DATABASE_URL` e
`etapa0.integracao.mjs` cria tenants/usuários fixos. Rode sempre contra um banco
descartável, nunca contra produção. `etapa0.integracao.mjs` só roda uma vez por
banco limpo (os ids são fixos); recrie o banco para repetir.

## O que o `etapa0.integracao.mjs` prova

O bug original de autenticação (`Array.find` com predicado `async` sempre casa a
primeira linha) permitia trocar qualquer string por um `accessToken` do dono da
primeira linha de `refresh_tokens`. Para ver o bug original:

```bash
node -e "
import('bcryptjs').then(async ({default: b}) => {
  const t = [{id:'primeira'},{id:'segunda'}];
  t[0].tokenHash = await b.hash('real', 8); t[1].tokenHash = await b.hash('outro', 8);
  console.log(t.find(async x => await b.compare('INVENTADO', x.tokenHash)).id);
  // imprime 'primeira' — a Promise do predicado async é sempre truthy
});"
```
