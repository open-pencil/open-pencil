# Conventions — Verso

## Langue

| Contexte | Langue |
|----------|--------|
| Code (variables, fonctions, classes) | Anglais |
| Commentaires | Français |
| Commits | Français |
| Documentation | Français |
| UI (labels, messages) | Anglais (internationalisation future) |

## Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Fichiers | kebab-case | `canvas-stage.tsx`, `design-context.ts` |
| Composants / Classes | PascalCase | `CanvasStage`, `DesignDocument` |
| Fonctions / Variables | camelCase | `resolveVariable`, `nodeCount` |
| Constantes | UPPER_SNAKE_CASE | `DEFAULT_GRID_SIZE`, `MAX_ZOOM` |
| Types / Interfaces | PascalCase | `DesignNode`, `FrameNodeProps` |
| Packages npm | kebab-case avec scope | `@verso/format`, `@verso/mcp-server` |

## Style de code

### Règles générales
- TypeScript strict (`strict: true`, `noUncheckedIndexedAccess: true`)
- Zéro `any` — utiliser `unknown` + type guards si nécessaire
- JSDoc sur les fonctions exportées, pas de commentaires évidents
- Imports absolus via tsconfig paths (`@/canvas`, `@/document`, `@/panels`)
- Pas de `// TODO` sans ticket associé

### Imports
1. Modules Node.js natifs
2. Packages externes (react, pixi.js, zustand...)
3. Packages internes (@verso/format, @verso/design-context)
4. Modules internes (@/canvas, @/document, @/panels)
5. Types (import type)

### Composants React
- Props typées avec interface (pas de type inline)
- Export nommé (pas de default export)
- Pas de useState pour l'état global → Zustand
- CSS Modules pour le style des panels
- Rendu PixiJS impératif pour le canvas (pas de JSX)

## Git Workflow

- **Branche principale** : `main`
- **Convention de commits** : Conventional Commits en français

| Type | Prefixe | Exemple |
|------|---------|---------|
| Feature | `feature/` | `feature/canvas-renderer` |
| Bugfix | `fix/` | `fix/selection-bug` |
| Hotfix | `hotfix/` | `hotfix/crash-on-save` |
| Documentation | `docs/` | `docs/mcp-tools` |
| Maintenance | `chore/` | `chore/update-deps` |

- **Format de commit** :
  ```
  feat(canvas): ajouter le rendu des FrameNode
  fix(store): corriger le undo sur les opérations groupées
  refactor(format): simplifier le parser JSON
  docs(mcp): documenter l'outil batch_design
  test(format): ajouter les tests de roundtrip
  chore(deps): mettre à jour pixi.js vers 8.3
  ```

## Tests

- **Framework** : Vitest (unit), Playwright (E2E)
- **Emplacement** : `__tests__/` co-localisé dans chaque package/module
- **Nommage** : `*.test.ts`
- **Convention** : describe/it en anglais, pattern AAA (Arrange, Act, Assert)
- **Couverture cible** : > 80% sur les packages (`format`, `mcp-server`, `design-context`)

## Linting & Formatting

- **Linter** : ESLint (config dans `.eslintrc.cjs`)
- **Formatter** : Prettier (config dans `.prettierrc`)
- **Vérification** : `pnpm lint` doit passer sans warnings
