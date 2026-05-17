## Spec: Phase 0a — Root + Backend + Packages Workspace
**FR references**: (foundational — no FR; supports NFR-05 isolation, NFR-09 handler thinness via project structure)
**Status**: 🔄 In Progress
**Prerequisites**: none
**Size check**: 11 files · 0 service functions · 1 layer (tooling) · fits one session ✅

### What
Initialize the npm monorepo at the repo root and the foundational packages — root tooling config, backend package shell, and the two shared `packages/` workspaces (`api-types`, `shared-utils`). No business logic; this spec exists only to make the workspace installable and lintable so subsequent phases can add code.

### Why
Establishes the workspace skeleton required by every later phase. PROJECT.md Section 6.1 mandates npm workspaces with the listed structure; CLAUDE.md "Settled Decisions" pins this as a non-negotiable.

### New / Modified Files
- `package.json` — root npm workspace declaring `apps/*`, `packages/*`, `backend` members; root scripts (`lint`, `typecheck`, `build`, `test`)
- `tsconfig.base.json` — shared TS compiler options inherited by every package
- `.eslintrc.json` — flat ESLint config; **must** include `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"` from day one
- `.prettierrc` — formatting config (single quotes, 2-space, trailing commas)
- `.gitignore` — node_modules, dist, .env, .terraform, .DS_Store
- `.env.example` — every variable from PROJECT.md Section 10.2 (local + mobile)
- `backend/package.json` — workspace member; depends on `@qulene/api-types`, `@qulene/shared-utils`, AWS SDK v3 clients, esbuild, vitest
- `backend/tsconfig.json` — extends base; outputs to `dist/`
- `backend/src/types/index.ts` — empty placeholder (will hold internal backend types)
- `packages/api-types/{package.json,src/index.ts}` — workspace member exporting shared types
- `packages/shared-utils/{package.json,src/index.ts}` — workspace member exporting shared utilities

### Behavior
Running `npm install` from the repo root must hydrate every workspace and link the two `packages/*` symlinks into `backend/node_modules/@qulene/*`. Running `npm run lint` and `npm run typecheck` from the root must exit 0. ESLint must recognize `_`-prefixed unused vars/args as intentional (mitigation for prior PixiCred friction documented in CLAUDE.md "Lessons from Prior Projects"). The TypeScript base config must enable `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

### Done When
- [ ] `npm install` from repo root succeeds; lockfile committed
- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `@qulene/api-types` and `@qulene/shared-utils` resolve from `backend/`
- [ ] ESLint config contains both `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"`
- [ ] `.env.example` contains every variable from PROJECT.md Section 10.2
- [ ] Spec status updated to ✅ Implemented
- [ ] `IMPLEMENTATION_PLAN.md` progress tracker row updated
