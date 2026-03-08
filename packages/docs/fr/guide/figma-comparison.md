# Matrice de fonctionnalités Figma

Comparaison fonctionnalité par fonctionnalité des capacités de Figma Design avec l'état d'implémentation actuel d'Open Pencil.

::: tip Légende des statuts
✅ Supporté — la fonctionnalité est complète · 🟡 Partiel — le comportement de base existe, certaines sous-fonctionnalités manquent · 🔲 Pas encore implémenté
:::

**Couverture :** 94 des 158 éléments Figma traités — 76 ✅ entièrement supportés, 18 🟡 partiels, 64 🔲 en attente. Dernière mise à jour : 2026-03-07.

## Interface et navigation

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Barre d'outils de design | ✅ | Barre inférieure (style UI3) : Sélection, Frame, Section, Rectangle, Ellipse, Ligne, Texte, Main, Plume |
| Panneau des calques (barre latérale gauche) | ✅ | Vue en arbre avec expansion/réduction, réordonnancement par glissement, toggle de visibilité ; largeur redimensionnable |
| Panneau des pages | ✅ | Ajouter, supprimer, renommer des pages ; état viewport par page |
| Panneau de propriétés (barre latérale droite) | ✅ | Sections : Apparence, Remplissage, Contour, Effets, Typographie, Layout, Position ; largeur redimensionnable |
| Zoom et défilement | ✅ | <kbd>Ctrl</kbd> + scroll, pinch, <kbd>⌘</kbd><kbd>+</kbd> / <kbd>⌘</kbd><kbd>−</kbd> / <kbd>⌘</kbd><kbd>0</kbd>, espace+glisser, souris milieu, outil main (H) |
| Règles du canevas | ✅ | Règles haut/gauche avec bandes de sélection et badges de coordonnées |
| Couleur de fond du canevas | ✅ | Fond par page via le panneau de propriétés |
| Guides du canevas | 🔲 | Figma supporte des guides glissables depuis les règles |
| Menu d'actions / palette de commandes | 🔲 | Recherche d'actions rapides de Figma |
| Menu contextuel | ✅ | Clic droit avec presse-papiers, ordre-z, groupement, composant, visibilité, verrouillage, déplacer-vers-page |
| Raccourcis clavier | 🟡 | Raccourcis de base + composants + ordre-z + visibilité/verrouillage implémentés ; Échelle, Flèche, Crayon, retournement, formatage texte pas encore câblés |
| Rechercher et remplacer | 🔲 | Recherche/remplacement de texte dans le document |
| Vue des contours de calques | 🔲 | Vue filaire de tous les calques |
| Miniatures personnalisées | 🔲 | Miniature générée à l'export, mais pas de sélecteur personnalisé |
| Réglages de valeur de nudge | 🔲 | Défaut 1px/10px ; Figma permet des valeurs personnalisées |
| Menu de l'app (mode navigateur) | ✅ | Menus Fichier, Édition, Affichage, Objet, Texte, Disposition ; Tauri utilise les menus natifs |
| Outils IA | 🟡 | 90 outils via OpenRouter + serveur MCP ; pas d'images générées par IA ni de recherche IA encore |

## Calques et formes

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Outils de forme (Rectangle, Ellipse, Ligne, Polygone, Étoile) | ✅ | Tous les types de forme de base ; côtés du polygone et rayon intérieur de l'étoile configurables |
| Frames | ✅ | Découpe du contenu, système de coordonnées indépendant |
| Groupes | ✅ | <kbd>⌘</kbd><kbd>G</kbd> pour grouper, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> pour dégrouper |
| Sections | ✅ | Pilules de titre, auto-adoption des nœuds superposés, texte adaptatif à la luminance |
| Outil arc (arcs, demi-cercles, anneaux) | ✅ | arcData avec angle début/fin et rayon intérieur |
| Outil crayon (main levée) | 🔲 | Outil de dessin à main levée de Figma |
| Masques | 🔲 | Masques de forme pour découper les calques |
| Types de calques et hiérarchie | ✅ | 17 types de nœuds, Map plat + arbre parent-enfant |
| Sélectionner des calques | ✅ | Clic, shift-clic, sélection par marquise |
| Alignement et position | ✅ | Position, rotation, dimensions dans le panneau |
| Copier et coller des objets | ✅ | Presse-papiers standard + format binaire Kiwi de Figma |
| Mettre à l'échelle proportionnellement | 🟡 | Shift-redimensionner contraint les proportions ; pas d'outil Scale dédié (K) |
| Verrouiller et déverrouiller des calques | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> toggle le verrouillage |
| Basculer la visibilité | ✅ | Icône œil dans le panneau + raccourci <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> |
| Renommer des calques | ✅ | Double-clic renommage inline ; Entrée/Échap/clic pour valider |
| Mettre au premier plan / Envoyer en arrière | ✅ | Raccourcis ] et [ ; aussi dans le menu contextuel |
| Déplacer vers une page | ✅ | Déplacer les nœuds entre pages via menu contextuel |
| Contraintes (redimensionnement réactif) | 🔲 | Épingler bords/centre pour le comportement de resize parent |
| Sélection intelligente (distribuer/aligner) | 🔲 | Espacer et aligner uniformément |
| Guides de layout (colonnes, lignes, grille) | 🔲 | Guides colonne/ligne/grille sur les frames |
| Mesurer les distances entre calques | 🔲 | Alt-survol pour afficher les distances |
| Éditer des objets en lot | ✅ | Panneau multi-sélection : valeurs partagées affichées normalement, valeurs différentes affichent « Mixed » |
| Identifier les objets similaires | 🔲 | Trouver des calques similaires |
| Copier/coller des propriétés | 🔲 | Copier remplissage/contour/effets entre calques |
| Relations parent-enfant | ✅ | Hiérarchie complète avec parentIndex, re-parentage par glissement |

## Outils vectoriels

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Réseaux vectoriels | ✅ | Modèle compatible Figma, pas de chemins simples |
| Outil plume | ✅ | Points d'angle, courbes de Bézier, chemins ouverts/fermés |
| Éditer des calques vectoriels | 🟡 | Création fonctionne ; édition avancée de sommets limitée |
| Opérations booléennes (Union, Soustraction, Intersection, Exclusion) | 🔲 | Combiner des formes avec des opérations booléennes |
| Aplatir des calques | 🔲 | Fusionner les chemins vectoriels |
| Convertir les contours en chemins | 🔲 | Commande Outline Stroke |
| Convertir le texte en chemins | 🔲 | Aplatir le texte en contours vectoriels |
| Outil shape builder | 🔲 | Outil booléen interactif |
| Décalage de chemin | 🔲 | Inset/outset d'un chemin vectoriel |
| Simplifier le chemin | 🔲 | Réduire le nombre de points vectoriels |

## Texte et typographie

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Outil texte et édition en ligne | ✅ | Édition native sur canevas, textarea phantom, style runs (<kbd>⌘</kbd><kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd>, bouton S) |
| Rendu de texte (Paragraph API) | ✅ | CanvasKit Paragraph pour le façonnage, les sauts de ligne, les métriques |
| Chargement de polices (polices système) | ✅ | Inter par défaut, font-kit dans Tauri avec cache OnceLock, queryLocalFonts dans le navigateur |
| Famille et graisse de police | ✅ | FontPicker avec défilement virtuel, recherche, aperçu CSS |
| Taille de police et interligne | ✅ | Éditable dans la section typographie |
| Alignement du texte | 🟡 | Alignement de base ; Figma a l'alignement vertical et les modes auto-largeur/hauteur |
| Styles de texte | 🟡 | Gras/italique/souligné/barré par sélection ; pas de presets réutilisables encore |
| Modes de redimensionnement du texte | 🔲 | Modes auto-largeur, auto-hauteur, taille-fixe de Figma |
| Listes à puces et numérotées | 🔲 | Formatage de listes dans le texte |
| Liens dans le texte | 🔲 | Hyperliens dans le contenu texte |
| Emojis et symboles intelligents | 🔲 | Rendu d'émojis et caractères spéciaux |
| Fonctionnalités OpenType | 🔲 | Ligatures, alternatives stylistiques, chiffres tabulaires |
| Polices variables | 🔲 | Axes de police ajustables (graisse, largeur, inclinaison) |
| Support texte CJK | 🔲 | Rendu du texte chinois, japonais, coréen |
| Support texte RTL | 🔲 | Mise en page de texte de droite à gauche |
| Polices d'icônes | 🔲 | Gestion spéciale des glyphes de polices d'icônes |

## Couleur, dégradés et images

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Sélecteur de couleur (HSV) | ✅ | Carré HSV, curseur de teinte, curseur alpha, entrée hex |
| Remplissages solides | ✅ | Couleur hex avec opacité |
| Dégradé linéaire | ✅ | Arrêts de dégradé, poignées de transformation |
| Dégradé radial | ✅ | Rendu via shaders CanvasKit |
| Dégradé angulaire | ✅ | Support dégradé sweep/conique |
| Dégradé diamant | ✅ | Dégradé diamant à quatre points |
| Remplissages d'image | ✅ | Décodés à partir de données blob avec modes d'échelle (fill, fit, crop, tile) |
| Remplissages de motif | 🔲 | Remplissages d'image/motif répétitif |
| Modes de fusion | 🔲 | Modes de fusion de calque et remplissage (multiply, screen, overlay, etc.) |
| Ajouter des images et vidéos | 🟡 | Remplissages d'image rendus ; pas d'import drag-and-drop ni support vidéo |
| Ajustement des propriétés d'image | 🔲 | Exposition, contraste, saturation, etc. |
| Recadrer une image | 🔲 | Recadrage interactif d'images |
| Outil pipette | 🔲 | Échantillonner des couleurs du canevas |
| Édition de couleur en sélection mixte | 🔲 | Ajuster les couleurs dans une sélection hétérogène |
| Modèles de couleur (RGB, HSL, HSB, Hex) | 🟡 | HSV + Hex dans le sélecteur ; pas de bascule mode HSL ou RGB |

## Effets et propriétés

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Ombre portée | ✅ | Décalage, rayon de flou, couleur via filtres CanvasKit |
| Ombre intérieure | ✅ | Effet d'ombre inset |
| Flou de calque | ✅ | Flou gaussien sur le calque |
| Flou d'arrière-plan | ✅ | Flouter le contenu derrière le calque |
| Flou de premier plan | ✅ | Flou au premier plan |
| Épaisseur du contour | ✅ | Configurable dans le panneau de propriétés |
| Extrémité du contour (round, square, arrow) | ✅ | `NONE`, `ROUND`, `SQUARE`, `ARROW_LINES`, `ARROW_EQUILATERAL` |
| Jointure du contour (miter, bevel, round) | ✅ | Les trois types de jointure |
| Motifs de tirets | ✅ | Motif de contour dash-on/dash-off |
| Rayon de coin | ✅ | Rayon uniforme et par coin avec toggle indépendant |
| Lissage de coin (style iOS) | 🔲 | Arrondi continu des coins de Figma |
| Remplissages/contours multiples par calque | 🔲 | Figma permet d'empiler remplissages et contours |

## Auto Layout

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Flux horizontal et vertical | ✅ | Moteur flexbox Yoga WASM |
| Basculer auto layout (<kbd>⇧</kbd><kbd>A</kbd>) | ✅ | Basculer sur un frame ou envelopper la sélection |
| Gap (espacement entre enfants) | ✅ | Configurable dans le panneau de propriétés |
| Padding (uniforme et par côté) | ✅ | Les quatre côtés indépendamment |
| Justify content | ✅ | Start, center, end, space-between |
| Align items | ✅ | Start, center, end, stretch |
| Dimensionnement des enfants (fixe, remplir, ajuster) | ✅ | Modes de dimensionnement par enfant |
| Wrap | ✅ | Flex wrap pour layout multi-ligne |
| Flux auto layout en grille | ✅ | CSS Grid via fork Yoga — tracks colonnes/lignes, gaps, spans |
| Flux combinés (imbriqués) | ✅ | Frames auto-layout imbriqués avec directions différentes |
| Réordonnancer par glissement dans auto layout | ✅ | Indicateur visuel d'insertion |
| Largeur/hauteur min et max | 🔲 | Figma supporte les contraintes min/max |

## Composants et systèmes de design

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Créer des composants | 🟡 | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> crée depuis frame/groupe ; pas d'UI de propriétés de composant encore |
| Ensembles de composants | 🟡 | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> combine des composants ; bordure pointillée violette ; pas d'édition de propriétés de variante |
| Instances de composants | 🟡 | Créer instance depuis menu contextuel ; sync en direct ; pas d'UI d'édition de surcharges |
| Variantes | 🔲 | Changement de variante et sélection par propriétés |
| Propriétés de composant | 🔲 | Propriétés booléennes, texte, échange d'instance |
| Propagation des surcharges | ✅ | Changements du composant principal propagés ; surcharges préservées |
| Variables (couleur, nombre, chaîne, booléen) | 🟡 | `COLOR` avec UI complète ; `FLOAT`/STRING/BOOLEAN définis sans UI d'édition |
| Collections et modes de variables | 🟡 | Collections, modes, changement activeMode fonctionnent ; pas d'UI de thématisation |
| Styles (couleur, texte, effet, layout) | 🔲 | Presets de style réutilisables nommés |
| Bibliothèques (publier, partager, mettre à jour) | 🔲 | Bibliothèques partagées de composants/styles |
| Détacher une instance | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> convertit une instance en frame |
| Aller au composant principal | ✅ | Naviguer vers le composant source, cross-page |

## Prototypage

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Connexions de prototype | 🔲 | Prévu pour la Phase 6 |
| Déclencheurs (clic, survol, glisser, etc.) | 🔲 | Prévu pour la Phase 6 |
| Actions (naviguer, overlay, scroll, etc.) | 🔲 | Prévu pour la Phase 6 |
| Animations et transitions | 🔲 | Prévu pour la Phase 6 |
| Smart animate | 🔲 | Auto-animer les calques correspondants |
| Overlays | 🔲 | Prototypage modal/popover |
| Comportement de scroll et overflow | 🔲 | Frames scrollables dans les prototypes |
| Flux de prototype | 🔲 | Points de départ nommés |
| Variables dans les prototypes | 🔲 | Logique conditionnelle avec variables |
| Easing et animations spring | 🔲 | Courbes d'animation personnalisées |
| Présenter et jouer les prototypes | 🔲 | Visionneuse de prototype plein écran |

## Import et export

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Import de fichier .fig | ✅ | Codec Kiwi complet : 194 définitions, ~390 champs par `NodeChange` |
| Export de fichier .fig | ✅ | Encodage Kiwi + compression Zstd + génération de miniature |
| Enregistrer / Enregistrer sous | ✅ | <kbd>⌘</kbd><kbd>S</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> ; dialogues natifs (Tauri), File System Access API (Chrome/Edge), téléchargement (Safari) |
| Presse-papiers Figma (coller) | ✅ | Décoder binaire Kiwi du presse-papiers Figma |
| Presse-papiers Figma (copier) | ✅ | Encoder binaire Kiwi lisible par Figma |
| Import de fichier Sketch | 🔲 | Analyse de fichiers .sketch |
| Export image/SVG | 🟡 | PNG/JPG/WEBP avec sélecteur d'échelle et aperçu ; WEBP/SVG export ✅ ; PDF export 🔲 |
| Historique des versions | 🔲 | Parcourir et restaurer les versions précédentes |
| Copier des assets entre outils | 🟡 | Presse-papiers Figma fonctionne ; Copier comme texte/SVG/PNG/JSX |

## API de plugins et scripting

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Commande eval avec Figma Plugin API | ✅ | Exécution headless de JavaScript avec objet global figma compatible |

## Collaboration et mode développeur

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Commentaires (épingler, fils, résoudre) | 🔲 | Prévu pour la Phase 6 |
| Multijoueur en temps réel | ✅ | P2P via Trystero + Yjs CRDT, curseurs, mode suivi ; sans serveur |
| Chat au curseur | 🔲 | Bulles de chat inline au curseur |
| Branching et merging | 🔲 | Branches de version pour fichiers de design |
| Mode développeur (inspecter) | 🟡 | Onglet Code montre JSX ; pas de propriétés CSS ni specs de handoff |
| Code Connect | 🔲 | Lier composants de design au code |
| Extraits de code | 🟡 | Export JSX avec coloration et copie ; pas d'extraits CSS/Swift/Kotlin |
| Figma for VS Code | 🔲 | Intégration plugin éditeur |
| Serveur MCP | ✅ | @open-pencil/mcp avec transports stdio + HTTP ; 87 outils core + 3 gestion de fichiers = 90 total |
| Outils CLI | ✅ | CLI headless : info, tree, find, export, analyze, node, pages, variables, eval ; serveur MCP |

## Figma Draw

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Outils d'illustration | 🔲 | Outils de dessin spécialisés de Figma Draw |
| Transformations de motif | 🔲 | Créer des motifs répétitifs avec des transformations |
