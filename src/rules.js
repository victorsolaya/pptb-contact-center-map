// Parser for Dataverse decision-ruleset XML: <decision><rules><rule><logical|condition/><action/></rule></rules></decision>
// Machine-generated XML with no CDATA/namespaces, so a regex tokenizer is enough.

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export function parseXml(xml) {
  const root = { tag: '#root', attrs: {}, children: [], text: '' }
  const stack = [root]
  for (const m of xml.matchAll(/<(\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack.at(-1)
    if (m[5] !== undefined) top.text += decode(m[5])
    else if (m[1]) stack.length > 1 && stack.pop()
    else {
      const node = { tag: m[2], attrs: Object.fromEntries([...m[3].matchAll(/([\w:.-]+)="([^"]*)"/g)].map((a) => [a[1], decode(a[2])])), children: [], text: '' }
      top.children.push(node)
      if (!m[4]) stack.push(node)
    }
  }
  return root
}

const side = (s) => (s.attrs.type === 'staticvalue' ? JSON.stringify(s.text.trim()) : s.text.trim())

function expr(n, parentOp) {
  if (n.tag === 'condition') {
    const [l, r] = n.children
    return [l && side(l), n.attrs.operator, r && side(r)].filter(Boolean).join(' ')
  }
  if (n.tag !== 'logical') return ''
  const op = n.attrs.operator
  const parts = n.children.map((c) => expr(c, op)).filter(Boolean)
  const s = parts.join(` ${op} `)
  return parts.length > 1 && parentOp && parentOp !== op ? `(${s})` : s
}

export const normGuid = (v) => v?.replace(/[{}]/g, '').toLowerCase()

// Readable condition: the designer emits `x not-null AND x == v`, the guard adds nothing when reading.
// `t` is the i18n dictionary (only t.text.outsideHours / insideHours are used).
export const simplify = (when, t) =>
  when
    .replace(/([\w.]+) not-null AND \1 /g, '$1 ')
    .replace(/[\w.]*iswithinoperatinghour == "false"/g, t.text.outsideHours)
    .replace(/[\w.]*iswithinoperatinghour == "true"/g, t.text.insideHours)

export function parseRules(xml) {
  const rules = []
  const walk = (n) => (n.tag === 'rule' ? rules.push(n) : n.children.forEach(walk))
  walk(parseXml(xml ?? ''))
  return rules.map((r) => {
    const logic = r.children.find((c) => c.tag === 'logical' || c.tag === 'condition')
    const acts = r.children.find((c) => c.tag === 'action')?.children ?? []
    return {
      id: r.attrs.id,
      name: r.attrs.name,
      when: logic ? expr(logic) : '',
      set: acts.filter((a) => a.tag === 'setattribute').map((a) => ({ attr: a.children[0]?.text.trim(), value: a.children[1]?.text.trim() })),
      orderBy: acts.filter((a) => a.tag === 'orderby').map((o) => o.text.trim() + (o.attrs.descending === 'true' ? ' desc' : '')),
    }
  })
}
