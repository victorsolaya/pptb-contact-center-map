// Write operations, one atomic and reversible Dataverse call each. They go through the PPTB host
// (dataverseAPI), so they run with the connection's own permissions.
import { fetchQuery } from './pptb.js'
import { parseXml } from './rules.js'

const guid = (nodeId) => nodeId.split(':')[1]
const odataText = (s) => encodeURIComponent(s.trim().replace(/'/g, "''"))

// ---------------------------------------------------------------- agents in queues

// Enabled, human users matching name or email (application users excluded).
export async function searchUsers(text) {
  const v = odataText(text)
  if (!v) return []
  const rows = await fetchQuery(
    `systemusers?$select=fullname,internalemailaddress&$filter=isdisabled eq false and applicationid eq null and (contains(fullname,'${v}') or contains(internalemailaddress,'${v}'))&$orderby=fullname&$top=20`,
  )
  if (rows.error) throw new Error(rows.error)
  return rows.map((u) => ({ id: `user:${u.systemuserid}`, label: u.fullname, sub: u.internalemailaddress }))
}

// Same thing "Add users to queue" does in the admin center: queue <-> systemuser N:N.
export const addMember = (queueId, userId) => dataverseAPI.associate('queue', guid(queueId), 'queuemembership_association', 'systemuser', guid(userId))
export const removeMember = (queueId, userId) => dataverseAPI.disassociate('queue', guid(queueId), 'queuemembership_association', guid(userId))

// ---------------------------------------------------------------- queues

// Omnichannel queue with the same columns the admin center sets. queueviewtype 1 = private, like every
// messaging/voice omnichannel queue. Option values come from queues that already exist in the org.
export async function createQueue({ name, type, strategy, priority, hoursId }) {
  const record = { name: name.trim(), msdyn_isomnichannelqueue: true, queueviewtype: 1, msdyn_queuetype: type, msdyn_assignmentstrategy: strategy, msdyn_priority: priority }
  if (hoursId) record['msdyn_operatinghourid@odata.bind'] = `/msdyn_operatinghours(${hoursId})`
  const { id } = await dataverseAPI.create('queue', record)
  return id
}
export const deleteQueue = (id) => dataverseAPI.delete('queue', id)

// ---------------------------------------------------------------- rules

// Which rulesets may be edited, from the unique name of their contracts (language independent):
// route-to-queue rulesets write the demand-queue-identification output; classification rulesets read
// and write the workstream's own contract. Overflow, assignment and system rulesets are never touched.
export function rulesetKind(outputUnique, inputUnique) {
  if (!outputUnique) return null
  if (outputUnique.startsWith('msdyn_demandqueueidentificationoutput')) return 'route'
  if (outputUnique.startsWith('new_') && outputUnique === inputUnique) return 'classification'
  return null
}

// Variables a contract exposes, e.g. <complex key="liveworkitemcontext"><variable name="X" data-type="string"/>.
export function contractVariables(xml) {
  const vars = []
  const walk = (n) => {
    if (n.tag === 'complex') for (const v of n.children.filter((c) => c.tag === 'variable')) vars.push({ attr: `${n.attrs.key}.${v.attrs.name}`, type: v.attrs['data-type'] ?? 'string' })
    n.children.forEach(walk)
  }
  walk(parseXml(xml ?? ''))
  return vars
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
export const xmlEscape = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c])
const pad = (n) => ' '.repeat(n)

// Same layout the routing designer writes: an AND group of conditions, then one or more set actions.
export function buildRuleXml({ id, name, conditions = [], sets }) {
  const cond = (c) => [
    `${pad(10)}<condition operator="${xmlEscape(c.op)}">`,
    `${pad(12)}<lhs type="attribute">${xmlEscape(c.attr)}</lhs>`,
    ...(c.op === 'not-null' ? [] : [`${pad(12)}<rhs type="staticvalue">${xmlEscape(c.value)}</rhs>`]),
    `${pad(10)}</condition>`,
  ]
  const set = (s) => [`${pad(8)}<setattribute>`, `${pad(10)}<lhs type="attribute">${xmlEscape(s.attr)}</lhs>`, `${pad(10)}<rhs type="staticvalue">${xmlEscape(s.value)}</rhs>`, `${pad(8)}</setattribute>`]
  return [
    `${pad(4)}<rule id="${id}" name="${xmlEscape(name)}">`,
    ...(conditions.length ? [`${pad(6)}<logical operator="AND">`, `${pad(8)}<logical operator="AND">`, ...conditions.flatMap(cond), `${pad(8)}</logical>`, `${pad(6)}</logical>`] : []),
    `${pad(6)}<action>`, ...sets.flatMap(set), `${pad(6)}</action>`,
    `${pad(4)}</rule>`,
  ].join('\n')
}

// New rules go last (rule order is evaluation order); everything else in the XML is left byte-identical.
export function appendRule(xml, ruleXml) {
  const empty = /<rules\s*\/>/
  if (empty.test(xml)) return xml.replace(empty, `<rules>\n${ruleXml}\n  </rules>`)
  const i = xml.lastIndexOf('</rules>')
  if (i < 0) throw new Error('Unexpected ruleset definition: no <rules> element')
  return xml.slice(0, i).replace(/\s*$/, '\n') + ruleXml + '\n  ' + xml.slice(i)
}

export function removeRule(xml, ruleId) {
  const re = new RegExp(`\\n?[ \\t]*<rule id="${ruleId.replace(/[^\w-]/g, '')}"[\\s\\S]*?</rule>`)
  if (!re.test(xml)) throw new Error('Rule not found in the current definition')
  return xml.replace(re, '')
}

const norm = (s) => (s ?? '').replace(/\r\n/g, '\n')
export const readRuleset = async (id) => norm((await dataverseAPI.retrieve('msdyn_decisionruleset', id, ['msdyn_rulesetdefinition'])).msdyn_rulesetdefinition)
export const readContract = async (id) => (await dataverseAPI.retrieve('msdyn_decisioncontract', id, ['msdyn_contractdefinition'])).msdyn_contractdefinition ?? ''

// Optimistic write: refuse if the ruleset changed (e.g. in the admin center) since `expected` was read.
export async function writeRuleset(id, expected, next) {
  if ((await readRuleset(id)) !== norm(expected)) throw Object.assign(new Error('stale'), { code: 'stale' })
  await dataverseAPI.update('msdyn_decisionruleset', id, { msdyn_rulesetdefinition: next })
}

export const newId = () => crypto.randomUUID()

// After each kind of change only these tables are re-read.
export const MEMBER_TABLES = ['memberships', 'users']
export const QUEUE_TABLES = ['queues']
export const RULE_TABLES = ['rulesets']
