---
title: Eksport i pliki
description: Eksport obrazów, SVG i wybranych obiektów do .fig oraz otwieranie dokumentów .fig i .pen.
---

# Eksport i pliki

OpenPencil eksportuje pojedyncze obiekty jako obrazy, SVG albo osobne dokumenty `.fig`. Edytor otwiera pełne dokumenty `.fig` i `.pen`.

## Eksport obrazów

Zaznacz obiekt i otwórz sekcję „Eksport” na panelu właściwości.

### Ustawienia

- **Skala:** od 0,5× do 4×. Dla SVG nie jest wyświetlana, ponieważ grafika wektorowa nie zależy od rozdzielczości.
- **Format:** PNG z przezroczystym tłem, JPG z białym tłem, WEBP z przezroczystym tłem, SVG albo osobny dokument `.fig`.

Dla jednego obiektu można dodać kilka wariantów eksportu. Podgląd na tle szachownicy pokazuje przyszły wynik.

### Sposoby eksportu

| Sposób | macOS | Windows / Linux |
|--------|-------|-----------------|
| Skrót | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Menu kontekstowe | Prawy przycisk → Eksport… | Prawy przycisk → Eksport… |
| Panel właściwości | Przycisk Eksport | Przycisk Eksport |

W aplikacji komputerowej ścieżkę wybiera się w oknie systemowym. W przeglądarce plik jest pobierany w zwykły sposób.

## Kopiuj jako

Menu kontekstowe umieszcza zaznaczenie w schowku w kilku formatach:

| Działanie | macOS | Windows / Linux |
|-----------|-------|-----------------|
| Kopiuj jako tekst | — | — |
| Kopiuj jako SVG | — | — |
| Kopiuj jako PNG | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Kopiuj jako JSX | — | — |

Tekst jest kopiowany z widocznej zawartości, SVG jako znaczniki, PNG w skali 2×, a JSX w formacie zgodnym z `renderJsx()`.

## Dokumenty .fig i .pen

OpenPencil używa binarnego formatu `.fig` Figmy i otwiera również dokumenty `.pen`.

### Otwieranie

| Działanie | macOS | Windows / Linux |
|-----------|-------|-----------------|
| Otwórz plik | <kbd>⌘</kbd><kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |

### Zapisywanie

| Działanie | macOS | Windows / Linux |
|-----------|-------|-----------------|
| Zapisz | <kbd>⌘</kbd><kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> |
| Zapisz jako | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>S</kbd> |

**Zapisz** nadpisuje bieżący plik, jeśli OpenPencil nadal ma uprawnienia do zapisu. **Zapisz jako** pozwala wybrać nową ścieżkę.

W Chrome i Edge przeglądarka korzysta z File System Access API. Inne przeglądarki, w tym Safari, pobierają plik.

Zapisany plik jest skompresowany i zawiera miniaturę widoczną w menedżerze plików.

### Zgodność z Figmą

Pliki wyeksportowane z OpenPencil można otworzyć w Figmie, a dokumenty Figmy — w OpenPencil. Format `.fig` zachowuje typy obiektów, właściwości, zalewy, obwiednie, efekty, dane wektorowe i parametry układu.

## Wskazówki

- Dla ekranów o dużej gęstości pikseli używaj skali 2× lub 3×.
- JPG zawsze otrzymuje białe tło. Do przezroczystości wybierz PNG lub WEBP.
- SVG nadaje się do dalszej edycji w Illustratorze, Inkscape lub kodzie.
