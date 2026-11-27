---
pageClass: guide
title: Bibliothèques de composants
description: Publiez les composants, styles et variables d’un fichier, utilisez-les dans d’autres et récupérez leurs mises à jour.
---

# Bibliothèques de composants

Une bibliothèque partage les composants, styles et variables d’un fichier avec vos autres fichiers. Chaque publication enregistre une nouvelle version. Les fichiers qui utilisent la bibliothèque choisissent quand la récupérer.

## Publier une bibliothèque

1. Ouvrez le fichier qui contient les composants à partager.
2. Ouvrez **Ressources**, puis cliquez sur **Gérer les bibliothèques** à côté du champ de recherche.
3. Cliquez sur **Publier la bibliothèque**.
4. La première fois, donnez à la bibliothèque un identifiant et un nom. L’identifiant ne pourra plus changer.
5. Cochez les modifications à publier et ajoutez une description si vous le souhaitez.
6. Cliquez sur **Publier la bibliothèque**.

<GuideImage name="component-libraries/publish" alt="Publier la bibliothèque avec l’identifiant acme-ui, le nom Acme UI et le composant Button coché" />

Une bibliothèque contient toujours tous les styles et toutes les collections de variables du fichier. Les modifications laissées décochées attendent la publication suivante.

## Utiliser une bibliothèque

1. Ouvrez **Ressources → Gérer les bibliothèques** dans le fichier qui en a besoin.
2. Activez la bibliothèque dans **Parcourir les bibliothèques**.
3. Placez ses composants depuis **Ressources**, comme vous placez les vôtres.

Un composant apporte les styles et les variables qu’il utilise. Ils ne sont pas modifiables ici : modifiez-les dans le fichier de la bibliothèque et publiez de nouveau. Les instances restent modifiables comme toutes les autres.

## Passer à une nouvelle version

Ouvrez **Gérer les bibliothèques → Mises à jour** pour voir ce qui a changé. Rien ne change dans votre fichier tant que vous ne l’avez pas décidé.

1. Comparez une instance avant et après la mise à jour.
2. Mettez à jour l’instance sélectionnée, toutes les instances de ce composant, les instances de cette page, ou toutes.

Les instances conservent les modifications que vous leur avez apportées, y compris sur les calques que la bibliothèque a renommés. Elles ne perdent que les modifications des calques que la bibliothèque a supprimés. Quand la variante d’une instance n’existe plus dans la nouvelle version, la revue indique la variante de remplacement utilisée. **Annuler** revient sur une mise à jour.

## Où se trouvent les bibliothèques

Les bibliothèques **Locale** restent dans ce navigateur ou cette application. Les bibliothèques **Stockage** se trouvent dans le [bucket compatible S3](./cloud-storage) que vous avez configuré, pour que d’autres personnes puissent les utiliser. Passez de l’un à l’autre en haut de **Parcourir les bibliothèques**.

Les versions que vous avez utilisées sont conservées sur votre ordinateur : leurs composants restent visibles et peuvent être placés même hors ligne. Un fichier garde, à l’enregistrement, les versions de bibliothèque qu’il utilise, et s’ouvre de la même façon même quand la bibliothèque est inaccessible.
