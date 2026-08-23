---
title: Composants
description: Composants réutilisables, instances, ensembles, surcharges et bibliothèques.
---

# Composants

Les composants sont des objets réutilisables. Les changements du composant principal se propagent automatiquement à ses instances.

## Parcourir et insérer

L’onglet **Ressources** affiche les composants locaux et les bibliothèques activées. Il permet la recherche et l’affichage en grille ou en liste. Insérez un composant par clic, avec <kbd>Enter</kbd> ou par glisser-déposer. Les révisions téléchargées restent disponibles hors ligne.

## Créer un composant

Sélectionnez un cadre ou un groupe et appuyez sur <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> ; sous Windows et Linux, <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>K</kbd>.

## Créer une instance

Sélectionnez le composant et choisissez **Créer une instance**, ou insérez-le depuis Ressources. L’instance conserve un lien avec le composant principal.

## Surcharges

Les propriétés modifiées dans une instance sont enregistrées comme surcharges. Les changements ultérieurs du composant principal continuent d’arriver, sauf pour les propriétés surchargées.

## Propriétés de composant

Texte, visibilité booléenne, permutation d’instance et variantes sont pris en charge. Ces propriétés apparaissent à droite lorsqu’une instance est sélectionnée.

## Ensembles et variantes

Combinez des composants avec <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> ou <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>K</kbd>. Chaque dimension — état, taille, par exemple — peut avoir plusieurs valeurs. OpenPencil accepte les combinaisons éparses, empêche les doublons et choisit par défaut la variante située en haut à gauche.

## Synchronisation

Les changements du composant principal sont présentés dans une revue avant application. Les surcharges restent intactes. **Accéder au composant principal** fonctionne entre les pages et **Détacher l’instance** la convertit en cadre indépendant.

## Bibliothèques

Publiez les composants locaux comme bibliothèque et activez des bibliothèques externes dans Ressources. Les révisions sont conservées localement pour le travail hors ligne.
