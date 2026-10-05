import assert from 'node:assert/strict'

const calls = []
globalThis.toolboxAPI = { connections: { getActiveConnection: async () => ({ name: 'CRM PRE', url: 'https://x.crm4.dynamics.com', environment: 'UAT' }) } }
globalThis.dataverseAPI = {
  queryData: async (q) => (calls.push(['query', q]), { value: [{ systemuserid: 'u1', fullname: "Ana O'Neil", internalemailaddress: 'ana@x.com' }] }),
  associate: async (...a) => calls.push(['associate', ...a]),
  disassociate: async (...a) => calls.push(['disassociate', ...a]),
}
const { searchUsers, addMember, removeMember, MEMBER_TABLES } = await import('./edit.js')
const { loadFromPptb } = await import('./pptb.js')

// search: quotes escaped for OData, value URL-encoded, app users excluded
const found = await searchUsers(" O'Ne ")
assert.deepEqual(found, [{ id: 'user:u1', label: "Ana O'Neil", sub: 'ana@x.com' }])
const q = calls.at(-1)[1]
assert.match(q, /contains\(fullname,'O''Ne'\)/)
assert.match(q, /isdisabled eq false and applicationid eq null/)
assert.deepEqual(await searchUsers('   '), [])

// writes use the queue <-> systemuser N:N with bare GUIDs
await addMember('queue:q1', 'user:u1')
await removeMember('queue:q1', 'user:u1')
assert.deepEqual(calls.at(-2), ['associate', 'queue', 'q1', 'queuemembership_association', 'systemuser', 'u1'])
assert.deepEqual(calls.at(-1), ['disassociate', 'queue', 'q1', 'queuemembership_association', 'u1'])

// partial refresh only re-reads the requested tables and carries the environment
const snap = await loadFromPptb(MEMBER_TABLES)
assert.deepEqual(Object.keys(snap.raw).sort(), ['memberships', 'users'])
assert.equal(snap.environment, 'UAT')
console.log('edit ok')
