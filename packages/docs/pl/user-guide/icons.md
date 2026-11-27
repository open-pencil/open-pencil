---
pageClass: guide
title: Ikony
description: Wyszukuj ikony w zestawach open source i SF Symbols, wstawiaj je, a potem zamieniaj, przekolorowuj i zmieniaj ich styl w OpenPencil.
---

# Ikony

OpenPencil przeszukuje zestawy ikon open source publikowane przez [Iconify](https://iconify.design), takie jak Lucide, Material Symbols, Tabler czy Phosphor, a w aplikacji na Maca także SF Symbols od Apple. Wstawiona ikona pamięta, którą ikoną jest, więc możesz ją później zamienić na inną albo zmienić jej kolor, a eksport zapisuje ją jako tę ikonę.

Wyszukiwanie i wstawianie ikon wymaga połączenia z API Iconify.

## Wstawianie ikony

Otwórz wybór ikon na jeden z tych sposobów:

- Kliknij **Wstaw ikonę** na końcu paska narzędzi.
- Wybierz **Obiekt → Wstaw ikonę…**.
- Wyszukaj **Wstaw ikonę** w palecie poleceń, <Keys mac="⌘ K" other="Ctrl K" />.

Zanim zaczniesz pisać, okno pokazuje ikony użyte już w tym pliku i te, które wybierałeś ostatnio. Wpisz, czego szukasz, na przykład `arrow` albo `heart`, aby przeszukać wszystkie zestawy. Najedź na ikonę, aby zobaczyć jej nazwę i zestaw.

Wybierz ikonę, a pojawi się w rozmiarze 24 × 24 na środku widoku, wewnątrz ramki, którą edytujesz, jeśli do jakiejś wszedłeś. Nowa ikona jest zaznaczona, a <Keys mac="⌘ Z" other="Ctrl Z" /> usuwa ją w jednym kroku.

<GuideImage name="icons/picker" alt="Okno wyboru ikon z wynikami wyszukiwania heart z kilku zestawów ikon" />

## Wybieranie zestawu ikon

Przycisk zestawu na końcu pola wyszukiwania (na początku **Wszystkie zestawy ikon**) zawęża wybór do jednego zestawu. Zestawy są pogrupowane według rodzaju, na przykład Material albo Logos; wpisz nazwę, na przykład `tabler`, aby znaleźć konkretny. Przy każdym zestawie widać, ile ma ikon.

Po wybraniu zestawu okno pokazuje go w całości i doczytuje kolejne ikony podczas przewijania, a wyszukiwanie obejmuje tylko ten zestaw. Najedź na ikonę albo przejdź do niej strzałkami, aby pod siatką zobaczyć jej nazwę, zestaw i licencję. Okno pamięta ostatnio wybrany zestaw, a **Zamień ikonę** otwiera się na zestawie ikony, którą zamieniasz.

## Zamiana i przekolorowanie ikony

Po zaznaczeniu wstawionej ikony w panelu **Design** pojawia się sekcja **Ikona**.

- **Zamień ikonę** otwiera okno wyboru i rysuje wybraną ikonę w miejscu obecnej. Ikona zachowuje rozmiar, położenie i kolor.
- **Kolor ikony** zmienia kolor ścieżek samej ikony. Ikony narysowane w kilku stałych kolorach, na przykład logotypy marek, zachowują te kolory i nie mają tego pola.

- **Opcje** pojawiają się przy ikonach z Material Symbols i SF Symbols, które OpenPencil rysuje sam; zobacz niżej. Zmiana opcji rysuje ikonę od nowa.

Każda zamiana, zmiana koloru czy opcji to jeden krok cofania; przeciąganie w próbniku kolorów cofa się jako jedna zmiana.

Ikona to ramka ze ścieżek wektorowych, nazwana tak jak ikona, na przykład `cat`, i oznaczona w drzewie warstw uśmiechniętą buźką. W przeciwieństwie do innych ramek na stronie nie ma tytułu na płótnie, a zmiana jej rozmiaru skaluje ścieżki. Jej warstwy, ograniczenia, efekty i reszta panelu **Design** działają tak samo jak w każdej ramce.

## Dostosowywanie Material Symbols

Material Symbols Outlined, Rounded i Sharp są rysowane z fontów zmiennych Google, więc ich opcje w sekcji **Ikona** to osie samych fontów:

- **Weight**, od 100 do 700.
- **Fill**, 0 dla konturowej albo 1 dla wypełnionej.
- **Grade**, od −50 do 200 — lekko pogrubia kreski bez zmiany rozmiaru ikony, na przykład aby wyrównać wygląd jasnych ikon na ciemnym tle.
- **Optical size**, od 20 do 48. Wstawiona ikona zaczyna od rozmiaru optycznego równego swojemu rozmiarowi, tak jak zaleca Google, więc ikona 24 × 24 używa wartości 24; ustaw go samodzielnie, aby narysować małą ikonę ze szczegółami dużej albo odwrotnie.

## Używanie SF Symbols {#sf-symbols}

SF Symbols to ikony Apple. Apple udziela na nie licencji tylko na własne platformy, dlatego OpenPencil nigdy ich nie dołącza: rysuje je macOS i są dostępne tylko w [aplikacji OpenPencil na Maca](/pl/download) w systemie **macOS 14 Sonoma lub nowszym**. W przeglądarce, w Windows i Linuksie oraz w starszych wersjach macOS okno wyboru ikon pokazuje SF Symbols w grupie Apple i zamiast ikon wyjaśnia, czego wymagają.

Aby z nich korzystać:

1. [Pobierz OpenPencil](/pl/download) na macOS i uruchom go. Jeśli Twój Mac ma starszą wersję macOS, najpierw go zaktualizuj w **Ustawienia systemowe → Ogólne → Uaktualnienia oprogramowania**.
2. Otwórz okno wyboru ikon, wybierz **SF Symbols** w menu zestawów i szukaj po nazwie lub słowie kluczowym, na przykład `heart` albo `weather`.

Sekcja **Ikona** oferuje wtedy:

- **Weight**, od Ultralight do Black, oraz **Scale**: mała, średnia lub duża, tak jak w aplikacjach Apple.
- **Rendering**: **Monochrome** w kolorze ikony; **Hierarchical**, kolor ikony w kilku stopniach krycia; **Palette**, kolor ikony oraz **Secondary color** i **Tertiary color** dla pozostałych warstw symbolu; albo **Multicolor**, czyli własne kolory symbolu, w których części zależne od koloru pierwszego planu przyjmują kolor ikony.
- **Variable value**, od 0 do 1, dla symboli wypełniających się stopniowo, takich jak `wifi` czy `speaker.wave.3`; inne symbole się nie zmieniają.

Dokument przechowuje kontury swoich SF Symbols, więc rysują się wszędzie, gdzie go otworzysz. Zmiana lub zamiana takiej ikony znów wymaga aplikacji na Maca; w innych miejscach sekcja **Ikona** informuje o tym zamiast pokazywać opcje.

## Edycja ścieżek ikony

Ścieżki ikony możesz edytować jak każdy wektor. Gdy zmienią się jej punkty, ścieżki lub własne kolory, sekcja **Ikona** pokazuje **Zmieniona**:

- Ikona eksportuje się jako ścieżki, które teraz rysuje, a nie przez nazwę, więc zmiana zostaje zachowana.
- **Resetuj** (okrągła strzałka) rysuje od nowa oryginalną ikonę w tym samym rozmiarze i kolorze.
- Przed zamianą pojawia się pytanie, bo zamiana rysuje nową ikonę i odrzuca zmiany.

Zmiana rozmiaru ani koloru ikony nie liczy się jako edycja.

**Odłącz ikonę** w sekcji **Ikona**, w menu płótna lub w **Obiekt → Detach Icon** zamienia ikonę w zwykłą grafikę: zachowuje ona ścieżki, ale nie da się jej już zamienić, przekolorować ani wyeksportować jako ikony. Jak każde polecenie dotyczące ikon, to jeden krok cofania.

## Ikony w eksporcie

- **Design JSX** zapisuje wstawioną ikonę jako `<Icon name="lucide:heart" size={24} color="#…" />`. Material Symbols i SF Symbols eksportują się jako rysowane ścieżki, bo sama nazwa nie mówi, jak zostały narysowane; aby wstawić taką ikonę po nazwie, podaj w `<Icon>` jej `options`, na przykład <code v-pre>options={{ wght: 600, FILL: 1 }}</code>.
- **HTML** zapisuje ją jako osadzony SVG oznaczony atrybutem `data-icon`, ze ścieżkami malowanymi kolorem `currentColor` i kolorem ikony ustawionym na `<svg>`, więc zmiana tego jednego `color` przekolorowuje ikonę.
- **SVG i obrazy** rysują ją jak każdy inny wektor.

## Ikony w importowanym HTML

Import HTML zachowuje ikony rysowane przez stronę jako ikony, z jej własnymi ścieżkami i kolorem:

- Osadzony SVG oznaczony `data-icon`, tak jak zapisuje go eksport HTML z OpenPencil, staje się tą ikoną.
- Inny osadzony SVG staje się ikoną z popularnego zestawu Iconify, którą rysuje, jeśli rysuje ją wystarczająco wiernie: jest porównywany z ikonami o najbardziej zbliżonych kształtach, narysowanymi w ten sam sposób.
- Wszystko inne zostaje grafiką.

Dopasowanie pobiera indeks popularnych zestawów, około 2 MB, i prosi Iconify o ikony do porównania po nazwie; sam SVG nigdy nie jest wysyłany. Bez połączenia osadzony SVG bez `data-icon` zostaje grafiką. Wyłączysz to opcją **Nazywaj ikony w importowanym HTML** w **Ustawienia → Edytor** albo flagą `--no-icon-names` w `openpencil import`.

Ikony wstawione przez agentów AI, klientów MCP i Design JSX są ikonami w ten sam sposób, więc sekcja **Ikona** działa także na nich.
