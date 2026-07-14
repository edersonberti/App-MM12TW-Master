# Prisma + Supabase — Migrations

## 1. Configurar `.env`

Copie `.env.example` para **`.env`** (Prisma CLI lê `.env`; Next.js usa `.env.local` — pode duplicar as URLs nos dois):

**Supabase Dashboard → Project Settings → Database**

| Variável | Onde pegar |
|----------|------------|
| `DATABASE_URL` | **Connection pooling** → URI (porta **6543**, `?pgbouncer=true`) |
| `DIRECT_URL` | **Direct connection** → URI (porta **5432**) |

Exemplo:

```env
DATABASE_URL="postgresql://postgres.[ref]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

> Use a **senha do banco** (Database password), não a anon key.

---

## 2. Instalar dependências (se ainda não fez)

```bash
npm install
```

---

## 3. Gerar Prisma Client

```bash
npm run db:generate
```

---

## Escolha o cenário

### Cenário A — Banco **novo / vazio**

```bash
npm run db:migrate
```

Isso aplica:

- `20260714180000_init` — cria `profiles`, `devices`, `device_settings` (8 motores)
- `20260714180100_rls_policies` — RLS + policies (corrige erro **42501**)

---

### Cenário B — Supabase **já tem tabelas** (seu caso)

**Passo 1** — Sincronizar colunas/constraints sem recriar tabelas:

```bash
npm run db:patch
```

**Passo 2** — Aplicar só RLS:

```bash
npm run db:rls
```

**Passo 3** — Marcar migrations como já aplicadas (baseline):

```bash
npx prisma migrate resolve --applied 20260714180000_init
npx prisma migrate resolve --applied 20260714180100_rls_policies
```

**Passo 4** — Gerar client:

```bash
npm run db:generate
```

---

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run db:generate` | Gera `@prisma/client` após mudar `schema.prisma` |
| `npm run db:migrate` | Dev: cria + aplica migration (`prisma migrate dev`) |
| `npm run db:migrate:deploy` | Produção: aplica migrations pendentes |
| `npm run db:push` | Sincroniza schema sem migration (rápido, dev only) |
| `npm run db:studio` | UI visual do banco |
| `npx prisma migrate status` | Ver migrations aplicadas/pendentes |
| `npx prisma db pull` | Introspect banco → atualiza `schema.prisma` |

---

## Criar nova migration (futuro)

Depois de editar `prisma/schema.prisma`:

```bash
npm run db:migrate
# Nome sugerido quando pedir: add_campo_xyz
```

Produção:

```bash
npm run db:migrate:deploy
```

---

## Modelos

| Tabela | Model Prisma |
|--------|----------------|
| `profiles` | `Profile` |
| `devices` | `Device` |
| `device_settings` | `DeviceSettings` |

`device_settings` inclui `motor1_name` … `motor8_name` e `device_id` UNIQUE (upsert do app).
