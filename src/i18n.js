// UI strings. Data values (option sets, lookups) already come localized from Dataverse in the
// user's language; this only covers the tool's own text. Add a language = add one object.

const en = {
  name: 'English',
  types: { channel: 'Channel', workstream: 'Workstream', ruleset: 'Ruleset', rule: 'Rule', queue: 'Queue', overflow: 'Overflow', hours: 'Operating hours', capacity: 'Capacity', user: 'User' },
  sections: { hours: 'Operating hours', pre: 'PreQueue', in: 'InQueue', members: 'Agents' },
  channels: { voice: 'Voice', whatsapp: 'WhatsApp', chat: 'Chat', teams: 'Teams', facebook: 'Facebook', sms: 'SMS', custom: 'Custom messaging' },
  edges: { step: (n) => `step ${n}`, defaultQueue: 'default queue', bot: 'bot', capacity: 'capacity', hours: 'hours', pre: 'pre-queue overflow', in: 'in-queue overflow', assignment: 'assignment', transfer: 'transfer' },
  fields: {
    type: 'Type', assignmentMethod: 'Assignment method', priority: 'Priority', isDefault: 'Default queue', hours: 'Operating hours', email: 'Email', status: 'Status',
    action: 'Action', target: 'Target', name: 'Name', maxUnits: 'Default max units', blockAssignment: 'Block assignment', channel: 'Channel', distribution: 'Work distribution',
    mode: 'Mode', direction: 'Direction', capacityRequired: 'Required capacity', defaultQueue: 'Default queue', bot: 'Bot', phone: 'Phone', workstream: 'Workstream',
    uniqueName: 'Unique name', authoring: 'Authoring mode', description: 'Description', condition: 'Condition', actions: 'Actions', orderBy: 'Order by',
  },
  text: {
    noName: '(no name)', inactive: 'INACTIVE', bot: 'Bot', max: (n) => `Max. ${n}`, always: 'always', alwaysCap: 'Always', when: (c) => `If ${c}`,
    queueArrow: 'Queue →', overflowArrow: 'Overflow →', queue: 'Queue', queueNotFound: 'Not found among omnichannel queues',
    outsideHours: 'outside operating hours', insideHours: 'within operating hours',
    extracted: 'Extracted', tablesFailed: (n) => `${n} table(s) could not be read`, search: 'Search everything…', showInDiagram: 'Show in diagram',
    pick: 'Pick an item from the list to draw everything that flows into and out of it.', loading: 'Reading Contact Center configuration…',
    nodes: 'nodes', links: 'links', collapseAll: 'Collapse all', expandAll: 'Expand all', exportPng: 'Export PNG', copyMermaid: 'Copy Mermaid',
    centerHere: 'Center diagram here', minimize: (x) => `Minimize ${x}`, expand: (x) => `Expand ${x}`, allBoxes: 'all boxes', diagram: 'diagram',
    noConnection: 'Pick or create a connection in Power Platform ToolBox and the tool will load automatically.',
    noData: 'No data. Open this tool from Power Platform ToolBox with a connected environment.', language: 'Language',
  },
}

const es = {
  name: 'Español',
  types: { channel: 'Canal', workstream: 'Workstream', ruleset: 'Conjunto de reglas', rule: 'Regla', queue: 'Cola', overflow: 'Desbordamiento', hours: 'Horario', capacity: 'Capacidad', user: 'Usuario' },
  sections: { hours: 'Horario', pre: 'PreQueue', in: 'InQueue', members: 'Agentes' },
  channels: { voice: 'Voz', whatsapp: 'WhatsApp', chat: 'Chat', teams: 'Teams', facebook: 'Facebook', sms: 'SMS', custom: 'Mensajería personalizada' },
  edges: { step: (n) => `paso ${n}`, defaultQueue: 'cola por defecto', bot: 'bot', capacity: 'capacidad', hours: 'horario', pre: 'desbordamiento previo', in: 'desbordamiento en cola', assignment: 'asignación', transfer: 'transferir' },
  fields: {
    type: 'Tipo', assignmentMethod: 'Método de asignación', priority: 'Prioridad', isDefault: 'Cola por defecto', hours: 'Horario', email: 'Email', status: 'Estado',
    action: 'Acción', target: 'Destino', name: 'Nombre', maxUnits: 'Máx. por defecto', blockAssignment: 'Bloquear asignación', channel: 'Canal', distribution: 'Distribución',
    mode: 'Modo', direction: 'Dirección', capacityRequired: 'Capacidad requerida', defaultQueue: 'Cola por defecto', bot: 'Bot', phone: 'Teléfono', workstream: 'Workstream',
    uniqueName: 'Nombre único', authoring: 'Edición', description: 'Descripción', condition: 'Condición', actions: 'Acciones', orderBy: 'Ordenar por',
  },
  text: {
    noName: '(sin nombre)', inactive: 'INACTIVO', bot: 'Bot', max: (n) => `Máx. ${n}`, always: 'siempre', alwaysCap: 'Siempre', when: (c) => `Si ${c}`,
    queueArrow: 'Cola →', overflowArrow: 'Desbordamiento →', queue: 'Cola', queueNotFound: 'No encontrada entre las colas omnicanal',
    outsideHours: 'fuera de horario', insideHours: 'dentro de horario',
    extracted: 'Extraído', tablesFailed: (n) => `${n} tabla(s) no se pudieron leer`, search: 'Buscar en todo…', showInDiagram: 'Mostrar en el diagrama',
    pick: 'Elige un elemento de la lista para dibujar todo lo que entra y sale de él.', loading: 'Leyendo la configuración del Contact Center…',
    nodes: 'nodos', links: 'relaciones', collapseAll: 'Plegar todo', expandAll: 'Desplegar todo', exportPng: 'Exportar PNG', copyMermaid: 'Copiar Mermaid',
    centerHere: 'Centrar diagrama aquí', minimize: (x) => `Minimizar ${x}`, expand: (x) => `Expandir ${x}`, allBoxes: 'todas las cajas', diagram: 'diagrama',
    noConnection: 'Elige o crea una conexión en Power Platform ToolBox y la herramienta se cargará sola.',
    noData: 'Sin datos. Abre esta herramienta desde Power Platform ToolBox con un entorno conectado.', language: 'Idioma',
  },
}

const pt = {
  name: 'Português',
  types: { channel: 'Canal', workstream: 'Fluxo de trabalho', ruleset: 'Conjunto de regras', rule: 'Regra', queue: 'Fila', overflow: 'Excedente', hours: 'Horário', capacity: 'Capacidade', user: 'Usuário' },
  sections: { hours: 'Horário', pre: 'PreQueue', in: 'InQueue', members: 'Agentes' },
  channels: { voice: 'Voz', whatsapp: 'WhatsApp', chat: 'Chat', teams: 'Teams', facebook: 'Facebook', sms: 'SMS', custom: 'Mensagens personalizadas' },
  edges: { step: (n) => `etapa ${n}`, defaultQueue: 'fila padrão', bot: 'bot', capacity: 'capacidade', hours: 'horário', pre: 'excedente pré-fila', in: 'excedente na fila', assignment: 'atribuição', transfer: 'transferir' },
  fields: {
    type: 'Tipo', assignmentMethod: 'Método de atribuição', priority: 'Prioridade', isDefault: 'Fila padrão', hours: 'Horário', email: 'Email', status: 'Status',
    action: 'Ação', target: 'Destino', name: 'Nome', maxUnits: 'Máx. padrão', blockAssignment: 'Bloquear atribuição', channel: 'Canal', distribution: 'Distribuição',
    mode: 'Modo', direction: 'Direção', capacityRequired: 'Capacidade necessária', defaultQueue: 'Fila padrão', bot: 'Bot', phone: 'Telefone', workstream: 'Fluxo de trabalho',
    uniqueName: 'Nome exclusivo', authoring: 'Modo de criação', description: 'Descrição', condition: 'Condição', actions: 'Ações', orderBy: 'Ordenar por',
  },
  text: {
    noName: '(sem nome)', inactive: 'INATIVO', bot: 'Bot', max: (n) => `Máx. ${n}`, always: 'sempre', alwaysCap: 'Sempre', when: (c) => `Se ${c}`,
    queueArrow: 'Fila →', overflowArrow: 'Excedente →', queue: 'Fila', queueNotFound: 'Não encontrada entre as filas omnichannel',
    outsideHours: 'fora do horário', insideHours: 'dentro do horário',
    extracted: 'Extraído', tablesFailed: (n) => `${n} tabela(s) não puderam ser lidas`, search: 'Pesquisar tudo…', showInDiagram: 'Mostrar no diagrama',
    pick: 'Escolha um item da lista para desenhar tudo o que entra e sai dele.', loading: 'Lendo a configuração do Contact Center…',
    nodes: 'nós', links: 'relações', collapseAll: 'Recolher tudo', expandAll: 'Expandir tudo', exportPng: 'Exportar PNG', copyMermaid: 'Copiar Mermaid',
    centerHere: 'Centralizar diagrama aqui', minimize: (x) => `Minimizar ${x}`, expand: (x) => `Expandir ${x}`, allBoxes: 'todas as caixas', diagram: 'diagrama',
    noConnection: 'Escolha ou crie uma conexão no Power Platform ToolBox e a ferramenta será carregada automaticamente.',
    noData: 'Sem dados. Abra esta ferramenta no Power Platform ToolBox com um ambiente conectado.', language: 'Idioma',
  },
}

const fr = {
  name: 'Français',
  types: { channel: 'Canal', workstream: 'Flux de travail', ruleset: 'Ensemble de règles', rule: 'Règle', queue: 'File d’attente', overflow: 'Débordement', hours: 'Horaires', capacity: 'Capacité', user: 'Utilisateur' },
  sections: { hours: 'Horaires', pre: 'PreQueue', in: 'InQueue', members: 'Agents' },
  channels: { voice: 'Voix', whatsapp: 'WhatsApp', chat: 'Conversation', teams: 'Teams', facebook: 'Facebook', sms: 'SMS', custom: 'Messagerie personnalisée' },
  edges: { step: (n) => `étape ${n}`, defaultQueue: 'file par défaut', bot: 'bot', capacity: 'capacité', hours: 'horaires', pre: 'débordement avant file', in: 'débordement en file', assignment: 'attribution', transfer: 'transférer' },
  fields: {
    type: 'Type', assignmentMethod: 'Méthode d’attribution', priority: 'Priorité', isDefault: 'File par défaut', hours: 'Horaires', email: 'E-mail', status: 'Statut',
    action: 'Action', target: 'Destination', name: 'Nom', maxUnits: 'Max. par défaut', blockAssignment: 'Bloquer l’attribution', channel: 'Canal', distribution: 'Distribution',
    mode: 'Mode', direction: 'Direction', capacityRequired: 'Capacité requise', defaultQueue: 'File par défaut', bot: 'Bot', phone: 'Téléphone', workstream: 'Flux de travail',
    uniqueName: 'Nom unique', authoring: 'Mode de création', description: 'Description', condition: 'Condition', actions: 'Actions', orderBy: 'Trier par',
  },
  text: {
    noName: '(sans nom)', inactive: 'INACTIF', bot: 'Bot', max: (n) => `Max. ${n}`, always: 'toujours', alwaysCap: 'Toujours', when: (c) => `Si ${c}`,
    queueArrow: 'File →', overflowArrow: 'Débordement →', queue: 'File', queueNotFound: 'Introuvable parmi les files omnicanal',
    outsideHours: 'hors horaires', insideHours: 'pendant les horaires',
    extracted: 'Extrait le', tablesFailed: (n) => `${n} table(s) n’ont pas pu être lues`, search: 'Tout rechercher…', showInDiagram: 'Afficher dans le diagramme',
    pick: 'Choisissez un élément dans la liste pour dessiner tout ce qui y entre et en sort.', loading: 'Lecture de la configuration du Contact Center…',
    nodes: 'nœuds', links: 'liens', collapseAll: 'Tout réduire', expandAll: 'Tout développer', exportPng: 'Exporter PNG', copyMermaid: 'Copier Mermaid',
    centerHere: 'Centrer le diagramme ici', minimize: (x) => `Réduire ${x}`, expand: (x) => `Développer ${x}`, allBoxes: 'toutes les boîtes', diagram: 'diagramme',
    noConnection: 'Choisissez ou créez une connexion dans Power Platform ToolBox et l’outil se chargera automatiquement.',
    noData: 'Aucune donnée. Ouvrez cet outil depuis Power Platform ToolBox avec un environnement connecté.', language: 'Langue',
  },
}

const de = {
  name: 'Deutsch',
  types: { channel: 'Kanal', workstream: 'Arbeitsstream', ruleset: 'Regelsatz', rule: 'Regel', queue: 'Warteschlange', overflow: 'Überlauf', hours: 'Geschäftszeiten', capacity: 'Kapazität', user: 'Benutzer' },
  sections: { hours: 'Geschäftszeiten', pre: 'PreQueue', in: 'InQueue', members: 'Agenten' },
  channels: { voice: 'Sprache', whatsapp: 'WhatsApp', chat: 'Chat', teams: 'Teams', facebook: 'Facebook', sms: 'SMS', custom: 'Benutzerdefiniertes Messaging' },
  edges: { step: (n) => `Schritt ${n}`, defaultQueue: 'Standardwarteschlange', bot: 'Bot', capacity: 'Kapazität', hours: 'Geschäftszeiten', pre: 'Überlauf vor Warteschlange', in: 'Überlauf in Warteschlange', assignment: 'Zuweisung', transfer: 'übertragen' },
  fields: {
    type: 'Typ', assignmentMethod: 'Zuweisungsmethode', priority: 'Priorität', isDefault: 'Standardwarteschlange', hours: 'Geschäftszeiten', email: 'E-Mail', status: 'Status',
    action: 'Aktion', target: 'Ziel', name: 'Name', maxUnits: 'Standard-Max.', blockAssignment: 'Zuweisung blockieren', channel: 'Kanal', distribution: 'Arbeitsverteilung',
    mode: 'Modus', direction: 'Richtung', capacityRequired: 'Benötigte Kapazität', defaultQueue: 'Standardwarteschlange', bot: 'Bot', phone: 'Telefon', workstream: 'Arbeitsstream',
    uniqueName: 'Eindeutiger Name', authoring: 'Erstellungsmodus', description: 'Beschreibung', condition: 'Bedingung', actions: 'Aktionen', orderBy: 'Sortieren nach',
  },
  text: {
    noName: '(ohne Namen)', inactive: 'INAKTIV', bot: 'Bot', max: (n) => `Max. ${n}`, always: 'immer', alwaysCap: 'Immer', when: (c) => `Wenn ${c}`,
    queueArrow: 'Warteschlange →', overflowArrow: 'Überlauf →', queue: 'Warteschlange', queueNotFound: 'Nicht unter den Omnichannel-Warteschlangen gefunden',
    outsideHours: 'außerhalb der Geschäftszeiten', insideHours: 'innerhalb der Geschäftszeiten',
    extracted: 'Ausgelesen', tablesFailed: (n) => `${n} Tabelle(n) konnten nicht gelesen werden`, search: 'Alles durchsuchen…', showInDiagram: 'Im Diagramm anzeigen',
    pick: 'Wähle ein Element aus der Liste, um alles zu zeichnen, was hinein- und herausführt.', loading: 'Contact-Center-Konfiguration wird gelesen…',
    nodes: 'Knoten', links: 'Verbindungen', collapseAll: 'Alle einklappen', expandAll: 'Alle ausklappen', exportPng: 'PNG exportieren', copyMermaid: 'Mermaid kopieren',
    centerHere: 'Diagramm hier zentrieren', minimize: (x) => `${x} minimieren`, expand: (x) => `${x} erweitern`, allBoxes: 'alle Boxen', diagram: 'Diagramm',
    noConnection: 'Wähle oder erstelle eine Verbindung in Power Platform ToolBox, dann lädt das Tool automatisch.',
    noData: 'Keine Daten. Öffne dieses Tool aus Power Platform ToolBox mit einer verbundenen Umgebung.', language: 'Sprache',
  },
}

const it = {
  name: 'Italiano',
  types: { channel: 'Canale', workstream: 'Flusso di lavoro', ruleset: 'Set di regole', rule: 'Regola', queue: 'Coda', overflow: 'Overflow', hours: 'Orario', capacity: 'Capacità', user: 'Utente' },
  sections: { hours: 'Orario', pre: 'PreQueue', in: 'InQueue', members: 'Agenti' },
  channels: { voice: 'Voce', whatsapp: 'WhatsApp', chat: 'Chat', teams: 'Teams', facebook: 'Facebook', sms: 'SMS', custom: 'Messaggistica personalizzata' },
  edges: { step: (n) => `passo ${n}`, defaultQueue: 'coda predefinita', bot: 'bot', capacity: 'capacità', hours: 'orario', pre: 'overflow pre-coda', in: 'overflow in coda', assignment: 'assegnazione', transfer: 'trasferire' },
  fields: {
    type: 'Tipo', assignmentMethod: 'Metodo di assegnazione', priority: 'Priorità', isDefault: 'Coda predefinita', hours: 'Orario', email: 'Email', status: 'Stato',
    action: 'Azione', target: 'Destinazione', name: 'Nome', maxUnits: 'Max. predefinito', blockAssignment: 'Blocca assegnazione', channel: 'Canale', distribution: 'Distribuzione',
    mode: 'Modalità', direction: 'Direzione', capacityRequired: 'Capacità richiesta', defaultQueue: 'Coda predefinita', bot: 'Bot', phone: 'Telefono', workstream: 'Flusso di lavoro',
    uniqueName: 'Nome univoco', authoring: 'Modalità di creazione', description: 'Descrizione', condition: 'Condizione', actions: 'Azioni', orderBy: 'Ordina per',
  },
  text: {
    noName: '(senza nome)', inactive: 'INATTIVO', bot: 'Bot', max: (n) => `Max. ${n}`, always: 'sempre', alwaysCap: 'Sempre', when: (c) => `Se ${c}`,
    queueArrow: 'Coda →', overflowArrow: 'Overflow →', queue: 'Coda', queueNotFound: 'Non trovata tra le code omnicanale',
    outsideHours: 'fuori orario', insideHours: 'in orario',
    extracted: 'Estratto il', tablesFailed: (n) => `${n} tabella/e non leggibili`, search: 'Cerca ovunque…', showInDiagram: 'Mostra nel diagramma',
    pick: 'Scegli un elemento dall’elenco per disegnare tutto ciò che entra ed esce.', loading: 'Lettura della configurazione del Contact Center…',
    nodes: 'nodi', links: 'relazioni', collapseAll: 'Comprimi tutto', expandAll: 'Espandi tutto', exportPng: 'Esporta PNG', copyMermaid: 'Copia Mermaid',
    centerHere: 'Centra il diagramma qui', minimize: (x) => `Riduci ${x}`, expand: (x) => `Espandi ${x}`, allBoxes: 'tutte le caselle', diagram: 'diagramma',
    noConnection: 'Scegli o crea una connessione in Power Platform ToolBox e lo strumento si caricherà automaticamente.',
    noData: 'Nessun dato. Apri questo strumento da Power Platform ToolBox con un ambiente connesso.', language: 'Lingua',
  },
}

export const LANGS = { en, es, pt, fr, de, it }

const KEY = 'ccmap.lang'
export function initialLang() {
  try {
    const saved = localStorage.getItem(KEY)
    if (LANGS[saved]) return saved
  } catch {}
  const sys = (globalThis.navigator?.language ?? 'en').slice(0, 2).toLowerCase()
  return LANGS[sys] ? sys : 'en'
}
export function saveLang(lang) {
  try { localStorage.setItem(KEY, lang) } catch {}
}
