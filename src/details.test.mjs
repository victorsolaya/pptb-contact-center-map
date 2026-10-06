import assert from 'node:assert/strict'

// fake ToolBox host: metadata answers, one live record per entity, recorded writes
const writes = []
const live = {}
let failOn = null
globalThis.toolboxAPI = {}
globalThis.dataverseAPI = {
  queryData: async (query) => {
    const relationshipMatch = /EntityDefinitions\(LogicalName='(\w+)'\)\/ManyToOneRelationships/.exec(query)
    if (relationshipMatch) {
      const lookups = {
        msdyn_liveworkstream: [['msdyn_defaultqueue', 'queue']],
        queue: [['msdyn_operatinghourid', 'msdyn_operatinghour']],
        msdyn_liveworkstreamcapacityprofile: [['msdyn_workstream_id', 'msdyn_liveworkstream'], ['msdyn_capacityprofile_id', 'msdyn_capacityprofile']],
      }[relationshipMatch[1]] ?? []
      return { value: lookups.map(([attr, target]) => ({ ReferencingAttribute: attr, ReferencingEntityNavigationPropertyName: `nav_${attr}`, ReferencedEntity: target })) }
    }
    const entitySetMatch = /EntityDefinitions\(LogicalName='(\w+)'\)\?\$select=EntitySetName/.exec(query)
    if (entitySetMatch) return { EntitySetName: `${entitySetMatch[1]}_set` }
    throw new Error('unexpected query ' + query)
  },
  retrieve: async (entity) => structuredClone(live[entity]),
  update: async (entity, id, record) => {
    writes.push(['update', entity, id, record])
    // what Dataverse would hold afterwards (lookups resolved back to their value column)
    for (const [key, value] of Object.entries(record)) {
      const navMatch = /^nav_(\w+?)(@odata\.bind)?$/.exec(key)
      if (navMatch) live[entity][`_${navMatch[1]}_value`] = value && /\(([^)]+)\)/.exec(value)[1]
      else live[entity][key] = value
    }
  },
  create: async (entity, record) => {
    if (entity === failOn) { failOn = null; throw new Error(`403 cannot create ${entity}`) } // fails once
    writes.push(['create', entity, record])
    return { id: `${entity}-${writes.length}` }
  },
  delete: async (entity, id) => writes.push(['delete', entity, id]),
}
const { planDetails, initialForm, runSteps, undoAll, recordOf, profileUse, UNIT_BASED, PROFILE_BASED } = await import('./details.js')

const workstream = { msdyn_liveworkstreamid: 'ws-1', msdyn_name: 'Chat', msdyn_capacityformat: UNIT_BASED, msdyn_capacityrequired: 30, _msdyn_defaultqueue_value: 'q-1' }
const raw = {
  workstreams: [workstream],
  queues: [{ queueid: 'q-1', name: 'Sales', msdyn_priority: 10, _msdyn_operatinghourid_value: null }],
  capacityProfiles: [{ msdyn_capacityprofileid: 'cap-1', msdyn_name: 'Voice', msdyn_defaultmaxunits: 1, msdyn_blockassignment: true }, { msdyn_capacityprofileid: 'cap-2', msdyn_name: 'Chat' }],
  workstreamCapacity: [{ msdyn_liveworkstreamcapacityprofileid: 'link-1', msdyn_name: 'Chat voice link', _msdyn_workstream_id_value: 'ws-1', _msdyn_capacityprofile_id_value: 'cap-1' }],
}
const workstreamNode = { id: 'workstream:ws-1', type: 'workstream' }
const reset = () => { writes.length = 0; Object.assign(live, { msdyn_liveworkstream: { ...workstream }, queue: { ...raw.queues[0] } }) }

// nothing changed: nothing to do; placeholder queues are not editable
assert.equal(planDetails(raw, workstreamNode, initialForm(raw, workstreamNode)).steps.length, 0)
assert.equal(recordOf(raw, { id: 'queue:q-1', type: 'queue', missing: true }), undefined)
assert.equal(profileUse(raw, 'cap-1'), 1)

// name + fallback queue: one checked update, lookups bound through metadata; undo writes the old values back
reset()
let plan = planDetails(raw, workstreamNode, { ...initialForm(raw, workstreamNode), msdyn_name: 'Chat EU', _msdyn_defaultqueue_value: 'q-2' })
assert.deepEqual(plan.changes.map((change) => change.col), ['msdyn_name', '_msdyn_defaultqueue_value'])
let undos = await runSteps(plan.steps)
assert.deepEqual(writes[0], ['update', 'msdyn_liveworkstream', 'ws-1', { msdyn_name: 'Chat EU', 'nav_msdyn_defaultqueue@odata.bind': '/queue_set(q-2)' }])
assert.deepEqual(await undoAll(undos), [])
assert.deepEqual(writes[1][3], { msdyn_name: 'Chat', 'nav_msdyn_defaultqueue@odata.bind': '/queue_set(q-1)' })

// a queue without hours gets some; undo clears the lookup again (navigation property set to null)
reset()
const queueNode = { id: 'queue:q-1', type: 'queue' }
undos = await runSteps(planDetails(raw, queueNode, { ...initialForm(raw, queueNode), _msdyn_operatinghourid_value: 'h-1' }).steps)
await undoAll(undos)
assert.deepEqual(writes.map((write) => write[3]), [{ 'nav_msdyn_operatinghourid@odata.bind': '/msdyn_operatinghour_set(h-1)' }, { nav_msdyn_operatinghourid: null }])

// changed meanwhile (e.g. in the admin center): refused before anything is written
reset()
live.msdyn_liveworkstream.msdyn_name = 'Renamed elsewhere'
await assert.rejects(runSteps(planDetails(raw, workstreamNode, { ...initialForm(raw, workstreamNode), msdyn_name: 'Mine' }).steps), (e) => e.code === 'staleRecord')
assert.equal(writes.length, 0)

// switch to profile based: unlink cap-1, create a new profile and link it, link cap-2; undo newest first
reset()
const newProfile = { id: 'cap-new', name: ' Email ', units: 3, block: false }
plan = planDetails(raw, workstreamNode, { ...initialForm(raw, workstreamNode), msdyn_capacityformat: PROFILE_BASED, profiles: ['cap-2'], newProfile })
assert.deepEqual([plan.unlink.map((link) => link.msdyn_liveworkstreamcapacityprofileid), plan.link], [['link-1'], ['cap-2']])
undos = await runSteps(plan.steps)
assert.deepEqual(writes.map(([op, entity]) => `${op} ${entity}`), [
  'update msdyn_liveworkstream', 'delete msdyn_liveworkstreamcapacityprofile', 'create msdyn_capacityprofile',
  'create msdyn_liveworkstreamcapacityprofile', 'create msdyn_liveworkstreamcapacityprofile',
])
assert.deepEqual(writes[2][2], { msdyn_capacityprofileid: 'cap-new', msdyn_uniquename: 'new_cap-new', msdyn_name: 'Email', msdyn_defaultmaxunits: 3, msdyn_blockassignment: false, msdyn_resetduration: 192350000 })
assert.deepEqual(writes[3][2], { msdyn_name: 'Chat', 'nav_msdyn_workstream_id@odata.bind': '/msdyn_liveworkstream_set(ws-1)', 'nav_msdyn_capacityprofile_id@odata.bind': '/msdyn_capacityprofile_set(cap-new)' })
writes.length = 0
assert.deepEqual(await undoAll(undos), [])
assert.deepEqual(writes.map(([op, entity]) => `${op} ${entity}`), [
  'delete msdyn_liveworkstreamcapacityprofile', 'delete msdyn_liveworkstreamcapacityprofile', 'delete msdyn_capacityprofile',
  'create msdyn_liveworkstreamcapacityprofile', 'update msdyn_liveworkstream',
])
assert.equal(writes[3][2]['nav_msdyn_capacityprofile_id@odata.bind'], '/msdyn_capacityprofile_set(cap-1)', 'the removed link comes back')
assert.equal(writes[3][2].msdyn_name, 'Chat voice link', 'with its original name')

// the record is gone (deleted elsewhere): nothing to plan, no crash
assert.equal(planDetails({ ...raw, workstreams: [] }, workstreamNode, initialForm(raw, workstreamNode)).steps.length, 0)

// profiles are left alone while unit based
assert.equal(planDetails(raw, workstreamNode, { ...initialForm(raw, workstreamNode), profiles: [] }).steps.length, 0)

// a failure halfway reverts what was done and says so; a retried undo only redoes what failed
reset()
failOn = 'msdyn_liveworkstreamcapacityprofile'
await assert.rejects(runSteps(plan.steps), (e) => e.code === 'reverted' && e.leftovers.length === 0)
assert.deepEqual(writes.slice(-3).map(([op, entity]) => `${op} ${entity}`), ['delete msdyn_capacityprofile', 'create msdyn_liveworkstreamcapacityprofile', 'update msdyn_liveworkstream'])
const flaky = Object.assign(async () => { if (flaky.broken) throw new Error('locked') }, { label: 'x 1', broken: true })
const ok = async () => {}
let failed = await undoAll([ok, flaky, ok])
assert.deepEqual(failed.map((undo) => undo.label), ['x 1'])
flaky.broken = false
assert.deepEqual(await undoAll(failed), [])
console.log('details ok')
