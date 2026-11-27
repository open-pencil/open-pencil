---
pageClass: guide
title: Vérifier les designs
description: Repérez les problèmes d’accessibilité, de cohérence et de structure avec le panneau Vérifier et les repères de problèmes sur le canevas.
---

# Vérifier les designs

OpenPencil vérifie la page en cours pendant que vous travaillez et signale les calques qui enfreignent les règles de design courantes : texte difficile à lire, commandes trop petites pour être touchées, couleurs qui devraient utiliser une variable et espacements hors échelle.

## Trouver les problèmes

Ouvrez l’onglet **Vérifier** dans le panneau de droite. Son badge indique combien d’erreurs et d’avertissements la page contient.

<GuideImage name="checking-designs/lint" alt="Une carte d’inscription avec un texte pâle et petit et un petit bouton, ses repères de problèmes, et le panneau Vérifier qui liste un contraste faible, un texte trop petit et une cible tactile trop petite" />

- **Page** liste tous les problèmes de la page en cours ; **Sélection** limite la liste aux calques sélectionnés et à tout ce qu’ils contiennent ; **Document** liste les problèmes de toutes les pages, en signalant ceux qui se trouvent sur d’autres pages. Cliquer sur l’un d’eux ouvre sa page. Les pages d’un gros fichier `.fig` qui n’ont pas encore été ouvertes sont vérifiées dès que vous les ouvrez.
- Les problèmes sont regroupés par règle, les plus graves en premier. Les erreurs et les avertissements sont dépliés au départ ; les suggestions sont repliées.
- Les boutons de gravité sous le sélecteur de portée affichent ou masquent les erreurs, les avertissements et les suggestions.
- Survolez le titre d’un groupe pour lire ce que la règle vérifie et pourquoi.

Survolez un problème pour mettre son calque en évidence sur le canevas. Cliquez dessus pour sélectionner le calque ; s’il est hors de l’écran, le canevas se déplace jusqu’à lui, et ne dézoome que si le calque ne tient pas dans la vue.

## Corriger les problèmes

Les lignes corrigeables en une étape affichent un bouton au survol :

- Une couleur codée en dur qui correspond à l’une des variables de couleur du document se lie à celle-ci (bouton de lien). La ligne indique le nom de la variable.
- Les positions et tailles subpixel sont arrondies au pixel entier. Les valeurs définies par l’auto-layout ou le redimensionnement du texte, ainsi que les tracés vectoriels et les éléments des groupes, ne sont pas modifiés.
- Un rayon d’angle ou un espacement hors échelle passe à la valeur de l’échelle la plus proche, et un texte en dessous de la taille minimale est agrandi jusqu’à celle-ci (bouton baguette). Ces corrections modifient le design : elles s’appliquent donc une ligne à la fois.
- Un groupe est converti sur place en cadre, en conservant ses calques, sa position et son apparence (bouton cadre), et un calque masqué peut être supprimé (bouton corbeille). Aucune de ces deux corrections n’est proposée pour les calques verrouillés ou pour les calques situés dans un composant ou une instance, dont la structure appartient au composant.

Lier les couleurs et arrondir les pixels ne change pas l’apparence du design : leurs groupes proposent donc aussi **Tout lier** ou **Tout corriger**. Chaque correction s’annule en une seule étape.

Les autres problèmes affichent la valeur à revoir, comme un rapport de contraste ou la taille d’une cible tactile, pour que vous puissiez la corriger dans le panneau **Design**.

## Voir les problèmes sur le canevas

Les repères sur le canevas, les compteurs des pages et les marques du panneau **Calques** restent désactivés tant que vous ne les activez pas, pour qu’un fichier ouvert dans un nouveau profil ne soit pas couvert d’avertissements. Activez-les ou désactivez-les avec **Affichage → Problèmes de design**, ou avec **Afficher les problèmes sur le canevas** dans le menu des réglages du panneau **Vérifier**. Un profil qui a déjà enregistré ce choix le conserve.

Quand ils sont activés, les calques qui ont des erreurs ou des avertissements portent un repère dans leur coin supérieur droit : rouge pour les erreurs, orange pour les avertissements. Les suggestions n’apparaissent que dans le panneau **Vérifier**.

- Survolez un repère pour voir ses problèmes. Cliquez dessus pour sélectionner le calque et ouvrir ses problèmes dans le panneau **Vérifier**.
- Les repères qui se chevaucheraient fusionnent en un seul qui affiche leur total.
- Quand un calque est trop petit pour être visible au niveau de zoom actuel, son repère passe sur le calque parent le plus proche assez grand pour être désigné.
- Les erreurs et les avertissements situés hors de la partie visible du canevas sont épinglés sur son bord, en pointant dans leur direction. Survolez une épingle pour les voir ; cliquez dessus pour afficher le plus proche des plus graves et l’ouvrir dans **Vérifier**.
- Les calques masqués et les calques rognés hors de la vue par un cadre gardent leurs problèmes dans le panneau, mais n’ont pas de repère.

Les pages qui ont des erreurs ou des avertissements affichent leur nombre dans la liste des pages, vérifiée en arrière-plan pendant que vous travaillez. Le panneau **Calques** marque les mêmes calques : un calque qui a des erreurs ou des avertissements affiche le plus grave sous forme d’icône, et un calque replié qui contient des problèmes affiche un point. Ces marques suivent le même réglage que les repères du canevas.

## Voir les problèmes dans le code

L’onglet **Code** souligne les erreurs et les avertissements dans le Design JSX, le HTML, le Vue ou le React de leurs calques : sur la propriété qui cause le problème quand il y en a une, comme `size={10}` pour un texte trop petit, ou sur la classe qui met en forme le calque. Survolez le soulignement pour lire le problème. La page est vérifiée tant que le panneau **Vérifier** est ouvert ou que les repères du canevas sont activés, et les soulignements suivent cette vérification et vos modifications.

## Choisir les règles

Le menu des réglages du panneau **Vérifier** permet de passer d’un préréglage de règles à l’autre :

- **Recommandées** — des valeurs par défaut équilibrées pour le travail de tous les jours.
- **Strictes** — toutes les règles en avertissement ou en erreur.
- **Accessibilité** — uniquement le contraste, la taille des cibles tactiles et la taille du texte.

Désactivez une règle depuis le menu de son groupe. **Réactiver les règles désactivées**, dans le menu des réglages, les rétablit. Les préréglages et les règles désactivées sont conservés d’une session à l’autre.

Les mêmes règles s’exécutent en ligne de commande avec `openpencil lint` ; voir [Inspecter les fichiers](/fr/developers/cli/inspecting).
