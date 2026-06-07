# Architektura

## Przegląd systemu

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

## Układ edytora

Interfejs podąża za layoutem UI3 Figmy — pasek narzędzi na dole, nawigacja po lewej, właściwości po prawej:

- **Panel nawigacji (lewy)** — Drzewo warstw, panel stron
- **Canvas (środek)** — Nieskończony canvas z renderowaniem CanvasKit, zoom/pan
- **Panel właściwości (prawy)** — Kontekstowe sekcje: Wygląd, Wypełnienie, Obrys, Typografia, Layout, Pozycja
- **Pasek narzędzi (dół)** — Wybór narzędzia: Zaznacz, Frame, Sekcja, Prostokąt, Elipsa, Linia, Tekst, Pióro, Ręka

## Komponenty

### Renderowanie (CanvasKit WASM)

Ten sam silnik renderowania co Figma. CanvasKit zapewnia rysowanie 2D z akceleracją GPU z kształtami wektorowymi, kształtowaniem tekstu przez Paragraph API, efektami (cienie, rozmycia, tryby mieszania) i eksportem (PNG, SVG). Binarny plik WASM o wielkości 7 MB ładuje się przy starcie i tworzy powierzchnię GPU na canvasie HTML.

Renderer jest podzielony na wyspecjalizowane moduły w `packages/core/src/renderer/`: przechodzenie sceny, nakładki, wypełnienia, obrysy, kształty, efekty, linijki, etykiety i zdalne kursory.

### Graf sceny

Płaska `Map<string, Node>` indeksowana ciągami GUID. Struktura drzewa poprzez referencje `parentIndex`. Zapewnia wyszukiwanie O(1), wydajne przechodzenie, hit testing i zapytania obszarowe dla selekcji markerowej.

Graf emituje typowane zdarzenia przez nanoevents: `node:created`, `node:updated`, `node:deleted`, `node:reparented`, `node:reordered`. Podsystemy subskrybują te zdarzenia zamiast ręcznego okablowania — edytor używa ich do unieważniania renderowania i synchronizacji instancji komponentów z microtask batchingiem, system współpracy do propagacji Yjs.

Zobacz [Referencja grafu sceny](/reference/scene-graph) dla szczegółów wewnętrznych.

### Silnik layoutu (Yoga WASM)

Yoga od Mety zapewnia obliczanie layoutu CSS flexbox i grid poprzez [fork](https://github.com/open-pencil/yoga/tree/grid) z obsługą CSS Grid. Cienki adapter mapuje nazwy właściwości Figmy na odpowiedniki Yoga:

| Właściwość Figma | Odpowiednik Yoga |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Format pliku (Kiwi binarny)

Wykorzystuje binarny kodek Kiwi Figmy z 194 definicjami wiadomości/enum/struct. Import: parsowanie nagłówka → dekompresja Zstd → dekodowanie Kiwi → `NodeChange`[] → graf sceny. Eksport odwraca proces z generowaniem miniatur.

Zobacz [Referencja formatu pliku](/reference/file-format) dla szczegółów.

### AI i narzędzia

Narzędzia są definiowane raz w `packages/core/src/tools/`, podzielone wg domeny: read, create, modify, structure, variables, vector, analyze. Każde narzędzie ma typowane parametry i funkcję `execute(figma, args)`. Adaptery konwertują je dla:

- **Chat AI** — schematy valibot, multi-provider (Anthropic, OpenAI, Google AI, OpenRouter, kompatybilne endpointy)
- **Serwer MCP** — schematy zod, transporty stdio + HTTP
- **CLI** — dostępne przez komendę `eval`

90+ narzędzi core + 3 narzędzia zarządzania plikami MCP. Zawiera zapytania XPath (`query_nodes`), inspekcję JSX (`get_jsx`, `diff_jsx`), opis semantyczny (`describe`) i weryfikację wizualną (`export_image` zwraca obrazy do modelu).

### Cofnij/Ponów

Wzorzec komendy odwrotnej. Przed zastosowaniem jakiejkolwiek zmiany, dotknięte pola są zrzucane do snapshotu. Snapshot staje się operacją odwrotną. Batching grupuje szybkie zmiany (jak przeciąganie) w pojedyncze wpisy cofania.

### Schowek

Dwukierunkowy schowek kompatybilny z Figmą. Koduje/dekoduje binarne Kiwi (ten sam format co pliki .fig) przez natywne zdarzenia kopiuj/wklej przeglądarki. Obsługuje skalowanie ścieżek wektorowych, dzieci instancji, wykrywanie zestawów komponentów i stosowanie nadpisań.

### Współpraca P2P

Współpraca peer-to-peer w czasie rzeczywistym przez Trystero (WebRTC) + Yjs CRDT. Bez serwera relay — sygnalizacja przez publiczne brokery MQTT, STUN/TURN dla traversalu NAT. Protokół awareness zapewnia kursory na żywo, selekcje i obecność. Lokalna persystencja przez y-indexeddb.

### Most RPC CLI-do-Aplikacji

Gdy aplikacja desktopowa jest uruchomiona, komendy CLI łączą się z nią przez serwer MCP, zamiast wymagać pliku .fig. Serwer MCP nasłuchuje na gnieździe domeny Unix z opcjonalnym TCP na `127.0.0.1:7600` (HTTP + WebSocket). Komendy wykonują się na stanie edytora na żywo, umożliwiając skryptom automatyzacji i agentom AI interakcję z uruchomioną aplikacją.

## Co dalej

### Pełny zestaw narzędzi figma-use

Serwer MCP obecnie udostępnia 90 narzędzi. Referencyjna implementacja w [figma-use](https://github.com/dannote/figma-use) ma 118. Pozostałe narzędzia obejmują zaawansowane ograniczenia layoutu, połączenia prototypów, zaawansowaną edycję właściwości komponentów i masowe operacje na dokumentach.

### Narzędzia CI do designu

Headless CLI już obsługuje `analyze colors/typography/spacing/clusters`. Następnie: integracja z GitHub Actions dla automatycznego lintingu designu i regresji wizualnej w PR-ach.

### Prototypowanie

Przejścia między ramkami, wyzwalacze interakcji (kliknięcie, najechanie, przeciągnięcie), zarządzanie nakładkami i tryb podglądu pełnoekranowego.

### Podpisywanie kodu Windows

Binaria macOS są podpisane i notaryzowane od v0.6.0. Podpisywanie Windows Authenticode przez Azure Code Signing jest planowane aby usunąć ostrzeżenie SmartScreen.
