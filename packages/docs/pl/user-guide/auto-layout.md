---
pageClass: guide
title: Auto-layout
description: Twórz ramki, które same układają swoje warstwy i zmieniają rozmiar razem z zawartością.
---

# Auto-layout

Auto-layout sprawia, że ramka sama układa warstwy w swoim wnętrzu. Zmień tekst, dodaj wiersz albo ukryj warstwę, a cała reszta przesunie się, żeby wszystko pasowało. Używaj go do przycisków, list, kart i całych ekranów.

<GuidePair>

<GuideImage name="auto-layout/before" alt="Karta playlisty z dwoma utworami" caption="Dwa utwory" />
<GuideImage name="auto-layout/after" alt="Wyższa karta playlisty z trzema utworami" caption="Dodaj jeden, a karta urośnie" />

</GuidePair>

## Dodawanie auto-layoutu

1. Zaznacz ramkę albo warstwy, które chcesz ułożyć.
2. Naciśnij <Keys mac="⇧ A" other="Shift A" />.

Ramka zaczyna układać swoje warstwy. Luźne warstwy trafiają do nowej ramki. Naciśnij <Keys mac="⇧ A" other="Shift A" /> na ramce jeszcze raz, żeby wyłączyć auto-layout.

## Ustawianie ramki

Zaznacz ramkę i znajdź sekcję **Auto-layout** w panelu **Design**.

<GuideLegend>

<GuideImage name="auto-layout/panel" alt="Ustawienia auto-layoutu z sześcioma ponumerowanymi elementami" />

1. **Przepływ** układa warstwy swobodnie, pionowo, poziomo albo w siatce.
2. **Zawijanie układu** przenosi warstwy do nowej linii, gdy zabraknie im miejsca.
3. **Wymiary** określają, jak zachowują się szerokość i wysokość ramki.
4. **Wyrównanie** rozmieszcza warstwy w ramce. Kliknij kropkę.
5. **Odstęp** to miejsce między warstwami. Wybierz **Auto** w jego menu, żeby rozsunąć je na boki.
6. **Dopełnienie** to miejsce wewnątrz krawędzi ramki. Przycisk obok pozwala ustawić każdą stronę osobno.

</GuideLegend>

## Zmienianie odstępów na płótnie

Zaznacz ramkę i najedź kursorem na odstęp albo krawędź, żeby zobaczyć jego wielkość. Kliknij go dwukrotnie, a potem kliknij wyświetloną wartość i wpisz nową.

## Wybieranie, jak warstwy zmieniają rozmiar

Zaznacz warstwę, a potem otwórz menu w jej polu **W** albo **H**.

<GuideLegend>

<GuideImage name="auto-layout/sizing" alt="Otwarte menu szerokości z opcjami Stały, Dopasuj do zawartości i Wypełnij" />

- **Stały** zachowuje ustawiony rozmiar.
- **Dopasuj do zawartości** dopasowuje rozmiar do zawartości.
- **Wypełnij** zajmuje dostępne miejsce w ramce nadrzędnej.

</GuideLegend>

W wierszu listy spróbuj ustawić **Wypełnij** dla szerokości i **Dopasuj do zawartości** dla wysokości. W tym samym menu dodasz też rozmiar minimalny i maksymalny.

## Zmienianie kolejności warstw

Przeciągnij warstwę w nowe miejsce w ramce. Niebieska linia pokazuje, gdzie wyląduje.

<GuidePair>

<GuideImage name="auto-layout/drag" alt="Kursor przeciąga Low Tide, a niebieska linia jest nad Paper Lanterns" caption="Przeciągnij Low Tide w górę" />
<GuideImage name="auto-layout/drop" alt="Low Tide między Slow Morning a Paper Lanterns" caption="Puść, a warstwa wskoczy na miejsce" />

</GuidePair>

## Zawijanie warstw

Włącz **Zawijanie układu** dla treści takich jak tagi, w których liczba elementów się zmienia. Drugie pole odstępu ustawia miejsce między liniami.

<GuideImage name="auto-layout/wrap" alt="Siedem tagów rozłożonych w trzech liniach" />

## Budowanie siatki

<GuideLegend>

<GuideImage name="auto-layout/grid-panel" alt="Ustawienia kolumn i wierszy siatki" />

1. Zaznacz ramkę i wybierz **Siatka** w polu **Przepływ**.
2. Użyj **+** obok **Kolumny** i **Wiersze**, żeby dodać ścieżki.
3. Wybierz **Wypełnij (fr)** dla ścieżek, które dzielą się miejscem, albo **Stały (px)** dla ustalonego rozmiaru.
4. Na dole ustaw odstępy między kolumnami i wierszami.

</GuideLegend>

<GuideImage name="auto-layout/grid" alt="Sześć okładek albumów w trzech kolumnach i dwóch wierszach" />

## Swobodne umieszczanie warstwy

Niektóre warstwy, na przykład plakietka w rogu, nie powinny być układane razem z resztą.

1. Zaznacz warstwę.
2. Kliknij **Ignoruj auto layout** obok **Pozycja**.
3. Przeciągnij ją w dowolne miejsce ramki.

Możesz też przytrzymać <Keys mac="⌃" other="Ctrl" /> podczas przeciągania. Warstwa trafi do ramki pod kursorem.
