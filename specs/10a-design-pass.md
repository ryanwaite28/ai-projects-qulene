## Spec: Phase 10a — Mobile + web design pass (visual consistency)
**FR references**: Phase 10 PROJECT.md items (visual polish, NativeWind / Tailwind consistency)
**Status**: ✅ Implemented
**Prerequisites**: 6b ✅, 8e3 ✅
**Size check**: cross-cutting visual pass; no new files (only modifications); 1 layer · justification: this is a focused polish pass, not new functionality — all the screens already exist ✅

### What
Visual consistency pass across both mobile and web. Define a small design-token vocabulary (primary, accent, surface, text, error colors; typography scale; spacing scale) and apply it across all screens. No new features; only NativeWind / Tailwind class updates and reusable styled-component extraction.

### Why
Portfolio polish: inconsistent visual language across phases (each phase implemented its screens with arbitrary Tailwind classes) reduces credibility.

### New / Modified Files
- `packages/shared-utils/src/design-tokens.ts` — exported constants: `colors`, `spacing`, `radii`, `fontFamilies`, `fontSizes` — referenced by both mobile (via NativeWind config) and web (via Tailwind config)
- `apps/mobile/tailwind.config.js` (modify) — `theme.extend` reads from design tokens
- `apps/web-app/tailwind.config.js` (modify) — same
- `apps/marketing/tailwind.config.js` (modify) — same
- Touch-up modifications to existing screens — applying the token classes consistently

### Behavior
Establish a single source of truth for visual style. Both NativeWind (mobile) and Tailwind (web/marketing) extend their theme from the same TypeScript constants. Buttons, cards, badges, inputs all conform to the token set.

**Specific consistency goals**:
- Primary CTA color identical across mobile + web
- Status badge color mapping identical (PENDING=yellow, ACCEPTED=green, DECLINED=red, …)
- Spacing rhythm uses the same scale (`p-2`, `p-4`, `p-6` mean the same physical sizes)
- Avatar circle radii identical
- Form input style identical
- Typography hierarchy identical (h1 → h2 → h3 → body → caption)

**Scope discipline**: this phase does NOT add new components, features, or routes. Any temptation to do so is logged in `IMPLEMENTATION_PLAN.md` as a Phase 11+ idea.

### Done When
- [x] Design tokens module exists and is imported by all 3 Tailwind configs
- [x] All four screens with status badges (mobile customer appointments, mobile business dashboard, web customer appointments, web business dashboard) use identical color mapping
- [x] All primary CTAs have identical color
- [x] Manual screenshot comparison: mobile and web screens of the same domain (e.g., appointments list) feel visibly part of the same product
- [x] `npm run lint` and `ng lint` exit 0 after changes
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
