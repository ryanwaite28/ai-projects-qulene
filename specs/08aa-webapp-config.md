## Spec: Phase 8a-a — Web-app project config scaffold
**FR references**: FR-WEBAPP-02, FR-WEBAPP-04, FR-WEBAPP-09
**Status**: ✅ Implemented
**Prerequisites**: 1b ✅
**Size check**: 5 files · 0 service functions · 1 layer (project config) · fits one session ✅

### What
Create all project-level configuration files for `apps/web-app/` so that `npm install` succeeds and Angular CLI can be invoked. No TypeScript source yet — source bootstrap comes in Phase 8a-b. This is the equivalent of running `ng new` for the web-app workspace member.

### Why
FR-WEBAPP-02: the web app must be built with Angular 17+ (standalone, Tailwind). Configuration must exist before any source or auth wiring can be added.

### New / Modified Files
- `apps/web-app/package.json` *(modify)* — replace stub; add Angular 21.2.x, Amplify v6, Tailwind, ESLint deps matching the marketing app versions for consistency
- `apps/web-app/angular.json` (new) — `@angular-devkit/build-angular:application` builder; `outputPath: dist/web-app`; browser entry `src/main.ts`; `fileReplacements` for production env; lint target
- `apps/web-app/tsconfig.json` (new) — strict, `moduleResolution: bundler`, `target: ES2022`, `angularCompilerOptions` strict; same settings as marketing
- `apps/web-app/tailwind.config.js` (new) — content `['./src/**/*.{html,ts}']`; same setup as marketing
- `apps/web-app/.eslintrc.json` (new) — `@angular-eslint/recommended` + template rules; `component-selector: app-*, element, kebab-case`

### Behavior

**`package.json` dependencies**:
```json
"dependencies": {
  "@angular/animations": "^21.2.0",
  "@angular/common": "^21.2.0",
  "@angular/compiler": "^21.2.0",
  "@angular/core": "^21.2.0",
  "@angular/forms": "^21.2.0",
  "@angular/platform-browser": "^21.2.0",
  "@angular/platform-browser-dynamic": "^21.2.0",
  "@angular/router": "^21.2.0",
  "aws-amplify": "^6.0.0",
  "zone.js": "~0.16.0"
},
"devDependencies": {
  "@angular-devkit/build-angular": "^21.2.0",
  "@angular/cli": "^21.2.0",
  "@angular/compiler-cli": "^21.2.0",
  "@angular-eslint/builder": "^21.4.0",
  "@angular-eslint/eslint-plugin": "^21.4.0",
  "@angular-eslint/eslint-plugin-template": "^21.4.0",
  "@typescript-eslint/eslint-plugin": "^7.0.0",
  "@typescript-eslint/parser": "^7.0.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0",
  "tailwindcss": "^3.4.0",
  "typescript": "~5.9.0"
}
```

**`angular.json`**: identical structure to `apps/marketing/angular.json` but with:
- `outputPath: "dist/web-app"`
- `browser: "src/main.ts"`
- `fileReplacements` block in production config: `src/environments/environment.ts` → `src/environments/environment.prod.ts`
- `styles: ["src/styles.css"]`

**`tsconfig.json`**: copy marketing app tsconfig exactly — strict, `moduleResolution: bundler`, `target: ES2022`, `angularCompilerOptions: { strict: true, strictInjectionParameters: true, strictInputAccessModifiers: true, strictTemplates: true }`.

### Done When
- [x] `npm install` succeeds from monorepo root (new packages resolved)
- [x] `ng version` in `apps/web-app/` shows Angular CLI 21.2.11
- [x] `angular.json`, `tsconfig.json`, `tailwind.config.js`, `.eslintrc.json` exist and are valid
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
