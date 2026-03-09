# Funkcje

## Pliki .fig Figmy

Otwieraj i zapisuj natywne pliki Figmy bezpośrednio. Pipeline importu/eksportu używa tego samego binarnego kodeka Kiwi co Figma — 194 definicje schematu, ~390 pól na węzeł. Zapisz: <kbd>⌘</kbd><kbd>S</kbd>, Zapisz jako: <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Kopiuj i wklej z Figmą** — zaznacz węzły w Figmie, <kbd>⌘</kbd><kbd>C</kbd>, przełącz się na OpenPencil, <kbd>⌘</kbd><kbd>V</kbd>. Wypełnienia, obrysy, auto-layout, tekst, efekty, promienie narożników i sieci wektorowe są zachowane. Działa w obie strony.

## Rysowanie i edycja

- **Kształty** — Prostokąt (<kbd>R</kbd>), Elipsa (<kbd>O</kbd>), Linia (<kbd>L</kbd>), Wielokąt, Gwiazda
- **Narzędzie pióro** — sieci wektorowe (nie proste ścieżki), krzywe Béziera z uchwytami stycznych
- **Tekst** — natywna edycja na canvasie z obsługą IME, podwójne kliknięcie aby wejść w tryb edycji
- **Tekst bogaty** — formatowanie per-znak: pogrubienie (<kbd>⌘</kbd><kbd>B</kbd>), kursywa (<kbd>⌘</kbd><kbd>I</kbd>), podkreślenie (<kbd>⌘</kbd><kbd>U</kbd>), przekreślenie
- **Auto-layout** — flexbox przez Yoga WASM: kierunek, gap, padding, justify, align, wymiarowanie dzieci. <kbd>⇧</kbd><kbd>A</kbd> aby przełączyć
- **Komponenty** — tworzenie (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), zestawy komponentów (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), instancje z obsługą nadpisań, synchronizacja na żywo
- **Zmienne** — tokeny projektowe z kolekcjami, trybami (Light/Dark), typami color/float/string/boolean, wiązaniem zmiennych
- **Sekcje** — kontenery organizacyjne z automatyczną adopcją dzieci i pigułkami tytułu

## Panel właściwości

Kontekstowe karty Design | Kod | AI:

- **Wygląd** — przezroczystość, promień narożnika (jednolity lub per-narożnik), widoczność
- **Wypełnienie** — jednolite, gradient (liniowy/radialny/kątowy/diamentowy), obraz
- **Obrys** — kolor, grubość, wyrównanie (wewnątrz/środek/na zewnątrz), grubości per-strona, zakończenie, łączenie, kreska
- **Efekty** — cień rzutowany, cień wewnętrzny, rozmycie warstwy, rozmycie tła, rozmycie pierwszego planu
- **Typografia** — wybieracz czcionek z wirtualnym przewijaniem i wyszukiwaniem, grubość, rozmiar, wyrównanie, przyciski stylu
- **Layout** — kontrolki auto-layoutu gdy włączony
- **Eksport** — skala, format (PNG/JPG/WEBP/SVG), podgląd na żywo

## Renderowanie

Skia (CanvasKit WASM) — ten sam silnik renderowania co Figma:

- Wypełnienia gradientowe (liniowe, radialne, kątowe, diamentowe)
- Wypełnienia obrazem z trybami skalowania
- Efekty z cache'owaniem per-węzeł
- Dane łuku (częściowe elipsy, donuty)
- Culling viewportu i ponowne użycie paint
- Prowadnice snap z wyrównywaniem uwzględniającym rotację
- Linijki canvasu z badge'ami zaznaczenia
- Podświetlenie przy najechaniu podążające za rzeczywistą geometrią

## Cofnij/Ponów

Każda operacja jest cofalna — tworzenie, usuwanie, przesuwanie, zmiana rozmiaru, zmiana właściwości, zmiana rodzica, zmiany layoutu, operacje na zmiennych. Wzorzec komendy odwrotnej. <kbd>⌘</kbd><kbd>Z</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Dokumenty wielostronicowe

Dodawaj, usuwaj, zmieniaj nazwy stron. Każda strona ma niezależny stan viewportu. Podwójne kliknięcie aby zmienić nazwę inline.

## Karty wieloplikowe

Otwieraj wiele dokumentów w kartach. <kbd>⌘</kbd><kbd>T</kbd> nowa karta, <kbd>⌘</kbd><kbd>W</kbd> zamknij, <kbd>⌘</kbd><kbd>O</kbd> otwórz plik.

## Eksport

- **Obraz** — PNG, JPG, WEBP w konfigurowalnej skali (0,5×–4×). Przez panel, menu kontekstowe lub <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>
- **SVG** — kształty, tekst z przebiegami stylów, gradienty, efekty, tryby mieszania
- **Tailwind JSX** — HTML z klasami utility Tailwind v4, gotowy dla React lub Vue
- **Kopiuj jako** — tekst, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>) lub JSX przez menu kontekstowe

CLI: `open-pencil export design.fig -f jsx --style tailwind`

## Chat AI

Naciśnij <kbd>⌘</kbd><kbd>J</kbd> aby otworzyć asystenta AI. 87 narzędzi do tworzenia kształtów, ustawiania stylów, zarządzania layoutem, pracy z komponentami i zmiennymi, operacji boolowskich, analizy tokenów projektowych i eksportu zasobów. Użyj własnego klucza API OpenRouter.

Wywołania narzędzi wyświetlane jako zwijane wpisy na osi czasu. Selektor modeli z Claude, Gemini, GPT, DeepSeek i innymi.

## Serwer MCP

Podłącz Claude Code, Cursor, Windsurf lub dowolnego klienta MCP do odczytu i zapisu plików `.fig` headlessly. 90 narzędzi (87 core + 3 zarządzanie plikami). Dwa transporty: stdio i HTTP.

```sh
bun add -g @open-pencil/mcp
```

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Zobacz [Referencja narzędzi MCP](/programmable/mcp-server) dla pełnej listy narzędzi.

## CLI

Inspekcja, eksport i analiza plików `.fig` z terminala:

```sh
open-pencil tree design.fig          # Drzewo węzłów
open-pencil find design.fig --type TEXT  # Wyszukiwanie
open-pencil export design.fig -f png     # Renderowanie
open-pencil analyze colors design.fig    # Audyt kolorów
open-pencil analyze clusters design.fig  # Powtarzające się wzorce
open-pencil eval design.fig -c "..."     # Figma Plugin API
```

Gdy aplikacja desktopowa jest uruchomiona, pomiń plik aby sterować edytorem na żywo przez RPC:

```sh
open-pencil tree                     # Aktywny dokument
open-pencil export -f png            # Zrzut ekranu canvasu
```

Wszystkie komendy obsługują `--json`. Instalacja: `bun add -g @open-pencil/cli`

## Współpraca w czasie rzeczywistym

P2P przez WebRTC — bez serwera. Udostępnij link i edytujcie razem.

- Kursory na żywo z kolorowymi strzałkami i pigułkami imion
- Awatary obecności
- Tryb śledzenia — kliknij peera aby śledzić jego viewport
- Lokalna persystencja przez IndexedDB
- Bezpieczne ID pokojów przez `crypto.getRandomValues()`

## Desktop i Web

**Desktop** — Tauri v2, ~7 MB. macOS (podpisany i notaryzowany), Windows, Linux. Natywne menu, tryb offline, automatyczny zapis.

**Web** — działa na [app.openpencil.dev](https://app.openpencil.dev), instalowalny jako PWA na urządzeniach mobilnych z UI zoptymalizowanym pod dotyk.

**Homebrew:**

```sh
brew install open-pencil/tap/open-pencil
```

## Google Fonts Fallback

Gdy czcionka nie jest dostępna lokalnie, OpenPencil pobiera ją automatycznie z Google Fonts. Nie trzeba ręcznie instalować czcionek przy otwieraniu plików .fig z nieznanymi fontami.
