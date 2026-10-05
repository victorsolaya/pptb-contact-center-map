import assert from 'node:assert/strict'

// fake ToolBox host: metadata answers + recorded writes
const writes = []
let failOn = null
globalThis.toolboxAPI = {}
globalThis.dataverseAPI = {
  queryData: async (q) => {
    const rel = /EntityDefinitions\(LogicalName='(\w+)'\)\/ManyToOneRelationships/.exec(q)
    if (rel) {
      const lookups = {
        msdyn_liveworkstream: [['msdyn_routingcontractid', 'msdyn_decisioncontract'], ['msdyn_defaultqueue', 'queue'], ['msdyn_notificationtemplate_incoming_auth', 'msdyn_notificationtemplate']],
        msdyn_ocliveworkstreamcontextvariable: [['msdyn_liveworkstreamid', 'msdyn_liveworkstream']],
        msdyn_liveworkstreamcapacityprofile: [['msdyn_workstream_id', 'msdyn_liveworkstream'], ['msdyn_capacityprofile_id', 'msdyn_capacityprofile']],
        msdyn_decisionruleset: [['msdyn_inputcontractid', 'msdyn_decisioncontract'], ['msdyn_outputcontractid', 'msdyn_decisioncontract']],
        msdyn_routingconfiguration: [['msdyn_liveworkstreamid', 'msdyn_liveworkstream']],
        msdyn_routingconfigurationstep: [['msdyn_routingconfigurationid', 'msdyn_routingconfiguration'], ['msdyn_rulesetid', 'msdyn_decisionruleset']],
      }[rel[1]]
      // navigation property deliberately differs from the column name, as it can in real orgs
      return { value: lookups.map(([attr, target]) => ({ ReferencingAttribute: attr, ReferencingEntityNavigationPropertyName: `nav_${attr}`, ReferencedEntity: target })) }
    }
    const set = /EntityDefinitions\(LogicalName='(\w+)'\)\?\$select=EntitySetName/.exec(q)
    if (set) return { EntitySetName: `${set[1]}_set` }
    throw new Error('unexpected query ' + q)
  },
  retrieve: async (entity) =>
    entity === 'msdyn_liveworkstream'
      ? { msdyn_streamsource: 192390001, msdyn_mode: 717210001, msdyn_workdistributionmode: 192350000, msdyn_capacityrequired: 1, msdyn_apikey: 'secret',
          msdyn_sessiontemplate_default: 'bm_whatsapp_session', msdyn_notificationtemplate_incoming_auth: 'bm_whatsapp_incoming', 'msdyn_notificationtemplate_incoming_auth@OData.Community.Display.V1.FormattedValue': 'x',
          _msdyn_defaultqueue_value: 'q-fallback', _msdyn_bot_user_value: 'bot-1', '_msdyn_defaultqueue_value@OData.Community.Display.V1.FormattedValue': 'Fallback' }
      : { msdyn_contractdefinition: '<contract version="1"><complex key="liveworkitemcontext"><variable name="segment" data-type="string" /></complex></contract>' },
  create: async (entity, record) => {
    if (entity === failOn) throw new Error(`403 cannot create ${entity}`)
    writes.push(['create', entity, record])
    return { id: `${entity}-${writes.length}` }
  },
  delete: async (entity, id) => writes.push(['delete', entity, id]),
}
const { planWorkstream, createWorkstream, deleteCreated, templates } = await import('./workstream.js')

const route = `<decision hit-policy="all" version="1">\n  <rules>\n    <rule id="r1" name="VIP"><action><setattribute><lhs type="attribute">assign_to.queue</lhs><rhs type="staticvalue">q-vip</rhs></setattribute></action></rule>\n  </rules>\n</decision>`
const raw = {
  workstreams: [{ msdyn_liveworkstreamid: 'ws-1', msdyn_name: 'WhatsApp', _msdyn_routingcontractid_value: 'c-ws' }, { msdyn_liveworkstreamid: 'ws-sys', msdyn_name: 'LINE' }],
  contracts: [{ msdyn_decisioncontractid: 'c-ws', msdyn_uniquename: 'new_abc' }, { msdyn_decisioncontractid: 'c-out', msdyn_uniquename: 'msdyn_demandqueueidentificationoutput' }],
  contextVariables: [
    { _msdyn_liveworkstreamid_value: 'ws-1', msdyn_name: 'segment', msdyn_displayname: 'Segment', msdyn_datatype: 192350000, msdyn_ismodifiable: true, msdyn_isdisplayable: true, msdyn_islist: false, msdyn_issystemdefined: false },
    { _msdyn_liveworkstreamid_value: 'ws-1', msdyn_name: 'SystemOne', msdyn_issystemdefined: true },
    { _msdyn_liveworkstreamid_value: 'ws-other', msdyn_name: 'notMine' },
  ],
  workstreamCapacity: [{ _msdyn_workstream_id_value: 'ws-1', _msdyn_capacityprofile_id_value: 'cap-1' }],
  routingConfigs: [{ msdyn_routingconfigurationid: 'rc-1', _msdyn_liveworkstreamid_value: 'ws-1', msdyn_isactiveconfiguration: true }],
  routingSteps: [
    { _msdyn_routingconfigurationid_value: 'rc-1', _msdyn_rulesetid_value: 'rs-class', msdyn_type: 192350000, msdyn_steporder: 1 },
    { _msdyn_routingconfigurationid_value: 'rc-1', _msdyn_rulesetid_value: 'rs-route', msdyn_type: 192350002, msdyn_steporder: 2 },
  ],
  rulesets: [
    { msdyn_decisionrulesetid: 'rs-class', _msdyn_inputcontractid_value: 'c-ws', _msdyn_outputcontractid_value: 'c-ws' },
    { msdyn_decisionrulesetid: 'rs-route', msdyn_rulesettype: 192350000, msdyn_authoringmode: 192350000, msdyn_rulesetdefinition: route, _msdyn_inputcontractid_value: 'c-ws', _msdyn_outputcontractid_value: 'c-out' },
  ],
}

// only admin-center workstreams (with a routing contract) can be templates
assert.deepEqual(templates(raw).map((w) => w.msdyn_name), ['WhatsApp'])

// plan: own non-system variables, capacity, the route step only (classification is skipped)
const plan = planWorkstream(raw, 'ws-1')
assert.deepEqual(plan.variables.map((v) => v.msdyn_name), ['segment'])
assert.equal(plan.capacity.length, 1)
assert.equal(plan.route.ruleset.msdyn_decisionrulesetid, 'rs-route')
assert.equal(plan.route.rules, 1)
assert.equal(plan.skippedSteps, 1)
assert.equal(plan.unknownSteps, 0)
// contracts unreadable: no route step can be identified, and that is reported as unknown, not as classification
const blind = planWorkstream({ ...raw, contracts: { error: '403' } }, 'ws-1')
assert.equal(blind.route, undefined)
assert.deepEqual([blind.skippedSteps, blind.unknownSteps], [0, 2])
const empty = planWorkstream(raw, 'ws-1', { copyRules: false })
assert.equal(empty.route.definition, '<decision hit-policy="all" version="1">\n  <rules />\n</decision>')

// create: order, binds through metadata, nothing secret or channel-bound copied
const { workstreamId, created } = await createWorkstream('Sales WhatsApp', plan)
assert.deepEqual(created.map((c) => c.entity), [
  'msdyn_decisioncontract', 'msdyn_liveworkstream', 'msdyn_ocliveworkstreamcontextvariable', 'msdyn_liveworkstreamcapacityprofile',
  'msdyn_decisionruleset', 'msdyn_routingconfiguration', 'msdyn_routingconfigurationstep',
])
const rec = (entity) => writes.find(([op, e]) => op === 'create' && e === entity)[2]
assert.match(rec('msdyn_decisioncontract').msdyn_uniquename, /^new_[0-9a-f_]{36}$/)
assert.match(rec('msdyn_decisioncontract').msdyn_contractdefinition, /variable name="segment"/)
const ws = rec('msdyn_liveworkstream')
assert.equal(ws.msdyn_name, 'Sales WhatsApp')
assert.equal(ws.msdyn_streamsource, 192390001)
assert.equal(ws['nav_msdyn_routingcontractid@odata.bind'], '/msdyn_decisioncontract_set(msdyn_decisioncontract-1)')
assert.equal(ws['nav_msdyn_defaultqueue@odata.bind'], '/queue_set(q-fallback)')
assert.equal(ws.msdyn_sessiontemplate_default, 'bm_whatsapp_session', 'templates are copied as text')
assert.equal(ws.msdyn_notificationtemplate_incoming_auth, 'bm_whatsapp_incoming')
assert.ok(!Object.keys(ws).some((k) => k.includes('@OData.Community')), 'no annotations sent back')
assert.ok(!('msdyn_apikey' in ws) && !Object.keys(ws).some((k) => k.includes('bot')), 'no secrets, no bot')
assert.equal(rec('msdyn_ocliveworkstreamcontextvariable').msdyn_name, 'segment')
assert.equal(rec('msdyn_decisionruleset').msdyn_rulesetdefinition, route)
assert.equal(rec('msdyn_decisionruleset')['nav_msdyn_outputcontractid@odata.bind'], '/msdyn_decisioncontract_set(c-out)')
assert.equal(rec('msdyn_routingconfigurationstep').msdyn_type, 192350002)
assert.equal(workstreamId, 'msdyn_liveworkstream-2')

// undo deletes newest first
writes.length = 0
assert.deepEqual(await deleteCreated(created), [])
assert.deepEqual(writes.map(([, e]) => e), [...created].reverse().map((c) => c.entity))

// retrying an undo only deletes what is left
const real = globalThis.dataverseAPI.delete
let broken = 'msdyn_routingconfiguration-6'
globalThis.dataverseAPI.delete = async (entity, id) => { if (id === broken) throw new Error('locked'); return real(entity, id) }
let remaining = await deleteCreated(created)
assert.deepEqual(remaining.map((r) => r.id), ['msdyn_routingconfiguration-6'])
broken = null
remaining = await deleteCreated(remaining)
assert.deepEqual(remaining, [])
globalThis.dataverseAPI.delete = real

// a failure halfway deletes what was already created and says so
writes.length = 0
failOn = 'msdyn_routingconfiguration'
await assert.rejects(createWorkstream('Broken', plan), (e) => e.code === 'rolledBack' && e.leftovers.length === 0)
const createdBeforeFailure = writes.filter(([op]) => op === 'create').map(([, e]) => e)
const deleted = writes.filter(([op]) => op === 'delete').map(([, e]) => e)
assert.deepEqual(deleted, [...createdBeforeFailure].reverse())
console.log('workstream ok')
