---
layout: doc
title: AI i automatyzacja
description: Czat AI, CLI, JSX, serwer MCP i inne narzędzia automatyzacji oparte na silniku OpenPencil.
---

# AI i automatyzacja

OpenPencil pozwala traktować pliki projektowe jak dane. Wszystkie operacje edytora — tworzenie figur, ustawianie zalewów, zarządzanie automatycznym układem i eksport zasobów — są dostępne także z terminala, dla agentów AI i z kodu.

Interfejs edytora i narzędzia automatyzacji korzystają z tego samego silnika. Każde działanie dostępne w interfejsie można również wykonać ze skryptu.

## Czat AI

Wbudowany asystent używa ponad 90 narzędzi. Opisz zadanie zwykłym językiem, na przykład: „dodaj wszystkim przyciskom cień 16 px”, „utwórz komponent karty z wariantem ciemnym” albo „wyeksportuj wszystkie ramki na tej stronie w skali 2×”.

[Czat AI →](./ai-chat)

## Współpraca

Dokument jest synchronizowany bezpośrednio między uczestnikami przez WebRTC. Centralny serwer i konto nie są potrzebne. Kursory uczestników i tryb śledzenia pokazują ich obecność, a Yjs CRDT łączy równoczesne zmiany.

[Współpraca →](./collaboration)

## Vue SDK

Twórz edytory oparte na OpenPencil za pomocą tego samego Vue SDK, którego używa aplikacja. SDK udostępnia kontekst edytora, podłączenie obszaru roboczego, stan zaznaczenia, modele poleceń, composables dla paneli właściwości i komponenty bez narzuconego wyglądu.

[Vue SDK →](./sdk/)

## JSX

Opisuj interfejs za pomocą JSX. Jedno wywołanie może utworzyć drzewo komponentów zawierające ramki, tekst, automatyczny układ, zalewy i obwiednie.

W drugą stronę OpenPencil eksportuje zaznaczenie jako JSX albo HTML z klasami Tailwind. Wynik może służyć jako podstawa implementacji, przeglądu kodu lub kolejnego kroku z AI.

[JSX →](./jsx-renderer)

## CLI

Przeglądaj, eksportuj i analizuj dokumenty bez uruchamiania edytora. CLI pozwala wyświetlać strony, znajdować obiekty, wydobywać tokeny projektu, wykrywać problemy układu i eksportować PNG. Wszystkie polecenia obsługują wyjście JSON.

CLI łączy się również przez RPC z uruchomioną aplikacją komputerową i steruje otwartym dokumentem: pozwala otwierać, zapisywać i przełączać dokumenty, cofać zmiany, zmieniać ustawienia oraz wywoływać dowolne narzędzie MCP.

[Przeglądanie plików](./cli/inspecting) · [Eksport](./cli/exporting) · [Analiza](./cli/analyzing) · [Skrypty](./cli/scripting) · [Controlling the App](/programmable/cli/app-control)

## Serwer MCP

Claude Code, Cursor, Windsurf i inni klienci MCP mogą korzystać z tych samych 90 narzędzi co czat AI. Serwer obsługuje stdio i HTTP z sesjami.

[Serwer MCP →](/programmable/mcp-server)

## Schemat URL {#url-scheme}

Aplikacja na komputer rejestruje `openpencil://`, dzięki czemu opublikowana strona — historyjka Storybook, przegląd projektu, README — może prowadzić prosto do warstwy:

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` to ścieżka względem repozytorium, kończąca się na `.pen` lub `.fig`; ścieżki bezwzględne oraz segmenty `.` i `..` są odrzucane. `node` jest opcjonalny. Obie wartości są kodowane jako URL — separatory ścieżki mogą pozostać dosłowne, ale dosłowny `+` trzeba wysłać jako `%2B` — a powtórzony klucz przyjmuje ostatnią wartość.

Aplikacja dopasowuje `file` do ścieżek otwartych kart jako całą końcową sekwencję segmentów i aktywuje tę kartę bez ponownego odczytu dokumentu, więc plik, który od otwarcia został przeniesiony lub stał się nieczytelny, nadal pozwala zaznaczyć swoją warstwę. Wygrywa pierwsza otwarta karta, której ścieżka kończy się żądaną ścieżką, co ma znaczenie, gdy dwie kopie repozytorium mają otwarty ten sam plik. Segmenty są porównywane tak jak w systemie plików platformy: bez rozróżniania wielkości liter ASCII w macOS i Windows, dokładnie w Linuksie, więc `Web/Design/hikyo.pen` i `web/design/hikyo.pen` to ten sam plik na Macu i dwa różne w Linuksie. Jeśli żadna otwarta karta nie pasuje, selektor plików jednorazowo prosi o plik; wybrany plik musi kończyć się tą samą ścieżką względną, w przeciwnym razie odnośnik zostaje anulowany. Żadna ścieżka nie jest doklejana do katalogu głównego i nie jest przyznawany dostęp do systemu plików poza tym, co zwróci selektor. Plik, który odnośnik faktycznie otwiera — wybrany — trafia na listę ostatnich plików jak każdy inny otwarty plik; aktywowanie karty już otwartej nie zmienia listy, bo nic nie zostało otwarte.

Przy podanej nazwie obiektu aplikacja zaznacza wszystkie warstwy o dokładnie tej nazwie na bieżącej stronie i przybliża widok do całego zaznaczenia. Gdy bieżąca strona takich warstw nie ma, przełącza się na pierwszą stronę, która je ma, wczytując strony w miarę potrzeby. Nieznana nazwa pokazuje powiadomienie i pozostawia dokument otwarty. Schemat potrafi wyłącznie otworzyć plik i zaznaczyć warstwy.

Wersja internetowa przyjmuje taki sam odnośnik z własnego paska adresu:

```
https://app.openpencil.dev/?file=https://raw.githubusercontent.com/open-pencil/open-pencil/master/tests/fixtures/pencil_button.pen&node=Button/Large/Default
```

Tutaj `file` to bezwzględny adres `https:` kończący się na `.pen` lub `.fig` — wersja internetowa nie ma systemu plików, więc ścieżka względna, adres `http:` lub inne rozszerzenie są odrzucane z ostrzeżeniem w konsoli i niczym więcej. Rozszerzenie jest odczytywane ze ścieżki adresu, więc zapytanie w adresie pliku niczego nie zmienia. Fragment jest odcinany przed pobraniem: nigdy nie trafia na serwer, więc `…/hikyo.pen#a` i `…/hikyo.pen#b` otwierają jedną kartę, nie dwie. `node` działa dokładnie jak wyżej: to samo zaznaczanie po dokładnej nazwie i przybliżenie, to samo powiadomienie, gdy żadna warstwa nie ma takiej nazwy. Obie wartości są kodowane jako URL, dosłowny `+` trzeba wysłać jako `%2B`, a powtórzony klucz przyjmuje ostatnią wartość, tak jak na komputerze. Odnośnik jest obsługiwany na każdej trasie, więc `/share/<room>?file=…` i `/demo?file=…` działają jak `/?file=…`.

Przeglądarka pobiera plik między domenami, więc host musi to dopuszczać: `raw.githubusercontent.com` wysyła `Access-Control-Allow-Origin: *` i działa. Żądanie nie niesie danych uwierzytelniających i odmawia podążania za przekierowaniami, co chroni przed przekierowaniem odnośnika `https:` na niezaszyfrowany — adres `https://github.com/<owner>/<repo>/raw/...` przekierowuje na `raw.githubusercontent.com`, więc jest odrzucany; podaj bezpośrednio adres hosta raw. `file` i `node` są usuwane z paska adresu przez router zaraz po odczycie — przed pobraniem, a także gdy odnośnik został odrzucony — więc przeładowanie nie otwiera dokumentu ponownie, a skopiowany adres ani późniejsza nawigacja w aplikacji nie niosą danych odnośnika. Dokument z odnośnika jest ograniczony do 64 MiB: treść jest liczona w trakcie strumieniowania, nie na podstawie `Content-Length`, a żądanie jest przerywane w chwili przekroczenia limitu, po czym odnośnik zgłasza, że plik przekracza 64 MiB. Wdrożenie udostępniające aplikację z Content-Security-Policy musi dopuścić host odnośnika w `connect-src`, inaczej pobranie jest blokowane, a odnośnik zgłasza, że nie udało się otworzyć pliku.

W macOS schemat należy do zainstalowanego pakietu aplikacji, więc odnośniki trafiają do zainstalowanej wersji, a nie do procesu `tauri dev`. W Windows i Linuksie odnośnik dociera przez wtyczkę deep-link, także gdy aplikacja jeszcze nie działa: jest kolejkowany przy starcie i obsługiwany, gdy edytor jest gotowy; w Linuksie dołączony wpis pulpitu przekazuje odnośnik przez `%U`.

## Otwarta platforma

OpenPencil jest udostępniany na licencji MIT, przechowuje dokumenty lokalnie i zapewnia programowy dostęp do operacji. Pliki `.fig` można sprawdzać, przekształcać, przetwarzać w CI i przekazywać modelowi językowemu bez zależności od konkretnego dostawcy hostingu.
