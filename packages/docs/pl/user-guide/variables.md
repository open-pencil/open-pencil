---
title: Zmienne
description: Zmienne projektu, kolekcje, tryby i powiązania kolorów w OpenPencil.
---

# Zmienne

Zmienne przechowują tokeny projektu przeznaczone do ponownego użycia: kolory, odstępy i inne właściwości, które można powiązać z obiektami. Po zmianie wartości zmiennej wszystkie obiekty, które jej używają, zostają zaktualizowane.

## Otwieranie okna zmiennych

Gdy żaden obiekt nie jest zaznaczony, karta „Projekt” pokazuje właściwości strony, w tym sekcję „Zmienne” z liczbą kolekcji i zmiennych. Kliknij ikonę ustawień, aby otworzyć okno.

Okno wyświetla po lewej zmienne aktywnej kolekcji, po prawej umożliwia edycję zaznaczonej zmiennej lub kolekcji, a poniżej pokazuje arkusz stylów, który z nich powstaje. W wąskim oknie lub na telefonie pokazuje jeden tryb naraz, a zmienna, ustawienia kolekcji albo arkusz stylów otwierają się nad listą z przyciskiem powrotu.

## Kolekcje

Zmienne są łączone w kolekcje, wyświetlane jako karty (na wąskich ekranach jako menu).

- **Przejście do kolekcji:** kliknij kartę
- **Tworzenie kolekcji:** kliknij przycisk z folderem na pasku narzędzi (**Utwórz kolekcję**)
- **Zmiana nazwy lub usuwanie:** gdy żadna zmienna nie jest zaznaczona, prawa strona edytuje kolekcję: zmień jej nazwę albo usuń ją (**Usuń kolekcję**)

## Tryby

Każda kolekcja może zawierać kilka trybów (na przykład Light i Dark). Tryby są wyświetlane na liście jako kolumny wartości, a zmienna ma wartość dla każdego trybu. Zarządza się nimi w sekcji **Ustawienia kolekcji**:

- **Dodawanie trybu:** kliknij **+** obok pozycji **Tryby**
- **Zmiana nazwy:** edytuj nazwę trybu
- **Duplikowanie, ustawianie jako domyślnego, usuwanie:** użyj menu **⋯** obok trybu (**Duplikuj tryb**, **Ustaw jako domyślny**, **Usuń tryb**)
- **Warunek:** selektor CSS lub zapytanie `@media`, `@supports` albo `@container`, które włącza tryb w arkuszu stylów. Jeśli pole jest puste, warunkiem jest atrybut nazwany od kolekcji i trybu, na przykład `[data-theme="dark"]` dla trybu Dark kolekcji Theme. Tryb domyślny zawsze trafia do `:root`.

## Praca ze zmiennymi

Zmienne są grupowane według folderów w ich nazwach (`Brand/Primary` jest widoczna jako *Primary* w folderze *Brand*) i pokazują nazwę CSS oraz jedną wartość dla każdego trybu.

- **Tworzenie zmiennej:** kliknij **+** na pasku narzędzi i wybierz typ; nowa zmienna otworzy się do edycji
- **Zaznaczanie:** kliknij wiersz albo poruszaj się strzałkami i naciśnij Enter
- **Wyszukiwanie:** wpisz tekst w pasku wyszukiwania, aby filtrować zmienne według nazwy
- **Usuwanie:** kliknij **Usuń zmienną** na dole jej ustawień

Zaznaczenie zmiennej pozwala edytować:

- **Nazwa** i **Nazwa CSS:** pozostaw nazwę CSS pustą, aby utworzyć ją z nazwy i zakresów, na przykład `--color-brand-primary`
- **Jednostka:** dla liczb `px`, `rem`, `%`, `ms`, `s`, `deg` albo brak; wartości wpisuje się w tej jednostce
- **Wartości:** po jednej dla każdego trybu; kolor otwiera wybór koloru, a alias pokazuje zmienną, do której prowadzi
- **Wyrażenie CSS:** dla liczb wartość taka jak `clamp(1rem, 4vw, 1.5rem)` zapisywana w CSS zamiast liczby, podczas gdy kanwa nadal rysuje liczbę
- **Zakresy:** dla jakich właściwości zmienna jest proponowana
- **Opis**

## Arkusz stylów

Dół okna pokazuje aktywną kolekcję jako właściwości niestandardowe CSS albo motyw Tailwind v4. Przycisk kopiowania (**Kopiuj wszystkie zmienne jako CSS**) kopiuje zmienne całego dokumentu w tym formacie, dzięki czemu aliasy do innych kolekcji są rozwiązywane.

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
