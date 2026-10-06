// Parser for Dataverse decision-ruleset XML: <decision><rules><rule><logical|condition/><action/></rule></rules></decision>
// Machine-generated XML with no CDATA/namespaces, so a regex tokenizer is enough.

const decode = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export function parseXml(xml) {
  const root = { tag: '#root', attrs: {}, children: [], text: '' }
  const stack = [root]
  for (const match of xml.matchAll(/<(\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack.at(-1)
    if (match[5] !== undefined) top.text += decode(match[5])
    else if (match[1]) stack.length > 1 && stack.pop()
    else {
      const node = { tag: match[2], attrs: Object.fromEntries([...match[3].matchAll(/([\w:.-]+)="([^"]*)"/g)].map((attrMatch) => [attrMatch[1], decode(attrMatch[2])])), children: [], text: '' }
      top.children.push(node)
      if (!match[4]) stack.push(node)
    }
  }
  return root
}

const operandText = (operand) => (operand.attrs.type === 'staticvalue' ? JSON.stringify(operand.text.trim()) : operand.text.trim())

function expressionOf(node, parentOperator) {
  if (node.tag === 'condition') {
    const [left, right] = node.children
    return [left && operandText(left), node.attrs.operator, right && operandText(right)].filter(Boolean).join(' ')
  }
  if (node.tag !== 'logical') return ''
  const operator = node.attrs.operator
  const parts = node.children.map((child) => expressionOf(child, operator)).filter(Boolean)
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
  return rules.map((rule) => {
    const logic = rule.children.find((child) => child.tag === 'logical' || child.tag === 'condition')
    const actions = rule.children.find((child) => child.tag === 'action')?.children ?? []
    return {
      id: rule.attrs.id,
      name: rule.attrs.name,
      when: logic ? expressionOf(logic) : '',
      set: actions.filter((action) => action.tag === 'setattribute').map((action) => ({ attr: action.children[0]?.text.trim(), value: action.children[1]?.text.trim() })),
      orderBy: actions.filter((action) => action.tag === 'orderby').map((action) => action.text.trim() + (action.attrs.descending === 'true' ? ' desc' : '')),
    }
  })
}
