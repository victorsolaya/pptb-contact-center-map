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
  const outgoing = new Map(), incoming = new Map()
  for (const edge of graph.edges) {
    ;(outgoing.get(edge.source) ?? outgoing.set(edge.source, []).get(edge.source)).push(edge)
    ;(incoming.get(edge.target) ?? incoming.set(edge.target, []).get(edge.target)).push(edge)
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const keep = new Set([focusId])
  const walk = (adjacency, nextId) => {
    const stack = [focusId]
    while (stack.length) {
      for (const edge of adjacency.get(stack.pop()) ?? []) {
        const id = nextId(edge)
        if (keep.has(id) || hidden.has(byId.get(id)?.type)) continue
        keep.add(id)
        stack.push(id)
      }
    }
  }
  walk(outgoing, (edge) => edge.target)
  walk(incoming, (edge) => edge.source)
  return {
    nodes: graph.nodes.filter((node) => keep.has(node.id)),
    edges: graph.edges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
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
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = new Map()
  for (const edge of edges) (outgoing.get(edge.source) ?? outgoing.set(edge.source, []).get(edge.source)).push(edge)
  const sectionsByQueue = new Map()
  const sectionsOf = (queueId) => sectionsByQueue.get(queueId) ?? sectionsByQueue.set(queueId, { hours: [], pre: [], in: [], members: [] }).get(queueId)
  const folded = new Set(), dropped = new Set(), added = []

  for (const edge of edges) {
    const source = byId.get(edge.source), target = byId.get(edge.target)
    if (!source || !target || target.id === keepId) continue
    if (edge.kind === 'hours') {
      sectionsOf(source.id).hours.push(target)
      folded.add(target.id)
      dropped.add(edge)
    } else if (source.type !== 'queue') continue
    else if (edge.kind === 'member') {
      sectionsOf(source.id).members.push(target)
      folded.add(target.id)
      dropped.add(edge)
    } else if (edge.kind === 'pre' || edge.kind === 'in') {
      const ruleEdges = outgoing.get(target.id) ?? []
      const rules = ruleEdges.map((ruleEdge) => byId.get(ruleEdge.target)).filter(Boolean)
      const targetEdges = rules.flatMap((rule) => outgoing.get(rule.id) ?? [])
      if ([...rules.map((rule) => rule.id), ...targetEdges.map((targetEdge) => targetEdge.target)].includes(keepId)) continue
      const section = edge.kind
      sectionsOf(source.id)[section].push(...rules.map((rule) => ({ ...rule, targets: (outgoing.get(rule.id) ?? []).map((targetEdge) => byId.get(targetEdge.target)).filter(Boolean) })))
      for (const foldedEdge of [edge, ...ruleEdges, ...targetEdges]) dropped.add(foldedEdge)
      for (const id of [target.id, ...rules.map((rule) => rule.id), ...targetEdges.map((targetEdge) => targetEdge.target)]) folded.add(id)
      // an overflow action that points somewhere else (e.g. transfer to another queue) keeps that hop
      for (const targetEdge of targetEdges)
        for (const onwardEdge of outgoing.get(targetEdge.target) ?? []) {
          dropped.add(onwardEdge)
          added.push({ source: source.id, target: onwardEdge.target, kind: onwardEdge.kind, label: `${t.sections[section]}: ${onwardEdge.label ?? ''}`.trim() })
        }
    }
  }
  const keep = [...edges.filter((edge) => !dropped.has(edge)), ...added]
  const linked = new Set(keep.flatMap((edge) => [edge.source, edge.target]))
  return {
    nodes: nodes
      .filter((node) => !folded.has(node.id) || linked.has(node.id) || node.id === keepId)
      .map((node) => {
        const sections = sectionsByQueue.get(node.id)
        if (!sections) return node
        sections.members.sort((a, b) => a.label.localeCompare(b.label))
        return { ...node, ...Object.fromEntries(Object.entries(sections).filter(([, v]) => v.length)) }
      }),
    edges: keep,
  }
}

const mermaidId = (id) => 'n' + id.replace(/[^a-zA-Z0-9]/g, '')
const mermaidText = (text) => String(text ?? '').replace(/"/g, "'")

export function toMermaid({ nodes, edges }, t = LANGS.en) {
  const lines = ['flowchart LR']
  for (const node of nodes) {
    const extra = SECTIONS.filter(([section]) => node[section]).map(([section]) =>
      `<br/><b>${t.sections[section]}</b>` + node[section].map((item) => `<br/>- ${mermaidText(item.targets ? `${item.sub} → ${item.targets.map((target) => [target.label, target.sub].filter(Boolean).join(' ')).join(', ')}` : item.label)}`).join(''))
    lines.push(`  ${mermaidId(node.id)}["${mermaidText(t.types[node.type] ?? node.type)}: ${mermaidText(node.label)}${extra.join('')}"]:::${node.type}`)
  }
  for (const edge of edges) lines.push(`  ${mermaidId(edge.source)} -->${edge.label ? `|"${mermaidText(edge.label)}"|` : ''} ${mermaidId(edge.target)}`)
  for (const [k, v] of Object.entries(TYPES)) lines.push(`  classDef ${k} fill:${v.color}22,stroke:${v.color}`)
  return lines.join('\n')
}
