---
title: Variables
description: Créer des variables, collections et modes, puis les lier aux propriétés de design.
---

# Variables

Les variables stockent des tokens de design réutilisables, comme des couleurs, des espacements et d’autres propriétés, qui peuvent être liés à des objets. Lorsque la valeur d’une variable change, tous les objets qui l’utilisent sont mis à jour.

## Ouvrir la boîte de dialogue des variables

Ouvrez-la depuis **Affichage → Variables…**, en recherchant « Variables » dans la palette de commandes ou, lorsqu’aucun objet n’est sélectionné, depuis la section Variables de l’onglet **Design**. **Développer**, dans le coin de la boîte de dialogue, lui donne la majeure partie de la fenêtre.

La boîte de dialogue liste à gauche les variables de la collection active, modifie à droite la variable sélectionnée ou la collection, et affiche en dessous la feuille de style qu’elles produisent. Dans une fenêtre étroite ou sur téléphone, elle n’affiche qu’un mode à la fois, et une variable, les paramètres de la collection ou la feuille de style s’ouvrent par-dessus la liste avec un bouton de retour.

## Collections

Les variables sont organisées en collections. Dans une boîte de dialogue large, elles sont listées dans une barre latérale avec le nombre de variables de chacune ; plus étroite, elles s’affichent sous forme d’onglets, ou d’un menu sur un téléphone.

- **Changer de collection :** cliquez dessus dans la barre latérale ou sur son onglet
- **Créer une collection :** cliquez sur **+** à côté de **Collections**, ou sur le bouton en forme de dossier dans la barre d’outils (**Créer une collection**)
- **Renommer ou supprimer :** sans variable sélectionnée, la partie droite modifie la collection : changez son nom, ou supprimez-la depuis le menu **⋯** à côté du nom (**Supprimer la collection**)
- **Attribut de bascule :** l’attribut qui active les modes activés manuellement, `data-theme` par défaut pour une collection nommée Theme ; saisissez un autre nom, comme `data-color-scheme`, pour correspondre à un code existant

## Modes

Chaque collection peut avoir plusieurs modes (par exemple Clair et Sombre). Les modes apparaissent sous forme de colonnes de valeurs dans la liste, et une variable a une valeur pour chaque mode. Ils se gèrent dans les **Paramètres de la collection** :

- **Ajouter un mode :** cliquez sur **+** à côté de **Modes**
- **Renommer :** modifiez le nom du mode
- **Dupliquer, définir par défaut, supprimer :** utilisez le menu **⋯** à côté du mode (**Dupliquer le mode**, **Définir par défaut**, **Supprimer le mode**)

Le mode par défaut est **Toujours actif** et va dans `:root`. Chaque autre mode a **S’applique quand**, qui indique quand le mode prend le relais dans la feuille de style exportée ; le CSS qu’il produit s’affiche en dessous :

| S’applique quand | CSS |
| --- | --- |
| **il est activé manuellement** | l’attribut de bascule de la collection avec le mode pour valeur, comme `[data-theme="dark"]` pour le mode Sombre d’une collection Theme |
| **le système est en mode sombre** / **le système est en mode clair** | `@media (prefers-color-scheme: dark)` / `light` |
| **le contraste élevé est activé** | `@media (prefers-contrast: more)` |
| **la réduction des animations est activée** | `@media (prefers-reduced-motion: reduce)` |
| **l’écran est plus étroit que** / **l’écran est plus large que** une largeur | `@media (max-width: 640px)` / `min-width` |
| **le conteneur est plus étroit que** / **le conteneur est plus large que** une largeur | `@container (max-width: 640px)` / `min-width` |
| **CSS personnalisé** | n’importe quel sélecteur, ou une requête `@media`, `@supports` ou `@container` |

Sur le canevas, un calque affiche un mode lorsque vous l’y réglez, quelle que soit la condition. Dans le code exporté, un mode activé manuellement s’active en ajoutant son attribut à un élément ; les calques réglés dessus sont donc exportés avec cet attribut. Les calques réglés sur un mode ayant une autre condition, sélecteurs personnalisés compris, sont exportés avec des valeurs littérales plutôt que des tokens, car c’est la feuille de style, et non le calque, qui décide quand ce mode s’applique.

## Gérer les variables

Les variables sont regroupées selon les dossiers de leurs noms (`Brand/Primary` apparaît comme *Primary* sous *Brand*), avec leur nom CSS et une valeur par mode.

- **Créer une variable :** cliquez sur **Créer une variable** (ou sur **+**) et choisissez un type ; la nouvelle variable s’ouvre pour modification
- **Sélectionner :** cliquez sur une ligne, ou déplacez-vous avec les flèches et appuyez sur Entrée. Maj-clic sélectionne une plage, et Cmd-clic (Ctrl-clic sous Windows et Linux) ajoute ou retire une ligne
- **Filtrer :** saisissez du texte dans la barre de recherche pour filtrer par nom, nom CSS, description ou valeur, comme `--color-brand`, une couleur hexadécimale ou la variable visée par un alias, en tolérant les fautes de frappe comme la palette de commandes ; cliquez sur un groupe dans la barre latérale pour n’afficher que ce groupe et ceux qu’il contient, ou utilisez le bouton de filtre (**Filtrer par type**) pour n’afficher que certains types
- **Renommer ou modifier sur place :** double-cliquez sur un nom, ou sur une valeur numérique ou textuelle, dans la liste
- **Clic droit :** renommer, dupliquer (**Dupliquer**), déplacer vers un groupe ou un nouveau groupe (**Déplacer vers le groupe**, **Nouveau groupe…**) ou supprimer (**Supprimer les variables**) les variables sélectionnées ; Delete ou Backspace les supprime aussi
- **Réorganiser :** faites glisser une ligne ; l’ordre est conservé dans le fichier
- **Plusieurs sélectionnées :** la partie droite les déplace vers un groupe, les duplique ou les supprime
- **Annuler et rétablir :** Cmd+Z et Cmd+Maj+Z ou Cmd+Y (Ctrl sous Windows et Linux) agissent dans la boîte de dialogue comme sur le canevas, une étape par modification. Entrée valide un champ et revient à la liste ; tant qu’un champ contient du texte non validé, Cmd+Z annule la saisie

La sélection d’une variable permet de modifier :

- **Nom** et **Nom CSS** : laissez le nom CSS vide pour le déduire du nom et des portées, par exemple `--color-brand-primary`. Saisissez le nom sans son `--` ; un nom que CSS ne peut pas utiliser est signalé et n’est pas enregistré
- **Unité** : pour les nombres, `px`, `rem`, `%`, `ms`, `s`, `deg` ou aucune ; les valeurs sont saisies dans cette unité
- **Valeur** ou **Valeurs** : une par mode ; une couleur ouvre le sélecteur de couleur. Le bouton de variable (**Utiliser une variable**) à côté d’une valeur la fait pointer vers une autre variable du même type, un alias qui suit cette variable ; **Détacher la variable** la ramène à la valeur qu’elle affichait
- **Expression CSS** : pour les nombres, une valeur comme `clamp(1rem, 4vw, 1.5rem)` écrite en CSS à la place du nombre, tandis que le canevas continue de dessiner le nombre
- **Portées** : les propriétés pour lesquelles la variable est proposée
- **Description**
- **Masquer de la publication** : les fichiers qui utilisent celui-ci comme bibliothèque ne voient pas la variable

## Feuille de style

Le bas de la boîte de dialogue affiche la collection active sous forme de propriétés personnalisées CSS. Le bouton de copie (**Copier toutes les variables en CSS**) copie les variables de tout le document en CSS ou sous forme de thème Tailwind v4 (**Copier toutes les variables en thème Tailwind**), de sorte que les alias vers d’autres collections sont résolus.

## Importer et exporter des design tokens

Les variables et les styles circulent entre OpenPencil, Figma et le code sous forme de [design tokens W3C](https://www.designtokens.org/) :

- **Exporter :** dans le menu de copie de la feuille de style, choisissez **Exporter en design tokens**. Le zip contient un fichier par mode de collection, que Figma importe comme un mode ; les styles de texte et d’effet en tokens de typographie et d’ombre ; et un resolver qui les combine pour des outils comme Style Dictionary
- **Importer :** cliquez sur **Importer des design tokens** dans la barre d’outils et choisissez des fichiers de tokens ou un zip. Les fichiers de Figma, un resolver avec les fichiers qu’il nomme et les thèmes Tokens Studio fonctionnent
- **Choisir la destination :** avant tout changement, la boîte de dialogue montre chaque collection et chaque mode trouvés et où ils vont : dans une nouvelle collection ou un nouveau mode, dans un existant, ou nulle part. Les variables et les styles de même nom sont mis à jour et le reste est ajouté ; rien n’est supprimé. Elle compte ce qui sera ajouté, mis à jour et ignoré, et indique pourquoi chaque token ignoré a été écarté
- L’import est une seule étape : **Annuler** le reprend en entier

## Lier des variables aux remplissages

Dans la section Remplissage du panneau des propriétés, utilisez le sélecteur de variables pour lier une variable de couleur au remplissage d’un objet.

- **Lier :** choisissez une variable de couleur dans le sélecteur. Le remplissage affiche une pastille violette avec le nom de la variable.
- **Détacher :** cliquez sur le bouton de détachement de la pastille pour supprimer le lien. Le remplissage revient à la valeur de couleur résolue.

Lorsque la valeur de la variable change (ou lors d’un changement de mode), tous les remplissages liés sont mis à jour automatiquement.

## Conseils

- Utilisez des collections pour regrouper des tokens liés (par exemple `Primitives` pour les couleurs brutes, `Semantic` pour les alias par rôle et `Spacing` pour les valeurs de mise en page).
- Les modes sont utiles pour changer de thème : définissez les valeurs Clair et Sombre dans la même collection.
- Les variables prennent en charge les alias : une collection `Semantic` peut référencer des valeurs d’une collection `Primitives`.
- Consultez [Dessiner des formes](./drawing-shapes) pour le fonctionnement des remplissages et du sélecteur de couleur.
