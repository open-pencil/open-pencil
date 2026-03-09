# Matryca funkcji Figmy

Porównanie funkcja po funkcji możliwości Figma Design z aktualnym stanem implementacji Open Pencil.

::: tip Legenda statusów
✅ Obsługiwane — funkcja działa w pełni · 🟡 Częściowe — podstawowe zachowanie istnieje, brakuje niektórych pod-funkcji · 🔲 Jeszcze nie zaimplementowane
:::

**Pokrycie:** 94 ze 158 elementów Figmy uwzględnionych — 76 ✅ w pełni obsługiwanych, 18 🟡 częściowych, 64 🔲 oczekujących. Ostatnia aktualizacja: 2026-03-07.

## Interfejs i nawigacja

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Pasek narzędzi projektowych | ✅ | Pasek dolny (styl UI3): Zaznacz, Frame, Sekcja, Prostokąt, Elipsa, Linia, Tekst, Ręka, Pióro |
| Panel warstw (lewy panel boczny) | ✅ | Widok drzewa z rozwijaniem/zwijaniem, zmianą kolejności, przełącznikiem widoczności; zmienna szerokość |
| Panel stron | ✅ | Dodaj, usuń, zmień nazwę stron; stan viewportu per strona |
| Panel właściwości (prawy panel boczny) | ✅ | Sekcje: Wygląd, Wypełnienie, Obrys, Efekty, Typografia, Layout, Pozycja; zmienna szerokość |
| Zoom i panorama | ✅ | <kbd>Ctrl</kbd> + scroll, pinch, <kbd>⌘</kbd><kbd>+</kbd> / <kbd>⌘</kbd><kbd>−</kbd> / <kbd>⌘</kbd><kbd>0</kbd>, spacja+przeciągnij, środkowy przycisk myszy, narzędzie ręki (H) |
| Linijki canvasu | ✅ | Linijki góra/lewo z pasmami zaznaczenia i badge'ami współrzędnych |
| Kolor tła canvasu | ✅ | Tło per strona przez panel właściwości |
| Prowadnice canvasu | 🔲 | Figma obsługuje przeciągane prowadnice z linijek |
| Menu akcji / paleta poleceń | 🔲 | Szybkie wyszukiwanie akcji Figmy |
| Menu kontekstowe | ✅ | Prawy klik z schowkiem, kolejnością-z, grupowaniem, komponentem, widocznością, blokadą, przenieś-na-stronę |
| Skróty klawiszowe | 🟡 | Podstawowe + komponenty + kolejność-z + widoczność/blokada zaimplementowane; Skala, Strzałka, Ołówek, odbijanie, formatowanie tekstu jeszcze nie podłączone |
| Szukaj i zamień | 🔲 | Wyszukiwanie/zamiana tekstu w dokumencie |
| Widok konturów warstw | 🔲 | Widok wireframe wszystkich warstw |
| Niestandardowe miniatury | 🔲 | Miniatura generowana przy eksporcie, ale bez selektora |
| Ustawienia wartości nudge | 🔲 | Domyślnie 1px/10px; Figma pozwala na wartości niestandardowe |
| Menu aplikacji (tryb przeglądarkowy) | ✅ | Menu Plik, Edycja, Widok, Obiekt, Tekst, Rozmieszczenie; Tauri używa natywnych menu |
| Narzędzia AI | 🟡 | 90 narzędzi przez OpenRouter + serwer MCP; bez obrazów generowanych przez AI ani wyszukiwania AI jeszcze |

## Warstwy i kształty

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Narzędzia kształtów (Prostokąt, Elipsa, Linia, Wielokąt, Gwiazda) | ✅ | Wszystkie podstawowe typy kształtów; boki wielokąta i promień wewnętrzny gwiazdy konfigurowalne |
| Ramki | ✅ | Przycinanie zawartości, niezależny układ współrzędnych |
| Grupy | ✅ | <kbd>⌘</kbd><kbd>G</kbd> grupowanie, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> rozgrupowanie |
| Sekcje | ✅ | Pigułki tytułu, auto-adopcja nakładających się węzłów, tekst adaptacyjny do luminancji |
| Narzędzie łuku (łuki, półkola, pierścienie) | ✅ | arcData z kątem początkowym/końcowym i promieniem wewnętrznym |
| Narzędzie ołówka (odręczne) | 🔲 | Narzędzie rysowania odręcznego Figmy |
| Maski | 🔲 | Maski kształtów do przycinania warstw |
| Typy warstw i hierarchia | ✅ | 17 typów węzłów, płaska Mapa + drzewo rodzic-dziecko |
| Zaznaczanie warstw | ✅ | Klik, shift-klik, zaznaczenie markerowe |
| Wyrównanie i pozycja | ✅ | Pozycja, rotacja, wymiary w panelu |
| Kopiuj i wklej obiekty | ✅ | Standardowy schowek + format binarny Kiwi Figmy |
| Skaluj warstwy proporcjonalnie | 🟡 | Shift-zmiana rozmiaru utrzymuje proporcje; brak dedykowanego narzędzia Scale (K) |
| Zablokuj i odblokuj warstwy | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> przełącza blokadę |
| Przełącz widoczność warstwy | ✅ | Ikona oka w panelu + skrót <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> |
| Zmień nazwę warstw | ✅ | Dwuklik - zmiana nazwy inline; <kbd>Enter</kbd>/<kbd>Escape</kbd>/blur aby zatwierdzić |
| Przenieś na wierzch / Wyślij na spód | ✅ | Skróty ] i [; też w menu kontekstowym |
| Przenieś na stronę | ✅ | Przenoszenie węzłów między stronami przez menu kontekstowe |
| Ograniczenia (responsywna zmiana rozmiaru) | 🔲 | Przypięcie krawędzi/centrum dla zachowania resize rodzica |
| Inteligentna selekcja (rozmieść/wyrównaj) | 🔲 | Równomierne rozmieszczanie i wyrównywanie |
| Prowadnice layoutu (kolumny, wiersze, siatka) | 🔲 | Prowadnice kolumn/wierszy/siatki na ramkach |
| Mierzenie odległości między warstwami | 🔲 | Alt-najechanie pokazuje odległości |
| Edycja obiektów zbiorowo | ✅ | Panel wielokrotnego zaznaczenia: wspólne wartości normalne, różne pokazują "Mixed" |
| Identyfikacja pasujących obiektów | 🔲 | Znajdowanie podobnych warstw |
| Kopiuj/wklej właściwości | 🔲 | Kopiowanie wypełnienia/obrysu/efektów między warstwami |
| Relacje rodzic-dziecko | ✅ | Pełna hierarchia z parentIndex, re-parentowanie przez przeciąganie |

## Narzędzia wektorowe

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Sieci wektorowe | ✅ | Model kompatybilny z Figmą, nie proste ścieżki |
| Narzędzie pióro | ✅ | Punkty narożne, krzywe Béziera, ścieżki otwarte/zamknięte |
| Edytuj warstwy wektorowe | 🟡 | Tworzenie działa; zaawansowana edycja wierzchołków ograniczona |
| Operacje booleowskie (Suma, Różnica, Przecięcie, Wykluczenie) | 🔲 | Łączenie kształtów operacjami booleowskimi |
| Spłaszczanie warstw | 🔲 | Łączenie ścieżek wektorowych |
| Konwersja obrysów na ścieżki | 🔲 | Polecenie Outline Stroke |
| Konwersja tekstu na ścieżki | 🔲 | Spłaszczanie tekstu na kontury wektorowe |
| Narzędzie shape builder | 🔲 | Interaktywne narzędzie booleowskie |
| Offset ścieżki | 🔲 | Inset/outset ścieżki wektorowej |
| Uproszczenie ścieżki | 🔲 | Redukcja liczby punktów wektorowych |

## Tekst i typografia

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Narzędzie tekstowe i edycja inline | ✅ | Natywna edycja na canvasie, phantom textarea, style run (<kbd>⌘</kbd><kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd>, przycisk S) |
| Renderowanie tekstu (Paragraph API) | ✅ | CanvasKit Paragraph do kształtowania, łamania linii, metryk |
| Ładowanie czcionek (czcionki systemowe) | ✅ | Inter domyślny, font-kit w Tauri z cache OnceLock, queryLocalFonts w przeglądarce |
| Rodzina i grubość czcionki | ✅ | FontPicker z wirtualnym scrollem, wyszukiwaniem, podglądem CSS |
| Rozmiar czcionki i interlinia | ✅ | Edytowalne w sekcji typografii |
| Wyrównanie tekstu | 🟡 | Podstawowe wyrównanie; Figma ma wyrównanie pionowe i tryby auto-szerokość/wysokość |
| Style tekstu | 🟡 | Pogrubienie/kursywa/podkreślenie/przekreślenie per zaznaczenie; brak presetów wielokrotnego użytku |
| Tryby zmiany rozmiaru tekstu | 🔲 | Tryby auto-szerokość, auto-wysokość, stały-rozmiar Figmy |
| Listy punktowane i numerowane | 🔲 | Formatowanie list w tekście |
| Linki w tekście | 🔲 | Hiperlinki w treści tekstowej |
| Emoji i symbole inteligentne | 🔲 | Renderowanie emoji i znaków specjalnych |
| Funkcje OpenType | 🔲 | Ligatury, alternatywy stylistyczne, cyfry tabelaryczne |
| Czcionki zmienne | 🔲 | Regulowane osie czcionki (grubość, szerokość, pochylenie) |
| Obsługa tekstu CJK | 🔲 | Renderowanie tekstu chińskiego, japońskiego, koreańskiego |
| Obsługa tekstu RTL | 🔲 | Layout tekstu od prawej do lewej |
| Czcionki ikon | 🔲 | Specjalna obsługa glifów czcionek ikon |

## Kolor, gradienty i obrazy

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Wybieracz kolorów (HSV) | ✅ | Kwadrat HSV, slider odcienia, slider alfa, wejście hex |
| Wypełnienia jednolite | ✅ | Kolor hex z przezroczystością |
| Gradient liniowy | ✅ | Punkty stopu, uchwyty transformacji |
| Gradient radialny | ✅ | Renderowanie przez shadery CanvasKit |
| Gradient kątowy | ✅ | Obsługa gradientu sweep/stożkowego |
| Gradient diamentowy | ✅ | Gradient diamentowy czteropunktowy |
| Wypełnienia obrazem | ✅ | Dekodowane z danych blob z trybami skali (fill, fit, crop, tile) |
| Wypełnienia wzorem | 🔲 | Powtarzające się wypełnienia obrazem/wzorem |
| Tryby mieszania | 🔲 | Tryby mieszania warstwy i wypełnienia (multiply, screen, overlay, itp.) |
| Dodawanie obrazów i wideo | 🟡 | Wypełnienia obrazem renderowane; brak importu drag-and-drop ani obsługi wideo |
| Regulacja właściwości obrazu | 🔲 | Ekspozycja, kontrast, nasycenie, itp. |
| Przycinanie obrazu | 🔲 | Interaktywne przycinanie obrazów |
| Narzędzie kroplomierza | 🔲 | Próbkowanie kolorów z canvasu |
| Edycja koloru w selekcji mieszanej | 🔲 | Regulacja kolorów w heterogenicznej selekcji |
| Modele kolorów (RGB, HSL, HSB, Hex) | 🟡 | HSV + Hex w wybieraczu; brak przełączania trybu HSL lub RGB |

## Efekty i właściwości

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Cień rzutowany | ✅ | Offset, promień rozmycia, kolor przez filtry CanvasKit |
| Cień wewnętrzny | ✅ | Efekt cienia wewnętrznego |
| Rozmycie warstwy | ✅ | Rozmycie gaussowskie na warstwie |
| Rozmycie tła | ✅ | Rozmycie zawartości za warstwą |
| Rozmycie pierwszego planu | ✅ | Rozmycie na pierwszym planie |
| Grubość obrysu | ✅ | Konfigurowalny w panelu właściwości |
| Zakończenie obrysu (round, square, arrow) | ✅ | `NONE`, `ROUND`, `SQUARE`, `ARROW_LINES`, `ARROW_EQUILATERAL` |
| Złączenie obrysu (miter, bevel, round) | ✅ | Wszystkie trzy typy złączeń |
| Wzory przerywane | ✅ | Wzór obrysu dash-on/dash-off |
| Promień narożnika | ✅ | Jednolity i per narożnik z niezależnym przełącznikiem |
| Wygładzanie narożnika (styl iOS) | 🔲 | Ciągłe zaokrąglanie narożników Figmy |
| Wielokrotne wypełnienia/obrysy na warstwę | 🔲 | Figma pozwala na nakładanie wypełnień i obrysów |

## Auto Layout

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Przepływ poziomy i pionowy | ✅ | Silnik flexbox Yoga WASM |
| Przełącz auto layout (<kbd>⇧</kbd><kbd>A</kbd>) | ✅ | Przełącz na ramce lub owijaj zaznaczenie |
| Gap (odstęp między dziećmi) | ✅ | Konfigurowalny w panelu właściwości |
| Padding (jednolity i per strona) | ✅ | Wszystkie cztery strony niezależnie |
| Justify content | ✅ | Start, center, end, space-between |
| Align items | ✅ | Start, center, end, stretch |
| Wymiarowanie dzieci (stałe, wypełnij, dopasuj) | ✅ | Tryby wymiarowania per dziecko |
| Wrap | ✅ | Flex wrap dla layoutu wieloliniowego |
| Przepływ auto layout siatka | ✅ | CSS Grid przez fork Yoga — ścieżki kolumn/wierszy, odstępy, spany |
| Przepływy połączone (zagnieżdżone) | ✅ | Zagnieżdżone ramki auto-layout z różnymi kierunkami |
| Zmiana kolejności przeciąganiem w auto layout | ✅ | Wizualny wskaźnik wstawiania |
| Min/max szerokość i wysokość | 🔲 | Figma obsługuje ograniczenia min/max |

## Komponenty i systemy projektowe

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Tworzenie komponentów | 🟡 | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> tworzy z ramki/grupy; brak UI właściwości komponentu jeszcze |
| Zestawy komponentów | 🟡 | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> łączy komponenty; przerywana fioletowa ramka; brak edycji właściwości wariantów |
| Instancje komponentów | 🟡 | Tworzenie instancji z menu kontekstowego; sync na żywo; brak UI edycji nadpisań |
| Warianty | 🔲 | Przełączanie wariantów i selekcja po właściwościach |
| Właściwości komponentu | 🔲 | Właściwości boolean, tekst, zamiana instancji |
| Propagacja nadpisań | ✅ | Zmiany w głównym komponencie propagowane; nadpisania zachowane |
| Zmienne (kolor, liczba, string, boolean) | 🟡 | `COLOR` z pełnym UI; `FLOAT`/STRING/BOOLEAN zdefiniowane bez UI edycji |
| Kolekcje i tryby zmiennych | 🟡 | Kolekcje, tryby, zmiana activeMode działają; brak UI tematyzacji |
| Style (kolor, tekst, efekt, layout) | 🔲 | Presety stylów wielokrotnego użytku |
| Biblioteki (publikuj, udostępniaj, aktualizuj) | 🔲 | Współdzielone biblioteki komponentów/stylów |
| Odłącz instancję | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> konwertuje instancję na ramkę |
| Przejdź do głównego komponentu | ✅ | Nawigacja do komponentu źródłowego, cross-page |

## Prototypowanie

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Połączenia prototypu | 🔲 | Planowane na Fazę 6 |
| Wyzwalacze (klik, najechanie, przeciągnięcie, itp.) | 🔲 | Planowane na Fazę 6 |
| Akcje (nawiguj, overlay, scroll, itp.) | 🔲 | Planowane na Fazę 6 |
| Animacje i przejścia | 🔲 | Planowane na Fazę 6 |
| Smart animate | 🔲 | Auto-animowanie pasujących warstw |
| Overlaye | 🔲 | Prototypowanie modalne/popover |
| Zachowanie scroll i overflow | 🔲 | Przewijalne ramki w prototypach |
| Przepływy prototypu | 🔲 | Nazwane punkty startowe |
| Zmienne w prototypach | 🔲 | Logika warunkowa ze zmiennymi |
| Easing i animacje sprężynowe | 🔲 | Niestandardowe krzywe animacji |
| Prezentuj i odtwarzaj prototypy | 🔲 | Pełnoekranowy widok prototypu |

## Import i eksport

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Import pliku .fig | ✅ | Pełny kodek Kiwi: 194 definicje, ~390 pól per `NodeChange` |
| Eksport pliku .fig | ✅ | Kodowanie Kiwi + kompresja Zstd + generowanie miniatur |
| Zapisz / Zapisz jako | ✅ | <kbd>⌘</kbd><kbd>S</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>; natywne dialogi (Tauri), File System Access API (Chrome/Edge), fallback pobierania (Safari) |
| Schowek Figmy (wklej) | ✅ | Dekodowanie binarnego Kiwi ze schowka Figmy |
| Schowek Figmy (kopiuj) | ✅ | Kodowanie binarnego Kiwi czytelnego przez Figmę |
| Import pliku Sketch | 🔲 | Parsowanie plików .sketch |
| Eksport obrazu/SVG | 🟡 | PNG/JPG/WEBP z selektorem skali i podglądem; WEBP/SVG export ✅; PDF export 🔲 |
| Historia wersji | 🔲 | Przeglądanie i przywracanie poprzednich wersji |
| Kopiowanie zasobów między narzędziami | 🟡 | Schowek Figmy działa; Kopiuj jako tekst/SVG/PNG/JSX |

## API pluginów i skryptowanie

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Komenda eval z Figma Plugin API | ✅ | Headless wykonywanie JavaScript z globalnym obiektem figma kompatybilnym |

## Współpraca i tryb deweloperski

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Komentarze (przypinanie, wątki, rozwiązywanie) | 🔲 | Planowane na Fazę 6 |
| Multiplayer w czasie rzeczywistym | ✅ | P2P przez Trystero + Yjs CRDT, kursory, tryb śledzenia; bez serwera |
| Chat przy kursorze | 🔲 | Bąbelki czatu inline przy kursorze |
| Branching i merging | 🔲 | Gałęzie wersji dla plików projektowych |
| Tryb deweloperski (inspekcja) | 🟡 | Karta Kod pokazuje JSX; brak właściwości CSS ani specyfikacji handoff |
| Code Connect | 🔲 | Łączenie komponentów projektowych z kodem |
| Fragmenty kodu | 🟡 | Eksport JSX z podświetlaniem i kopiowaniem; brak fragmentów CSS/Swift/Kotlin |
| Figma for VS Code | 🔲 | Integracja z pluginem edytora |
| Serwer MCP | ✅ | @open-pencil/mcp z transportami stdio + HTTP; 87 narzędzi core + 3 zarządzanie plikami = 90 total |
| Narzędzia CLI | ✅ | Headless CLI: info, tree, find, export, analyze, node, pages, variables, eval; serwer MCP |

## Figma Draw

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Narzędzia ilustracji | 🔲 | Specjalistyczne narzędzia rysowania Figma Draw |
| Transformacje wzorów | 🔲 | Tworzenie powtarzających się wzorów z transformacjami |
