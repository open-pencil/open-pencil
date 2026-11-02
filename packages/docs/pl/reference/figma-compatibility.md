# Zgodność z Figmą

Porównanie funkcji Figma Design z obecnymi możliwościami OpenPencil.

::: tip Stan
✅ Obsługiwane — działa w pełnym zakresie · 🟡 Częściowo — podstawowe działanie istnieje, ale brakuje części funkcji · 🔲 Brak
:::

**Pokrycie:** uwzględniono 128 ze 156 funkcji Figmy — 112 ✅ obsługiwanych, 16 🟡 częściowych i 28 🔲 niezaimplementowanych. Aktualizacja: 2026-10-27.

## Interfejs i nawigacja

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Pasek narzędzi | ✅ | Dolny pasek w stylu UI3: przesuwanie, ramka/sekcja, kształty, pióro/ołówek, tekst, rączka i komentarz; konfigurowalny, z wyborem ikon |
| Panel warstw | ✅ | Rozwijane drzewo, zmiana kolejności przez przeciąganie, widoczność i zmienna szerokość |
| Panel stron | ✅ | Dodawanie, usuwanie i przemianowywanie stron; osobny stan widoku |
| Panel właściwości | ✅ | Wygląd, zalew, obwiednia, efekty, typografia, układ, siatki układu, ograniczenia, położenie, maska, właściwości komponentu, kolory zaznaczenia i eksport; zmienna szerokość |
| Powiększenie i przesuwanie | ✅ | Przewijanie, gest szczypania, skróty 0/1/2, Space + przeciąganie, środkowy przycisk i Rączka |
| Linijki | ✅ | Linijki u góry i z lewej strony z zakresem zaznaczenia i współrzędnymi |
| Tło obszaru roboczego | ✅ | Osobny kolor dla każdej strony |
| Prowadnice | ✅ | Przeciąganie z linijek na obszar roboczy lub do ramek; zaznaczanie, przesuwanie, powielanie, usuwanie i cofanie; zapis w `.fig` |
| Paleta poleceń | ✅ | <kbd>⌘</kbd><kbd>K</kbd> otwiera paletę z wyszukiwaniem działań edytora i aplikacji |
| Menu kontekstowe | ✅ | Schowek, kolejność, grupy, komponenty, widoczność, blokada i przenoszenie na stronę |
| Skróty klawiaturowe | 🟡 | Narzędzia, edycja, operacje logiczne, spłaszczanie, maski, komponenty, wyrównanie, kolejność, nawigacja i formatowanie tekstu; brak Skali (<kbd>K</kbd>), Strzałki, Pipety (<kbd>I</kbd>) i narzędzia powiększenia |
| Znajdź i zamień | 🔲 | Brak wyszukiwania i zamiany tekstu w całym dokumencie |
| Widok konturów | 🔲 | Brak widoku szkieletowego wszystkich warstw |
| Własna miniatura | 🔲 | Zapisane pliki pokazują pierwszą stronę, jak w Figmie bez strony okładki; nie można wybrać innej miniatury |
| Krok przesunięcia | 🔲 | Dostępne 1 i 10 pikseli; brak wartości własnych |
| Menu aplikacji | ✅ | File, Edit, View, Object, Text i Arrange w przeglądarce; menu systemowe w Tauri |
| Narzędzia AI | 🟡 | 126 narzędzi w czacie AI, agentach programistycznych (ACP) i MCP; zdjęcia stockowe i wektoryzacja obrazów; brak generowania obrazów i wyszukiwania AI |

## Warstwy i kształty

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Prostokąt, elipsa, linia, wielokąt i gwiazda | ✅ | Podstawowe kształty; konfigurowalne boki wielokąta i promień wewnętrzny gwiazdy |
| Ramki | ✅ | Przycinanie zawartości, własny układ współrzędnych oraz tworzenie i gotowe rozmiary jak w Figmie |
| Grupy | ✅ | Grupowanie i rozgrupowanie skrótami |
| Sekcje | ✅ | Etykiety i automatyczne przejmowanie nakładających się obiektów |
| Łuki | ✅ | `arcData` z kątami i promieniem wewnętrznym |
| Maski | ✅ | Użyj jako maski (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>M</kbd>); maski alfa, wektorowe i luminancji w sekcji Maska |
| Typy i hierarchia | ✅ | 19 typów obiektów i drzewo rodzic–potomek |
| Zaznaczanie | ✅ | Kliknięcie, Shift + kliknięcie i zaznaczenie prostokątne |
| Wyrównanie i położenie | ✅ | Położenie, obrót i wymiary w panelu właściwości |
| Kopiowanie obiektów | ✅ | Zwykły schowek, binarny Kiwi Figmy oraz kopiowanie jako tekst, SVG, PNG i JSX |
| Proporcjonalna zmiana rozmiaru | 🟡 | Shift i blokada proporcji zachowują proporcje; brak narzędzia Skala (<kbd>K</kbd>), które skaluje też obwiednie, efekty i tekst |
| Blokada | ✅ | Zablokowanych obiektów nie można wybrać ani przesunąć |
| Widoczność | ✅ | Ikona oka i skrót klawiaturowy |
| Zmiana nazwy | ✅ | Edycja nazwy w panelu warstw |
| Pierwszy i dalszy plan | ✅ | Skróty ] i [ oraz menu kontekstowe |
| Przenoszenie na stronę | ✅ | Przenoszenie zaznaczenia między stronami |
| Ograniczenia | ✅ | Lewo, prawo, środek, rozciąganie i skalowanie w każdej osi w sekcji Ograniczenia; działają przy zmianie rozmiaru rodzica, także w egzemplarzach |
| Inteligentne zaznaczanie | 🟡 | Wyrównywanie i rozmieszczanie z panelu i menu Arrange; brak uchwytów odstępów i Tidy up |
| Siatki układu | ✅ | Siatki, kolumny i wiersze w ramkach z liczbą, typem, marginesem, odstępem i kolorem; style siatek; wiele ramek naraz |
| Pomiar odległości | ✅ | Przytrzymaj <kbd>⌥</kbd> i najedź kursorem, aby zobaczyć odległości od zaznaczenia |
| Edycja zbiorcza | ✅ | Położenie, rozmiar, wygląd, zalew, obwiednia i efekty; różne wartości jako `Mixed` |
| Podobne obiekty | 🔲 | Brak wyszukiwania podobnych warstw |
| Kopiowanie właściwości | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>C</kbd> / <kbd>⌥</kbd><kbd>⌘</kbd><kbd>V</kbd> przez schowek systemowy, także między OpenPencil a Figmą: zalewy, obwiednie, efekty, narożniki, style, zmienne, automatyczny układ między ramkami i styl tekstu między warstwami tekstowymi |
| Relacje rodzic–potomek | ✅ | Pełna hierarchia przez `parentIndex` i zmiana rodzica przeciąganiem |

## Narzędzia wektorowe

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Sieci wektorowe | ✅ | Model zgodny z Figmą zamiast prostych ścieżek |
| Pióro | ✅ | Punkty narożne, krzywe Béziera i ścieżki otwarte lub zamknięte |
| Ołówek | ✅ | Odręczne linie wygładzane do krzywych; <kbd>⇧</kbd> rysuje proste odcinki |
| Edycja wektorów | 🟡 | Zaznaczanie i przeciąganie punktów, uchwytów, segmentów i obszarów; <kbd>⌘</kbd> wygina; Delete dzieli ścieżki, a pióro je przedłuża; brak symetrii uchwytów w punkcie i kontrolek narożników |
| Operacje logiczne | ✅ | Menu Object (<kbd>⌥</kbd><kbd>⇧</kbd><kbd>U</kbd> / <kbd>S</kbd> / <kbd>I</kbd> / <kbd>E</kbd>) i kontrolka w panelu; wynik pozostaje edytowalną warstwą logiczną |
| Spłaszczanie | ✅ | Spłaszczanie (<kbd>⌥</kbd><kbd>⇧</kbd><kbd>F</kbd>) z menu Object i menu kontekstowego |
| Obwiednia na ścieżkę | ✅ | Zastępuje każdą warstwę z obwiednią jej zalewem i wektorem obwiedni, zachowując obrót, krycie i efekty |
| Tekst na ścieżki | ✅ | Zamienia tekst w wektory glifów na podstawie konturów czcionki |
| Konstruktor kształtów | 🔲 | Brak interaktywnego narzędzia logicznego |
| Odsunięcie ścieżki | 🔲 | Brak odsunięcia do wewnątrz i na zewnątrz |
| Upraszczanie | 🔲 | Brak redukcji punktów |

## Tekst i typografia

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Tekst i edycja bezpośrednia | ✅ | Ukryta `textarea`, kursor, zaznaczenie, wybór słowa, przeciąganie i zakresy stylów |
| Renderowanie tekstu | ✅ | CanvasKit Paragraph do składania wierszy i metryk |
| Czcionki systemowe | ✅ | Inter, font-kit w Tauri i `queryLocalFonts` w przeglądarce |
| Rodzina i odmiana | ✅ | FontPicker z wyszukiwaniem, wirtualnym przewijaniem i podglądem |
| Rozmiar i interlinia | ✅ | Edycja w sekcji Typografia |
| Wyrównanie | ✅ | Do lewej, do środka, do prawej i wyjustowanie; w pionie do góry, do środka i do dołu |
| Style tekstu | 🟡 | Style znaków podczas edycji; nazwane style tekstu z `.fig`, bibliotek i tokenów projektowych; brak interfejsu do tworzenia i edycji stylów |
| Tryby rozmiaru | ✅ | Automatyczna szerokość, automatyczna wysokość i stały rozmiar w sekcji Układ |
| Listy | ✅ | Zagnieżdżone listy punktowane i numerowane z odstępami listy i akapitów oraz wysuniętymi znacznikami; <kbd>⇧</kbd><kbd>⌘</kbd><kbd>8</kbd> / <kbd>7</kbd> |
| Łącza | 🟡 | Łącza na zakresach znaków zachowują się w `.fig`, schowku, HTML i API wtyczek; panel nie pozwala ich dodawać |
| Emoji i symbole | ✅ | Kolorowe emoji rysowane systemową czcionką emoji, edytowane jako jeden znak i zachowywane w `.fig` i schowku |
| OpenType | 🟡 | Każda funkcja ustawiona w pliku jest renderowana i zachowywana; panel przełącza tylko ligatury, warianty kontekstowe i kerning |
| Czcionki zmienne | ✅ | Style nazwane są rysowane w swoich wartościach osi, a rozmiar optyczny podąża za rozmiarem czcionki, jak w Figmie; sekcja Typografia i API wtyczek ustawiają dowolną oś, a rozmiar optyczny można ustawić ręcznie |
| CJK | ✅ | Czcionki zastępcze CJK dobierane według języka i wczytywane przed pierwszym renderowaniem, także dla chińskiego tradycyjnego i dzielonych czcionek webowych |
| RTL | ✅ | Kierunek tekstu Auto, LTR lub RTL z kształtowaniem pisma arabskiego; automatyczny układ biegnie od prawej do lewej |
| Czcionki ikon | ✅ | Material Symbols ze zmiennych czcionek Google w dowolnej grubości, wypełnieniu i gradacji; wybór ikon dodaje zestawy Iconify i SF Symbols (macOS 14+) |

## Kolory, gradienty i obrazy

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Wybór koloru HSV | ✅ | Pole koloru, suwaki odcienia i przezroczystości, zapis szesnastkowy oraz pola RGB, HSL, HSB i OkHCL |
| Zalewy jednolite | ✅ | Kolor i przezroczystość |
| Gradienty | ✅ | Liniowy, radialny, kątowy i diamentowy |
| Zalewy obrazami | ✅ | Tryby wypełnienia, dopasowania, kadrowania i powtarzania ze skalą kafelków i obrotem o 90° |
| Wzory | 🟡 | Zaimportowane wzory z Figmy są renderowane i zachowywane; brak narzędzia do ich tworzenia i edycji |
| Tryby mieszania | ✅ | Tryby mieszania warstw, zalewów i efektów oraz przenikanie (pass-through) dla grup i ramek |
| Obrazy i filmy | 🟡 | Upuszczanie lub wklejanie PNG, JPEG, GIF, WebP, AVIF i SVG na obszar roboczy; brak filmów |
| Korekcja obrazu | 🔲 | Brak ekspozycji, kontrastu i nasycenia |
| Kadrowanie | 🟡 | Tryb kadrowania w wyborze zalewu obrazem zachowuje kadr; brak uchwytów kadrowania na obszarze roboczym |
| Pipeta | 🔲 | Brak pobierania koloru z obszaru roboczego |
| Modele kolorów | ✅ | Pola Hex, RGB, HSL, HSB i OkHCL z ostrzeżeniami o wyjściu poza gamut |

## Efekty i właściwości

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Cienie i rozmycie | ✅ | Cień zewnętrzny, wewnętrzny oraz rozmycie warstwy, tła i pierwszego planu |
| Grubość obwiedni | ✅ | Wspólna lub osobna dla boków |
| Zakończenia i łączenia | ✅ | Obsługiwane wszystkie podstawowe typy |
| Kreskowanie | ✅ | Naprzemienne kreski i odstępy |
| Wyrównanie obwiedni | ✅ | Wewnątrz, pośrodku i na zewnątrz |
| Promień narożników | ✅ | Wspólny albo osobny; uchwyty na obszarze roboczym dla prostokątów, wielokątów i gwiazd |
| Wygładzanie narożników | ✅ | Suwak w sekcji Wygląd; wygładzone narożniki są renderowane, kreskowane i zachowywane tak jak w Figmie |
| Wiele zalewów i obwiedni | ✅ | Dodawanie, usuwanie, ukrywanie i mieszanie dowolnej liczby zalewów i obwiedni; obwiednie przyjmują gradienty i obrazy |

## Automatyczny układ

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Przepływ poziomy i pionowy | ✅ | Flexbox Yoga WASM |
| Włączanie | ✅ | <kbd>⇧</kbd><kbd>A</kbd> dla ramki lub zaznaczenia |
| Odstęp i wypełnienie | ✅ | Wspólne lub osobne wartości |
| Wyrównanie | ✅ | Początek, środek, koniec, rozciągnięcie i rozdzielenie |
| Rozmiary | ✅ | Stały, Wypełnij i Dopasuj |
| Zawijanie | ✅ | Flex wrap |
| Grid | ✅ | CSS Grid przez odmianę Yoga |
| Układy zagnieżdżone | ✅ | Ramki o różnych kierunkach |
| Zmiana kolejności | ✅ | Widoczny wskaźnik wstawiania |
| Min/max | ✅ | Minimalna i maksymalna szerokość i wysokość w sekcji Układ, z możliwością powiązania ze zmiennymi liczbowymi |

## Komponenty i systemy projektowe

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Komponenty i zestawy | ✅ | Tworzenie, właściwości, wielowymiarowe warianty i sprawdzanie duplikatów |
| Egzemplarze | ✅ | Zasoby, nadpisania, zmiana wariantu, synchronizacja i aktualizacje |
| Właściwości komponentu | ✅ | Właściwości logiczne, tekstowe, zamiany egzemplarza i slotów; udostępnianie zagnieżdżonych egzemplarzy i zmiana kolejności w panelu |
| Zmienne | ✅ | Wszystkie cztery typy w oknie zmiennych z aliasami, formułami i wartościami dla trybów; wiązanie z kolorami, rozmiarami, odstępami, typografią, widocznością i tekstem |
| Kolekcje i tryby | ✅ | Kolekcje z trybami; tryb lub Auto można ustawić warstwom i stronom w sekcji Wygląd |
| Style | 🟡 | Stosowanie i odłączanie stylów zalewu, obwiedni, tekstu, efektów i siatki z `.fig`, bibliotek i tokenów projektowych; brak interfejsu do ich tworzenia i edycji |
| Biblioteki | ✅ | Niezmienne wersje, publikowanie, aktualizacje, praca bez sieci i zapis w `.fig` |
| Odłącz egzemplarz | ✅ | Konwersja egzemplarza do ramki |
| Główny komponent | ✅ | Nawigacja także między stronami |

## Prototypowanie

Połączenia, wyzwalacze, działania, animacje, nakładki, przewijanie, przepływy, zmienne i tryb prezentacji nie są jeszcze obsługiwane.

## Import i eksport

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Import i eksport `.fig` | ✅ | Kiwi (605 definicji schematu), Zstd, miniatura i zgodność z symbolami komponentów |
| Zapis | ✅ | Okna systemowe, File System Access API i pobieranie w Safari |
| Schowek Figmy | ✅ | Kopiowanie i wklejanie binarnego Kiwi |
| Import Sketch | 🔲 | Brak odczytu `.sketch` |
| Obrazy, SVG i PDF | ✅ | PNG, JPG, WEBP, SVG, PDF z osadzonymi czcionkami, gdy ich pliki da się osadzić, PPTX i draw.io |
| Historia wersji | 🟡 | Dokumenty OpenPencil Cloud (wersja zapoznawcza): zapisywanie nazwanych wersji, przeglądanie, podgląd, przywracanie i powielanie; niedostępne dla plików lokalnych |
| Kopiowanie zasobów | ✅ | Tekst, SVG, PNG, JSX i schowek Figmy |

## Plugin API, współpraca i tryb programisty

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| `eval` | ✅ | JavaScript bez interfejsu z globalnym `figma` |
| Komentarze | ✅ | Narzędzie Komentarz (<kbd>C</kbd>) przypina wątki do warstw, z odpowiedziami, rozwiązywaniem i filtrowaną listą; zapis w `.fig` |
| Współpraca | ✅ | Pokoje P2P (Trystero i Yjs) z kursorami, trybem śledzenia, rozmowami głosowymi i kursorami agentów; bez serwera |
| Tryb programisty | 🟡 | Karta Kod pokazuje zaznaczenie jako design JSX, HTML, Vue lub React z CSS albo Tailwind; statusy Ready for dev; brak trybu inspekcji z wymiarami |
| Tailwind CSS v4 | ✅ | HTML z klasami przez panel Kod, CLI lub API |
| Serwer MCP | ✅ | `@open-pencil/mcp` ze stdio i HTTP; 125 podstawowych narzędzi oraz narzędzia dokumentu, historii i ustawień |
| CLI | ✅ | 24 polecenia, m.in. `info`, `tree`, `find`, `query`, `node`, `pages`, `variables`, `tokens`, `fonts`, `lint`, `analyze`, `export`, `import`, `convert`, `diff`, `eval` i `tool` |

## Figma Draw

Specjalistyczne narzędzia ilustracyjne i przekształcenia wzorów nie są jeszcze obsługiwane.
