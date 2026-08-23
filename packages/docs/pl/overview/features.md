# Funkcje

## Pliki Figma

OpenPencil otwiera i zapisuje pliki `.fig` bez wcześniejszej konwersji. Import i eksport korzystają z binarnego kodeka Kiwi używanego przez Figmę: 194 definicje schematu i około 390 pól dla każdego obiektu. Zapisz: <kbd>⌘</kbd><kbd>S</kbd>; Zapisz jako: <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Kopiowanie między Figmą a OpenPencil:** skopiuj obiekty w jednym edytorze i wklej w drugim. Zachowywane są zalewy, obwiednie, automatyczny układ, tekst, efekty, promienie narożników i sieci wektorowe. Wymiana działa w obie strony.

## Rysowanie i edycja

- **Figury:** prostokąt, elipsa, linia, wielokąt i gwiazda.
- **Pióro:** sieci wektorowe, krzywe Béziera i uchwyty stycznych.
- **Tekst:** edycja bezpośrednio na obszarze roboczym i obsługa IME.
- **Formatowanie tekstu:** pogrubienie, kursywa, podkreślenie i przekreślenie wybranych zakresów.
- **Automatyczny układ:** Flexbox i CSS Grid przez Yoga WASM; kierunek, odstępy, wypełnienie, wyrównanie, rozmiary i ścieżki siatki.
- **Komponenty:** tworzenie komponentów i zestawów, egzemplarze, nadpisania oraz automatyczna synchronizacja.
- **Zmienne:** tokeny projektu z kolekcjami, trybami Light i Dark, typami Color, Float, String i Boolean oraz powiązaniami.
- **Sekcje:** kontenery najwyższego poziomu przejmujące przecinające się obiekty.

## Panel właściwości

Zawartość kart „Projekt”, „Kod” i „AI” zależy od zaznaczenia.

- **Wygląd:** przezroczystość, wspólny lub osobny promień narożników i widoczność.
- **Zalew:** kolor jednolity, gradient liniowy, radialny, kątowy lub diamentowy oraz obraz.
- **Obwiednia:** kolor, grubość, wyrównanie, osobna grubość boków, zakończenia, łączenia i kreskowanie.
- **Efekty:** cień zewnętrzny i wewnętrzny, rozmycie warstwy, tła i pierwszego planu.
- **Typografia:** wybór czcionki z wyszukiwaniem i wirtualnym przewijaniem, odmiana, rozmiar, wyrównanie i formatowanie.
- **Układ:** ustawienia automatycznego układu.
- **Eksport:** skala, format PNG/JPG/WEBP/SVG i podgląd.

## Renderowanie

OpenPencil używa Skia przez CanvasKit WASM — tego samego silnika graficznego co Figma:

- gradienty liniowe, radialne, kątowe i diamentowe;
- zalewy obrazami z różnymi trybami skalowania;
- pamięć podręczna efektów osobnych obiektów;
- łuki, częściowe elipsy i pierścienie;
- pomijanie obiektów poza widokiem i ponowne użycie pędzli;
- prowadnice przyciągania z uwzględnieniem obrotu;
- linijki z zakresem zaznaczenia;
- podświetlenie zgodne z rzeczywistą geometrią.

## Cofanie i ponawianie

Można cofnąć tworzenie, usuwanie, przesuwanie, zmianę rozmiaru, właściwości i rodzica, układ oraz zmienne. Skróty: <kbd>⌘</kbd><kbd>Z</kbd> i <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Strony i dokumenty

Strony można dodawać, usuwać i przemianowywać; każda zachowuje własne położenie i skalę widoku. Wiele dokumentów można otworzyć w kartach.

## Eksport

- **Obrazy:** PNG, JPG i WEBP w skali od 0,5× do 4×.
- **SVG:** figury, tekst z zakresami stylów, gradienty, efekty i tryby mieszania.
- **Tailwind JSX:** HTML z klasami Tailwind v4 dla React lub Vue.
- **Kopiuj jako:** tekst, SVG, PNG albo JSX przez menu kontekstowe.

```sh
openpencil export design.fig -f jsx --style tailwind
```

## Czat AI

Naciśnij <kbd>⌘</kbd><kbd>J</kbd>. Ponad 90 narzędzi tworzy figury, zmienia style i układ, pracuje z komponentami i zmiennymi, wykonuje operacje logiczne, analizuje tokeny projektu i eksportuje zasoby. Można podłączyć Anthropic, OpenAI, Google AI, OpenRouter albo zgodny punkt końcowy.

Wywołania narzędzi pojawiają się na zwijanej osi czasu. Do kontroli wizualnej asystent eksportuje wynik i porównuje go z poleceniem. Wszystkie zmiany AI można cofnąć.

## Serwer MCP

Claude Code, Cursor, Windsurf i inni klienci MCP mogą odczytywać i zmieniać `.fig` bez interfejsu. Dostępnych jest ponad 90 narzędzi oraz transporty stdio i HTTP.

```sh
npm install -g @open-pencil/mcp
```

## CLI

```sh
openpencil tree design.fig              # Drzewo obiektów
openpencil find design.fig --type TEXT  # Wyszukiwanie
openpencil export design.fig -f png     # Eksport
openpencil analyze colors design.fig    # Analiza kolorów
openpencil analyze clusters design.fig  # Powtarzające się struktury
openpencil eval design.fig -c "..."     # Figma Plugin API
```

Wszystkie polecenia obsługują `--json`. Instalacja: `npm install -g @open-pencil/cli` albo `bun add -g @open-pencil/cli`.

## Współpraca w czasie rzeczywistym

Połączenie równorzędne WebRTC nie wymaga centralnego serwera. Udostępnij odnośnik i edytuj dokument wspólnie z innymi osobami, korzystając z kursorów, informacji o obecności i trybu śledzenia.

## Wersja komputerowa i internetowa

**Komputer:** Tauri v2, około 7 MB, dla macOS, Windows i Linux, z menu systemowymi, pracą bez sieci i automatycznym zapisem.

**Internet:** [app.openpencil.dev](https://app.openpencil.dev), możliwość instalacji jako PWA i interfejs dotykowy.

## Zastępcze ładowanie Google Fonts

Jeśli czcionka nie jest dostępna lokalnie, OpenPencil automatycznie pobiera ją z Google Fonts. Ręczna instalacja nie jest potrzebna.
