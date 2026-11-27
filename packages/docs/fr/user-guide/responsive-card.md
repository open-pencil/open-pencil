---
pageClass: guide
title: Créer une carte adaptative
description: "Un premier projet dans OpenPencil, pas à pas : une fiche produit dont le texte passe à la ligne et dont la hauteur suit le contenu, quelle que soit la largeur."
---

# Créer une carte adaptative

Dans ce projet, vous créez une fiche produit qui s’adapte : rendez-la plus étroite ou plus large, et sa photo s’étire, son texte passe à la ligne et sa hauteur suit. Comptez une dizaine de minutes ; vous y utiliserez les outils dont vous vous servirez le plus.

<GuidePair>

<GuideImage name="responsive-card/narrow" alt="La carte terminée, large de 240, avec sa description sur trois lignes" caption="240 de large" />
<GuideImage name="responsive-card/wide" alt="La même carte, large de 420, avec sa description sur deux lignes" caption="420 de large" />

</GuidePair>

## 1. Ajouter les éléments

Commencez par un nouveau fichier : **Fichier → Nouveau design**, ou <Keys mac="⌘ N" other="Ctrl N" />.

1. Appuyez sur <Keys mac="R" other="R" /> et tracez un rectangle d’environ 280 de large sur 160 de haut. Il accueillera la photo.
2. Appuyez sur <Keys mac="T" other="T" />, cliquez sous le rectangle et saisissez le nom : *Mug en céramique*. Appuyez sur <Keys mac="Esc" other="Esc" />.
3. Ajoutez de la même façon deux autres textes en dessous : une description, comme *Tourné à la main en petites séries, il garde votre café chaud plus longtemps*, et *Ajouter au panier*.

Gardez les quatre éléments en colonne, bords gauches à peu près alignés.

<GuideImage name="responsive-card/parts" alt="Un rectangle et trois textes en colonne approximative sur le canevas" />

## 2. Les placer dans une carte

1. Appuyez sur <Keys mac="⌘ A" other="Ctrl A" /> pour sélectionner les quatre éléments.
2. Appuyez sur <Keys mac="⇧ A" other="Shift A" />. Ils sont placés dans un nouveau cadre avec [auto-layout](./auto-layout), qui les dispose les uns après les autres.
3. Dans le panneau **Design**, sous **Flux**, choisissez le bouton colonne, **Disposition verticale**, si les éléments se sont placés en ligne.
4. Réglez l’espacement entre les éléments sur **12** et les marges intérieures sur **20**.
5. Cliquez sur **+** à côté de **Remplissage** pour donner un fond à la carte, et réglez **Rayon** sur **16**.
6. Double-cliquez sur le nom du cadre dans la liste des calques et nommez-le *Card*.

## 3. Laisser les éléments s’étirer

1. Réglez le **W** de la carte sur **320**.
2. Sélectionnez le rectangle. Ouvrez le menu de son champ **W** et choisissez **Remplir** : il prend la largeur de la carte, à l’intérieur des marges.
3. Faites de même pour le nom et la description. La description passe à la ligne au lieu de dépasser du bord de la carte.

La hauteur de la carte suit d’elle-même son contenu. Essayez maintenant : faites glisser le bord droit de la carte, ou saisissez un autre **W**. La photo s’étire, la description passe à la ligne, et la carte s’agrandit ou rétrécit pour s’ajuster.

## 4. Créer un bouton

1. Sélectionnez *Ajouter au panier* et appuyez sur <Keys mac="⇧ A" other="Shift A" />. Le texte est placé dans son propre cadre.
2. Donnez à ce cadre un remplissage bleu, des marges intérieures de **16** sur les côtés et de **10** en haut et en bas, et un **Rayon** de **10**. Mettez le texte en blanc.
3. Appuyez sur <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" /> pour faire du bouton un [composant](./components) et pouvoir le réutiliser.

## 5. Ajouter une photo

1. Sélectionnez le rectangle et cliquez sur le carré de couleur sous **Remplissage**.
2. Cliquez sur le bouton image en haut du sélecteur, puis sur **Choose image** pour utiliser une image de votre ordinateur, ou sur **Photo de stock** pour [en trouver une](./photos).

La photo remplit le rectangle, quelle que soit sa largeur.

## 6. Vérifier et partager

- Ouvrez l’onglet **Vérifier** pour [contrôler la carte](./checking-designs) et repérer les problèmes, comme un texte difficile à lire.
- [Exportez-la](./exporting) en PNG, ou faites un clic droit dessus et choisissez **Copier/Coller en tant que → Copier en PNG** pour la coller dans une discussion.
- Demandez une variante à l’[IA](./ai-chat) : *« Crée une version sombre de cette carte. »*

## Pour aller plus loin

- [Mise en page auto](./auto-layout) : lignes, grilles, retour à la ligne et les autres façons dont les calques se redimensionnent.
- [Composants](./components) : variantes, propriétés et instances.
- [Variables](./variables) : des couleurs et des tailles définies une seule fois, avec des modes sombre et clair.
