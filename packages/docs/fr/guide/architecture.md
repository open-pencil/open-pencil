# Architecture

## Vue d'ensemble du système

`mermaid
graph TB
    subgraph Tauri["Tauri v2 Shell"]
        subgraph Editor["Editor (Web)"]
            UI["Vue 3 UI<br/>Toolbar · Panels · Properties<br/>Layers · Color Picker"]
            Skia["Skia CanvasKit (WASM, 7MB)<br/>Vector rendering · Text shaping<br/>Effects · Export"]
            subgraph Core["Core Engine (TS)"]
                SG[SceneGraph] --- Layout[Layout - Yoga]
                SG --- Selection
                Undo[Undo/Redo] --- Constraints
                Constraints --- HitTest[Hit Testing]
            end
            subgraph FileFormat["File Format Layer"]
                FigIO[".fig import/export"] --- Kiwi[Kiwi codec]
                Kiwi --- SVG[SVG export]
            end
        end
        MCP["MCP Server (90 tools, stdio+HTTP)"]
        Collab["P2P Collab (Trystero + Yjs)"]
    end
`

## Disposition de l'éditeur

L'interface suit le layout UI3 de Figma — barre d'outils en bas, navigation à gauche, propriétés à droite :

- **Panneau de navigation (gauche)** — Arbre des calques, panneau des pages
- **Canvas (centre)** — Canvas infini avec rendu CanvasKit, zoom/pan
- **Panneau de propriétés (droite)** — Sections contextuelles : Apparence, Remplissage, Contour, Typographie, Layout, Position
- **Barre d'outils (bas)** — Sélection d'outil : Sélectionner, Frame, Section, Rectangle, Ellipse, Ligne, Texte, Plume, Main

## Composants

### Rendu (CanvasKit WASM)

Le même moteur de rendu que Figma. CanvasKit fournit un dessin 2D accéléré par GPU avec formes vectorielles, mise en forme du texte via Paragraph API, effets (ombres, flous, modes de fusion) et export (PNG, SVG). Le binaire WASM de 7 Mo se charge au démarrage et crée une surface GPU sur le canvas HTML.

Le renderer est découpé en modules spécialisés dans `packages/core/src/renderer/` : parcours de scène, overlays, remplissages, contours, formes, effets, règles, étiquettes et curseurs distants.

### Graphe de scène

`Map<string, Node>` plat indexé par des chaînes GUID. Structure en arbre via des références `parentIndex`. Fournit une recherche O(1), un parcours efficace, du hit testing et des requêtes par zone rectangulaire pour la sélection par marquise.

Voir la [Référence du graphe de scène](/reference/scene-graph) pour les détails internes.

### Moteur de layout (Yoga WASM)

Yoga de Meta fournit le calcul de layout CSS flexbox. Un adaptateur fin mappe les noms de propriétés Figma vers les équivalents Yoga :

| Propriété Figma | Équivalent Yoga |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Format de fichier (Kiwi binaire)

Réutilise le codec binaire Kiwi de Figma avec 194 définitions de message/enum/struct. Import : analyser l'en-tête → décompresser Zstd → décoder Kiwi → `NodeChange`[] → graphe de scène. L'export inverse le processus avec génération de miniature.

Voir la [Référence du format de fichier](/reference/file-format) pour plus de détails.

### IA et outils

Les outils sont définis une seule fois dans `packages/core/src/tools/`, découpés par domaine : read, create, modify, structure, variables, vector, analyze. Chaque outil a des paramètres typés et une fonction `execute(figma, args)`. Les adaptateurs les convertissent pour :

- **Chat IA** — schémas valibot, connecté à OpenRouter
- **Serveur MCP** — schémas zod, transports stdio + HTTP
- **CLI** — accessible via la commande `eval`

87 outils core + 3 outils de gestion de fichiers MCP = 90 au total.

### Annuler/Rétablir

Patron de commande inverse. Avant d'appliquer tout changement, les champs concernés sont capturés en snapshot. Le snapshot devient l'opération inverse. Le batching regroupe les changements rapides (comme le glissement) en entrées d'annulation uniques.

### Presse-papiers

Presse-papiers bidirectionnel compatible Figma. Encode/décode le binaire Kiwi (même format que les fichiers .fig) via les événements natifs copier/coller du navigateur. Gère le redimensionnement des chemins vectoriels, les enfants d'instances, la détection des ensembles de composants et l'application des surcharges.

### Collaboration P2P

Collaboration peer-to-peer en temps réel via Trystero (WebRTC) + Yjs CRDT. Sans serveur relais — signalisation via des brokers MQTT publics, STUN/TURN pour le traversal NAT. Le protocole d'awareness fournit des curseurs en direct, des sélections et de la présence. Persistance locale via y-indexeddb.

### Pont RPC CLI-vers-application

Lorsque l'application de bureau est lancée, les commandes CLI s'y connectent via WebSocket au lieu de nécessiter un fichier .fig. Le serveur d'automatisation tourne sur `127.0.0.1:7600` (HTTP) et `127.0.0.1:7601` (WebSocket). Les commandes s'exécutent sur l'état en direct de l'éditeur, permettant aux scripts d'automatisation et aux agents IA d'interagir avec l'application en cours d'exécution.

## Prochaines étapes

### Ensemble complet d'outils figma-use

Le serveur MCP expose actuellement 90 outils. L'implémentation de référence dans [figma-use](https://github.com/dannote/figma-use) en compte 118. Les outils restants couvrent les contraintes de layout avancées, les connexions de prototype, l'édition avancée des propriétés de composants et les opérations en masse sur les documents.

### Outillage de design pour la CI

Le CLI headless supporte déjà `analyze colors/typography/spacing/clusters`. Prochaine étape : intégration GitHub Actions pour le linting de design automatisé et la régression visuelle dans les PRs.

### Prototypage

Transitions frame-à-frame, déclencheurs d'interaction (clic, survol, glissement), gestion des overlays et mode aperçu plein écran.

### Layout CSS Grid

CSS Grid est supporté via un [fork de Yoga](https://github.com/open-pencil/yoga/tree/grid) avec des PRs grid cherry-picked de l'upstream. Sélectionnez un frame, cliquez sur l'icône grille pour passer de flex à grid. Configurez les tracks colonnes/lignes (fr, px fixes, auto), les gaps colonnes et lignes, et le padding par côté.

### Signature de code Windows

Les binaires macOS sont signés et notarisés depuis la v0.6.0. La signature Authenticode Windows via Azure Code Signing est prévue pour supprimer l'avertissement SmartScreen.
