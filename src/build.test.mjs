import assert from 'node:assert/strict'
import { buildGraph } from './build.js'
import { LANGS } from './i18n.js'
import { neighborhood } from './graph.js'

const Q = 'AD696126-1C64-F111-A825-7CED8D2C35F6'
const xml = `<decision><rules><rule id="r1" name="Advisor">
  <logical operator="AND"><condition operator="=="><lhs type="attribute">ctx.email</lhs><rhs type="staticvalue">a@b.es</rhs></condition></logical>
  <action><setattribute><lhs type="attribute">assign_to.queue</lhs><rhs type="staticvalue">{${Q}}</rhs></setattribute></action>
</rule></rules></decision>`

const graph = buildGraph({
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

const labels = (subgraph) => subgraph.nodes.map((node) => node.label).sort().join('|')
// channel -> workstream -> active ruleset -> rule -> queue (GUID in XML, braces/case differ) -> user
assert.equal(labels(neighborhood(graph, 'user:u1')), 'Advisor|Advisor queue|Ana|Routing|WA|WS')
assert.ok(!graph.edges.some((edge) => edge.target === 'ruleset:rsold'), 'inactive routing config must not link')
assert.equal(graph.edges.filter((edge) => edge.source.startsWith('queue:')).length, 1, 'non-omnichannel memberships dropped')
assert.match(graph.nodes.find((node) => node.type === 'rule').data.Acciones, /Cola → Advisor queue/)
assert.deepEqual(graph.meta.warnings, ['facebook: 400 boom'])
// a rule with its own PreQueue overflow links to that ruleset; GUIDs in conditions and actions read as names
const OVERRIDE = '00000000-0000-4000-8000-0000000000c1'
const specific = buildGraph({ raw: {
  queues: [{ queueid: Q.toLowerCase(), name: 'Advisor queue' }],
  workstreams: [{ msdyn_liveworkstreamid: '00000000-0000-4000-8000-0000000000c2', msdyn_name: 'Contoso - Voice' }],
  rulesets: [
    { msdyn_decisionrulesetid: 'rs1', msdyn_name: 'Routing', msdyn_rulesetdefinition: `<decision><rules><rule id="r1" name="Own overflow">
      <condition operator="=="><lhs type="attribute">msdyn_ocliveworkitem.msdyn_liveworkstreamid</lhs><rhs type="staticvalue">{00000000-0000-4000-8000-0000000000C2}</rhs></condition>
      <action><setattribute><lhs type="attribute">assign_to.queue</lhs><rhs type="staticvalue">${Q}</rhs></setattribute>
      <setattribute><lhs type="attribute">prequeue_overflow_ruleset.msdyn_decisionruleset.msdyn_decisionrulesetid</lhs><rhs type="staticvalue">{${OVERRIDE}}</rhs></setattribute></action>
    </rule></rules></decision>` },
    { msdyn_decisionrulesetid: OVERRIDE, msdyn_name: 'r1_pre_queue_rtq_overflow_override' },
  ],
} }, LANGS.en)
const own = specific.nodes.find((node) => node.label === 'Own overflow')
assert.equal(own.sub, 'msdyn_ocliveworkitem.msdyn_liveworkstreamid == "Contoso - Voice"')
assert.deepEqual(own.sets, [])
assert.match(own.data.Actions, /Overflow → r1_pre_queue_rtq_overflow_override/)
assert.ok(specific.edges.some((edge) => edge.source === own.id && edge.target === `ruleset:${OVERRIDE}` && edge.label === 'pre-queue overflow'))
// assignment rules compare base presence values: shown with the org's labels; unknown values stay as they are
const FV = '@OData.Community.Display.V1.FormattedValue'
const presence = buildGraph({ raw: {
  presences: [{ msdyn_basepresencestatus: 192360000, [`msdyn_basepresencestatus${FV}`]: 'Disponible' }, { msdyn_basepresencestatus: 192360001, [`msdyn_basepresencestatus${FV}`]: 'Ocupado' }],
  rulesets: [{ msdyn_decisionrulesetid: 'rs1', msdyn_name: 'Assignment', msdyn_rulesetdefinition: `<decision><rules><rule id="a1" name="Available agents"><logical operator="AND">
    <condition operator="in"><lhs type="attribute">agent.basePresenceStatus</lhs><rhs type="multistaticvalues"><value>192360001</value><value>192360000</value><value>192369999</value></rhs></condition>
    <condition operator="=="><lhs type="attribute">agent.systemuser.identityid</lhs><rhs type="staticvalue">192360000</rhs></condition>
  </logical><action><orderby type="attribute" descending="false">agent.lastSessionReleasedOn</orderby></action></rule></rules></decision>` }],
} }, LANGS.es)
assert.equal(presence.nodes.find((node) => node.label === 'Available agents').sub,
  'agent.basePresenceStatus in ["Ocupado", "Disponible", "192369999"] AND agent.systemuser.identityid == "192360000"')
console.log('build ok')
