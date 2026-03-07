# Plan rozwoju

## Fazy

### Faza 1: Silnik Core ✅

SceneGraph, renderowanie Skia, podstawowe kształty, selekcja, zoom/pan, cofnij/ponów, linie wyrównania.

### Faza 2: UI Edytora + Layout ✅

Vue 3 + Reka UI panele, właściwości, warstwy, pasek narzędzi, Yoga auto-layout, edycja tekstu inline, linijki canvas.

### Faza 3: I/O Plików + Funkcje Wizualne ✅

Import/eksport .fig, kodek Kiwi, schowek, narzędzie pióra, sieci wektorowe, grupy, Tauri v2 desktop, sekcje, wiele stron, podświetlenie hover, renderowanie Tier 1.

### Faza 4: Komponenty + Zmienne ✅

Komponenty, instancje, nadpisania, zestawy komponentów, zmienne (COLOR/FLOAT/STRING/BOOLEAN), kolekcje, tryby, eksport obrazów, menu kontekstowe, formatowanie tekstu bogatego.

### Faza 5: Integracja AI i Narzędzia ✅

**Dostarczone:**
- @open-pencil/core wyodrębniony do packages/core/ (zero zależności DOM)
- @open-pencil/cli z headless operacjami .fig (info, tree, find, export, analyze, eval)
- Polecenie `eval` z API Plugin kompatybilnym z Figmą
- Chat AI: bezpośrednie połączenie OpenRouter, 75 narzędzi w `schema.ts`, ⌘J
- 49 dodatkowych narzędzi AI/MCP przeniesionych z figma-use (75 łącznie)
- Serwer MCP (@open-pencil/mcp): stdio + HTTP, 75 narzędzi core + 3 zarządzanie plikami
- Ujednolicone definicje narzędzi: zdefiniuj raz w `schema.ts`, adaptuj dla chatu AI (valibot), MCP (zod), CLI (eval)
- Pasek menu dla trybu przeglądarki
- Autozapis: zapis z debounce 3s
- Panel właściwości multi-selekcji z wartościami wspólnymi/mieszanymi

**Planowane:**
- Tryb attached: WebSocket do działającego edytora
- System wytycznych projektowych

### Faza 6: Współpraca + Dystrybucja 🟡

**Dostarczone:**
- Współpraca P2P przez Trystero (WebRTC) + Yjs CRDT — bez serwera relay
- Protokół awareness: kursory na żywo, selekcje, obecność
- Tryb śledzenia: klik na avatar peera aby śledzić viewport
- Lokalna persystencja przez y-indexeddb
- Renderowanie efektów: cień rzucany, cień wewnętrzny, rozmycie warstwy/tła/pierwszego planu
- Karty multi-plikowe: ⌘N/⌘T nowa karta, ⌘W zamknij, ⌘O otwórz
- Podpisywanie kodu Apple i notaryzacja dla macOS
- Buildy Linux (x64) dodane do CI
- Strona dokumentacji VitePress z i18n (6 języków)

**Planowane:**
- Prototypowanie (połączenia ramek, przejścia, animacje)
- Komentarze (pin, wątki, rozwiązywanie)
- Wsparcie PWA
- Przełączanie wariantów, UI zmiennych FLOAT/STRING/BOOLEAN, theming przez zmienne

## Harmonogram

| Faza | Szacowany czas | Status |
|------|---------------|--------|
| Faza 1: Silnik Core | 3 miesiące | ✅ Ukończona |
| Faza 2: UI Edytora + Layout | 3 miesiące | ✅ Ukończona |
| Faza 3: I/O Plików + Funkcje Wizualne | 2 miesiące | ✅ Ukończona |
| Faza 4: Komponenty + Zmienne | 2 miesiące | ✅ Ukończona |
| Faza 5: Integracja AI i Narzędzia | 2 miesiące | ✅ Ukończona |
| Faza 6: Współpraca + Dystrybucja | 2 miesiące | 🟡 W toku |
