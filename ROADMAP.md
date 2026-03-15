# ROADMAP.md — Verso : Plan d'exécution complet (fork OpenPencil)

> **Verso est un fork d'OpenPencil** (MIT license) auquel on ajoute le Design Context Engine,
> le format .design, la validation design, le branding Verso, et l'infrastructure cloud (Convex + Coolify).
>
> OpenPencil fournit : éditeur canvas (CanvasKit/Skia), layout (Yoga WASM), scene graph,
> import/export .fig, MCP server (87 outils), CLI headless, collaboration P2P, Tauri v2 desktop.
>
> Verso ajoute : Design Context Engine (4 couches), format .design natif, validate_design,
> get_design_context, UI rebrandée, site marketing, Convex backend, Team tier, extensions IDE.

---

## Vue d'ensemble

```
Phase 1  ─ Fork, Rebranding & Exploration      Semaines 1-2     ██░░░░░░░░░░
Phase 2  ─ Format .design & Interopérabilité    Semaines 3-4     ███░░░░░░░░░
Phase 3  ─ Design Context Engine                Semaines 5-8     █████░░░░░░░
Phase 4  ─ Outils MCP Verso (contexte + valid.) Semaines 9-10    ██████░░░░░░
Phase 5  ─ UI Personnalisée & Panels Verso      Semaines 11-13   ████████░░░░
Phase 6  ─ Export Code Avancé                   Semaines 14-15   █████████░░░
Phase 7  ─ Site Marketing & Docs (Coolify)      Semaines 16-18   ██████████░░
Phase 8  ─ Convex Backend & Auth                Semaines 19-21   ██████████░░
Phase 9  ─ Team Tier & Collaboration Verso      Semaines 22-24   ███████████░
Phase 10 ─ Extensions IDE (VS Code / Cursor)    Semaines 25-27   ████████████
```

**Durée totale estimée** : 27 semaines (~7 mois) — réduit de 40 à 27 grâce au fork
**Jalons clés** :
- Fin Phase 1 (sem. 2) : fork fonctionnel, rebrandé Verso, qui compile et tourne
- Fin Phase 4 (sem. 10) : l'IA produit des designs de qualité pro via le Design Context Engine
- Fin Phase 7 (sem. 18) : produit lançable publiquement (verso.dev en ligne)
- Fin Phase 10 (sem. 27) : produit complet avec extensions IDE

---

## Ce qu'OpenPencil fournit déjà (NE PAS recoder)

| Feature | Tech | Status |
|---|---|---|
| Moteur de rendu canvas | CanvasKit (Skia WASM) — WebGL | Fonctionnel |
| Layout engine | Yoga WASM (flex + CSS grid) | Fonctionnel |
| Scene graph + undo/redo | @open-pencil/core | Fonctionnel |
| Import/export .fig (Figma) | Kiwi binary codec | Fonctionnel |
| Serveur MCP | 87 outils, stdio + HTTP (Hono) | Fonctionnel |
| CLI headless | info, tree, find, export, analyze | Fonctionnel |
| Collaboration P2P | WebRTC via Trystero, curseurs, follow mode | Fonctionnel |
| Desktop app | Tauri v2 (macOS, Windows, Linux) — ~7 Mo | Fonctionnel |
| Web app | Tourne dans le navigateur (PWA) | Fonctionnel |
| Drawing tools | Formes, pen tool, texte, auto-layout, composants, variables | Fonctionnel |
| AI chat intégré | 87 outils IA, multi-provider (Anthropic, OpenAI, Google, OpenRouter) | Fonctionnel |
| Tests | 188 E2E (Playwright) + 764 unitaires | Fonctionnel |

**RÈGLE** : ne pas modifier le core engine sauf si absolument nécessaire. Ajouter par-dessus, pas remplacer.

---

## Stack technique (héritée d'OpenPencil + ajouts Verso)

| Composant | Tech (OpenPencil) | Ajout Verso |
|---|---|---|
| Framework | Vue 3 + Composition API | — (on garde Vue) |
| Canvas | CanvasKit (Skia WASM) | — |
| Layout | Yoga WASM | — |
| State | Vue reactivity (stores/) | — |
| Desktop | Tauri v2 | — |
| Build | Vite + Bun | — |
| MCP server | @open-pencil/mcp (Hono) | + outils Verso (context, validate) |
| CLI | @open-pencil/cli (citty) | — |
| Design Context | — | **@verso/design-context** (NOUVEAU) |
| Format .design | — | **@verso/format** (NOUVEAU) |
| Backend cloud | — | **Convex self-hosted** (Phase 8) |
| Paiement | — | **Stripe** (Phase 7) |
| Hébergement | — | **Coolify** (Phase 7) |
| Docs | openpencil.dev (Mintlify) | **docs.verso.dev** (VitePress ou Nextra) |

---

## Instructions pour Claude Code

Avant chaque phase :
1. **Lire PROJET.md** en entier
2. **Lire le skill `/frontend-design`** AVANT tout composant UI
3. **Lire le AGENTS.md d'OpenPencil** dans le repo forké — il contient les conventions du projet
4. **Ne coder QUE la phase en cours**
5. **Respecter les conventions OpenPencil** : Bun, oxfmt, Bun test, Vue 3 Composition API
6. **Commiter régulièrement** : conventional commits

---

# PHASE 1 — Fork, Rebranding & Exploration
**Semaines 1-2 | Priorité : CRITIQUE**
**Objectif : le fork fonctionne sous le nom Verso, tu comprends la codebase.**

## Semaine 1 : Fork et setup

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 1.1 | Fork OpenPencil | `git clone https://github.com/open-pencil/open-pencil.git verso && cd verso` | Repo cloné |
| 1.2 | Changer le remote | `git remote set-url origin <ton-repo-github>` + nouveau remote `upstream` vers open-pencil | Remotes configurés |
| 1.3 | Installer et lancer | `bun install && bun run dev` — vérifier que l'éditeur tourne dans le navigateur | App visible à localhost:1420 |
| 1.4 | Lancer le desktop | `bun run tauri dev` — vérifier que l'app Tauri fonctionne | App desktop ouverte |
| 1.5 | Lancer les tests | `bun test ./tests/engine` (unitaires) + `bun run test` (E2E) | Tests passent |
| 1.6 | Lire le AGENTS.md | Comprendre : structure monorepo, conventions, architecture core/cli/mcp | Notes prises |
| 1.7 | Lire plan.md | Roadmap d'OpenPencil, comprendre les phases et le tech stack | Notes prises |
| 1.8 | Explorer src/ | Comprendre : composants Vue (src/components/), stores (src/stores/), composables (src/composables/), engine shims (src/engine/) | Cartographie mentale de la codebase |
| 1.9 | Explorer packages/core/ | Comprendre : scene graph, renderer CanvasKit, layout Yoga, codec .fig | Savoir où toucher / ne pas toucher |
| 1.10 | Explorer packages/mcp/ | Comprendre : les 87 outils, le factory createServer(), les transports | Savoir comment ajouter des outils |

**Commit** : `chore: fork open-pencil as verso`

## Semaine 2 : Rebranding Verso

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 2.1 | Renommer dans package.json | Root + tous les packages : name → `verso`, `@verso/core`, `@verso/cli`, `@verso/mcp` | Noms mis à jour |
| 2.2 | Renommer dans tauri.conf.json | productName → "Verso", identifier → "dev.verso.app" | Config Tauri mise à jour |
| 2.3 | **Lire `/frontend-design` SKILL** | OBLIGATOIRE avant les étapes suivantes | — |
| 2.4 | Nouveau logo + icônes | Créer un logo Verso distinctif (SVG). Favicon, icône Tauri (icns/ico/png). | Logo visible dans l'app |
| 2.5 | Palette de couleurs Verso | Choisir l'accent color et les surfaces de l'éditeur via `/frontend-design`. Modifier les CSS variables dans le thème existant. | Thème Verso appliqué |
| 2.6 | Splash screen / About | Mettre à jour le splash screen et le "About" avec le branding Verso. | Branding cohérent |
| 2.7 | Mettre à jour le README.md | Nouveau README Verso : description, screenshot, installation, contribution. Mention claire que c'est un fork d'OpenPencil (MIT). | README complet |
| 2.8 | LICENSE | Garder MIT (hérité d'OpenPencil). Ajouter un fichier NOTICE pour créditer OpenPencil. | License correcte |
| 2.9 | Git history propre | Squash ou tag le point de fork. Premier commit Verso clean. | Historique clair |
| 2.10 | Vérifier que tout compile | `bun run check` (lint + typecheck) + `bun run dev` + `bun run tauri dev` | Tout fonctionne sous le nom Verso |

**Commit** : `feat: rebrand to Verso with new logo, theme, and identity`

### Checkpoint Phase 1

- [ ] Le repo est forké et push sur ton GitHub
- [ ] L'app compile et tourne (web + desktop) sous le nom Verso
- [ ] Le branding est appliqué (logo, couleurs, about)
- [ ] Tu comprends la structure du code source
- [ ] Les tests existants passent toujours

---

# PHASE 2 — Format .design & Interopérabilité
**Semaines 3-4 | Priorité : HAUTE**
**Objectif : Verso supporte un format .design natif en plus du .fig, avec les types complets et le designContext intégré.**

## Semaine 3 : Package @verso/format

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 3.1 | Créer `packages/format/` | Nouveau package dans le monorepo : package.json, tsconfig.json | Package compile |
| 3.2 | `schema.ts` | Tous les types TypeScript du format .design (voir PROJET.md section 4). Inclut les 11 types de nœuds, variables, thèmes, ProjectDesignContext. | Types complets, pas de `any` |
| 3.3 | `parser.ts` | Parse JSON → DesignDocument avec validation Zod | Parse les exemples correctement |
| 3.4 | `serializer.ts` | DesignDocument → JSON formatté (2 espaces, clés ordonnées) | Roundtrip correct |
| 3.5 | `validator.ts` | Validation : IDs uniques, refs valides, variables référencées existent | Erreurs détectées |
| 3.6 | `defaults.ts` | Valeurs par défaut pour chaque type de nœud | Defaults sensibles |
| 3.7 | `converter.ts` | **Conversion bidirectionnelle** entre le scene graph OpenPencil (format interne) et le format .design. C'est le pont entre les deux mondes. Mappe les types OpenPencil (FRAME, TEXT, RECTANGLE, etc.) vers les types .design (frame, text, rectangle, etc.) et inversement. | Conversion correcte dans les deux sens |
| 3.8 | Tests complets | Parser, serializer, validator, converter — tous testés | > 90% couverture |

**Commit** : `feat(format): @verso/format package with .design schema and converter`

## Semaine 4 : Intégration dans l'éditeur

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 4.1 | File dialog : ouvrir .design | Modifier le file dialog existant pour accepter .fig ET .design. Quand un .design est ouvert : parser → converter → scene graph OpenPencil → rendu normal. | Ouvrir un .design fonctionne |
| 4.2 | File dialog : sauvegarder en .design | "Save As .design" : scene graph OpenPencil → converter → serializer → fichier disque. | Sauvegarder en .design fonctionne |
| 4.3 | Auto-detect format | L'app détecte automatiquement le format (.fig ou .design) à l'ouverture et utilise le bon codec. | Détection automatique |
| 4.4 | designContext dans l'UI | Ajouter un panel ou une section dans les settings pour éditer le `designContext` du fichier .design (brand, style, audience, references, rules). Pas de UI pour les .fig (pas de designContext). | Panel fonctionnel |
| 4.5 | Créer les fichiers d'exemple | `examples/hello-world.design`, `examples/landing-page.design`, `examples/dashboard.design`, `examples/design-system.design` | 4 fichiers valides |
| 4.6 | Roundtrip test | Ouvrir un .fig → sauvegarder en .design → réouvrir le .design → vérifier que le rendu est identique | Roundtrip visuel correct |

**Commit** : `feat: .design format support with open/save and bidirectional conversion`

### Checkpoint Phase 2

- [ ] Le format .design est spécifié, parsé, sérialisé, validé
- [ ] La conversion bidirectionnelle .fig ↔ .design fonctionne
- [ ] L'éditeur ouvre et sauvegarde les deux formats
- [ ] Le designContext est éditable via l'UI
- [ ] 4 fichiers d'exemple créés

---

# PHASE 3 — Design Context Engine
**Semaines 5-8 | Priorité : CRITIQUE — c'est la valeur de Verso**
**Objectif : les 4 couches de contexte sont implémentées avec 39+ fichiers JSON de contenu expert.**

## Semaine 5 : Package + Couche 1 (principes universels)

| # | Tâche | Fichier | Validation |
|---|---|---|---|
| 5.1 | Créer `packages/design-context/` | package.json, tsconfig — dépend de @verso/format | Compile |
| 5.2 | `classifier.ts` | Classifie une description en 12+ types de tâches (landing-hero, dashboard, form-auth, pricing, settings, empty-state, data-table, navigation, modal-dialog, card-component, profile-page, onboarding, generic) | Classification correcte |
| 5.3 | `assembler.ts` | Fusionne les 4 couches en `AssembledContext`. Filtre par scope (full, typography, colors, spacing, components, accessibility). Summary en langage naturel. | Assemblage correct |
| 5.4 | 8 fichiers universels | `universal/principles.json` (hiérarchie visuelle, Gestalt, charge cognitive), `typography.json`, `color-theory.json`, `spacing.json`, `layout-patterns.json`, `accessibility.json`, `psychology.json`, `composition.json` — chacun 5-10 règles détaillées avec name, description, application, example, anti_pattern | 8 fichiers riches |

**Commit** : `feat(context): package setup, classifier, assembler, layer 1 (8 files)`

## Semaine 6 : Couche 2 (tendances et patterns)

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 6.1 | 15 fichiers de patterns | `trends/patterns/` : bento-grid, glassmorphism, oversized-typography, sidebar-collapsible, command-palette, skeleton-loading, toast-notifications, empty-states, sticky-headers, bottom-navigation, card-hover-effects, gradient-mesh, split-screen-layout, floating-action-button, dark-mode-patterns | 15 fichiers complets |
| 6.2 | 4 fichiers de références | `trends/references/` : saas-dashboard.json (Linear, PostHog, Vercel, Notion, Raycast), landing-pages.json (Stripe, Lemon Squeezy, Arc, Resend), e-commerce.json (Apple Store, SSENSE, Aesop), mobile-apps.json (Arc Mobile, Things 3, Duolingo) | 4 fichiers, 3-5 sites analysés chacun |
| 6.3 | Anti-patterns + color trends | `trends/anti-patterns.json` (10 anti-patterns), `trends/color-trends.json` (5 palettes 2025-2026) | 2 fichiers complets |

**Commit** : `feat(context): layer 2 — 15 patterns, 4 references, anti-patterns, color trends`

## Semaine 7 : Couche 4 (task templates)

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 7.1 | 12 task templates | `task-templates/` : landing-hero, dashboard, form-auth, pricing, settings, empty-state, data-table, navigation, modal-dialog, card-component, profile-page, onboarding. Chacun contient : guidelines (5-8), suggestedStructure (arbre de rôles), colorGuidance (4-6), typographyGuidance (4-6), spacingGuidance (4-6), commonMistakes (4-6), qualityChecklist (5-8) | 12 fichiers complets |

**Commit** : `feat(context): layer 4 — 12 task template files`

## Semaine 8 : Validation design + tests

| # | Tâche | Fichier | Validation |
|---|---|---|---|
| 8.1 | `validator.ts` | Checks : contrastRatio (WCAG AA 4.5:1 / 3:1), spacingCheck (multiples de 8), touchTargetCheck (44px min), variableUsageCheck (couleurs hardcodées), typographyCheck (max 3 niveaux), alignmentCheck (snap-to-grid) | Chaque check fonctionne |
| 8.2 | Tests assembler | Assemblage 4 couches, filtrage par scope, summary, task context par type | > 90% couverture |
| 8.3 | Tests classifier | Chaque type classifié correctement, edge cases | 12+ types testés |
| 8.4 | Tests validator | Chaque check testé indépendamment | Tous les checks testés |
| 8.5 | Test intégration | Assembler un contexte complet avec les 4 couches pour une landing page, vérifier la qualité du contenu retourné | Contexte riche et pertinent |

**Commit** : `feat(context): validator and comprehensive test suite`

### Checkpoint Phase 3

- [ ] Assembler fusionne 4 couches correctement
- [ ] 8 fichiers universels (couche 1)
- [ ] 21 fichiers tendances (couche 2)
- [ ] 12 task templates (couche 4)
- [ ] Validator vérifie contraste, espacement, touch targets, variables, typographie
- [ ] Tests > 90% couverture sur le package

---

# PHASE 4 — Outils MCP Verso (contexte + validation)
**Semaines 9-10 | Priorité : HAUTE**
**Objectif : les outils MCP spécifiques à Verso sont ajoutés au serveur MCP existant d'OpenPencil.**

OpenPencil a déjà 87 outils MCP. Verso en ajoute de nouveaux, spécifiques au Design Context Engine.

## Semaine 9 : Nouveaux outils MCP

| # | Outil | Fichier | Description |
|---|---|---|---|
| 9.1 | `get_design_context` | `packages/mcp/src/tools/get-design-context.ts` | Params : `scope` (full, typography, colors, spacing, components, accessibility), `taskDescription?`. Appelle l'assembler du @verso/design-context. Retourne le contexte assemblé des 4 couches. Lit le designContext du fichier .design ouvert comme couche 3. | 
| 9.2 | `validate_design` | `packages/mcp/src/tools/validate-design.ts` | Params : `nodeId?`, `checks?` (contrast, spacing, typography, touch_targets, variables, alignment). Appelle le validator. Retourne les issues avec severity (critical/warning/info) et suggestions de fix. |
| 9.3 | `get_design_guidelines` | `packages/mcp/src/tools/get-design-guidelines.ts` | Retourne uniquement les principes universels (couche 1) comme référence rapide. |
| 9.4 | `suggest_structure` | `packages/mcp/src/tools/suggest-structure.ts` | Params : `taskDescription`. Retourne le `suggestedStructure` du task template correspondant — un arbre de rôles que l'IA peut suivre pour créer la page. |
| 9.5 | `save_as_design` | `packages/mcp/src/tools/save-as-design.ts` | Exporte le document actuel au format .design. Utile quand l'IA travaille sur un .fig et veut sauvegarder en .design avec le designContext. |
| 9.6 | Enregistrer les outils | Modifier `packages/mcp/src/index.ts` pour ajouter les nouveaux outils au createServer() | Les outils apparaissent dans le MCP |

**Commit** : `feat(mcp): Verso-specific tools (get_design_context, validate_design, suggest_structure)`

## Semaine 10 : Prompts MCP + test end-to-end

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 10.1 | Prompt `design-page` | Workflow guidé en 10 étapes (get_design_context → batch_design → screenshot → validate → fix → screenshot final). Params : pageType, description. | Prompt fonctionnel |
| 10.2 | Prompt `design-system` | Crée un design system complet : variables + composants de base. Params : brandName, primaryColor, style. | Prompt fonctionnel |
| 10.3 | Prompt `refine-design` | Améliore un design existant basé sur le feedback utilisateur. Params : nodeId, feedback. | Prompt fonctionnel |
| 10.4 | Resource `design://guidelines` | Resource MCP qui expose les guidelines universelles en lecture. | Resource accessible |
| 10.5 | Tests MCP | Tester chaque nouvel outil via MCP Inspector. | Tous les outils fonctionnent |
| 10.6 | Test E2E Claude Code | Créer un design complet via Claude Code en utilisant get_design_context → outils existants → validate_design. Vérifier que la qualité du design est significativement meilleure avec le contexte. | Workflow complet fonctionne |
| 10.7 | Descriptions des outils | Vérifier que les descriptions (ce que l'IA lit) sont claires et instructives — voir PROJET.md section 6.1 pour les textes exacts. | Descriptions copiées |

**Commit** : `feat(mcp): Verso prompts, resources, and end-to-end validation`

### Checkpoint Phase 4

- [ ] 5 nouveaux outils MCP spécifiques à Verso
- [ ] 3 prompts MCP avec workflows guidés
- [ ] 1 resource MCP (guidelines)
- [ ] Testé avec MCP Inspector ET Claude Code
- [ ] La qualité du design avec contexte est visiblement supérieure

---

# PHASE 5 — UI Personnalisée & Panels Verso
**Semaines 11-13 | Priorité : MOYENNE**
**Objectif : l'UI de l'éditeur est personnalisée pour Verso avec des panels spécifiques.**

**RAPPEL** : Lire `/frontend-design` SKILL avant chaque composant UI.

## Semaine 11 : Design Context panel

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 11.1 | Panel "Design Context" | Nouveau panel dans la sidebar (tab ou section). Affiche le designContext du fichier .design : brand, style, audience, references, rules. Éditable directement. | Panel fonctionnel |
| 11.2 | Brand section | Inputs : brand name, personality (tags), tone (textarea), industry (select). | Éditable |
| 11.3 | Style section | Selects : aesthetic, colorApproach, typographyStyle, density, borderRadius, shadowStyle, iconStyle. | Éditable |
| 11.4 | Audience section | Inputs : primary audience, technical level, context, accessibility priority. | Éditable |
| 11.5 | References section | Lists : aspirational sites (ajout/suppression), sites à éviter, notes spécifiques. | Éditable |
| 11.6 | Rules section | Liste de règles custom (ajout/suppression/réordonnement). | Éditable |

**Commit** : `feat(ui): design context panel with brand, style, audience, references, rules`

## Semaine 12 : Validation panel + Theme preview

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 12.1 | Panel "Validation" | Bouton "Validate Design" qui lance validate_design. Affiche les résultats : issues groupées par severity (critical en rouge, warning en orange, info en bleu). Click sur une issue → sélectionne le nœud concerné sur le canvas. Bouton "Auto-fix" pour les issues simples (ex: arrondir un spacing au multiple de 8 le plus proche). | Panel fonctionnel |
| 12.2 | Indicateur de qualité | Badge dans la topbar : nombre d'issues critiques. Vert si 0, rouge sinon. Click → ouvre le panel validation. | Indicateur visible |
| 12.3 | Theme preview | Bouton dans le canvas ou la topbar pour switcher le thème actif du design (light/dark). Le canvas rend les nœuds avec les variables du thème choisi. Pas de modification du document — juste un preview. | Preview fonctionne |
| 12.4 | Variables panel amélioré | Améliorer le panel de variables existant d'OpenPencil : ajouter le support du designContext (suggestion de variables basées sur le contexte du projet). | Panel amélioré |

**Commit** : `feat(ui): validation panel, quality indicator, theme preview`

## Semaine 13 : Polish UI Verso

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 13.1 | Refonte visuelle des panels | Appliquer le thème Verso (couleurs, fonts, spacing) à tous les panels existants d'OpenPencil. Utiliser `/frontend-design` pour un rendu distinctif. | Cohérence visuelle |
| 13.2 | Splash screen Verso | Écran de démarrage avec le logo Verso, "New Design" + "Open File" + fichiers récents. | Splash fonctionnel |
| 13.3 | Onboarding first-launch | Premier lancement : mini-tutoriel (3-4 étapes) expliquant ce qu'est Verso et comment utiliser le Design Context. | Tutoriel clair |
| 13.4 | Raccourci "Validate" | Cmd+Shift+V = lancer la validation. Résultat affiché dans le panel. | Raccourci fonctionne |
| 13.5 | Menu "Verso" | Ajouter un menu ou section spécifique à Verso : "Design Context", "Validate Design", "Export as .design", "Verso Settings". | Menu fonctionnel |
| 13.6 | Settings Verso | Page de settings : clé API (pour les providers IA), licence Pro/Team, préférences d'export, grille (8px configurable). | Settings fonctionnelles |

**Commit** : `feat(ui): Verso visual polish, splash screen, onboarding, settings`

### Checkpoint Phase 5

- [ ] Panel Design Context pour éditer le designContext
- [ ] Panel Validation avec issues, auto-fix, et indicateur de qualité
- [ ] Theme preview (light/dark switch)
- [ ] Branding Verso cohérent sur tous les panels
- [ ] Splash screen + onboarding + settings

---

# PHASE 6 — Export Code Avancé
**Semaines 14-15 | Priorité : MOYENNE**
**Objectif : le design peut être exporté en React/Tailwind, HTML/CSS, et les tokens en CSS/Tailwind.**

OpenPencil a déjà un export Tailwind CSS basique. Verso l'étend.

## Semaine 14-15 : Générateurs de code

| # | Tâche | Détail | Validation |
|---|---|---|---|
| 14.1 | Export React + Tailwind | Transformer l'arbre de nœuds en JSX + classes Tailwind. Composants reusable → fichiers séparés. Variables → CSS custom properties. | Code React compilable |
| 14.2 | Export HTML + CSS | HTML sémantique + CSS vanilla. | HTML valide |
| 14.3 | Export CSS custom properties | Variables → `:root { --color-primary: ... }`. Gère les thèmes (prefers-color-scheme ou .dark). | CSS valide |
| 14.4 | Export Tailwind config | Variables → `tailwind.config.js` : extend colors, spacing, radius, fontSize. | Config valide |
| 14.5 | Export JSON tokens | Variables → JSON standard (compatible Style Dictionary, Tokens Studio). | JSON valide |
| 14.6 | `export_to_code` MCP tool | Outil MCP qui appelle les générateurs. Params : nodeId?, format, includeTokens?. | Outil fonctionnel |
| 14.7 | `export_tokens` MCP tool | Outil MCP qui exporte les tokens. Params : format (css, tailwind, json). | Outil fonctionnel |
| 14.8 | Export dialog UI | Modifier le dialog existant pour ajouter les nouveaux formats. Preview du code. Bouton "Copy to clipboard". | Dialog fonctionnel |

**Commit** : `feat(export): React+Tailwind, HTML/CSS, CSS/Tailwind/JSON tokens`

### Checkpoint Phase 6

- [ ] Export React + Tailwind génère du code compilable
- [ ] Export HTML/CSS génère du HTML valide
- [ ] Tokens exportés en 3 formats
- [ ] Outils MCP fonctionnels
- [ ] Dialog d'export dans l'UI

---

# PHASE 7 — Site Marketing & Docs (Coolify)
**Semaines 16-18 | Priorité : HAUTE**
**Objectif : verso.dev et docs.verso.dev sont en ligne. Le produit est lançable.**

**RAPPEL** : Utiliser `/frontend-design` pour le site marketing.

## Semaine 16-17 : Site marketing

| # | Tâche | Validation |
|---|---|---|
| 16.1 | Créer `apps/site/` (Nuxt ou Next.js) | `bun run dev` lance le site |
| 16.2 | **Lire `/frontend-design`** | OBLIGATOIRE |
| 16.3 | Hero section | Heading, subheading, CTA, vidéo/animation du produit |
| 16.4 | Features section | 6 features : Design Context Engine, MCP 87+ outils, Format .design, Validate Design, Import Figma, Desktop + Web |
| 16.5 | How it works | 3 étapes : Décris → L'IA design → Exporte le code |
| 16.6 | Before/After | Comparaison visuelle : design sans contexte vs avec Verso |
| 16.7 | Pricing | 3 plans : Community (gratuit), Pro (15€/mois), Team (45€/user/mois) |
| 16.8 | Footer + links | GitHub, Discord, Twitter, docs |
| 16.9 | Intégration Stripe | Boutons Subscribe → Stripe Checkout. Webhooks pour confirmation. |
| 16.10 | Déploiement Coolify | `coolify/docker-compose.site.yml`. verso.dev configuré. HTTPS. CI/CD. |

## Semaine 18 : Documentation + npm publish

| # | Tâche | Validation |
|---|---|---|
| 18.1 | Créer `apps/docs/` (VitePress) | `bun run dev` lance les docs |
| 18.2 | Getting Started (3 pages) | Installation, First Design, AI Integration |
| 18.3 | Core Concepts (4 pages) | Design Files, Components, Variables, Design Context |
| 18.4 | For Developers (3 pages) | Format Spec, MCP Tools, CLI |
| 18.5 | Déploiement docs Coolify | docs.verso.dev configuré |
| 18.6 | Publier `@verso/mcp` sur npm | `npx verso-mcp` fonctionne |
| 18.7 | GitHub Release | Tag v0.1.0, release notes, binaires Tauri (macOS/Windows/Linux) |
| 18.8 | Lancement Product Hunt + HN | Même semaine. Assets préparés. |

**Commit** : `feat: verso.dev, docs.verso.dev, npm publish, and v0.1.0 release`

### Checkpoint Phase 7

- [ ] verso.dev en ligne avec Stripe
- [ ] docs.verso.dev en ligne (10 pages)
- [ ] @verso/mcp sur npm
- [ ] Binaires Tauri publiés
- [ ] Produit lançable publiquement

---

# PHASE 8 — Convex Backend & Auth
**Semaines 19-21 | Priorité : MOYENNE**
**Objectif : backend Convex self-hosted, auth, licences, galerie de templates.**

## Semaine 19-20 : Convex + Auth

| # | Tâche | Validation |
|---|---|---|
| 19.1 | Déployer Convex backend via Coolify | convex.verso.dev accessible |
| 19.2 | Configurer Postgres storage | Données persistées, backups |
| 19.3 | `convex/schema.ts` | Tables : users, teams, teamMembers, sharedDesignSystems, templates |
| 19.4 | Auth (email + GitHub + Google) | Inscription/connexion fonctionnelle |
| 19.5 | Pages auth sur verso.dev | Login, Register — design avec `/frontend-design` |
| 19.6 | Dashboard utilisateur | verso.dev/account : plan, factures, settings |

## Semaine 21 : Licences + Templates

| # | Tâche | Validation |
|---|---|---|
| 21.1 | Stripe webhooks → Convex | checkout.session.completed → activatePro |
| 21.2 | Vérification licence dans le MCP | Le MCP vérifie la licence. Fallback token local si offline. |
| 21.3 | `convex/templates.ts` | CRUD templates avec file storage |
| 21.4 | Galerie verso.dev/templates | Browse, search, preview, download |
| 21.5 | Upload de templates | Les utilisateurs Pro peuvent partager leurs designs |

**Commit** : `feat(backend): Convex auth, licenses, Stripe sync, template gallery`

---

# PHASE 9 — Team Tier & Collaboration Verso
**Semaines 22-24 | Priorité : MOYENNE**
**Objectif : les équipes partagent des design systems en temps réel via Convex.**

| Semaine | Tâche | Validation |
|---|---|---|
| 22 | Teams CRUD + invitations + billing par siège | Teams fonctionnelles |
| 23 | Shared Design Systems (sync temps réel via Convex subscriptions) | Variables et composants sync entre membres |
| 24 | UI équipe dans l'éditeur + résolution de conflits (OT basique) + tests | Collaboration stable |

**Commit** : `feat(teams): shared design systems with real-time sync`

---

# PHASE 10 — Extensions IDE (VS Code / Cursor)
**Semaines 25-27 | Priorité : MOYENNE**
**Objectif : Verso est disponible comme extension VS Code et Cursor.**

| Semaine | Tâche | Validation |
|---|---|---|
| 25-26 | Extension VS Code : webview panel avec l'éditeur Verso, file association .design, MCP auto-start, commandes (Open, New, Export, Validate), sidebar provider, status bar | Extension fonctionnelle |
| 26-27 | Adapter pour Cursor (compatibilité VS Code fork), tester l'intégration MCP native Cursor, publier sur VS Code Marketplace + Open VSX | Extensions publiées |

**Commit** : `feat(ide): VS Code and Cursor extensions`

---

## Récapitulatif : ce que Verso ajoute vs ce qu'OpenPencil fournit

| Feature | OpenPencil (hérité) | Verso (ajouté) |
|---|---|---|
| Moteur canvas (CanvasKit/Skia) | ✅ | — |
| Layout engine (Yoga WASM) | ✅ | — |
| Scene graph + undo/redo | ✅ | — |
| Import/export .fig | ✅ | — |
| MCP server (87 outils) | ✅ | +5 outils Verso |
| CLI headless | ✅ | — |
| Collaboration P2P | ✅ | — |
| Desktop Tauri v2 | ✅ | — |
| AI chat multi-provider | ✅ | — |
| 952 tests | ✅ | +tests Verso |
| **Format .design natif** | — | ✅ NOUVEAU |
| **Design Context Engine (4 couches)** | — | ✅ NOUVEAU |
| **Validation design** | — | ✅ NOUVEAU |
| **Branding + thème Verso** | — | ✅ NOUVEAU |
| **Site marketing verso.dev** | — | ✅ NOUVEAU |
| **Documentation docs.verso.dev** | — | ✅ NOUVEAU |
| **Convex backend (auth, teams)** | — | ✅ NOUVEAU |
| **Business model (free/pro/team)** | — | ✅ NOUVEAU |
| **Extensions IDE** | — | ✅ NOUVEAU |

---

## Comment donner ce fichier à Claude Code

```
Lis PROJET.md en entier.
Puis lis la PHASE [N] de ROADMAP.md.
Le repo est un fork d'OpenPencil — lis le AGENTS.md du repo pour les conventions.
Exécute chaque tâche dans l'ordre.
Ne modifie PAS le core engine (packages/core/) sauf si absolument nécessaire.
Ajoute par-dessus, ne remplace pas.
Commit après chaque sous-section.
```

---

> **Fin de ROADMAP.md — Verso (fork OpenPencil)**
> 10 phases, 27 semaines, du fork à l'extension IDE.
> Gain de 13 semaines grâce au fork (vs 40 semaines from scratch).
> Focus sur la VALEUR : Design Context Engine, format .design, validation, business.
