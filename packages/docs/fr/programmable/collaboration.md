---
title: Collaboration
description: Édition collaborative en temps réel via P2P WebRTC — sans serveur, sans compte.
---

# Collaboration

Éditez des designs ensemble en temps réel. Les pairs se connectent directement — aucun serveur ne relaie vos données, aucun compte n'est requis.

## Partager une salle

1. Cliquez sur le bouton de partage dans le coin supérieur droit
2. Copiez le lien généré (`app.openpencil.dev/share/<room-id>`)
3. Envoyez-le à vos collaborateurs

Toute personne ayant le lien peut rejoindre la salle. La salle reste active tant qu'au moins un participant a la page ouverte.

## Ce qui se synchronise

- **Modifications du document** — chaque modification (formes, texte, propriétés, mise en page) se synchronise instantanément
- **Curseurs** — voyez où chaque collaborateur pointe, avec son nom et sa couleur
- **Sélections** — les sélections en surbrillance sont visibles par tous

## Mode suivi

Cliquez sur l'avatar d'un collaborateur dans la barre supérieure pour suivre son viewport. Votre canevas se déplace et zoome pour correspondre à sa vue. Cliquez à nouveau pour arrêter de suivre.

## Comment ça fonctionne

Les pairs se connectent directement via WebRTC — vos données de design passent directement d'un navigateur à l'autre, jamais par un serveur central. L'état du document utilise un CRDT (type de données répliqué sans conflit), donc les modifications concurrentes fusionnent automatiquement sans conflits.

La salle persiste localement — si vous rafraîchissez la page, vous rejoignez avec le même état.

## Conseils

- Fonctionne dans le navigateur et l'application de bureau
- Les identifiants de salle sont cryptographiquement aléatoires — seules les personnes ayant le lien peuvent rejoindre
- Les curseurs obsolètes sont nettoyés automatiquement lorsqu'un participant se déconnecte
