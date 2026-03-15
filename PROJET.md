# PROJET.md — Verso (fork d'OpenPencil)

> **Verso est un fork d'OpenPencil** (MIT). On ajoute le Design Context Engine, le format .design,
> la validation design, le branding Verso, le site marketing, le backend Convex, et les extensions IDE.
>
> OpenPencil fournit : éditeur canvas (CanvasKit/Skia), layout (Yoga WASM), scene graph,
> import/export .fig, MCP server (87 outils), CLI headless, collaboration P2P, Tauri v2 desktop.

---

## 0. Règles fondamentales

- **Lire ROADMAP.md** pour le plan d'exécution complet (10 phases, 27 semaines)
- **NE PAS modifier packages/core/** sauf si absolument nécessaire — ajouter par-dessus
- **Respecter les conventions OpenPencil** : Bun, oxfmt, Vue 3 Composition API, Bun test
- **Lire le AGENTS.md** d'OpenPencil dans le repo forké pour comprendre les conventions
- **Utiliser `/frontend-design`** pour TOUT composant UI
- **TypeScript strict**, zéro `any`
- **Commiter en conventional commits**

## 1. Stack technique

| Composant | Tech (OpenPencil hérité) | Ajout Verso |
|---|---|---|
| Framework | Vue 3 + Composition API | — |
| Canvas | CanvasKit (Skia WASM) | — |
| Layout | Yoga WASM | — |
| State | Vue reactivity (stores/) | — |
| Desktop | Tauri v2 | — |
| Build | Vite + Bun | — |
| MCP server | @open-pencil/mcp (Hono, 87 outils) | +5 outils Verso |
| CLI | @open-pencil/cli (citty) | — |
| Design Context | — | **@verso/design-context** |
| Format .design | — | **@verso/format** (+ converter) |
| Backend cloud | — | **Convex self-hosted** (Phase 8) |
| Paiement | — | **Stripe** (Phase 7) |
| Hébergement | — | **Coolify** (Phase 7) |
| Docs | — | **docs.verso.dev** (VitePress) |

## 2. Ce que Verso ajoute

### 2.1 Format .design (`packages/format/`)
- Types TypeScript complets (11 types de nœuds, variables, thèmes, designContext)
- Parser JSON → DesignDocument + Validator
- Serializer DesignDocument → JSON
- **Converter bidirectionnel** : scene graph OpenPencil ↔ format .design
- Fichiers d'exemple (.design)

### 2.2 Design Context Engine (`packages/design-context/`)
- **Couche 1** : 8 fichiers universels (principes, typographie, couleurs, spacing, layout, a11y, psychologie, composition)
- **Couche 2** : 15 patterns + 4 références + anti-patterns + color trends
- **Couche 3** : designContext du fichier .design (brand, style, audience, rules)
- **Couche 4** : 12 task templates (landing, dashboard, form, pricing, etc.)
- Classifier, Assembler (6 scopes), Validator WCAG

### 2.3 Outils MCP Verso (+5)
| Outil | Description |
|---|---|
| `get_design_context` | Assemble les 4 couches de contexte |
| `validate_design` | Vérifie contraste, spacing, touch targets, variables |
| `get_design_guidelines` | Retourne les principes universels (couche 1) |
| `suggest_structure` | Retourne l'arbre de rôles du task template |
| `save_as_design` | Exporte au format .design |

### 2.4 UI Verso (Phases 5)
- Panel Design Context (édition brand/style/audience/rules)
- Panel Validation (issues, auto-fix, indicateur qualité)
- Theme preview (light/dark switch)
- Splash screen + onboarding + settings Verso

### 2.5 Export code (Phase 6)
- React + Tailwind, HTML + CSS, CSS tokens, Tailwind config, JSON tokens

### 2.6 Infrastructure (Phases 7-10)
- Site marketing verso.dev (Stripe)
- Documentation docs.verso.dev (VitePress)
- Backend Convex (auth, licences, teams, templates)
- Extensions IDE (VS Code, Cursor)

## 3. Phases

Voir `ROADMAP.md` pour le détail complet.

| Phase | Semaines | Objectif |
|---|---|---|
| 1 | 1-2 | Fork, rebranding, exploration |
| 2 | 3-4 | Format .design + converter + intégration éditeur |
| 3 | 5-8 | Design Context Engine (4 couches, 39+ JSON) |
| 4 | 9-10 | Outils MCP Verso (+5) + prompts + tests |
| 5 | 11-13 | UI personnalisée (panels Verso) |
| 6 | 14-15 | Export code avancé |
| 7 | 16-18 | Site marketing + docs + npm publish + v0.1.0 |
| 8 | 19-21 | Convex backend + auth + licences |
| 9 | 22-24 | Team tier + design systems partagés |
| 10 | 25-27 | Extensions IDE (VS Code + Cursor) |

## 4. Business model

| Plan | Prix | Features |
|---|---|---|
| Community | Gratuit | Éditeur complet, MCP, export, collaboration P2P |
| Pro | 15€/mois | Cloud templates, priority support, advanced export |
| Team | 45€/user/mois | Shared design systems, sync temps réel, billing par siège |
