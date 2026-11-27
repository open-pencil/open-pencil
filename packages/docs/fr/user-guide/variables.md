---
pageClass: guide
title: Variables
description: Regroupez couleurs, tailles et autres valeurs au même endroit, changez-les avec des modes, et emportez-les dans le code en CSS ou en design tokens.
---

# Variables

Une variable est une valeur nommée, comme une couleur de marque ou un rayon d’angle, que les calques utilisent à la place d’un nombre qui leur est propre. Modifiez la variable, et tous les calques qui l’utilisent changent. Les modes donnent d’autres valeurs aux mêmes variables, par exemple pour un thème sombre.

## Ouvrir les variables

Choisissez **Affichage → Variables…**, ou cliquez sur une zone vide du canevas et ouvrez **Variables** dans le panneau **Design**.

<GuideImage name="variables/dialog" alt="La fenêtre Variables avec la collection Theme, quatre variables en Light et Dark, les réglages de la collection et la feuille de style" />

1. Les **collections** regroupent des variables, comme les couleurs ou les espacements.
2. Chaque **variable** a une valeur dans chaque mode, en colonnes.
3. Les **réglages** de la variable sélectionnée, ou de la collection quand aucune n’est sélectionnée.
4. La **feuille de style** affiche la collection en CSS.

**Développer**, dans le coin de la fenêtre, lui donne la plus grande partie de l’écran. Dans une fenêtre étroite ou sur un téléphone, elle affiche un mode à la fois.

## Créer une variable

1. Cliquez sur **Créer une variable** et choisissez un type : couleur, nombre, texte, vrai/faux, accélération ou durée.
2. Saisissez un nom. Les barres obliques la placent dans un groupe : `Brand/Primary` apparaît comme **Primary** sous **Brand**.
3. Définissez sa valeur dans chaque mode.

À droite, vous pouvez aussi définir :

- **Nom CSS**, utilisé par la feuille de style. S’il reste vide, il est tiré du nom, par exemple `--color-brand-primary`.
- **Unité** pour les nombres : `px`, `rem`, `%`, `ms`, `s`, `deg` ou aucune.
- **Portées**, les réglages qui proposent la variable.
- **Description**, et **Masquer de la publication** pour l’exclure des [bibliothèques](./component-libraries).

Pour qu’une variable suive une autre variable, cliquez sur le bouton de variable à côté de sa valeur et choisissez-la. **Détacher la variable** la transforme de nouveau en simple valeur.

## Utiliser une variable

<GuideLegend>

<GuideImage name="variables/apply" alt="La ligne Remplissage d’un calque sélectionné avec son bouton Appliquer la variable ouvert, qui liste les couleurs de Theme" />

1. Sélectionnez un calque.
2. Cliquez sur **Appliquer la variable** à côté d’un réglage, comme une couleur de remplissage, un rayon d’angle ou un espacement.
3. Choisissez une variable.

</GuideLegend>

Le réglage affiche alors le nom de la variable. Pour revenir à une simple valeur, cliquez sur **Appliquer la variable** et choisissez **Détacher la variable**.

## Utiliser des modes

Une collection peut avoir plusieurs modes, comme **Light** et **Dark**. Chaque variable qu’elle contient a une valeur dans chacun d’eux.

- Pour ajouter un mode, cliquez sur **+** à côté de **Modes** dans les réglages de la collection.
- Pour en renommer un, modifiez son nom. Le menu **⋯** à côté permet de le dupliquer, d’en faire le mode par défaut ou de le supprimer.

<GuideLegend>

<GuideImage name="variables/mode" alt="Le réglage Theme dans Apparence ouvert, avec Auto, Light et Dark" />

Pour afficher un cadre dans un autre mode, sélectionnez-le et choisissez le mode dans **Apparence**. Les calques qu’il contient suivent, sauf s’ils ont leur propre mode. **Auto** reprend le mode du calque qui l’entoure.

</GuideLegend>

Dans le code, **S’applique quand** indique quand un mode prend le relais. Le CSS produit s’affiche en dessous :

| S’applique quand | CSS |
| --- | --- |
| **il est activé manuellement** | un attribut sur un élément, comme `[data-theme="dark"]` |
| **le système est en mode sombre** | `@media (prefers-color-scheme: dark)` |
| **le système est en mode clair** | `@media (prefers-color-scheme: light)` |
| **le contraste élevé est activé** | `@media (prefers-contrast: more)` |
| **la réduction des animations est activée** | `@media (prefers-reduced-motion: reduce)` |
| **l’écran est plus étroit que** une largeur | `@media (max-width: 640px)` |
| **l’écran est plus large que** une largeur | `@media (min-width: 640px)` |
| **le conteneur est plus étroit que** une largeur | `@container (max-width: 640px)` |
| **le conteneur est plus large que** une largeur | `@container (min-width: 640px)` |
| **CSS personnalisé** | n’importe quel sélecteur, ou une requête `@media`, `@supports` ou `@container` |

Le mode par défaut est toujours actif et va dans `:root`. L’**Attribut de bascule** d’une collection, `data-theme` par défaut, est l’attribut qui active ses modes manuels. Changez-le pour qu’il corresponde à votre code, par exemple `data-color-scheme`.

Les calques réglés sur un mode manuel sont exportés avec son attribut. Les calques réglés sur un mode avec une autre condition sont exportés avec des valeurs simples, puisque c’est la feuille de style qui décide quand ce mode s’applique.

## Organiser les variables

- **Collections :** cliquez sur **+** à côté de **Collections** pour en ajouter une. Quand aucune variable n’est sélectionnée, la partie droite permet de renommer la collection, et son menu **⋯** de la supprimer.
- **Rechercher :** saisissez du texte dans le champ de recherche pour filtrer par nom, nom CSS, description ou valeur. Cliquez sur un groupe pour n’afficher que ce groupe, ou utilisez le bouton de filtre pour ne garder que certains types.
- **Sélectionner :** cliquez sur une ligne, ou utilisez les touches fléchées. <Keys mac="⇧" other="Shift" />-clic sélectionne une plage, et <Keys mac="⌘" other="Ctrl" />-clic ajoute une ligne.
- **Modifier sur place :** double-cliquez sur un nom, un nombre ou un texte dans la liste.
- **Déplacer et supprimer :** faites un clic droit pour renommer, dupliquer, déplacer vers un groupe ou supprimer. Faites glisser les lignes pour les réordonner.
- **Annuler :** <Keys mac="⌘ Z" other="Ctrl Z" /> fonctionne ici comme sur le canevas.

## Écrire une formule

La valeur d’un nombre peut être une formule portant sur d’autres variables, comme `space/base * 4`. Commencez à saisir le nom d’une variable et choisissez-la, ou choisissez **Utiliser une variable**. Le champ affiche le résultat, par exemple `= 16px`. Pour les autres types, choisissez **Utiliser une formule** à côté de la valeur.

- Les nombres utilisent `+`, `-`, `*`, `/` et les parenthèses.
- Les valeurs vrai/faux utilisent `and`, `or` et `not`, et se comparent avec `==`, `!=`, `<`, `<=`, `>` et `>=` : `viewport > 1024 and not loading`.
- Le texte s’écrit entre guillemets droits doubles, et `+` le concatène : `"Hello, " + name`. `text(count)` écrit un nombre comme le fait Figma.
- `if(condition, then, otherwise)` choisit entre deux valeurs : `if(dark, gray/900, #FFFFFF)`.
- `truthy(value)` vaut faux pour `0`, un texte vide, `false`, `no` et `off`.

Les erreurs, comme un nom inconnu ou une boucle, s’affichent quand vous quittez le champ, et l’ancienne valeur est conservée. Renommer une variable ne casse pas les formules qui l’utilisent.

Dans la feuille de style, une formule numérique devient `calc()`. Les formules avec `if()`, du texte ou des valeurs vrai/faux ne peuvent pas s’écrire en CSS et sont omises.

Un nombre peut aussi avoir une **Expression CSS** qui le remplace dans le code uniquement, comme `clamp(1rem, 4vw, var(--spacing-md))`. Ajoutez-la depuis le menu **⋯** de la valeur.

## Variables d’accélération et de durée

Les variables d’accélération et de durée décrivent le mouvement : le temps que prend un changement, et la façon dont il accélère et ralentit. Les [transitions des composants](./components#faire-fonctionner-un-composant-comme-une-commande) peuvent les suivre, si bien qu’un mode **Reduced motion** peut raccourcir toutes les transitions d’un coup.

- **Durée** est une durée, saisie en millisecondes, comme `250ms`, ou en secondes, comme `0.25s`.
- **Accélération** est une courbe ou un ressort. Cliquez dessus pour ouvrir l’éditeur :
  - **Courbe :** choisissez une accélération prédéfinie ou **Bézier personnalisée**, puis faites glisser les deux poignées ou saisissez les nombres. **Inverser la courbe** la joue à l’envers.
  - **Ressort :** choisissez Doux, Rapide, Rebondissant, Lent ou **Ressort personnalisé**. Faites glisser le premier dépassement sous **Durée**, ou réglez la raideur, l’amortissement et la masse sous **Physique**.

En CSS, une durée s’écrit en millisecondes et une courbe comme une fonction de temporisation, par exemple `cubic-bezier(0.45, 1.45, 0.8, 1)`. Les ressorts n’ont pas d’équivalent CSS ici et sont omis.

## Copier les variables en code

Le bouton de copie au-dessus de la feuille de style copie toutes les collections en CSS, ou sous forme de thème Tailwind v4.

## Importer et exporter des design tokens

Les variables et les styles circulent entre OpenPencil, Figma et le code sous forme de [design tokens](https://www.designtokens.org/).

- **Exporter :** dans le menu de copie de la feuille de style, choisissez **Exporter en design tokens**. Vous obtenez un zip avec un fichier par mode, que Figma importe comme un mode, ainsi que les styles de texte et d’effet.
- **Importer :** cliquez sur **Importer des design tokens** en haut de la fenêtre et choisissez des fichiers de tokens ou un zip. Les fichiers de Figma et de Tokens Studio fonctionnent.

Avant l’import, la fenêtre indique où va chaque collection et chaque mode : une nouvelle, une existante, ou nulle part. Les variables de même nom sont mises à jour, les autres sont ajoutées, et rien n’est supprimé. **Annuler** annule l’import entier.
