// Record identification rules of a workstream (msdyn_liveworkstream.msdyn_recordidentificationrule):
// one <RecordIdentificationRule> per table (account, contact, incident), each a FetchXML whose conditions
// compare a column with a context value (${Name}, ${Email}, ${msdyn_fromphone}...), plus a <ContextKey>
// whose isPreferred says which table wins. The admin center has no editor for this column, so edits only
// ever replace the edited rule's top-level filter (and isPreferred); every other byte stays as it was.
import { parseXml } from './rules.js'
import { xmlEscape } from './edit.js'
import { rows } from './queries.js'
import { fetchQuery } from './pptb.js'

const RULE = /<RecordIdentificationRule\b[^>]*>[\s\S]*?<\/RecordIdentificationRule>/g
const PLACEHOLDER = /^\$\{([^}]+)\}$/
// keys the documentation lists for pre-conversation questions
const DOCUMENTED_KEYS = ['Name', 'Email', 'Phone', 'CaseNumber']

export const placeholderName = (value) => PLACEHOLDER.exec(value ?? '')?.[1]
const normalizeNewlines = (text) => (text ?? '').replace(/\r\n/g, '\n')

// Index just after the </filter> that closes the <filter> starting at `start` (nested filters included).
function filterEnd(xml, start) {
  const tags = /<(\/?)filter\b[^>]*?(\/?)>/g
  tags.lastIndex = start
  let depth = 0
  for (let tag; (tag = tags.exec(xml)); ) {
    if (tag[2]) { if (depth === 0) return tags.lastIndex; continue } // <filter/>
    depth += tag[1] ? -1 : 1
    if (depth === 0) return tags.lastIndex
  }
  return -1
}

// A condition the tool can show and rebuild: column, operator, value and the optional source.
const onlyType = (node) => Object.keys(node.attrs).every((name) => name === 'type')
const simpleCondition = (node) =>
  node.tag === 'condition' && node.children.length === 0 && Object.keys(node.attrs).every((name) => ['attribute', 'operator', 'value', 'source'].includes(name))

// The editable shape: one top-level AND filter holding conditions and OR groups of conditions; no links
// to other tables. Each child becomes a row of one condition, or of several alternatives (an OR group),
// each against a conversation value (${Name}...) or a fixed value (statuscode = 1): nothing is hidden.
const conditionOf = (node) => {
  const { attribute, operator, value, source } = node.attrs
  return { attribute, operator, value, source }
}
function readFilter(entity) {
  const filters = entity.children.filter((child) => child.tag === 'filter')
  if (filters.length !== 1 || filters[0].attrs.type !== 'and' || !onlyType(filters[0]) || entity.children.some((child) => child.tag === 'link-entity')) return null
  const matches = []
  for (const child of filters[0].children) {
    if (simpleCondition(child)) matches.push({ conditions: [conditionOf(child)] })
    else if (child.tag === 'filter' && child.attrs.type === 'or' && onlyType(child) && child.children.length && child.children.every(simpleCondition))
      matches.push({ conditions: child.children.map(conditionOf) })
    else return null
  }
  return matches
}

// One entry per <RecordIdentificationRule>, with the positions needed to rewrite it in place.
export function parseIdentification(xml) {
  const text = normalizeNewlines(xml)
  // comments blanked with spaces of the same length, so positions still match the real text
  const live = text.replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length))
  return [...live.matchAll(RULE)].map((ruleMatch) => {
    const start = ruleMatch.index
    const ruleXml = text.slice(start, start + ruleMatch[0].length)
    const rule = parseXml(ruleXml).children[0]
    const entity = rule.children.find((child) => child.tag === 'fetch')?.children.find((child) => child.tag === 'entity')
    const contextKey = rule.children.find((child) => child.tag === 'ContextKey')
    const preferredAt = /(<ContextKey\b[^>]*\bisPreferred\s*=\s*(["']))([^"']*)\2/.exec(ruleXml)
    const filterAt = ruleXml.indexOf('<filter', ruleXml.indexOf('<entity'))
    const hasComments = ruleXml.includes('<!--')
    const matches = entity && filterAt >= 0 && !hasComments ? readFilter(entity) : null
    return {
      entity: entity?.attrs.name ?? '',
      xml: ruleXml,
      contextKey: contextKey?.attrs.name,
      preferred: preferredAt && !hasComments ? preferredAt[3].toLowerCase() === 'true' : null,
      supported: Boolean(matches),
      matches: matches ?? [],
      preferredRange: preferredAt && !hasComments && [start + preferredAt.index + preferredAt[1].length, start + preferredAt.index + preferredAt[0].length - 1],
      filterRange: matches && [start + filterAt, start + filterEnd(ruleXml, filterAt)],
    }
  })
}

const conditionXml = ({ attribute, operator, source, value }) =>
  `<condition attribute="${xmlEscape(attribute)}" operator="${xmlEscape(operator)}"${source ? ` source="${xmlEscape(source)}"` : ''}${value === undefined ? '' : ` value="${xmlEscape(value)}"`}/>`

export function filterXml(matches) {
  const parts = matches.map(({ conditions }) =>
    conditions.length === 1 ? conditionXml(conditions[0]) : `<filter type="or">${conditions.map(conditionXml).join('')}</filter>`)
  return `<filter type="and">${parts.join('')}</filter>`
}

// `edited`: the parsed rules with changed `matches` / `preferred`. Only what changed is replaced, last
// position first so earlier positions stay valid.
export function rewriteIdentification(xml, edited) {
  const text = normalizeNewlines(xml)
  const original = parseIdentification(text)
  const replacements = []
  original.forEach((rule, i) => {
    const next = edited[i]
    if (rule.supported && JSON.stringify(rule.matches) !== JSON.stringify(next.matches))
      replacements.push([...rule.filterRange, filterXml(next.matches)])
    if (rule.preferred !== null && rule.preferred !== next.preferred) replacements.push([...rule.preferredRange, String(next.preferred)])
  })
  return replacements.sort((a, b) => b[0] - a[0]).reduce((result, [from, to, insert]) => result.slice(0, from) + insert + result.slice(to), text)
}

// Context values a match can compare with: those already used by any workstream (with their source),
// the documented pre-conversation keys and this workstream's own context variables.
export function valueOptions(raw, workstreamId) {
  const options = new Map()
  const add = (value, source) => options.has(`${value}|${source ?? ''}`) || options.set(`${value}|${source ?? ''}`, { value, source })
  for (const workstream of rows(raw, 'workstreams'))
    for (const rule of parseIdentification(workstream.msdyn_recordidentificationrule))
      for (const condition of rule.matches.flatMap((match) => match.conditions)) if (isConversationValue(condition)) add(condition.value, condition.source)
  for (const key of DOCUMENTED_KEYS) add(`\${${key}}`)
  for (const variable of rows(raw, 'contextVariables'))
    if (variable._msdyn_liveworkstreamid_value?.toLowerCase() === workstreamId) add(`\${${variable.msdyn_name}}`)
  return [...options.values()]
}

export const isConversationValue = (condition) => Boolean(placeholderName(condition.value))
// operators offered for fixed values; null / not-null take no value
export const FIXED_OPERATORS = ['eq', 'ne', 'null', 'not-null']
export const takesValue = (operator) => operator !== 'null' && operator !== 'not-null'

// A value in words: the caller's phone number, a pre-chat answer, a value of the conversation context
// (it has a source), a context variable, or a fixed value.
export function valueLabel({ value, source }, t) {
  if (value === undefined) return ''
  const key = placeholderName(value)
  if (!key) return t.text.identLiteral(value)
  if (key === 'msdyn_fromphone') return t.text.identCallerPhone
  if (source) return t.text.identFromConversation(key)
  if (DOCUMENTED_KEYS.includes(key)) return t.text.identPrechat(key)
  return t.text.identContext(key)
}
export const operatorText = (operator) => ({ eq: '=', ne: '≠' })[operator] ?? operator

const conditionText = (condition, t) => [condition.attribute, operatorText(condition.operator), valueLabel(condition, t)].filter(Boolean).join(' ')
// One row in words; alternatives that compare with the same value read "a or b = value".
export function matchText({ conditions }, t) {
  const [first] = conditions
  const sameValue = conditions.every((condition) => ['operator', 'value', 'source'].every((name) => condition[name] === first[name]))
  return sameValue
    ? conditionText({ ...first, attribute: conditions.map((condition) => condition.attribute).join(` ${t.text.or} `) }, t)
    : conditions.map((condition) => conditionText(condition, t)).join(` ${t.text.or} `)
}

// Per table: a title and one line per row, e.g. "mobilephone or telephone1 = Caller's phone number".
export function describeIdentification(xml, t) {
  return parseIdentification(xml).map((rule) => {
    const table = t.text.identTables[rule.entity] ?? rule.entity
    return {
      entity: rule.entity,
      title: rule.preferred ? `${table} (${t.text.preferred})` : table,
      xml: formatXml(rule.xml), // to tell an edited advanced rule from an untouched one
      lines: rule.supported ? rule.matches.map((match) => matchText(match, t)) : [t.text.identAdvanced],
    }
  })
}

// Detail panel: each table on its own line, its matches indented below it.
export const summarizeIdentification = (xml, t) =>
  describeIdentification(xml, t).map((table) => [table.title, ...table.lines.map((line) => `  ${line}`)].join('\n')).join('\n')

// ---------------------------------------------------------------- FetchXML view for developers

// Comment, tag (quoted attribute values may contain ">") or text; an unclosed "<" is its own token.
const TOKEN = /<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>|<[^<]*|[^<]+/g

// One tag per line, indented two spaces per level (the column usually comes as one line with tabs).
export function formatXml(xml) {
  const lines = []
  let depth = 0
  for (const [token] of normalizeNewlines(xml).matchAll(TOKEN)) {
    const text = token.trim()
    if (!text) continue
    if (text.startsWith('</')) depth = Math.max(0, depth - 1)
    lines.push('  '.repeat(depth) + text)
    if (/^<[\w:.-]/.test(text) && !text.endsWith('/>')) depth++ // comments and declarations do not nest
  }
  return lines.join('\n')
}

// First problem that would make the column unusable, or null: not well formed, or not the shape the
// runtime reads (a rule set, rules with PrimaryEntity, fetch/entity and ContextKey, one preferred table).
export function xmlProblem(xml) {
  const open = []
  let roots = 0
  for (const [token] of normalizeNewlines(xml).matchAll(TOKEN)) {
    if (!token.startsWith('<')) {
      if (token.trim() && !open.length) return { code: 'notWellFormed', detail: token.trim().slice(0, 60) }
      continue
    }
    if (/^<(\?[\s\S]*\?|!--[\s\S]*--)>$/.test(token)) continue // declaration, comment
    const tag = /^<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>$/.exec(token)
    if (!tag || (tag[1] && (tag[3] || tag[4]))) return { code: 'notWellFormed', detail: token.slice(0, 80) }
    if (tag[1]) {
      if (open.pop() !== tag[2]) return { code: 'notWellFormed', detail: token }
      continue
    }
    if (!open.length && ++roots > 1) return { code: 'notWellFormed', detail: token } // a second root element
    if (!tag[4]) open.push(tag[2])
  }
  if (open.length) return { code: 'notWellFormed', detail: `<${open.at(-1)}>` }
  const root = parseXml(normalizeNewlines(xml)).children[0]
  if (root?.tag !== 'RecordIdentificationRuleSet') return { code: 'noRuleSet' }
  const rules = root.children.filter((child) => child.tag === 'RecordIdentificationRule')
  if (!rules.length) return { code: 'noRules' }
  const has = (node, tag) => node.children.find((child) => child.tag === tag)
  const incomplete = rules.findIndex((rule) => !has(rule, 'PrimaryEntity') || !has(has(rule, 'fetch') ?? { children: [] }, 'entity')?.attrs.name || !has(rule, 'ContextKey')?.attrs.name)
  if (incomplete >= 0) return { code: 'ruleIncomplete', detail: incomplete + 1 }
  const conditionsOf = (node) => node.children.flatMap((child) => (child.tag === 'condition' ? [child] : conditionsOf(child)))
  const conditionsByRule = rules.map((rule) => conditionsOf(has(has(rule, 'fetch'), 'entity')))
  const unfiltered = conditionsByRule.findIndex((conditions) => !conditions.length)
  if (unfiltered >= 0) return { code: 'noConditions', detail: unfiltered + 1 } // it would match every record
  const columnless = conditionsByRule.findIndex((conditions) => conditions.some((condition) => !condition.attrs.attribute?.trim()))
  if (columnless >= 0) return { code: 'conditionWithoutColumn', detail: columnless + 1 }
  if (rules.filter((rule) => has(rule, 'ContextKey').attrs.isPreferred?.toLowerCase() === 'true').length > 1) return { code: 'twoPreferred' }
  return null
}

// Changed lines between two texts (longest common subsequence), for the review: [{ type: '-' | '+', text }].
export function lineDiff(before, after) {
  const a = before.split('\n'), b = after.split('\n')
  const common = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) common[i][j] = a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1])
  const changes = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++ }
    else if (j < b.length && (i === a.length || common[i][j + 1] >= common[i + 1][j])) changes.push({ type: '+', text: b[j++] })
    else changes.push({ type: '-', text: a[i++] })
  }
  return changes
}

// Columns of a table that a condition can use, with their display name in the user's language (cached
// once read). Skipped: virtual and system-only types, and the name columns derived from lookups/choices.
const SKIPPED_TYPES = ['Virtual', 'EntityName', 'ManagedProperty', 'PartyList', 'CalendarRules', 'Uniqueidentifier']
const columnCache = new Map()
export const clearColumnCache = () => columnCache.clear()
export async function tableColumns(entity) {
  if (!columnCache.has(entity)) {
    const attributes = await fetchQuery(`EntityDefinitions(LogicalName='${entity}')/Attributes?$select=LogicalName,DisplayName,AttributeType,AttributeOf`)
    if (attributes.error) throw new Error(attributes.error)
    columnCache.set(entity, attributes
      .filter((attribute) => !attribute.AttributeOf && !SKIPPED_TYPES.includes(attribute.AttributeType))
      .map((attribute) => ({ name: attribute.LogicalName, label: attribute.DisplayName?.UserLocalizedLabel?.Label ?? attribute.LogicalName }))
      .sort((a, b) => a.label.localeCompare(b.label)))
  }
  return columnCache.get(entity)
}

export const readIdentification = async (workstreamId) =>
  normalizeNewlines((await dataverseAPI.retrieve('msdyn_liveworkstream', workstreamId, ['msdyn_recordidentificationrule'])).msdyn_recordidentificationrule)

// Optimistic write: refuse if the column changed since `expected` was read.
export async function writeIdentification(workstreamId, expected, next) {
  if ((await readIdentification(workstreamId)) !== normalizeNewlines(expected)) throw Object.assign(new Error('stale'), { code: 'staleRecord' })
  await dataverseAPI.update('msdyn_liveworkstream', workstreamId, { msdyn_recordidentificationrule: next })
}

export const IDENTIFICATION_TABLES = ['workstreams']
