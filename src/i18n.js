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
  edit: {
    mode: 'Edit mode', env: 'Environment', addAgent: '+ Add agent', remove: 'Remove from queue',
    searchUsers: 'Search users by name or email…', searching: 'Searching…', noResults: 'No users found', alreadyMember: 'already in this queue',
    addTitle: (q) => `Add an agent to "${q}"`, removeTitle: 'Remove an agent',
    confirmAdd: (u, q) => `${u} will be added to the queue "${q}".`, confirmRemove: (u, q) => `${u} will be removed from the queue "${q}".`,
    target: (org, env) => `Environment: ${org} (${env})`, production: 'This is a PRODUCTION environment. The change applies immediately.',
    add: 'Add', removeBtn: 'Remove', cancel: 'Cancel', back: 'Back', undo: 'Undo', working: 'Applying…',
    added: (u, q) => `${u} added to "${q}"`, removed: (u, q) => `${u} removed from "${q}"`, failed: 'The change could not be applied',
    newQueue: '+ New queue', queueTitle: 'New queue', name: 'Name', queueType: 'Type', strategy: 'Assignment method', priority: 'Priority', hours: 'Operating hours', none: '(none)',
    confirmQueue: (n) => `The omnichannel queue "${n}" will be created. Add agents to it afterwards from its card.`, queueCreated: (n) => `Queue "${n}" created`, queueDeleted: (n) => `Queue "${n}" deleted`,
    addRule: '+ Add rule', removeRule: 'Delete rule', ruleTitle: (rs) => `New rule in "${rs}"`, ruleName: 'Rule name',
    conditions: 'Conditions (all must match)', addCondition: '+ Condition', noConditions: 'No conditions: the rule always applies.', then: 'Then', routeTo: 'Route to queue',
    setVar: 'Set', addSet: '+ Set another variable', value: 'Value', appendNote: 'The rule is added at the end; rules are evaluated in order.',
    confirmRule: (rs) => `This rule will be added at the end of "${rs}":`, confirmRemoveRule: (rs) => `This rule will be deleted from "${rs}":`,
    ruleAdded: (rs) => `Rule added to "${rs}"`, ruleRemoved: (rs) => `Rule deleted from "${rs}"`, removeRuleTitle: 'Delete a rule',
    stale: 'This ruleset was changed elsewhere after the map was loaded. Reload the tool and try again.', loadingContract: 'Reading the ruleset contract…', next: 'Next', required: 'Fill in the name and every value.',
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
  edit: {
    mode: 'Modo edición', env: 'Entorno', addAgent: '+ Añadir agente', remove: 'Quitar de la cola',
    searchUsers: 'Buscar usuarios por nombre o email…', searching: 'Buscando…', noResults: 'No se encontraron usuarios', alreadyMember: 'ya está en esta cola',
    addTitle: (q) => `Añadir un agente a «${q}»`, removeTitle: 'Quitar un agente',
    confirmAdd: (u, q) => `Se añadirá a ${u} a la cola «${q}».`, confirmRemove: (u, q) => `Se quitará a ${u} de la cola «${q}».`,
    target: (org, env) => `Entorno: ${org} (${env})`, production: 'Es un entorno de PRODUCCIÓN. El cambio se aplica al momento.',
    add: 'Añadir', removeBtn: 'Quitar', cancel: 'Cancelar', back: 'Atrás', undo: 'Deshacer', working: 'Aplicando…',
    added: (u, q) => `${u} añadido a «${q}»`, removed: (u, q) => `${u} quitado de «${q}»`, failed: 'No se pudo aplicar el cambio',
    newQueue: '+ Nueva cola', queueTitle: 'Nueva cola', name: 'Nombre', queueType: 'Tipo', strategy: 'Método de asignación', priority: 'Prioridad', hours: 'Horario', none: '(ninguno)',
    confirmQueue: (n) => `Se creará la cola omnicanal «${n}». Después podrás añadirle agentes desde su tarjeta.`, queueCreated: (n) => `Cola «${n}» creada`, queueDeleted: (n) => `Cola «${n}» eliminada`,
    addRule: '+ Añadir regla', removeRule: 'Eliminar regla', ruleTitle: (rs) => `Nueva regla en «${rs}»`, ruleName: 'Nombre de la regla',
    conditions: 'Condiciones (deben cumplirse todas)', addCondition: '+ Condición', noConditions: 'Sin condiciones: la regla se aplica siempre.', then: 'Entonces', routeTo: 'Enrutar a la cola',
    setVar: 'Establecer', addSet: '+ Establecer otra variable', value: 'Valor', appendNote: 'La regla se añade al final; las reglas se evalúan en orden.',
    confirmRule: (rs) => `Se añadirá esta regla al final de «${rs}»:`, confirmRemoveRule: (rs) => `Se eliminará esta regla de «${rs}»:`,
    ruleAdded: (rs) => `Regla añadida a «${rs}»`, ruleRemoved: (rs) => `Regla eliminada de «${rs}»`, removeRuleTitle: 'Eliminar una regla',
    stale: 'Este conjunto de reglas se ha modificado en otro sitio después de cargar el mapa. Recarga la herramienta y vuelve a intentarlo.', loadingContract: 'Leyendo el contrato del conjunto de reglas…', next: 'Siguiente', required: 'Rellena el nombre y todos los valores.',
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
  edit: {
    mode: 'Modo de edição', env: 'Ambiente', addAgent: '+ Adicionar agente', remove: 'Remover da fila',
    searchUsers: 'Pesquisar usuários por nome ou email…', searching: 'Pesquisando…', noResults: 'Nenhum usuário encontrado', alreadyMember: 'já está nesta fila',
    addTitle: (q) => `Adicionar um agente a "${q}"`, removeTitle: 'Remover um agente',
    confirmAdd: (u, q) => `${u} será adicionado à fila "${q}".`, confirmRemove: (u, q) => `${u} será removido da fila "${q}".`,
    target: (org, env) => `Ambiente: ${org} (${env})`, production: 'Este é um ambiente de PRODUÇÃO. A alteração é aplicada imediatamente.',
    add: 'Adicionar', removeBtn: 'Remover', cancel: 'Cancelar', back: 'Voltar', undo: 'Desfazer', working: 'Aplicando…',
    added: (u, q) => `${u} adicionado a "${q}"`, removed: (u, q) => `${u} removido de "${q}"`, failed: 'Não foi possível aplicar a alteração',
    newQueue: '+ Nova fila', queueTitle: 'Nova fila', name: 'Nome', queueType: 'Tipo', strategy: 'Método de atribuição', priority: 'Prioridade', hours: 'Horário', none: '(nenhum)',
    confirmQueue: (n) => `A fila omnichannel "${n}" será criada. Depois adicione agentes a partir do seu cartão.`, queueCreated: (n) => `Fila "${n}" criada`, queueDeleted: (n) => `Fila "${n}" excluída`,
    addRule: '+ Adicionar regra', removeRule: 'Excluir regra', ruleTitle: (rs) => `Nova regra em "${rs}"`, ruleName: 'Nome da regra',
    conditions: 'Condições (todas devem ser atendidas)', addCondition: '+ Condição', noConditions: 'Sem condições: a regra sempre se aplica.', then: 'Então', routeTo: 'Rotear para a fila',
    setVar: 'Definir', addSet: '+ Definir outra variável', value: 'Valor', appendNote: 'A regra é adicionada no final; as regras são avaliadas em ordem.',
    confirmRule: (rs) => `Esta regra será adicionada no final de "${rs}":`, confirmRemoveRule: (rs) => `Esta regra será excluída de "${rs}":`,
    ruleAdded: (rs) => `Regra adicionada a "${rs}"`, ruleRemoved: (rs) => `Regra excluída de "${rs}"`, removeRuleTitle: 'Excluir uma regra',
    stale: 'Este conjunto de regras foi alterado em outro lugar depois que o mapa foi carregado. Recarregue a ferramenta e tente novamente.', loadingContract: 'Lendo o contrato do conjunto de regras…', next: 'Avançar', required: 'Preencha o nome e todos os valores.',
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
  edit: {
    mode: 'Mode édition', env: 'Environnement', addAgent: '+ Ajouter un agent', remove: 'Retirer de la file',
    searchUsers: 'Rechercher des utilisateurs par nom ou e-mail…', searching: 'Recherche…', noResults: 'Aucun utilisateur trouvé', alreadyMember: 'déjà dans cette file',
    addTitle: (q) => `Ajouter un agent à « ${q} »`, removeTitle: 'Retirer un agent',
    confirmAdd: (u, q) => `${u} sera ajouté à la file « ${q} ».`, confirmRemove: (u, q) => `${u} sera retiré de la file « ${q} ».`,
    target: (org, env) => `Environnement : ${org} (${env})`, production: 'Ceci est un environnement de PRODUCTION. La modification s’applique immédiatement.',
    add: 'Ajouter', removeBtn: 'Retirer', cancel: 'Annuler', back: 'Retour', undo: 'Annuler la modification', working: 'Application…',
    added: (u, q) => `${u} ajouté à « ${q} »`, removed: (u, q) => `${u} retiré de « ${q} »`, failed: 'La modification n’a pas pu être appliquée',
    newQueue: '+ Nouvelle file', queueTitle: 'Nouvelle file', name: 'Nom', queueType: 'Type', strategy: 'Méthode d’attribution', priority: 'Priorité', hours: 'Horaires', none: '(aucun)',
    confirmQueue: (n) => `La file omnicanal « ${n} » sera créée. Ajoutez-y ensuite des agents depuis sa carte.`, queueCreated: (n) => `File « ${n} » créée`, queueDeleted: (n) => `File « ${n} » supprimée`,
    addRule: '+ Ajouter une règle', removeRule: 'Supprimer la règle', ruleTitle: (rs) => `Nouvelle règle dans « ${rs} »`, ruleName: 'Nom de la règle',
    conditions: 'Conditions (toutes doivent être vraies)', addCondition: '+ Condition', noConditions: 'Aucune condition : la règle s’applique toujours.', then: 'Alors', routeTo: 'Router vers la file',
    setVar: 'Définir', addSet: '+ Définir une autre variable', value: 'Valeur', appendNote: 'La règle est ajoutée à la fin ; les règles sont évaluées dans l’ordre.',
    confirmRule: (rs) => `Cette règle sera ajoutée à la fin de « ${rs} » :`, confirmRemoveRule: (rs) => `Cette règle sera supprimée de « ${rs} » :`,
    ruleAdded: (rs) => `Règle ajoutée à « ${rs} »`, ruleRemoved: (rs) => `Règle supprimée de « ${rs} »`, removeRuleTitle: 'Supprimer une règle',
    stale: 'Cet ensemble de règles a été modifié ailleurs après le chargement de la carte. Rechargez l’outil et réessayez.', loadingContract: 'Lecture du contrat de l’ensemble de règles…', next: 'Suivant', required: 'Renseignez le nom et toutes les valeurs.',
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
  edit: {
    mode: 'Bearbeitungsmodus', env: 'Umgebung', addAgent: '+ Agent hinzufügen', remove: 'Aus Warteschlange entfernen',
    searchUsers: 'Benutzer nach Name oder E-Mail suchen…', searching: 'Suche…', noResults: 'Keine Benutzer gefunden', alreadyMember: 'bereits in dieser Warteschlange',
    addTitle: (q) => `Agent zu „${q}“ hinzufügen`, removeTitle: 'Agent entfernen',
    confirmAdd: (u, q) => `${u} wird zur Warteschlange „${q}“ hinzugefügt.`, confirmRemove: (u, q) => `${u} wird aus der Warteschlange „${q}“ entfernt.`,
    target: (org, env) => `Umgebung: ${org} (${env})`, production: 'Dies ist eine PRODUKTIONSUMGEBUNG. Die Änderung wird sofort wirksam.',
    add: 'Hinzufügen', removeBtn: 'Entfernen', cancel: 'Abbrechen', back: 'Zurück', undo: 'Rückgängig', working: 'Wird angewendet…',
    added: (u, q) => `${u} zu „${q}“ hinzugefügt`, removed: (u, q) => `${u} aus „${q}“ entfernt`, failed: 'Die Änderung konnte nicht angewendet werden',
    newQueue: '+ Neue Warteschlange', queueTitle: 'Neue Warteschlange', name: 'Name', queueType: 'Typ', strategy: 'Zuweisungsmethode', priority: 'Priorität', hours: 'Geschäftszeiten', none: '(keine)',
    confirmQueue: (n) => `Die Omnichannel-Warteschlange „${n}“ wird erstellt. Agenten fügst du danach über ihre Karte hinzu.`, queueCreated: (n) => `Warteschlange „${n}“ erstellt`, queueDeleted: (n) => `Warteschlange „${n}“ gelöscht`,
    addRule: '+ Regel hinzufügen', removeRule: 'Regel löschen', ruleTitle: (rs) => `Neue Regel in „${rs}“`, ruleName: 'Regelname',
    conditions: 'Bedingungen (alle müssen zutreffen)', addCondition: '+ Bedingung', noConditions: 'Keine Bedingungen: die Regel gilt immer.', then: 'Dann', routeTo: 'An Warteschlange weiterleiten',
    setVar: 'Setzen', addSet: '+ Weitere Variable setzen', value: 'Wert', appendNote: 'Die Regel wird am Ende hinzugefügt; Regeln werden der Reihe nach ausgewertet.',
    confirmRule: (rs) => `Diese Regel wird am Ende von „${rs}“ hinzugefügt:`, confirmRemoveRule: (rs) => `Diese Regel wird aus „${rs}“ gelöscht:`,
    ruleAdded: (rs) => `Regel zu „${rs}“ hinzugefügt`, ruleRemoved: (rs) => `Regel aus „${rs}“ gelöscht`, removeRuleTitle: 'Regel löschen',
    stale: 'Dieser Regelsatz wurde nach dem Laden der Karte an anderer Stelle geändert. Lade das Tool neu und versuche es erneut.', loadingContract: 'Vertrag des Regelsatzes wird gelesen…', next: 'Weiter', required: 'Name und alle Werte ausfüllen.',
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
  edit: {
    mode: 'Modalità modifica', env: 'Ambiente', addAgent: '+ Aggiungi agente', remove: 'Rimuovi dalla coda',
    searchUsers: 'Cerca utenti per nome o email…', searching: 'Ricerca…', noResults: 'Nessun utente trovato', alreadyMember: 'già in questa coda',
    addTitle: (q) => `Aggiungi un agente a "${q}"`, removeTitle: 'Rimuovi un agente',
    confirmAdd: (u, q) => `${u} verrà aggiunto alla coda "${q}".`, confirmRemove: (u, q) => `${u} verrà rimosso dalla coda "${q}".`,
    target: (org, env) => `Ambiente: ${org} (${env})`, production: 'Questo è un ambiente di PRODUZIONE. La modifica viene applicata subito.',
    add: 'Aggiungi', removeBtn: 'Rimuovi', cancel: 'Annulla', back: 'Indietro', undo: 'Annulla modifica', working: 'Applicazione…',
    added: (u, q) => `${u} aggiunto a "${q}"`, removed: (u, q) => `${u} rimosso da "${q}"`, failed: 'Impossibile applicare la modifica',
    newQueue: '+ Nuova coda', queueTitle: 'Nuova coda', name: 'Nome', queueType: 'Tipo', strategy: 'Metodo di assegnazione', priority: 'Priorità', hours: 'Orario', none: '(nessuno)',
    confirmQueue: (n) => `Verrà creata la coda omnicanale "${n}". Poi aggiungi gli agenti dalla sua scheda.`, queueCreated: (n) => `Coda "${n}" creata`, queueDeleted: (n) => `Coda "${n}" eliminata`,
    addRule: '+ Aggiungi regola', removeRule: 'Elimina regola', ruleTitle: (rs) => `Nuova regola in "${rs}"`, ruleName: 'Nome della regola',
    conditions: 'Condizioni (devono essere tutte vere)', addCondition: '+ Condizione', noConditions: 'Nessuna condizione: la regola si applica sempre.', then: 'Allora', routeTo: 'Instrada alla coda',
    setVar: 'Imposta', addSet: '+ Imposta un’altra variabile', value: 'Valore', appendNote: 'La regola viene aggiunta in fondo; le regole sono valutate in ordine.',
    confirmRule: (rs) => `Questa regola verrà aggiunta in fondo a "${rs}":`, confirmRemoveRule: (rs) => `Questa regola verrà eliminata da "${rs}":`,
    ruleAdded: (rs) => `Regola aggiunta a "${rs}"`, ruleRemoved: (rs) => `Regola eliminata da "${rs}"`, removeRuleTitle: 'Elimina una regola',
    stale: 'Questo set di regole è stato modificato altrove dopo il caricamento della mappa. Ricarica lo strumento e riprova.', loadingContract: 'Lettura del contratto del set di regole…', next: 'Avanti', required: 'Compila il nome e tutti i valori.',
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
