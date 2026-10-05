// DEV ONLY (`npm run dev`, URL with ?fakehost[&env=Production]): an in-memory stand-in for the PPTB
// host backed by dev/raw.json, so the edit flow can be exercised without touching a real org.
// main.jsx only imports it when import.meta.env.DEV, so it never ships in the published build.
import { QUERIES } from './queries.js'

const EXTRA_USERS = ['Olivia Brown', 'Noah Wilson', 'Emma Davis'].map((name, i) => ({
  systemuserid: `00000000-0000-4000-9000-00000000000${i + 1}`, fullname: name, internalemailaddress: name.toLowerCase().replace(' ', '.') + '@contoso.com', isdisabled: false,
}))

const FV = '@OData.Community.Display.V1.FormattedValue'
// raw snapshot key per table, and the lookups the fake metadata exposes
const TABLES = {
  queue: 'queues', msdyn_liveworkstream: 'workstreams', msdyn_decisioncontract: 'contracts', msdyn_decisionruleset: 'rulesets',
  msdyn_ocliveworkstreamcontextvariable: 'contextVariables', msdyn_liveworkstreamcapacityprofile: 'workstreamCapacity',
  msdyn_routingconfiguration: 'routingConfigs', msdyn_routingconfigurationstep: 'routingSteps',
  msdyn_capacityprofile: 'capacityProfiles', msdyn_operatinghour: 'operatingHours',
}
const LOOKUPS = {
  queue: [['msdyn_operatinghourid', 'msdyn_operatinghour']],
  msdyn_liveworkstream: [['msdyn_routingcontractid', 'msdyn_decisioncontract'], ['msdyn_defaultqueue', 'queue'], ['msdyn_outboundqueueid', 'queue'], ['msdyn_sessiontemplate_default', 'msdyn_sessiontemplate']],
  msdyn_ocliveworkstreamcontextvariable: [['msdyn_liveworkstreamid', 'msdyn_liveworkstream']],
  msdyn_liveworkstreamcapacityprofile: [['msdyn_workstream_id', 'msdyn_liveworkstream'], ['msdyn_capacityprofile_id', 'msdyn_capacityprofile']],
  msdyn_decisionruleset: [['msdyn_inputcontractid', 'msdyn_decisioncontract'], ['msdyn_outputcontractid', 'msdyn_decisioncontract']],
  msdyn_routingconfiguration: [['msdyn_liveworkstreamid', 'msdyn_liveworkstream']],
  msdyn_routingconfigurationstep: [['msdyn_routingconfigurationid', 'msdyn_routingconfiguration'], ['msdyn_rulesetid', 'msdyn_decisionruleset']],
}
const idField = (entity) => ({ msdyn_ocliveworkstreamcontextvariable: 'msdyn_ocliveworkstreamcontextvariableid' })[entity] ?? `${entity}id`

export async function installFakeHost() {
  const snap = await (await fetch('dev/raw.json')).json()
  const raw = structuredClone(snap.raw)
  const table = (entity) => (raw[TABLES[entity]] ??= [])
  const allUsers = [...raw.users, ...EXTRA_USERS]
  const syncUsers = () => { raw.users = allUsers.filter((u) => raw.memberships.some((m) => m.systemuserid === u.systemuserid)) }
  const env = new URLSearchParams(location.search).get('env') ?? snap.environment ?? 'Dev'

  globalThis.toolboxAPI = {
    connections: { getActiveConnection: async () => ({ name: snap.org, url: `https://${snap.org}`, environment: env }) },
    events: { on() {} },
    utils: {
      showNotification: async ({ type, title, body }) => console.info(`[fake notify:${type}] ${title} — ${body}`),
      copyToClipboard: (t) => navigator.clipboard.writeText(t),
      getCurrentTheme: async () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    },
    fileSystem: { saveFile: async (name) => (console.info('[fake saveFile]', name), name) },
  }
  // Applies a create/update body the way Dataverse would: lookups (bound, or cleared with null) land in
  // their _x_value column with the target's name as label; option values reuse a label already seen.
  const write = (entity, row, record) => {
    for (const [key, value] of Object.entries(record)) {
      const nav = /^(\w+?)(@odata\.bind)?$/.exec(key)[1]
      const lookup = (LOOKUPS[entity] ?? []).find(([attr]) => attr === nav)
      if (lookup) {
        const target = value && /\(([^)]+)\)/.exec(value)[1]
        const ref = target && table(lookup[1]).find((r) => r[idField(lookup[1])] === target)
        Object.assign(row, { [`_${nav}_value`]: target ?? null, [`_${nav}_value${FV}`]: ref?.msdyn_name ?? ref?.name ?? target ?? null })
      } else {
        row[key] = value
        const label = table(entity).find((r) => r !== row && r[key] === value && r[key + FV])?.[key + FV]
        row[key + FV] = label ?? (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : undefined)
      }
    }
    return row
  }
  globalThis.dataverseAPI = {
    queryData: async (q) => {
      const search = /contains\(fullname,'([^']*)'\)/.exec(q)
      if (search) {
        const text = decodeURIComponent(search[1]).replace(/''/g, "'").toLowerCase()
        return { value: allUsers.filter((u) => u.fullname.toLowerCase().includes(text) || u.internalemailaddress.includes(text)) }
      }
      const rel = /EntityDefinitions\(LogicalName='(\w+)'\)\/ManyToOneRelationships/.exec(q)
      if (rel) return { value: (LOOKUPS[rel[1]] ?? []).map(([attr, target]) => ({ ReferencingAttribute: attr, ReferencingEntityNavigationPropertyName: attr, ReferencedEntity: target })) }
      const set = /EntityDefinitions\(LogicalName='(\w+)'\)\?\$select=EntitySetName/.exec(q)
      if (set) return { EntitySetName: set[1] + 's' }
      const key = Object.keys(QUERIES).find((k) => QUERIES[k] === q)
      return { value: structuredClone(raw[key] ?? []) }
    },
    associate: async (_entity, queueId, _rel, _related, userId) => {
      if (env === 'Production' && location.search.includes('fail')) throw new Error('403 Principal user is missing prvAppendToQueue privilege (simulated)')
      raw.memberships.push({ queueid: queueId, systemuserid: userId })
      syncUsers()
    },
    disassociate: async (_entity, queueId, _rel, userId) => {
      raw.memberships = raw.memberships.filter((m) => !(m.queueid === queueId && m.systemuserid === userId))
      syncUsers()
    },
    retrieve: async (entity, id) => {
      const row = table(entity).find((r) => r[idField(entity)] === id)
      if (!row) throw new Error(`fake host: ${entity} ${id} not found`)
      return structuredClone(row)
    },
    update: async (entity, id, record) => {
      if (location.search.includes('stale')) throw new Error('simulated concurrent edit')
      write(entity, table(entity).find((r) => r[idField(entity)] === id), record)
    },
    create: async (entity, record) => {
      if (location.search.includes('failws') && entity === 'msdyn_routingconfiguration') throw new Error('403 missing prvCreatemsdyn_routingconfiguration (simulated)')
      const id = record[idField(entity)] ?? crypto.randomUUID()
      const rows = table(entity)
      const row = write(entity, { [idField(entity)]: id }, record)
      if (entity === 'queue') Object.assign(row, { _msdyn_prequeueoverflowrulesetid_value: null, _msdyn_inqueueoverflowrulesetid_value: null })
      rows.push(row)
      if (entity === 'msdyn_liveworkstream') row.statecode = 0
      return { id }
    },
    delete: async (entity, id) => {
      const key = TABLES[entity]
      raw[key] = table(entity).filter((r) => r[idField(entity)] !== id)
    },
  }
}
