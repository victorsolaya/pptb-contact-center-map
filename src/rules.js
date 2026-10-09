// Parser for Dataverse decision-ruleset XML: <decision><rules><rule><logical|condition/><action/></rule></rules></decision>
// Machine-generated XML with no CDATA/namespaces, so a regex tokenizer is enough.

// one pass, so a decoded "&" can't start another reference ("&#38;amp;" is "&amp;")
const ENTITIES = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }
const decode = (text) =>
  text.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (reference, name) =>
    name[0] !== '#' ? ENTITIES[name.toLowerCase()] ?? reference
    : String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))))

export function parseXml(xml) {
  const root = { tag: '#root', attrs: {}, children: [], text: '' }
  const stack = [root]
  // comments are not content: a commented-out element must not be read as a real one
  for (const match of xml.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack.at(-1)
    if (match[5] !== undefined) top.text += decode(match[5])
    else if (match[1]) stack.length > 1 && stack.pop()
    else {
      const node = { tag: match[2], attrs: Object.fromEntries([...match[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((attrMatch) => [attrMatch[1], decode(attrMatch[2] ?? attrMatch[3])])), children: [], text: '' }
      top.children.push(node)
      if (!match[4]) stack.push(node)
    }
  }
  return root
}

// overflow wait times carry their unit: <rhs type="staticvalue" unit="seconds">30</rhs> reads "30s",
// and whole minutes, hours or days read as such (7200 seconds is "2h", 120 is "2m", 172800 is "2d")
const UNITS = { seconds: 's', minutes: 'm', hours: 'h', days: 'd' }
const SECONDS = [['d', 86400], ['h', 3600], ['m', 60]]
function duration(value, unit) {
  if (unit !== 'seconds' || !/^\d+$/.test(value)) return UNITS[unit] ? `${value}${UNITS[unit]}` : `${value} ${unit}`
  const [symbol, size] = SECONDS.find(([, size]) => value >= size && value % size === 0) ?? ['s', 1]
  return `${value / size}${symbol}`
}
const operandText = (operand) =>
  operand.attrs.type === 'multistaticvalues' ? `[${operand.children.map((value) => JSON.stringify(value.text.trim())).join(', ')}]` // "in" a list of values
  : operand.attrs.unit ? duration(operand.text.trim(), operand.attrs.unit)
  : operand.attrs.type === 'staticvalue' ? JSON.stringify(operand.text.trim()) : operand.text.trim()

function expressionOf(node, parentOperator) {
  if (node.tag === 'condition') {
    const [left, right] = node.children
    return [left && operandText(left), node.attrs.operator, right && operandText(right)].filter(Boolean).join(' ')
  }
  if (node.tag !== 'logical') return ''
  const operator = node.attrs.operator
  // a group alone in its parent needs no parentheses: AND(OR(a, b)) reads "a OR b"
  const parts = node.children.map((child) => expressionOf(child, node.children.length > 1 ? operator : undefined)).filter(Boolean)
  const joined = parts.join(` ${operator} `)
  return parts.length > 1 && parentOperator && parentOperator !== operator ? `(${joined})` : joined
}

export const normGuid = (guid) => guid?.replace(/[{}]/g, '').toLowerCase()

// Readable condition: the designer emits `x not-null AND x == v`, the guard adds nothing when reading.
// `t` is the i18n dictionary (only t.text.outsideHours / insideHours are used).
export const simplify = (when, t) =>
  when
    .replace(/([\w.]+) not-null AND \1 /g, '$1 ')
    .replace(/[\w.]*iswithinoperatinghour == "false"/g, t.text.outsideHours)
    .replace(/[\w.]*iswithinoperatinghour == "true"/g, t.text.insideHours)
    .replace(/\bliveworkitemcontext\./g, '') // context variables read better by their own name

export function parseRules(xml) {
  const rules = []
  const walk = (node) => (node.tag === 'rule' ? rules.push(node) : node.children.forEach(walk))
  walk(parseXml(xml ?? ''))
  const setOf = (setattribute) => ({ attr: setattribute.children[0]?.text.trim(), value: setattribute.children[1]?.text.trim() })
  const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)])
  return rules.map((rule) => {
    // overflow rules put their conditions straight under <rule>, with no <logical> around them: all must hold
    const logic = rule.children.filter((child) => child.tag === 'logical' || child.tag === 'condition')
    const action = rule.children.find((child) => child.tag === 'action') ?? { children: [] }
    const actions = action.children
    // percentage-based routing: <upsertrecords><records><record> with queuedetails.queueid + queuedetails.percentage
    const shares = descendants(action).filter((node) => node.tag === 'record').map((record) => {
      const fields = Object.fromEntries(record.children.filter((child) => child.tag === 'setattribute').map(setOf).map(({ attr, value }) => [attr, value]))
      return { attr: 'assign_to.queue', value: fields['queuedetails.queueid'], percentage: fields['queuedetails.percentage'] }
    }).filter((share) => share.value)
    return {
      id: rule.attrs.id,
      name: rule.attrs.name,
      when: expressionOf(logic.length > 1 ? { tag: 'logical', attrs: { operator: 'AND' }, children: logic } : logic[0] ?? { children: [] }),
      set: [...actions.filter((child) => child.tag === 'setattribute').map(setOf), ...shares],
      orderBy: actions.filter((action) => action.tag === 'orderby').map((action) => action.text.trim() + (action.attrs.descending === 'true' ? ' desc' : '')),
    }
  })
}
