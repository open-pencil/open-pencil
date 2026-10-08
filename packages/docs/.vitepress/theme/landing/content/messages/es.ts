import type { LandingMessages } from './types'

export const es: LandingMessages = {
  hero: {
    title: 'Diseña sin ataduras.',
    lede: 'Un editor de diseño de código abierto que abre tus archivos de Figma, funciona en tu equipo y permite que tú o tu agente de IA controléis cada capa.',
    open: 'Abrir el editor',
    download: 'Descargar',
    github: 'GitHub'
  },
  loading: 'Cargando el editor',
  features: {
    figma: {
      title: 'Abre tus archivos de Figma',
      detail:
        'OpenPencil lee archivos .fig directamente: páginas, componentes, instancias, variables y auto-layout llegan como capas editables. Copiar y pegar funciona en ambos sentidos, y puedes volver a guardar en .fig.',
      hint: 'Este es un archivo .fig real. Despliega las capas y explóralo.'
    },
    design: {
      title: 'Diseña con herramientas de verdad',
      detail:
        'Auto-layout, restricciones, rellenos, trazos, efectos y tipografía, con los controles donde esperas encontrarlos. Todo se puede deshacer y nada espera a un servidor.',
      hint: 'Selecciona una capa y cambia su relleno, radio o espaciado interior.'
    },
    interactive: {
      title: 'Componentes que funcionan',
      detail:
        'Dale a un componente un comportamiento, como un interruptor, una casilla, un deslizador, pestañas o un campo de texto, y la vista previa lo ejecuta como un control real de Reka UI. Las variantes pasan a ser sus estados, y los mismos componentes se exportan a Storybook con controles en los que se puede hacer clic.',
      hint: 'Este lienzo está en vista previa: activa el interruptor, arrastra el deslizador. Sal de la vista previa para editar.'
    },
    tokens: {
      title: 'Las variables son tokens de diseño',
      detail:
        'Colores, espaciados y tipografía viven en colecciones con modos y se editan como tokens. El código exportado escribe los valores vinculados como propiedades personalizadas de CSS, así que el código usa los mismos nombres que el diseño.',
      hint: 'Cambia el valor de un token o el modo, y cada capa vinculada a él lo sigue.'
    },
    linting: {
      title: 'Linting',
      detail:
        'OpenPencil revisa el diseño mientras trabajas: contraste, texto demasiado pequeño, nombres por defecto, capas ocultas y vacías, grupos sobrantes. Los problemas se marcan en el lienzo, muchos se corrigen con un clic, y las mismas reglas funcionan en la CLI y para los agentes.',
      hint: 'Haz clic en una marca del lienzo o aplica una corrección de la lista.'
    },
    ai: {
      title: 'Diseña con IA, con tus claves',
      detail:
        'Pide lo que necesitas con tus propias palabras y el agente edita el documento con las mismas herramientas que tú, mostrando su trabajo en el lienzo a medida que llega. Conecta cualquier proveedor con tu propia clave o usa el agente de programación que ya utilizas.',
      hint: 'Un turno grabado se reproduce con el bucle real del agente. Mira cómo se construye el lienzo mientras llega.'
    },
    code: {
      title: 'Del diseño al código',
      detail:
        'Cada selección está disponible como Tailwind JSX, HTML o JSX de diseño, con las variables escritas como tokens, y los componentes se exportan como historias de Storybook. Código y lienzo siguen enlazados: selecciona una línea y se selecciona su capa; edita el JSX y el lienzo lo sigue.',
      hint: 'Selecciona otra capa y observa cómo la sigue el código.'
    },
    script: {
      title: 'Automatízalo todo',
      detail:
        'La CLI openpencil trabaja sobre un archivo sin que la aplicación esté abierta, o controla la aplicación que tienes en marcha. Inspecciona un documento, consúltalo con XPath, revísalo con el linter, expórtalo o ejecuta código de plugins de Figma con eval. El servidor MCP da a los agentes el mismo alcance por stdio o HTTP.',
      hint: 'Ejecuta un comando y observa el lienzo.'
    },
    sdk: {
      title: 'Intégralo en tu propio producto',
      detail:
        'OpenPencil es tanto un conjunto de herramientas como una aplicación: un motor independiente del framework, un SDK de Vue sin interfaz y paquetes separados para el grafo de escena y los formatos de archivo. Incrusta un lienzo en tu producto, renderiza y revisa diseños en CI o crea otro editor sobre el mismo motor. Cada lienzo de esta página es ese SDK funcionando dentro de un sitio de documentación.',
      hint: 'El código junto al lienzo es todo lo que hace falta para montar uno.'
    }
  },
  agents: {
    heading: 'Funciona con',
    rest: 'y cualquier cliente MCP'
  },
  commands: {
    cli: '{count} comandos',
    mcp: '{count} herramientas MCP',
    mcpDetail:
      'Crear, dar estilo, maquetar, inspeccionar y exportar. Todas están también disponibles para el agente integrado.'
  },
  ownership: {
    title: 'Tus archivos siguen siendo tuyos',
    items: [
      {
        title: 'Primero en local',
        detail:
          'Los documentos son archivos en tu disco. Sin cuenta, sin servidor y sin necesidad de internet.'
      },
      {
        title: 'Tu almacenamiento',
        detail: 'Sincroniza mediante tu propio bucket compatible con S3 cuando lo necesites.'
      },
      {
        title: 'Formatos abiertos',
        detail: 'Exporta a .fig, PDF, PPTX, SVG, HTML y JSX. Siempre puedes irte.'
      },
      {
        title: 'Licencia MIT',
        detail: 'El editor, el motor de renderizado, el códec .fig y la CLI.'
      }
    ]
  },
  roadmap: {
    title: 'Hoja de ruta',
    more: 'Hoja de ruta completa',
    now: {
      label: 'Ahora',
      entries: [
        {
          title: 'Agentes de IA como colaboradores',
          detail:
            'Los agentes aparecen en el lienzo como cualquier otro participante, y puedes seguir lo que hacen.'
        },
        {
          title: 'Revertir, regenerar y editar turnos de IA',
          detail: 'Cada llamada a una herramienta muestra lo que cambió.'
        },
        {
          title: 'Comprobaciones de diseño en vivo',
          detail: 'Un panel de lint con marcadores en el lienzo y correcciones.'
        },
        {
          title: 'Código vinculado a las capas',
          detail: 'La selección y los cambios se sincronizan en ambos sentidos.'
        },
        {
          title: 'Diff visual y parches',
          detail: 'En la aplicación, para agentes y como openpencil diff.'
        }
      ]
    },
    next: {
      label: 'Después',
      lead: {
        title: 'OpenPencil autoalojado',
        detail:
          'Todo el espacio de trabajo dentro de tu propia red: sincronización, uso compartido, comentarios y bibliotecas de equipo sin enviar un archivo a nadie más.',
        features: [
          {
            title: 'Tu almacenamiento',
            detail: 'Los documentos permanecen en tu bucket, en tu región.'
          },
          {
            title: 'Tu identidad',
            detail: 'Inicio de sesión con tu proveedor OIDC o SSO, con roles.'
          },
          {
            title: 'Tu red',
            detail: 'Un relé de colaboración que funciona detrás de tu cortafuegos.'
          },
          {
            title: 'Tu operación',
            detail: 'Despliegue guiado, actualizaciones, copias de seguridad y retención.'
          }
        ]
      },
      entries: [
        {
          title: 'Historial de versiones',
          detail: 'Instantáneas automáticas, puntos de control con nombre y restauración.'
        },
        {
          title: 'OpenPencil Cloud opcional',
          detail:
            'Sincronización y uso compartido alojados para los equipos que lo quieran. Nunca obligatorio.'
        }
      ]
    },
    later: {
      label: 'Más adelante',
      entries: [
        {
          title: 'Sistemas de diseño gobernados',
          detail: 'Proponer, revisar, publicar y migrar.'
        },
        {
          title: 'Editor incrustable',
          detail: 'Lleva el editor de esta página a tu propio producto.'
        }
      ]
    }
  },
  closing: {
    title: 'Llévate tus diseños contigo.',
    download: 'Descargar OpenPencil',
    docs: 'Leer la documentación'
  },
  stage: {
    terminal: {
      tree: 'Árbol de capas',
      restyle: 'Cambiar los botones',
      addPlan: 'Añadir un plan',
      selection: 'Selección',
      export: 'Exportar a Tailwind'
    },
    ai: {
      recorded: 'Turno grabado',
      play: 'Reproducir',
      replay: 'Repetir',
      request: 'Añade tres garantías debajo de los planes.',
      reasoning:
        'Los planes están en una columna con auto-layout, así que una fila de tres tarjetas cabe justo debajo.',
      reply:
        'He añadido una fila **Guarantees** debajo de los planes: tres tarjetas con el mismo fondo y radio que las tarjetas de los planes.'
    },
    sdk: {
      copy: 'Copiar',
      copied: 'Copiado'
    }
  }
}
