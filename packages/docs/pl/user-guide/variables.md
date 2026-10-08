---
title: Zmienne
description: Zmienne projektu, kolekcje, tryby i powiązania kolorów w OpenPencil.
---

# Zmienne

Zmienne przechowują tokeny projektu przeznaczone do ponownego użycia: kolory, odstępy i inne właściwości, które można powiązać z obiektami. Po zmianie wartości zmiennej wszystkie obiekty, które jej używają, zostają zaktualizowane.

## Otwieranie okna zmiennych

Otwórz je z **Widok → Zmienne…**, wyszukując „Zmienne” w palecie poleceń albo, gdy żaden obiekt nie jest zaznaczony, z sekcji „Zmienne” na karcie „Projekt”. Przycisk **Rozwiń** w rogu okna daje mu większą część okna aplikacji.

Okno wyświetla po lewej zmienne aktywnej kolekcji, po prawej umożliwia edycję zaznaczonej zmiennej lub kolekcji, a poniżej pokazuje arkusz stylów, który z nich powstaje. W wąskim oknie lub na telefonie pokazuje jeden tryb naraz, a zmienna, ustawienia kolekcji albo arkusz stylów otwierają się nad listą z przyciskiem powrotu.

## Kolekcje

Zmienne są łączone w kolekcje. W szerokim oknie są wypisane na pasku bocznym wraz z liczbą zmiennych w każdej; w węższym są kartami, a na telefonie menu.

- **Przejście do kolekcji:** kliknij ją na pasku bocznym lub jej kartę
- **Tworzenie kolekcji:** kliknij **+** obok **Kolekcje** albo przycisk z folderem na pasku narzędzi (**Utwórz kolekcję**)
- **Zmiana nazwy lub usuwanie:** gdy żadna zmienna nie jest zaznaczona, prawa strona edytuje kolekcję: zmień jej nazwę albo usuń ją z menu **⋯** obok nazwy (**Usuń kolekcję**)
- **Atrybut przełączania:** atrybut, który włącza tryby przełączane ręcznie, domyślnie `data-theme` dla kolekcji o nazwie Theme; wpisz inną nazwę, np. `data-color-scheme`, aby dopasować go do istniejącego kodu

## Tryby

Każda kolekcja może zawierać kilka trybów (na przykład Light i Dark). Tryby są wyświetlane na liście jako kolumny wartości, a zmienna ma wartość dla każdego trybu. Zarządza się nimi w sekcji **Ustawienia kolekcji**:

- **Dodawanie trybu:** kliknij **+** obok pozycji **Tryby**
- **Zmiana nazwy:** edytuj nazwę trybu
- **Duplikowanie, ustawianie jako domyślnego, usuwanie:** użyj menu **⋯** obok trybu (**Duplikuj tryb**, **Ustaw jako domyślny**, **Usuń tryb**)

Tryb domyślny jest **Zawsze włączony** i trafia do `:root`. Każdy inny tryb ma pole **Obowiązuje, gdy**, które określa, kiedy tryb przejmuje kontrolę w wyeksportowanym arkuszu stylów; wygenerowany CSS jest pokazany poniżej:

| Obowiązuje, gdy | CSS |
| --- | --- |
| **przełączono ręcznie** | atrybut przełączania kolekcji z trybem jako wartością, na przykład `[data-theme="dark"]` dla trybu Dark kolekcji Theme |
| **system jest w trybie ciemnym** / **system jest w trybie jasnym** | `@media (prefers-color-scheme: dark)` / `light` |
| **włączony jest wysoki kontrast** | `@media (prefers-contrast: more)` |
| **włączone jest ograniczenie ruchu** | `@media (prefers-reduced-motion: reduce)` |
| **ekran jest węższy niż** / **ekran jest szerszy niż** szerokość | `@media (max-width: 640px)` / `min-width` |
| **kontener jest węższy niż** / **kontener jest szerszy niż** szerokość | `@container (max-width: 640px)` / `min-width` |
| **Własny CSS** | dowolny selektor albo zapytanie `@media`, `@supports` lub `@container` |

Na płótnie warstwa pokazuje tryb, gdy ustawisz ją na ten tryb, niezależnie od warunku. W wyeksportowanym kodzie tryb przełączany ręcznie włącza się przez dodanie jego atrybutu do elementu, więc warstwy ustawione na ten tryb są eksportowane z tym atrybutem. Warstwy ustawione na tryb z dowolnym innym warunkiem, także z własnymi selektorami, są eksportowane z wartościami dosłownymi zamiast tokenów, ponieważ o tym, kiedy tryb obowiązuje, decyduje arkusz stylów, a nie warstwa.

## Praca ze zmiennymi

Zmienne są grupowane według folderów w ich nazwach (`Brand/Primary` jest widoczna jako *Primary* w folderze *Brand*) i pokazują nazwę CSS oraz jedną wartość dla każdego trybu.

- **Tworzenie zmiennej:** kliknij **Utwórz zmienną** (lub **+**) i wybierz typ; nowa zmienna otworzy się do edycji
- **Zaznaczanie:** kliknij wiersz albo poruszaj się strzałkami i naciśnij Enter. Kliknięcie z Shift zaznacza zakres, a kliknięcie z Cmd (Ctrl w Windows i Linuksie) dodaje wiersz lub usuwa go z zaznaczenia
- **Filtrowanie:** wpisz tekst w pasku wyszukiwania, aby filtrować według nazwy, nazwy CSS, opisu lub wartości, np. `--color-brand`, koloru szesnastkowego albo zmiennej, na którą wskazuje alias, z tolerancją literówek jak w palecie poleceń; kliknij grupę na pasku bocznym, aby pokazać tylko ją i grupy w niej zawarte, albo użyj przycisku filtra (**Filtruj według typu**), aby pokazać tylko niektóre typy
- **Zmiana nazwy lub edycja w miejscu:** kliknij dwukrotnie nazwę albo wartość liczbową lub tekstową na liście
- **Prawy przycisk myszy:** zmień nazwę, zduplikuj (**Duplikuj**), przenieś do grupy lub nowej grupy (**Przenieś do grupy**, **Nowa grupa…**) albo usuń (**Usuń zmienne**) zaznaczone zmienne; usuwa je też Delete lub Backspace
- **Zmiana kolejności:** przeciągnij wiersz; kolejność jest zapisywana w pliku
- **Zaznaczonych kilka:** prawa strona przenosi je do grupy, duplikuje albo usuwa
- **Cofnij i ponów:** Cmd+Z oraz Cmd+Shift+Z lub Cmd+Y (Ctrl w systemach Windows i Linux) działają w oknie tak jak na kanwie, jeden krok na zmianę. Enter zatwierdza pole i wraca do listy; dopóki pole zawiera niezatwierdzony tekst, Cmd+Z cofa wpisywanie

Zaznaczenie zmiennej pozwala edytować:

- **Nazwa** i **Nazwa CSS:** pozostaw nazwę CSS pustą, aby utworzyć ją z nazwy i zakresów, na przykład `--color-brand-primary`. Wpisz nazwę bez `--`; nazwa, której CSS nie może użyć, jest oznaczana i nie jest zapisywana
- **Jednostka:** dla liczb `px`, `rem`, `%`, `ms`, `s`, `deg` albo brak; wartości wpisuje się w tej jednostce
- **Wartość** lub **Wartości:** po jednej dla każdego trybu; kolor otwiera wybór koloru. Przycisk zmiennej (**Użyj zmiennej**) obok wartości kieruje ją do innej zmiennej tego samego typu, czyli aliasu, który podąża za tą zmienną; **Odłącz zmienną** przywraca wartość, którą pokazywał
- **Wyrażenie CSS:** dla liczb wartość taka jak `clamp(1rem, 4vw, 1.5rem)` zapisywana w CSS zamiast liczby, podczas gdy kanwa nadal rysuje liczbę
- **Zakresy:** dla jakich właściwości zmienna jest proponowana
- **Opis**
- **Ukryj przy publikowaniu:** pliki, które używają tego jako biblioteki, nie widzą zmiennej

## Arkusz stylów

Dół okna pokazuje aktywną kolekcję jako właściwości niestandardowe CSS. Przycisk kopiowania (**Kopiuj wszystkie zmienne jako CSS**) kopiuje zmienne całego dokumentu jako CSS albo motyw Tailwind v4 (**Kopiuj wszystkie zmienne jako motyw Tailwind**), dzięki czemu aliasy do innych kolekcji są rozwiązywane.

## Import i eksport tokenów projektowych

Zmienne i style przechodzą między OpenPencil, Figmą i kodem jako [tokeny projektowe W3C](https://www.designtokens.org/):

- **Eksport:** w menu kopiowania arkusza stylów wybierz **Eksportuj jako tokeny projektowe**. Archiwum zip zawiera po jednym pliku na każdy tryb kolekcji, który Figma importuje jako tryb; style tekstu i efektów jako tokeny typografii i cieni; oraz resolver, który łączy je dla narzędzi takich jak Style Dictionary
- **Import:** kliknij **Importuj tokeny projektowe** na pasku narzędzi i wybierz pliki tokenów lub zip. Działają pliki z Figmy, resolver z plikami, które wskazuje, oraz motywy Tokens Studio
- **Wybór miejsca:** zanim cokolwiek się zmieni, okno pokazuje każdą znalezioną kolekcję i tryb oraz to, dokąd trafią: do nowej kolekcji lub trybu, do istniejącego albo nigdzie. Zmienne i style o tej samej nazwie są aktualizowane, a reszta dodawana; nic nie jest usuwane. Okno podaje, co zostanie dodane, zaktualizowane i pominięte, oraz dlaczego pominięto każdy token
- Import to jeden krok: **Cofnij** wycofuje go w całości

## Powiązywanie zmiennych z zalewami

W sekcji „Zalew” panelu właściwości użyj wyboru zmiennej, aby powiązać zmienną koloru z zalewem obiektu.

- **Powiązanie:** wybierz zmienną koloru z listy. Zalew pokazuje fioletową etykietę z nazwą zmiennej.
- **Odłączenie:** kliknij przycisk odłączania na etykiecie, aby usunąć powiązanie. Zalew wraca do obliczonej wartości koloru.

Gdy wartość zmiennej się zmienia (albo po przełączeniu trybu), wszystkie powiązane zalewy aktualizują się automatycznie.

## Wskazówki

- Łącz powiązane tokeny w kolekcje, na przykład `Primitives` dla kolorów źródłowych, `Semantic` dla aliasów znaczeniowych i `Spacing` dla odstępów.
- Tryby są przydatne do przełączania motywu: wartości Light i Dark można zdefiniować w tej samej kolekcji.
- Zmienne obsługują aliasy: kolekcja `Semantic` może odwoływać się do wartości z kolekcji `Primitives`.
- Zalewy i wybór koloru opisano na stronie [Kształty](./drawing-shapes).
