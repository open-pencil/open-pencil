---
pageClass: guide
title: Rysowanie kształtów
description: Rysuj prostokąty, elipsy, linie, wielokąty, gwiazdy, ramki i sekcje, a potem nadawaj im kolory, obrysy, cienie i rozmycia.
---

# Rysowanie kształtów

Narzędzia do kształtów znajdują się na pasku narzędzi u dołu okna. Wybierz jedno z nich i przeciągnij na płótnie.

## Rysowanie kształtu

1. Naciśnij <Keys mac="R" other="R" />, aby narysować prostokąt, <Keys mac="O" other="O" />, aby narysować elipsę, albo <Keys mac="L" other="L" />, aby narysować linię. Wielokąty i gwiazdy są w menu kształtów: kliknij strzałkę obok prostokąta.
2. Przeciągnij na płótnie. Przytrzymaj <Keys mac="⇧" other="Shift" />, aby narysować kwadrat lub koło albo prowadzić linię co 45°.
3. Puść przycisk. Nowy kształt pozostaje zaznaczony, a na pasku narzędzi znów wybrane jest narzędzie **Przesuń**.

<GuideImage name="drawing-shapes/tools" alt="Otwarte menu kształtów na pasku narzędzi z pozycjami Prostokąt, Linia, Elipsa, Wielokąt i Gwiazda" />

Kliknięcie bez przeciągania tworzy kształt 100 × 100 albo linię o długości 100. Zacznij rysować wewnątrz ramki, aby kształt znalazł się w niej.

## Zaokrąglanie narożników

Wskaż zaznaczony prostokąt: w każdym narożniku pojawi się kropka. Przeciągnij jedną z nich, aby zaokrąglić narożniki: wszystkie, jeśli są jednakowe, albo tylko ten jeden, jeśli się różnią. Przytrzymaj <Keys mac="⌥" other="Alt" />, aby zrobić odwrotnie, i <Keys mac="⇧" other="Shift" />, aby zmieniać promień co 10.

Aby wpisać promień, użyj pola **Promień** w panelu **Design**. Przycisk obok niego pozwala ustawić każdy narożnik osobno. **Wygładzanie narożników** sprawia, że krzywa zaczyna się wcześniej, tak jak na ikonie aplikacji.

Wielokąt i gwiazda mają jedną kropkę promienia, pod górnym wierzchołkiem, oraz dwie dodatkowe:

- Przeciągnij kropkę na następnym wierzchołku wokół środka, aby zmienić liczbę wierzchołków.
- Przeciągnij kropkę na pierwszym wewnętrznym wierzchołku gwiazdy do środka lub na zewnątrz, aby gwiazda była smuklejsza albo pełniejsza.

Pola **Liczba** i **Proporcja** w panelu **Design** robią to samo. Kropki znikają, gdy kształt ma na ekranie mniej niż około 108 pikseli: powiększ widok, aby do nich dotrzeć.

<GuidePair>

<GuideImage name="drawing-shapes/corners" alt="Zaznaczony prostokąt z kropką w każdym narożniku" caption="Kropki narożników prostokąta" />
<GuideImage name="drawing-shapes/star" alt="Zaznaczona gwiazda z kropkami promienia, liczby wierzchołków i proporcji" caption="Kropki promienia, wierzchołków i proporcji gwiazdy" />

</GuidePair>

## Kolorowanie kształtu

Kliknij kwadrat z kolorem w sekcji **Wypełnienie**. Przyciski u góry okna wyboru, od lewej do prawej, wybierają rodzaj wypełnienia:

<GuideLegend>

<GuideImage name="drawing-shapes/fill" alt="Okno wyboru wypełnienia na przycisku gradientu, z fioletowym gradientem liniowym i jego dwoma punktami" />

- **Jednolity**: jeden kolor. Wpisz wartość szesnastkową w panelu albo pobierz kolor z płótna pipetą.
- **Gradient**: liniowy, radialny, kątowy lub rombowy. Gdy okno wyboru jest otwarte, płótno pokazuje uchwyty gradientu. Przeciągnij koniec, aby go przesunąć (z <Keys mac="⇧" other="Shift" />, aby obracać co 15°), a kwadrat punktu, aby go przesunąć wzdłuż gradientu.
- **Obraz**: zdjęcie z komputera albo [zdjęcie stockowe](./photos). Może wypełniać kształt w trybie **Fill**, **Fit**, **Crop** lub **Tile**, a suwaki zmieniają ekspozycję, kontrast i inne ustawienia.
- **Shader**: ruchomy efekt, na przykład **Aurora**. Płótno pokazuje nieruchomą klatkę, a efekt odtwarza się w podglądzie: kliknij **▷** w prawym górnym rogu okna albo naciśnij <Keys mac="⌘ ⌥ Enter" other="Ctrl Alt Enter" />. Kliknij **{ }**, aby wkleić ustawienie skopiowane z shaders.com.

</GuideLegend>

Kliknij **+** obok **Wypełnienie**, aby dodać kolejne wypełnienie na wierzchu. Oko ukrywa wypełnienie, a **−** je usuwa.

## Dodawanie obrysu

Kliknij **+** obok **Obrys**. Następnie:

- **Wewnętrzny**, **Wyśrodkowany** lub **Zewnętrzny** określa, gdzie linia leży względem krawędzi.
- **W** ustawia grubość. Przycisk z czterema kwadratami pozwala ustawić grubość każdego boku osobno.
- Przycisk ustawień obok niego włącza linię przerywaną i określa wygląd zakończeń i narożników linii. Otwarta ścieżka może kończyć się strzałką.

## Dodawanie cieni i rozmyć

Kliknij **+** obok **Efekty**, a potem wybierz rodzaj efektu:

<GuideLegend>

<GuideImage name="drawing-shapes/effects" alt="Lista efektów: cień, cień wewnętrzny, rozmycie warstwy, rozmycie tła, rozmycie pierwszego planu, szum, tekstura i szkło" />

- **Cień** i **Cień wewnętrzny**: cień na zewnątrz lub wewnątrz kształtu.
- **Rozmycie warstwy** rozmywa kształt, **Rozmycie tła** to, co jest za nim, jak matowe szkło, a **Rozmycie pierwszego planu** to, co jest przed nim. Rozmycie może być **Jednolite** albo **Progresywne**, czyli przechodzące od ostrego do rozmytego.
- **Szum** i **Tekstura**: ziarno na kształcie.
- **Szkło**: zagina i oświetla to, co jest za kształtem, jak soczewka.

</GuideLegend>

Kliknij kwadrat obok efektu, aby zmienić jego ustawienia. Kształt może mieć kilka efektów, ale tylko jedno szkło i jedną teksturę.

## Rysowanie ramki

Ramka zawiera inne warstwy: ekran, kartę albo przycisk. Naciśnij <Keys mac="F" other="F" /> lub <Keys mac="A" other="A" /> i przeciągnij.

- Warstwy, które nowa ramka całkowicie zakrywa, trafiają do niej.
- Aby utworzyć ramkę o rozmiarze ekranu telefonu, tabletu lub komputera, wybierz rozmiar w panelu **Design**, gdy włączone jest narzędzie **Ramka**. Gdy ramka jest zaznaczona, pole **Ramka** w panelu **Design** zmienia jej rozmiar w ten sam sposób.
- Ramka ukrywa to, co z niej wystaje. Wyłącz **Przytnij zawartość**, aby to pokazać.
- Aby ułożyć zawartość ramki w wierszach lub kolumnach, użyj [auto-layoutu](./auto-layout).

## Grupowanie obszarów w sekcje

Sekcja oznacza obszar strony, na przykład przepływ albo zestaw ekranów. Naciśnij <Keys mac="⇧ S" other="Shift S" /> i przeciągnij wokół warstw.

Warstwy, które sekcja całkowicie zakrywa, trafiają do niej, także gdy później przesuniesz sekcję lub zmienisz jej rozmiar. Sekcje pozostają na najwyższym poziomie strony: nie można ich umieścić w ramce. Przeciągnij nazwę sekcji, aby ją przesunąć.

## Układanie paska narzędzi

Kliknij pasek narzędzi prawym przyciskiem myszy i wybierz **Dostosuj pasek narzędzi…**. Te same ustawienia znajdziesz w **Ustawienia → Edytor**.

- Wyłącz narzędzie, aby je ukryć. Jego skrót nadal działa.
- Przeciągnij narzędzie, aby je przenieść. Upuść je w polu, aby dodać je do tego menu, między polami, aby miało własny przycisk, albo na inne narzędzie, aby umieścić oba w jednym menu.
- **Przywróć domyślne** przywraca wszystko do pierwotnego stanu.

Narzędzia dodane w nowszej wersji trafiają na swoje zwykłe miejsce, także na pasku narzędzi, który został zmieniony.
