import type { LandingMessages } from './types'

export const pl: LandingMessages = {
  hero: {
    title: 'Projektuj bez uzależnienia od dostawcy.',
    lede: 'Edytor graficzny open source, który otwiera pliki Figmy, działa na Twoim komputerze i pozwala Tobie lub Twojemu agentowi AI sterować każdą warstwą.',
    open: 'Otwórz edytor',
    download: 'Pobierz',
    github: 'GitHub'
  },
  loading: 'Ładowanie edytora',
  features: {
    figma: {
      title: 'Otwórz swoje pliki Figmy',
      detail:
        'OpenPencil czyta pliki .fig bezpośrednio: strony, komponenty, instancje, zmienne i auto-layout trafiają do edytora jako edytowalne warstwy. Kopiowanie i wklejanie działa w obie strony, a dokument można ponownie zapisać jako .fig.',
      hint: 'To prawdziwy plik .fig. Rozwiń warstwy i sprawdź, co jest w środku.'
    },
    design: {
      title: 'Projektuj prawdziwymi narzędziami',
      detail:
        'Auto-layout, ograniczenia, wypełnienia, obrysy, efekty i typografia, z kontrolkami tam, gdzie się ich spodziewasz. Wszystko można cofnąć i nic nie czeka na serwer.',
      hint: 'Zaznacz warstwę i zmień jej wypełnienie, promień lub odstęp wewnętrzny.'
    },
    interactive: {
      title: 'Komponenty, które działają',
      detail:
        'Nadaj komponentowi zachowanie, na przykład przełącznika, pola wyboru, suwaka, kart lub pola tekstowego, a podgląd uruchomi go jako prawdziwą kontrolkę Reka UI. Warianty stają się jego stanami, a te same komponenty eksportują się do Storybooka z klikalnymi kontrolkami.',
      hint: 'Ten obszar roboczy jest w podglądzie: przełącz przełącznik, przesuń suwak. Wyjdź z podglądu, aby edytować.'
    },
    tokens: {
      title: 'Zmienne to tokeny projektowe',
      detail:
        'Kolory, odstępy i typografia żyją w kolekcjach z trybami i edytuje się je jako tokeny. Wyeksportowany kod zapisuje powiązane wartości jako niestandardowe właściwości CSS, więc kod używa tych samych nazw co projekt.',
      hint: 'Zmień wartość tokenu albo tryb, a każda powiązana z nim warstwa podąży za zmianą.'
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
        'Udostępnij link, a wszyscy edytują ten sam dokument, peer-to-peer, z kursorami na żywo, zaznaczeniami i trybem śledzenia. Agenci AI dołączają tak samo: widzisz, gdzie pracują, na każdym ekranie w pokoju.',
      hint: 'Oba ekrany są Twoje. Przeciągnij warstwę na jednym i zobacz, jak przesuwa się na drugim, a potem poproś agenta.'
    },
    code: {
      title: 'Od projektu do kodu',
      detail:
        'Każde zaznaczenie jest dostępne jako Tailwind JSX, HTML lub JSX projektu, ze zmiennymi zapisanymi jako tokeny, a komponenty można wyeksportować jako historie Storybooka. Kod i obszar roboczy pozostają połączone: zaznacz linię, a zaznaczy się jej warstwa; zmień JSX, a obszar roboczy podąży za zmianą.',
      hint: 'Zaznacz inną warstwę i zobacz, jak kod za nią podąża.'
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
        { title: 'Interaktywne komponenty i podgląd' },
        { title: 'Zmienne jako tokeny projektowe' },
        { title: 'Linting z poprawkami jednym kliknięciem' },
        { title: 'Agenci AI jako współpracownicy, z trybem śledzenia' },
        { title: 'Cofanie, ponowne generowanie i edycja tur AI' },
        { title: 'Kod powiązany z warstwami' },
        { title: 'Wizualny diff i łatki' }
      ]
    },
    now: {
      label: 'Teraz',
      entries: [
        { title: 'Tokeny projektowe W3C', detail: 'Import i eksport tokenów w formacie W3C.' },
        {
          title: 'Storybook z prawdziwych komponentów',
          detail: 'Historie korzystające z Reka UI dla Vue i Radix UI dla React.'
        },
        {
          title: 'Tworzenie komponentów',
          detail: 'Szybsza edycja wariantów i zaznaczanie wewnątrz komponentów.'
        }
      ]
    },
    next: {
      label: 'Następnie',
      lead: {
        title: 'OpenPencil na własnym serwerze',
        detail:
          'Cała przestrzeń robocza we własnej sieci: synchronizacja, udostępnianie, komentarze i biblioteki zespołu bez wysyłania pliku komukolwiek innemu.',
        features: [
          {
            title: 'Twoja pamięć masowa',
            detail: 'Dokumenty pozostają w Twoim zasobniku, w Twoim regionie.'
          },
          {
            title: 'Twoja tożsamość',
            detail: 'Logowanie przez Twojego dostawcę OIDC lub SSO, z rolami.'
          },
          {
            title: 'Twoja sieć',
            detail: 'Przekaźnik współpracy, który działa za Twoją zaporą.'
          },
          {
            title: 'Twoje utrzymanie',
            detail: 'Wdrożenie z przewodnikiem, aktualizacje, kopie zapasowe i retencja.'
          }
        ]
      },
      entries: [
        {
          title: 'Historia wersji',
          detail: 'Automatyczne migawki, nazwane punkty kontrolne i przywracanie.'
        }
      ],
      cloud: {
        title: 'OpenPencil Cloud',
        detail:
          'Hostowana przestrzeń dla zespołów: synchronizacja na żywo, udostępnianie, biblioteki i AI, bez utrzymywania czegokolwiek.'
      }
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
        }
      ]
    }
  },
  cloud: {
    badge: 'Wczesny dostęp',
    title: 'OpenPencil Cloud',
    lede: 'Przestrzeń projektowa Twojego zespołu, hostowana za Ciebie. Wszyscy edytują te same pliki na żywo, udostępniają je linkiem i projektują z AI, bez instalowania i utrzymywania czegokolwiek. Pliki pozostają otwarte: eksportuj je do .fig, kiedy chcesz.',
    features: [
      {
        title: 'Synchronizacja zespołu w czasie rzeczywistym',
        detail: 'Każda zmiana od razu trafia do całego zespołu, na każdym urządzeniu.'
      },
      {
        title: 'Linki i komentarze',
        detail: 'Wyślij link do przeglądu projektu i omawiajcie go bezpośrednio na płótnie.'
      },
      {
        title: 'Biblioteki zespołu',
        detail: 'Opublikuj komponenty, style i tokeny raz i używaj ich w każdym pliku.'
      },
      {
        title: 'Hostowane AI',
        detail: 'Agenci, którzy projektują z Tobą, bez zarządzania kluczami API.'
      },
      {
        title: 'SSO i kontrola administracyjna',
        detail: 'Logowanie jednokrotne, role i kontrola nad tym, kto co widzi.'
      }
    ]
  },
  waitlist: {
    label: 'Adres e-mail',
    placeholder: 'ty@przyklad.pl',
    submit: 'Zapisz się na listę',
    invalid: 'Wpisz poprawny adres e-mail.',
    joined: 'Jesteś na liście',
    joinedDetail: 'Napiszemy, gdy OpenPencil Cloud wystartuje.',
    failed: 'Nie udało się zapisać',
    failedDetail: 'Spróbuj ponownie za chwilę.',
    privacy: 'Piszemy tylko w sprawie OpenPencil Cloud.'
  },
  closing: {
    title: 'Zabierz swoje projekty ze sobą.',
    download: 'Pobierz OpenPencil',
    docs: 'Czytaj dokumentację',
    cloud: 'Zapisz się na listę Cloud'
  },
  stage: {
    terminal: {
      tree: 'Drzewo warstw',
      restyle: 'Zmień styl przycisków',
      addPlan: 'Dodaj plan',
      selection: 'Zaznaczenie',
      export: 'Eksport do Tailwind'
    },
    ai: {
      recorded: 'Nagrana tura',
      play: 'Odtwórz',
      replay: 'Odtwórz ponownie',
      request: 'Dodaj trzy gwarancje pod planami.',
      reasoning:
        'Plany leżą w kolumnie z auto-layoutem, więc rząd trzech kart zmieści się tuż pod nimi i dopasuje do układu. Każda karta dostanie krótki tytuł i jedną linijkę opisu, z tłem i zaokrągleniem kart planów, żeby rząd wyglądał jak część strony.',
      reply:
        'Dodałem pod planami rząd **Guarantees**: trzy karty z takim samym tłem i promieniem jak karty planów.'
    },
    collab: {
      you: 'Ty',
      yourScreen: 'Twój ekran',
      theirScreen: 'Ekran Sama',
      askAgent: 'Poproś agenta'
    },
    sdk: {
      copy: 'Kopiuj',
      copied: 'Skopiowano'
    }
  }
}
