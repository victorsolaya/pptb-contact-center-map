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

// ---------------------------------------------------------------- rules
const { buildRuleXml, appendRule, removeRule, rulesetKind, contractVariables, writeRuleset, createQueue, deleteQueue } = await import('./edit.js')
const { parseRules } = await import('./rules.js')

const base = `<decision hit-policy="all" version="1">
  <rules>
    <rule id="r-1" name="Existing">
      <action>
        <setattribute>
          <lhs type="attribute">assign_to.queue</lhs>
          <rhs type="staticvalue">q-1</rhs>
        </setattribute>
      </action>
    </rule>
  </rules>
</decision>`
const added = buildRuleXml({
  id: 'r-2', name: 'VIP & "gold" <1>',
  conditions: [{ attr: 'liveworkitemcontext.segment', op: '==', value: 'A&B' }, { attr: 'liveworkitemcontext.email', op: 'not-null' }],
  sets: [{ attr: 'assign_to.queue', value: 'q-2' }],
})
const next = appendRule(base, added)
const parsed = parseRules(next)
assert.equal(parsed.length, 2)
assert.equal(parsed[1].name, 'VIP & "gold" <1>', 'name escaped and decoded back')
assert.equal(parsed[1].when, 'liveworkitemcontext.segment == "A&B" AND liveworkitemcontext.email not-null')
assert.deepEqual(parsed[1].set, [{ attr: 'assign_to.queue', value: 'q-2' }])
assert.ok(next.startsWith(base.slice(0, base.lastIndexOf('</rules>')).trimEnd()), 'existing XML untouched')
assert.equal(removeRule(next, 'r-2'), base, 'remove restores the original byte for byte')
assert.throws(() => removeRule(base, 'nope'))
// classification rule without conditions, into an empty ruleset
const cls = appendRule('<decision hit-policy="first" version="1"><rules /></decision>', buildRuleXml({ id: 'c-1', name: 'Default', sets: [{ attr: 'liveworkitemcontext.tier', value: 'gold' }] }))
assert.deepEqual(parseRules(cls).map((r) => [r.when, r.set[0].attr, r.set[0].value]), [['', 'liveworkitemcontext.tier', 'gold']])

// kinds from contract unique names; never overflow/assignment/system
assert.equal(rulesetKind('msdyn_demandqueueidentificationoutput', 'new_abc'), 'route')
assert.equal(rulesetKind('msdyn_demandqueueidentificationoutput_voicemail_copy', 'new_x'), 'route')
assert.equal(rulesetKind('new_abc', 'new_abc'), 'classification')
assert.equal(rulesetKind('msdyn_queueoverflowrulesetoutput', 'msdyn_queueoverflowrulesetinput'), null)
assert.equal(rulesetKind('msdyn_assignmentoutput_voicemail', 'new_x'), null)
assert.equal(rulesetKind('new_output_msdyn_intentfamily_mappingconfiguration', 'new_incident_x'), null)

assert.deepEqual(contractVariables(`<contract version="1"><entity logical-name="msdyn_ocliveworkitem" key="msdyn_ocliveworkitem" />
  <complex key="liveworkitemcontext"><variable name="QueueVar" data-type="string" /><variable name="Score" data-type="number" /></complex></contract>`),
  [{ attr: 'liveworkitemcontext.QueueVar', type: 'string' }, { attr: 'liveworkitemcontext.Score', type: 'number' }])

// optimistic write: refuses when the ruleset changed since it was read
let stored = base
globalThis.dataverseAPI.retrieve = async () => ({ msdyn_rulesetdefinition: stored.replace(/\n/g, '\r\n') })
globalThis.dataverseAPI.update = async (_e, _id, rec) => { stored = rec.msdyn_rulesetdefinition }
await writeRuleset('rs1', base, next)
assert.equal(stored, next)
await assert.rejects(writeRuleset('rs1', base, base), (e) => e.code === 'stale')

// queue create/delete payloads
globalThis.dataverseAPI.create = async (entity, rec) => (calls.push(['create', entity, rec]), { id: 'new-q' })
globalThis.dataverseAPI.delete = async (...a) => calls.push(['delete', ...a])
assert.equal(await createQueue({ name: ' Billing ', type: 192350001, strategy: 192350000, priority: 10, hoursId: 'h1' }), 'new-q')
assert.deepEqual(calls.at(-1), ['create', 'queue', { name: 'Billing', msdyn_isomnichannelqueue: true, queueviewtype: 1, msdyn_queuetype: 192350001, msdyn_assignmentstrategy: 192350000, msdyn_priority: 10, 'msdyn_operatinghourid@odata.bind': '/msdyn_operatinghours(h1)' }])
await deleteQueue('new-q')
assert.deepEqual(calls.at(-1), ['delete', 'queue', 'new-q'])
console.log('rules edit ok')
