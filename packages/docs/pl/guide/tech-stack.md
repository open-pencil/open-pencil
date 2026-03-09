# Stack technologiczny

## Główne technologie

| Warstwa | Technologia | Dlaczego |
|---------|-----------|----------|
| **Renderowanie** | Skia CanvasKit WASM | Ten sam silnik co Figma — sprawdzona wydajność, akceleracja GPU, idealny piksel |
| **Framework UI** | Vue 3 + VueUse | Reaktywne API kompozycji, doskonałe wsparcie TypeScript |
| **Komponenty** | Reka UI | Bezgłowe, dostępne prymitywy UI (drzewo, suwak, itp.) |
| **Stylowanie** | Tailwind CSS 4 | Utility-first, szybka iteracja, ciemny motyw |
| **Layout** | Yoga WASM | Silnik CSS flexbox od Mety, sprawdzony w React Native |
| **Format pliku** | Kiwi binarny + Zstd | Własny format Figmy — kompaktowy, szybkie parsowanie, kompatybilny z .fig |
| **Współpraca** | Trystero + Yjs | P2P WebRTC przez sygnalizację MQTT, sync CRDT, persystencja y-indexeddb |
| **Kolor** | culori | Konwersje przestrzeni kolorów (HSV, RGB, hex) |
| **AI/MCP** | MCP SDK + Hono | 87 narzędzi dla kodowania AI, transporty stdio + HTTP |
| **Desktop** | Tauri v2 | ~5 MB natywna aplikacja (vs ~100 MB Electrona), backend Rust |
| **Build** | Vite 7 | Szybki HMR, natywne moduły ES |
| **Testowanie** | Playwright + bun:test | Regresja wizualna (E2E) + szybkie testy jednostkowe |
| **Linting** | oxlint | Oparty na Rust, rzędy wielkości szybszy niż ESLint |
| **Formatowanie** | oxfmt | Formater oparty na Rust |
| **Weryfikacja typów** | typescript-go (tsgo) | Natywna implementacja w Go sprawdzania typów TypeScript |

## Główne zależności

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

## Dlaczego nie...

### Dlaczego nie renderowanie SVG?

SVG jest wolny dla złożonych dokumentów. Każdy węzeł to element DOM — 10 000 węzłów oznacza 10 000 elementów DOM z narzutem layoutu, rysowania i kompozycji. CanvasKit rysuje wszystko na jednej powierzchni GPU.

### Dlaczego nie Electron (jak Figma desktop)?

Tauri v2 używa systemowego webview (~5 MB) zamiast pakowania Chromium (~100 MB). Backend Rust zapewnia natywną wydajność dla I/O plików i integracji systemowej.

### Dlaczego nie React?

Projekt migrował z Reacta do Vue 3 na wczesnym etapie. System reaktywności Vue i composable VueUse okazały się bardziej ergonomiczne.

### Dlaczego nie własny silnik layoutu?

Yoga jest utrzymywana przez Metę, przetestowana na miliardach urządzeń React Native i implementuje specyfikację CSS flexbox.

## Planowane technologie

| Technologia | Cel | Faza |
|-----------|---------|-------|
| CSS Grid w Yoga | Auto layout oparty na siatce | ✅ Obsługiwane przez [fork Yoga](https://github.com/open-pencil/yoga/tree/grid) |
