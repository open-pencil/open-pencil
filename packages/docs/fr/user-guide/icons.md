---
pageClass: guide
title: Icônes
description: Cherchez dans des jeux d’icônes open source et dans les SF Symbols, insérez des icônes, puis changez-les, recolorez-les ou modifiez leur style dans OpenPencil.
---

# Icônes

OpenPencil cherche dans les jeux d’icônes open source publiés via [Iconify](https://iconify.design), comme Lucide, Material Symbols, Tabler et Phosphor, et, dans l’application pour Mac, dans les SF Symbols d’Apple. Une icône placée se souvient de l’icône qu’elle est : vous pouvez donc la remplacer par une autre ou changer sa couleur plus tard, et les exports l’écrivent en tant que cette icône.

Chercher et placer des icônes nécessite une connexion réseau à l’API d’Iconify.

## Insérer une icône

Ouvrez le sélecteur d’icônes de l’une de ces façons :

- Cliquez sur **Insérer une icône** au bout de la barre d’outils.
- Choisissez **Objet → Insérer une icône…**.
- Cherchez **Insérer une icône** dans la palette de commandes, <Keys mac="⌘ K" other="Ctrl K" />.

Avant que vous tapiez quoi que ce soit, le sélecteur affiche les icônes déjà placées dans ce fichier et celles que vous avez choisies récemment. Tapez ce que vous cherchez, comme `arrow` ou `heart`, pour chercher dans tous les jeux. Survolez une icône pour voir son nom et son jeu.

Choisissez-en une pour la placer, en 24 × 24, au milieu de la vue, à l’intérieur du cadre que vous modifiez si vous êtes entré dans l’un d’eux. La nouvelle icône est sélectionnée, et <Keys mac="⌘ Z" other="Ctrl Z" /> la retire en une seule étape.

<GuideImage name="icons/picker" alt="Le sélecteur d’icônes cherchant heart, avec des résultats de plusieurs jeux d’icônes" />

## Choisir un jeu d’icônes

Le bouton de jeu au bout du champ de recherche (**Tous les jeux d'icônes** au départ) limite le sélecteur à un seul jeu. Les jeux sont regroupés par type, comme Material ou Logos ; tapez pour en trouver un par son nom, comme `tabler`. Chaque jeu indique combien d’icônes il contient.

Une fois un jeu choisi, le sélecteur affiche tout le jeu, en chargeant la suite à mesure que vous faites défiler, et une recherche ne porte que sur ce jeu. Survolez une icône, ou atteignez-la avec les flèches du clavier, pour voir son nom, son jeu et sa licence sous la grille. Le sélecteur se souvient du dernier jeu choisi, et **Changer d'icône** s’ouvre sur le jeu de l’icône que vous remplacez.

## Remplacer ou recolorer une icône

Sélectionner une icône placée ajoute une section **Icône** au panneau **Design**.

- **Changer d'icône** ouvre le sélecteur et dessine l’icône choisie à la place de l’icône actuelle. L’icône garde sa taille, sa position et sa couleur.
- **Couleur de l'icône** change la couleur des tracés propres à l’icône. Les icônes dessinées en plusieurs couleurs fixes, comme les logos de marque, gardent ces couleurs et n’affichent pas ce champ.

- Des **Options** apparaissent pour les icônes de Material Symbols et des SF Symbols, qu’OpenPencil dessine lui-même ; voir ci-dessous. En changer une redessine l’icône.

Chaque remplacement, changement de couleur ou d’option est une seule étape d’annulation ; un glissement dans le sélecteur de couleur s’annule comme un seul changement.

Une icône est un cadre de tracés vectoriels, nommé d’après l’icône, comme `cat`, et marqué d’un smiley dans l’arbre des calques. Contrairement aux autres cadres de la page, elle n’a pas de titre sur le canevas, et la redimensionner met ses tracés à l’échelle. Ses calques, ses contraintes, ses effets et le reste du panneau **Design** fonctionnent comme pour n’importe quel cadre.

## Régler les Material Symbols

Les Material Symbols Outlined, Rounded et Sharp sont dessinés à partir des polices variables de Google : leurs options dans la section **Icône** sont donc les axes propres à ces polices :

- **Weight**, de 100 à 700.
- **Fill**, 0 pour le contour ou 1 pour le plein.
- **Grade**, de −50 à 200, qui épaissit légèrement les traits sans changer la taille de l’icône, par exemple pour équilibrer des icônes claires sur un fond sombre.
- **Optical size**, de 20 à 48. Une icône placée commence avec la taille optique correspondant à sa taille, comme le recommande Google : une icône de 24 × 24 utilise donc 24 ; réglez-la vous-même pour dessiner une petite icône avec les détails d’une grande, ou l’inverse.

## Utiliser les SF Symbols {#sf-symbols}

Les SF Symbols sont les icônes d’Apple. Apple n’en autorise l’usage que sur ses propres plateformes : OpenPencil ne les fournit donc jamais. C’est macOS qui les dessine, et ils ne sont proposés que dans l’[application OpenPencil pour Mac](/fr/download) sous **macOS 14 Sonoma ou version ultérieure**. Dans le navigateur, sous Windows et Linux, et sur les versions plus anciennes de macOS, le sélecteur d’icônes liste les SF Symbols sous Apple et indique ce qu’il leur faut au lieu de les afficher.

Pour les utiliser :

1. [Téléchargez OpenPencil](/fr/download) pour macOS et ouvrez-le. Si votre Mac utilise une version plus ancienne de macOS, mettez-le d’abord à jour dans **Réglages Système → Général → Mise à jour de logiciels**.
2. Ouvrez le sélecteur d’icônes, choisissez **SF Symbols** dans le menu des jeux, et cherchez par nom ou par mot-clé, comme `heart` ou `weather`.

La section **Icône** propose alors :

- **Weight**, de Ultralight à Black, et **Scale**, small, medium ou large, comme dans les applications d’Apple.
- **Rendering** : **Monochrome** dans la couleur de l’icône ; **Hierarchical**, la couleur de l’icône à plusieurs opacités ; **Palette**, la couleur de l’icône plus une **Secondary color** et une **Tertiary color** pour les autres calques du symbole ; ou **Multicolor**, les couleurs propres au symbole, où les parties qui suivent le premier plan prennent la couleur de l’icône.
- **Variable value**, de 0 à 1, pour les symboles qui se remplissent par paliers, comme `wifi` ou `speaker.wave.3` ; les autres symboles ne changent pas.

Un document conserve les contours de ses SF Symbols : ils s’affichent donc partout où il s’ouvre. Pour en modifier ou en remplacer un, il faut de nouveau l’application pour Mac ; ailleurs, la section **Icône** l’indique à la place de ses options.

## Modifier les tracés d’une icône

Vous pouvez modifier les tracés d’une icône comme n’importe quel vecteur. Dès que ses points, ses tracés ou ses couleurs propres changent, la section **Icône** indique **Modifiée** :

- L’icône s’exporte sous la forme des tracés qu’elle dessine désormais plutôt que par son nom, si bien que la modification est conservée.
- **Réinitialiser** (la flèche circulaire) redessine l’icône d’origine, à la même taille et dans la même couleur.
- Un remplacement demande d’abord confirmation, car il dessine une nouvelle icône et abandonne la modification.

Redimensionner l’icône ou changer sa couleur ne compte pas comme une modification.

**Détacher l'icône**, dans la section **Icône**, le menu du canevas ou **Objet → Détacher l'icône**, transforme une icône en simple illustration : elle garde ses tracés, mais ne peut plus être remplacée, recolorée ni exportée en tant qu’icône. Comme toutes les commandes d’icône, c’est une seule étape d’annulation.

## Les icônes dans les exports

- **Design JSX** écrit une icône placée sous la forme `<Icon name="lucide:heart" size={24} color="#…" />`. Les Material Symbols et les SF Symbols s’exportent sous la forme des tracés qu’ils dessinent, car leur nom seul ne dit pas comment ils ont été dessinés ; pour en placer un par son nom, donnez ses `options` à `<Icon>`, comme <code v-pre>options={{ wght: 600, FILL: 1 }}</code>.
- **HTML** l’écrit en SVG intégré marqué avec `data-icon`, avec ses tracés peints en `currentColor` et la couleur de l’icône définie sur le `<svg>` : changer cette seule `color` la recolore.
- **SVG et images** la dessinent comme n’importe quel autre vecteur.

## Les icônes dans le HTML importé

L’import de HTML conserve en tant qu’icônes les icônes qu’une page dessine, avec les tracés et la couleur propres à la page :

- Le SVG intégré marqué avec `data-icon`, tel que l’écrit l’export HTML d’OpenPencil, devient cette icône.
- Un autre SVG intégré devient l’icône d’un jeu Iconify populaire qu’il dessine, s’il la dessine de façon suffisamment fidèle : il est comparé aux icônes dont les formes s’en rapprochent le plus, dessinées de la même manière.
- Tout le reste reste une illustration.

La correspondance télécharge un index des jeux populaires, d’environ 2 Mo, et demande à Iconify les icônes à comparer par leur nom ; le SVG lui-même n’est jamais envoyé. Sans connexion, un SVG intégré sans `data-icon` reste une illustration. Désactivez-la avec **Nommer les icônes du HTML importé** dans **Paramètres → Éditeur**, ou avec `--no-icon-names` dans `openpencil import`.

Les icônes placées par des agents IA, des clients MCP et le design JSX sont des icônes de la même façon : la section **Icône** fonctionne aussi sur elles.
