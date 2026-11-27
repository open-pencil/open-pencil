---
pageClass: guide
title: Przejście z Figmy
description: Przenoszenie plików i warstw z Figmy do OpenPencil oraz to, co działa tak samo, a co inaczej.
---

# Przejście z Figmy

OpenPencil odczytuje i zapisuje pliki `.fig` w formacie Figmy oraz używa nazw i skrótów z Figmy, więc większość tego, co znasz, działa tu tak samo. Twoje pliki pozostają twoje: w każdej chwili otworzysz je z powrotem w Figmie.

## Przenoszenie plików

1. W Figmie otwórz plik i wybierz **File → Save local copy…**.
2. W OpenPencil otwórz plik `.fig` albo przeciągnij go na okno. Zobacz [Otwieranie i zapisywanie](./files).

Zapisanie w OpenPencil tworzy plik `.fig`, który otwiera się także w Figmie.

## Kopiowanie warstw między aplikacjami

Zaznacz warstwy w Figmie, naciśnij <Keys mac="⌘ C" other="Ctrl C" /> i wklej je w OpenPencil skrótem <Keys mac="⌘ V" other="Ctrl V" />. Działa to też w drugą stronę. Przenoszą się wypełnienia, obrysy, efekty, tekst, auto-layout, promienie narożników i ścieżki wektorowe.

Obrazy we wklejonych warstwach są pobierane z Figmy, więc plik Figmy, z którego pochodzą, musi być plikiem, który możesz otworzyć. <Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> i <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> kopiują i wklejają tylko wygląd warstwy, również do Figmy i z Figmy.

## Co działa tak samo

- **Ramki, grupy, sekcje i auto-layout** z tymi samymi ustawieniami, łącznie z układem siatki.
- **Komponenty, warianty i instancje** z właściwościami i slotami. Zobacz [Komponenty](./components).
- **Zmienne i tryby**. Zobacz [Zmienne](./variables).
- **Style** z twoich plików i bibliotek działają tak jak w Figmie.
- **Skróty** są takie jak w Figmie, na przykład <Keys mac="R" other="R" /> dla prostokąta i <Keys mac="⇧ A" other="Shift A" /> dla auto-layoutu. Zobacz [Keyboard Shortcuts](/reference/keyboard-shortcuts).

## Co działa inaczej

- **Biblioteki.** Biblioteki zespołowe Figmy nie łączą się z OpenPencil. Aby udostępniać komponenty między plikami w OpenPencil, [opublikuj bibliotekę OpenPencil](./component-libraries).
- **Style.** Możesz stosować i odłączać style, ale nie możesz jeszcze ich tworzyć ani edytować. Do nowych kolorów i rozmiarów używaj [zmiennych](./variables).
- **Tryby zmiennych** ustawia się w ramce lub na stronie w sekcji **Wygląd**, gdzie każda kolekcja zawsze ma swój wiersz.
- **Czcionki.** Aplikacja desktopowa używa czcionek zainstalowanych na komputerze. W przeglądarce Chrome i Edge też mogą z nich korzystać, gdy na to zezwolisz. Zobacz [Wybieranie czcionki](./text-editing#wybieranie-czcionki).
- **Prototypowania** jeszcze nie ma. W podglądzie komponenty mogą [działać jak kontrolki](./components#zamiana-komponentu-w-kontrolke), na przykład przełącznik, który się przestawia.
- **Historia wersji** jest dostępna dla plików w [OpenPencil Cloud](/cloud/).

[Zgodność z Figmą](/pl/reference/figma-compatibility) zawiera listę wszystkich funkcji Figmy i tego, w jakim stopniu OpenPencil je obsługuje.

## Zamiast wtyczek i Dev Mode

- **Zapytaj AI.** Wiele z tego, co robią wtyczki, na przykład zmianę nazw warstw, tworzenie wariantów czy sprawdzanie kontrastu, [czat AI](./ai-chat) wykona na podstawie jednego zdania. Może też korzystać z [agenta programistycznego](./coding-agents), którego masz.
- **Napisz skrypt.** Skrypty używają tego samego API co wtyczki Figmy: `figma.currentPage` i reszty. Zobacz [Skrypty](/pl/developers/cli/scripting).
- **Pobierz kod.** Karta **Kod** obok karty **Design** pokazuje zaznaczenie jako HTML, Vue lub React, z CSS lub Tailwind.
- **Sprawdzaj projekty.** [Sprawdzanie projektów](./checking-designs) wyszukuje niski kontrast, małe obszary dotyku i kolory, które powinny korzystać ze zmiennej.
