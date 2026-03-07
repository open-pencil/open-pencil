# Architecture

## Vue d'ensemble du système

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Éditeur (Web)                          │  │
│  │                                                            │  │
│  │  Vue 3 UI                   Skia CanvasKit (WASM, 7MB)    │  │
│  │  - Barre d'outils           - Rendu vectoriel             │  │
│  │  - Panneaux                 - Mise en forme du texte      │  │
│  │  - Propriétés               - Traitement d'images         │  │
│  │  - Calques                  - Effets (flou, ombre)        │  │
│  │  - Sélecteur de couleur     - Export (PNG, SVG, PDF)      │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │         Couche de format de fichier                   │ │  │
│  │  │  .fig import/export ── Kiwi codec ── .svg (prévu)    │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  MCP Server (75+ tools, stdio+HTTP) P2P Collab (Trystero + Yjs) │
└──────────────────────────────────────────────────────────────────┘
```

## Disposition de l'éditeur

L'interface suit le layout UI3 de Figma — barre d'outils en bas, navigation à gauche, propriétés à droite :

- **Panneau de navigation (gauche)** — Arbre des calques, panneau des pages, bibliothèque d'assets (prévu)
- **Canvas (centre)** — Canvas infini avec rendu CanvasKit, zoom/pan
- **Panneau de propriétés (droite)** — Sections contextuelles : Apparence, Remplissage, Contour, Typographie, Layout, Position
- **Barre d'outils (bas)** — Sélection d'outil : Sélectionner, Frame, Section, Rectangle, Ellipse, Ligne, Texte, Plume, Main

## Composants

### Rendu (CanvasKit WASM)

Le même moteur de rendu que Figma. CanvasKit fournit un dessin 2D accéléré par GPU avec :
- Formes vectorielles (rectangle, ellipse, chemin, ligne, étoile, polygone)
- Mise en forme du texte via Paragraph API
- Effets (ombres, flous, modes de fusion)
- Export (PNG, SVG, PDF)

Le binaire WASM de 7 Mo se charge au démarrage et crée une surface GPU sur le canvas HTML.

### Graphe de scène

`Map<string, Node>` plat indexé par des chaînes GUID. Structure en arbre via des références `parentIndex`. Fournit une recherche O(1), un parcours efficace, du hit testing et des requêtes par zone rectangulaire pour la sélection par marquise.

Voir [Référence du graphe de scène](/reference/scene-graph) pour les détails internes.

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

Réutilise le codec binaire Kiwi éprouvé de Figma avec 194 définitions de message/enum/struct. Pipeline d'importation `.fig` : analyser l'en-tête → décompresser Zstd → décoder Kiwi → NodeChange[] → graphe de scène. Le pipeline d'exportation inverse le processus : graphe de scène → NodeChange[] → encoder Kiwi → compresser Zstd → ZIP avec miniature.

Voir [Référence du format de fichier](/reference/file-format) pour plus de détails.

### Annuler/Rétablir

Patron de commande inverse. Avant d'appliquer tout changement, les champs concernés sont capturés en snapshot. Le snapshot devient l'opération inverse. Le batching regroupe les changements rapides (comme le glissement) en entrées d'annulation uniques.

### Presse-papiers

Presse-papiers bidirectionnel compatible Figma. Encode/décode le binaire Kiwi (même format que les fichiers .fig) en utilisant les événements natifs copier/coller du navigateur (synchrones, pas l'API asynchrone du Clipboard). Le collage gère le redimensionnement des chemins vectoriels, le peuplement des enfants d'instances, la détection des ensembles de composants et l'application des surcharges.

### Serveur MCP

`@open-pencil/mcp` expose 75 outils core + 3 outils de gestion de fichiers pour les outils de codage IA. Deux transports : stdio pour Claude Code/Cursor/Windsurf, HTTP avec Hono + Streamable HTTP pour les scripts et le CI. Les outils sont définis une fois dans `packages/core/src/tools/schema.ts` et adaptés pour le chat IA (valibot), MCP (zod) et CLI (commande eval).

### Collaboration P2P

Collaboration peer-to-peer en temps réel via Trystero (WebRTC) + Yjs CRDT. Sans serveur relais — signalisation via des brokers MQTT publics, STUN/TURN pour le traversal NAT. Le protocole d'awareness fournit des curseurs en direct, des sélections et de la présence. Persistance locale via y-indexeddb.
