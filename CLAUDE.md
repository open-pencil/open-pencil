# Verso

> Fork d'OpenPencil — Éditeur de design vectoriel open-source, AI-first, avec un Design Context Engine à 4 couches.

## Quick Context

| Dimension | Valeur |
|-----------|--------|
| Type | Fork d'OpenPencil + Design Context Engine |
| Base | OpenPencil (MIT) — CanvasKit/Skia, Yoga WASM, Vue 3 |
| Frontend | Vue 3 + Composition API + Vite + Bun |
| Canvas | CanvasKit (Skia WASM) — WebGL |
| Layout | Yoga WASM (flex + CSS grid) |
| State | Vue reactivity (stores/) |
| Desktop | Tauri v2 |
| MCP | OpenPencil MCP (87 outils) + outils Verso (+5) |
| Packages Verso | @verso/format, @verso/design-context |
| Tests | Bun test (unit) + Playwright (E2E) |
| CI/CD | GitHub Actions |
| Licence | MIT (hérité d'OpenPencil) |

## Ce qu'OpenPencil fournit (NE PAS recoder)

- Moteur canvas CanvasKit (Skia WASM)
- Layout engine Yoga WASM
- Scene graph + undo/redo
- Import/export .fig (Figma)
- Serveur MCP (87 outils)
- CLI headless
- Collaboration P2P (WebRTC)
- Desktop Tauri v2
- Drawing tools, composants, variables, auto-layout
- AI chat multi-provider
- 952 tests existants

## Ce que Verso AJOUTE (notre code)

- `packages/format/` — Format .design natif + converter bidirectionnel
- `packages/design-context/` — Design Context Engine (4 couches, 39+ JSON)
- Outils MCP Verso (get_design_context, validate_design, suggest_structure, save_as_design, get_design_guidelines)
- Panels UI Verso (Design Context panel, Validation panel, Theme preview)
- Branding Verso (logo, thème, splash screen)
- Site marketing verso.dev + docs.verso.dev
- Backend Convex (auth, licences, templates, teams)
- Extensions IDE (VS Code, Cursor)

## Structure clé

```
verso/                            Fork d'OpenPencil
├── src/                          App Vue 3 (hérité d'OpenPencil)
│   ├── components/               Composants Vue
│   ├── stores/                   Stores Vue reactivity
│   ├── composables/              Composables Vue
│   └── engine/                   Engine shims
├── packages/core/                Scene graph, renderer, layout (NE PAS TOUCHER)
├── packages/mcp/                 Serveur MCP (87 outils + outils Verso)
├── packages/cli/                 CLI headless
├── packages/format/              Format .design (types, parser, converter) — VERSO
├── packages/design-context/      Design Context Engine — VERSO
├── apps/site/                    Site marketing (Phase 7)
├── apps/docs/                    Documentation (Phase 7)
├── convex/                       Backend Convex (Phase 8)
└── examples/                     Fichiers .design d'exemple
```

## Commandes

```bash
bun install           # Installer les dépendances
bun run dev           # Lancer l'app web en dev
bun run tauri dev     # Lancer l'app desktop
bun test              # Tests unitaires (Bun)
bun run test          # Tests E2E (Playwright)
bun run check         # Lint + typecheck
```

## Règles

1. **NE PAS modifier packages/core/** sauf si absolument nécessaire — ajouter par-dessus
2. **Respecter les conventions OpenPencil** : Bun, oxfmt, Vue 3 Composition API
3. TypeScript strict, zéro `any`
4. Lire le skill `/frontend-design` AVANT tout composant UI
5. Lire le `AGENTS.md` d'OpenPencil pour comprendre les conventions
6. Commiter en conventional commits
7. Tester : compile + types + tests passent
8. Ne pas toucher Convex avant Phase 8
9. Ne pas utiliser `rm` — utiliser `trash`

## Phase actuelle

**Phase 1 — Fork, Rebranding & Exploration** : fork OpenPencil, rebrander en Verso, comprendre la codebase.
Consulter `ROADMAP.md` pour le détail complet (10 phases, 27 semaines).
