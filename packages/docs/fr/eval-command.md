# `open-pencil eval` — API Plugin compatible Figma pour le scripting headless

## Vue d'ensemble

`bun open-pencil eval <file> --code '<js>'` exécute du JavaScript sur un fichier `.fig` avec un objet global `figma` compatible Figma. Cela permet le scripting headless, les opérations par lots, l'exécution d'outils IA et les tests — le tout sans interface graphique.

L'objet `figma` reflète la surface de l'API Plugin de Figma aussi fidèlement que possible, de sorte que les connaissances existantes sur les plugins Figma et les extraits de code sont directement transférables.

```bash
# Créer un cadre, définir l'auto-layout, ajouter des enfants
bun open-pencil eval design.fig --code '
  const frame = figma.createFrame()
  frame.name = "Card"
  frame.resize(300, 200)
  frame.layoutMode = "VERTICAL"
  frame.itemSpacing = 12
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
  return { id: frame.id, name: frame.name }
'

# Interroger les nœuds
bun open-pencil eval design.fig --code '
  const buttons = figma.currentPage.findAll(n => n.name.includes("Button"))
  return buttons.map(b => ({ id: b.id, name: b.name }))
'

# Écrire les modifications
bun open-pencil eval design.fig --code '...' --write
```

## Architecture

```
CLI: open-pencil eval <file> --code '...'
  → loadDocument(file) → SceneGraph
  → FigmaAPI(sceneGraph) → proxy `figma`
  → AsyncFunction('figma', code)(figmaProxy)
  → afficher résultat / sauvegarder avec --write
```

### Classes principales

| Classe | Emplacement | Rôle |
|--------|-------------|------|
| `FigmaAPI` | `packages/core/src/figma-api.ts` | Objet proxy implémentant les méthodes `figma.*` |
| `FigmaNode` | `packages/core/src/figma-api.ts` | Proxy enveloppant `SceneNode` avec accès propriétés style Figma |
| Commande `eval` | `packages/cli/src/commands/eval.ts` | Charge le document, crée l'API, exécute le code |

### Pourquoi dans `@open-pencil/core` ?

La classe `FigmaAPI` vit dans core car : les outils IA la réutilisent, les tests l'utilisent et elle n'a pas de dépendances DOM.

## Commande CLI

```
bun open-pencil eval <file> [options]

Arguments :
  file            Fichier .fig sur lequel opérer

Options :
  --code, -c      Code JavaScript à exécuter
  --stdin         Lire le code depuis stdin
  --write, -w     Écrire les modifications dans le fichier d'entrée
  -o, --output    Écrire dans un fichier différent
  --json          Sortie en JSON
  --quiet, -q     Supprimer la sortie
```

## Implémentation par phases

- **Phase 1 : Core** — création de nœuds, propriétés, opérations d'arbre, auto-layout, texte (~80% des scripts réels)
- **Phase 2 : Composants & Instances** — createComponent, createInstance, detachInstance
- **Phase 3 : Variables** — getLocalVariables, createVariable, setBoundVariable
- **Phase 4 : Styles & Avancé** — styles paint/texte/effets, opérations booléennes

[Référence API complète en anglais](/eval-command)
