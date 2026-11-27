---
pageClass: guide
title: Edycja wektorów
description: Przesuwaj punkty i krzywe ścieżki, dodawaj i usuwaj punkty oraz łącz kształty w nowe.
---

# Edycja wektorów

Ścieżka składa się z punktów połączonych prostymi lub krzywymi liniami. Aby zmienić jej kształt, edytuj same punkty.

## Edycja ścieżki

Kliknij ścieżkę dwukrotnie albo zaznacz ją i naciśnij <Keys mac="Enter" other="Enter" />. Pojawiają się jej punkty, a uchwyty wokół warstwy znikają.

<GuideImage name="vector-edit/points" alt="Zakrzywiona ścieżka w trybie edycji z zaznaczonym punktem i jego dwoma uchwytami" />

- Przeciągnij punkt, aby go przesunąć.
- Przeciągnij uchwyt punktu, aby zmienić krzywą.
- Kliknij linię między dwoma punktami, aby ją zaznaczyć, i przeciągnij ją, aby przesunąć oba jej punkty.
- Przeciągnij po pustym miejscu, aby zaznaczyć punkty wewnątrz prostokąta.
- Wewnątrz wypełnionego kształtu obszar pod kursorem jest zakreskowany. Kliknij, aby zaznaczyć go ze wszystkimi punktami, i przeciągnij, aby go przesunąć.
- Przytrzymaj <Keys mac="⇧" other="Shift" /> i klikaj, aby dodawać do zaznaczenia.

Aby zakończyć edycję, naciśnij <Keys mac="Esc" other="Esc" /> lub <Keys mac="Enter" other="Enter" /> albo kliknij puste miejsce na płótnie.

## Kształtowanie krzywej

Podczas przeciągania uchwytu przytrzymaj klawisz:

| Przytrzymaj | Działanie |
| ---- | ------------ |
| <Keys mac="⌘" other="Ctrl" /> | Utrzymuje oba uchwyty w jednej linii, dając gładką krzywą. Zmienia się tylko długość tego uchwytu. |
| <Keys mac="⌥" other="Alt" /> | Przesuwa tylko ten uchwyt, dając ostry narożnik. |
| <Keys mac="⇧" other="Shift" /> | Zachowuje kierunek uchwytu i zmienia tylko jego długość. |

Przytrzymaj <Keys mac="⌘" other="Ctrl" /> i przeciągnij punkt, aby wyciągnąć z niego uchwyty i wygiąć sąsiednie linie.

## Dodawanie i usuwanie punktów

Podczas edycji naciśnij <Keys mac="P" other="P" />, aby użyć pióra:

- Kliknij linię, aby dodać na niej punkt.
- Kliknij koniec otwartej ścieżki, aby rysować dalej od tego miejsca.
- Przytrzymaj <Keys mac="⌥" other="Alt" /> i kliknij punkt, aby go usunąć.

Aby usunąć zaznaczenie, naciśnij <Keys mac="⌫" other="Delete" />. Usunięty punkt zabiera ze sobą swoje linie. Usunięta linia zostawia swoje punkty, chyba że nic innego ich nie trzyma, więc usunięcie linii w środku dzieli ścieżkę na dwie. Aby zamiast tego podzielić ścieżkę w punkcie, zaznacz punkt i naciśnij <Keys mac="⌥ ⌫" other="Alt Delete" />.

## Łączenie kształtów

Zaznacz co najmniej dwa kształty i w menu **Obiekt** wybierz, jak je połączyć:

<GuideImage name="vector-edit/combine" alt="Nakładające się kwadrat i koło oraz cztery sposoby ich łączenia: suma, odejmowanie, część wspólna i wykluczenie" />

- **Połącz zaznaczenie** łączy je w jeden kształt.
- **Odejmij zaznaczenie** wycina kształty leżące wyżej z kształtu na spodzie.
- **Przetnij zaznaczenie** zostawia tylko część, w której się nakładają.
- **Wyklucz zaznaczenie** zostawia wszystko poza częścią, w której się nakładają.

Wynik pozostaje edytowalny: każdy kształt zachowuje w nim własne punkty. **Spłaszcz** zamienia zaznaczenie w jedną zwykłą ścieżkę, a **Kontur obrysu** zamienia obrys w wypełniony kształt. Prostokąty, elipsy i gwiazdy po spłaszczeniu stają się ścieżkami, które możesz edytować punkt po punkcie.
