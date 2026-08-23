---
title: Moteur JSX
description: Créer des designs à partir de JSX et exporter une sélection en JSX avec Tailwind.
---

# Moteur JSX

OpenPencil convertit du JSX déclaratif en arbre de design. Le même système est disponible dans le chat avec l’AI, MCP et `eval`.

```jsx
<Frame flex="col" gap={16} p={24} w={320} bg="#ffffff" radius={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text color="#667085">Description</Text>
  <Button>Continue</Button>
</Frame>
```

## Éléments

| JSX | Résultat |
|-----|----------|
| `<Frame>` | Cadre, éventuellement avec disposition automatique |
| `<Text>` | Objet texte |
| `<Rectangle>` | Rectangle |
| `<Ellipse>` | Ellipse |
| `<Image>` | Forme avec remplissage d’image |
| Composant enregistré | Arbre réutilisable défini par l’application |

## Disposition

- `flex="row"` ou `flex="col"` active la disposition automatique.
- `gap` règle l’espacement.
- `p`, `px`, `py`, `pt`, `pr`, `pb` et `pl` règlent les marges intérieures.
- `align` et `justify` règlent l’alignement.
- `wrap` autorise le retour à la ligne.

## Taille et position

- `w` et `h` acceptent des nombres, `"fill"` ou `"hug"`.
- `minW`, `maxW`, `minH` et `maxH` posent des limites.
- `x` et `y` définissent la position hors du flux.

## Apparence et typographie

`bg`, `fill`, `color`, `stroke`, `strokeWidth`, `opacity`, `radius` et `shadow` contrôlent l’apparence. `size`, `font`, `weight`, `lineHeight`, `letterSpacing` et `align` contrôlent le texte. Ces noms restent en anglais car ils font partie de l’API JSX.

## Exporter vers JSX

**Copier comme → JSX** convertit la sélection en JSX et classes Tailwind. La sortie tente de préserver hiérarchie, disposition, dimensions, couleurs, typographie et bordures comme point de départ d’une implémentation.
