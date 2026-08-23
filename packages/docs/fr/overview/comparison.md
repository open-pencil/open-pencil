# OpenPencil et Penpot : architecture et performances

OpenPencil et Penpot sont des outils de design open source aux objectifs et architectures différents.

::: info Moteur WASM de Penpot
Penpot 2.x inclut le moteur Rust/Skia WASM `render-wasm/v1`, activé par des options serveur ou `?wasm=true`. Le moteur SVG reste utilisé par défaut. Cette comparaison tient compte des deux options.
:::

## 1. Taille du code source

| Mesure | OpenPencil | Penpot |
|--------|------------|--------|
| Lines of code | **environ 26 000** | **environ 299 000** |
| Fichiers source | environ 143 | environ 2 900 |
| Langages | TypeScript, Vue | Clojure, ClojureScript, Rust, JavaScript, SQL, SCSS |
| Moteur de rendu | environ 3 200 lignes, TypeScript | 22 000 lignes, Rust/Skia WASM |
| Interface | environ 4 500 lignes | environ 175 000 lignes, CLJS et SCSS |
| Serveur | Aucun, architecture locale | 32 600 lignes et 151 fichiers SQL |
| Rapport | **1×** | **environ 11×** |

OpenPencil est environ onze fois plus petit. Cette différence vient surtout de l’architecture, pas uniquement du nombre de fonctionnalités.

## 2. Architecture

### OpenPencil : un seul processus client

```text
┌─────────────────────────────────┐
│         Tauri native shell      │
│  ┌───────────────────────────┐  │
│  │  Vue 3 + TypeScript       │  │
│  │  Editor + Kiwi codec      │  │
│  │  SceneGraph in TypeScript │  │
│  │  CanvasKit + Yoga WASM    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

L’éditeur, SceneGraph, le codec de fichiers et le moteur de rendu s’exécutent dans le même processus. Aucun serveur, aucune base de données et aucun Docker ne sont nécessaires. SceneGraph est stocké dans `Map<string, SceneNode>`. TypeScript appelle directement CanvasKit et Yoga WASM calcule la disposition de manière synchrone.

### Penpot : plateforme Client-Server

```text
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                     │
│  ClojureScript frontend │ Clojure/JVM backend        │
│  Rust/Skia WASM         │ PostgreSQL, Valkey, MinIO  │
│  Chromium exporter      │ MCP server                 │
└───────────────────────────────────────────────────────┘
```

Un déploiement complet de Penpot comprend une interface, un serveur JVM, PostgreSQL, Valkey, MinIO et un exportateur basé sur Chromium sans interface. L’environnement de développement nécessite Docker Compose, JVM, Node et les outils Rust.

OpenPencil évite latence réseau, sérialisation entre services, orchestration de conteneurs et requêtes de base de données pour les opérations courantes. Penpot vise une plateforme multiutilisateur hébergée ; OpenPencil privilégie l’édition locale à faible latence.

## 3. Chaîne de rendu

### OpenPencil : TypeScript → CanvasKit WASM

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- Passage direct de TypeScript à WASM.
- SceneGraph reste dans le JavaScript heap et n’est pas sérialisé avant Rendering.
- Le moteur compte environ 3 200 lignes réparties en modules spécialisés.

### Penpot : ClojureScript → Rust WASM → Skia

Avec le moteur WASM :

```text
ClojureScript → JavaScript
  → décomposition et Binary packing dans WASM linear memory
  → Rust WASM via Emscripten C FFI
  → skia-safe
  → Skia/WebGL
```

Sans WASM, chaque Shape devient un SVG DOM element rendu par React/Reagent.

En mode WASM, chaque UUID est divisée en quatre `u32`, chaque transformation en six `f32`, remplissages et contours sont encodés en binaire et les propriétés de base d’une forme occupent une structure de 104 octets. Le moteur utilise un cache de tuiles, des zones d’intérêt, onze surfaces de rendu et un état global mutable via `unsafe { STATE.as_mut() }`.

Le Tile system prépare les zones proches du Viewport et conserve jusqu’à 1 024 Textures. OpenPencil rend de nouveau toute la zone visible.

| Aspect | OpenPencil | Penpot |
|--------|------------|--------|
| JavaScript → WASM | Calls directs avec objets TypeScript | Structures encodées en Binary |
| Modèle | Rendu complet du Viewport visible | Tile cache |
| Surfaces | 1 | 11 |
| Cache supplémentaire | Aucun Tile cache | Jusqu’à 1 024 Tiles |
| Taille du moteur | environ 3 200 lignes | 22 000 lignes |
| Code non sûr | Aucun | État global via `unsafe` |

Le Path CanvasKit direct demande moins de traitement intermédiaire pour les documents petits et moyens. Le Tile system de Penpot peut être avantageux au-delà de 100 000 Shapes lorsqu’une faible portion seulement est visible.

## 4. SceneGraph et modèle de données

```typescript
nodes: Map<string, SceneNode>
```

OpenPencil fournit :

- une recherche par identifiant en O(1) ;
- 29 types d’objet issus du schéma Kiwi de Figma ;
- environ 390 champs dans `NodeChange` ;
- des types TypeScript stricts ;
- des GUID au format Figma `sessionID:localID`.

Penpot maintient ses propres définitions de types en Clojure/ClojureScript et Rust. Des modules distincts gèrent couleurs, composants, conteneurs, remplissages, Grid, modificateurs, pages et tracés. Malli valide les schémas à l’exécution et les données de rendu franchissent la limite CLJS → Rust.

OpenPencil utilise directement le schéma Kiwi. Penpot doit synchroniser son modèle entre plusieurs langages.

## 5. Moteur de disposition

OpenPencil utilise Yoga WASM de manière synchrone :

```typescript
import Yoga from 'yoga-layout'
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
applyYogaLayout(graph, frame, yogaRoot)
```

Penpot maintient ses propres Implementations de Flex et Grid en ClojureScript et Rust WASM. Les deux Engines doivent produire le même résultat.

OpenPencil utilise Yoga, avec une variante prenant Grid en charge. Penpot maintient plusieurs milliers de lignes de code de disposition dans deux langages.

## 6. Formats et Figma

### OpenPencil

- Format Binary Kiwi natif de Figma.
- Import direct de `.fig`.
- Paste de Kiwi binary data depuis Figma Clipboard.
- Wire compatibility avec Figma Multiplayer protocol.

### Penpot

- `.penpot` est un ZIP avec JSON manifests, Document data, Binary assets et Thumbnails.
- SVG renderer et Export par défaut ; WASM renderer facultatif.
- Aucun Import `.fig` natif.
- Plusieurs Generations de format avec Migration system.

OpenPencil lit `.fig` et Figma Clipboard directement. Penpot nécessite une voie Import ou Export distincte.

## 7. État et annulation

OpenPencil utilise des commandes inverses. Les fonctions d’avancement et de retour conservent seulement l’état nécessaire ; des lots regroupent plusieurs opérations.

Penpot utilise Potok. `UpdateEvent` modifie l’état et `WatchEvent` exécute les effets de bord avec RxJS. L’annulation stocke des vecteurs de changements inverses, limite l’historique à 50 entrées et regroupe les changements rapides en transactions.

Les changements sérialisables conviennent à la collaboration via serveur, mais augmentent la complexité. L’approche OpenPencil est plus directe pour un éditeur à processus unique.

## 8. Développement

| Mesure | OpenPencil | Penpot |
|--------|------------|--------|
| Setup | `bun install && bun dev` | Docker Compose, JVM, Node et Rust |
| HMR | Vite | shadow-cljs |
| Types | Strict TypeScript | Malli runtime schemas |
| Desktop | Tauri v2 | Browser |
| Technologies principales | TypeScript et Vue | Clojure, ClojureScript, Rust et Docker |

## 9. Performances

| Scénario | OpenPencil | Penpot |
|----------|------------|--------|
| Démarrage à froid | moins de 2 s avec WASM | plus de 10 s pour serveur, client et WASM |
| Opération courante | Dans un seul processus | Aller-retour réseau possible |
| Image rendue | Appel direct à Skia | CLJS → JS → WASM FFI → Skia |
| Mémoire de base | environ 50 Mo dans l’onglet | JVM, base de données, cache et navigateur |
| Hors ligne | Fonctionnement local complet | Serveur requis |
| 10 000 formes | Une passe | Rendu par tuiles avec onze surfaces |

## 10. Avantages de Penpot

1. **Collaboration via serveur :** comptes, contrôle d’accès et stockage central avec WebSockets.
2. **Export PDF :** exportateur Chromium dédié.
3. **Système de plugins :** exécution isolée et API de plugins.
4. **Variables de design :** prise en charge intégrée.
5. **CSS Grid :** implémentation propre ; OpenPencil utilise une variante de Yoga avec Grid.
6. **Auto-hébergement :** déploiement d’une plateforme d’équipe avec Docker.
7. **Maturité :** plusieurs années d’utilisation en production.

## 11. Scripts et extensibilité

La commande [`eval`](/programmable/cli/scripting) fournit une API compatible avec les plugins Figma pour les scripts sans interface, les opérations par lots et les tests automatisés. Le chat AI, le serveur MCP et la CLI offrent aussi 90 outils pour lire, créer, modifier, structurer, gérer les variables, éditer les tracés, analyser, comparer, exécuter des opérations booléennes et organiser.

Penpot propose des plugins isolés, mais pas d’API équivalente pour les scripts sans interface ni d’intégration MCP.

## Résumé

| Domaine | Avantage | Motif |
|---------|----------|-------|
| Simplicité | OpenPencil | Un processus au lieu de plusieurs services |
| Rendu | OpenPencil | Accès direct à CanvasKit |
| Code source | OpenPencil | Environ 26 000 contre 299 000 lignes |
| Compatibilité Figma | OpenPencil | Kiwi et `.fig` natifs |
| Développement | OpenPencil | TypeScript et Vue plutôt que Clojure, Rust et Docker |
| Application de bureau | OpenPencil | Tauri natif |
| Disposition | OpenPencil | Yoga plutôt que deux implémentations propres |
| Collaboration | Forces différentes | Penpot : serveur et contrôle d’accès ; OpenPencil : P2P sans hébergement |
| Auto-hébergement | Penpot | Déploiement Docker |
| Maturité de l’écosystème | Penpot | Plusieurs années en production |

OpenPencil est un éditeur compact à processus unique avec moteur CanvasKit et prise en charge native de `.fig`. Penpot est une plateforme client-serveur complète utilisant Clojure, ClojureScript, Rust, des bases de données et des services Docker. Les deux offrent la collaboration selon des modèles différents. Penpot propose un écosystème de plugins et l’export PDF ; OpenPencil fournit des scripts sans interface compatibles Figma, 90 outils AI/MCP, l’export SVG et une application de bureau.
