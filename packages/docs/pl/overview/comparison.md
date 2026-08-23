# OpenPencil i Penpot: architektura oraz wydajność

OpenPencil i Penpot to narzędzia projektowe o otwartym kodzie źródłowym, ale różnią się przeznaczeniem i architekturą.

::: info Renderer WASM w Penpot
Penpot 2.x zawiera renderer Rust/Skia WASM `render-wasm/v1`, włączany opcjami serwera albo parametrem `?wasm=true`. Domyślnie nadal działa renderer SVG. Poniżej uwzględniono oba warianty.
:::

## 1. Rozmiar bazy kodu

| Wskaźnik | OpenPencil | Penpot |
|----------|------------|--------|
| Wiersze kodu | **około 26 000** | **około 299 000** |
| Pliki źródłowe | około 143 | około 2 900 |
| Języki | TypeScript, Vue | Clojure, ClojureScript, Rust, JavaScript, SQL, SCSS |
| Kod renderera | około 3 200 wierszy, TypeScript | 22 000 wierszy, Rust/Skia WASM |
| Interfejs | około 4 500 wierszy | około 175 000 wierszy, CLJS i SCSS |
| Część serwerowa | Brak, architektura lokalna | 32 600 wierszy i 151 plików SQL |
| Stosunek | **1×** | **około 11×** |

OpenPencil jest około jedenaście razy mniejszy. Wynika to przede wszystkim z innej architektury, a nie tylko z mniejszej liczby funkcji.

## 2. Architektura

### OpenPencil: jeden proces klienta

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

Edytor, SceneGraph, kodek plików i renderer działają w jednym procesie. Oddzielny serwer, baza danych i Docker nie są potrzebne. SceneGraph jest przechowywany jako `Map<string, SceneNode>`. TypeScript wywołuje CanvasKit bezpośrednio, a Yoga WASM synchronicznie oblicza układ.

### Penpot: platforma klient-serwer

```text
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                     │
│  ClojureScript frontend │ Clojure/JVM backend        │
│  Rust/Skia WASM         │ PostgreSQL, Valkey, MinIO  │
│  Chromium exporter      │ MCP server                 │
└───────────────────────────────────────────────────────┘
```

Pełna instalacja Penpota obejmuje interfejs, część serwerową JVM, PostgreSQL, Valkey, MinIO i eksporter oparty na Chromium bez interfejsu. Środowisko programistyczne wymaga Docker Compose, JVM, Node i zestawu narzędzi Rust.

OpenPencil unika opóźnień sieciowych, serializacji między usługami, zarządzania kontenerami i zapytań do bazy danych podczas zwykłych operacji. Penpot jest przeznaczony do wieloosobowej pracy na serwerze, a OpenPencil — do lokalnej edycji z małym opóźnieniem.

## 3. Potok renderowania

### OpenPencil: TypeScript → CanvasKit WASM

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- Bezpośrednie przejście z TypeScript do WASM.
- SceneGraph pozostaje w pamięci JavaScript i nie jest serializowany przed renderowaniem.
- Renderer liczy około 3 200 wierszy podzielonych na wyspecjalizowane moduły.

### Penpot: ClojureScript → Rust WASM → Skia

```text
ClojureScript → JavaScript
  → rozłożenie i pakowanie binarne w pamięci WASM
  → Rust WASM przez Emscripten C FFI
  → skia-safe
  → Skia/WebGL
```

Bez WASM każdy kształt jest renderowany jako element SVG DOM przez React/Reagent. W trybie WASM identyfikatory UUID, transformacje, zalewy i obwiednie są pakowane do struktur binarnych. Renderer używa pamięci podręcznej kafelków, obszarów zainteresowania, jedenastu powierzchni i globalnego zmiennego stanu przez `unsafe`.

Pamięć podręczna może przechowywać do 1024 tekstur. OpenPencil przerysowuje całą widoczną część dokumentu.

| Aspekt | OpenPencil | Penpot |
|--------|------------|--------|
| JavaScript → WASM | Bezpośrednie wywołania z obiektami TypeScript | Struktury binarne |
| Model | Pełne przerysowanie widoku | Pamięć podręczna kafelków |
| Powierzchnie | 1 | 11 |
| Dodatkowa pamięć | Brak kafelków | Do 1024 kafelków |
| Rozmiar renderera | około 3 200 wierszy | 22 000 wierszy |
| Kod niebezpieczny | Brak | Stan globalny przez `unsafe` |

Bezpośredni potok CanvasKit wymaga mniej przetwarzania pośredniego w małych i średnich dokumentach. Kafelki Penpota mogą być korzystne przy ponad 100 000 kształtów, gdy widoczny jest tylko niewielki obszar.

## 4. SceneGraph i model danych

```typescript
nodes: Map<string, SceneNode>
```

OpenPencil zapewnia wyszukiwanie po identyfikatorze w O(1), 29 typów obiektów ze schematu Kiwi, około 390 pól w `NodeChange`, ścisłe typy TypeScript i identyfikatory GUID w formacie Figma `sessionID:localID`.

Penpot utrzymuje własne definicje typów w Clojure/ClojureScript i Rust. Oddzielne moduły odpowiadają za kolory, komponenty, kontenery, zalewy, siatkę, modyfikatory, strony i ścieżki. Malli sprawdza schematy podczas działania, a dane renderowania przekraczają granicę CLJS → Rust.

## 5. Silnik układu

OpenPencil synchronicznie korzysta z Yoga WASM:

```typescript
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
```

Penpot utrzymuje własne implementacje Flex i Grid w ClojureScript i Rust WASM. Oba silniki muszą zwracać ten sam wynik. OpenPencil używa Yoga, w tym odmiany z obsługą Grid; Penpot utrzymuje tysiące wierszy własnego kodu układu w dwóch językach.

## 6. Formaty i Figma

OpenPencil używa binarnego formatu Kiwi Figma, bezpośrednio importuje `.fig`, odczytuje dane Kiwi ze schowka i jest zgodny z protokołem współpracy Figma.

Plik `.penpot` to archiwum ZIP z manifestami JSON, danymi dokumentu, zasobami binarnymi i miniaturami. Penpot nie importuje `.fig` bezpośrednio i obsługuje kilka generacji formatu przez migracje.

## 7. Stan i cofanie

OpenPencil używa poleceń odwrotnych: funkcje wykonania i cofania przechowują tylko niezbędny stan, a kilka operacji można grupować.

Penpot korzysta z Potok. `UpdateEvent` zmienia stan, `WatchEvent` wykonuje skutki uboczne przez RxJS, a historia przechowuje odwrotne zestawy zmian, ogranicza się do 50 wpisów i grupuje szybkie zmiany w transakcje.

## 8. Programowanie

| Wskaźnik | OpenPencil | Penpot |
|----------|------------|--------|
| Przygotowanie | `bun install && bun dev` | Docker Compose, JVM, Node i Rust |
| Szybkie odświeżanie | Vite | shadow-cljs |
| Typy | Ścisły TypeScript | Schematy Malli podczas działania |
| Wersja komputerowa | Tauri v2 | Przeglądarka |
| Główne technologie | TypeScript i Vue | Clojure, ClojureScript, Rust i Docker |

## 9. Wydajność

| Scenariusz | OpenPencil | Penpot |
|------------|------------|--------|
| Zimny start | poniżej 2 s z WASM | ponad 10 s dla serwera, klienta i WASM |
| Zwykła operacja | W jednym procesie | Możliwa wymiana sieciowa |
| Klatka | Bezpośrednie wywołanie Skia | CLJS → JS → WASM FFI → Skia |
| Pamięć bazowa | około 50 MB w karcie | JVM, baza danych, pamięć podręczna i przeglądarka |
| Praca bez sieci | Pełna | Wymaga serwera |
| 10 000 kształtów | Jedno przejście | Renderer kafelkowy z 11 powierzchniami |

## 10. Zalety Penpota

1. **Współpraca przez serwer:** konta, kontrola dostępu i centralne przechowywanie.
2. **Eksport PDF:** oddzielny eksporter Chromium.
3. **System wtyczek:** wykonanie w izolacji i API wtyczek.
4. **Tokeny projektu:** wbudowana obsługa.
5. **CSS Grid:** własna implementacja; OpenPencil używa odmiany Yoga z Grid.
6. **Samodzielne wdrożenie:** platforma zespołowa uruchamiana przez Docker.
7. **Dojrzałość:** wiele lat użycia produkcyjnego.

## 11. Skrypty i rozszerzanie

Polecenie [`eval`](/programmable/cli/scripting) udostępnia API zgodne z Figma Plugin API dla skryptów bez interfejsu, operacji grupowych i automatycznych testów. AI Chat, serwer MCP i CLI oferują również 90 narzędzi do odczytu, tworzenia, modyfikacji, pracy ze strukturą, zmiennymi, ścieżkami wektorowymi, analizą, różnicami, operacjami logicznymi i rozmieszczaniem.

Penpot oferuje wtyczki wykonywane w izolacji, ale nie ma porównywalnego API dla skryptów bez interfejsu ani integracji MCP.

## Podsumowanie

| Obszar | Przewaga | Powód |
|--------|----------|-------|
| Prostota | OpenPencil | Jeden proces zamiast wielu usług |
| Renderowanie | OpenPencil | Bezpośredni potok CanvasKit |
| Kod | OpenPencil | Około 26 000 wobec 299 000 wierszy |
| Zgodność z Figmą | OpenPencil | Natywne Kiwi i `.fig` |
| Programowanie | OpenPencil | TypeScript i Vue zamiast Clojure, Rust i Docker |
| Aplikacja komputerowa | OpenPencil | Tauri |
| Układ | OpenPencil | Yoga zamiast dwóch własnych implementacji |
| Współpraca | Różne mocne strony | Penpot: serwer i kontrola dostępu; OpenPencil: P2P bez hostingu |
| Samodzielne wdrożenie | Penpot | Docker |
| Dojrzałość | Penpot | Wieloletnie użycie produkcyjne |

OpenPencil to zwarty edytor działający w jednym procesie, z CanvasKit i natywną obsługą `.fig`. Penpot to pełna platforma klient-serwer wykorzystująca Clojure, ClojureScript, Rust, bazy danych i usługi Docker. Oba narzędzia obsługują współpracę, ale korzystają z innych modeli.
