---
title: Moteur de rendu JSX
description: Créez des designs avec JSX — la syntaxe que les LLMs connaissent déjà grâce à des millions de composants React.
---

# Moteur de rendu JSX

OpenPencil utilise JSX comme langage de création de design. Les LLMs ont vu des millions de composants React — décrire une mise en page avec `<Frame><Text>` est naturel, aucun entraînement spécial nécessaire. Chaque token compte quand un agent IA effectue des dizaines d'opérations, et JSX est la représentation déclarative la plus compacte.

JSX est aussi diffable. Quand une IA modifie un design, le changement est un diff JSX — lisible, vérifiable, versionnable.

## Créer des designs

L'outil `render` (disponible dans le chat IA, MCP et l'eval du CLI) accepte du JSX :

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

Dans le serveur MCP et le chat IA, l'outil `render` accepte des chaînes JSX directement. Dans le CLI, utilisez la commande `export` pour aller dans l'autre sens — [exporter des designs en JSX](./cli/exporting).

## Éléments

Tous les types de nœuds sont disponibles en tant qu'éléments JSX :

| Élément | Crée | Alias |
|---------|------|-------|
| `<Frame>` | Frame (conteneur, supporte l'auto-layout) | `<View>` |
| `<Rectangle>` | Rectangle | `<Rect>` |
| `<Ellipse>` | Ellipse / cercle | |
| `<Text>` | Nœud texte (les enfants deviennent le contenu textuel) | |
| `<Line>` | Ligne | |
| `<Star>` | Étoile | |
| `<Polygon>` | Polygone | |
| `<Vector>` | Chemin vectoriel | |
| `<Group>` | Groupe | |
| `<Section>` | Section | |

## Props de style

Props raccourcies compactes inspirées des conventions de nommage de Tailwind.

### Mise en page

| Prop | Description |
|------|-------------|
| `flex` | `"row"` ou `"col"` — active l'auto-layout |
| `gap` | Espace entre les enfants |
| `wrap` | Retour à la ligne des enfants |
| `rowGap` | Espacement sur l'axe transversal lors du retour à la ligne |
| `justify` | `"start"`, `"end"`, `"center"`, `"between"` |
| `items` | `"start"`, `"end"`, `"center"`, `"stretch"` |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | Marges internes (padding) |

### Taille et position

| Prop | Description |
|------|-------------|
| `w`, `h` | Largeur/hauteur — nombre, `"fill"` ou `"hug"` |
| `minW`, `maxW`, `minH`, `maxH` | Contraintes de taille |
| `x`, `y` | Position |

### Apparence

| Prop | Description |
|------|-------------|
| `bg` | Remplissage d'arrière-plan (couleur hexadécimale) |
| `fill` | Alias pour `bg` |
| `stroke` | Couleur de contour |
| `strokeWidth` | Épaisseur du contour (par défaut : 1) |
| `rounded` | Rayon d'arrondi (ou `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`) |
| `cornerSmoothing` | Coins lisses style iOS (0–1) |
| `opacity` | 0–1 |
| `shadow` | Ombre portée (ex. `"0 4 8 #00000040"`) |
| `blur` | Rayon de flou du calque |
| `rotate` | Rotation en degrés |
| `blendMode` | Mode de fusion |
| `overflow` | `"hidden"` ou `"visible"` |

### Typographie

| Prop | Description |
|------|-------------|
| `size` / `fontSize` | Taille de police |
| `font` / `fontFamily` | Famille de polices |
| `weight` / `fontWeight` | `"bold"`, `"medium"`, `"normal"` ou nombre |
| `color` | Couleur du texte |
| `textAlign` | `"left"`, `"center"`, `"right"`, `"justified"` |

## Exporter en JSX

Convertissez des designs existants en JSX :

```sh
open-pencil export design.fig -f jsx                   # Format OpenPencil
open-pencil export design.fig -f jsx --style tailwind  # Classes Tailwind
```

L'aller-retour fonctionne : exportez un design en JSX, modifiez le code, rendez-le à nouveau.

## Diff visuel

Comme les designs sont représentables en JSX, les changements deviennent des diffs de code :

```diff
 <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF">
-  <Text size={18} weight="bold">Old Title</Text>
+  <Text size={24} weight="bold" color="#1D1B20">New Title</Text>
   <Text size={14} color="#666">Description</Text>
 </Frame>
```

Cela rend les changements de design vérifiables dans les pull requests, traçables dans le contrôle de version, et auditables dans la CI.
