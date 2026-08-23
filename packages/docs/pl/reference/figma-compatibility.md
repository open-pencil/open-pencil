# Zgodność z Figmą

Porównanie funkcji Figma Design z obecnymi możliwościami OpenPencil.

::: tip Stan
✅ Obsługiwane — działa w pełnym zakresie · 🟡 Częściowo — podstawowe działanie istnieje, ale brakuje części funkcji · 🔲 Brak
:::

**Pokrycie:** uwzględniono 94 ze 158 funkcji Figmy — 76 ✅ obsługiwanych, 18 🟡 częściowych i 64 🔲 niezaimplementowane. Aktualizacja: 2026-03-07.

## Interfejs i nawigacja

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Pasek narzędzi | ✅ | Dolny pasek w stylu UI3: zaznaczenie, ramka, sekcja, prostokąt, elipsa, linia, tekst, rączka i pióro |
| Panel warstw | ✅ | Rozwijane drzewo, zmiana kolejności przez przeciąganie, widoczność i zmienna szerokość |
| Panel stron | ✅ | Dodawanie, usuwanie i przemianowywanie stron; osobny stan widoku |
| Panel właściwości | ✅ | Wygląd, zalew, obwiednia, efekty, typografia, układ i położenie |
| Powiększenie i przesuwanie | ✅ | Przewijanie, gest szczypania, skróty 0/1/2, Space + przeciąganie, środkowy przycisk i Rączka |
| Linijki | ✅ | Linijki u góry i z lewej strony z zakresem zaznaczenia i współrzędnymi |
| Tło obszaru roboczego | ✅ | Osobny kolor dla każdej strony |
| Prowadnice | 🔲 | Brak prowadnic przeciąganych z linijek |
| Paleta poleceń | 🔲 | Brak szybkiego wyszukiwania działań |
| Menu kontekstowe | ✅ | Schowek, kolejność, grupy, komponenty, widoczność, blokada i przenoszenie na stronę |
| Skróty klawiaturowe | 🟡 | Podstawowe skróty i komponenty; brakuje części narzędzi i formatowania tekstu |
| Znajdź i zamień | 🔲 | Brak wyszukiwania i zamiany tekstu w całym dokumencie |
| Widok konturów | 🔲 | Brak widoku szkieletowego wszystkich warstw |
| Własna miniatura | 🔲 | Miniatura jest generowana, ale nie można wybrać własnej |
| Krok przesunięcia | 🔲 | Dostępne 1 i 10 pikseli; brak wartości własnych |
| Menu aplikacji | ✅ | File, Edit, View, Object, Text i Arrange w przeglądarce; menu systemowe w Tauri |
| Narzędzia AI | 🟡 | 90 narzędzi przez dostawców modeli i MCP; brak generowania obrazów i wyszukiwania AI |

## Warstwy i kształty

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Prostokąt, elipsa, linia, wielokąt i gwiazda | ✅ | Podstawowe kształty; konfigurowalne boki wielokąta i promień wewnętrzny gwiazdy |
| Ramki | ✅ | Przycinanie zawartości, własny układ współrzędnych i gotowe rozmiary |
| Grupy | ✅ | Grupowanie i rozgrupowanie skrótami |
| Sekcje | ✅ | Etykiety i automatyczne przejmowanie nakładających się obiektów |
| Łuki | ✅ | `arcData` z kątami i promieniem wewnętrznym |
| Ołówek | 🔲 | Brak rysowania odręcznego |
| Maski | 🔲 | Brak masek przycinających warstwy |
| Typy i hierarchia | ✅ | 17 typów obiektów i drzewo rodzic–potomek |
| Zaznaczanie | ✅ | Kliknięcie, Shift + kliknięcie i zaznaczenie prostokątne |
| Wyrównanie i położenie | ✅ | Położenie, obrót i wymiary w panelu właściwości |
| Kopiowanie obiektów | ✅ | Zwykły schowek, binarny Kiwi Figmy oraz kopiowanie jako tekst, SVG, PNG i JSX |
| Proporcjonalna zmiana rozmiaru | 🟡 | Shift zachowuje proporcje; brak osobnego narzędzia Skala |
| Blokada | ✅ | Zablokowanych obiektów nie można wybrać ani przesunąć |
| Widoczność | ✅ | Ikona oka i skrót klawiaturowy |
| Zmiana nazwy | ✅ | Edycja nazwy w panelu warstw |
| Pierwszy i dalszy plan | ✅ | Skróty ] i [ oraz menu kontekstowe |
| Przenoszenie na stronę | ✅ | Przenoszenie zaznaczenia między stronami |
| Ograniczenia | 🔲 | Brak przypinania krawędzi i środka przy zmianie rozmiaru rodzica |
| Inteligentne zaznaczanie | 🔲 | Brak równomiernego rozmieszczania wielu obiektów |
| Siatki układu | 🔲 | Brak prowadnic kolumn, wierszy i siatki |
| Pomiar odległości | 🔲 | Brak wyświetlania odległości po Alt + najechanie |
| Edycja zbiorcza | ✅ | Położenie, rozmiar, wygląd, zalew, obwiednia i efekty; różne wartości jako `Mixed` |
| Podobne obiekty | 🔲 | Brak wyszukiwania podobnych warstw |
| Kopiowanie właściwości | 🔲 | Brak przenoszenia zalewów, obwiedni i efektów |
| Relacje rodzic–potomek | ✅ | Pełna hierarchia przez `parentIndex` i zmiana rodzica przeciąganiem |

## Narzędzia wektorowe

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Sieci wektorowe | ✅ | Model zgodny z Figmą zamiast prostych ścieżek |
| Pióro | ✅ | Punkty narożne, krzywe Béziera i ścieżki otwarte lub zamknięte |
| Edycja wektorów | 🟡 | Tworzenie i podstawowa edycja; część złożonych operacji jest ograniczona |
| Operacje logiczne | 🔲 | Brak sumy, różnicy, przecięcia i wykluczenia |
| Spłaszczanie | 🔲 | Brak łączenia ścieżek |
| Obwiednia na ścieżkę | 🔲 | Brak Outline Stroke |
| Tekst na ścieżki | 🔲 | Brak konwersji tekstu do wektorów |
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
| Wyrównanie | 🟡 | Podstawowe; brak pionowego i wszystkich automatycznych trybów rozmiaru |
| Style tekstu | 🟡 | Pogrubienie, kursywa, podkreślenie i przekreślenie; brak nazwanych stylów |
| Tryby rozmiaru | 🔲 | Brak automatycznej szerokości, wysokości i rozmiaru stałego |
| Listy | 🔲 | Brak list punktowanych i numerowanych |
| Łącza | 🔲 | Brak odnośników w tekście |
| Emoji i symbole | 🔲 | Obsługa niepełna |
| OpenType | 🔲 | Brak ligatur i wariantów stylistycznych |
| Czcionki zmienne | 🔲 | Brak regulacji osi |
| CJK | 🔲 | Brak pełnej obsługi chińskiego, japońskiego i koreańskiego |
| RTL | 🔲 | Brak układu od prawej do lewej |
| Czcionki ikon | 🔲 | Brak specjalnej obsługi glifów |

## Kolory, gradienty i obrazy

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Wybór koloru HSV | ✅ | Pole HSV, suwaki odcienia i przezroczystości, zapis szesnastkowy |
| Zalewy jednolite | ✅ | Kolor i przezroczystość |
| Gradienty | ✅ | Liniowy, radialny, kątowy i diamentowy |
| Zalewy obrazami | ✅ | Dane Blob i tryby wypełnienia, dopasowania, kadrowania i powtarzania |
| Wzory | 🔲 | Brak powtarzających się wzorów |
| Tryby mieszania | 🔲 | Brak trybów mieszania warstw i zalewów |
| Obrazy i filmy | 🟡 | Zalewy są wyświetlane; brak importu przeciąganiem i filmów |
| Korekcja obrazu | 🔲 | Brak ekspozycji, kontrastu i nasycenia |
| Kadrowanie | 🔲 | Brak interaktywnego kadrowania |
| Pipeta | 🔲 | Brak pobierania koloru z obszaru roboczego |
| Modele kolorów | 🟡 | HSV i Hex; brak HSL i RGB |

## Efekty i właściwości

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Cienie i rozmycie | ✅ | Cień zewnętrzny, wewnętrzny oraz rozmycie warstwy, tła i pierwszego planu |
| Grubość obwiedni | ✅ | Wspólna lub osobna dla boków |
| Zakończenia i łączenia | ✅ | Obsługiwane wszystkie podstawowe typy |
| Kreskowanie | ✅ | Naprzemienne kreski i odstępy |
| Wyrównanie obwiedni | ✅ | Wewnątrz, pośrodku i na zewnątrz |
| Promień narożników | ✅ | Wspólny albo osobny |
| Wygładzanie narożników | 🔲 | Brak ciągłego zaokrąglenia |
| Wiele zalewów i obwiedni | 🔲 | Brak nakładania wielu na jeden obiekt |

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
| Min/max | 🔲 | Brak ograniczeń elementów potomnych |

## Komponenty i systemy projektowe

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Komponenty i zestawy | ✅ | Tworzenie, właściwości, wielowymiarowe warianty i sprawdzanie duplikatów |
| Egzemplarze | ✅ | Zasoby, nadpisania, zmiana wariantu, synchronizacja i aktualizacje |
| Właściwości komponentu | ✅ | Widoczność, tekst i zamiana egzemplarza |
| Zmienne | 🟡 | Pełny interfejs dla `COLOR`; pozostałe typy bez pełnej edycji |
| Kolekcje i tryby | 🟡 | Działają; brak pełnego interfejsu motywów |
| Style | 🔲 | Brak nazwanych stylów wielokrotnego użytku |
| Biblioteki | ✅ | Niezmienne wersje, publikowanie, aktualizacje, praca bez sieci i zapis w `.fig` |
| Odłącz egzemplarz | ✅ | Konwersja egzemplarza do ramki |
| Główny komponent | ✅ | Nawigacja także między stronami |

## Prototypowanie

Połączenia, wyzwalacze, działania, animacje, nakładki, przewijanie, przepływy, zmienne i tryb prezentacji nie są jeszcze obsługiwane.

## Import i eksport

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| Import i eksport `.fig` | ✅ | Kiwi, Zstd, miniatura i zgodność z symbolami komponentów |
| Zapis | ✅ | Okna systemowe, File System Access API i pobieranie w Safari |
| Schowek Figmy | ✅ | Kopiowanie i wklejanie binarnego Kiwi |
| Import Sketch | 🔲 | Brak odczytu `.sketch` |
| Obrazy, SVG i PDF | 🟡 | PNG, JPG, WEBP i SVG działają; PDF nie |
| Historia wersji | 🔲 | Brak przeglądania i przywracania |
| Kopiowanie zasobów | ✅ | Tekst, SVG, PNG, JSX i schowek Figmy |

## Plugin API, współpraca i tryb programisty

| Funkcja | Stan | Uwagi |
|---------|------|-------|
| `eval` | ✅ | JavaScript bez interfejsu z globalnym `figma` |
| Komentarze | 🔲 | Brak |
| Współpraca | ✅ | P2P przez Trystero i Yjs CRDT, kursory i tryb śledzenia |
| Tryb programisty | 🟡 | JSX; brak właściwości CSS i specyfikacji przekazania |
| Tailwind CSS v4 | ✅ | HTML z klasami przez panel Kod, CLI lub API |
| Serwer MCP | ✅ | stdio i HTTP; 90 narzędzi |
| CLI | ✅ | Polecenia od `info` do `eval` i wyjście JSON |

## Figma Draw

Specjalistyczne narzędzia ilustracyjne i przekształcenia wzorów nie są jeszcze obsługiwane.
