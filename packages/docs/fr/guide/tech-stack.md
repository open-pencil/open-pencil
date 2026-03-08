# Stack technique

## Technologies principales

| Couche | Technologie | Pourquoi |
|--------|-----------|----------|
| **Rendu** | Skia CanvasKit WASM | Même moteur que Figma — performances éprouvées, accéléré GPU, pixel-parfait |
| **Framework UI** | Vue 3 + VueUse | API de composition réactive, excellent support TypeScript |
| **Composants** | Reka UI | Primitives UI headless et accessibles (tree, slider, etc.) |
| **Stylisation** | Tailwind CSS 4 | Utility-first, itération rapide, thème sombre |
| **Layout** | Yoga WASM | Moteur CSS flexbox de Meta, éprouvé dans React Native |
| **Format de fichier** | Kiwi binaire + Zstd | Format propre de Figma — compact, parsing rapide, compatible .fig |
| **Collaboration** | Trystero + Yjs | P2P WebRTC via signalisation MQTT, sync CRDT, persistance y-indexeddb |
| **Couleur** | culori | Conversions d'espaces colorimétriques (HSV, RGB, hex) |
| **IA/MCP** | MCP SDK + Hono | 87 outils pour le codage IA, transports stdio + HTTP |
| **Desktop** | Tauri v2 | ~5 Mo app native (vs ~100 Mo d'Electron), backend Rust |
| **Build** | Vite 7 | HMR rapide, modules ES natifs |
| **Test** | Playwright + bun:test | Régression visuelle (E2E) + tests unitaires rapides |
| **Linting** | oxlint | Basé sur Rust, ordres de grandeur plus rapide qu'ESLint |
| **Formatage** | oxfmt | Formateur basé sur Rust |
| **Vérification de types** | typescript-go (tsgo) | Implémentation native en Go du vérificateur de types TypeScript |

## Dépendances principales

```json
{
  "canvaskit-wasm": "^0.40.0",
  "vue": "^3.5.29",
  "yoga-layout": "^3.2.1",
  "reka-ui": "^2.8.2",
  "tailwindcss": "^4.2.1",
  "culori": "^4.0.2",
  "fzstd": "^0.1.1",
  "fflate": "^0.8.2",
  "trystero": "^0.20.0",
  "yjs": "^13.6.24",
  "y-indexeddb": "^9.0.12"
}
```

## Pourquoi pas...

### Pourquoi pas le rendu SVG ?

SVG est lent pour les documents complexes. Chaque nœud est un élément DOM — 10 000 nœuds signifient 10 000 éléments DOM avec overhead de layout, peinture et composition. CanvasKit dessine tout sur une seule surface GPU.

### Pourquoi pas Electron (comme Figma desktop) ?

Tauri v2 utilise le webview système (~5 Mo) au lieu d'embarquer Chromium (~100 Mo). Le backend Rust fournit des performances natives pour les E/S fichier et l'intégration système.

### Pourquoi pas React ?

Le projet a migré de React vers Vue 3 très tôt. Le système de réactivité de Vue et les composables VueUse se sont avérés plus ergonomiques.

### Pourquoi pas un moteur de layout personnalisé ?

Yoga est maintenu par Meta, éprouvé sur des milliards d'appareils React Native et implémente la spécification CSS flexbox.

## Technologies planifiées

| Technologie | Objectif | Phase |
|-----------|---------|-------|
| CSS Grid dans Yoga | Auto layout basé sur une grille | ✅ Supporté via [fork Yoga](https://github.com/open-pencil/yoga/tree/grid) |
