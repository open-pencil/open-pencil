---
pageClass: guide
title: Tworzenie responsywnej karty
description: "Pierwszy projekt w OpenPencil krok po kroku: karta produktu, której tekst się zawija, a wysokość dopasowuje się do zawartości przy każdej szerokości."
---

# Tworzenie responsywnej karty

W tym projekcie zbudujesz kartę produktu, która się dopasowuje: gdy ją zwęzisz lub poszerzysz, zdjęcie się rozciąga, tekst zawija, a wysokość podąża za zawartością. Zajmie to około dziesięciu minut, a przy okazji poznasz narzędzia, których będziesz używać najczęściej.

<GuidePair>

<GuideImage name="responsive-card/narrow" alt="Gotowa karta o szerokości 240 z opisem w trzech wierszach" caption="Szerokość 240" />
<GuideImage name="responsive-card/wide" alt="Ta sama karta o szerokości 420 z opisem w dwóch wierszach" caption="Szerokość 420" />

</GuidePair>

## 1. Dodawanie elementów

Zacznij od nowego pliku: **Plik → Nowy projekt** albo <Keys mac="⌘ N" other="Ctrl N" />.

1. Naciśnij <Keys mac="R" other="R" /> i przeciągnij prostokąt o szerokości około 280 i wysokości 160. Będzie w nim zdjęcie.
2. Naciśnij <Keys mac="T" other="T" />, kliknij pod prostokątem i wpisz nazwę: *Kubek ceramiczny*. Naciśnij <Keys mac="Esc" other="Esc" />.
3. W ten sam sposób dodaj pod spodem dwa kolejne teksty: opis, na przykład *Toczony ręcznie w małych partiach, dłużej utrzymuje ciepło kawy*, oraz *Dodaj do koszyka*.

Ułóż te cztery elementy w kolumnie, z lewymi krawędziami mniej więcej w jednej linii.

<GuideImage name="responsive-card/parts" alt="Prostokąt i trzy teksty ułożone luźno w kolumnie na płótnie" />

## 2. Umieszczanie elementów w karcie

1. Naciśnij <Keys mac="⌘ A" other="Ctrl A" />, aby zaznaczyć wszystkie cztery elementy.
2. Naciśnij <Keys mac="⇧ A" other="Shift A" />. Trafią do nowej ramki z [auto-layoutem](./auto-layout), który układa je jeden po drugim.
3. Jeśli elementy ułożyły się w wierszu, w panelu **Design** w sekcji **Przepływ** wybierz przycisk kolumny, **Układ pionowy**.
4. Ustaw odstęp między elementami na **12**, a dopełnienie na **20**.
5. Kliknij **+** obok **Wypełnienie**, aby nadać karcie tło, i ustaw **Promień** na **16**.
6. Kliknij dwukrotnie nazwę ramki na liście warstw i nazwij ją *Karta*.

## 3. Rozciąganie elementów

1. Ustaw **W** karty na **320**.
2. Zaznacz prostokąt. Otwórz menu w jego polu **W** i wybierz **Wypełnij**: prostokąt przyjmie szerokość karty, wewnątrz dopełnienia.
3. Zrób to samo z nazwą i opisem. Opis zawija się do nowych wierszy, zamiast wychodzić poza krawędź karty.

Wysokość karty sama dopasowuje się do zawartości. Wypróbuj to: przeciągnij prawą krawędź karty albo wpisz inną wartość **W**. Zdjęcie się rozciąga, opis zawija, a karta rośnie lub maleje, aby wszystko się zmieściło.

## 4. Tworzenie przycisku

1. Zaznacz *Dodaj do koszyka* i naciśnij <Keys mac="⇧ A" other="Shift A" />. Tekst trafi do osobnej ramki.
2. Nadaj tej ramce niebieskie wypełnienie, dopełnienie **16** w poziomie i **10** w pionie oraz **Promień** **10**. Zmień kolor tekstu na biały.
3. Naciśnij <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />, aby zamienić przycisk w [komponent](./components), który możesz wielokrotnie wykorzystywać.

## 5. Dodawanie zdjęcia

1. Zaznacz prostokąt i kliknij kwadrat koloru w sekcji **Wypełnienie**.
2. Kliknij przycisk obrazu u góry okna, a potem **Choose image**, aby użyć obrazu z komputera, albo **Zdjęcie stockowe**, aby [znaleźć zdjęcie](./photos).

Zdjęcie wypełnia prostokąt przy każdej szerokości.

## 6. Sprawdzanie i udostępnianie

- Otwórz kartę **Sprawdź**, aby [sprawdzić kartę](./checking-designs) pod kątem problemów, takich jak trudny do odczytania tekst.
- [Wyeksportuj ją](./exporting) jako PNG albo kliknij ją prawym przyciskiem myszy i wybierz **Kopiuj/Wklej jako → Kopiuj jako PNG**, aby wkleić ją w czacie.
- Poproś [AI](./ai-chat) o wariant: *„Zrób ciemną wersję tej karty”.*

## Co dalej

- [Auto-layout](./auto-layout): wiersze, siatki, zawijanie i inne sposoby, w jakie warstwy zmieniają rozmiar.
- [Komponenty](./components): warianty, właściwości i instancje.
- [Zmienne](./variables): kolory i rozmiary ustawiane raz, z trybem ciemnym i jasnym.
