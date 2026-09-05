# Porta administrativa — `/api/admin/*`

Esta é a porta pela qual a **Perspecta Central** administra o Perspecta Juris:
cria escritórios, cria e revoga acessos, ativa e desativa, e lê o consumo que
serve de base para a cobrança.

Não existe painel administrativo aqui. Existe só a porta.

---

## Como ela se autentica

Um cabeçalho `Authorization` com o valor de `ADMIN_API_TOKEN`.

Não é um JWT de usuário. As rotas do painel master (`/api/master/*`) exigem um
login humano com papel `master` e um token que dura 2 horas — a Central não é
uma pessoa e não tem sessão. Por isso a credencial aqui é fixa, não expira e
não pertence a ninguém.

```
Authorization: Bearer <ADMIN_API_TOKEN>
```

O cabeçalho `X-Admin-Token: <token>` também é aceito, e o `Bearer ` é opcional.

### Gerando e guardando o token

```bash
openssl rand -base64 48
```

Cole o resultado em **Render → perspecta-juris → Environment → `ADMIN_API_TOKEN`**
e no ambiente da Central. O valor **nunca** entra no repositório.

### Respostas de recusa

| Situação | Resposta |
|---|---|
| `ADMIN_API_TOKEN` não configurado no servidor | `503` — a porta nasce fechada |
| `ADMIN_API_TOKEN` com menos de 32 caracteres | `503` — configuração fraca é recusada, não tolerada |
| Token ausente ou errado | `401` |
| JWT de usuário (mesmo o do master) | `401` — são credenciais de mundos diferentes |

A comparação do token é de tempo constante (`crypto.timingSafeEqual`). Um `===`
comum vaza, pelo tempo de resposta, quantos caracteres o atacante já acertou.

### Limite de chamadas

600 por minuto por IP, separado do limite global de 200/min do resto da API —
a administração não compete com os escritórios usando o sistema. Ajustável por
`ADMIN_RATE_LIMIT`.

---

## As regras são as mesmas do painel

As rotas abaixo são cascas finas sobre `server/services/provisionamento.js`, o
mesmo módulo que o painel master e a tela de Configurações usam. Senha mínima,
limite de acessos do plano, login único, proteção do último administrador: tudo
vale igual, venha a chamada da Central ou de um humano logado. Se uma regra
mudar, muda para os dois ao mesmo tempo.

---

## Rotas

### `GET /api/admin/ping`

Confirma que o token está certo antes de tentar qualquer coisa que mude estado.

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  https://perspecta-juris.onrender.com/api/admin/ping
# {"ok":true,"servico":"perspecta-juris","ts":"2026-09-05T00:00:00.000Z"}
```

---

### `GET /api/admin/companies`

Lista os escritórios (o master fica de fora) com plano, limite e contagens.

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  https://perspecta-juris.onrender.com/api/admin/companies
```

```json
[
  {
    "id": "tnt_abc123", "name": "Silva Advogados", "slug": "silva-advogados",
    "plan": "starter", "isActive": true, "planExpiresAt": null, "cnpj": "11222333000181",
    "maxUsers": 2, "usersCount": 2, "clientsCount": 14, "processesCount": 31,
    "createdAt": "2026-08-01T12:00:00.000Z"
  }
]
```

---

### `POST /api/admin/companies`

Cria o escritório **e** o primeiro acesso de administrador dele.

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "Silva Advogados",
        "cnpj": "11222333000181",
        "plan": "starter",
        "adminName": "Maria Silva",
        "adminLogin": "maria",
        "adminEmail": "maria@silva.adv.br",
        "adminPassword": "uma-senha-forte-aqui"
      }' \
  https://perspecta-juris.onrender.com/api/admin/companies
```

`201` com o escritório criado. **A senha não volta na resposta** — quem a
definiu já a conhece, e ela não deve circular de novo.

Recusas:

| Resposta | Motivo |
|---|---|
| `400` | falta `name` ou `adminLogin`; senha com menos de 8 caracteres |
| `409` | já existe escritório com esse **nome** |

O `409` por nome repetido existe porque o login do sistema identifica o
escritório **pelo nome digitado**. Dois escritórios com o mesmo nome tornariam
a entrada ambígua. O `slug` continua sendo desambiguado sozinho (ganha um
sufixo), mas o nome, não.

---

### `PUT /api/admin/companies/:id`

Ativa, desativa, renomeia, troca de plano, define vencimento.

```bash
# corta o acesso de quem não pagou
curl -X PUT -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}' \
  https://perspecta-juris.onrender.com/api/admin/companies/tnt_abc123

# upgrade de plano com data de vencimento
curl -X PUT ... -d '{"plan": "professional", "planExpiresAt": "2027-01-31"}'
```

Campos aceitos: `isActive`, `name`, `plan`, `planExpiresAt`, `cnpj`. Qualquer
outro é ignorado; um corpo sem nenhum campo válido devolve `400` com a lista —
a porta não finge que salvou.

`isActive: false` **barra o login imediatamente**. É a forma de suspender um
escritório inadimplente sem apagar nada.

`403` para o escritório master. `404` se o id não existir.

---

### `GET /api/admin/companies/:id/users`

Lista os acessos do escritório. Nunca traz hash de senha.

---

### `POST /api/admin/companies/:id/users`

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"João Souza","login":"joao","email":"joao@silva.adv.br",
       "password":"uma-senha-forte-aqui","role":"advogado"}' \
  https://perspecta-juris.onrender.com/api/admin/companies/tnt_abc123/users
```

Papéis: `admin`, `advogado`, `estagiario`, `financeiro`, `recepcionista`
(a lista viva está em `client/src/lib/constants.js`, `USER_ROLES`). Sem `role`, entra
como `advogado`.

| Resposta | Motivo |
|---|---|
| `400` | falta o nome; senha com menos de 8 caracteres |
| `403` | limite de acessos do plano atingido — vem com `{ limite, atual }` |
| `404` | escritório não existe |
| `409` | já existe esse login **neste** escritório |

O limite é checado antes do login duplicado: num escritório lotado a resposta é
`403`, mesmo que o login também esteja repetido.

---

### `DELETE /api/admin/companies/:id/users/:userId`

`204` quando revoga. Duas recusas que a Central precisa esperar:

- `403` — o acesso `master` não pode ser removido;
- `400` — é o único administrador do escritório; crie outro antes.

---

### `GET /api/admin/metrics`

Tudo que a Central precisa para medir e cobrar, numa chamada só.

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://perspecta-juris.onrender.com/api/admin/metrics?from=2026-09-01"
```

```json
{
  "periodo": { "desde": "2026-09-01T00:00:00.000Z", "ate": null },
  "planos": [{ "key": "starter", "name": "Starter", "maxUsers": 2 }],
  "escritorios": [
    {
      "id": "tnt_abc123", "name": "Silva Advogados",
      "plan": "starter", "isActive": true, "planExpiresAt": null, "maxUsers": 2,
      "contagens": { "usuarios": 2, "clientes": 14, "processos": 31 },
      "uso": {
        "datajud_query":  { "total": 412, "eventos": 412 },
        "djen_query":     { "total": 30,  "eventos": 30 },
        "document_bytes": { "total": 8400312, "eventos": 19 },
        "user_created":   { "total": 2, "eventos": 2 }
      }
    }
  ]
}
```

Sem `from`, o período começa no dia 1º do mês corrente.

**`datajud_query` é o medidor que importa.** Cada consulta ao CNJ conta uma vez
— inclusive as que falham, porque para o CNJ a consulta aconteceu. `total` é a
quantidade; `eventos` é quantas linhas geraram esse total (para bytes de
documento os dois números divergem).

O consumo é medido, não limitado. Hoje o Juris **não bloqueia** ninguém por
cota: quem decide o que fazer com esses números é a Central.

---

### `GET /api/admin/audit?limit=100`

Últimos registros de auditoria, mais recentes primeiro. Máximo de 500.

Tudo que a Central faz entra aqui com `changes.origem = "central"`, o que
permite separar, depois, o que veio da administração do que veio de dentro do
escritório.

---

## O que esta porta **não** faz

- **Não apaga escritórios.** Desativar (`isActive: false`) corta o acesso e
  preserva os dados. Apagar é irreversível e leva junto clientes, processos e
  financeiro por cascata — se for mesmo necessário, é pelo painel master, com
  um humano decidindo.
- **Não bloqueia por cota.** Mede e entrega os números; a decisão é da Central.
- **Não devolve senha nenhuma**, nem na criação.
- **Não lê dados dos escritórios** — clientes, processos, documentos e
  financeiro não são expostos aqui. A porta administra e mede; não bisbilhota.

---

## Testes

`server/tests/etapa5.admin.mjs` — 36 asserções, contra banco descartável.
Ver `server/tests/README.md` para subir o banco e o servidor.

```bash
export ADMIN_API_TOKEN="token-de-teste-com-mais-de-32-caracteres-para-a-central"
node server/tests/etapa5.admin.mjs
```
