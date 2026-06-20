---
title: Serwer MCP
description: Łączenie narzędzi AI do kodowania z OpenPencil umożliwiające inspekcję i edycję projektów za pomocą protokołu Model Context Protocol.
---

# Serwer MCP

OpenPencil dostarcza serwer MCP, który pozwala narzędziom AI do kodowania — Claude Code, Cursor, Windsurf itp. — odczytywać i modyfikować projekty w uruchomionej aplikacji. Dwa pliki binarne:

- **`openpencil-mcp`** — transport stdio dla klientów MCP
- **`openpencil-mcp-http`** — serwer HTTP + WebSocket dla przeglądarek, skryptów i wewnętrznego mostu aplikacji

## Wymagania wstępne

Przed podłączeniem jakiegokolwiek klienta upewnij się, że:

1. Aplikacja desktopowa OpenPencil jest uruchomiona **z otwartym dokumentem**. Serwer MCP jest bezużyteczny bez połączenia z aplikacją — jest mostem, a nie rendererem.
2. Wersja pakietu MCP odpowiada wersji aplikacji. Endpoint `/health` zgłasza wersje, dzięki czemu klienci mogą wykryć niezgodności.

Serwer MCP uruchamia się automatycznie po uruchomieniu aplikacji desktopowej (wersje produkcyjne Tauri uruchamiają `openpencil-mcp-http`; tryb deweloperski używa wtyczki Vite). Można go również uruchomić samodzielnie.

## Architektura

```text
  MCP Client          MCP Server              OpenPencil App
  (Claude Code,       (openpencil-mcp-http)   (desktop / browser)
   Cursor, etc.)
                      ┌──────────────┐
  stdio ◄───────────► │  /rpc (HTTP) │ ◄──── JSON-RPC ─────► Stdio bridge
                      │              │
                      │  /    (WS)   │ ◄──── WebSocket ────► Browser tab
  (openpencil-mcp)    │              │
                      │  /mcp (HTTP) │ ◄── Streamable HTTP ──► External tools
                      │              │
                      │  /health     │
                      └──────┬───────┘
                             │
                    socket or TCP (127.0.0.1)
```

Most stdio (`openpencil-mcp`) łączy się z serwerem HTTP przez gniazdo domeny Unix (na macOS/Linux) lub przez port HTTP z pliku odkrywania (`httpPort`, w systemie Windows lub konfiguracjach bez gniazda). **Nie** komunikuje się bezpośrednio MCP z aplikacją — tuneluje wywołania narzędzi MCP przez HTTP do serwera, który przekazuje je do uruchomionej aplikacji przez WebSocket.

## Jak działa połączenie

Serwer zapisuje **plik odkrywania** przy uruchomieniu. Most stdio odczytuje ten plik, aby znaleźć serwer. Nie jest wymagana ręczna konfiguracja.

### Lokalizacja pliku odkrywania

| Platforma | Ścieżka |
|-----------|---------|
| macOS | `~/Library/Application Support/OpenPencil/mcp.json` |
| Linux | `$XDG_RUNTIME_DIR/openpencil/mcp.json` (alternatywa: `~/.openpencil/mcp.json`) |
| Windows | `%LOCALAPPDATA%\OpenPencil\mcp.json` |

`OPENPENCIL_MCP_SOCKET` nadpisuje jedynie ścieżkę gniazda. Domyślnie plik odkrywania pozostaje na ścieżce platformy podanej powyżej, chyba że ustawiono `OPENPENCIL_MCP_DISCOVERY_PATH`.

### Zawartość pliku odkrywania

```json
{
  "pid": 12345,
  "socketPath": "~/Library/Application Support/OpenPencil/mcp.sock",
  "httpPort": 7600,
  "authRequired": true,
  "authToken": "a1b2c3...32-hex-chars",
  "version": "0.13.2",
  "startedAt": "2026-06-01T12:00:00.000Z"
}
```

Plik odkrywania jest zapisywany z uprawnieniami `0o600` (tylko odczyt/zapis dla właściciela). Zapobiega to innym użytkownikom systemu odczytaniu tokenu uwierzytelniającego, ale każdy proces działający jako **Twój użytkownik** może go odczytać. Dlatego gniazdo jest preferowane zamiast TCP — uprawnienia pliku gniazda stanowią dodatkową granicę dostępu w systemie Unix.

### Wybór transportu

| Platforma | Podstawowy | Alternatywny |
|-----------|------------|--------------|
| macOS / Linux | Gniazdo domeny Unix | TCP na `127.0.0.1:7600` |
| Windows | TCP na `127.0.0.1:7600` | — |

Most stdio preferuje gniazdo. Jeśli serwer został uruchomiony tylko z TCP (bez gniazda), most przełącza się na `httpPort` z pliku odkrywania.

## Instalacja

```sh
npm install -g @open-pencil/mcp
```

## Stdio (Claude Code, Cursor itp.)

Most stdio automatycznie odkrywa uruchomiony serwer MCP za pomocą pliku odkrywania. Nie jest wymagana konfiguracja ścieżki gniazda ani portu — wystarczy upewnić się, że aplikacja jest otwarta.

### Claude Code

```sh
npm install -g @open-pencil/mcp
claude mcp add --scope user open-pencil -- openpencil-mcp
```

Weryfikacja:

```sh
claude mcp list
```

Claude Code pyta przed użyciem każdego narzędzia MCP. Aby automatycznie zatwierdzać narzędzia OpenPencil, dodaj do `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__open-pencil__*"]
  }
}
```

Przykładowy prompt:

```text
Use the open-pencil MCP server to inspect the current page and create a small hero section on the canvas.
```

### Inni klienci MCP

Dodaj do konfiguracji MCP (np. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Uruchomienie ze źródeł bez instalacji:

::: code-group

```json [Bun]
{
  "mcpServers": {
    "open-pencil": {
      "command": "bun",
      "args": ["/path/to/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
```json [Node.js]
{
  "mcpServers": {
    "open-pencil": {
      "command": "npx",
      "args": ["tsx", "/path/to/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
:::

## HTTP

Dla rozszerzeń przeglądarki, skryptów, CI lub dowolnego klienta HTTP:

```sh
openpencil-mcp-http
```

Lub ze źródeł: `bun packages/mcp/src/index.ts` / `npx tsx packages/mcp/src/index.ts`

### Endpointy

| Endpoint | Metoda | Uwierzytelnienie | Opis |
|----------|--------|-------------------|------|
| `/health` | GET | Nie | Status serwera, wersja, komenda instalacyjna, ścieżka odkrywania |
| `/rpc` | POST | Bearer token | Most JSON-RPC do uruchomionej aplikacji |
| `/mcp` | POST, DELETE | Bearer token lub nagłówek `x-mcp-token` | MCP Streamable HTTP. Sesje poprzez nagłówek `mcp-session-id`. DELETE zamyka sesję |

Uwaga: Endpoint `/mcp` używa wyłącznie transportu Streamable HTTP. Starszy transport SSE nie jest obsługiwany.

### Uwierzytelnianie

Token uwierzytelniający jest **automatycznie generowany przy uruchomieniu** (32-heksadowy losowy z `crypto.randomBytes`). Klienci muszą go wysłać jako `Authorization: Bearer <token>` dla endpointów `/rpc` i `/mcp`. Porównanie tokenów używa porównania stałoczasowego (`crypto.timingSafeEqual`) w celu zapobiegania atakom czasowym.

| Scenariusz | Skąd pochodzi token |
|------------|---------------------|
| Most stdio (`openpencil-mcp`) | Odczytuje `authToken` z pliku odkrywania automatycznie |
| Wewnętrzny aplikacji (Tauri/przeglądarka) | Odczytuje plik odkrywania poprzez `/health` → `discoveryPath` |
| Niestandardowy klient HTTP | Ustaw `OPENPENCIL_MCP_AUTH_TOKEN` na serwerze i kliencie lub odczytaj plik odkrywania |

Aby **całkowicie wyłączyć** uwierzytelnianie (np. lokalny rozwój za zaporą sieciową), ustaw `OPENPENCIL_MCP_AUTH_TOKEN=""` przed uruchomieniem serwera:

```sh
OPENPENCIL_MCP_AUTH_TOKEN="" openpencil-mcp-http
```

### Zmienne środowiskowe

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `PORT` | `7600` | Port TCP. Ustaw `0`, aby wyłączyć TCP (tylko gniazdo na macOS/Linux). ⚠️ W systemie Windows `PORT=0` wyłącza jedyny dostępny transport, przez co serwer staje się nieosiągalny. |
| `OPENPENCIL_MCP_SOCKET` | Domyślna dla platformy | Nadpisuje ścieżkę gniazda (tylko macOS/Linux — Windows nie obsługuje gniazd Unix) |
| `OPENPENCIL_MCP_DISCOVERY_PATH` | Domyślna dla platformy | Nadpisuje lokalizację pliku odkrywania (`mcp.json`) |
| `OPENPENCIL_MCP_TCP` | Przestarzała | Brak efektu — TCP jest kontrolowane przez `PORT` (>0 = włączone, 0 = wyłączone) |
| `OPENPENCIL_MCP_AUTH_TOKEN` | Automatycznie generowany | Token uwierzytelniający serwera. Jeśli nieustawiony, jest generowany przy uruchomieniu. Jeśli ustawiony na pusty ciąg (`""`), uwierzytelnianie jest wyłączone. |
| `OPENPENCIL_MCP_ROOT` | `cwd()` | Zakres katalogu dla narzędzi `open_file`, `new_document` i eksportu zapisującego pliki. `save_file` jest zawsze dostępne; ścieżka jest walidowana względem tego katalogu, gdy jest ustawiony |
| `OPENPENCIL_MCP_EVAL` | Wyłączone | Ustaw `1`, aby włączyć narzędzie `eval` (tylko stdio, nigdy HTTP) |
| `OPENPENCIL_MCP_CORS_ORIGIN` | Wyłączone | Dozwolone źródło CORS dla dostępu z przeglądarki |

### Domyślne ustawienia bezpieczeństwa

- Wiąże się z `127.0.0.1` — nie jest eksponowany do sieci
- Narzędzie `eval` jest domyślnie wyłączone; dostępne tylko przez stdio, nigdy przez HTTP
- Operacje plikowe ograniczone do `OPENPENCIL_MCP_ROOT` — dowiązania symboliczne są rozwiązywane w celu zapobiegania traversalu ścieżek
- CORS jest domyślnie wyłączony
- Uprawnienia pliku gniazda `0o600` w systemie Unix — ogranicza dostęp do Twojego użytkownika
- Uprawnienia pliku odkrywania `0o600` — takie samo ograniczenie

**Znane ograniczenie:** W systemie Unix istnieje krótkie okno między `listen()` a `chmod(0o600)`, w którym gniazdo ma domyślne uprawnienia. Token uwierzytelniający łagodzi to ryzyko — nawet jeśli inny proces połączy się w tym oknie, nadal potrzebuje tokenu. Nie istnieje łagodzenie, gdy uwierzytelnianie jest wyłączone (`OPENPENCIL_MCP_AUTH_TOKEN=""`) na współdzielonych maszynach.

## Rozwiązywanie problemów

### "OpenPencil app is not connected"

Serwer MCP działa, ale żadna karta przeglądarki nie jest z nim połączona. **Otwórz aplikację desktopową OpenPencil** (lub przejdź do adresu URL aplikacji w przeglądarce) i upewnij się, że dokument jest załadowany. Aplikacja łączy się z serwerem przez WebSocket po otwarciu.

### "Port 7600 already in use"

Inna instancja OpenPencil (lub inny proces) używa portu 7600. Można:

- Zamknąć drugą instancję
- Ustawić `PORT=7601` (lub dowolny wolny port) przed uruchomieniem
- Ustawić `PORT=0`, aby całkowicie wyłączyć TCP i używać transportu tylko przez gniazdo

### Błędy "Stale socket" na macOS/Linux

Jeśli aplikacja ulegnie awarii bez czystego zamknięcia, plik gniazda może pozostać. Serwer czyści nieaktualne gniazda przy uruchomieniu (sprawdza, czy gniazdo jest aktywne przed usunięciem). Jeśli czyszczenie nie powiedzie się:

```sh
rm ~/Library/Application\ Support/OpenPencil/mcp.sock
```

### Niezgodność wersji

Endpoint `/health` zwraca `version` serwera. Aplikacja sprawdza to przy połączeniu i ostrzega, jeśli wersje się nie zgadzają. Napraw, aktualizując pakiet globalny:

```sh
npm install -g @open-pencil/mcp@latest
```

### Most stdio nie może znaleźć serwera

Most odczytuje plik odkrywania, aby zlokalizować serwer. Jeśli plik odkrywania brakuje lub jest nieaktualny (PID nie jest już aktywny):

1. Sprawdź, czy plik odkrywania istnieje na ścieżce platformy podanej powyżej
2. Jeśli TCP jest włączone (`PORT` nie jest `0`), zweryfikuj, że serwer działa: `curl http://127.0.0.1:${PORT:-7600}/health`
3. W systemie Windows (transport wyłącznie TCP, brak obsługi gniazd Unix), zweryfikuj, że `httpPort` serwera jest osiągalny. Ustawienie `PORT=0` na Windows wyłącza jedyny dostępny transport

## Przepływ pracy

1. **Otwórz** — `open_file` aby załadować istniejący plik `.fig`, lub `new_document` dla pustej kanwy
2. **Odczytaj** — `get_page_tree`, `find_nodes`, `get_node`, `list_pages`
3. **Utwórz** — `create_shape`, `render` (JSX)
4. **Modyfikuj** — `set_fill`, `set_stroke`, `set_layout`, `update_node`, `set_effects`
5. **Strukturyzuj** — `reparent_node`, `group_nodes`, `clone_node`, `delete_node`
6. **Zapisz** — `save_file` aby zapisać z powrotem do `.fig`

## Umiejętność agenta AI

Naucz swojego agenta AI do kodowania korzystania z narzędzi OpenPencil:

```sh
npx skills add open-pencil/skills@open-pencil
```

Działa z Claude Code, Cursor, Windsurf, Codex i każdym agentem obsługującym [skills](https://skills.sh). Umiejętność obejmuje CLI, narzędzia MCP, renderowanie JSX, eval oraz most automatyzacji uruchomionej aplikacji.

## Narzędzia (90)

### Dokument

| Narzędzie | Opis |
|-----------|------|
| `open_file` | Otwórz plik `.fig` do edycji |
| `save_file` | Zapisz bieżący dokument do pliku `.fig` |
| `new_document` | Utwórz nowy pusty dokument |

Uwaga: `open_file`, `new_document` oraz narzędzia eksportu zapisujące pliki są zawsze dostępne — ich ścieżki są ograniczone do `OPENPENCIL_MCP_ROOT`, które domyślnie przyjmuje bieżący katalog roboczy (`cwd()`) gdy nie jest ustawione. `save_file` jest zawsze dostępne; jego ścieżka jest walidowana względem `OPENPENCIL_MCP_ROOT` tylko gdy katalog główny jest skonfigurowany.

### Odczyt

| Narzędzie | Opis |
|-----------|------|
| `get_selection` | Pobierz aktualnie zaznaczone węzły |
| `get_page_tree` | Pobierz pełne drzewo węzłów bieżącej strony |
| `get_current_page` | Pobierz nazwę i ID bieżącej strony |
| `get_node` | Pobierz szczegółowe właściwości węzła po ID |
| `find_nodes` | Znajdź węzły według wzorca nazwy i/lub typu |
| `get_components` | Lista wszystkich komponentów w dokumencie |
| `list_pages` | Lista wszystkich stron |
| `list_variables` | Lista zmiennych projektowych |
| `list_collections` | Lista kolekcji zmiennych |
| `list_fonts` | Lista czcionek używanych na bieżącej stronie |
| `page_bounds` | Pobierz obszar ograniczający wszystkich obiektów na bieżącej stronie |
| `node_bounds` | Pobierz obszar ograniczający węzła |
| `node_ancestors` | Pobierz łańcuch przodków węzła |
| `node_children` | Pobierz bezpośrednie dzieci węzła |
| `node_tree` | Pobierz poddrzewo zakorzenione w węźle |
| `node_bindings` | Pobierz powiązania zmiennych w węźle |

### Tworzenie

| Narzędzie | Opis |
|-----------|------|
| `create_shape` | Utwórz kształt (`FRAME`, `RECTANGLE`, `ELLIPSE`, `TEXT`, `LINE`, `STAR`, `POLYGON`, `SECTION`) |
| `create_vector` | Utwórz węzeł wektorowy z ciągu ścieżki |
| `create_slice` | Utwórz wycinek eksportu |
| `create_page` | Utwórz nową stronę |
| `render` | Renderuj JSX do węzłów projektowych — twórz całe drzewa komponentów w jednym wywołaniu |
| `create_component` | Konwertuj ramkę/grupę na komponent |
| `create_instance` | Utwórz instancję komponentu |
| `node_to_component` | Konwertuj istniejący węzeł na komponent w miejscu |

### Modyfikacja

| Narzędzie | Opis |
|-----------|------|
| `set_fill` | Ustaw kolor wypełnienia (hex) |
| `set_stroke` | Ustaw kolor obrysu, grubość, wyrównanie |
| `set_effects` | Dodaj efekty cienia lub rozmycia |
| `update_node` | Aktualizuj pozycję, rozmiar, krycie, promień narożnika, tekst, czcionkę |
| `set_layout` | Ustaw auto-layout (flexbox) — kierunek, odstępy, padding, wyrównanie |
| `set_constraints` | Ustaw ograniczenia zmiany rozmiaru |
| `set_rotation` | Ustaw kąt obrotu w stopniach |
| `set_opacity` | Ustaw krycie (0–1) |
| `set_radius` | Ustaw promień narożnika (jednolity lub per-narożnik) |
| `set_minmax` | Ustaw ograniczenia minimalnej/maksymalnej szerokości i wysokości |
| `set_text` | Ustaw zawartość tekstową węzła `TEXT` |
| `set_font` | Ustaw rodzinę i wagę czcionki |
| `set_font_range` | Ustaw właściwości czcionki w zakresie znaków |
| `set_text_resize` | Ustaw tryb automatycznej zmiany rozmiaru tekstu (stały/auto-szerokość/auto-wysokość) |
| `set_visible` | Pokaż lub ukryj węzeł |
| `set_blend` | Ustaw tryb mieszania |
| `set_locked` | Zablokuj lub odblokuj węzeł |
| `set_stroke_align` | Ustaw wyrównanie obrysu (wewnątrz/środek/zewnątrz) |
| `set_text_properties` | Ustaw układ tekstu: wyrównanie, automatyczna zmiana rozmiaru, wielkość liter, dekoracja, obcinanie |
| `set_layout_child` | Konfiguruj dziecko auto-layout: rozmiarowanie, grow, wyrównanie, pozycjonowanie absolutne |
| `node_move` | Przenieś węzeł na nową pozycję |
| `node_resize` | Zmień rozmiar węzła |
| `node_replace_with` | Zastąp węzeł innym węzłem |
| `arrange` | Wyrównaj lub rozdziel zaznaczone węzły |

### Struktura

| Narzędzie | Opis |
|-----------|------|
| `delete_node` | Usuń węzeł |
| `clone_node` | Duplikuj węzeł |
| `rename_node` | Zmień nazwę węzła |
| `reparent_node` | Przenieś węzeł do innego rodzica |
| `select_nodes` | Zaznacz węzły po ID |
| `group_nodes` | Grupuj węzły |
| `ungroup_node` | Rozgrupuj grupę |
| `flatten_nodes` | Spłaszcz węzły do pojedynczego wektora |
| `boolean_union` | Suma logiczna dwóch lub więcej węzłów |
| `boolean_subtract` | Odejmowanie logiczne |
| `boolean_intersect` | Część wspólna logiczna |
| `boolean_exclude` | Wykluczenie logiczne |

### Ścieżka wektorowa

| Narzędzie | Opis |
|-----------|------|
| `path_get` | Pobierz dane ścieżki węzła wektorowego |
| `path_set` | Ustaw dane ścieżki węzła wektorowego |
| `path_scale` | Skaluj ścieżkę wektorową |
| `path_flip` | Odbij ścieżkę wektorową poziomo lub pionowo |
| `path_move` | Przesuń ścieżkę wektorową |

### Eksport

| Narzędzie | Opis |
|-----------|------|
| `export_image` | Eksportuj węzły jako PNG, JPG lub WEBP. Zwraca dane obrazu zakodowane w base64 |
| `export_svg` | Eksportuj węzły jako znaczniki SVG |

### Viewport

| Narzędzie | Opis |
|-----------|------|
| `viewport_get` | Pobierz bieżącą pozycję i poziom przybliżenia viewportu |
| `viewport_set` | Ustaw pozycję i przybliżenie viewportu |
| `viewport_zoom_to_fit` | Dopasuj przybliżenie viewportu do określonych węzłów |

### Zmienne

| Narzędzie | Opis |
|-----------|------|
| `get_variable` | Pobierz zmienną po ID lub nazwie |
| `find_variables` | Znajdź zmienne według wzorca nazwy lub typu |
| `create_variable` | Utwórz nową zmienną w kolekcji |
| `set_variable` | Ustaw wartość zmiennej w trybie |
| `delete_variable` | Usuń zmienną |
| `bind_variable` | Powiąż zmienną z właściwością węzła |
| `get_collection` | Pobierz kolekcję zmiennych po ID lub nazwie |
| `create_collection` | Utwórz nową kolekcję zmiennych |
| `delete_collection` | Usuń kolekcję zmiennych |

### Analiza

| Narzędzie | Opis |
|-----------|------|
| `analyze_colors` | Analizuj użycie palety kolorów w dokumencie |
| `analyze_typography` | Analizuj rozkład czcionek/rozmiarów/wag |
| `analyze_spacing` | Analizuj wartości odstępów i paddingu |
| `analyze_clusters` | Wykrywaj powtarzające się wzorce (potencjalne komponenty) |

### Diff

| Narzędzie | Opis |
|-----------|------|
| `diff_create` | Utwórz migawkę bieżącego stanu dokumentu |
| `diff_show` | Pokaż różnice między bieżącym stanem a migawką |

### Nawigacja

| Narzędzie | Opis |
|-----------|------|
| `switch_page` | Przełącz na stronę po nazwie lub ID |

### Klapka ratunkowa

| Narzędzie | Opis |
|-----------|------|
| `eval` | Wykonaj JavaScript z pełnym dostępem do Figma Plugin API |

Uwaga: `eval` jest dostępny przez stdio, ale wyłączony w trybie HTTP ze względów bezpieczeństwa.
