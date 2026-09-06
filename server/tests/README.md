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
export ADMIN_API_TOKEN="token-de-teste-com-mais-de-32-caracteres-para-a-central"
export PORT=8799 NODE_ENV=development DATAJUD_SYNC_ENABLED=false
node server/index.mjs &
```

`ADMIN_API_TOKEN` é o que abre `/api/admin/*` — sem ele a suíte da ETAPA 5 não
tem o que testar. `DATAJUD_SYNC_ENABLED=false` impede que o job automático
rode em paralelo com a suíte que o exercita à mão.

## Rodar

Rodam direto (só servidor):

```bash
node server/tests/etapa0.integracao.mjs   # auth, allowlist do tenant, senha
node server/tests/etapa1.financeiro.mjs   # financeiro unificado
node server/tests/etapa3.consumo.mjs      # medidor de consumo
node server/tests/etapa2b.syncServidor.mjs  # sync do DataJud no servidor + trava
node server/tests/etapa5.admin.mjs        # porta /api/admin/* (precisa do ADMIN_API_TOKEN)
node server/tests/etapa6.papeis.mjs       # perfis de acesso num vocabulario so

# Este roda sozinho: nao precisa de servidor nem de banco, e so matematica.
node server/tests/etapa7.calculos.mjs     # motor de calculos juridicos
node server/tests/etapa9.avisos.mjs       # os avisos da tela e a validacao do planejamento
node server/tests/etapa10.vademecum.mjs   # o indice remissivo da legislacao
```

Este sobe o PRÓPRIO servidor, numa porta separada (8798), e por isso roda
sozinho — mas ainda precisa do banco:

```bash
node server/tests/etapa11.diario.mjs      # paginacao do Diario (DJEN)
```

Ele levanta um DJEN de mentira numa porta livre e sobe o servidor com
`DJEN_URL` apontando para lá. É a única forma de exercitar três páginas,
repetição entre páginas e falha no meio — a API real do CNJ não faz isso sob
encomenda. Em produção `DJEN_URL` não é definida e vale o endereço do CNJ.

Precisam de bundle, porque exercitam código do cliente (imports sem extensão,
resolvidos pelo Vite):

```bash
for t in etapa0.resgate etapa2.datajud etapa8.sessao; do
  node_modules/.bin/esbuild server/tests/$t.mjs \
    --bundle --platform=node --format=esm --outfile=.b.mjs \
    --define:import.meta.env.VITE_API_URL='"http://127.0.0.1:8799"' \
    --define:import.meta.env.DEV=false \
    --external:bcryptjs --external:postgres --external:drizzle-orm --external:nanoid \
    --external:node:fs
  node .b.mjs; rm -f .b.mjs
done
```

Total atual: **419 asserções** em 13 suítes. Cada suíte sai com código 0 se passar.

| Suíte | Asserções | O que prova |
|---|---:|---|
| `etapa0.integracao` | 16 | autenticação, allowlist do tenant, senha |
| `etapa0.resgate` | 17 | resgate do que ficou no navegador |
| `etapa1.financeiro` | 20 | financeiro unificado no banco |
| `etapa2.datajud` | 12 | movimentações do CNJ gravadas no banco |
| `etapa2b.syncServidor` | 17 | sync rodando no servidor, sem duplicar |
| `etapa3.consumo` | 14 | medidor de consumo por escritório |
| `etapa5.admin` | 36 | porta `/api/admin/*` da Perspecta Central |
| `etapa6.papeis` | 22 | um vocabulário só de perfis, sem mexer em permissão |
| `etapa7.calculos` | 165 | correção monetária, rescisão, dosimetria, locação, prazos, INSS/IRRF |
| `etapa8.sessao` | 14 | o laço de recarregamento na abertura |
| `etapa9.avisos` | 26 | os avisos que ninguém desenhava |
| `etapa10.vademecum` | 30 | busca e índice remissivo da legislação |
| `etapa11.diario` | 30 | paginação do Diário: nada de parar na primeira página |

**Atenção:** os testes escrevem no banco apontado por `DATABASE_URL`. Rode
sempre contra um banco descartável, **nunca contra produção**. Cada suíte apaga
os próprios fixtures no começo, então dá para repetir à vontade e rodar todas em
sequência no mesmo banco.

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
