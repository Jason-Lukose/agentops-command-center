# Deployment

> MVP is **local-first only**. Public deployment and paid services are human checkpoints — NOT done here.

## Target
**Runs locally only.** Cost: $0. Two host processes (`npm run dev`, `npm run worker`) plus two Docker
containers (Postgres, Redis). No public URL, no cloud account, no auth in the MVP.

## Local infrastructure — `app/docker-compose.yml`
Stateful services only (app + worker run on the host for fast reloads):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: agentops
      POSTGRES_PASSWORD: agentops
      POSTGRES_DB: agentops
    ports: ["5433:5432"]   # host 5433 — many dev machines already run native Postgres on 5432
    volumes: ["agentops_pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  agentops_pgdata:
```

## Environment Variables — `app/.env.example`
| Var | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | Prisma → Postgres | `postgresql://agentops:agentops@localhost:5433/agentops` (matches compose — host port 5433) |
| `REDIS_URL` | BullMQ → Redis | `redis://localhost:6379` |
| `PROVIDER_MODE` | Selects LLM/judge provider | `mock` (default, no key, $0). Any other value needs real keys → human checkpoint |

Never commit `.env`. `.env` is gitignored; `.env.example` holds placeholder values only.

## Run Steps (local)
```bash
cd app
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev
npm run db:seed
npm run dev      # terminal 1  → http://localhost:3000
npm run worker   # terminal 2
```

## Rollback (local)
- Bad schema/data: `npx prisma migrate reset` (drops, re-migrates, re-seeds — dev data only).
- Bad code: `git revert` / checkout previous commit; no live users to protect.
- Reset infra: `docker compose down -v` then bring up again.

## Post-Deploy Verification (local smoke)
- [ ] `http://localhost:3000` loads the dashboard with seeded metrics
- [ ] Create → run → approve → view trace works end-to-end
- [ ] No secrets in client bundle (`PROVIDER_MODE=mock`, no keys present)

---

## Future deployment — NOT DONE (requires human checkpoints)
Documented for later; nothing below is implemented or approved.

- **App/UI + API:** Vercel (Next.js). Free tier likely, but signup = human checkpoint.
- **Worker:** Vercel does not run long-lived workers — needs a separate always-on host
  (e.g. Railway/Fly/Render worker service or a small VPS running `npm run worker`). Paid/host = checkpoint.
- **Postgres:** managed (Neon/Supabase/RDS). Provisioning + connection string = checkpoint.
- **Redis:** managed (Upstash/Redis Cloud). BullMQ needs a real Redis, not serverless KV. Checkpoint.
- **Secrets:** move to the host's env store; rotate any real `PROVIDER` keys.
- **Auth:** none in MVP — must be added before any public exposure (auth decision = checkpoint).

## Deployment readiness gate
- [ ] Fresh-clone local setup test passed (docs alone sufficient)
- [ ] Security review verdict: CLEAR
- [ ] Rollback path written (local: done above)
- [ ] Costs confirmed ($0 local; any hosted service = user-approved)
- [ ] User approved going public — NOT sought (MVP is local-only)
