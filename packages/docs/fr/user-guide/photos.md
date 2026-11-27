---
pageClass: guide
title: Photos
description: Remplissez un calque avec une photo de stock gratuite d’Unsplash ou de Pexels dans OpenPencil.
---

# Photos

OpenPencil cherche dans les photothèques gratuites d’[Unsplash](https://unsplash.com) et de [Pexels](https://www.pexels.com) depuis le remplissage image d’un calque. Les deux permettent à chacun d’utiliser leurs photos gratuitement, et les deux demandent une clé API, gratuite elle aussi, pour y faire des recherches. La clé reste sur votre appareil.

Chercher et utiliser des photos nécessite une connexion réseau au service dans lequel vous cherchez.

## Remplir un calque avec une photo

Dessinez le cadre ou la forme que la photo doit remplir, puis :

1. Ouvrez son remplissage et passez-le en **Image**.
2. Choisissez **Photo de stock** dans l’aperçu.
3. Avant que vous tapiez quoi que ce soit, le sélecteur affiche la sélection du service : le fil éditorial d’Unsplash ou les photos choisies par Pexels. Tapez ce que vous cherchez, comme `mountains` ou `coffee` ; d’autres résultats se chargent quand vous faites défiler. Survolez une photo, ou atteignez-la avec les flèches du clavier, pour voir qui l’a prise.
4. Choisissez-en une. Elle devient le remplissage image du calque et garde le mode d’échelle du remplissage : **Fill**, **Fit**, **Crop** et **Tile** s’y appliquent comme à n’importe quelle image.

Le bouton du service, dans l’en-tête du sélecteur, permet de passer d’Unsplash à Pexels. Le sélecteur s’ouvre sur le dernier service utilisé, ou sur un service doté d’une clé si le dernier n’en a pas. Tant qu’un service n’a pas de clé, le sélecteur l’indique : choisissez **Ouvrir les Réglages**, ouvrez le service dans **Paramètres → Médias**, suivez **Obtenir une clé API** pour en créer une, collez-la et choisissez **Enregistrer**. **Tester la connexion** essaie la clé saisie, ou celle enregistrée, avec une seule requête au service.

Une application Unsplash a deux clés : collez sa **Access Key**, pas sa clé secrète. Une nouvelle application Unsplash a droit à 50 requêtes par heure tant qu’Unsplash ne l’a pas approuvée pour la production ; chaque recherche, chaque page de résultats et chaque test compte.

Pexels a suspendu la délivrance de nouvelles clés API. Si vous avez déjà une clé Pexels, elle fonctionne toujours ; sinon, utilisez Unsplash.

## Crédits et clés

Unsplash et Pexels demandent que les photos soient créditées à leurs auteurs ; le sélecteur indique le photographe de chaque photo. OpenPencil prévient Unsplash quand l’une de ses photos est utilisée, comme l’exigent les conditions de son API.

Modifiez ou supprimez les clés dans **Paramètres → Médias**. L’outil de photos de stock du chat IA utilise les mêmes clés.
