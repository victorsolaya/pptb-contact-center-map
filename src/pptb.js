// Inside Power Platform ToolBox the host owns the connection (interactive login, client secret...):
// the tool never sees credentials, it only calls window.dataverseAPI. queryData already asks for
// FormattedValue annotations and returns @odata.nextLink, which we follow for >5000-row tables.
import { QUERIES } from './queries.js'

export const inPptb = () => Boolean(globalThis.toolboxAPI && globalThis.dataverseAPI)

// All pages of one OData query; a failing table becomes { error } so the map still draws.
export async function fetchQuery(query) {
  try {
    const rows = []
    for (let q = query; q; ) {
      const page = await dataverseAPI.queryData(q)
      rows.push(...page.value)
      q = page['@odata.nextLink']?.split(/\/api\/data\/v[\d.]+\//)[1]
    }
    return rows
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}

export async function loadFromPptb(keys = Object.keys(QUERIES)) {
  const conn = await toolboxAPI.connections.getActiveConnection()
  if (!conn) return null // UI shows "pick a connection"; reloads on connection:updated
  const raw = {}
  await Promise.all(keys.map(async (key) => { raw[key] = await fetchQuery(QUERIES[key]) }))
  return { org: conn.name || new URL(conn.url).hostname, environment: conn.environment, extractedAt: new Date().toISOString(), raw }
}

export const notify = (title, body, type) => (inPptb() ? toolboxAPI.utils.showNotification({ title, body, type }) : console.log(type, title, body))

// Files and clipboard go through the host: a sandboxed tool iframe can't trigger downloads.
export async function saveFile(name, dataUrlOrText) {
  if (!inPptb()) {
    const href = dataUrlOrText.startsWith('data:') ? dataUrlOrText : 'data:text/plain;charset=utf-8,' + encodeURIComponent(dataUrlOrText)
    return Object.assign(document.createElement('a'), { href, download: name }).click()
  }
  const content = dataUrlOrText.startsWith('data:')
    ? Uint8Array.from(atob(dataUrlOrText.split(',')[1]), (c) => c.charCodeAt(0))
    : dataUrlOrText
  await toolboxAPI.fileSystem.saveFile(name, content)
}

export const copyText = (text) => (inPptb() ? toolboxAPI.utils.copyToClipboard(text) : navigator.clipboard.writeText(text))
