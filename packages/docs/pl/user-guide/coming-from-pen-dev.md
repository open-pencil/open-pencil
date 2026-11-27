---
pageClass: guide
title: Przejście z pen.dev
description: Otwieranie plików pen.dev (dawniej Pencil) w OpenPencil, co się przenosi i jak dalej projektować z agentem AI.
---

# Przejście z pen.dev

OpenPencil otwiera pliki `.pen` z pen.dev, które wcześniej nazywało się Pencil. Twój projekt pojawia się jako warstwy, które możesz edytować, a ty dalej pracujesz z agentem AI, którego już używasz.

## Otwieranie pliku `.pen`

Naciśnij <Keys mac="⌘ O" other="Ctrl O" /> i wybierz plik albo przeciągnij go na okno. Na komputerze możesz też otworzyć go z Findera lub Eksploratora plików za pomocą aplikacji desktopowej.

OpenPencil odczytuje pliki `.pen`, ale ich nie zapisuje. Przy pierwszym zapisie pyta, gdzie umieścić nowy plik `.fig` o takiej samej nazwie jak oryginał; przeglądarka bez okna zapisu po prostu go pobiera. Plik `.pen` pozostaje bez zmian, a plik `.fig` otwiera się także w Figmie.

## Co się przenosi

- Ramki, kształty i ścieżki z ich wypełnieniami, obrysami i efektami.
- Tekst i układ: wiersze, kolumny, odstępy i dopełnienie.
- Komponenty i ich instancje wraz ze zmianami wprowadzonymi w każdej instancji.
- Motywy jako kolekcje [zmiennych](./variables). Opcje motywu, które łączą się w twoich zmiennych, takie jak tryb kolorów i gęstość, trafiają do wspólnej kolekcji, której tryby są ich kombinacjami; opcja występująca samodzielnie dostaje własną kolekcję.
- Ikony i obrazy.

Niektóre elementy jeszcze się nie przenoszą:

- Warstwy z innych plików, które dokument importuje.
- Warstwy skryptów, przeglądarki, shaderów, notatek i kontekstu.
- W przeglądarce: obrazy zapisane obok pliku. Aby je zachować, otwórz plik w aplikacji desktopowej.

## Dalsza praca z agentem AI

Agent, z którym projektujesz w pen.dev, może pracować także w OpenPencil:

- W aplikacji desktopowej użyj jako czatu AI [Claude Code, Codex, Cursor lub innego agenta programistycznego](./coding-agents), którego już masz.
- Możesz też połączyć agenta z [serwerem MCP](/developers/mcp-server) OpenPencil z jego własnego terminala lub edytora, a będzie edytować otwarty dokument.

Agenci edytują dokument, gdy jest otwarty, więc nie potrzebują pliku `.pen` na dysku.
