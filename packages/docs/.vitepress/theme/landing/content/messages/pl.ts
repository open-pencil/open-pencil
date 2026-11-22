import type { LandingMessages } from './types'

export const pl: LandingMessages = {
  hero: {
    title: 'Projektuj bez uzależnienia od dostawcy.',
    lede: 'Edytor graficzny open source, który otwiera pliki Figmy, działa na Twoim komputerze i pozwala Tobie lub Twojemu agentowi AI sterować każdą warstwą.',
    open: 'Rozpocznij przewodnik',
    download: 'Pobierz',
    github: 'GitHub'
  },
  loading: 'Ładowanie edytora',
  features: {
    figma: {
      title: 'Otwórz to, co już masz',
      detail:
        'OpenPencil czyta pliki .fig bezpośrednio: strony, komponenty, instancje, zmienne i auto layout trafiają jako edytowalne warstwy, a zapisać możesz znowu do .fig. Wklej SVG albo otwórz HTML i CSS, a one też stają się warstwami, ułożonymi tak, jak układa je przeglądarka.',
      hint: 'To przewodnik samej aplikacji, prawdziwy plik .fig. Otwórz rozdział w warstwach i poklikaj.'
    },
    design: {
      title: 'Projektuj prawdziwymi narzędziami',
      detail:
        'Auto layout, ograniczenia, wypełnienia, obrysy, efekty i typografia, z kontrolkami tam, gdzie ich szukasz. Komponenty mają sloty: instancja zachowuje projekt i wnosi własną treść. Wszystko da się cofnąć i nic nie czeka na serwer.',
      hint: 'Najedź na zaznaczoną okładkę i przeciągnij róg, aby go zaokrąglić. Pozostałe odtwarzacze wnoszą własne okładki przez slot Artwork.'
    },
    interactive: {
      title: 'Komponenty, które działają',
      detail:
        'Nadaj komponentowi zachowanie, na przykład przełącznika, pola wyboru, suwaka, kart lub pola tekstowego, a podgląd uruchomi go jako prawdziwą kontrolkę Reka UI. Warianty stają się jego stanami, a te same komponenty eksportują się do Storybooka z klikalnymi kontrolkami.',
      hint: 'To płótno jest w podglądzie: naciśnij play, przeciągnij pasek postępu, włącz losowanie. Wyjdź z podglądu, by edytować.'
    },
    tokens: {
      title: 'Zmienne to tokeny projektowe',
      detail:
        'Kolory, odstępy i typografia żyją w kolekcjach z trybami i edytuje się je jako tokeny. Wyeksportowany kod zapisuje powiązane wartości jako niestandardowe właściwości CSS, więc kod używa tych samych nazw co projekt.',
      hint: 'Każdy odtwarzacz czyta kolekcję Theme we własnym trybie. Zmień wartość tokena, a oba podążą.'
    },
    shaders: {
      title: 'Wypełnienia, które się ruszają',
      detail:
        'Shader to wypełnienie jak każde inne: wybierz go w selektorze wypełnień, nakładaj efekty, ustawiaj ich suwaki albo wklej preset z shaders.com. Pliki zachowują jego nieruchomą klatkę, więc otwierają się wszędzie, a podgląd go odtwarza.',
      hint: 'To płótno jest w podglądzie, dlatego shadery się ruszają. Wyjdź z podglądu, zaznacz kwadrat i otwórz jego wypełnienie.'
    },
    linting: {
      title: 'Linting',
      detail:
        'OpenPencil sprawdza projekt w trakcie pracy: kontrast, zbyt mały tekst, domyślne nazwy, ukryte i puste warstwy, zbędne grupy. Problemy są oznaczane na obszarze roboczym, wiele z nich naprawisz jednym kliknięciem, a te same reguły działają w CLI i dla agentów.',
      hint: 'Kliknij znacznik na obszarze roboczym albo zastosuj poprawkę z listy.'
    },
    ai: {
      title: 'Projektuj z AI, na własnych kluczach',
      detail:
        'Opisz zadanie zwykłym językiem, a agent edytuje dokument tymi samymi narzędziami co Ty i pokazuje efekty na obszarze roboczym już w trakcie generowania. Podłącz dowolnego dostawcę własnym kluczem albo użyj agenta programistycznego, z którego już korzystasz.',
      hint: 'Nagrana tura przechodzi przez prawdziwą pętlę agenta. Zobacz, jak obszar roboczy powstaje w trakcie strumieniowania.'
    },
    collab: {
      title: 'Współpraca ludzi i agentów',
      detail:
        'Udostępnij link, a wszyscy edytują ten sam dokument, peer-to-peer, z kursorami na żywo, trybem śledzenia, komentarzami przypiętymi do warstw i rozmowami głosowymi. Agenci AI dołączają tak samo: wszyscy w pokoju widzą, jak budują, gdy strumieniują.',
      hint: 'Oba ekrany są Twoje. Przeciągnij warstwę na jednym i zobacz, jak przesuwa się na drugim, a potem poproś agenta.'
    },
    code: {
      title: 'Od projektu do kodu',
      detail:
        'Każde zaznaczenie to komponent Vue lub React, z wariantami jako propsami i Reka UI lub Radix za tymi interaktywnymi, albo HTML, Tailwind i design JSX ze zmiennymi zapisanymi jako tokeny. Komponenty eksportują się jako historie Storybooka, a design JSX pozostaje powiązany z płótnem: edytuj go, a płótno podąży.',
      hint: 'Przełącz na React, HTML lub design JSX albo zaznacz inną warstwę.'
    },
    script: {
      title: 'Wszystko da się oskryptować',
      detail:
        'CLI openpencil pracuje na pliku bez uruchomionej aplikacji albo steruje otwartą aplikacją. Przejrzyj dokument, odpytaj go przez XPath, sprawdź linterem, wyeksportuj albo uruchom na nim kod wtyczek Figmy przez eval. Serwer MCP daje agentom te same możliwości przez stdio lub HTTP.',
      hint: 'Uruchom polecenie i obserwuj obszar roboczy.'
    },
    sdk: {
      title: 'Wbuduj go we własny produkt',
      detail:
        'OpenPencil to nie tylko aplikacja, ale też zestaw narzędzi: silnik niezależny od frameworka, SDK Vue bez interfejsu oraz osobne pakiety dla grafu sceny i formatów plików. Osadź obszar roboczy w swoim produkcie, renderuj i sprawdzaj projekty w CI albo zbuduj inny edytor na tym samym silniku. Każdy obszar roboczy na tej stronie to właśnie to SDK działające w witrynie z dokumentacją.',
      hint: 'Kod obok obszaru roboczego wystarczy, żeby go zamontować.'
    }
  },
  agents: {
    heading: 'Działa z',
    rest: 'i każdym klientem MCP'
  },
  commands: {
    cli: 'Polecenia CLI: {count}',
    mcp: 'Narzędzia MCP: {count}',
    mcpDetail:
      'Tworzenie, stylowanie, układ, inspekcja i eksport. Każde z nich jest też dostępne dla wbudowanego agenta.'
  },
  ownership: {
    title: 'Twoje pliki pozostają Twoje',
    items: [
      {
        title: 'Najpierw lokalnie',
        detail:
          'Dokumenty to pliki na Twoim dysku. Bez konta, bez serwera, bez dostępu do internetu.'
      },
      {
        title: 'Twoja pamięć masowa',
        detail: 'Synchronizuj przez własny zasobnik zgodny z S3, kiedy tego potrzebujesz.'
      },
      {
        title: 'Otwarte formaty',
        detail: 'Eksport do .fig, PDF, PPTX, SVG, HTML i JSX. Zawsze możesz odejść.'
      },
      {
        title: 'Licencja MIT',
        detail: 'Edytor, silnik renderujący, kodek .fig i CLI.'
      }
    ]
  },
  roadmap: {
    title: 'Plan rozwoju',
    more: 'Pełny plan rozwoju',
    shipped: {
      label: 'Wydane',
      entries: [
        { title: 'OpenPencil Cloud, także na własnym serwerze' },
        { title: 'Tablice w stylu FigJam' },
        { title: 'Strony WWW z adresu URL jako warstwy' },
        { title: 'Formuły w zmiennych' },
        { title: 'Fonty zmienne, Material Symbols i SF Symbols' },
        { title: 'Szkło, rozmycie progresywne, szum i tekstura' },
        { title: 'Korekty obrazów' },
        { title: 'Narzędzie Skalowanie' },
        { title: 'Szybsze płótno' },
        { title: 'Przeglądy projektu i własne prompty AI' },
        { title: 'Arabski i portugalski brazylijski' },
        { title: 'Komentarze i rozmowy głosowe we wspólnych pokojach' },
        { title: 'Interaktywne komponenty i podgląd' },
        { title: 'Linting z poprawkami jednym kliknięciem' }
      ]
    },
    now: {
      label: 'Teraz',
      entries: [
        {
          title: 'Kolory Display P3',
          detail: 'Dokumenty rysowane i eksportowane w ich profilu kolorów, jak w Figmie.'
        },
        {
          title: 'Projektowanie na działających stronach',
          detail: 'Porównuj strony projektu z projektem graficznym i otwieraj pull requesty.'
        },
        {
          title: 'OpenPencil na Androidzie',
          detail: 'Edytor na telefonach, tabletach i składanych urządzeniach z Androidem.'
        }
      ]
    },
    next: {
      label: 'Następnie',
      leads: [
        {
          title: 'OpenPencil w telefonie',
          detail:
            'Aplikacja towarzysząca na iOS i Androida oraz sam edytor na telefonach i tabletach.',
          features: [
            {
              title: 'Aplikacja towarzysząca',
              detail:
                'Otwieraj pliki z Cloud, śledź pokój na żywo i odpowiadaj na komentarze i agentów.'
            },
            {
              title: 'Podgląd na urządzeniu',
              detail: 'Wyświetlaj ramkę z komputera na telefonie podczas projektowania.'
            },
            {
              title: 'Projektowanie na tabletach',
              detail: 'Obsługa dotykiem i rysikiem, z panelami dla małych ekranów.'
            },
            {
              title: 'Te same dokumenty',
              detail: 'Edytor i Cloud, których już używasz, a nie osobna aplikacja.'
            }
          ]
        },
        {
          title: 'Prezentacje',
          detail: 'Prezentacje obok projektów i tablic, zbudowane z twojego systemu projektowego.',
          features: [
            {
              title: 'Twoje komponenty',
              detail:
                'Prezentacje używają tych samych komponentów, zmiennych i bibliotek co projekty.'
            },
            {
              title: 'Widok prezentera',
              detail:
                'Notatki prelegenta, prezentowanie na pełnym ekranie i publiczność śledząca na żywo.'
            },
            {
              title: 'Pliki Figma Slides',
              detail: 'Otwieraj i zapisuj pliki .deck, eksportuj do PDF i PowerPointa.'
            },
            {
              title: 'Prezentacje z AI',
              detail: 'Szkic prezentacji z konspektu lub dokumentu, w motywie prezentacji.'
            }
          ]
        }
      ],
      entries: [
        {
          title: 'Logowanie jednokrotne',
          detail: 'OIDC i SSO dla zespołów, z kontami usług i webhookami.'
        },
        {
          title: 'Projekty i foldery',
          detail: 'Porządkuj przestrzenie Cloud, z szablonami i wyszukiwaniem.'
        }
      ]
    },
    later: {
      label: 'Później',
      entries: [
        {
          title: 'Zarządzane systemy projektowe',
          detail: 'Proponowanie, przegląd, publikacja i migracja.'
        },
        {
          title: 'Edytor do osadzenia',
          detail: 'Przenieś edytor z tej strony do własnego produktu.'
        },
        { title: 'Prototypowanie', detail: 'Połączenia, przejścia i nakładki między ramkami.' }
      ]
    }
  },
  cloud: {
    badge: 'Już dostępne',
    title: 'OpenPencil Cloud',
    lede: 'Przestrzeń projektowa twojego zespołu, hostowana za ciebie. Wszyscy edytują te same pliki na żywo, udostępniają je linkiem i projektują z AI opłacaną kredytami planu, bez instalowania i utrzymywania czegokolwiek. Zacznij za darmo z 300 MB i eksportuj pliki jako .fig, kiedy chcesz.',
    signUp: 'Wypróbuj OpenPencil Cloud',
    plans: 'Zobacz plany',
    features: [
      {
        title: 'Synchronizacja na żywo',
        detail: 'Każda zmiana trafia do całego zespołu od razu, na każdym urządzeniu.'
      },
      {
        title: 'Linki i komentarze',
        detail: 'Wyślij link do przeglądu projektu i omawiaj go bezpośrednio na płótnie.'
      },
      {
        title: 'Historia wersji',
        detail: 'Nazwane wersje i autozapisy do podglądu, przywrócenia lub skopiowania.'
      },
      {
        title: 'AI w twoim planie',
        detail: 'Agenci projektujący z tobą, opłacani kredytami planu, bez kluczy API.'
      },
      {
        title: 'Własny serwer',
        detail: 'Uruchom ten sam serwer na własnej infrastrukturze, na licencji Apache 2.0.'
      }
    ]
  },
  closing: {
    title: 'Zabierz swoje projekty ze sobą.',
    download: 'Pobierz OpenPencil',
    docs: 'Czytaj dokumentację',
    cloud: 'Wypróbuj OpenPencil Cloud'
  },
  clipboard: {
    copy: 'Kopiuj',
    copied: 'Skopiowano'
  },
  stage: {
    activate: 'Wypróbuj na żywo',
    terminal: {
      tree: 'Drzewo warstw',
      restyle: 'Zmień kolor akcentu',
      addPlayer: 'Dodaj odtwarzacz',
      selection: 'Zaznaczenie',
      export: 'Eksport do Tailwind'
    },
    ai: {
      recorded: 'Nagrana tura',
      play: 'Odtwórz',
      replay: 'Odtwórz ponownie',
      request: 'Dodaj obok odtwarzacza kolejkę „Up next”.',
      reasoning:
        'Odtwarzacz stoi sam w ramce hero, która układa dzieci w rzędzie, więc dodana tam karta trafi tuż obok. Powiążę tło, promień i kolory tekstu karty ze zmiennymi Theme, których używa odtwarzacz, żeby przełączała się razem z nim między ciemnym a jasnym, i wypiszę trzy utwory, każdy z małą okładką, tytułem i wykonawcą.',
      reply:
        'Obok odtwarzacza jest teraz karta **Up next** z trzema utworami. Kolory i promień pochodzą ze zmiennych Theme, więc podąża za odtwarzaczem między ciemnym a jasnym.'
    },
    collab: {
      you: 'Ty',
      yourScreen: 'Twój ekran',
      theirScreen: 'Ekran Sama',
      askAgent: 'Poproś agenta'
    },
    sdk: {
      install: 'Instalacja'
    }
  },
  download: {
    title: 'Pobierz OpenPencil',
    lede: 'Aplikacja desktopowa na macOS, Windows i Linux. Darmowa i otwartoźródłowa, bez rejestracji.',
    version: 'Wersja {version}, wydana {date}',
    forPlatform: 'Pobierz na {platform}',
    moreFiles: 'Więcej plików dla {platform}',
    releaseNotes: 'Informacje o wydaniu',
    yourSystem: 'Twój system',
    arch: {
      appleSilicon: 'Apple Silicon',
      intel: 'Intel',
      x64: 'x64',
      arm: 'ARM'
    },
    formats: {
      dmg: 'Obraz dysku',
      exe: 'Instalator',
      msi: 'Do instalacji zarządzanych',
      appimage: 'Działa na większości dystrybucji',
      deb: 'Debian, Ubuntu',
      rpm: 'Fedora, openSUSE'
    },
    requirements: 'Wymagania systemowe',
    allTitle: 'Wszystkie pliki',
    checksums: 'Sumy kontrolne SHA-256',
    onGitHub: 'Wydanie na GitHubie',
    unavailable:
      'Nie udało się wczytać listy plików. Wszystkie pliki są na stronie wydań na GitHubie.',
    others: {
      title: 'Inne sposoby',
      homebrew: {
        title: 'Homebrew',
        detail:
          'Podpisana aplikacja na macOS z oficjalnego casku. Homebrew sprawdza każdą aktualizację, więc może trafić tam nieco później niż tutaj.'
      },
      web: {
        title: 'W przeglądarce',
        detail: 'Ten sam edytor na app.openpencil.dev, bez instalacji.',
        action: 'Otwórz aplikację webową'
      },
      cli: {
        title: 'Wiersz poleceń',
        detail: 'Przeglądaj, eksportuj, sprawdzaj i skryptuj pliki .fig bez otwierania aplikacji.'
      },
      source: {
        title: 'Ze źródeł',
        detail: 'Zbuduj aplikację samodzielnie z Bun i Rust.',
        action: 'Instrukcja budowania'
      }
    },
    beta: {
      badge: 'Beta',
      title: 'Wypróbuj to, co nadchodzi',
      lede: 'Bety dają wcześniej funkcje następnej wersji, zanim trafią do wszystkich.',
      caveats: [
        'Aplikacja w wersji stabilnej nie aktualizuje się do bety; zainstaluj betę, aby ją wypróbować.',
        'Na Linuksie usuń betę zainstalowaną z .deb lub .rpm przed instalacją wersji finalnej.',
        'Bety CLI i SDK są w npm pod tagiem next.'
      ],
      notes: 'Co nowego'
    }
  }
}
