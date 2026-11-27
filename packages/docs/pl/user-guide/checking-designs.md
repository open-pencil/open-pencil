---
pageClass: guide
title: Sprawdzanie projektów
description: Wyszukiwanie problemów z dostępnością, spójnością i strukturą w panelu Sprawdź i za pomocą znaczników na płótnie.
---

# Sprawdzanie projektów

OpenPencil sprawdza bieżącą stronę w trakcie pracy i wskazuje warstwy, które łamią typowe zasady projektowania: tekst trudny do odczytania, kontrolki zbyt małe, by w nie trafić palcem, kolory, które powinny korzystać ze zmiennej, i odstępy spoza skali.

## Wyszukiwanie problemów

Otwórz kartę **Sprawdź** w prawym panelu. Jej plakietka pokazuje, ile błędów i ostrzeżeń ma strona.

<GuideImage name="checking-designs/lint" alt="Karta rejestracji z bladym, drobnym tekstem i małym przyciskiem, jej znaczniki problemów oraz panel Sprawdź z listą problemów: niski kontrast, mały tekst i mały obszar dotyku" />

- **Strona** pokazuje wszystkie problemy na bieżącej stronie; **Zaznaczenie** zawęża listę do zaznaczonych warstw i wszystkiego, co jest w nich; **Dokument** pokazuje problemy ze wszystkich stron i oznacza te, które są na innych stronach. Kliknięcie takiego problemu przełącza na jego stronę. Strony dużego pliku `.fig`, których jeszcze nie otwierano, są sprawdzane dopiero po ich otwarciu.
- Problemy są pogrupowane według reguł, od najpoważniejszych. Błędy i ostrzeżenia są na początku rozwinięte, a sugestie zwinięte.
- Przyciski ważności pod przełącznikiem zakresu włączają i wyłączają wyświetlanie błędów, ostrzeżeń i sugestii.
- Najedź na tytuł grupy, aby przeczytać, co sprawdza reguła i dlaczego.

Najedź na problem, aby podświetlić jego warstwę na płótnie. Kliknij go, aby zaznaczyć warstwę; jeśli jest poza ekranem, płótno przesunie się do niej, a oddali się tylko wtedy, gdy warstwa się nie mieści.

## Poprawianie problemów

Wiersze, które można poprawić jednym krokiem, po najechaniu pokazują przycisk:

- Wpisany na stałe kolor, który odpowiada jednej ze zmiennych koloru dokumentu, zostaje z nią powiązany (przycisk z łańcuchem). Wiersz podaje nazwę zmiennej.
- Pozycje i rozmiary z ułamkami pikseli są zaokrąglane do pełnych pikseli. Wartości ustawiane przez auto-layout lub zmianę rozmiaru tekstu, a także grafika wektorowa i elementy grup, pozostają bez zmian.
- Promień narożnika i odstępy spoza skali zmieniają się na najbliższą wartość ze skali, a tekst mniejszy od minimalnego rozmiaru zostaje do niego powiększony (przycisk z różdżką). To zmienia projekt, więc takie poprawki stosuje się po jednym wierszu.
- Grupę można w miejscu przekształcić w ramkę, z zachowaniem jej warstw, pozycji i wyglądu (przycisk z ramką), a ukrytą warstwę można usunąć (przycisk z koszem). Żadna z tych opcji nie jest dostępna dla warstw zablokowanych ani dla warstw wewnątrz komponentu lub instancji, bo ich strukturą zarządza komponent.

Powiązanie kolorów i zaokrąglenie pikseli nie zmienia wyglądu projektu, więc ich grupy mają też przycisk **Powiąż wszystkie** lub **Popraw wszystkie**. Każdą poprawkę cofa się jednym krokiem.

Inne problemy pokazują wartość, która wymaga uwagi, na przykład współczynnik kontrastu lub rozmiar obszaru dotyku, dzięki czemu możesz poprawić ją w panelu **Design**.

## Problemy na płótnie

Znaczniki na płótnie, liczniki przy stronach i oznaczenia w panelu **Warstwy** są wyłączone, dopóki ich nie włączysz, więc plik otwarty w nowym profilu nie jest zasypany ostrzeżeniami. Włączysz je lub wyłączysz poleceniem **Widok → Problemy projektu** albo opcją **Pokazuj problemy na obszarze roboczym** w menu ustawień panelu **Sprawdź**. Profil, który ma już zapisany wybór, zachowuje go.

Gdy są włączone, warstwy z błędami i ostrzeżeniami mają znacznik w prawym górnym rogu: czerwony przy błędach, bursztynowy przy ostrzeżeniach. Sugestie pojawiają się tylko w panelu **Sprawdź**.

- Najedź na znacznik, aby zobaczyć jego problemy. Kliknij go, aby zaznaczyć warstwę i otworzyć jej problemy w panelu **Sprawdź**.
- Znaczniki, które by się nakładały, łączą się w jeden z łączną liczbą problemów.
- Gdy warstwa jest za mała, by ją zobaczyć przy bieżącym powiększeniu, jej znacznik przenosi się na najbliższą zawierającą ją warstwę, która jest wystarczająco duża.
- Błędy i ostrzeżenia poza widocznym obszarem płótna są przypięte do jego krawędzi i wskazują w ich stronę. Najedź na przypiętą etykietę, aby je zobaczyć; kliknij ją, aby pokazać najbliższy z najpoważniejszych problemów i otworzyć go w panelu **Sprawdź**.
- Ukryte warstwy i warstwy przycięte przez ramkę poza widokiem zachowują swoje problemy w panelu, ale nie dostają znacznika.

Strony z błędami lub ostrzeżeniami pokazują ich liczbę na liście stron; są sprawdzane w tle podczas pracy. Panel **Warstwy** oznacza te same warstwy: warstwa z błędami lub ostrzeżeniami pokazuje ikonę najpoważniejszego z nich, a zwinięta warstwa, w której środku są problemy, pokazuje kropkę. Te oznaczenia zależą od tego samego przełącznika co znaczniki na płótnie.

## Problemy w kodzie

Karta **Kod** podkreśla błędy i ostrzeżenia w kodzie Design JSX, HTML, Vue lub React ich warstw: przy właściwości, która powoduje problem, jeśli taka jest, na przykład `size={10}` przy małym tekście, albo przy klasie nadającej warstwie styl. Najedź na podkreślenie, aby przeczytać opis problemu. Strona jest sprawdzana, gdy panel **Sprawdź** jest otwarty lub znaczniki na płótnie są włączone, a podkreślenia nadążają za tym sprawdzaniem i za twoimi zmianami.

## Wybieranie reguł

Menu ustawień w panelu **Sprawdź** przełącza zestawy reguł:

- **Zalecane** — wyważone ustawienia domyślne do codziennej pracy.
- **Rygorystyczne** — wszystkie reguły jako ostrzeżenia lub błędy.
- **Dostępność** — tylko kontrast, rozmiar obszaru dotyku i rozmiar tekstu.

Pojedynczą regułę wyłączysz z menu jej grupy. Opcja **Włącz wyłączone reguły** w menu ustawień przywraca je. Zestawy i wyłączone reguły są zapamiętywane między sesjami.

Te same reguły można uruchomić z wiersza poleceń przez `openpencil lint`; zobacz [Przeglądanie dokumentów](/pl/developers/cli/inspecting).
