# Contraintes & Décisions — Verso

## Anti-patterns (Claude ne doit JAMAIS faire)

1. **Ne jamais utiliser `any` en TypeScript** — utiliser `unknown` + type guards ou des types génériques
2. **Ne jamais utiliser `useState` pour l'état global** — utiliser Zustand + Immer exclusivement
3. **Ne jamais toucher à Convex en Phases 1-3** — tout est local, pas de backend cloud
4. **Ne jamais laisser un `// TODO` sans ticket** — soit le faire maintenant, soit créer un ticket
5. **Ne jamais écrire de commentaires évidents** — JSDoc sur les exports, pas de `// Incrémente le compteur`
6. **Ne jamais utiliser de JSX pour le rendu canvas** — PixiJS est impératif, pas déclaratif
7. **Ne jamais hardcoder de valeurs de design** — utiliser les CSS variables du thème
8. **Ne jamais créer de fichiers `utils.ts` globaux** — organiser par module/package
9. **Ne jamais commiter de secrets ou variables d'environnement** — vérifier `.gitignore`
10. **Ne jamais utiliser `rm` ou `rm -rf`** — utiliser `trash` pour les suppressions

## Dépendances interdites

| Package interdit | Raison | Alternative recommandée |
|-----------------|--------|------------------------|
| `moment.js` | Trop lourd, déprécié | `date-fns` ou `Temporal` |
| `lodash` (complet) | Trop lourd | `lodash-es` (tree-shakable) |
| `styled-components` | Décision CSS Modules | CSS Modules + CSS Variables |
| `redux` | Trop verbeux | `zustand` + `immer` |
| `tailwindcss` (dans l'éditeur) | CSS Modules pour les panels | CSS Modules (Tailwind OK pour l'export code) |

## Décisions architecturales

### Decision Log

### [2026-03-15] Zustand + Immer pour le state management

**Décision** : Utiliser Zustand 5 + Immer 10 pour tout l'état global
**Raison** : API simple, performant, mutations immutables lisibles avec Immer
**Alternatives rejetées** : Redux (trop verbeux), Jotai (trop atomique pour un document tree), React Context (pas assez performant)
**Implication pour Claude** : Toujours créer des stores Zustand pour l'état partagé. Jamais de useState pour du state cross-composant.

<!-- decision: 2026-03-15 -->

### [2026-03-15] CSS Modules pour l'UI de l'éditeur

**Décision** : CSS Modules pour les panels, CSS Variables pour le thème, PixiJS impératif pour le canvas
**Raison** : Scoping naturel, pas de runtime CSS-in-JS, séparation claire entre UI React et canvas WebGL
**Alternatives rejetées** : Tailwind (pas assez flexible pour un éditeur complexe), Styled Components (runtime overhead)
**Implication pour Claude** : Créer un fichier `.module.css` pour chaque composant de panel. Utiliser les CSS variables `--surface-*`, `--text-*`, `--accent-*` pour le thème.

<!-- decision: 2026-03-15 -->

### [2026-03-15] PixiJS 8 WebGL pour le canvas

**Décision** : PixiJS 8 en rendu impératif (pas de @pixi/react)
**Raison** : Performance 60fps sur 1000+ nœuds, contrôle total du rendu, API mature
**Alternatives rejetées** : HTML Canvas 2D (pas assez performant), Konva (trop abstrait), SVG (pas assez performant pour beaucoup de nœuds)
**Implication pour Claude** : Le canvas utilise des classes PIXI (Container, Graphics, Text), pas du JSX. Les nodes sont des objets PixiJS managés par le store.

<!-- decision: 2026-03-15 -->

### [2026-03-15] MCP Protocol pour la communication IA

**Décision** : Serveur MCP en stdio + bridge WebSocket IPC vers l'app
**Raison** : Standard émergent supporté par Claude Code, Cursor, Codex. Permet l'intégration dans n'importe quel IDE AI.
**Alternatives rejetées** : API REST (pas de standard IDE), plugin VS Code seul (trop limité), LSP (pas conçu pour le design)
**Implication pour Claude** : Les outils MCP sont la seule interface de l'IA avec le design. Toujours passer par batch_design pour les mutations.

<!-- decision: 2026-03-15 -->

### [2026-03-15] Architecture local-first (Phases 1-3)

**Décision** : Zéro backend cloud. Le fichier .design est la base de données.
**Raison** : Simplicité, privacy, pas de dépendance serveur. Le cloud (Convex) viendra en Phase 5 pour le Team tier uniquement.
**Alternatives rejetées** : Firebase (vendor lock-in), Supabase (prématuré), SQLite embarqué (complexité inutile)
**Implication pour Claude** : Pas de fetch API, pas d'auth, pas de BDD. Lire/écrire le fichier .design sur disque via le store + persistence.ts.

<!-- decision: 2026-03-15 -->

### [2026-03-15] AGPL-3.0

**Décision** : Licence AGPL-3.0 pour le projet open-source
**Raison** : Protection contre le fork propriétaire tout en restant open-source
**Implication pour Claude** : Inclure le header AGPL dans les fichiers source si demandé. Le fichier LICENSE doit être AGPL-3.0.

<!-- decision: 2026-03-15 -->

## Règles non négociables

- TypeScript strict dans tout le monorepo (`strict: true`, `noUncheckedIndexedAccess: true`)
- Paths absolus via tsconfig paths (`@/canvas`, `@/document`, `@/panels`)
- Conventional Commits en français (feat:, fix:, refactor:, docs:, test:, chore:)
- Un commit par sous-tâche complétée, message descriptif
- Tester chaque étape : vérifier compile + types + tests
- Grille 8px pour tout le spacing dans l'éditeur
- Lire le skill `/frontend-design` AVANT de coder le moindre CSS ou composant UI
- Le Design Context Engine doit TOUJOURS être consulté avant de créer un design (get_design_context)
