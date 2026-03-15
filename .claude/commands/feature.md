---
description: Scaffolding d'une nouvelle feature avec structure et fichiers de base
argument-hint: <nom-de-la-feature>
---

## Contexte

- Structure du projet : consulter `.claude/context/architecture.md`
- Conventions de nommage : consulter `.claude/context/conventions.md`
- Features existantes : consulter `.claude/context/features.md`

## Ta tâche

Créer le scaffolding complet pour la feature : $ARGUMENTS

### Étapes

1. **Valider le nom** : normaliser en kebab-case pour les fichiers, PascalCase pour les composants
2. **Déterminer le package cible** : identifier si la feature appartient à `apps/web/src/`, `packages/format/`, `packages/mcp-server/` ou `packages/design-context/`
3. **Créer la structure** selon le package :

   Pour une feature dans `apps/web/src/` :
   ```
   apps/web/src/<module>/
   ├── <feature-name>.tsx          # Composant principal
   ├── <feature-name>.module.css   # Styles CSS Module
   ├── types.ts                    # Types spécifiques
   └── __tests__/
       └── <feature-name>.test.ts  # Tests unitaires
   ```

   Pour un outil MCP dans `packages/mcp-server/` :
   ```
   packages/mcp-server/src/tools/
   └── <tool-name>.ts              # Implémentation de l'outil MCP
   ```

   Pour un node canvas dans `apps/web/src/canvas/nodes/` :
   ```
   apps/web/src/canvas/nodes/
   └── <NodeName>Node.tsx           # Composant PixiJS du node
   ```

4. **Générer les fichiers de base** avec :
   - Types TypeScript stricts (pas de `any`)
   - Imports absolus (`@/canvas`, `@/document`, etc.)
   - JSDoc sur les exports
   - CSS Module si composant UI
5. **Mettre à jour les barrel exports** (`index.ts`) si applicable
6. **Mettre à jour `.claude/context/features.md`** : ajouter la feature avec statut "en cours"
7. **Confirmer** : afficher un résumé des fichiers créés

### Exemple

```
/feature color-picker
```

Résultat :
```
apps/web/src/panels/shared/
├── color-picker.tsx
├── color-picker.module.css
└── __tests__/
    └── color-picker.test.ts

→ Ajouté dans features.md : "Color Picker | en cours | panels/shared | P1"
```
