# Compatibilité avec Figma

Comparaison entre les fonctions de Figma Design et l’état actuel d’OpenPencil.

::: tip État
✅ Pris en charge — fonctionne de bout en bout · 🟡 Partiel — le comportement principal existe, mais certaines fonctions manquent · 🔲 Non implémenté
:::

**Couverture :** 94 fonctions sur 158 examinées — 76 ✅ complètes, 18 🟡 partielles et 64 🔲 en attente. Mise à jour : 2026-03-07.

## Interface et navigation

| Fonction | État | Notes |
|----------|------|-------|
| Barre d’outils | ✅ | Barre inférieure de style UI3 : Sélection, Cadre, Section, Rectangle, Ellipse, Ligne, Texte, Main et Plume |
| Panneau Calques | ✅ | Arbre dépliable, réordonnancement par glissement, visibilité et largeur réglable |
| Panneau Pages | ✅ | Créer, supprimer et renommer des pages ; état de vue indépendant |
| Panneau Propriétés | ✅ | Apparence, remplissage, contour, effets, typographie, disposition et position |
| Zoom et déplacement | ✅ | Molette, pincement, raccourcis, <kbd>Space</kbd> + glissement, bouton central et Main |
| Règles | ✅ | Règles supérieure et gauche avec plage de sélection et coordonnées |
| Arrière-plan | ✅ | Fond propre à chaque page |
| Repères | 🔲 | Pas de repères à faire glisser depuis les règles |
| Palette de commandes | 🔲 | Pas de recherche rapide d’actions |
| Menu contextuel | ✅ | Presse-papiers, ordre, groupes, composants, visibilité, verrouillage et changement de page |
| Raccourcis | 🟡 | Principaux raccourcis présents ; certaines fonctions manquent |
| Rechercher et remplacer | 🔲 | Pas de recherche globale de texte |
| Vue filaire | 🔲 | Pas de contours de tous les calques |
| Miniature personnalisée | 🔲 | Générée à l’export, mais non configurable |
| Pas de déplacement | 🔲 | 1 px et 10 px ; pas de valeurs personnalisées |
| Menu de l’application | ✅ | Menus dans le navigateur et menus natifs Tauri |
| Outils AI | 🟡 | 90 outils ; pas d’images générées ni de recherche AI |

## Calques et formes

Formes de base, cadres, groupes, sections, arcs, hiérarchie, sélection, alignement, copier-coller, verrouillage, visibilité, ordre, déplacement entre pages et édition multiple sont pris en charge. Crayon, masques, contraintes, sélection intelligente, grilles de disposition, mesure de distances et copie de propriétés restent absents ou partiels.

## Outils vectoriels

Les réseaux vectoriels et l’outil Plume sont pris en charge. L’édition avancée des sommets reste partielle. Opérations booléennes, aplatissement, conversion des contours ou du texte, construction de formes, décalage et simplification ne sont pas encore disponibles.

## Texte et typographie

Édition directe, rendu CanvasKit Paragraph, polices système, choix de famille, taille, interligne et alignement de base fonctionnent. Alignement vertical, dimensions automatiques, listes, liens, fonctions OpenType, polices variables et prise en charge complète CJK/RTL restent manquants ou partiels.

## Couleurs, dégradés et images

Couleurs unies, dégradés linéaire, radial, angulaire et diamant, ainsi que remplissages d’image sont pris en charge. Motifs, modes de fusion, vidéo, réglages d’image, recadrage interactif, pipette et édition commune des couleurs manquent encore.

## Effets et propriétés

Ombres, flous, épaisseur de contour, extrémités, jointures, tirets, alignement du contour et rayons des angles sont pris en charge. Le lissage continu des angles et l’empilement de plusieurs remplissages ou contours ne le sont pas.

## Disposition automatique

Flexbox, Grid, direction, espacement, marges intérieures, alignement, modes de taille, retour à la ligne, dispositions imbriquées et réordonnancement par glissement sont pris en charge. Les dimensions minimales et maximales manquent.

## Composants et systèmes de design

Composants, ensembles, instances, variantes, propriétés, surcharges, variables et bibliothèques sont pris en charge. Les styles nommés manquent ; certains types de variables n’ont pas encore une interface complète.

## Prototypage

Connexions, déclencheurs, actions, animations, superpositions, défilement, parcours, logique conditionnelle et mode de présentation ne sont pas encore disponibles.

## Importation et exportation

| Fonction | État | Notes |
|----------|------|-------|
| Importer `.fig` | ✅ | Codec Kiwi avec 194 définitions et environ 390 champs par `NodeChange` |
| Exporter `.fig` | ✅ | Kiwi, Zstd et miniature ; composants conservés pour les allers-retours |
| Enregistrer / Enregistrer sous | ✅ | Dialogues natifs, File System Access API et téléchargement de repli dans Safari |
| Coller depuis Figma | ✅ | Décode le binaire Kiwi du presse-papiers |
| Copier vers Figma | ✅ | Produit un binaire Kiwi lisible par Figma |
| Importer Sketch | 🔲 | Pas d’analyseur `.sketch` |
| Export image/SVG/PDF | 🟡 | PNG, JPG, WEBP et SVG ✅ ; PDF 🔲 |
| Historique des versions | 🔲 | Pas de consultation ni restauration |
| Ressources entre outils | ✅ | Presse-papiers Figma et copie en texte/SVG/PNG/JSX |

## API de plugins et scripts

| Fonction | État | Notes |
|----------|------|-------|
| `eval` avec Figma Plugin API | ✅ | JavaScript sans interface avec objet global `figma` compatible |

## Collaboration et mode développement

| Fonction | État | Notes |
|----------|------|-------|
| Commentaires | 🔲 | Pas de repères, fils de discussion ni résolution |
| Multijoueur | ✅ | P2P avec Trystero et Yjs CRDT, curseurs et suivi de vue ; sans serveur |
| Chat de curseur | 🔲 | Pas de bulles dans la zone de travail |
| Branches et fusions | 🔲 | Pas de branches de versions |
| Mode développement | 🟡 | L’onglet Code affiche JSX ; pas de propriétés CSS ni spécifications de transmission |
| Code Connect | 🔲 | Pas de liaison entre composants de design et code |
| Extraits de code | 🟡 | JSX avec coloration et copie ; pas de Swift/Kotlin |
| Tailwind CSS v4 | ✅ | HTML avec classes utilitaires depuis Code, la CLI ou l’API |
| Figma pour VS Code | 🔲 | Pas d’intégration à l’extension de l’éditeur |
| Serveur MCP | ✅ | `@open-pencil/mcp` avec stdio et HTTP ; 90 outils au total |
| CLI | ✅ | `info`, `tree`, `find`, `export`, `analyze`, `node`, `pages`, `variables` et `eval` |

## Figma Draw

Les outils d’illustration spécialisés et les transformations de motifs ne sont pas encore disponibles.
