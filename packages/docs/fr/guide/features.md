# Fonctionnalités

## Pourquoi OpenPencil

Les outils de design sont un problème de chaîne d'approvisionnement. Quand votre outil est propriétaire, l'éditeur contrôle ce qui est possible — il peut casser votre automatisation du jour au lendemain. OpenPencil est une alternative open-source : licence MIT, compatible Figma, entièrement local et programmable.

## Import & export de fichiers .fig Figma

Ouvrez et enregistrez les fichiers natifs Figma directement. L'import décode le schéma Kiwi complet à 194 définitions incluant les messages NodeChange avec ~390 champs. L'export encode le graphe de scène en binaire Kiwi avec compression Zstd et génération de miniature. Enregistrer (<kbd>⌘</kbd><kbd>S</kbd>) et Enregistrer sous (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>) utilisent les dialogues natifs de l'OS sur l'app bureau.

## Copier-coller avec Figma

Sélectionnez des nœuds dans Figma, <kbd>⌘</kbd><kbd>C</kbd>, passez à OpenPencil, <kbd>⌘</kbd><kbd>V</kbd> — ils apparaissent avec remplissages, contours, auto-layout, texte, rayons de coins, effets et réseaux vectoriels préservés. Fonctionne aussi dans l'autre sens.

Le collage gère les scénarios complexes : les chemins vectoriels sont redimensionnés depuis la `normalizedSize` de Figma vers les limites réelles du nœud, les enfants d'instance sont peuplés depuis le `symbolData` de leur composant, les ensembles de composants sont détectés et les `symbolOverrides` sont appliqués. Les polices sont chargées automatiquement.

## Réseaux vectoriels

L'outil plume utilise le modèle de réseau vectoriel de Figma — pas de chemins simples. Clic pour les points d'angle, clic+glisser pour les courbes de Bézier. Chemins ouverts et fermés supportés.

## Outils de forme

La barre d'outils fournit tous les outils de forme de base de Figma : Rectangle (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Ligne (<kbd>L</kbd>), Polygone et Étoile. Toutes les formes supportent remplissage, contour, surbrillance au survol et contour de sélection.

## Auto-Layout

Yoga WASM fournit le layout CSS flexbox. Les frames supportent : direction, gap, padding, justify, align et dimensionnement des enfants. Shift+A active/désactive l'auto-layout.

## Édition de texte en ligne

Édition de texte native sur le canevas. Double-clic sur un nœud texte pour entrer en mode édition. **Sélecteur de polices** avec défilement virtuel, filtre de recherche et aperçu CSS. Dans Tauri, les polices système sont énumérées via le crate Rust `font-kit`.

## Formatage de texte riche

Formatage par caractère : <kbd>⌘</kbd><kbd>B</kbd> gras, <kbd>⌘</kbd><kbd>I</kbd> italique, <kbd>⌘</kbd><kbd>U</kbd> souligné, ou boutons B/I/U/S. Implémenté via un modèle StyleRun. Préservé lors de l'import/export .fig.

## Annuler/Rétablir

Toute opération est annulable. Patron de commande inverse. <kbd>⌘</kbd><kbd>Z</kbd> annule, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> rétablit.

## Guides d'alignement

Accrochage aux bords et centres avec lignes guides rouges. Conscient de la rotation.

## Règles du canevas

Règles en haut et à gauche montrant les échelles de coordonnées avec badges de coordonnées lors de la sélection.

## Sélecteur de couleur et types de remplissage

Sélection HSV avec curseur de teinte, curseur alpha, entrée hex et contrôle d'opacité. Types : Solide, Dégradé (Linéaire, Radial, Angulaire, Diamant) et Image.

## Panneau des calques

Vue en arbre de la hiérarchie du document avec le composant Reka UI Tree. Panneaux redimensionnables.

## Panneau de propriétés

Interface à onglets **Design** | **Code** | **IA**. L'onglet Design montre des sections contextuelles : Apparence, Remplissage, Contour, Effets, Typographie, Layout, Position, Export et Page.

## Grouper/Dégrouper

⌘G groupe. ⇧⌘G dégroupe. Les nœuds sont triés par position visuelle.

## Sections

Les sections (<kbd>S</kbd>) sont des conteneurs organisationnels de niveau supérieur sur le canevas avec des pilules de titre et inversion automatique de la couleur du texte.

## Documents multi-pages

Les documents supportent plusieurs pages. Chaque page maintient un état de viewport indépendant.

## Surbrillance au survol

Les nœuds se mettent en surbrillance avec un contour qui suit la géométrie réelle.

## Rendu avancé (Tier 1)

Le renderer CanvasKit supporte les fonctionnalités visuelles Tier 1 complètes : dégradés, remplissages d'images, effets, propriétés de contour, données d'arc, culling de viewport, réutilisation de Paint et coalescence RAF.

## Composants et instances

Composants réutilisables (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), ensembles (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), instances via menu contextuel, détacher (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd>). **Sync en direct** et **support des surcharges**. Étiquettes violettes avec icône diamant.

## Variables

Jetons de design avec collections et modes. Dialogue TanStack Table. Supporte COLOR avec UI complète, FLOAT/STRING/BOOLEAN définis. Toutes les opérations sont annulables.

## Export d'images

PNG, JPG, WEBP avec échelle 0,5×–4×, aperçu en direct et <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>.

## Menu contextuel

Clic droit pour : Presse-papiers, Ordre Z, Groupement, Composants (items violets), Visibilité, Déplacer vers page.

## Ordre Z, visibilité et verrouillage

<kbd>]</kbd> amène au premier plan, <kbd>[</kbd> envoie en arrière. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> visibilité. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> verrouillage.

## App web et bureau

OpenPencil fonctionne dans le navigateur sur [app.openpencil.dev](https://app.openpencil.dev). L'app bureau utilise Tauri v2 (~5 Mo). Fonctionne entièrement hors ligne.

## Menu de l'app (navigateur)

Barre de menus avec reka-ui : **Fichier**, **Édition**, **Affichage**, **Objet**, **Texte**, **Disposition**. Raccourcis clavier adaptés à la plateforme. Caché dans Tauri.

## Sauvegarde automatique

Fichiers sauvegardés 3 secondes après le dernier changement. Debounce sur `sceneVersion`. Désactivé pour les nouveaux documents sans titre.

## Collaboration P2P

Collaboration peer-to-peer en temps réel — aucun serveur requis. Basé sur Trystero (WebRTC) + Yjs (CRDT).

- **Zéro coût d'hébergement** — signalisation via brokers MQTT publics
- **Traversal NAT** — serveurs Google STUN, Cloudflare STUN et Open Relay TURN
- **Curseurs en direct** — flèches colorées style Figma avec pilules de nom
- **Présence** — avatars colorés
- **Mode suivi** — cliquez sur l'avatar d'un pair pour suivre son viewport
- **Persistance locale** — y-indexeddb maintient la salle entre les rechargements
- **Salles sécurisées** — IDs via `crypto.getRandomValues()`

## Onglets multi-fichiers

Ouvrez plusieurs documents en onglets. <kbd>⌘</kbd><kbd>N</kbd>/<kbd>⌘</kbd><kbd>T</kbd> nouvel onglet, <kbd>⌘</kbd><kbd>W</kbd> fermer, <kbd>⌘</kbd><kbd>O</kbd> ouvrir dans un nouvel onglet. Chaque onglet maintient son propre état de document.

## Rendu des effets

Rendu complet des effets Figma : **Ombre portée**, **Ombre intérieure**, **Flou de calque** (Gaussien), **Flou d'arrière-plan** (effet verre/givre), **Flou de premier plan**. Cache SkPicture par nœud pour la performance.

## Propriétés multi-sélection

Sélectionnez plusieurs nœuds et éditez les propriétés partagées. Valeurs communes affichées normalement, valeurs différentes montrent « Mixed ». Retournement H/V s'applique à tous les nœuds.

## ScrubInput

Toutes les entrées numériques utilisent une interaction glisser-pour-ajuster. Supporte les suffixes (°, px, %).

## Builds CI/CD

GitHub Actions construit les apps Tauri sur les tags de version. macOS signé et notarisé. Notes de release auto-remplies depuis CHANGELOG.md.

## @open-pencil/core et CLI

Le moteur est extrait dans `packages/core/`. Le CLI fournit : info, tree, find, export, analyze, node, pages, variables, eval. Tous supportent `--json`. Le commande `eval` exécute JavaScript avec l'API Plugin Figma. Voir [Commande Eval](/eval-command).

## Rendereur JSX

Création programmable via TreeNode builders. Props shorthand style Tailwind.

## Chat IA

Assistant IA intégré via <kbd>⌘</kbd><kbd>J</kbd>. **78 outils** dans `schema.ts` couvrant lecture, création, modification, manipulation de nœuds, CRUD variables, outils vectoriels, contrôle viewport et `eval`. **Serveur MCP** expose 78 outils au total (75 core + 3 gestion fichiers) pour les outils de codage IA externes.

## Export SVG

Exporte les nœuds sélectionnés en PNG, JPG, WEBP ou SVG. CLI : `bun open-pencil export --format svg file.fig`.

## Copier en tant que

Le sous-menu **Copier en tant que** du menu contextuel propose : Copier en tant que texte, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), JSX.

## Alignement du contour & épaisseurs par côté

Alignement : **Intérieur**, **Centre** ou **Extérieur**. Épaisseurs individuelles par côté (Haut/Droite/Bas/Gauche).

## Layout mobile & PWA

Installable en PWA. Sur mobile, panneaux latéraux remplacés par un tiroir inférieur glissable avec onglets.

## Export Tailwind CSS v4

L'onglet Code propose un basculement entre **OpenPencil JSX** et **Tailwind CSS v4** (HTML avec classes utilitaires).

## Google Fonts Fallback

Si une police n'est pas disponible localement, OpenPencil la charge automatiquement depuis Google Fonts API.

## Homebrew Tap

Sur macOS : `brew install open-pencil/tap/open-pencil`

## Renommage inline des calques

Double-clic sur le nom d'un calque pour le renommer. Entrée ou clic ailleurs valide, Échap annule.

## Profileur de rendu

Superposition HUD avec métriques de timing. Accessible via le menu Affichage.

## Panneau de code

L'onglet Code montre le JSX de la sélection avec coloration syntaxique Prism.js et copie.

## Qualité de code

Détection de copier-coller via jscpd — duplication réduite de 15,6% à 0,62%. Pipeline d'import optimisé de O(n²) à O(n).
