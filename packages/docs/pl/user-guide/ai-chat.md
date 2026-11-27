---
pageClass: guide
title: Czat AI
description: Poproś AI o tworzenie i zmienianie projektów, cofaj jego zmiany, zamawiaj recenzje i ucz je za pomocą umiejętności.
---

# Czat AI

Opisz, czego chcesz, a AI zrobi to na płótnie: ekran, komponent, zmianę każdego przycisku na stronie. Naciśnij <Keys mac="⌘ J" other="Ctrl J" />, aby otworzyć czat, albo kliknij kartę **AI** obok **Design**.

## Konfigurowanie AI

Za pierwszym razem konfiguracja z przewodnikiem pyta, w czym AI ma ci pomagać i z czego już korzystasz:

- z [agenta programistycznego](./coding-agents), którego masz, na przykład Claude Code lub Codex, w aplikacji desktopowej;
- z konta u dostawcy AI, takiego jak OpenRouter, Anthropic, OpenAI lub Google, albo z planu ChatGPT;
- z modelu działającego na twoim komputerze lub na serwerze firmy;
- z konta [OpenPencil Cloud](/cloud/ai).

Strona [Modele i dostawcy](./models-and-providers) opisuje, czego potrzebuje każda z tych opcji. Aby ponownie uruchomić konfigurację, otwórz **Ustawienia → Modele → Uruchom konfigurację z przewodnikiem**.

AI używa osobnego modelu do każdego rodzaju pracy. Możesz go zmienić w menu modelu pod polem wiadomości, w **Zarządzaj modelami i rolami…**:

| Rola | Co robi |
| ---- | ---- |
| **Agent projektowy** | Sam czat. |
| **Wizja** | Odczytuje dołączone obrazy. |
| **Recenzja** | Pisze [recenzje projektu](#prosba-o-recenzje). Używa agenta projektowego, chyba że wybierzesz inny model. |
| **Szybkie zadania** | Nadaje nazwy rozmowom, a jeśli to model API, pisze też podsumowania długich rozmów; w przeciwnym razie pisze je agent projektowy. Pi nie nadaje nazw rozmowom. Bez modelu, który to robi, rozmowa dostaje za nazwę swoją pierwszą wiadomość. |

## Prośba o projekt

Wpisz, czego chcesz, i naciśnij <Keys mac="Enter" other="Enter" />. AI widzi, które warstwy są zaznaczone, więc przed prośbą o zmianę zaznacz to, o co ci chodzi.

<GuideImage name="ai-chat/reply" alt="Czat AI obok płótna: prośba o kartę podróży, zmiana wprowadzona przez AI, jego odpowiedź i nowa karta na płótnie" />

- Wpisz **@**, aby wskazać warstwę, stronę lub umiejętność. Wskazane warstwy pojawiają się jako plakietki; kliknij jedną, aby znaleźć warstwę na płótnie. Przycisk ze strzałką kursora wskazuje zaznaczone warstwy.
- Dołączaj obrazy, na przykład szkic lub stronę, która ci się podoba, przyciskiem obrazu. Wymaga to modelu z funkcją Wizja.
- Każda zmiana wprowadzona przez AI jest widoczna w jego odpowiedzi. Kliknij ją, aby zobaczyć, co zrobiło.

Kilka rzeczy do wypróbowania:

- „Zrób kartę z tytułem, opisem i niebieskim przyciskiem.”
- „Ustaw wszystkim przyciskom na tej stronie ten sam promień narożnika.”
- „Zamień tło tej ramki w gradient od niebieskiego do fioletowego.”
- „Zrób z tego komponentu przełącznik, który mogę wypróbować w podglądzie.”

Jeśli model odczytuje obrazy, AI sprawdza swoją pracę, oglądając obraz tego, co zrobiło, więc może poprawić to, co mu nie wyszło.

## Gdy AI pracuje

- Pracuj dalej: AI zostaje na stronie, na której zaczęła się wiadomość. Czat pokazuje, gdzie pracuje, a **Przejdź do strony** zabiera cię z powrotem.
- Aby je obserwować, włącz **Śledź agentów podczas pracy**, przycisk z celownikiem u góry czatu. Twój widok podąża za AI, także na inną stronę. Kliknięcie, przewinięcie albo <Keys mac="Esc" other="Esc" /> kończy śledzenie.
- Wpisz kolejną wiadomość i naciśnij <Keys mac="Enter" other="Enter" />, aby wysłać ją po zakończeniu bieżącego kroku, tak by AI mogło zmienić kierunek. <Keys mac="⌥ Enter" other="Alt Enter" /> czeka, aż AI skończy wszystko. Oczekujące wiadomości są widoczne przygaszone pod odpowiedzią.
- **Zatrzymaj generowanie** kończy odpowiedź. Zmiana, która jest właśnie wprowadzana, zostanie dokończona; następna wiadomość powie AI, co się zmieniło.

**Maksymalna liczba kroków na wiadomość**, w sekcji **Czat** w **Ustawienia → Modele**, ogranicza, jak długo może pracować jedna odpowiedź wbudowanego AI: 50 kroków, chyba że to zmienisz. Agenci programistyczni mają własne limity. Gdy odpowiedź dojdzie do limitu, **Kontynuuj** pozwala iść dalej.

## Cofanie zmian AI

Każda zmiana wprowadzona przez AI to jeden krok <Keys mac="⌘ Z" other="Ctrl Z" />, a czat oznacza cofnięte zmiany.

- **Cofnij zmiany** pod odpowiedzią cofa wszystkie jej zmiany, a **Przywróć zmiany** je przywraca.
- **Cofnij i wygeneruj ponownie** cofa je i pyta jeszcze raz.

Twoja następna wiadomość powie AI, co cofnąłeś, żeby nie budowało na zmianach, których już nie ma.

## Prośba o recenzję

Wpisz **/review**, aby model recenzji obejrzał zaznaczenie, a gdy nic nie jest zaznaczone, całą stronę, tak jak zrobiłby to dyrektor artystyczny: wyrównanie, odstępy, kontrast, hierarchię i wszystko, co wygląda na zepsute.

- Dopisz, na co zwrócić uwagę, na przykład `/review typography`.
- Dołącz obrazy do porównania, na przykład zrzut ekranu strony, którą podziwiasz. Wymaga to modelu, który odczytuje obrazy.
- Pod zmianą wprowadzoną przez AI **Zrecenzuj tę zmianę** pyta, czy poprawiła projekt.

Recenzja pojawia się jako karta, a każda uwaga prowadzi do swojej warstwy. **Popraw** wysyła uwagi do AI jako twoją wiadomość.

## Uczenie AI za pomocą umiejętności

Umiejętność to zestaw instrukcji do określonego rodzaju pracy, na przykład zasad marki twojego zespołu, w formacie [Agent Skills](https://agentskills.io/specification): folder z plikiem `SKILL.md` i wszelkimi plikami, do których się odwołuje. AI czyta umiejętność, gdy prośba jej wymaga. Aby samemu jej użyć, wpisz **/** i wybierz ją.

Umiejętności dodasz w **Ustawienia → Umiejętności**:

- **Prześlij umiejętność**: archiwum ZIP z folderem umiejętności albo pojedynczy plik `SKILL.md`.
- W aplikacji desktopowej znajdowane są też umiejętności w folderach `.agents/skills` i `.claude/skills` obok otwartego pliku. Pozostają wyłączone, dopóki nie wybierzesz **Zaufaj folderowi**, bo umiejętność przekazuje AI instrukcje.
- Umiejętności zainstalowane przez innych agentów programistycznych, w `~/.agents/skills` i `~/.claude/skills`, są na liście wyłączone. Włącz te, które pomagają w projektowaniu.

Agenci programistyczni, tacy jak Claude Code, wczytują własne umiejętności.

## Długie rozmowy

AI może przeczytać naraz tylko określoną część rozmowy. Wskaźnik u góry czatu pokazuje, na ile jest ona zapełniona; kliknij go, aby zobaczyć szczegóły.

Gdy rozmowa jest prawie pełna, AI ją kompaktuje: pisze podsumowanie, które zastępuje starsze wiadomości, a te nadal możesz przeczytać. **Kompaktuj automatycznie**, w sekcji **Czat** w **Ustawienia → Modele**, robi to w razie potrzeby. Wpisz **/compact**, aby zrobić to od razu, razem z tym, co zachować, na przykład `/compact keep the color decisions`.

**Historia czatów**, w lewym górnym rogu czatu, otwiera wcześniejsze rozmowy zapisane na tym komputerze. **Nowy czat** zaczyna od nowa.

## Wybieranie, co AI może robić

**Ustawienia → Dostęp do narzędzi** pokazuje narzędzia, których AI może używać, na przykład do zmieniania warstw, eksportowania lub uruchamiania skryptów. Wyłącz narzędzia lub całe grupy, aby AI z nich nie korzystało. Zmiana obowiązuje od następnej wiadomości. Narzędzie skryptów nadal może zrobić to, co robią wyłączone narzędzia, więc te przełączniki nie są piaskownicą.

Karta **Local MCP** ustawia narzędzia dla [agentów programistycznych i innych klientów MCP](/developers/mcp-server).

## Zmienianie instrukcji AI

::: v-pre

**Ustawienia → Prompty** zawierają to, co OpenPencil mówi AI:

- **Agent projektowy**: twoje instrukcje dla czatu, dodawane po instrukcjach OpenPencil. **Zastąp instrukcje OpenPencil** używa zamiast nich twoich; bez instrukcji OpenPencil AI może słabo korzystać ze swoich narzędzi.
- **Recenzja**, **Tytuły czatów** i **Podsumowania kompaktowania**: prompty do tych zadań. To szablony [Knap](https://knap.md), w których `{{ focus }}` wstawia wartość. Edytor zaznacza błędy i pokazuje podgląd wyniku.

:::

**Przywróć domyślne** przywraca instrukcje OpenPencil.

## Łączenie innych narzędzi {#external-mcp-connections}

W aplikacji desktopowej agenci programistyczni mogą też korzystać z innych serwerów [MCP](https://modelcontextprotocol.io/), na przykład z twojego systemu zgłoszeń. W **Ustawienia → MCP**, w sekcji **Połączenia MCP**, dodaj adres serwera i, jeśli jest wymagany, jego token, a następnie włącz połączenie: agenci nie dostają wyłączonych połączeń. Dodawaj tylko serwery, którym ufasz: ich narzędzia działają z dostępem, który im dajesz.

## Powiadomienia

Gdy AI prosi o pozwolenie, a ty nie odpowiesz w ciągu kilku sekund, OpenPencil wysyła powiadomienie, więc w międzyczasie możesz pracować w innej aplikacji. **Ustawienia → Powiadomienia** mogą też powiadamiać cię o zakończeniu odpowiedzi. W przeglądarce najpierw kliknij tam **Zezwól na powiadomienia**.
