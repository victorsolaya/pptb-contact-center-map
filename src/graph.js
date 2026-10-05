// Pure graph helpers (no React) so they can be checked with `node src/graph.test.mjs`.

import { LANGS } from './i18n.js'

// Node colors per type; display names live in i18n (t.types).
export const TYPES = {
  channel: { color: '#0ea5e9' },
  workstream: { color: '#6366f1' },
  ruleset: { color: '#a855f7' },
  rule: { color: '#d946ef' },
  queue: { color: '#f59e0b' },
  overflow: { color: '#ef4444' },
  hours: { color: '#14b8a6' },
  capacity: { color: '#64748b' },
  user: { color: '#22c55e' },
}

// Focus node + everything upstream (ancestors) + everything downstream (descendants).
// Walking each direction separately avoids pulling in siblings: focusing a user shows
// only the queues/rules/workstreams that can reach that user, not every other user.
export function neighborhood(graph, focusId, { hideTypes = [] } = {}) {
  const hidden = new Set(hideTypes)
  const out = new Map(), inc = new Map()
  for (const e of graph.edges) {
    ;(out.get(e.source) ?? out.set(e.source, []).get(e.source)).push(e)
    ;(inc.get(e.target) ?? inc.set(e.target, []).get(e.target)).push(e)
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const keep = new Set([focusId])
  const walk = (adj, next) => {
    const stack = [focusId]
    while (stack.length) {
      for (const e of adj.get(stack.pop()) ?? []) {
        const id = next(e)
        if (keep.has(id) || hidden.has(byId.get(id)?.type)) continue
        keep.add(id)
        stack.push(id)
      }
    }
  }
  walk(out, (e) => e.target)
  walk(inc, (e) => e.source)
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
  }
}

// Sections drawn inside a queue card: [key (also t.sections key), color, open by default]
export const SECTIONS = [
  ['hours', '#0d9488', true],
  ['pre', '#dc2626', true],
  ['in', '#ea580c', true],
  ['members', '#16a34a', false],
]

// What belongs to one queue is drawn inside it: its operating hours, its PreQueue/InQueue overflow
// rules (ruleset -> rules -> overflow action) and its agents. Hours are also folded into channels.
// No shared nodes, so no edges cross between queues. keepId (the focused node) is never folded away.
export function foldIntoQueues({ nodes, edges }, keepId, t = LANGS.en) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map()
  for (const e of edges) (out.get(e.source) ?? out.set(e.source, []).get(e.source)).push(e)
  const into = new Map()
  const slot = (q) => into.get(q) ?? into.set(q, { hours: [], pre: [], in: [], members: [] }).get(q)
  const folded = new Set(), dropped = new Set(), added = []

  for (const e of edges) {
    const q = byId.get(e.source), n = byId.get(e.target)
    if (!q || !n || n.id === keepId) continue
    if (e.kind === 'hours') {
      slot(q.id).hours.push(n)
      folded.add(n.id)
      dropped.add(e)
    } else if (q.type !== 'queue') continue
    else if (e.kind === 'member') {
      slot(q.id).members.push(n)
      folded.add(n.id)
      dropped.add(e)
    } else if (e.kind === 'pre' || e.kind === 'in') {
      const ruleEdges = out.get(n.id) ?? []
      const rules = ruleEdges.map((re) => byId.get(re.target)).filter(Boolean)
      const targetEdges = rules.flatMap((r) => out.get(r.id) ?? [])
      if ([...rules.map((r) => r.id), ...targetEdges.map((te) => te.target)].includes(keepId)) continue
      const which = e.kind
      slot(q.id)[which].push(...rules.map((r) => ({ ...r, targets: (out.get(r.id) ?? []).map((te) => byId.get(te.target)).filter(Boolean) })))
      for (const x of [e, ...ruleEdges, ...targetEdges]) dropped.add(x)
      for (const id of [n.id, ...rules.map((r) => r.id), ...targetEdges.map((te) => te.target)]) folded.add(id)
      // an overflow action that points somewhere else (e.g. transfer to another queue) keeps that hop
      for (const te of targetEdges)
        for (const fe of out.get(te.target) ?? []) {
          dropped.add(fe)
          added.push({ source: q.id, target: fe.target, kind: fe.kind, label: `${t.sections[which]}: ${fe.label ?? ''}`.trim() })
        }
    }
  }
  const keep = [...edges.filter((e) => !dropped.has(e)), ...added]
  const linked = new Set(keep.flatMap((e) => [e.source, e.target]))
  return {
    nodes: nodes
      .filter((n) => !folded.has(n.id) || linked.has(n.id) || n.id === keepId)
      .map((n) => {
        const s = into.get(n.id)
        if (!s) return n
        s.members.sort((a, b) => a.label.localeCompare(b.label))
        return { ...n, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v.length)) }
      }),
    edges: keep,
  }
}

const mid = (id) => 'n' + id.replace(/[^a-zA-Z0-9]/g, '')
const mtxt = (s) => String(s ?? '').replace(/"/g, "'")

export function toMermaid({ nodes, edges }, t = LANGS.en) {
  const lines = ['flowchart LR']
  for (const n of nodes) {
    const extra = SECTIONS.filter(([k]) => n[k]).map(([k]) =>
      `<br/><b>${t.sections[k]}</b>` + n[k].map((x) => `<br/>· ${mtxt(x.targets ? `${x.sub} → ${x.targets.map((a) => [a.label, a.sub].filter(Boolean).join(' ')).join(', ')}` : x.label)}`).join(''))
    lines.push(`  ${mid(n.id)}["${mtxt(t.types[n.type] ?? n.type)}: ${mtxt(n.label)}${extra.join('')}"]:::${n.type}`)
  }
  for (const e of edges) lines.push(`  ${mid(e.source)} -->${e.label ? `|"${mtxt(e.label)}"|` : ''} ${mid(e.target)}`)
  for (const [k, v] of Object.entries(TYPES)) lines.push(`  classDef ${k} fill:${v.color}22,stroke:${v.color}`)
  return lines.join('\n')
}
