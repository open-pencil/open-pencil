# Open Pencil vs Penpot : Comparaison d'architecture et de performances

Pourquoi comparer ? OpenPencil existe parce que les plateformes de design fermées contrôlent ce qui est possible. Comprendre les différences architecturales montre ce qu'une alternative ouverte et local-first peut faire différemment.

::: info Renderer WASM de Penpot
Penpot 2.x inclut un renderer Rust/Skia WASM (`render-wasm/v1`) activable via les flags du serveur ou le paramètre URL `?wasm=true`. Le renderer SVG reste le défaut. Cette page couvre les deux.
:::

## 1. Échelle et taille du code

| Métrique | Open Pencil | Penpot |
|----------|-------------|--------|
| LOC total | **~26 000** | **~299 000** |
| Fichiers source | ~143 | ~2 900 |
| Langages | TypeScript, Vue | Clojure, ClojureScript, Rust, JS, SQL, SCSS |
| Moteur de rendu | ~3 200 LOC (TS, 10 plików) | 22 000 LOC (Rust/Skia WASM) |
| Code UI | ~4 500 LOC | ~175 000 LOC (CLJS + SCSS) |
| Backend | Aucun (local-first) | 32 600 LOC + 151 fichiers SQL |
| Ratio LOC | **1×** | **~11×** |

Open Pencil est **~11× plus petit** — et c'est tout l'intérêt. Ce n'est pas une simplification ; c'est une architecture fondamentalement différente.

## 2. Architecture

### Open Pencil : Client monolithique

```
┌─────────────────────────────────┐
│         Tauri (shell natif)     │
│  ┌───────────────────────────┐  │
│  │  Vue 3 + TypeScript       │  │
│  │  ┌─────────┐ ┌──────────┐│  │
│  │  │  Editor  │ │  Kiwi    ││  │
│  │  │  Store   │ │  Codec   ││  │
│  │  └────┬─────┘ └──────────┘│  │
│  │       │                    │  │
│  │  ┌────▼────────────────┐  │  │
│  │  │  Scene Graph (TS)    │  │  │
│  │  │  Map<string, Node>   │  │  │
│  │  └────┬────────────────┘  │  │
│  │       │                    │  │
│  │  ┌────▼────┐ ┌──────────┐│  │
│  │  │  Skia   │ │  Yoga    ││  │
│  │  │CanvasKit│ │  Layout  ││  │
│  │  │  (WASM) │ │  (WASM)  ││  │
│  │  └─────────┘ └──────────┘│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Tout dans un seul processus.** Pas de serveur, pas de base de données, pas de Docker.

### Penpot : Client-serveur distribué

```
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                      │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │   Frontend    │  │   Backend   │  │   Exporter   │ │
│  │  ClojureScript│  │   Clojure   │  │  (Chromium)  │ │
│  │  shadow-cljs  │  │   JVM       │  │              │ │
│  │  ┌─────────┐ │  │  ┌────────┐ │  └──────────────┘ │
│  │  │render-  │ │  │  │Postgres│ │                    │
│  │  │wasm     │ │  │  │Valkey  │ │  ┌──────────────┐ │
│  │  │(Rust→   │ │  │  │ MinIO  │ │  │   MCP        │ │
│  │  │ Skia    │ │  │  └────────┘ │  │   Server     │ │
│  │  │ WASM)   │ │  │             │  └──────────────┘ │
│  │  └─────────┘ │  │             │                    │
│  └──────────────┘  └─────────────┘                    │
└───────────────────────────────────────────────────────┘
```

**Minimum 5+ services.** PostgreSQL, Redis (Valkey), MinIO, un backend JVM, un exporteur Node.js (Chromium headless), plus le frontend ClojureScript.

### Verdict : Architecture

L'architecture monoprocessus d'Open Pencil élimine : la latence réseau, l'overhead de sérialisation aux frontières de services, la complexité d'orchestration de conteneurs et l'overhead de requêtes base de données.

## 3. Pipeline de rendu

### Open Pencil : TS → CanvasKit WASM (direct)

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- **1 franchissement de frontière :** TS → WASM (CanvasKit)
- Le graphe de scène vit dans le heap JS — pas de sérialisation pour le rendu
- 1 646 LOC de renderer au total

### Penpot : JS (compilé depuis CLJS) → Rust WASM → Skia

```
ClojureScript (compilé en JS)
  → décomposer en primitives + empaqueter en binaire en mémoire linéaire WASM
  → Rust WASM (via Emscripten C FFI)
  → skia-safe (bindings Rust Skia)
  → Skia (WebGL)
```

Quand désactivé (défaut), les formes sont rendues comme un arbre DOM SVG. Quand activé, système de rendu par tuiles avec 11 surfaces et cache de 1024 entrées.

### Verdict : Rendu

| Aspect | Open Pencil | Penpot |
|--------|-------------|--------|
| Frontière JS→WASM | Direct (objets TS) | Empaquetage binaire (104 octets par forme) |
| Modèle de rendu | Immédiat/redessin complet | Cache par tuiles |
| Gestion des surfaces | 1 surface | 11 surfaces |
| Overhead mémoire | Faible (pas de cache tuiles) | Élevé (1024 entrées cache) |
| Complexité du code | 1 646 LOC | 22 000 LOC |
| Code unsafe | Aucun | État global `unsafe` |

## 4. Graphe de scène et modèle de données

### Open Pencil

```typescript
nodes: Map<string, SceneNode>
// 29 types de nœuds du schéma Kiwi de Figma
// ~390 champs par NodeChange (compatible Figma)
```

- Interfaces TypeScript avec types stricts
- GUIDs au format `sessionID:localID` de Figma

### Penpot

- Données réparties dans `common/` (49 600 LOC de .cljc)
- Validation de schéma au runtime (Malli)
- Les données doivent traverser la frontière CLJS→Rust pour le rendu

### Verdict : Modèle de données

Open Pencil réutilise le schéma éprouvé de Figma directement en TypeScript — zéro traduction. Penpot maintient son propre système de types à travers trois langages.

## 5. Moteur de layout

### Open Pencil : Yoga WASM (314 LOC)

```typescript
import Yoga from 'yoga-layout'
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
```

314 lignes au total. Synchrone, dans le processus.

### Penpot : Double implémentation

Penpot maintient **deux moteurs de layout indépendants** (CLJS et Rust) qui doivent produire des résultats identiques. ~3 000+ LOC de code layout personnalisé dupliqué.

### Verdict : Layout

Open Pencil délègue à Yoga (utilisé par React Native sur des milliards d'appareils) en 314 lignes.

## 6. Format de fichier et compatibilité Figma

### Open Pencil

- **Format binaire Kiwi natif** — même sérialisation que Figma
- Import direct `.fig`, collage depuis le presse-papiers Figma
- Compatible avec le protocole multiplayer de Figma

### Penpot

- **Archive ZIP** (`.penpot`) avec manifestes JSON et assets binaires
- Pas d'import natif `.fig`
- Trois versions de format avec système de migration

### Verdict : Format de fichier

Open Pencil a un avantage significatif — il peut lire les fichiers Figma nativement et coller les données du presse-papiers Figma.

## 7. Gestion d'état et annulation

### Open Pencil

```typescript
// 110 LOC — patron de commande inverse
class UndoManager {
  apply(entry) { entry.forward(); this.undoStack.push(entry) }
  undo() { entry.inverse(); this.redoStack.push(entry) }
}
```

110 lignes. Closures forward/inverse avec état minimal.

### Penpot

Gestion d'état via Potok (bibliothèque Redux-like pour atomes ClojureScript). Undo stocke des vecteurs de changements inverses (max 50 entrées), avec auto-expiration après 20 secondes.

## 8. Expérience développeur

| Métrique | Open Pencil | Penpot |
|----------|-------------|--------|
| Setup dev | `bun install && bun dev` | Docker Compose + JVM + Node + Rust |
| Rechargement à chaud | Vite HMR (~50ms) | shadow-cljs (secondes) |
| Vérification de types | TypeScript (strict) | Runtime (schémas Malli) |
| Temps de build | <5s (Vite) | Minutes (JVM + CLJS + Rust WASM) |
| Barrière première contribution | Basse (TS/Vue) | Haute (Clojure + Rust + Docker) |
| Desktop | Tauri v2 (~5Mo) | N/A (navigateur uniquement) |
| Bassin de recrutement | Massif (devs TS/Vue) | Petit (ClojureScript + Rust) |

## 9. Caractéristiques de performance

| Scénario | Open Pencil | Penpot |
|----------|-------------|--------|
| Démarrage à froid | <2s (chargement WASM) | 10s+ (serveur + client + WASM) |
| Latence d'opération | <1ms (dans le processus) | 10-50ms (aller-retour réseau) |
| Frame de rendu | Appel Skia direct | CLJS→JS→WASM FFI→Skia |
| Mémoire de base | ~50Mo (onglet navigateur) | ~300Mo+ (JVM + Postgres + Valkey + navigateur) |
| Capacité hors ligne | Complète (local-first) | Aucune (dépend du serveur) |
| Rendu 10K formes | Une passe, sans cache | Par tuiles avec 11 surfaces |

## 10. Ce que Penpot fait mieux

1. **Collaboration serveur** — édition multi-utilisateurs centralisée avec WebSockets, comptes et contrôle d'accès
2. **Export PDF serveur** — service d'export Chromium headless pour PDF (Open Pencil exporte déjà en SVG nativement)
3. **Système de plugins** — API complète avec exécution sandboxée
4. **Tokens de design** — support natif des design tokens
5. **CSS Grid layout** — implémentation personnalisée (Open Pencil attend Yoga Grid)
6. **Self-hosting** — déploiement Docker pour les équipes
7. **Maturité** — années d'utilisation en production

## 11. Scripting et extensibilité

OpenPencil inclut une [commande `eval`](/eval-command) offrant une API Plugin compatible Figma pour le scripting headless. De plus, 78 outils IA sont disponibles via le chat intégré, le serveur MCP (stdio + HTTP) et le CLI. Penpot a un système de plugins avec exécution sandboxée mais pas d'API de scripting headless ni d'intégration MCP.

## Résumé

| Dimension | Gagnant | Pourquoi |
|-----------|---------|----------|
| **Simplicité architecturale** | Open Pencil | Un processus vs 5+ services |
| **Performance de rendu** | Open Pencil | CanvasKit direct vs SVG DOM (défaut) ou WASM empaqueté |
| **Maintenabilité du code** | Open Pencil | ~26K LOC en 1 langage vs 299K en 4+ |
| **Compatibilité Figma** | Open Pencil | Codec Kiwi natif vs pas de support .fig |
| **Onboarding développeur** | Open Pencil | TS/Vue vs Clojure/Rust/Docker |
| **Expérience desktop** | Open Pencil | Tauri natif vs navigateur uniquement |
| **Moteur de layout** | Open Pencil | Yoga (éprouvé) vs double implémentation |
| **Collaboration** | Égalité | Penpot : serveur avec contrôle d'accès ; Open Pencil : P2P via Trystero + Yjs |
| **Self-hosting** | Penpot | Prêt Docker vs desktop uniquement |
| **Maturité écosystème** | Penpot | Années de production vs stade précoce |

Open Pencil est architecturalement plus léger — un renderer CanvasKit monoprocessus en ~26K LOC TypeScript, compatible Figma par conception. Penpot est une plateforme full-stack avec ~299K LOC. Open Pencil a le scripting headless, **78 outils AI/MCP**, export SVG et une app desktop native.
