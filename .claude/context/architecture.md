# Architecture — Verso

## Stack technique

### Frontend
- **Framework** : React 19 + Vite 6
- **Canvas** : PixiJS 8 (WebGL, rendu impératif — pas de JSX pour le canvas)
- **Style** : CSS Modules (panels UI) + CSS Variables (thème)
- **State** : Zustand 5 + Immer 10
- **Desktop** : Tauri 2

### Communication IA
- **Protocole** : MCP (Model Context Protocol) via stdio
- **IPC** : WebSocket entre MCP server et app web
- **SDK** : @modelcontextprotocol/sdk

### Infrastructure
- **CI/CD** : GitHub Actions (lint + types + tests)
- **Déploiement** : Coolify self-hosted (Phase 4+ — verso.dev, docs.verso.dev)
- **Licence** : AGPL-3.0

## Structure du projet

```
verso/                              Monorepo pnpm
├── apps/
│   ├── web/                        App principale (Vite + React)
│   │   └── src/
│   │       ├── canvas/             Moteur canvas PixiJS (stage, grille, nodes, tools)
│   │       ├── panels/             Panels UI (sidebar, inspector, topbar, shared)
│   │       ├── document/           Document model (store, history, persistence)
│   │       ├── export/             Export code (React/Tailwind, HTML/CSS, tokens)
│   │       ├── hooks/              Hooks globaux (useDocument, useTheme, useWebSocket)
│   │       ├── lib/                Utilitaires (id, colors, math, constants)
│   │       └── styles/             CSS global, thème, animations
│   └── docs/                       Documentation (Nextra)
├── packages/
│   ├── format/                     Format .design (schema, parser, serializer, validator)
│   ├── mcp-server/                 Serveur MCP (17 tools, resources, prompts, bridge WebSocket)
│   └── design-context/             Design Context Engine (4 couches)
│       ├── universal/              Couche 1 : principes de design universels (8 fichiers)
│       ├── trends/                 Couche 2 : patterns et tendances UI (15+ fichiers)
│       └── task-templates/         Couche 4 : templates par type de tâche (12 fichiers)
├── design-kits/                    Kits de design pré-faits
├── examples/                       Fichiers .design d'exemple
└── .github/workflows/              CI/CD
```

### Description des dossiers clés

| Dossier | Rôle |
|---------|------|
| `apps/web/src/canvas/` | Moteur de rendu PixiJS : stage, grille, nodes (Frame, Text, Rect...), outils (sélection, drag, zoom) |
| `apps/web/src/panels/` | Interface utilisateur : sidebar (layers, assets), inspector (propriétés, fill, typo), topbar |
| `apps/web/src/document/` | Modèle de document Zustand : CRUD nodes, undo/redo, persistance fichier .design |
| `packages/format/` | Spécification du format .design : types TS, parsing JSON, validation, migrations |
| `packages/mcp-server/` | Serveur MCP pour les IDE AI : batch_design, get_design_context, validate_design... |
| `packages/design-context/` | Moteur de contexte de design à 4 couches : principes → tendances → projet → tâche |

## Patterns d'architecture

### Monorepo pnpm avec packages isolés

Chaque package a sa propre responsabilité et ses propres tests. La communication se fait par imports directs (workspace protocol) et WebSocket IPC (MCP ↔ app).

### Flux de données

```
IDE AI (Claude Code, Cursor)
    ↓ MCP Protocol (stdio)
MCP Server (@verso/mcp-server)
    ↓ WebSocket IPC
App Web (apps/web)
    ↓ Zustand Store
Canvas PixiJS + Panels UI
    ↓ Persistence
Fichier .design (sur disque)
```

### Store-based architecture (Zustand + Immer)

L'état global est dans des stores Zustand avec mutations Immer. Pas de useState pour l'état partagé.

```
document/store.ts      → CRUD nodes, variables, thèmes
document/history.ts    → Undo/redo (groupes d'opérations)
selection-store.ts     → Sélection courante (single, multi)
```

## Dépendances clés

| Package | Version | Usage |
|---------|---------|-------|
| `react` | ^19.x | Framework UI |
| `pixi.js` | ^8.x | Rendu canvas WebGL |
| `zustand` | ^5.x | State management |
| `immer` | ^10.x | Mutations immutables |
| `@modelcontextprotocol/sdk` | latest | Protocole MCP |
| `zod` | ^3.25 | Validation de schémas |
| `ws` | ^8.x | WebSocket IPC |
| `@tauri-apps/api` | ^2.x | API desktop Tauri |
| `lucide-react` | ^0.400+ | Icônes UI |
| `hotkeys-js` | ^3.x | Raccourcis clavier |
| `nanoid` | ^5.x | Génération d'IDs |
| `vite` | ^6.x | Build tool |
| `vitest` | latest | Tests unitaires |

## Décisions architecturales

Voir `.claude/context/constraints.md` pour le decision log complet.
