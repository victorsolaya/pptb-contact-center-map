import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, useReactFlow, getNodesBounds } from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { toPng } from 'html-to-image'
import { TYPES, SECTIONS, neighborhood, toMermaid, foldIntoQueues } from './graph.js'
import { buildGraph } from './build.js'
import { inPptb, loadFromPptb, saveFile, copyText } from './pptb.js'
import { LANGS, initialLang, saveLang } from './i18n.js'

// Power Platform ToolBox: the host's active connection. `npm run dev`: dev/raw.json (gitignored,
// a saved Web API snapshot of a real org). null = nothing to show yet.
async function loadSnapshot() {
  if (inPptb()) return loadFromPptb()
  const r = await fetch('dev/raw.json')
  return r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null
}

const elk = new ELK()
const stop = (fn) => (e) => { e.stopPropagation(); fn() }

// −/+ button; class "min" is left out of the PNG export
const MinButton = ({ open, onClick, title, t }) => (
  <button className="min nodrag" title={open ? t.text.minimize(title) : t.text.expand(title)} onClick={stop(onClick)}>{open ? '−' : '+'}</button>
)

function NodeBody({ data }) {
  const { t } = data
  const color = TYPES[data.type]?.color ?? '#999'
  const secs = SECTIONS.filter(([k]) => data[k])
  const anyOpen = secs.some(([k]) => data.isOpen(k))
  return (
    <div className={'ccnode' + (data.focus ? ' focus' : '')} style={{ borderColor: color }}>
      <div className="top">
        <div className="kind" style={{ background: color }}>{t.types[data.type] ?? data.type}</div>
        {secs.length > 0 && <MinButton t={t} open={anyOpen} title={t.text.allBoxes} onClick={() => data.setAll(secs.map(([k]) => k), !anyOpen)} />}
      </div>
      <div className="lbl">{data.label}</div>
      {data.sub && <div className="sub">{data.sub}</div>}
      {secs.map(([k, color]) => {
        const open = data.isOpen(k)
        const title = t.sections[k]
        return (
          <div key={k} className="sec" style={{ borderColor: color }}>
            <div className="sec-h nodrag" style={{ color, background: color + '14' }} onClick={stop(() => data.setAll([k], !open))}>
              <span>{title} <span className="count" style={{ background: color }}>{data[k].length}</span></span>
              <MinButton t={t} open={open} title={title} onClick={() => data.setAll([k], !open)} />
            </div>
            {open && data[k].map((x) => (
              <div key={x.id} className="row nodrag" title={x.data?.[t.fields.condition] ?? x.sub} onClick={stop(() => data.onPick(x.id))}>
                {x.targets ? (
                  <>
                    <div className="cond">{x.sub === t.text.always ? t.text.alwaysCap : t.text.when(x.sub)}</div>
                    {x.targets.map((a) => <div key={a.id} className="act">→ {a.label}{a.sub ? `: ${a.sub}` : ''}</div>)}
                  </>
                ) : x.label}
              </div>
            ))}
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

async function layout(view, size) {
  const res = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '24',
    },
    children: view.nodes.map((n) => ({ id: n.id, ...size.get(n.id) })),
    edges: view.edges.map((e, i) => ({ id: 'e' + i, sources: [e.source], targets: [e.target] })),
  })
  return new Map(res.children.map((c) => [c.id, { x: c.x, y: c.y }]))
}

function Diagram({ graph, focusId, hideTypes, onSelect, t }) {
  const [flow, setFlow] = useState({ nodes: [], edges: [] })
  const [open, setOpen] = useState(new Map()) // `${nodeId}:${section}` -> bool
  const [hi, setHi] = useState(null) // clicked node: light up what it relates to
  const { fitView, getNodes } = useReactFlow()
  const measureRef = useRef(null)
  const fitted = useRef(null)
  const view = useMemo(() => (focusId ? foldIntoQueues(neighborhood(graph, focusId, { hideTypes }), focusId, t) : null), [graph, focusId, hideTypes, t])

  const isOpen = (id, k) => open.get(`${id}:${k}`) ?? SECTIONS.find((s) => s[0] === k)[2]
  const dataFor = (n) => ({
    ...n,
    t,
    focus: n.id === focusId,
    isOpen: (k) => isOpen(n.id, k),
    setAll: (keys, value) => setOpen((o) => { const m = new Map(o); for (const k of keys) m.set(`${n.id}:${k}`, value); return m }),
    onPick: onSelect,
  })
  const sections = view?.nodes.flatMap((n) => SECTIONS.filter(([k]) => n[k]).map(([k]) => [n.id, k])) ?? []
  const allOpen = sections.length > 0 && sections.every(([id, k]) => isOpen(id, k))

  // Card size depends on content (sections, wrapped text): measure the hidden copies rendered
  // below, then let ELK place them. Re-runs when a section is folded/unfolded.
  useLayoutEffect(() => {
    if (!view) return setFlow({ nodes: [], edges: [] })
    const size = new Map([...measureRef.current.children].map((el) => [el.dataset.id, { width: el.offsetWidth, height: el.offsetHeight }]))
    let live = true
    layout(view, size).then((pos) => {
      if (!live) return
      setFlow({
        nodes: view.nodes.map((n) => ({ id: n.id, type: 'cc', position: pos.get(n.id), ...size.get(n.id), data: dataFor(n) })),
        // literal colors (not React Flow's CSS vars) so html-to-image keeps edges in the PNG
        edges: view.edges.map((e, i) => ({
          id: 'e' + i, source: e.source, target: e.target, label: e.label,
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          labelStyle: { fill: '#475569', fontSize: 10 },
          labelBgStyle: { fill: '#ffffff' },
        })),
      })
      // refit only when the focus changes, not when a section is folded/unfolded
      if (fitted.current !== view) requestAnimationFrame(() => fitView({ padding: 0.1 }))
      fitted.current = view
    })
    return () => { live = false }
  }, [view, open])

  // One click lights up the clicked card's incoming path and the whole tree below it; the rest fades.
  useEffect(() => setHi(null), [view])
  const shown = useMemo(() => {
    if (!hi || !view?.nodes.some((n) => n.id === hi)) return flow
    const lit = new Set(neighborhood(view, hi).nodes.map((n) => n.id))
    const on = (e) => lit.has(e.source) && lit.has(e.target)
    return {
      nodes: flow.nodes.map((n) => ({ ...n, className: lit.has(n.id) ? 'lit' : 'dim' })),
      edges: flow.edges.map((e) => ({ ...e, style: on(e) ? { stroke: '#1e293b', strokeWidth: 2.5 } : { ...e.style, opacity: 0.12 }, labelStyle: { ...e.labelStyle, opacity: on(e) ? 1 : 0.2 } })),
    }
  }, [flow, hi, view])

  async function exportPng() {
    const b = getNodesBounds(getNodes()), pad = 40
    const width = b.width + pad * 2, height = b.height + pad * 2
    // ponytail: pixelRatio 2 fixed; huge graphs can exceed browser canvas limits -> lower it if export comes out blank
    const url = await toPng(document.querySelector('.react-flow__viewport'), {
      backgroundColor: '#ffffff', width, height, pixelRatio: 2,
      filter: (el) => !el.classList?.contains('min'),
      style: { width: width + 'px', height: height + 'px', transform: `translate(${pad - b.x}px, ${pad - b.y}px) scale(1)` },
    })
    await saveFile(`${graph.nodes.find((n) => n.id === focusId)?.label ?? t.text.diagram}.png`, url)
  }

  if (!view) return <div className="empty">{t.text.pick}</div>
  return (
    <>
      <div className="toolbar">
        <span>{view.nodes.length} {t.text.nodes} · {view.edges.length} {t.text.links}</span>
        {sections.length > 0 && (
          <button onClick={() => setOpen(new Map(sections.map(([id, k]) => [`${id}:${k}`, !allOpen])))}>{allOpen ? t.text.collapseAll : t.text.expandAll}</button>
        )}
        <button onClick={exportPng}>{t.text.exportPng}</button>
        <button onClick={() => copyText(toMermaid(view, t))}>{t.text.copyMermaid}</button>
      </div>
      <div className="measure" ref={measureRef} aria-hidden>
        {view.nodes.map((n) => <div key={n.id} data-id={n.id}><NodeBody data={dataFor(n)} /></div>)}
      </div>
      <ReactFlow
        nodes={shown.nodes}
        edges={shown.edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => { onSelect(n.id); setHi((h) => (h === n.id ? null : n.id)) }}
        onPaneClick={() => setHi(null)}
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        minZoom={0.05}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={(n) => TYPES[n.data.type]?.color ?? '#999'} pannable zoomable />
      </ReactFlow>
    </>
  )
}

export default function App() {
  const [snap, setSnap] = useState(undefined) // undefined = loading, null = no data / no connection
  const [error, setError] = useState(null)
  const [lang, setLang] = useState(initialLang)
  const t = LANGS[lang]
  const graph = useMemo(() => (snap ? buildGraph(snap, t) : null), [snap, t])
  const [q, setQ] = useState('')
  const [listType, setListType] = useState('workstream')
  const [hideTypes, setHideTypes] = useState([])
  const [focusId, setFocusId] = useState(null)
  const [selId, setSelId] = useState(null)

  useEffect(() => {
    const load = () => {
      setSnap(undefined)
      setError(null)
      setFocusId(null)
      setSelId(null)
      loadSnapshot().then(setSnap, (e) => setError(e.message))
    }
    load()
    // PPTB: reload when the user switches environment in the toolbox
    if (inPptb()) toolboxAPI.events.on((_, p) => p?.event === 'connection:updated' && load())
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const counts = useMemo(() => {
    const c = {}
    for (const n of graph?.nodes ?? []) c[n.type] = (c[n.type] ?? 0) + 1
    return c
  }, [graph])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (graph?.nodes ?? [])
      .filter((n) => (s ? (n.label + ' ' + (n.sub ?? '')).toLowerCase().includes(s) : n.type === listType))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 300)
  }, [graph, q, listType])

  if (error) return <div className="empty">{error}</div>
  if (snap === undefined) return <div className="empty">{t.text.loading}</div>
  if (!graph) return <div className="empty">{inPptb() ? t.text.noConnection : t.text.noData}</div>
  const sel = graph.nodes.find((n) => n.id === selId)
  const focus = (id) => { setFocusId(id); setSelId(id) }

  return (
    <div className="app">
      <aside className="side">
        <div className="head">
          <h1>{graph.meta?.org}</h1>
          <select aria-label={t.text.language} title={t.text.language} value={lang} onChange={(e) => { setLang(e.target.value); saveLang(e.target.value) }}>
            {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </div>
        <small>{t.text.extracted} {graph.meta?.extractedAt && new Date(graph.meta.extractedAt).toLocaleString(lang)}</small>
        {graph.meta.warnings.length > 0 && (
          <details className="warn">
            <summary>{t.text.tablesFailed(graph.meta.warnings.length)}</summary>
            {graph.meta.warnings.map((w) => <div key={w}>{w}</div>)}
          </details>
        )}
        <input placeholder={t.text.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="types">
          {Object.entries(TYPES).filter(([k]) => counts[k]).map(([k, v]) => (
            <label key={k} className={listType === k && !q ? 'on' : ''}>
              <input
                type="checkbox"
                title={t.text.showInDiagram}
                checked={!hideTypes.includes(k)}
                onChange={(e) => setHideTypes((h) => (e.target.checked ? h.filter((x) => x !== k) : [...h, k]))}
              />
              <span className="dot" style={{ background: v.color }} />
              <span onClick={(e) => { e.preventDefault(); setQ(''); setListType(k) }}>{t.types[k]} ({counts[k]})</span>
            </label>
          ))}
        </div>
        <ul className="list">
          {list.map((n) => (
            <li key={n.id} className={n.id === focusId ? 'on' : ''} onClick={() => focus(n.id)}>
              <span className="dot" style={{ background: TYPES[n.type]?.color }} />
              {n.label}
              {n.sub && <small>{n.sub}</small>}
            </li>
          ))}
        </ul>
      </aside>
      <main className="main">
        <ReactFlowProvider>
          <Diagram graph={graph} focusId={focusId} hideTypes={hideTypes} onSelect={setSelId} t={t} />
        </ReactFlowProvider>
      </main>
      {sel && (
        <aside className="detail">
          <button className="close" onClick={() => setSelId(null)}>×</button>
          <div className="kind" style={{ background: TYPES[sel.type]?.color }}>{t.types[sel.type]}</div>
          <h2>{sel.label}</h2>
          {sel.id !== focusId && <button onClick={() => focus(sel.id)}>{t.text.centerHere}</button>}
          <dl>
            {Object.entries(sel.data ?? {}).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v)}</dd></div>
            ))}
          </dl>
        </aside>
      )}
    </div>
  )
}
