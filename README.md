# Just Plan

AI-assisted floor plan vectorization and editing. Upload a JPG floor plan, get editable vector walls, refine layouts via an AI agent chat.

## Stack

- **Web:** Next.js 15, Auth.js, Konva, Tailwind
- **API:** NestJS, Prisma, PostgreSQL, BullMQ/Redis, S3
- **ML:** FastAPI (vectorization + LLM agent tools)

## Quick start

```bash
# 1. Infrastructure (optional — Postgres/Redis/MinIO)
docker compose up -d

# 2. Install deps (npm workspaces; pnpm also supported via pnpm-workspace.yaml)
npm install

# 3. Env files are pre-seeded for local demo:
#    apps/web/.env.local, apps/api/.env, apps/ml/.env

# 4. Build shared schema + push SQLite schema
npm run build -w @just-plan/plan-schema
npm run db:generate
npm run db:push

# 5. ML venv
cd apps/ml && python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 6. Run services (three terminals)
npm run dev -w @just-plan/api
npm run dev -w @just-plan/web
npm run dev -w @just-plan/ml
```

Without Docker the API uses **SQLite** (`file:./dev.db`) and **local disk** uploads under `apps/api/uploads`. Use Dev Login on `/login` when OAuth credentials are empty.

## Monorepo

```
apps/web          — Next.js UI
apps/api          — NestJS API
apps/ml           — Python FastAPI ML service
packages/plan-schema — shared PlanDocument Zod/JSON schema
```

## OAuth

Configure Google, Yandex ID, and Mail.ru / VK ID client credentials in `.env`. Redirect URI: `http://localhost:3000/api/auth/callback/{provider}`.

## MVP scope

1. OAuth login → projects dashboard
2. Create project → workspace
3. Upload JPG → vectorize walls
4. Chat with AI to mutate the plan JSON
5. Manual wall endpoint edits + undo/redo
