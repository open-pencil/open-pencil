---
title: Edycja tekstu
description: Tworzenie i edytowanie tekstu, formatowanie oraz zarządzanie czcionkami w OpenPencil.
---

# Edycja tekstu

OpenPencil pozwala tworzyć obiekty tekstowe i edytować sformatowany tekst bezpośrednio na obszarze roboczym.

## Tworzenie tekstu

Naciśnij <kbd>T</kbd>, a następnie kliknij obszar roboczy. Pojawi się pusty obiekt tekstowy z migającym kursorem — możesz od razu rozpocząć pisanie.

## Edycja na obszarze roboczym

Kliknij dwukrotnie istniejący obiekt tekstowy. Niebieska ramka oznacza aktywny tryb edycji. Kliknij poza obiektem, aby zastosować zmiany i wyjść.

Tekst jest wyświetlany bezpośrednio na obszarze roboczym; nie pojawia się osobne widoczne pole wprowadzania.

## Przesuwanie kursora

| Działanie | macOS | Windows / Linux |
|-----------|-------|-----------------|
| Jeden znak w lewo lub w prawo | <kbd>←</kbd> / <kbd>→</kbd> | <kbd>←</kbd> / <kbd>→</kbd> |
| Jeden wiersz w górę lub w dół | <kbd>↑</kbd> / <kbd>↓</kbd> | <kbd>↑</kbd> / <kbd>↓</kbd> |
| Jedno słowo | <kbd>⌥</kbd><kbd>←</kbd> / <kbd>⌥</kbd><kbd>→</kbd> | <kbd>Ctrl</kbd> + <kbd>←</kbd> / <kbd>Ctrl</kbd> + <kbd>→</kbd> |
| Początek lub koniec wiersza | <kbd>⌘</kbd><kbd>←</kbd> / <kbd>⌘</kbd><kbd>→</kbd> | <kbd>Home</kbd> / <kbd>End</kbd> |

Przytrzymaj <kbd>Shift</kbd> razem z klawiszem ruchu, aby rozszerzyć zaznaczenie.

## Zaznaczanie tekstu

- Kliknij wewnątrz tekstu, aby ustawić kursor.
- Kliknij i przeciągnij, aby zaznaczyć zakres.
- Kliknij słowo dwukrotnie, aby je zaznaczyć.
- Kliknij tekst trzykrotnie, aby zaznaczyć całą zawartość obiektu.

## Formatowanie

Formatowanie jest stosowane do zaznaczonego zakresu. Jeśli nic nie zaznaczono, przycisk zmienia styl całego obiektu tekstowego.

| Działanie | macOS | Windows / Linux |
|-----------|-------|-----------------|
| Pogrubienie | <kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>B</kbd> |
| Kursywa | <kbd>⌘</kbd><kbd>I</kbd> | <kbd>Ctrl</kbd> + <kbd>I</kbd> |
| Podkreślenie | <kbd>⌘</kbd><kbd>U</kbd> | <kbd>Ctrl</kbd> + <kbd>U</kbd> |

Przekreślenie włącza się przyciskiem **S** w sekcji „Typografia”. Nie ma osobnego skrótu, ponieważ <kbd>⌘</kbd><kbd>S</kbd> służy do zapisywania.

Styl jest przechowywany dla każdego znaku. Tekst wpisywany między fragmentami pogrubionymi i zwykłymi dziedziczy styl poprzedniego fragmentu.

## Operacje edycji

| Działanie | macOS | Windows / Linux |
|-----------|-------|-----------------|
| Usuń poprzednie słowo | <kbd>⌥</kbd><kbd>⌫</kbd> | <kbd>Ctrl</kbd> + <kbd>Backspace</kbd> |
| Usuń do początku wiersza | <kbd>⌘</kbd><kbd>⌫</kbd> | — |
| Wytnij | <kbd>⌘</kbd><kbd>X</kbd> | <kbd>Ctrl</kbd> + <kbd>X</kbd> |
| Kopiuj | <kbd>⌘</kbd><kbd>C</kbd> | <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Wklej | <kbd>⌘</kbd><kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>V</kbd> |

## Wybór czcionki

Otwórz wybór czcionki w sekcji „Typografia”.

- **Wyszukiwanie** zawęża listę podczas pisania.
- **Podgląd** pokazuje nazwę każdej czcionki jej własnym krojem.
- **Wirtualne przewijanie** sprawnie obsługuje duże katalogi.
- Po otwarciu lista przewija się do bieżącej rodziny i ją wyróżnia.

## Odmiana czcionki

Dostępne odmiany zależą od rodziny, na przykład Regular, Medium, Bold i Black.

## Źródła czcionek

- **Domyślnie:** Inter jest ładowany automatycznie.
- **Aplikacja komputerowa:** czcionki systemowe i włączone katalogi Google Fonts, Fontsource, Bunny Fonts oraz Fontshare.
- **Przeglądarka:** czcionki systemowe są dostępne w Chrome i Edge; katalogi internetowe wymagają aplikacji komputerowej.
- **Pobrane czcionki:** aplikacja zapisuje pobrane odmiany do ponownego użycia na tym komputerze.

## Brakujące czcionki i zamienniki

Jeśli odpowiednia rodzina lub odmiana nie może zostać załadowana, OpenPencil pokazuje ostrzeżenie nad edytorem i nie przedstawia zastępczego wyglądu jako wiernego projektowi.

Rozwiń ostrzeżenie, aby zobaczyć wszystkie brakujące odmiany i ich zamienniki. Przycisk **Wybierz warstwy** zaznacza odpowiednie obiekty tekstowe. Po zmianie dostępu do sieci, uprawnień do lokalnych czcionek lub ustawień dostawców naciśnij **Ponów ładowanie czcionek**.

Odmiana może zostać utworzona na podstawie innej załadowanej odmiany tej samej rodziny. Jeśli brakuje całej rodziny, OpenPencil używa Inter, o ile jest dostępny.

## Wskazówki

- Lista czcionek jest ładowana podczas uruchamiania, dlatego panel otwiera się bez opóźnienia.
- Obsługiwane jest wprowadzanie przez IME dla języka chińskiego, japońskiego i koreańskiego.
- Formatowanie jest zachowywane podczas otwierania i zapisywania `.fig`.
- Zastępowanie tekstu w egzemplarzach komponentów opisano na stronie [Komponenty](./components).
