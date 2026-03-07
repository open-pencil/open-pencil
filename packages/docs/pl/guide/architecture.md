# Architektura

## Przegląd systemu

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Edytor (Web)                           │  │
│  │                                                            │  │
│  │  Vue 3 UI                   Skia CanvasKit (WASM, 7MB)    │  │
│  │  - Pasek narzędzi           - Renderowanie wektorowe      │  │
│  │  - Panele                   - Kształtowanie tekstu        │  │
│  │  - Właściwości              - Przetwarzanie obrazów       │  │
│  │  - Warstwy                  - Efekty (rozmycie, cień)    │  │
│  │  - Selektor kolorów         - Eksport (PNG, SVG, PDF)     │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │          Warstwa formatu pliku                         │ │  │
│  │  │  .fig import/export ── Kiwi codec ── .svg (planowane)│ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  MCP Server (75+ tools, stdio+HTTP) P2P Collab (Trystero + Yjs) │
└──────────────────────────────────────────────────────────────────┘
```

## Układ edytora

Interfejs podąża za layoutem UI3 Figmy — pasek narzędzi na dole, nawigacja po lewej, właściwości po prawej:

- **Panel nawigacji (lewy)** — Drzewo warstw, panel stron, biblioteka zasobów (planowane)
- **Canvas (środek)** — Nieskończony canvas z renderowaniem CanvasKit, zoom/pan
- **Panel właściwości (prawy)** — Kontekstowe sekcje: Wygląd, Wypełnienie, Obrys, Typografia, Layout, Pozycja
- **Pasek narzędzi (dół)** — Wybór narzędzia: Zaznacz, Frame, Sekcja, Prostokąt, Elipsa, Linia, Tekst, Pióro, Ręka

## Komponenty

### Renderowanie (CanvasKit WASM)

Ten sam silnik renderowania co Figma. CanvasKit zapewnia rysowanie 2D z akceleracją GPU:
- Kształty wektorowe (prostokąt, elipsa, ścieżka, linia, gwiazda, wielokąt)
- Kształtowanie tekstu przez Paragraph API
- Efekty (cienie, rozmycia, tryby mieszania)
- Eksport (PNG, SVG, PDF)

Binarny plik WASM o wielkości 7 MB ładuje się przy starcie i tworzy powierzchnię GPU na canvasie HTML.

### Graf sceny

Płaska `Map<string, Node>` indeksowana ciągami GUID. Struktura drzewa poprzez referencje `parentIndex`. Zapewnia wyszukiwanie O(1), wydajne przechodzenie, hit testing i zapytania obszarowe dla selekcji markerowej.

Zobacz [Referencja grafu sceny](/reference/scene-graph) dla szczegółów wewnętrznych.

### Silnik layoutu (Yoga WASM)

Yoga od Mety zapewnia obliczanie layoutu CSS flexbox. Cienki adapter mapuje nazwy właściwości Figmy na odpowiedniki Yoga:

| Właściwość Figma | Odpowiednik Yoga |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Format pliku (Kiwi binarny)

Wykorzystuje sprawdzony binarny kodek Kiwi Figmy z 194 definicjami wiadomości/enum/struct. Pipeline importu `.fig`: parsowanie nagłówka → dekompresja Zstd → dekodowanie Kiwi → NodeChange[] → graf sceny. Pipeline eksportu odwraca proces: graf sceny → NodeChange[] → kodowanie Kiwi → kompresja Zstd → ZIP z miniaturą.

Zobacz [Referencja formatu pliku](/reference/file-format) dla szczegółów.

### Cofnij/Ponów

Wzorzec komendy odwrotnej. Przed zastosowaniem jakiejkolwiek zmiany, dotknięte pola są zrzucane do snapshotu. Snapshot staje się operacją odwrotną. Batching grupuje szybkie zmiany (jak przeciąganie) w pojedyncze wpisy cofania.

### Schowek

Dwukierunkowy schowek kompatybilny z Figmą. Koduje/dekoduje binarne Kiwi (ten sam format co pliki .fig) używając natywnych zdarzeń kopiuj/wklej przeglądarki (synchronicznych, nie asynchronicznego API Schowka). Wklejanie obsługuje skalowanie ścieżek wektorowych, wypełnianie dzieci instancji, wykrywanie zestawów komponentów i stosowanie nadpisań.

### Serwer MCP

`@open-pencil/mcp` udostępnia 75 narzędzi core + 3 narzędzia zarządzania plikami dla narzędzi kodowania AI. Dwa transporty: stdio dla Claude Code/Cursor/Windsurf, HTTP z Hono + Streamable HTTP dla skryptów i CI. Narzędzia są definiowane raz w `packages/core/src/tools/schema.ts` i adaptowane dla chatu AI (valibot), MCP (zod) i CLI (polecenie eval).

### Współpraca P2P

Współpraca peer-to-peer w czasie rzeczywistym przez Trystero (WebRTC) + Yjs CRDT. Bez serwera relay — sygnalizacja przez publiczne brokery MQTT, STUN/TURN dla traversalu NAT. Protokół awareness zapewnia kursory na żywo, selekcje i obecność. Lokalna persystencja przez y-indexeddb.
