---
pageClass: guide
title: Zaznaczanie i edycja
description: Zaznaczaj warstwy, a potem przesuwaj je, zmieniaj ich rozmiar, obracaj, kopiuj i edytuj kilka naraz.
---

# Zaznaczanie i edycja

Aby zmienić warstwę, najpierw ją zaznacz. Panel **Design** pokaże wtedy jej ustawienia, a uchwyty wokół niej pozwolą zmienić jej rozmiar i ją obrócić.

## Zaznaczanie warstwy

Kliknij warstwę na płótnie. W ramce kliknięcie zaznacza warstwę leżącą bezpośrednio w ramce, na przykład wiersz listy. Kliknij dwukrotnie, aby zejść o poziom głębiej.

<GuidePair>

<GuideImage name="selection-and-manipulation/click" alt="Zaznaczony wiersz Paper Lanterns w karcie playlisty" caption="Kliknięcie zaznacza wiersz" />
<GuideImage name="selection-and-manipulation/double-click" alt="Zaznaczony tytuł i wykonawca w wierszu" caption="Dwukrotne kliknięcie wchodzi do środka" />

</GuidePair>

Aby od razu dotrzeć do warstwy pod kursorem, przytrzymaj <Keys mac="⌘" other="Ctrl" /> i kliknij. Aby niczego nie zaznaczać, kliknij puste miejsce na płótnie albo naciśnij <Keys mac="Esc" other="Esc" />.

## Zaznaczanie kilku warstw

- Przytrzymaj <Keys mac="⇧" other="Shift" /> i klikaj warstwy, aby dodać je do zaznaczenia albo je z niego usunąć.
- Przeciągnij po płótnie, zaczynając od pustego miejsca, aby narysować prostokąt zaznaczenia. Zaznaczone zostaną warstwy, których dotyka. Ramka na stronie zostaje zaznaczona tylko wtedy, gdy prostokąt obejmuje ją w całości.
- Naciśnij <Keys mac="⌘ A" other="Ctrl A" />, aby zaznaczyć wszystko na stronie.

<GuideImage name="selection-and-manipulation/marquee" alt="Prostokąt zaznaczenia narysowany na dwóch wierszach karty playlisty" />

## Zaznaczanie klawiaturą

- <Keys mac="Enter" other="Enter" /> zaznacza warstwy wewnątrz zaznaczonej warstwy.
- <Keys mac="⇧ Enter" other="Shift Enter" /> zaznacza warstwę, która ją zawiera.
- <Keys mac="Tab" other="Tab" /> i <Keys mac="⇧ Tab" other="Shift Tab" /> zaznaczają następną i poprzednią warstwę na tym samym poziomie.

## Przesuwanie warstw

Przeciągnij zaznaczoną warstwę. Klawisze strzałek przesuwają ją o jeden piksel, a z <Keys mac="⇧" other="Shift" /> o dziesięć.

- Przytrzymaj <Keys mac="⇧" other="Shift" /> podczas przeciągania, aby przesuwać w linii prostej.
- Puść warstwę nad ramką, aby ją do niej włożyć. Wyciągnij ją poza ramkę, aby ją z niej wyjąć.
- Przytrzymaj <Keys mac="Space" other="Space" /> podczas przeciągania, aby warstwa pozostała w swojej ramce.

## Zmiana rozmiaru i obracanie

<GuideLegend>

<GuideImage name="selection-and-manipulation/handles" alt="Zaznaczona karta z trzema ponumerowanymi elementami: uchwytem narożnika, uchwytem obrotu i rozmiarem" />

1. Przeciągnij **uchwyt**, aby zmienić rozmiar. Przytrzymaj <Keys mac="⇧" other="Shift" /> na narożniku, aby zachować proporcje.
2. Przeciągnij **uchwyt obrotu**, aby obrócić warstwę, albo wskaż miejsce tuż za narożnikiem i przeciągnij. Przytrzymaj <Keys mac="⇧" other="Shift" />, aby obracać co 15°.
3. **Rozmiar** jest widoczny, gdy warstwa jest zaznaczona.

</GuideLegend>

Aby wpisać dokładny rozmiar lub kąt, użyj pól **W**, **H** i pola kąta w panelu **Design**. <Keys mac="⇧ H" other="Shift H" /> i <Keys mac="⇧ V" other="Shift V" /> odbijają zaznaczenie w poziomie lub w pionie.

## Kopiowanie, wklejanie i usuwanie

- <Keys mac="⌘ D" other="Ctrl D" /> tworzy kopię obok oryginału.
- Przytrzymaj <Keys mac="⌥" other="Alt" /> podczas przeciągania, aby wyciągnąć kopię.
- <Keys mac="⌘ C" other="Ctrl C" /> i <Keys mac="⌘ V" other="Ctrl V" /> kopiują i wklejają. Wklejona warstwa zachowuje swoje miejsce; aby wkleić ją pod kursorem, kliknij prawym przyciskiem myszy i wybierz **Wklej tutaj**.
- <Keys mac="⇧ ⌘ R" other="Ctrl Shift R" /> wkleja w miejsce zaznaczonych warstw.
- <Keys mac="⌫" other="Delete" /> usuwa zaznaczenie.

Tekst skopiowany ze strony internetowej wkleja się jako jedna warstwa tekstowa. Gdy skopiujesz fragment układu strony, na przykład kartę, powiadomienie zaproponuje **Wklej jako warstwy**, aby odtworzyć go jako ramki i tekst.

## Kopiowanie wyglądu warstwy

<Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> kopiuje wygląd warstwy, a <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> nadaje ten wygląd każdej zaznaczonej warstwie. Działa to także z warstwami skopiowanymi w Figmie.

Wygląd to wypełnienia, obrysy, efekty, krycie, tryb mieszania, promień narożników oraz używane przez nie style i zmienne. Między ramkami obejmuje też auto-layout, a między warstwami tekstowymi styl tekstu. Pozycja, rozmiar, nazwa i zawartość pozostają bez zmian.

## Grupowanie warstw

- <Keys mac="⌘ G" other="Ctrl G" /> grupuje zaznaczenie.
- <Keys mac="⌥ ⌘ G" other="Ctrl Alt G" /> umieszcza je zamiast tego w nowej ramce.
- <Keys mac="⇧ ⌘ G" other="Ctrl Shift G" /> rozbija grupę, ramkę lub sekcję i zostawia jej warstwy na miejscu.

Aby ułożyć warstwy w wierszu lub kolumnie, użyj zamiast tego [auto-layoutu](./auto-layout).

## Pokazywanie warstwy przez kształt

Umieść kształt pod warstwami, które ma przyciąć, zaznacz je wszystkie i naciśnij <Keys mac="⌥ ⌘ M" other="Ctrl Alt M" />. Najniższa warstwa staje się maską: warstwy nad nią są widoczne tylko w jej obrębie, na przykład zdjęcie w kółku. Naciśnij skrót ponownie, aby wyłączyć maskę.

## Przenoszenie warstw na wierzch lub pod spód

Warstwy wyżej na [liście warstw](./layers-and-pages) zasłaniają te, które są niżej.

- <Keys mac="]" other="]" /> przenosi zaznaczenie na wierzch, a <Keys mac="[" other="[" /> pod spód.
- <Keys mac="⌘ ]" other="Ctrl ]" /> i <Keys mac="⌘ [" other="Ctrl [" /> przesuwają je o jeden poziom.

## Ukrywanie i blokowanie warstw

- <Keys mac="⇧ ⌘ H" other="Ctrl Shift H" /> ukrywa zaznaczenie albo pokazuje je ponownie. Ukryte warstwy pozostają na liście warstw.
- <Keys mac="⇧ ⌘ L" other="Ctrl Shift L" /> blokuje zaznaczenie. Zablokowanej warstwy nie można zaznaczyć ani przesunąć na płótnie; zaznacz ją zamiast tego na liście warstw.

## Edycja kilku warstw naraz

Gdy zaznaczonych jest kilka warstw, panel **Design** pokazuje ich wspólne ustawienia. **Mieszane** oznacza ustawienie, które się między nimi różni. Zmień ustawienie, a zmieni się dla wszystkich.

<GuideImage name="selection-and-manipulation/several" alt="Panel Design dla dwóch zaznaczonych wierszy, z polem Y ustawionym na Mieszane" />

<GuideLegend>

<GuideImage name="selection-and-manipulation/selection-colors" alt="Sekcja Kolory zaznaczenia z czterema kolorami" />

**Kolory zaznaczenia** pokazuje każdy kolor w zaznaczeniu, także w warstwach wewnątrz niego. Zmień kolor tutaj, aby zmienić go wszędzie, gdzie jest używany.

</GuideLegend>
