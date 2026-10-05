import assert from 'node:assert/strict'
import { buildGraph } from './build.js'
import { LANGS } from './i18n.js'
import { neighborhood } from './graph.js'

const Q = 'AD696126-1C64-F111-A825-7CED8D2C35F6'
const xml = `<decision><rules><rule id="r1" name="Advisor">
  <logical operator="AND"><condition operator="=="><lhs type="attribute">ctx.email</lhs><rhs type="staticvalue">a@b.es</rhs></condition></logical>
  <action><setattribute><lhs type="attribute">assign_to.queue</lhs><rhs type="staticvalue">{${Q}}</rhs></setattribute></action>
</rule></rules></decision>`

const g = buildGraph({
  org: 'x.crm4.dynamics.com',
  raw: {
    workstreams: [{ msdyn_liveworkstreamid: 'ws1', msdyn_name: 'WS', statecode: 0 }],
    whatsapp: [{ msdyn_ocwhatsappchannelnumberid: 'ch1', msdyn_name: 'WA', _msdyn_liveworkstreamid_value: 'ws1' }],
    routingConfigs: [
      { msdyn_routingconfigurationid: 'rc1', _msdyn_liveworkstreamid_value: 'ws1', msdyn_isactiveconfiguration: true },
      { msdyn_routingconfigurationid: 'rc0', _msdyn_liveworkstreamid_value: 'ws1', msdyn_isactiveconfiguration: false },
    ],
    routingSteps: [
      { _msdyn_routingconfigurationid_value: 'rc1', _msdyn_rulesetid_value: 'rs1', msdyn_steporder: 1 },
      { _msdyn_routingconfigurationid_value: 'rc0', _msdyn_rulesetid_value: 'rsOld', msdyn_steporder: 1 },
    ],
    rulesets: [{ msdyn_decisionrulesetid: 'rs1', msdyn_name: 'Routing', msdyn_rulesetdefinition: xml }, { msdyn_decisionrulesetid: 'rsOld', msdyn_name: 'Old' }],
    queues: [{ queueid: Q.toLowerCase(), name: 'Advisor queue' }],
    memberships: [{ queueid: Q.toLowerCase(), systemuserid: 'u1' }, { queueid: 'personal', systemuserid: 'u1' }],
    users: [{ systemuserid: 'u1', fullname: 'Ana' }],
    facebook: { error: '400 boom' },
  },
}, LANGS.es)

const labels = (s) => s.nodes.map((n) => n.label).sort().join('|')
// channel -> workstream -> active ruleset -> rule -> queue (GUID in XML, braces/case differ) -> user
assert.equal(labels(neighborhood(g, 'user:u1')), 'Advisor|Advisor queue|Ana|Routing|WA|WS')
assert.ok(!g.edges.some((e) => e.target === 'ruleset:rsold'), 'inactive routing config must not link')
assert.equal(g.edges.filter((e) => e.source.startsWith('queue:')).length, 1, 'non-omnichannel memberships dropped')
assert.match(g.nodes.find((n) => n.type === 'rule').data.Acciones, /Cola → Advisor queue/)
assert.deepEqual(g.meta.warnings, ['facebook: 400 boom'])
console.log('build ok')
