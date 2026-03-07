# Funkcje

## Dlaczego OpenPencil

Narzędzia projektowe to problem łańcucha dostaw. Gdy narzędzie jest zamknięte, dostawca kontroluje co jest możliwe — może zepsuć automatyzację z dnia na dzień. OpenPencil to alternatywa open-source: licencja MIT, kompatybilny z Figmą, w pełni lokalny i programowalny.

## Import i eksport plików .fig Figmy

Otwieraj i zapisuj natywne pliki Figmy bezpośrednio. Import dekoduje pełny schemat Kiwi z 194 definicjami w tym wiadomości NodeChange z ~390 polami. Eksport koduje graf sceny z powrotem do binarnego Kiwi z kompresją Zstd i generowaniem miniatur. Zapisz (<kbd>⌘</kbd><kbd>S</kbd>) i Zapisz jako (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>) używają natywnych okien dialogowych OS.

## Kopiuj i wklej z Figmą

Zaznacz węzły w Figmie, <kbd>⌘</kbd><kbd>C</kbd>, przełącz się na OpenPencil, <kbd>⌘</kbd><kbd>V</kbd> — pojawiają się z wypełnieniami, obrysami, auto-layoutem, tekstem, promieniami narożników, efektami i sieciami wektorowymi. Działa też w drugą stronę.

Wklejanie obsługuje złożone scenariusze: ścieżki wektorowe są skalowane z `normalizedSize` Figmy, dzieci instancji są wypełniane z `symbolData` komponentu, zestawy komponentów są wykrywane, a `symbolOverrides` są stosowane. Czcionki są ładowane automatycznie.

## Sieci wektorowe

Narzędzie pióro używa modelu sieci wektorowej Figmy — nie prostych ścieżek. Kliknij dla punktów narożnych, kliknij+przeciągnij dla krzywych Béziera. Obsługa ścieżek otwartych i zamkniętych.

## Narzędzia kształtów

Pasek narzędzi udostępnia wszystkie podstawowe narzędzia kształtów Figmy: Prostokąt (<kbd>R</kbd>), Elipsa (<kbd>O</kbd>), Linia (<kbd>L</kbd>), Wielokąt i Gwiazda. Wszystkie obsługują wypełnienie, obrys, podświetlenie przy najechaniu i kontur zaznaczenia.

## Auto-Layout

Yoga WASM zapewnia layout CSS flexbox. Ramki obsługują: kierunek, gap, padding, justify, align i wymiarowanie dzieci. Shift+A przełącza auto-layout.

## Edycja tekstu inline

Natywna edycja tekstu na canvasie. Podwójne kliknięcie na węźle tekstowym wchodzi w tryb edycji. **Wybieracz czcionek** z wirtualnym przewijaniem, filtrem wyszukiwania i podglądem CSS. W Tauri czcionki systemowe są enumerowane przez crate Rust `font-kit`.

## Formatowanie tekstu bogatego

Formatowanie per-znak: <kbd>⌘</kbd><kbd>B</kbd> pogrubienie, <kbd>⌘</kbd><kbd>I</kbd> kursywa, <kbd>⌘</kbd><kbd>U</kbd> podkreślenie, lub przyciski B/I/U/S. Zaimplementowane przez model StyleRun. Zachowane przy imporcie/eksporcie .fig.

## Cofnij/Ponów

Każda operacja jest cofalna. Wzorzec komendy odwrotnej. <kbd>⌘</kbd><kbd>Z</kbd> cofa, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> ponawia.

## Prowadnice snap

Przyciąganie do krawędzi i centrów z czerwonymi liniami prowadzącymi. Uwzględnia rotację.

## Linijki canvasu

Linijki na górze i po lewej pokazują skale współrzędnych z badge'ami współrzędnych przy zaznaczeniu.

## Wybieracz kolorów i typy wypełnień

Wybór koloru HSV ze sliderem odcienia, sliderem alfa, wejściem hex i kontrolą przezroczystości. Typy: Jednolity, Gradient (Liniowy, Radialny, Kątowy, Diamentowy) i Obraz.

## Panel warstw

Widok drzewa hierarchii dokumentu. Panele są zmiennych rozmiarów.

## Panel właściwości

Interfejs z kartami **Design** | **Kod** | **AI**. Karta Design pokazuje sekcje kontekstowe: Wygląd, Wypełnienie, Obrys, Efekty, Typografia, Layout, Pozycja, Eksport i Strona.

## Grupuj/Rozgrupuj

⌘G grupuje. ⇧⌘G rozgrupowuje. Węzły są sortowane wg pozycji wizualnej.

## Sekcje

Sekcje (<kbd>S</kbd>) to kontenery organizacyjne najwyższego poziomu na canvasie z pigułkami tytułu i automatyczną inwersją koloru tekstu.

## Dokumenty wielostronicowe

Dokumenty obsługują wiele stron. Każda strona utrzymuje niezależny stan viewportu.

## Podświetlenie przy najechaniu

Węzły podświetlają się konturem podążającym za rzeczywistą geometrią.

## Zaawansowane renderowanie (Tier 1)

Renderer CanvasKit obsługuje pełne cechy wizualne Tier 1: wypełnienia gradientowe, wypełnienia obrazem, efekty, właściwości obrysu, dane łuku, culling viewportu, ponowne użycie Paint i koalescencja RAF.

## Komponenty i instancje

Komponenty wielokrotnego użytku (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), zestawy (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), instancje przez menu kontekstowe, odłącz (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd>). **Synchronizacja na żywo** i **obsługa nadpisań**. Fioletowe etykiety z ikoną diamentu.

## Zmienne

Tokeny projektowe z kolekcjami i trybami. Dialog TanStack Table. Obsługuje COLOR z pełnym UI, FLOAT/STRING/BOOLEAN zdefiniowane. Wszystkie operacje są cofalne.

## Eksport obrazów

PNG, JPG, WEBP ze skalą 0,5×–4×, podgląd na żywo i <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>.

## Menu kontekstowe

Kliknij prawym dla: Schowek, Kolejność Z, Grupowanie, Komponenty (fioletowe pozycje), Widoczność, Przenieś na stronę.

## Kolejność Z, widoczność i blokada

<kbd>]</kbd> przenosi na wierzch, <kbd>[</kbd> wysyła na spód. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> widoczność. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> blokada.

## Aplikacja webowa i desktopowa

OpenPencil działa w przeglądarce na [app.openpencil.dev](https://app.openpencil.dev). Aplikacja desktopowa używa Tauri v2 (~5 MB). Działa w pełni offline.

## Menu aplikacji (przeglądarka)

Pasek menu z reka-ui: **Plik**, **Edycja**, **Widok**, **Obiekt**, **Tekst**, **Rozmieszczenie**. Skróty klawiszowe dostosowane do platformy. Ukryte w Tauri.

## Automatyczny zapis

Pliki zapisywane 3 sekundy po ostatniej zmianie. Debounce na `sceneVersion`. Wyłączone dla nowych dokumentów bez tytułu.

## Współpraca P2P

Współpraca peer-to-peer w czasie rzeczywistym — bez serwera. Oparta na Trystero (WebRTC) + Yjs (CRDT).

- **Zero kosztów hostingu** — sygnalizacja przez publiczne brokery MQTT
- **Traversal NAT** — serwery Google STUN, Cloudflare STUN i Open Relay TURN
- **Kursory na żywo** — kolorowe strzałki w stylu Figmy z pigułkami imion
- **Obecność** — kolorowe awatary
- **Tryb śledzenia** — kliknij awatar peera aby śledzić jego viewport
- **Lokalna persystencja** — y-indexeddb utrzymuje pokój między przeładowaniami
- **Bezpieczne pokoje** — ID przez `crypto.getRandomValues()`

## Karty wieloplikowe

Otwieraj wiele dokumentów w kartach. <kbd>⌘</kbd><kbd>N</kbd>/<kbd>⌘</kbd><kbd>T</kbd> nowa karta, <kbd>⌘</kbd><kbd>W</kbd> zamknij, <kbd>⌘</kbd><kbd>O</kbd> otwórz w nowej karcie. Każda karta utrzymuje własny stan dokumentu.

## Renderowanie efektów

Pełne renderowanie efektów Figmy: **Cień rzutowany**, **Cień wewnętrzny**, **Rozmycie warstwy** (Gaussowskie), **Rozmycie tła** (efekt szkła/matowania), **Rozmycie pierwszego planu**. Cache SkPicture per węzeł dla wydajności.

## Właściwości wielokrotnego zaznaczenia

Zaznacz wiele węzłów i edytuj wspólne właściwości. Wspólne wartości wyświetlane normalnie, różne pokazują "Mixed". Odwróć H/V dotyczy wszystkich węzłów.

## ScrubInput

Wszystkie wejścia numeryczne używają interakcji przeciągnij-aby-zmienić. Obsługuje sufiksy (°, px, %).

## Budowanie CI/CD

GitHub Actions buduje aplikacje Tauri na tagach wersji. macOS podpisany i notaryzowany. Noty wydania auto-wypełniane z CHANGELOG.md.

## @open-pencil/core i CLI

Silnik wyodrębniony do `packages/core/`. CLI udostępnia: info, tree, find, export, analyze, node, pages, variables, eval. Wszystko obsługuje `--json`. Komenda `eval` wykonuje JavaScript z API Plugin Figma. Zobacz [Komenda Eval](/eval-command).

## Renderer JSX

Programistyczne tworzenie designu przez buildery TreeNode. Propsy shorthand w stylu Tailwind.

## Chat AI

Wbudowany asystent AI przez <kbd>⌘</kbd><kbd>J</kbd>. **78 narzędzi** w `schema.ts` obejmujących: odczyt, tworzenie, modyfikację, manipulację węzłów, CRUD zmiennych, narzędzia wektorowe, kontrolę viewportu i `eval`. **Serwer MCP** udostępnia 78 narzędzi łącznie (75 core + 3 zarządzanie plikami) dla zewnętrznych narzędzi kodowania AI.

## Eksport SVG

Eksportuje wybrane węzły jako PNG, JPG, WEBP lub SVG. CLI: `bun open-pencil export --format svg file.fig`.

## Kopiuj jako

Podmenu **Kopiuj jako** w menu kontekstowym oferuje: Kopiuj jako tekst, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), JSX.

## Wyrównanie obrysu i grubości per-strona

Wyrównanie: **Wewnątrz**, **Środek** lub **Na zewnątrz**. Indywidualne grubości per-strona (Góra/Prawo/Dół/Lewo).

## Układ mobilny & PWA

Instalowalne jako PWA. Na urządzeniach mobilnych panele boczne zastąpione przez wysuwaną szufladę dolną z zakładkami.

## Eksport Tailwind CSS v4

Zakładka Kod oferuje przełącznik między **OpenPencil JSX** a **Tailwind CSS v4** (HTML z klasami utility).

## Google Fonts Fallback

Gdy czcionka nie jest dostępna lokalnie, OpenPencil ładuje ją automatycznie z Google Fonts API.

## Homebrew Tap

Na macOS: `brew install open-pencil/tap/open-pencil`

## Inline zmiana nazwy warstw

Dwuklik na nazwie warstwy aby ją zmienić. Enter lub klik poza polem zatwierdza, Escape anuluje.

## Profiler renderowania

Nakładka HUD z metrykami czasu renderowania. Dostępna z menu Widok.

## Panel kodu

Karta Kod pokazuje JSX zaznaczenia z podświetlaniem składni Prism.js i kopiowaniem.

## Jakość kodu

Wykrywanie kopiuj-wklej przez jscpd — duplikacja zredukowana z 15,6% do 0,62%. Pipeline importu zoptymalizowany z O(n²) do O(n).
