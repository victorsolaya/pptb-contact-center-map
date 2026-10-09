import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, useReactFlow } from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { toPng } from 'html-to-image'
import { TYPES, SECTIONS, neighborhood, toMermaid, foldIntoQueues } from './graph.js'
import { saveFile, copyText } from './pptb.js'

// The map: the focused node's neighborhood, laid out by ELK and drawn by React Flow.

const elk = new ELK()
const EDGE_COLORS = {
  light: { stroke: '#94a3b8', label: '#475569', labelBg: '#ffffff', lit: '#1e293b', png: '#ffffff' },
  dark: { stroke: '#64748b', label: '#cbd5e1', labelBg: '#111827', lit: '#e5e7eb', png: '#0b1120' },
}
const stopPropagationThen = (fn) => (e) => { e.stopPropagation(); fn() }

// −/+ button; class "min" is left out of the PNG export
const MinButton = ({ open, onClick, title, t }) => (
  <button className="min nodrag" title={open ? t.text.minimize(title) : t.text.expand(title)} onClick={stopPropagationThen(onClick)}>{open ? '−' : '+'}</button>
)

function NodeBody({ data }) {
  const { t } = data
  const color = TYPES[data.type]?.color ?? '#999'
  const sections = SECTIONS.filter(([section]) => Array.isArray(data[section]))
  const anyOpen = sections.some(([section]) => data.isOpen(section))
  // only editable rulesets whose XML has a <rules> element to append to
  const canAddRule = data.edit && data.type === 'ruleset' && data.kind && /<rules[\s/>]/.test(data.xml)
  return (
    <div className={`ccnode ${data.type}` + (data.focus ? ' focus' : '')} style={{ borderColor: color }}>
      <div className="top">
        <div className="kind" style={{ background: color }}>{t.types[data.type] ?? data.type}</div>
        {sections.length > 0 && <MinButton t={t} open={anyOpen} title={t.text.allBoxes} onClick={() => data.setAll(sections.map(([section]) => section), !anyOpen)} />}
        {data.edit && data.ruleEditable && <button className="rm nodrag" title={t.edit.removeRule} onClick={stopPropagationThen(data.onRemoveRule)}>×</button>}
      </div>
      <div className="lbl">{data.label}</div>
      {data.sub && <div className="sub">{data.sub}</div>}
      {data.sets?.length > 0 && <div className="sets">→ {data.sets.join(', ')}</div>}
      {canAddRule && <button className="add add-rule nodrag" onClick={stopPropagationThen(data.onAddRule)}>{t.edit.addRule}</button>}
      {sections.map(([section, color]) => {
        const open = data.isOpen(section)
        const title = t.sections[section]
        return (
          <div key={section} className="sec" style={{ borderColor: color }}>
            <div className="sec-h nodrag" style={{ color, background: color + '14' }} onClick={stopPropagationThen(() => data.setAll([section], !open))}>
              <span>{title} <span className="count" style={{ background: color }}>{data[section].length}</span></span>
              <MinButton t={t} open={open} title={title} onClick={() => data.setAll([section], !open)} />
            </div>
            {open && data[section].map((item) => (
              <div key={item.id} className="row nodrag" title={item.data?.[t.fields.condition] ?? item.sub} onClick={stopPropagationThen(() => data.onPick(item.id))}>
                {item.targets ? (
                  <>
                    <div className="cond">{item.sub === t.text.always ? t.text.alwaysCap : t.text.when(item.sub)}</div>
                    {item.targets.map((target) => <div key={target.id} className="act">→ {target.label}{target.sub ? `: ${target.sub}` : ''}</div>)}
                  </>
                ) : section === 'members' && data.edit ? (
                  <span className="member">{item.label}<button className="rm nodrag" title={t.edit.remove} onClick={stopPropagationThen(() => data.onRemove(item))}>×</button></span>
                ) : item.label}
              </div>
            ))}
            {open && section === 'members' && data.edit && <div className="row add nodrag" onClick={stopPropagationThen(data.onAdd)}>{t.edit.addAgent}</div>}
          </div>
        )
      })}
    </div>
  )
}

function CcNode({ data }) {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeBody data={data} />
      <Handle type="source" position={Position.Right} />
    </>
  )
}
const nodeTypes = { cc: CcNode }

async function layout(view, sizes) {
  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '24',
    },
    children: view.nodes.map((node) => ({ id: node.id, ...sizes.get(node.id) })),
    edges: view.edges.map((edge, i) => ({ id: 'e' + i, sources: [edge.source], targets: [edge.target] })),
  })
  return new Map(result.children.map((child) => [child.id, { x: child.x, y: child.y }]))
}

export function Diagram({ graph, focusId, hideTypes, onSelect, t, theme, edit, onAdd, onRemove, onAddRule, onRemoveRule }) {
  const [flow, setFlow] = useState({ nodes: [], edges: [] })
  const [open, setOpen] = useState(new Map()) // `${nodeId}:${section}` -> bool
  const [highlightId, setHighlightId] = useState(null) // clicked node: light up what it relates to
  const { fitView, getNodes, getNodesBounds } = useReactFlow()
  const measureRef = useRef(null)
  const lastFitKey = useRef(null)
  const view = useMemo(() => (focusId ? foldIntoQueues(neighborhood(graph, focusId, { hideTypes }), focusId, t) : null), [graph, focusId, hideTypes, t])

  const isOpen = (id, section) => open.get(`${id}:${section}`) ?? SECTIONS.find((entry) => entry[0] === section)[2]
  const dataFor = (node) => ({
    ...node,
    t,
    focus: node.id === focusId,
    isOpen: (section) => isOpen(node.id, section),
    setAll: (keys, value) => setOpen((previous) => { const next = new Map(previous); for (const key of keys) next.set(`${node.id}:${key}`, value); return next }),
    onPick: onSelect,
    edit,
    members: edit && node.type === 'queue' && !node.missing ? node.members ?? [] : node.members, // edit mode: empty queues can get agents too
    onAdd: () => onAdd(node),
    onRemove: (member) => onRemove(node, member),
    onAddRule: () => onAddRule(node),
    ruleEditable: node.type === 'rule' && !!graph.nodes.find((candidate) => candidate.id === node.rulesetId)?.kind,
    onRemoveRule: () => onRemoveRule(node),
  })
  const sections = view?.nodes.flatMap((node) => SECTIONS.filter(([section]) => node[section]).map(([section]) => [node.id, section])) ?? []
  const allOpen = sections.length > 0 && sections.every(([id, section]) => isOpen(id, section))

  // Card size depends on content (sections, wrapped text): measure the hidden copies rendered
  // below, then let ELK place them. Re-runs when a section is folded/unfolded.
  useLayoutEffect(() => {
    if (!view) return setFlow({ nodes: [], edges: [] })
    const sizes = new Map([...measureRef.current.children].map((el) => [el.dataset.id, { width: el.offsetWidth, height: el.offsetHeight }]))
    let live = true
    layout(view, sizes).then((positions) => {
      if (!live) return
      setFlow({
        nodes: view.nodes.map((node) => ({ id: node.id, type: 'cc', position: positions.get(node.id), ...sizes.get(node.id), data: dataFor(node) })),
        edges: view.edges.map((edge, i) => ({ id: 'e' + i, source: edge.source, target: edge.target, label: edge.label })),
      })
      // refit only when the focus or the filters change, so a refresh or folding a section doesn't move the view
      const fitKey = `${focusId}|${hideTypes.join()}`
      if (lastFitKey.current !== fitKey) requestAnimationFrame(() => fitView({ padding: 0.1 }))
      lastFitKey.current = fitKey
    })
    return () => { live = false }
  }, [view, open, edit])

  // One click lights up the clicked card's incoming path and the whole tree below it; the rest fades.
  useEffect(() => setHighlightId(null), [view])
  // Edge colors are literal per theme (not React Flow's CSS vars) so html-to-image keeps them in the PNG.
  const shown = useMemo(() => {
    const colors = EDGE_COLORS[theme]
    const lit = highlightId && view?.nodes.some((node) => node.id === highlightId) ? new Set(neighborhood(view, highlightId).nodes.map((node) => node.id)) : null
    const isActive = (edge) => !lit || (lit.has(edge.source) && lit.has(edge.target))
    return {
      nodes: lit ? flow.nodes.map((node) => ({ ...node, className: lit.has(node.id) ? 'lit' : 'dim' })) : flow.nodes,
      edges: flow.edges.map((edge) => ({
        ...edge,
        style: lit && isActive(edge) ? { stroke: colors.lit, strokeWidth: 2.5 } : { stroke: colors.stroke, strokeWidth: 1.5, opacity: isActive(edge) ? 1 : 0.12 },
        labelStyle: { fill: colors.label, fontSize: 10, opacity: isActive(edge) ? 1 : 0.2 },
        labelBgStyle: { fill: colors.labelBg },
      })),
    }
  }, [flow, highlightId, view, theme])

  async function exportPng() {
    const bounds = getNodesBounds(getNodes()), padding = 40
    const width = bounds.width + padding * 2, height = bounds.height + padding * 2
    // ponytail: pixelRatio 2 fixed; huge graphs can exceed browser canvas limits -> lower it if export comes out blank
    const dataUrl = await toPng(document.querySelector('.react-flow__viewport'), {
      backgroundColor: EDGE_COLORS[theme].png, width, height, pixelRatio: 2,
      filter: (el) => !['min', 'rm', 'add'].some((className) => el.classList?.contains(className)),
      style: { width: width + 'px', height: height + 'px', transform: `translate(${padding - bounds.x}px, ${padding - bounds.y}px) scale(1)` },
    })
    await saveFile(`${graph.nodes.find((node) => node.id === focusId)?.label ?? t.text.diagram}.png`, dataUrl)
  }

  if (!view) return <div className="empty">{t.text.pick}</div>
  return (
    <>
      <div className="toolbar">
        <span>{t.text.counts(view.nodes.length, view.edges.length)}</span>
        {sections.length > 0 && (
          <button onClick={() => setOpen(new Map(sections.map(([id, section]) => [`${id}:${section}`, !allOpen])))}>{allOpen ? t.text.collapseAll : t.text.expandAll}</button>
        )}
        <button onClick={exportPng}>{t.text.exportPng}</button>
        <button onClick={() => copyText(toMermaid(view, t))}>{t.text.copyMermaid}</button>
      </div>
      <div className="measure" ref={measureRef} aria-hidden>
        {view.nodes.map((node) => <div key={node.id} data-id={node.id}><NodeBody data={dataFor(node)} /></div>)}
      </div>
      <ReactFlow
        nodes={shown.nodes}
        edges={shown.edges}
        nodeTypes={nodeTypes}
        colorMode={theme}
        onNodeClick={(_, node) => { onSelect(node.id); setHighlightId((current) => (current === node.id ? null : node.id)) }}
        onPaneClick={() => setHighlightId(null)}
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        minZoom={0.05}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={(node) => TYPES[node.data.type]?.color ?? '#999'} pannable zoomable />
      </ReactFlow>
    </>
  )
}
