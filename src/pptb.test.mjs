import assert from 'node:assert/strict'
import { QUERIES } from './queries.js'

// fake PPTB host: memberships come in two pages, rulesets fails
const calls = []
globalThis.toolboxAPI = { connections: { getActiveConnection: async () => ({ name: 'CRM PRE', url: 'https://x.crm4.dynamics.com' }) } }
globalThis.dataverseAPI = {
  queryData: async (query) => {
    calls.push(query)
    if (query.startsWith('queuememberships?$select') && !query.includes('skiptoken'))
      return { value: [{ id: 1 }], '@odata.nextLink': 'https://x.crm4.dynamics.com/api/data/v9.2/queuememberships?$select=queueid&$skiptoken=abc' }
    if (query.includes('skiptoken')) return { value: [{ id: 2 }] }
    if (query.startsWith('msdyn_decisionrulesets')) throw new Error('403 sin permiso')
    return { value: [] }
  },
}
const { loadFromPptb } = await import('./pptb.js')
const snapshot = await loadFromPptb()
assert.equal(snapshot.org, 'CRM PRE')
assert.deepEqual(snapshot.raw.memberships, [{ id: 1 }, { id: 2 }])
assert.ok(calls.includes('queuememberships?$select=queueid&$skiptoken=abc'), 'nextLink followed relative to /api/data/v9.2/')
assert.deepEqual(snapshot.raw.rulesets, { error: '403 sin permiso' })
assert.equal(Object.keys(snapshot.raw).length, Object.keys(QUERIES).length)
console.log('pptb ok')
