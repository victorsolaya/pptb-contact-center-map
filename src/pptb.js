// Inside Power Platform ToolBox the host owns the connection (interactive login, client secret...):
// the tool never sees credentials, it only calls window.dataverseAPI. queryData already asks for
// FormattedValue annotations and returns @odata.nextLink, which we follow for >5000-row tables.
import { QUERIES } from './queries.js'
import { normGuid } from './rules.js'

export const inPptb = () => Boolean(globalThis.toolboxAPI && globalThis.dataverseAPI)

// All pages of one OData query; a failing table becomes { error } so the map still draws.
export async function fetchQuery(query) {
  try {
    const rows = []
    for (let pageQuery = query; pageQuery; ) {
      const page = await dataverseAPI.queryData(pageQuery)
      rows.push(...page.value)
      pageQuery = page['@odata.nextLink']?.split(/\/api\/data\/v[\d.]+\//)[1]
    }
    return rows
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}

export async function loadFromPptb(keys = Object.keys(QUERIES)) {
  const connection = await toolboxAPI.connections.getActiveConnection()
  if (!connection) return null // UI shows "pick a connection"; reloads on connection:updated
  const raw = {}
  await Promise.all(keys.map(async (key) => { raw[key] = await fetchQuery(QUERIES[key]) }))
  return { org: connection.name || new URL(connection.url).hostname, environment: connection.environment, extractedAt: new Date().toISOString(), raw }
}

// ---------------------------------------------------------------- lookups from this org's metadata

const relationshipCache = new Map()
const entitySetCache = new Map()
// metadata differs between orgs: forget it when the connection changes
export const clearMetadataCache = () => { relationshipCache.clear(); entitySetCache.clear() }
export async function relationships(entity) {
  if (!relationshipCache.has(entity)) {
    const manyToOne = await fetchQuery(`EntityDefinitions(LogicalName='${entity}')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity`)
    if (manyToOne.error) throw new Error(manyToOne.error)
    relationshipCache.set(entity, manyToOne)
  }
  return relationshipCache.get(entity)
}
async function entitySet(entity) {
  if (!entitySetCache.has(entity)) entitySetCache.set(entity, (await dataverseAPI.queryData(`EntityDefinitions(LogicalName='${entity}')?$select=EntitySetName`)).EntitySetName)
  return entitySetCache.get(entity)
}
// `{ "<navigation property>@odata.bind": "/<entity set>(<id>)" }` for a lookup column;
// id null clears it (`{ "<navigation property>": null }`, the documented PATCH form).
export async function bind(entity, attribute, id) {
  const relationship = (await relationships(entity)).find((candidate) => candidate.ReferencingAttribute === attribute)
  if (!relationship) throw new Error(`${entity}.${attribute} is not a lookup in this environment`)
  if (id == null) return { [relationship.ReferencingEntityNavigationPropertyName]: null }
  return { [`${relationship.ReferencingEntityNavigationPropertyName}@odata.bind`]: `/${await entitySet(relationship.ReferencedEntity)}(${normGuid(id)})` }
}

// ToolBox notification; outside ToolBox (dev) nothing is logged: the text can contain user names.
export const notify = (title, body, type) => inPptb() && toolboxAPI.utils.showNotification({ title, body, type })

// Files and clipboard go through the host: a sandboxed tool iframe can't trigger downloads.
export async function saveFile(name, dataUrlOrText) {
  if (!inPptb()) {
    const href = dataUrlOrText.startsWith('data:') ? dataUrlOrText : 'data:text/plain;charset=utf-8,' + encodeURIComponent(dataUrlOrText)
    return Object.assign(document.createElement('a'), { href, download: name }).click()
  }
  const content = dataUrlOrText.startsWith('data:')
    ? Uint8Array.from(atob(dataUrlOrText.split(',')[1]), (char) => char.charCodeAt(0))
    : dataUrlOrText
  await toolboxAPI.fileSystem.saveFile(name, content)
}

export const currentTheme = async () =>
  inPptb() ? toolboxAPI.utils.getCurrentTheme() : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const copyText =(text) => (inPptb() ? toolboxAPI.utils.copyToClipboard(text) : navigator.clipboard.writeText(text))
