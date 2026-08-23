---
title: Komponenty
description: Komponenty, egzemplarze, zestawy wariantów, nadpisania, synchronizacja i biblioteki w OpenPencil.
---

# Komponenty

Komponent jest elementem projektu przeznaczonym do ponownego użycia. Po zmianie głównego komponentu wszystkie powiązane egzemplarze aktualizują się automatycznie.

## Zasoby

Otwórz kartę **Assets** w lewym panelu, aby zobaczyć lokalne komponenty i włączone biblioteki. Dostępne są widok siatki, lista i wyszukiwanie według nazwy.

Zasób można dodać do obszaru roboczego kliknięciem, klawiszem <kbd>Enter</kbd> lub przeciągnięciem. Zasoby biblioteki pozostają dostępne bez sieci, jeśli ich wersja została wcześniej pobrana.

## Tworzenie komponentu

Zaznacz ramkę lub grupę i naciśnij <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>. Jeśli zaznaczono kilka obiektów, OpenPencil umieszcza je w nowym komponencie o granicach zgodnych ze wspólną ramką ograniczającą.

## Zestawy komponentów i warianty

Zaznacz co najmniej dwa komponenty i naciśnij <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>. OpenPencil połączy je w zestaw z fioletową przerywaną ramką.

Każdy komponent w zestawie może określać kilka wymiarów wariantu, na przykład `Size=Small`, `State=Hover` i `Theme=Dark`. Nie trzeba tworzyć wszystkich kombinacji. Wariant w lewym górnym rogu jest domyślny i służy jako zamiennik, gdy dokładna kombinacja nie istnieje.

## Właściwości komponentów

Komponenty obsługują właściwości tekstu, widoczności logicznej i zamiany egzemplarza. Powiąż właściwość z polem obiektu potomnego, aby zmieniać jej wartość w egzemplarzu bez odłączania.

## Biblioteki

Biblioteka publikuje komponenty jako niezmienne wersje. Każdy zasób ma stałe identyfikatory biblioteki, zasobu i wersji, dlatego różne egzemplarze mogą pozostać na różnych wersjach do jawnej aktualizacji.

### Publikowanie

Otwórz **Assets → Manage libraries → Publish library**, podaj stały identyfikator i nazwę biblioteki, wybierz zmiany i opublikuj. Niewybrane zmiany pozostaną oczekujące.

### Włączanie i wstawianie zasobów

Włącz bibliotekę w **Manage libraries**. Jej komponenty pojawią się obok lokalnych. Opublikowane definicje są tylko do odczytu; powiązane egzemplarze można nadal dostosowywać za pomocą właściwości i nadpisań.

### Aktualizacje

W **Manage libraries → Updates** można porównać bieżący i nowy egzemplarz, a następnie zaktualizować jeden egzemplarz, wszystkie egzemplarze zasobu, bieżącą stronę albo wszystkie strony.

OpenPencil zachowuje zgodne ustawienia tekstu, widoczności i zamiany egzemplarza. Jeśli dokładny wariant zniknął, przed potwierdzeniem pojawi się wariant zastępczy. Aktualizację można cofnąć.

### Praca bez sieci

Biblioteka może być lokalna albo znajdować się u skonfigurowanego dostawcy pamięci masowej. Pobrane wersje są zapisywane lokalnie. Powiązania i potrzebne definicje są również przechowywane w `.fig`, dzięki czemu dokument można otworzyć bez dostępu do zdalnej biblioteki.

## Egzemplarze

Kliknij komponent prawym przyciskiem i wybierz **Utwórz egzemplarz**. Aby odłączyć egzemplarz, zaznacz go i naciśnij <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> albo <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd>.

Polecenie **Przejdź do głównego komponentu** otwiera komponent źródłowy, także na innej stronie.

## Synchronizacja i nadpisania

Zmiany głównego komponentu aktualizują szerokość, wysokość, zalewy, obwiednie, efekty, przezroczystość, promienie narożników, układ i przycinanie zawartości egzemplarzy.

Egzemplarz może nadpisać wybrane właściwości bez utraty powiązania. Dotyczy to między innymi nazwy, tekstu, czcionki, zalewów, obwiedni, efektów, przezroczystości i rozmiarów.

Dodanie obiektu potomnego do głównego komponentu dodaje jego kopię do istniejących egzemplarzy.

## Wskazówki

- Zmiana tekstu wewnątrz egzemplarza tworzy nadpisanie.
- Zestawy komponentów nadają się do wariantów o kilku wymiarach, takich jak rozmiar, stan i motyw.
- Publikuj zasoby z dokumentu źródłowego; opublikowane definicje są celowo tylko do odczytu.
