---
pageClass: guide
title: Composants
description: Créez des composants réutilisables, placez des instances, ajoutez des variantes et des propriétés, et transformez des composants en commandes fonctionnelles.
---

# Composants

Un composant est un élément de design que vous réutilisez encore et encore, comme un bouton ou une carte. Ses copies s’appellent des instances. Modifiez le composant, et toutes ses instances changent avec lui.

<GuideLegend>

<GuideImage name="components/overview" alt="Un composant Button avec deux variantes dans un cadre en pointillés, et une instance Publish à côté" />

1. Un **jeu de composants** contient les variantes d’un composant. Il a une bordure violette en pointillés.
2. Chaque **variante** est un composant à part entière. Son nom, comme **Variant=Primary**, s’affiche au-dessus.
3. Une **instance** est une copie que vous placez dans votre design. Elle garde son propre texte, ici **Publish**.

</GuideLegend>

## Créer un composant

1. Sélectionnez un cadre, ou les calques à réutiliser.
2. Appuyez sur <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />.

Un cadre ou un groupe devient le composant. Les autres calques sont placés dans un nouveau composant qui les entoure. Les composants affichent leur nom en violet au-dessus d’eux sur le canevas.

## Placer une instance

Ouvrez **Ressources** en haut du panneau de gauche. Il liste les composants de votre fichier, par page, et ceux des bibliothèques que vous avez activées.

<GuideLegend>

<GuideImage name="components/assets" alt="Le panneau Ressources avec les composants Button et Switch" />

- Cliquez sur un composant pour le placer, ou faites-le glisser sur le canevas.
- Saisissez du texte dans le champ de recherche pour en trouver un par son nom.
- Les boutons à côté de la recherche basculent entre une grille et une liste, et ouvrent les [bibliothèques](./component-libraries).

</GuideLegend>

Vous pouvez aussi faire un clic droit sur un composant sur le canevas et choisir **Créer une instance**, ou appuyer sur <Keys mac="⌘ D" other="Ctrl D" /> dessus.

## Modifier toutes les instances

Modifiez le composant : sa taille, ses couleurs, son texte, sa disposition ou les calques qu’il contient. Toutes les instances suivent, sauf là où vous avez vous-même modifié une instance.

Pour trouver le composant dont provient une instance, faites un clic droit sur l’instance et choisissez **Aller au composant principal**. OpenPencil ouvre sa page et le sélectionne.

## Modifier une seule instance

Sélectionnez une instance et modifiez-la comme n’importe quel autre calque : changez son texte, remplacez une couleur ou masquez un calque qu’elle contient. Ces modifications sont conservées quand le composant change, et tout le reste continue de suivre le composant.

Certaines choses viennent toujours du composant : la position de chaque calque dans l’instance, sa rotation et ses contraintes.

Pour détacher une instance de son composant, appuyez sur <Keys mac="⌥ ⌘ B" other="Ctrl Alt B" />. Elle devient un simple cadre d’apparence identique.

## Créer des variantes

Les variantes sont des versions d’un même composant, comme un bouton principal et un bouton secondaire, ou un interrupteur activé et désactivé.

1. Sélectionnez un composant.
2. Cliquez sur **Ajouter une variante** en haut du panneau **Design**. Le composant devient un jeu, avec une copie en dessous.
3. Modifiez la copie et donnez-lui un nom dans **Variantes**.

Pour combiner des composants existants, sélectionnez-les et appuyez sur <Keys mac="⇧ ⌘ K" other="Ctrl Shift K" />.

Une variante peut avoir plusieurs propriétés, comme **Size=Small, State=Hover**. Le jeu n’a pas besoin de toutes les combinaisons. Quand une instance demande une combinaison absente du jeu, elle utilise la variante en haut à gauche.

## Choisir une variante dans une instance

<GuideLegend>

<GuideImage name="components/instance" alt="Les propriétés du composant pour une instance : Label réglé sur Publish et Variant réglé sur Primary" />

Sélectionnez une instance. **Propriétés du composant**, en haut du panneau **Design**, liste ce que vous pouvez régler : choisir une variante, saisir un libellé, ou afficher et masquer un calque.

</GuideLegend>

## Ajouter des propriétés

Les propriétés sont les réglages qu’une instance propose. Les propriétés de variante d’un jeu de composants sont déjà présentes.

1. Sélectionnez le composant.
2. Cliquez sur **+** à côté de **Propriétés** et choisissez un type :
   - **Texte** définit les mots d’un libellé.
   - **Booléen** affiche ou masque un calque, comme une icône.
   - **Permutation d’instance** remplace une instance imbriquée, comme l’icône elle-même.
   - **Variante** ajoute un autre ensemble de variantes.
3. Liez-y un calque. Sélectionnez le calque dans le composant et cliquez sur **Appliquer une variable/propriété** à côté de son réglage : dans **Typographie** pour le texte, dans **Apparence** pour l’affichage et le masquage, ou en haut du panneau pour une instance imbriquée.

<GuideLegend>

<GuideImage name="components/property" alt="La propriété Label ouverte, avec son nom, sa valeur par défaut et le calque qu’elle pilote" />

Cliquez sur une propriété pour la renommer, changer sa valeur par défaut, voir les calques qu’elle pilote ou la supprimer. Faites glisser les propriétés pour les réordonner.

</GuideLegend>

Pour afficher les propriétés propres d’une instance imbriquée sur les instances de votre composant, choisissez **+ → Instances imbriquées** et cochez-la.

## Ajouter des slots

Un slot est un cadre d’un composant dont chaque instance remplit le contenu, comme le corps d’une carte ou les éléments d’une liste.

1. Sélectionnez un cadre dans le composant, ou les calques à y placer.
2. Cliquez sur **Créer un slot** dans le panneau **Design**, ou choisissez **Objet → Créer un slot**.

Les réglages du slot comprennent une description, les composants qu’il privilégie et le nombre d’éléments qu’il contient ; une instance qui sort de ces limites affiche un avertissement. Dans une instance, ajoutez, réordonnez et supprimez les éléments d’un slot, ou réinitialisez-le au contenu du composant.

## Faire fonctionner un composant comme une commande

Un comportement transforme un composant en bouton, interrupteur, curseur, onglet ou champ de texte fonctionnel quand vous prévisualisez votre design. Les commandes proviennent de [Reka UI](https://reka-ui.com).

1. Sélectionnez le composant ou le jeu de composants.
2. Cliquez sur **+** à côté de **Comportement** et choisissez une commande.
3. Remplissez les lignes qui s’affichent.

<GuideLegend>

<GuideImage name="components/behaviour" alt="La section Comportement d’un Switch, marquée Prêt, avec Coché, On, Off, Bouton, États et Transition" />

- Les premières lignes indiquent quelle propriété contient la valeur, comme **Coché** pour un interrupteur, et quel slot dessine chaque partie, comme son **Bouton**.
- **États** est la propriété de variante qui définit l’apparence de la commande au repos, sous le pointeur, enfoncée, avec le focus, désactivée et invalide. **Ajouter des variantes d’état** les crée pour vous.
- **Transition** adoucit le passage de la commande d’un état à l’autre. Sa durée et son accélération peuvent suivre des [variables de durée et d’accélération](./variables#variables-d-acceleration-et-de-duree).

</GuideLegend>

**Prêt** s’affiche une fois la commande fonctionnelle. D’ici là, une ligne sous son nom indique ce qui manque : cliquez dessus pour y aller.

Pour essayer vos commandes, appuyez sur <Keys mac="⌥ ⌘ ↩" other="Ctrl Alt Enter" /> ou cliquez sur ▶ à côté de **Partager**. Les interrupteurs basculent, les curseurs se déplacent, les onglets s’ouvrent et les champs de texte acceptent la saisie. L’aperçu ne modifie pas votre fichier. **Réinitialiser** remet toutes les commandes dans leur état initial, et <Keys mac="Esc" other="Esc" /> revient à l’édition.

Les comportements sont enregistrés dans les fichiers `.fig`, et les composants Vue, React et Storybook exportés les conservent, chaque transition étant écrite en CSS.

## Partager des composants entre fichiers

Pour utiliser les mêmes composants dans plusieurs fichiers, publiez-les sous forme de [bibliothèque de composants](./component-libraries).
