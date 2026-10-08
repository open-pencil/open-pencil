---
title: Eksport
description: Eksport zawartości dokumentu do PNG, JPG, WEBP, SVG, .fig, JSX, HTML lub historyjek Storybook i konwersja między formatami.
---

# Eksport

CLI eksportuje projekt do raster images, vector graphics, osobnych dokumentów `.fig`, JSX, HTML albo historyjek Storybook.

## Obrazy i .fig

```sh
openpencil export design.fig                           # PNG domyślnie
openpencil export design.fig -f jpg -s 2 -q 90        # JPG, skala 2×, jakość 90
openpencil export design.fig -f webp -s 3             # WEBP, skala 3×
openpencil export design.fig -f svg                   # SVG
openpencil export design.fig -f fig --page "Page 1"   # Jedna strona w osobnym .fig
openpencil export design.fig -f fig --node 1:23        # Jeden obiekt w osobnym .fig
openpencil export design.fig -f html --css tailwind    # Fragment HTML z klasami Tailwind
```

Opcje:

- `-f` — format: `png`, `jpg`, `webp`, `svg`, `jsx`, `html`, `fig` albo `storybook`;
- `-s` — skala od `1` do `4`;
- `-q` — jakość od `0` do `100`, tylko dla JPG i WEBP;
- `-o` — ścieżka pliku wynikowego;
- `--page` — nazwa strony;
- `--node` — ID obiektu.

## JSX

Aby otrzymać JSX z utility classes Tailwind:

```sh
openpencil export design.fig -f tailwind-jsx    # albo: -f jsx --style tailwind
```

Przykład wyniku:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Opcja `--style openpencil` wybiera własny format JSX OpenPencil. Więcej informacji znajduje się na stronie [JSX renderer](../jsx-renderer).

## HTML

Domyślnie polecenie tworzy fragment HTML z inline styles. Zamiast nich można użyć utility classes Tailwind:

```sh
openpencil export design.fig -f html
openpencil export design.fig -f html --css tailwind
```

Opcja `--html standalone` tworzy pełny dokument HTML, który można otworzyć w przeglądarce. Zawiera reset styles i wrapper strony. Format jest przeznaczony do przekazywania projektu i kodu, a nie do pełnego pixel-perfect odtworzenia renderer:

```sh
openpencil export design.fig -f html --html standalone --css inline
openpencil export design.fig -f html --html standalone --css tailwind
openpencil export design.fig -f html --html standalone --css tailwind --assets external
```

Podczas standalone export Tailwind CSS jest od razu kompilowany, więc browser runtime Tailwind nie jest potrzebny. `--assets external` zapisuje CSS i wyodrębnione obrazy obok HTML. W połączeniu z tą opcją `--fonts assets` wyszukuje fonts obiektów tekstowych SceneGraph przez skonfigurowanych web font providers i tworzy lokalne pliki `@font-face`.

Eksport HTML jest dostępny podczas pracy z plikiem.

## Eksport do Storybook

Polecenie generuje jeden plik CSF3 `.stories.ts` dla każdego zestawu komponentów lub komponentu:

```sh
openpencil export design.fig -f storybook                      # Historyjki React w ./design-stories/
openpencil export design.fig -f storybook --framework vue -o src/stories
openpencil export design.fig -f storybook --framework html --page "Components"
openpencil export design.pen -f storybook -o src/stories --watch  # Ponowny eksport po każdym zapisie
openpencil export 'src/**/*.pen' -f storybook --beside --watch    # Historyjki obok każdego projektu
```

### Projekty obok historyjek

Trzymaj plik projektu komponentu w folderze komponentu i eksportuj z `--beside`: historyjki każdego dokumentu, obrazy projektu i manifest `.openpencil-stories.json` trafiają do folderu tego dokumentu, obok kodu komponentu. Wzorzec `stories` w `.storybook/main.ts`, na przykład `../src/**/*.stories.ts`, znajdzie je bez dodatkowej konfiguracji.

Możesz podać kilka dokumentów albo ujęty w cudzysłów wzorzec, na przykład `'src/**/*.pen'`, który OpenPencil rozwija samodzielnie (Node.js 22 lub nowszy). Kilka dokumentów wymaga `--beside` albo `--output`, a `--page` działa tylko z jednym dokumentem. Dokumenty są eksportowane kolejno, a gdy któryś się nie powiedzie, pozostałe nadal są eksportowane, po czym polecenie kończy się błędem. `--watch` obserwuje każdy dopasowany dokument; dokument utworzony po uruchomieniu obserwacji wymaga ponownego uruchomienia polecenia.

Każdy wariant zestawu komponentów staje się historyjką, a jego właściwości wariantów — kontrolką `select`, więc zmiana kontrolki pokazuje odpowiedni wariant. Samodzielne komponenty nazwane z ukośnikami, takie jak `Button/Primary` i `Button/Secondary`, trafiają do jednego pliku `Button` z kontrolką `Variant`. Kombinacja, dla której projekt nie ma wariantu, zgłasza w Storybooku nazwany błąd zamiast pokazywać inny wariant.

Historyjki renderują komponent jako HTML z inline styles, tak jak `-f html`, więc nie potrzebują środowiska OpenPencil; `--framework` (`react`, `vue` lub `html`) zmienia tylko opakowanie oraz import `Meta`/`StoryObj` z `@storybook/react-vite`, `@storybook/vue3-vite` lub `@storybook/html-vite`. Tekst używa rodzin czcionek dokumentu, które Storybook musi wczytać sam. Właściwości tekstowe, logiczne i podmiany egzemplarza nie są jeszcze eksportowane.

Historyjki zawierają wpisy `parameters.design` dla [`@storybook/addon-designs`](https://github.com/storybookjs/addon-designs):

- **OpenPencil:** gdy ścieżka dokumentu leży w bieżącym katalogu, [odnośnik `openpencil://`](../index#url-scheme), który otwiera dokument w aplikacji na komputer i zaznacza wariant albo jego zestaw komponentów, gdy inna warstwa ma taką samą nazwę jak wariant. Schemat adresuje warstwy po nazwie, więc historyjka, której nazwy wariantu i komponentu są współdzielone z innymi warstwami, nie dostaje odnośnika.
- **Design:** obraz PNG wariantu w skali 2×, zapisany w `<Name>.design/` obok historyjki i wskazany przez `new URL(…, import.meta.url)`, dzięki czemu Vite go dołącza do paczki. Skopiuj ten parametr do historyjki własnego komponentu, aby porównać implementację z projektem. `--no-design-images` pomija renderowanie; podmiana czcionek podlega `--font-policy`, tak jak w eksporcie rastrowym.

`-o` wskazuje katalog wyjściowy. Znajdujący się tam manifest `.openpencil-stories.json` zapisuje, który dokument (jako ścieżkę względną względem katalogu wyjściowego) i która strona wygenerowały każdą historyjkę i obraz projektu; zatwierdzaj go razem z historyjkami. Eksport zastępuje pliki wygenerowane tam wcześniej z tego samego dokumentu, także dla komponentów usuniętych lub przemianowanych od tego czasu; z `--page` tylko pliki tej strony. Przed jakąkolwiek zmianą odmawia nadpisania każdego innego pliku — ręcznie napisanej historyjki, historyjki innego dokumentu lub zbłąkanego obrazu. Eksport jednej strony, w którym nazwy plików przesunęły się na historyjki innej strony, wymaga pełnego eksportu. Bez manifestu istniejące historyjki są traktowane jak cudze, więc usuń je przed ponownym eksportem. `--watch` utrzymuje działanie polecenia i ponawia eksport po każdym zapisie dokumentu, dzięki czemu gorące przeładowanie Storybooka podąża za projektem; zapis, którego nie da się odczytać, jest zgłaszany, a obserwacja trwa dalej. Brakująca strona z `--page` lub podmiana czcionki przy `--font-policy strict` nadal kończy polecenie.

## Thumbnail

```sh
openpencil export design.fig --thumbnail --width 1920 --height 1080
```

## Eksport z uruchomionej aplikacji

Nie podawaj pliku, aby eksportować z aplikacji:

```sh
openpencil export -f png                       # Zaznaczenie w aktywnym dokumencie
openpencil export --page "Components" -f png   # Wszystkie warstwy strony
openpencil export --node 1:23 -f png           # Jedna warstwa, na dowolnej stronie
```

`--page` przyjmuje nazwę strony, a `--page-id` identyfikator strony z `openpencil documents list`; oba eksportują tę stronę bez przełączania na nią aplikacji. Dodaj `--document-id`, aby eksportować z dokumentu innego niż aktywny.

Tryb aplikacji obsługuje PNG, JPG, WEBP, SVG i PDF. PowerPoint, JSX, HTML, Storybook i `.fig` wymagają podania pliku. Eksport miniatury z pliku nie jest obecnie obsługiwany.
