---
title: Automatyczny układ
description: "Flexbox i CSS Grid w OpenPencil: kierunek, odstępy, wypełnienie, wyrównanie i rozmiary elementów potomnych."
---

# Automatyczny układ

Automatyczny układ rozmieszcza elementy potomne wewnątrz ramki. Dostępne są dwa tryby: **Flex** z przepływem poziomym lub pionowym oraz **Grid** z wierszami, kolumnami i konfigurowalnymi ścieżkami.

## Włączanie

- Zaznacz ramkę i naciśnij <kbd>⇧</kbd><kbd>A</kbd>, aby włączyć lub wyłączyć automatyczny układ.
- Zaznacz obiekty bez wspólnej ramki nadrzędnej i naciśnij <kbd>⇧</kbd><kbd>A</kbd>, aby umieścić je w nowej ramce.

Podczas tworzenia ramki obiekty są sortowane według położenia.

## Kierunek

- **Poziomy:** od lewej do prawej.
- **Pionowy:** od góry do dołu.
- **Zawijanie:** po wyczerpaniu miejsca obiekty przechodzą do następnego wiersza lub kolumny.

## Odstępy

Odstęp określa odległość między sąsiednimi elementami. Wypełnienie określa odległość między krawędzią ramki a zawartością i może być wspólne lub osobne dla każdej strony.

## Wyrównanie

### Główna oś

- początek;
- środek;
- koniec;
- równy odstęp między obiektami.

### Oś poprzeczna

- początek;
- środek;
- koniec;
- rozciągnięcie na dostępną szerokość lub wysokość.

## Rozmiar elementów potomnych

- **Stały:** jawna szerokość lub wysokość;
- **Wypełnij:** zajmuje dostępne miejsce;
- **Dopasuj:** rozmiar zależy od zawartości.

Pierwsza rzeczywista zmiana szerokości lub wysokości przełącza tylko tę oś na tryb stały. Sam fokus pola nie zmienia trybu.

## Zmiana kolejności

Przeciągnij element wewnątrz ramki, aby zmienić jego miejsce. Wskaźnik pokazuje przyszłą pozycję.

## CSS Grid

Grid rozmieszcza elementy w wierszach i kolumnach o jawnie określonych rozmiarach ścieżek.

- **fr:** część dostępnego miejsca;
- **px:** stała liczba pikseli;
- **auto:** rozmiar zależny od zawartości.

Dla wierszy i kolumn można ustawić osobne odstępy. Domyślnie obiekty kolejno wypełniają komórki wierszami. We właściwościach elementu można zmienić początkowy wiersz lub kolumnę oraz liczbę zajmowanych komórek.

Grid jest eksportowany do JSX z klasami Tailwind, na przykład `grid grid-cols-3`, `gap-x-4 gap-y-2` i `col-start-2 row-span-2`.

## Wskazówki

- Zagnieżdżaj ramki z automatycznym układem, aby tworzyć złożone interfejsy responsywne.
- Tryb „Wypełnij” działa podobnie do `flex-grow: 1` w CSS.
- Grid sprawdza się w pulpitach, galeriach, formularzach i innych strukturach dwuwymiarowych.
