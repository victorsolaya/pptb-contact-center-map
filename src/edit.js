// Write operations, one atomic and reversible Dataverse call each. They go through the PPTB host
// (dataverseAPI), so they run with the connection's own permissions.
import { fetchQuery, bind } from './pptb.js'
import { parseXml } from './rules.js'

const guid = (nodeId) => nodeId.split(':')[1]
const odataText = (text) => encodeURIComponent(text.trim().replace(/'/g, "''"))

// ---------------------------------------------------------------- agents in queues

// Enabled, human users matching name or email (application users excluded).
export async function searchUsers(text) {
  const searchText = odataText(text)
  if (!searchText) return []
  const rows = await fetchQuery(
    `systemusers?$select=fullname,internalemailaddress&$filter=isdisabled eq false and applicationid eq null and (contains(fullname,'${searchText}') or contains(internalemailaddress,'${searchText}'))&$orderby=fullname&$top=20`,
  )
  if (rows.error) throw new Error(rows.error)
  return rows.map((user) => ({ id: `user:${user.systemuserid}`, label: user.fullname, sub: user.internalemailaddress }))
}

// Same thing "Add users to queue" does in the admin center: queue <-> systemuser N:N.
export const addMember = (queueId, userId) => dataverseAPI.associate('queue', guid(queueId), 'queuemembership_association', 'systemuser', guid(userId))
export const removeMember = (queueId, userId) => dataverseAPI.disassociate('queue', guid(queueId), 'queuemembership_association', guid(userId))

// ---------------------------------------------------------------- queues

// Omnichannel queue with the same columns the admin center sets. queueviewtype 1 = private, like every
// messaging/voice omnichannel queue. Option values come from queues that already exist in the org.
export async function createQueue({ name, type, strategy, priority, hoursId }) {
  const record = { name: name.trim(), msdyn_isomnichannelqueue: true, queueviewtype: 1, msdyn_queuetype: type, msdyn_assignmentstrategy: strategy, msdyn_priority: priority }
  if (hoursId) Object.assign(record, await bind('queue', 'msdyn_operatinghourid', hoursId))
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
  const walk = (node) => {
    if (node.tag === 'complex') for (const variable of node.children.filter((child) => child.tag === 'variable')) vars.push({ attr: `${node.attrs.key}.${variable.attrs.name}`, type: variable.attrs['data-type'] ?? 'string' })
    node.children.forEach(walk)
  }
  walk(parseXml(xml ?? ''))
  return vars
}

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
export const xmlEscape = (text) => String(text).replace(/[&<>"]/g, (char) => XML_ENTITIES[char])
const indent = (width) => ' '.repeat(width)

// Same layout the routing designer writes: an AND group of conditions, then one or more set actions.
export function buildRuleXml({ id, name, conditions = [], sets }) {
  const conditionXml = (condition) => [
    `${indent(10)}<condition operator="${xmlEscape(condition.op)}">`,
    `${indent(12)}<lhs type="attribute">${xmlEscape(condition.attr)}</lhs>`,
    ...(condition.op === 'not-null' ? [] : [`${indent(12)}<rhs type="staticvalue">${xmlEscape(condition.value)}</rhs>`]),
    `${indent(10)}</condition>`,
  ]
  const setXml = (setAction) => [`${indent(8)}<setattribute>`, `${indent(10)}<lhs type="attribute">${xmlEscape(setAction.attr)}</lhs>`, `${indent(10)}<rhs type="staticvalue">${xmlEscape(setAction.value)}</rhs>`, `${indent(8)}</setattribute>`]
  return [
    `${indent(4)}<rule id="${id}" name="${xmlEscape(name)}">`,
    ...(conditions.length ? [`${indent(6)}<logical operator="AND">`, `${indent(8)}<logical operator="AND">`, ...conditions.flatMap(conditionXml), `${indent(8)}</logical>`, `${indent(6)}</logical>`] : []),
    `${indent(6)}<action>`, ...sets.flatMap(setXml), `${indent(6)}</action>`,
    `${indent(4)}</rule>`,
  ].join('\n')
}

// New rules go last (rule order is evaluation order); everything else in the XML is left byte-identical.
export function appendRule(xml, ruleXml) {
  const empty = /<rules\s*\/>/
  if (empty.test(xml)) return xml.replace(empty, `<rules>\n${ruleXml}\n  </rules>`)
  const rulesEnd = xml.lastIndexOf('</rules>')
  if (rulesEnd < 0) throw Object.assign(new Error('no <rules> element'), { code: 'badDefinition' })
  return xml.slice(0, rulesEnd).replace(/\s*$/, '\n') + ruleXml + '\n  ' + xml.slice(rulesEnd)
}

export function removeRule(xml, ruleId) {
  const rulePattern = new RegExp(`\\r?\\n?[ \\t]*<rule id="${ruleId.replace(/[^\w-]/g, '')}"[\\s\\S]*?</rule>`)
  if (!rulePattern.test(xml)) throw Object.assign(new Error('rule not found'), { code: 'ruleNotFound' })
  return xml.replace(rulePattern, '')
}

const normalizeNewlines = (text) => (text ?? '').replace(/\r\n/g, '\n')
export const readRuleset = async (id) => normalizeNewlines((await dataverseAPI.retrieve('msdyn_decisionruleset', id, ['msdyn_rulesetdefinition'])).msdyn_rulesetdefinition)
export const readContract = async (id) => (await dataverseAPI.retrieve('msdyn_decisioncontract', id, ['msdyn_contractdefinition'])).msdyn_contractdefinition ?? ''

// Optimistic write: refuse if the ruleset changed (e.g. in the admin center) since `expected` was read.
export async function writeRuleset(id, expected, next) {
  if ((await readRuleset(id)) !== normalizeNewlines(expected)) throw Object.assign(new Error('stale'), { code: 'stale' })
  await dataverseAPI.update('msdyn_decisionruleset', id, { msdyn_rulesetdefinition: next })
}

export const newId = () => crypto.randomUUID()

// What the user is told when a change (or its undo) fails. Multi-record changes clean up after
// themselves, so for those the message also says whether that worked.
export function errorText(e, t) {
  const known = { stale: t.edit.stale, staleRecord: t.edit.staleRecord, badDefinition: t.edit.badDefinition, ruleNotFound: t.edit.ruleNotFound }[e?.code]
  if (known) return known
  const message = String(e?.message ?? e)
  if (e?.code === 'rolledBack') return `${message}. ${t.edit.rolledBack}`
  if (e?.code === 'reverted') return `${message}. ${t.edit.reverted}`
  if (e?.code === 'notReverted') return `${message}. ${t.edit.notReverted(e.leftovers.map((undo) => undo.label).join(', '))}`
  if (e?.code === 'partial') return `${message}. ${t.edit.partial(e.leftovers.map((record) => `${record.entity} ${record.id}`).join(', '))}`
  return message
}

// After each kind of change only these tables are re-read.
export const MEMBER_TABLES = ['memberships', 'users']
export const QUEUE_TABLES = ['queues']
export const RULE_TABLES = ['rulesets']
