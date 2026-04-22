---
title: Edycja obiektów wektorowych
description: "Jak edytować geometrię ścieżki wektorowej: punkty kontrolne, uchwyty Béziera, modyfikatory i akcje narzędzia Pióro w trybie edycji."
---

# Edycja obiektów wektorowych

Tryb edycji obiektów wektorowych pozwala zmieniać **geometrię** krzywej: położenie punktów kontrolnych, kształt segmentów i uchwyty Béziera.  
W tym trybie edytujesz samą ścieżkę, nie standardowe przekształcenia obiektu.

## Wejście w tryb

- Zaznacz obiekt wektorowy narzędziem Zaznaczanie.
- **Kliknij dwukrotnie krzywą**.

Aktywuje to edycję geometrii zaznaczonego wektora.

## Wyjście z trybu

- Naciśnij <kbd>Escape</kbd>.
- Lub przejdź do innego kontekstu edycji.

## Co zmienia się w tym trybie

- Normalne obramowanie przekształceń jest wyłączone dla obiektu.
- Staje się dostępna edycja punktów kontrolnych, segmentów i uchwytów.
- Kursor nie przełącza się w tryb zmiany rozmiaru/obracania przy narożnikach obramowania.

## Podstawowe akcje

### Przesuwanie punktu kontrolnego

- Przeciągnij punkt kontrolny.
- Połączone segmenty i kształt ścieżki aktualizują się na żywo w podglądzie.

### Edycja uchwytu Béziera

- Przeciągnij uchwyt na punkcie kontrolnym.
- Domyślnie działanie zależy od aktualnego składu uchwytów danego punktu kontrolnego.

## Modyfikatory przeciągania uchwytów

| Akcja | Mac | Windows / Linux |
|-------|-----|-----------------|
| Ciągły (gładki / ciągły) | <kbd>Cmd</kbd> + przeciągnij | <kbd>Ctrl</kbd> + przeciągnij |
| Narożnikowy (niezależne uchwyty) | <kbd>Option</kbd> + przeciągnij | <kbd>Alt</kbd> + przeciągnij |
| Blokada kierunku (tylko długość) | <kbd>Shift</kbd> + przeciągnij | <kbd>Shift</kbd> + przeciągnij |

### Ciągły: <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + przeciągnij

- Aktywny uchwyt jest ograniczony do tej samej linii co uchwyt siostrzany.
- Zmienia się tylko długość aktywnego uchwytu.
- Stosuj do płynnych przejść bez łamania narożnika.

### Narożnikowy: <kbd>Option</kbd>/<kbd>Alt</kbd> + przeciągnij

- Aktywny uchwyt jest edytowany niezależnie.
- Uchwyt siostrzany pozostaje na miejscu.
- Stosuj do tworzenia ostrych przejść narożnikowych.

### Blokada kierunku: <kbd>Shift</kbd> + przeciągnij

Dla punktów kontrolnych ze składem **Ciągłym** lub **Symetrycznym**:

- kierunek uchwytu jest zablokowany do wartości sprzed **rozpoczęcia bieżącego przeciągania**;
- przeciąganie zmienia tylko długość uchwytu (lub uchwytów, zależnie od składu).

## Zmiana krzywizny przez przeciąganie punktu kontrolnego

Gdy przeciągasz punkt kontrolny przytrzymując <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>, edytor wybiera docelowy uchwyt na podstawie **kierunku przyłączenia segmentu** w tym punkcie (nie według odległości od najbliższego sąsiedniego punktu).  
Działa to również na punktach kontrolnych wielogałęziowej siatki wektorowej: po rozpoznaniu docelowy uchwyt pozostaje zablokowany przez czas bieżącego przeciągania.

## Narzędzie Pióro w trybie edycji

Gdy aktywne jest narzędzie Pióro:

- **Kliknij segment**, aby wstawić nowy punkt kontrolny (podział segmentu).
- **Kliknij punkt końcowy otwartej ścieżki**, aby wznowić rysowanie od tego miejsca.
- **Option/Alt + kliknij punkt kontrolny**, aby go usunąć (gdy topologia na to pozwala).

Informacje o tworzeniu i zamykaniu ścieżek znajdziesz w sekcji [Narzędzie Pióro](./pen-tool.md).

## Praktyczny przepływ pracy

1. Narysuj kształt narzędziem Pióro.
2. Kliknij dwukrotnie krzywą, aby wejść w tryb edycji obiektów wektorowych.
3. Przesuń punkty kontrolne, aby doprecyzować sylwetkę.
4. Przeciągaj uchwyty:
   - z <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> — dla płynnych, ciągłych przejść,
   - z <kbd>Option</kbd>/<kbd>Alt</kbd> — dla niezależnych edycji,
   - z <kbd>Shift</kbd> — dla edycji tylko długości.
5. Naciśnij <kbd>Escape</kbd>, aby wyjść.
