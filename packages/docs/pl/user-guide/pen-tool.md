---
title: Narzędzie Pióro
description: Tworzenie ścieżek wektorowych i krzywych Béziera w OpenPencil.
---

# Narzędzie Pióro

Pióro tworzy ścieżki wektorowe na podstawie modelu sieci wektorowej zgodnego z `.fig`.

## Włączanie

Naciśnij <kbd>P</kbd>.

## Tworzenie punktów

- Kliknij raz, aby umieścić punkt narożny i utworzyć prosty segment.
- Kliknij i przeciągnij, aby umieścić punkt krzywej z uchwytami Béziera. Kierunek i odległość przeciągania określają kształt krzywej.
- Nie zwalniając przycisku myszy, przytrzymaj <kbd>Space</kbd>, aby przesunąć właśnie tworzony punkt.

Dodawaj kolejne punkty, aby budować ścieżkę segment po segmencie. Linia podglądu łączy ostatni punkt z bieżącym położeniem wskaźnika.

## Zamknięta ścieżka

Kliknij pierwszy punkt ścieżki, aby ją zamknąć. Zamknięta ścieżka może mieć zalew.

## Otwarta ścieżka

Naciśnij <kbd>Escape</kbd>, aby zakończyć ścieżkę bez zamykania. Otwarta ścieżka jest wyświetlana tylko z obwiednią.

## Sieci wektorowe

Zamiast prostej sekwencji punktów OpenPencil używa sieci wektorowej. Model ten obsługuje rozgałęzienia i złożoną topologię. Figma stosuje ten sam model, dlatego ścieżki są zachowywane podczas importu i eksportu `.fig`.

## Edycja istniejącej ścieżki

Przy aktywnym Piórze:

- kliknij punkt końcowy otwartej ścieżki, aby kontynuować rysowanie;
- kliknij segment, aby dodać punkt;
- przytrzymaj <kbd>Option</kbd> albo <kbd>Alt</kbd> i kliknij punkt, aby go usunąć, jeśli pozwala na to topologia.

## Skróty klawiaturowe

| Działanie | macOS | Windows / Linux |
|-----------|-------|-----------------|
| Pióro | <kbd>P</kbd> | <kbd>P</kbd> |
| Zakończ otwartą ścieżkę | <kbd>Escape</kbd> | <kbd>Escape</kbd> |

## Wskazówki

- Linia podglądu zawsze zaczyna się w ostatnim dodanym punkcie.
- Im dalej przeciągniesz wskaźnik podczas tworzenia punktu krzywej, tym dłuższe będą uchwyty Béziera.
- Po utworzeniu ścieżki skonfiguruj zalew, obwiednię i efekty na panelu właściwości.
