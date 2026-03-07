# Open Pencil vs Penpot: Porównanie architektury i wydajności

Dlaczego porównujemy? OpenPencil istnieje, ponieważ zamknięte platformy projektowe kontrolują co jest możliwe. Zrozumienie różnic architektonicznych pokazuje, co otwarta alternatywa local-first może zrobić inaczej.

::: info Renderer WASM Penpota
Penpot 2.x zawiera renderer Rust/Skia WASM (`render-wasm/v1`) aktywowany przez flagi serwera lub parametr URL `?wasm=true`. Stary renderer SVG pozostaje domyślny. Ta strona obejmuje oba.
:::

## 1. Skala i rozmiar kodu

| Metryka | Open Pencil | Penpot |
|---------|-------------|--------|
| LOC ogółem | **~26 000** | **~299 000** |
| Pliki źródłowe | ~143 | ~2 900 |
| Języki | TypeScript, Vue | Clojure, ClojureScript, Rust, JS, SQL, SCSS |
| Silnik renderowania | ~3 200 LOC (TS, 10 plików) | 22 000 LOC (Rust/Skia WASM) |
| Kod UI | ~4 500 LOC | ~175 000 LOC (CLJS + SCSS) |
| Backend | Brak (local-first) | 32 600 LOC + 151 plików SQL |
| Stosunek LOC | **1×** | **~11×** |

Open Pencil jest **~11× mniejszy** — i o to chodzi. To nie uproszczenie; to fundamentalnie inna architektura.

## 2. Architektura

### Open Pencil: Klient monolityczny

```
┌─────────────────────────────────┐
│         Tauri (natywna powłoka) │
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

**Wszystko w jednym procesie.** Bez serwera, bazy danych, Dockera.

### Penpot: Rozproszony klient-serwer

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

**Minimum 5+ usług.** PostgreSQL, Redis (Valkey), MinIO, backend JVM, eksporter Node.js (headless Chromium), plus frontend ClojureScript.

### Werdykt: Architektura

Architektura jednoprocesowa Open Pencil eliminuje: opóźnienie sieci, narzut serializacji, złożoność orkiestracji kontenerów i narzut zapytań do bazy danych.

## 3. Pipeline renderowania

### Open Pencil: TS → CanvasKit WASM (bezpośrednio)

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- **1 przekroczenie granicy:** TS → WASM (CanvasKit)
- 1 646 LOC renderera łącznie

### Penpot: JS (skompilowany z CLJS) → Rust WASM → Skia

```
ClojureScript (skompilowany do JS)
  → dekompozycja na prymitywy + pakowanie binarne do pamięci liniowej WASM
  → Rust WASM (przez Emscripten C FFI)
  → skia-safe (bindingi Rust Skia)
  → Skia (WebGL)
```

Gdy wyłączone (domyślnie), renderowanie jako drzewo DOM SVG. Gdy włączone, system renderowania oparty na kafelkach z 11 powierzchniami.

### Werdykt: Renderowanie

| Aspekt | Open Pencil | Penpot |
|--------|-------------|--------|
| Granica JS→WASM | Bezpośrednia (obiekty TS) | Pakowanie binarne (104 bajty na kształt) |
| Model renderowania | Natychmiastowy/pełne przerysowanie | Cache kafelkowy |
| Zarządzanie powierzchniami | 1 powierzchnia | 11 powierzchni |
| Narzut pamięci | Niski | Wysoki (1024 wpisy cache) |
| Złożoność kodu | 1 646 LOC | 22 000 LOC |
| Kod unsafe | Brak | Globalny stan `unsafe` |

## 4. Graf sceny i model danych

### Open Pencil

```typescript
nodes: Map<string, SceneNode>
// 29 typów węzłów ze schematu Kiwi Figmy
// ~390 pól na NodeChange (kompatybilny z Figmą)
```

### Penpot

- Dane rozproszone w `common/` (49 600 LOC .cljc)
- Walidacja schematu w runtime (Malli)

### Werdykt: Model danych

Open Pencil reutylizuje sprawdzony schemat Figmy (194 definicje Kiwi) bezpośrednio w TypeScript. Penpot utrzymuje własny system typów w trzech językach.

## 5. Silnik layoutu

### Open Pencil: Yoga WASM (314 LOC)

```typescript
import Yoga from 'yoga-layout'
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
```

314 linii. Synchroniczny, w procesie.

### Penpot: Podwójna implementacja

Penpot utrzymuje **dwa niezależne silniki layoutu** (CLJS i Rust) — ~3 000+ LOC zduplikowanego kodu.

## 6. Format pliku i kompatybilność z Figmą

### Open Pencil

- **Natywny format binarny Kiwi** — ta sama serializacja co Figma
- Bezpośredni import `.fig`, wklejanie ze schowka Figmy
- Kompatybilny z protokołem multiplayer Figmy

### Penpot

- **Archiwum ZIP** (`.penpot`) z manifestami JSON i zasobami binarnymi
- Brak natywnego importu `.fig`

### Werdykt: Format pliku

Open Pencil ma znaczącą przewagę — może czytać pliki Figmy natywnie i wklejać dane ze schowka Figmy.

## 7. Zarządzanie stanem i cofanie

### Open Pencil

```typescript
// 110 LOC — wzorzec komendy odwrotnej
class UndoManager {
  apply(entry) { entry.forward(); this.undoStack.push(entry) }
  undo() { entry.inverse(); this.redoStack.push(entry) }
}
```

### Penpot

Zarządzanie stanem przez Potok. Cofanie z wektorami zmian odwrotnych (max 50 wpisów), auto-wygasanie po 20 sekundach.

## 8. Doświadczenie developerskie

| Metryka | Open Pencil | Penpot |
|---------|-------------|--------|
| Setup dev | `bun install && bun dev` | Docker Compose + JVM + Node + Rust |
| Hot reload | Vite HMR (~50ms) | shadow-cljs (sekundy) |
| Sprawdzanie typów | TypeScript (strict) | Runtime (schematy Malli) |
| Czas buildu | <5s (Vite) | Minuty (JVM + CLJS + Rust WASM) |
| Bariera pierwszej kontrybucji | Niska (TS/Vue) | Wysoka (Clojure + Rust + Docker) |
| Desktop | Tauri v2 (~5MB) | N/A (tylko przeglądarka) |

## 9. Charakterystyki wydajności

| Scenariusz | Open Pencil | Penpot |
|------------|-------------|--------|
| Zimny start | <2s (ładowanie WASM) | 10s+ (serwer + klient + WASM) |
| Opóźnienie operacji | <1ms (w procesie) | 10-50ms (round-trip sieci) |
| Klatka renderowania | Bezpośrednie wywołanie Skia | CLJS→JS→WASM FFI→Skia |
| Pamięć bazowa | ~50MB (karta przeglądarki) | ~300MB+ (JVM + Postgres + Valkey + przeglądarka) |
| Zdolność offline | Pełna (local-first) | Brak (zależy od serwera) |

## 10. Co Penpot robi lepiej

1. **Współpraca serwerowa** — centralna edycja wieloużytkownikowa z WebSockets, kontami i kontrolą dostępu
2. **Serwerowy eksport PDF** — usługa eksportu headless Chromium dla PDF (Open Pencil eksportuje już SVG natywnie)
3. **System pluginów** — pełne API z sandboxowanym wykonywaniem
4. **Tokeny projektowe** — natywne wsparcie design tokenów
5. **CSS Grid layout** — własna implementacja (Open Pencil czeka na Yoga Grid)
6. **Self-hosting** — wdrożenie Docker dla zespołów
7. **Dojrzałość** — lata użytkowania w produkcji

## 11. Scripting i rozszerzalność

OpenPencil zawiera [komendę `eval`](/eval-command) oferującą API Plugin kompatybilne z Figmą do skryptowania headless. Ponadto 78 narzędzi AI dostępnych przez wbudowany chat, serwer MCP (stdio + HTTP) i CLI. Penpot ma system pluginów z sandboxem, ale bez API skryptowania headless ani integracji MCP.

## Podsumowanie

| Wymiar | Zwycięzca | Dlaczego |
|--------|-----------|----------|
| **Prostota architektoniczna** | Open Pencil | Jeden proces vs 5+ usług |
| **Wydajność renderowania** | Open Pencil | Bezpośredni CanvasKit vs SVG DOM (domyślnie) lub WASM pakowany |
| **Utrzymywalność kodu** | Open Pencil | ~26K LOC w 1 języku vs 299K w 4+ |
| **Kompatybilność z Figmą** | Open Pencil | Natywny kodek Kiwi vs brak wsparcia .fig |
| **Onboarding developerów** | Open Pencil | TS/Vue vs Clojure/Rust/Docker |
| **Doświadczenie desktop** | Open Pencil | Natywne Tauri vs tylko przeglądarka |
| **Silnik layoutu** | Open Pencil | Yoga (sprawdzony) vs podwójna implementacja |
| **Współpraca** | Remis | Penpot: serwer z kontrolą dostępu; Open Pencil: P2P przez Trystero + Yjs |
| **Self-hosting** | Penpot | Gotowy Docker vs tylko desktop |
| **Dojrzałość ekosystemu** | Penpot | Lata produkcji vs wczesny etap |

Open Pencil jest architektonicznie szczuplejszy — jednoprocesowy renderer CanvasKit w ~26K LOC TypeScript, kompatybilny z Figmą z założenia. Penpot to platforma full-stack z ~299K LOC. Open Pencil ma skryptowanie headless, **78 narzędzi AI/MCP**, eksport SVG i natywną aplikację desktop.
