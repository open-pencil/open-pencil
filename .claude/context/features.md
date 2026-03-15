# Features — Verso

## Catalogue des features

### Phase 1 — Fondations

| Feature | Statut | Module | Priorité | Notes |
|---------|--------|--------|----------|-------|
| Format .design (types, parser, serializer, validator) | planifié | `packages/format` | P0 | Fondation de tout le projet |
| Canvas PixiJS (stage, grille, zoom, pan) | planifié | `apps/web/src/canvas` | P0 | Rendu WebGL des nodes |
| Renderer de nodes (Frame, Text, Rectangle) | planifié | `apps/web/src/canvas/nodes` | P0 | Dispatch type → composant PixiJS |
| Document store Zustand (CRUD, undo/redo) | planifié | `apps/web/src/document` | P0 | État central du document |
| Interactions canvas (sélection, drag, resize) | planifié | `apps/web/src/canvas/tools` | P0 | Outils d'édition de base |
| Panels UI (sidebar, inspector, topbar) | planifié | `apps/web/src/panels` | P0 | Interface complète de l'éditeur |
| Thème éditeur (CSS vars, dark mode) | planifié | `apps/web/src/styles` | P0 | Identité visuelle distinctive |
| Persistance fichier .design | planifié | `apps/web/src/document` | P0 | Load/save/watch |

### Phase 2 — Intelligence IA

| Feature | Statut | Module | Priorité | Notes |
|---------|--------|--------|----------|-------|
| MCP Server base (bridge, CLI, 6 tools) | planifié | `packages/mcp-server` | P0 | Communication IA ↔ éditeur |
| MCP avancé (screenshot, composants, thèmes) | planifié | `packages/mcp-server` | P1 | 11 tools supplémentaires |
| Design Context Engine (4 couches) | planifié | `packages/design-context` | P0 | Valeur ajoutée principale |
| Validation de design (contrast, spacing, a11y) | planifié | `packages/design-context` | P1 | Audit qualité automatique |

### Phase 3 — Production

| Feature | Statut | Module | Priorité | Notes |
|---------|--------|--------|----------|-------|
| Export code (React+Tailwind, HTML/CSS) | planifié | `apps/web/src/export` | P1 | Génération de code depuis le design |
| Nodes avancés (Ellipse, Path, Icon, Ref, Group) | planifié | `apps/web/src/canvas/nodes` | P1 | Compléter la palette de nodes |
| Layout engine complet (flex, gap, padding) | planifié | `apps/web/src/canvas/utils` | P1 | Moteur de layout |
| Outils canvas (Frame, Text, Rect, Ellipse tools) | planifié | `apps/web/src/canvas/tools` | P1 | Création par click-drag |
| Dark/Light mode toggle | planifié | `apps/web` | P2 | Switch dans topbar |

### Phase 4 — Lancement

| Feature | Statut | Module | Priorité | Notes |
|---------|--------|--------|----------|-------|
| Site marketing verso.dev | planifié | `apps/web` (Next.js séparé) | P1 | Landing page, démo, pricing |
| Documentation docs.verso.dev | planifié | `apps/docs` (Nextra) | P1 | 8+ pages |
| Publication npm @verso/mcp-server | planifié | `packages/mcp-server` | P1 | `npx verso-mcp` |
| Déploiement Coolify | planifié | `coolify/` | P1 | Self-hosted |

### Phase 5 — Cloud & Team (futur)

| Feature | Statut | Module | Priorité | Notes |
|---------|--------|--------|----------|-------|
| Convex self-hosted (auth, users, teams) | planifié | `convex/` | P2 | Phase 5 uniquement |
| Design systems partagés (sync temps réel) | planifié | `convex/` | P2 | Team tier |
| Galerie de templates communautaire | planifié | `convex/` | P2 | Marketplace |

## Légendes des statuts

| Statut | Description |
|--------|-------------|
| done | Terminée et en production |
| en cours | En cours de développement |
| planifié | Dans la roadmap, pas commencée |
| idée | À spécifier / valider |
