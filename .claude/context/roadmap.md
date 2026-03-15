# Roadmap — Verso

## Vue d'ensemble

Verso est en phase de démarrage (greenfield). L'objectif immédiat est de construire les fondations : le format .design, le canvas PixiJS, et le document store. La valeur différenciante (Design Context Engine) arrive en Phase 2.

## Prochaines priorités

### P0 — Critique (Phase 1)
- [ ] Init monorepo pnpm + config TypeScript/ESLint/Prettier
- [ ] Package `@verso/format` : types, parser, serializer, validator
- [ ] Fichier exemple `hello-world.design`
- [ ] App React + Vite avec canvas PixiJS (stage, grille, zoom/pan)
- [ ] Renderer de base (FrameNode, TextNode, RectangleNode)
- [ ] Document store Zustand (CRUD, undo/redo, sélection)
- [ ] Persistance fichier .design (load/save)
- [ ] Panels UI complets (sidebar, inspector, topbar, composants shared)
- [ ] Thème éditeur distinctif avec `/frontend-design`

### P0 — Critique (Phase 2)
- [ ] Package `@verso/mcp-server` : bridge WebSocket, CLI, tools de base
- [ ] Package `@verso/design-context` : 4 couches de contexte + assembleur
- [ ] Intégration MCP ↔ app via WebSocket IPC

### P1 — Important (Phase 3)
- [ ] Export code (React+Tailwind, HTML/CSS, tokens)
- [ ] Nodes avancés (Ellipse, Path, Icon, Ref, Group)
- [ ] Layout engine complet (flex)
- [ ] Outils canvas (création par click-drag)
- [ ] Documentation Nextra (8+ pages)

### P2 — Nice-to-have (Phase 4-5)
- [ ] Site marketing verso.dev (Coolify)
- [ ] Publication npm
- [ ] Lancement Product Hunt + Hacker News
- [ ] Convex self-hosted (Phase 5)
- [ ] Team tier avec collaboration temps réel

## Epics

### Epic 1 — Fondations (Phase 1)
Construction du socle technique : format de fichier, canvas, store, UI.
**Features associées** :
- Format .design (planifié)
- Canvas PixiJS (planifié)
- Document store (planifié)
- Panels UI (planifié)

### Epic 2 — Intelligence IA (Phase 2)
Le cœur de la valeur : MCP Server + Design Context Engine.
**Features associées** :
- MCP Server 17 tools (planifié)
- Design Context Engine 4 couches (planifié)
- Validation de design (planifié)

### Epic 3 — Production (Phase 3)
Polissage pour un produit utilisable : export, nodes avancés, outils.
**Features associées** :
- Export code (planifié)
- Nodes avancés (planifié)
- Layout engine (planifié)

### Epic 4 — Lancement (Phase 4)
Mise sur le marché : site, docs, npm, marketing.
**Features associées** :
- Site verso.dev (planifié)
- Docs (planifié)
- npm publish (planifié)

### Epic 5 — Cloud (Phase 5)
Collaboration et monétisation : Convex, auth, teams.
**Features associées** :
- Convex self-hosted (planifié)
- Team tier (planifié)
- Galerie templates (planifié)

## Historique

| Date | Événement |
|------|-----------|
| 2026-03-15 | Projet initié, PROJET.md rédigé |

## Définitions

- **P0** : Critique / bloquant — à faire en premier
- **P1** : Important — nécessaire pour le prochain milestone
- **P2** : Nice-to-have — quand il y a du temps
