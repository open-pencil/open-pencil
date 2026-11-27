---
pageClass: guide
title: Eksportowanie
description: Zapisuj warstwy jako obrazy, PDF lub slajdy albo kopiuj je do innej aplikacji.
---

# Eksportowanie

Zapisz warstwę jako plik albo skopiuj ją prosto do innej aplikacji. Jeśli chcesz później dalej pracować nad projektem, [zapisz dokument](./files).

## Eksportowanie warstwy

1. Zaznacz jedną lub więcej warstw. Gdy nic nie jest zaznaczone, eksportujesz stronę.
2. W panelu **Design** kliknij **+** obok **Eksport**.
3. Wybierz rozmiar i format.
4. Kliknij **Eksport**.

<GuideLegend>

<GuideImage name="exporting/panel" alt="Ustawienia eksportu z czterema ponumerowanymi elementami" />

1. **Skala eksportu** ustawia rozmiar obrazu. Wybierz jedną z wartości albo wpisz własną, na przykład `2.5`.
2. **Format eksportu** ustawia typ pliku.
3. **Eksport** zapisuje każdy wiersz jako plik. Kilka plików trafia do jednego archiwum ZIP.
4. **Podgląd** pokazuje, co otrzymasz.

</GuideLegend>

Aby wyeksportować warstwę w kilku rozmiarach, kliknij **+** jeszcze raz. Każdy nowy wiersz ma dwa razy większą skalę niż poprzedni.

## Wybieranie formatu

| Do czego | Format |
| --- | --- |
| Zrzuty ekranu i obrazy z przezroczystością | PNG |
| Zdjęcia, gdy przezroczystość nie ma znaczenia | JPG |
| Mniejsze obrazy do internetu | WEBP |
| Ikony i grafiki, które mają być ostre w każdym rozmiarze | SVG |
| Drukowanie i udostępnianie stron | PDF |
| Prezentacje | PPTX |
| Diagramy | draw.io |

Skala dotyczy tylko formatów PNG, JPG i WEBP.

**Plik → Eksportuj zaznaczenie…** zapisuje też plik `.fig` zawierający tylko zaznaczone warstwy.

## Kopiowanie do innej aplikacji

Kliknij warstwę prawym przyciskiem myszy i wybierz **Kopiuj/Wklej jako**.

<GuideLegend>

<GuideImage name="exporting/copy-as" other="exporting/copy-as-other" alt="Menu Kopiuj/Wklej jako" />

- **Kopiuj jako PNG** — do czatów i dokumentów. Naciśnij <Keys mac="⇧ ⌘ C" other="Ctrl Shift C" />.
- **Kopiuj jako SVG** — do kodu i edytorów wektorowych.
- **Kopiuj jako JSX** — do kodu.
- **Kopiuj jako tekst** kopiuje tekst warstwy tekstowej.

</GuideLegend>
