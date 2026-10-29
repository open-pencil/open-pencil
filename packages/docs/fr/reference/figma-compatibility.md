# Compatibilité avec Figma

Comparaison entre les fonctions de Figma Design et l’état actuel d’OpenPencil.

::: tip État
✅ Pris en charge — fonctionne de bout en bout · 🟡 Partiel — le comportement principal existe, mais certaines fonctions manquent · 🔲 Non implémenté
:::

**Couverture :** 128 fonctions sur 156 examinées — 112 ✅ complètes, 16 🟡 partielles et 28 🔲 en attente. Mise à jour : 2026-10-27.

## Interface et navigation

| Fonction | État | Notes |
|----------|------|-------|
| Barre d’outils | ✅ | Barre inférieure de style UI3 : Déplacement, Cadre/Section, formes, Plume/Crayon, Texte, Main et Commentaire ; personnalisable, avec sélecteur d’icônes |
| Panneau Calques | ✅ | Arbre dépliable, réordonnancement par glissement, visibilité et largeur réglable |
| Panneau Pages | ✅ | Créer, supprimer et renommer des pages ; état de vue indépendant |
| Panneau Propriétés | ✅ | Apparence, remplissage, contour, effets, typographie, disposition, grilles de disposition, contraintes, position, masque, propriétés de composant, couleurs de la sélection et export ; largeur réglable |
| Zoom et déplacement | ✅ | Molette, pincement, raccourcis, <kbd>Space</kbd> + glissement, bouton central et Main |
| Règles | ✅ | Règles supérieure et gauche avec plage de sélection et coordonnées |
| Arrière-plan | ✅ | Fond propre à chaque page |
| Repères | ✅ | Repères tirés des règles sur la zone de travail ou les cadres ; sélection, déplacement, duplication, suppression et annulation ; enregistrés dans le `.fig` |
| Palette de commandes | ✅ | <kbd>⌘</kbd><kbd>K</kbd> ouvre une palette de recherche des actions de l’éditeur et de l’application |
| Menu contextuel | ✅ | Presse-papiers, ordre, groupes, composants, visibilité, verrouillage et changement de page |
| Raccourcis | 🟡 | Outils, édition, booléens, aplatissement, masques, composants, alignement, ordre, navigation et mise en forme du texte ; pas de Mise à l’échelle (<kbd>K</kbd>), Flèche, Pipette (<kbd>I</kbd>) ni outil Zoom |
| Rechercher et remplacer | 🔲 | Pas de recherche globale de texte |
| Vue filaire | 🔲 | Pas de contours de tous les calques |
| Miniature personnalisée | 🔲 | Les fichiers enregistrés montrent leur première page, comme Figma sans page de couverture ; pas de choix de miniature |
| Pas de déplacement | 🔲 | 1 px et 10 px ; pas de valeurs personnalisées |
| Menu de l’application | ✅ | Menus dans le navigateur et menus natifs Tauri |
| Outils AI | 🟡 | 126 outils dans le chat AI, les agents de code (ACP) et MCP ; photos libres de droits et vectorisation d’images ; pas de génération d’images ni de recherche AI |

## Calques et formes

Formes de base, cadres, groupes, sections, arcs, masques, hiérarchie, sélection, alignement, copier-coller, verrouillage, visibilité, ordre, déplacement entre pages, contraintes, grilles de disposition, mesure de distances, édition multiple et copie de propriétés sont pris en charge. La mise à l’échelle proportionnelle n’a pas d’outil dédié (<kbd>K</kbd>) et la sélection intelligente se limite à aligner et répartir. La recherche de calques similaires manque encore.

## Outils vectoriels

Réseaux vectoriels, outils Plume et Crayon, opérations booléennes, aplatissement et conversion des contours ou du texte en tracés sont pris en charge. L’édition des sommets reste partielle : pas de symétrie par point ni de réglage des angles. Construction de formes, décalage et simplification ne sont pas encore disponibles.

## Texte et typographie

Édition directe, rendu CanvasKit Paragraph, polices système, choix de famille, taille, interligne, alignement horizontal et vertical, modes de redimensionnement, listes, emoji, CJK, RTL et polices d’icônes fonctionnent. Les polices variables fonctionnent aussi, avec leurs axes réglables dans le panneau. Le texte sur un tracé reste partiel, car modifier ses caractères demande les contours de sa police en local. Styles de texte, liens et fonctions OpenType le sont aussi : il leur manque surtout des réglages dans le panneau.

## Couleurs, dégradés et images

Sélecteur de couleur avec champs RGB, HSL, HSB et OkHCL, couleurs unies, dégradés linéaire, radial, angulaire et diamant, remplissages d’image, modes de fusion et couleurs de la sélection sont pris en charge. Les motifs importés s’affichent sans pouvoir être créés, l’import d’images exclut la vidéo et le recadrage n’a pas de poignées sur la zone de travail. Réglages d’image et pipette manquent encore.

## Effets et propriétés

Ombres, flous, épaisseur de contour, extrémités, jointures, tirets, alignement du contour, rayons et lissage des angles ainsi que l’empilement de plusieurs remplissages et contours sont pris en charge.

## Disposition automatique

Flexbox, Grid, direction, espacement, marges intérieures, alignement, modes de taille, retour à la ligne, dispositions imbriquées, réordonnancement par glissement et dimensions minimales et maximales sont pris en charge.

## Composants et systèmes de design

Composants, ensembles, instances, variantes, propriétés, surcharges, variables des quatre types avec leurs collections et modes, et bibliothèques sont pris en charge. Les styles nommés s’appliquent et se détachent, mais aucune interface ne permet encore d’en créer ou d’en modifier.

## Prototypage

Connexions, déclencheurs, actions, animations, superpositions, défilement, parcours, logique conditionnelle et mode de présentation ne sont pas encore disponibles.

## Importation et exportation

| Fonction | État | Notes |
|----------|------|-------|
| Importer `.fig` | ✅ | Codec Kiwi avec 605 définitions de schéma et environ 590 champs par `NodeChange` |
| Exporter `.fig` | ✅ | Kiwi, Zstd et miniature ; composants conservés pour les allers-retours |
| Enregistrer / Enregistrer sous | ✅ | Dialogues natifs, File System Access API et téléchargement de repli dans Safari |
| Coller depuis Figma | ✅ | Décode le binaire Kiwi du presse-papiers |
| Copier vers Figma | ✅ | Produit un binaire Kiwi lisible par Figma |
| Importer Sketch | 🔲 | Pas d’analyseur `.sketch` |
| Export image/SVG/PDF | ✅ | PNG, JPG, WEBP, SVG, PDF avec polices intégrées lorsque leurs fichiers peuvent l’être, PPTX et draw.io |
| Historique des versions | 🟡 | Documents OpenPencil Cloud (en préversion) : versions nommées, consultation, aperçu, restauration et duplication ; pas pour les fichiers locaux |
| Ressources entre outils | ✅ | Presse-papiers Figma et copie en texte/SVG/PNG/JSX |

## API de plugins et scripts

| Fonction | État | Notes |
|----------|------|-------|
| `eval` avec Figma Plugin API | ✅ | JavaScript sans interface avec objet global `figma` compatible |

## Collaboration et mode développement

| Fonction | État | Notes |
|----------|------|-------|
| Commentaires | ✅ | L’outil Commentaire (<kbd>C</kbd>) épingle des fils aux calques, avec réponses, résolution et liste filtrable ; enregistrés dans le `.fig` |
| Multijoueur | ✅ | Salles pair à pair (Trystero et Yjs) avec curseurs, suivi de vue, appels vocaux et curseurs d’agents ; sans serveur |
| Chat de curseur | 🔲 | Pas de bulles dans la zone de travail |
| Branches et fusions | 🔲 | Pas de branches de versions |
| Mode développement | 🟡 | L’onglet Code affiche la sélection en design JSX, HTML, Vue ou React avec CSS ou Tailwind ; statuts « Prêt pour le dev » ; pas de mode d’inspection avec cotes |
| Code Connect | 🔲 | Pas de liaison entre composants de design et code |
| Extraits de code | 🟡 | Design JSX, HTML, Vue et React avec CSS ou Tailwind et valeurs liées aux tokens ; pas de Swift, Kotlin ni Compose |
| Tailwind CSS v4 | ✅ | HTML avec classes utilitaires depuis Code, la CLI ou l’API |
| Figma pour VS Code | 🔲 | Pas d’intégration à l’extension de l’éditeur |
| Serveur MCP | ✅ | `@open-pencil/mcp` avec stdio et HTTP ; 125 outils du cœur plus des outils de document, d’historique et de réglages |
| CLI | ✅ | 24 commandes, dont `info`, `tree`, `find`, `query`, `node`, `pages`, `variables`, `tokens`, `fonts`, `lint`, `analyze`, `export`, `import`, `convert`, `diff`, `eval` et `tool` |

## Figma Draw

Les outils d’illustration spécialisés et les transformations de motifs ne sont pas encore disponibles.
