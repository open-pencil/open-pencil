---
pageClass: guide
title: Komponenty
description: Twórz komponenty wielokrotnego użytku, umieszczaj instancje, dodawaj warianty i właściwości oraz zamieniaj komponenty w działające kontrolki.
---

# Komponenty

Komponent to fragment projektu, którego używasz wiele razy, na przykład przycisk albo karta. Jego kopie nazywają się instancjami. Zmień komponent, a razem z nim zmieni się każda instancja.

<GuideLegend>

<GuideImage name="components/overview" alt="Komponent Button z dwoma wariantami w przerywanej ramce, a obok instancja Publish" />

1. **Zestaw komponentów** zawiera warianty jednego komponentu. Ma przerywaną fioletową ramkę.
2. Każdy **wariant** jest osobnym komponentem. Jego nazwa, na przykład **Variant=Primary**, jest widoczna nad nim.
3. **Instancja** to kopia, którą umieszczasz w projekcie. Ma własny tekst, tutaj **Publish**.

</GuideLegend>

## Tworzenie komponentu

1. Zaznacz ramkę albo warstwy, których chcesz używać wielokrotnie.
2. Naciśnij <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />.

Ramka lub grupa staje się komponentem. Inne warstwy trafiają do nowego komponentu, który je obejmuje. Na płótnie nad komponentami widać ich nazwy w kolorze fioletowym.

## Umieszczanie instancji

Otwórz **Zasoby** u góry lewego panelu. Znajdziesz tam komponenty z twojego pliku, pogrupowane według stron, oraz komponenty z włączonych bibliotek.

<GuideLegend>

<GuideImage name="components/assets" alt="Panel Zasoby z komponentami Button i Switch" />

- Kliknij komponent, żeby go umieścić, albo przeciągnij go na płótno.
- Wpisz nazwę w polu wyszukiwania, żeby znaleźć komponent.
- Przyciski obok wyszukiwania przełączają między siatką a listą i otwierają [biblioteki](./component-libraries).

</GuideLegend>

Możesz też kliknąć komponent na płótnie prawym przyciskiem myszy i wybrać **Utwórz instancję** albo nacisnąć na nim <Keys mac="⌘ D" other="Ctrl D" />.

## Zmienianie wszystkich instancji

Edytuj komponent: jego rozmiar, kolory, tekst, układ albo warstwy w środku. Każda instancja się dostosuje, z wyjątkiem miejsc, które zmieniono w danej instancji.

Aby znaleźć komponent, z którego pochodzi instancja, kliknij ją prawym przyciskiem myszy i wybierz **Przejdź do głównego komponentu**. OpenPencil otworzy jego stronę i go zaznaczy.

## Zmienianie jednej instancji

Zaznacz instancję i zmieniaj ją jak każdą inną warstwę: edytuj tekst, podmień kolor albo ukryj warstwę w środku. Te zmiany zostają, gdy komponent się zmienia, a cała reszta dalej podąża za komponentem.

Niektóre rzeczy zawsze pochodzą z komponentu: położenie każdej warstwy w instancji, jej obrót i ograniczenia.

Aby odłączyć instancję od komponentu, naciśnij <Keys mac="⌥ ⌘ B" other="Ctrl Alt B" />. Stanie się zwykłą ramką, która wygląda tak samo.

## Tworzenie wariantów

Warianty to wersje jednego komponentu, na przykład przycisk główny i dodatkowy albo przełącznik włączony i wyłączony.

1. Zaznacz komponent.
2. Kliknij **Dodaj wariant** u góry panelu **Design**. Komponent stanie się zestawem, a pod nim pojawi się kopia.
3. Zmień kopię i nadaj jej nazwę w sekcji **Warianty**.

Aby połączyć komponenty, które już masz, zaznacz je i naciśnij <Keys mac="⇧ ⌘ K" other="Ctrl Shift K" />.

Wariant może mieć kilka właściwości, na przykład **Size=Small, State=Hover**. Zestaw nie musi zawierać wszystkich kombinacji. Gdy instancja prosi o kombinację, której w zestawie nie ma, używa wariantu z lewego górnego rogu.

## Wybieranie wariantu w instancji

<GuideLegend>

<GuideImage name="components/instance" alt="Właściwości komponentu dla instancji: Label ustawione na Publish i Variant ustawione na Primary" />

Zaznacz instancję. Sekcja **Właściwości komponentu** u góry panelu **Design** pokazuje, co możesz ustawić: wybrać wariant, wpisać etykietę albo włączyć lub wyłączyć warstwę.

</GuideLegend>

## Dodawanie właściwości

Właściwości to ustawienia, które oferuje instancja. Właściwości wariantów zestawu komponentów już tam są.

1. Zaznacz komponent.
2. Kliknij **+** obok **Właściwości** i wybierz rodzaj:
   - **Tekst** ustawia treść etykiety.
   - **Wartość logiczna** pokazuje albo ukrywa warstwę, na przykład ikonę.
   - **Zamiana instancji** podmienia zagnieżdżoną instancję, na przykład samą ikonę.
   - **Wariant** dodaje kolejny zestaw wariantów.
3. Powiąż z nią warstwę. Zaznacz warstwę w komponencie i kliknij **Zastosuj zmienną/właściwość** obok odpowiedniego ustawienia: w sekcji **Typografia** dla tekstu, w sekcji **Wygląd** dla pokazywania i ukrywania albo u góry panelu dla zagnieżdżonej instancji.

<GuideLegend>

<GuideImage name="components/property" alt="Otwarta właściwość Label z nazwą, wartością domyślną i warstwą, którą steruje" />

Kliknij właściwość, żeby zmienić jej nazwę lub wartość domyślną, zobaczyć warstwy, którymi steruje, albo ją usunąć. Przeciągaj właściwości, żeby zmienić ich kolejność.

</GuideLegend>

Aby pokazać własne właściwości zagnieżdżonej instancji w instancjach twojego komponentu, wybierz **+ → Zagnieżdżone instancje** i zaznacz ją.

## Dodawanie slotów

Slot to ramka w komponencie, której zawartość każda instancja wypełnia po swojemu, na przykład treść karty albo elementy listy.

1. Zaznacz ramkę w komponencie albo warstwy, które mają się w niej znaleźć.
2. Kliknij **Utwórz slot** w panelu **Design** albo wybierz **Obiekt → Utwórz slot**.

W ustawieniach slotu podajesz opis, preferowane komponenty i liczbę elementów, które mieści; instancja poza tymi granicami pokazuje ostrzeżenie. W instancji możesz dodawać elementy slotu, zmieniać ich kolejność i je usuwać albo przywrócić zawartość z komponentu.

## Zamiana komponentu w kontrolkę

Zachowanie sprawia, że podczas podglądu projektu komponent działa jak prawdziwy przycisk, przełącznik, suwak, zakładka albo pole tekstowe. Kontrolki pochodzą z [Reka UI](https://reka-ui.com).

1. Zaznacz komponent albo zestaw komponentów.
2. Kliknij **+** obok **Zachowanie** i wybierz kontrolkę.
3. Wypełnij wyświetlone wiersze.

<GuideLegend>

<GuideImage name="components/behaviour" alt="Sekcja Zachowanie dla przełącznika, oznaczona jako Gotowe, z polami Zaznaczony, Wł., Wył., Uchwyt, Stany i Przejście" />

- Pierwsze wiersze określają, która właściwość przechowuje wartość, na przykład **Zaznaczony** dla przełącznika, i który slot rysuje każdą część, na przykład **Uchwyt**.
- **Stany** to właściwość wariantu, która określa wygląd kontrolki w spoczynku, pod kursorem, po naciśnięciu, z fokusem, gdy jest wyłączona i gdy ma nieprawidłową wartość. **Dodaj warianty stanów** utworzy je za ciebie.
- **Przejście** płynnie przeprowadza kontrolkę między stanami. Jego czas trwania i wygładzanie mogą korzystać ze [zmiennych wygładzania i czasu](./variables#zmienne-wygładzania-i-czasu).

</GuideLegend>

Etykieta **Gotowe** pojawia się, gdy kontrolka działa. Do tego czasu wiersz pod jej nazwą mówi, czego brakuje: kliknij go, żeby przejść we właściwe miejsce.

Aby wypróbować kontrolki, naciśnij <Keys mac="⌥ ⌘ ↩" other="Ctrl Alt Enter" /> albo kliknij ▶ obok **Udostępnij**. Przełączniki się przełączają, suwaki dają się przeciągać, zakładki się otwierają, a w polach tekstowych można pisać. Podgląd nie zmienia twojego pliku. **Resetuj** przywraca wszystkie kontrolki do początku, a <Keys mac="Esc" other="Esc" /> wraca do edycji.

Zachowania są zapisywane w plikach `.fig`, a wyeksportowane komponenty Vue, React i Storybook je zachowują, przy czym każde przejście jest zapisane jako CSS.

## Udostępnianie komponentów między plikami

Aby używać tych samych komponentów w kilku plikach, opublikuj je jako [bibliotekę komponentów](./component-libraries).
