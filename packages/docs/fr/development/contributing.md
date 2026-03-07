# Contribuer

## Structure du projet

```
packages/
  core/              @open-pencil/core — moteur (zéro dépendance DOM)
    src/             Graphe de scène, renderer, layout, codec, kiwi, types
  cli/               @open-pencil/cli — CLI headless pour opérations .fig
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — serveur MCP pour outils IA
    src/             Transports stdio + HTTP (Hono), 75 outils
src/
  components/        Vue SFCs (canevas, panneaux, barre d'outils, sélecteur de couleur)
    properties/      Sections du panneau de propriétés (Apparence, Remplissage, Contour, etc.)
  composables/       Entrée canevas, raccourcis clavier, hooks de rendu
  stores/            État de l'éditeur (réactivité Vue)
  engine/            Shims de ré-exportation depuis @open-pencil/core
  kiwi/              Shims de ré-exportation depuis @open-pencil/core
  types.ts           Types partagés (ré-exportés depuis core)
  constants.ts       Couleurs UI, défauts, seuils
desktop/             Tauri v2 (Rust + config)
tests/
  e2e/               Régression visuelle Playwright
  engine/            Tests unitaires (bun:test)
docs/                Site de documentation VitePress
openspec/
  specs/             Spécifications de capacités (source de vérité)
  changes/           Changements actifs et archivés
```

## Configuration du développement

```sh
bun install
bun run dev          # Éditeur sur localhost:1420
bun run docs:dev     # Docs sur localhost:5173
```

## Style de code

### Outils

| Outil | Commande | Objectif |
|-------|----------|----------|
| oxlint | `bun run lint` | Linting (basé sur Rust, rapide) |
| oxfmt | `bun run format` | Formatage du code |
| tsgo | `bun run typecheck` | Vérification de types (checker TypeScript basé sur Go) |

Exécuter toutes les vérifications :

```sh
bun run check
```

### Conventions

- **Noms de fichiers** — kebab-case (`scene-graph.ts`, `use-canvas-input.ts`)
- **Composants** — PascalCase Vue SFCs (`EditorCanvas.vue`, `ScrubInput.vue`)
- **Constantes** — SCREAMING_SNAKE_CASE
- **Fonctions/variables** — camelCase
- **Types/interfaces** — PascalCase

### Conventions pour agents IA

Les développeurs et agents IA doivent lire `AGENTS.md` à la racine du repo ([voir sur GitHub](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)). Couvre le rendu, le graphe de scène, les composants et instances, le layout, l'UI, le format de fichier, les conventions Tauri et les problèmes connus.

## Apporter des changements

1. Consulter les [specs openspec](/development/openspec) existantes
2. Créer un changement openspec si vous ajoutez un nouveau comportement : `openspec new change "mon-changement"`
3. Implémenter le changement
4. Exécuter `bun run check` et `bun run test`
5. Soumettre une pull request

## Fichiers clés

Le code source du moteur se trouve dans `packages/core/src/`. Les répertoires `src/engine/` et `src/kiwi/` de l'app sont des shims de ré-exportation — éditez le package core, pas les shims.

| Fichier | Objectif |
|---------|----------|
| `packages/core/src/scene-graph.ts` | Graphe de scène : nœuds, variables, instances, hit testing |
| `packages/core/src/renderer.ts` | Pipeline de rendu CanvasKit |
| `packages/core/src/layout.ts` | Adaptateur layout Yoga |
| `packages/core/src/undo.ts` | Gestionnaire annuler/rétablir |
| `packages/core/src/clipboard.ts` | Presse-papiers compatible Figma |
| `packages/core/src/vector.ts` | Modèle de réseau vectoriel |
| `packages/core/src/render-image.ts` | Export d'image hors-écran (PNG/JPG/WEBP) |
| `packages/core/src/kiwi/codec.ts` | Encodeur/décodeur binaire Kiwi |
| `packages/core/src/kiwi/fig-import.ts` | Logique d'import de fichiers .fig |
| `packages/cli/src/index.ts` | Point d'entrée du CLI |
| `packages/core/src/tools/schema.ts` | Définitions d'outils unifiées (IA, MCP, CLI) |
| `packages/core/src/figma-api.ts` | Implémentation de Figma Plugin API |
| `packages/mcp/src/server.ts` | Factory du serveur MCP |
| `packages/cli/src/commands/` | Commandes CLI (info, tree, find, export, eval, analyze) |
| `src/stores/editor.ts` | État global de l'éditeur |
| `src/composables/use-canvas.ts` | Composable de rendu du canevas |
| `src/composables/use-canvas-input.ts` | Gestion des entrées souris/touch |
| `src/composables/use-keyboard.ts` | Gestion des raccourcis clavier |
