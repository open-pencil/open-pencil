---
pageClass: guide
title: Zmienne
description: Trzymaj kolory, rozmiary i inne wartości w jednym miejscu, przełączaj je trybami i przenoś do kodu jako CSS albo tokeny projektowe.
---

# Zmienne

Zmienna to nazwana wartość, na przykład kolor marki albo promień narożnika, której warstwy używają zamiast własnej liczby. Zmień zmienną, a zmieni się każda warstwa, która z niej korzysta. Tryby nadają tym samym zmiennym inne wartości, na przykład dla ciemnego motywu.

## Otwieranie zmiennych

Wybierz **Widok → Zmienne…** albo kliknij pusty fragment płótna i otwórz **Zmienne** w panelu **Design**.

<GuideImage name="variables/dialog" alt="Okno Zmienne z kolekcją Theme, czterema zmiennymi w trybach Light i Dark, ustawieniami kolekcji i arkuszem stylów" />

1. **Kolekcje** grupują zmienne, na przykład kolory albo odstępy.
2. Każda **zmienna** ma wartość w każdym trybie, w kolumnach.
3. **Ustawienia** zaznaczonej zmiennej albo kolekcji, gdy żadna zmienna nie jest zaznaczona.
4. **Arkusz stylów** pokazuje kolekcję jako CSS.

**Rozwiń** w rogu okna powiększa je na większą część ekranu. W wąskim oknie albo na telefonie okno pokazuje jeden tryb naraz.

## Tworzenie zmiennej

1. Kliknij **Utwórz zmienną** i wybierz typ: kolor, liczba, tekst, prawda/fałsz, wygładzanie albo czas.
2. Wpisz nazwę. Ukośniki umieszczają zmienną w grupie: `Brand/Primary` pojawi się jako **Primary** w grupie **Brand**.
3. Ustaw jej wartość w każdym trybie.

Po prawej stronie możesz też ustawić:

- **Nazwa CSS**, której używa arkusz stylów. Jeśli zostawisz ją pustą, powstanie z nazwy, na przykład `--color-brand-primary`.
- **Jednostka** dla liczb: `px`, `rem`, `%`, `ms`, `s`, `deg` albo brak.
- **Zakresy**, czyli ustawienia, w których zmienna jest dostępna.
- **Opis** oraz **Ukryj przy publikowaniu**, żeby zmienna nie trafiła do [bibliotek](./component-libraries).

Aby zmienna przejmowała wartość innej zmiennej, kliknij przycisk zmiennej obok jej wartości i wybierz tę drugą. **Odłącz zmienną** zamienia ją z powrotem w zwykłą wartość.

## Używanie zmiennej

<GuideLegend>

<GuideImage name="variables/apply" alt="Wiersz Wypełnienie zaznaczonej warstwy z otwartym przyciskiem Zastosuj zmienną i listą kolorów Theme" />

1. Zaznacz warstwę.
2. Kliknij **Zastosuj zmienną** obok ustawienia, na przykład koloru wypełnienia, promienia narożnika albo odstępu.
3. Wybierz zmienną.

</GuideLegend>

Ustawienie pokazuje wtedy nazwę zmiennej. Aby wrócić do zwykłej wartości, kliknij **Zastosuj zmienną** i wybierz **Odłącz zmienną**.

## Używanie trybów

Kolekcja może mieć kilka trybów, na przykład **Light** i **Dark**. Każda zmienna w kolekcji ma wartość w każdym z nich.

- Aby dodać tryb, kliknij **+** obok **Tryby** w ustawieniach kolekcji.
- Aby zmienić nazwę trybu, edytuj ją. Menu **⋯** obok niego pozwala go powielić, ustawić jako domyślny albo usunąć.

<GuideLegend>

<GuideImage name="variables/mode" alt="Otwarte ustawienie Theme w sekcji Wygląd z opcjami Auto, Light i Dark" />

Aby pokazać ramkę w innym trybie, zaznacz ją i wybierz tryb w sekcji **Wygląd**. Warstwy w jej wnętrzu dostosują się, chyba że mają własny tryb. **Auto** przejmuje tryb od otaczającej warstwy.

</GuideLegend>

W kodzie ustawienie **Obowiązuje, gdy** określa, kiedy tryb zaczyna obowiązywać. Pod spodem widać CSS, który powstaje:

| Obowiązuje, gdy | CSS |
| --- | --- |
| **przełączono ręcznie** | atrybut na elemencie, na przykład `[data-theme="dark"]` |
| **system jest w trybie ciemnym** | `@media (prefers-color-scheme: dark)` |
| **system jest w trybie jasnym** | `@media (prefers-color-scheme: light)` |
| **włączony jest wysoki kontrast** | `@media (prefers-contrast: more)` |
| **włączone jest ograniczenie ruchu** | `@media (prefers-reduced-motion: reduce)` |
| **ekran jest węższy niż** podana szerokość | `@media (max-width: 640px)` |
| **ekran jest szerszy niż** podana szerokość | `@media (min-width: 640px)` |
| **kontener jest węższy niż** podana szerokość | `@container (max-width: 640px)` |
| **kontener jest szerszy niż** podana szerokość | `@container (min-width: 640px)` |
| **Własny CSS** | dowolny selektor albo zapytanie `@media`, `@supports` lub `@container` |

Tryb domyślny jest zawsze włączony i trafia do `:root`. **Atrybut przełączania** kolekcji, domyślnie `data-theme`, to atrybut, który włącza jej ręczne tryby. Zmień go tak, żeby pasował do twojego kodu, na przykład na `data-color-scheme`.

Warstwy ustawione na tryb ręczny są eksportowane z jego atrybutem. Warstwy ustawione na tryb z dowolnym innym warunkiem są eksportowane ze zwykłymi wartościami, bo to arkusz stylów decyduje, kiedy taki tryb obowiązuje.

## Porządkowanie zmiennych

- **Kolekcje:** kliknij **+** obok **Kolekcje**, żeby dodać kolekcję. Gdy żadna zmienna nie jest zaznaczona, po prawej stronie możesz zmienić nazwę kolekcji, a jej menu **⋯** pozwala ją usunąć.
- **Wyszukiwanie:** wpisz tekst w polu wyszukiwania, żeby filtrować po nazwie, nazwie CSS, opisie albo wartości. Kliknij grupę, żeby pokazać tylko ją, albo użyj przycisku filtra, żeby pokazać tylko niektóre typy.
- **Zaznaczanie:** kliknij wiersz albo użyj klawiszy strzałek. Kliknięcie z <Keys mac="⇧" other="Shift" /> zaznacza zakres, a kliknięcie z <Keys mac="⌘" other="Ctrl" /> dodaje pojedynczy wiersz.
- **Edycja w miejscu:** kliknij dwukrotnie nazwę, liczbę albo tekst na liście.
- **Przenoszenie i usuwanie:** kliknij prawym przyciskiem myszy, żeby zmienić nazwę, powielić, przenieść do grupy albo usunąć. Przeciągaj wiersze, żeby zmienić ich kolejność.
- **Cofanie:** <Keys mac="⌘ Z" other="Ctrl Z" /> działa tu tak samo jak na płótnie.

## Pisanie formuły

Wartością liczby może być formuła oparta na innych zmiennych, na przykład `space/base * 4`. Zacznij wpisywać nazwę zmiennej i wybierz ją albo wybierz **Użyj zmiennej**. Pole pokazuje wynik, na przykład `= 16px`. Dla innych typów wybierz **Użyj formuły** obok wartości.

- Liczby korzystają z `+`, `-`, `*`, `/` i nawiasów.
- Wartości prawda/fałsz korzystają z `and`, `or` i `not` oraz porównań `==`, `!=`, `<`, `<=`, `>` i `>=`: `viewport > 1024 and not loading`.
- Tekst zapisuje się w podwójnych cudzysłowach, a `+` go łączy: `"Hello, " + name`. `text(count)` zapisuje liczbę tak jak Figma.
- `if(condition, then, otherwise)` wybiera jedną z dwóch wartości: `if(dark, gray/900, #FFFFFF)`.
- `truthy(value)` daje fałsz dla `0`, pustego tekstu, `false`, `no` i `off`.

Błędy, na przykład nieznana nazwa albo pętla, są pokazywane po wyjściu z pola, a poprzednia wartość zostaje. Zmiana nazwy zmiennej nie psuje formuł, które z niej korzystają.

W arkuszu stylów formuła liczbowa staje się `calc()`. Formuł z `if()`, tekstem albo wartościami prawda/fałsz nie da się zapisać jako CSS, więc są pomijane.

Liczba może też mieć **Wyrażenie CSS**, które zastępuje ją tylko w kodzie, na przykład `clamp(1rem, 4vw, var(--spacing-md))`. Dodasz je z menu **⋯** wartości.

## Zmienne wygładzania i czasu

Zmienne wygładzania i czasu opisują ruch: jak długo trwa zmiana oraz jak przyspiesza i zwalnia. [Przejścia komponentów](./components#zamiana-komponentu-w-kontrolke) mogą z nich korzystać, więc tryb **Reduced motion** może naraz skrócić wszystkie przejścia.

- **Czas** to długość trwania wpisana w milisekundach, na przykład `250ms`, albo w sekundach, na przykład `0.25s`.
- **Wygładzanie** to krzywa albo sprężyna. Kliknij je, żeby otworzyć edytor:
  - **Krzywa:** wybierz gotowe wygładzanie albo **Własna krzywa Béziera**, a potem przeciągnij dwa uchwyty albo wpisz liczby. **Odwróć krzywą** odtwarza ją od końca.
  - **Sprężyna:** wybierz Łagodna, Szybka, Sprężysta, Wolna albo **Własna sprężyna**. Przeciągnij pierwsze przestrzelenie w sekcji **Czas** albo ustaw sztywność, tłumienie i masę w sekcji **Fizyka**.

W CSS czas jest zapisywany w milisekundach, a krzywa jako funkcja czasu, na przykład `cubic-bezier(0.45, 1.45, 0.8, 1)`. Sprężyny nie mają tam odpowiednika w CSS, więc są pomijane.

## Kopiowanie zmiennych jako kodu

Przycisk kopiowania nad arkuszem stylów kopiuje wszystkie kolekcje jako CSS albo jako motyw Tailwind v4.

## Importowanie i eksportowanie tokenów projektowych

Zmienne i style przenoszą się między OpenPencil, Figmą i kodem jako [tokeny projektowe](https://www.designtokens.org/).

- **Eksport:** w menu kopiowania arkusza stylów wybierz **Eksportuj jako tokeny projektowe**. Dostaniesz plik zip z osobnym plikiem dla każdego trybu, który Figma importuje jako tryb, oraz ze stylami tekstu i efektów.
- **Import:** kliknij **Importuj tokeny projektowe** u góry okna i wybierz pliki tokenów albo plik zip. Działają pliki z Figmy i Tokens Studio.

Przed importem okno pokazuje, dokąd trafi każda kolekcja i każdy tryb: do nowej, do istniejącej albo nigdzie. Zmienne o tej samej nazwie są aktualizowane, pozostałe są dodawane i nic nie jest usuwane. **Cofnij** wycofuje cały import.
