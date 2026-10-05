import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, useReactFlow, getNodesBounds } from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { toPng } from 'html-to-image'
import { TYPES, SECTIONS, neighborhood, toMermaid, foldIntoQueues } from './graph.js'
import { buildGraph } from './build.js'
import { inPptb, loadFromPptb, saveFile, copyText, currentTheme, notify } from './pptb.js'
import { addMember, removeMember, MEMBER_TABLES } from './edit.js'
import { EditDialog, Toast } from './EditDialog.jsx'
import { LANGS, initialLang, saveLang } from './i18n.js'

// Power Platform ToolBox: the host's active connection. `npm run dev`: dev/raw.json (gitignored,
// a saved Web API snapshot of a real org). null = nothing to show yet.
async function loadSnapshot() {
  if (inPptb()) return loadFromPptb()
  if (!import.meta.env.DEV) return null // published build: data only ever comes from ToolBox
  const r = await fetch('dev/raw.json')
  return r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null
}

const elk = new ELK()
const EDGE = {
  light: { stroke: '#94a3b8', label: '#475569', labelBg: '#ffffff', lit: '#1e293b', png: '#ffffff' },
  dark: { stroke: '#64748b', label: '#cbd5e1', labelBg: '#111827', lit: '#e5e7eb', png: '#0b1120' },
}
const stop = (fn) => (e) => { e.stopPropagation(); fn() }

// −/+ button; class "min" is left out of the PNG export
const MinButton = ({ open, onClick, title, t }) => (
  <button className="min nodrag" title={open ? t.text.minimize(title) : t.text.expand(title)} onClick={stop(onClick)}>{open ? '−' : '+'}</button>
)

function NodeBody({ data }) {
  const { t } = data
  const color = TYPES[data.type]?.color ?? '#999'
  const secs = SECTIONS.filter(([k]) => Array.isArray(data[k]))
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
                ) : k === 'members' && data.edit ? (
                  <span className="member">{x.label}<button className="rm nodrag" title={t.edit.remove} onClick={stop(() => data.onRemove(x))}>×</button></span>
                ) : x.label}
              </div>
            ))}
            {open && k === 'members' && data.edit && <div className="row add nodrag" onClick={stop(data.onAdd)}>{t.edit.addAgent}</div>}
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

function Diagram({ graph, focusId, hideTypes, onSelect, t, theme, edit, onAdd, onRemove }) {
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
    edit,
    members: edit && n.type === 'queue' ? n.members ?? [] : n.members, // edit mode: empty queues can get agents too
    onAdd: () => onAdd(n),
    onRemove: (m) => onRemove(n, m),
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
        edges: view.edges.map((e, i) => ({ id: 'e' + i, source: e.source, target: e.target, label: e.label })),
      })
      // refit only when the focus changes, not when a section is folded/unfolded
      const fitKey = `${focusId}|${hideTypes.join()}`
      if (fitted.current !== fitKey) requestAnimationFrame(() => fitView({ padding: 0.1 }))
      fitted.current = fitKey
    })
    return () => { live = false }
  }, [view, open, edit])

  // One click lights up the clicked card's incoming path and the whole tree below it; the rest fades.
  useEffect(() => setHi(null), [view])
  // Edge colors are literal per theme (not React Flow's CSS vars) so html-to-image keeps them in the PNG.
  const shown = useMemo(() => {
    const c = EDGE[theme]
    const lit = hi && view?.nodes.some((n) => n.id === hi) ? new Set(neighborhood(view, hi).nodes.map((n) => n.id)) : null
    const on = (e) => !lit || (lit.has(e.source) && lit.has(e.target))
    return {
      nodes: lit ? flow.nodes.map((n) => ({ ...n, className: lit.has(n.id) ? 'lit' : 'dim' })) : flow.nodes,
      edges: flow.edges.map((e) => ({
        ...e,
        style: lit && on(e) ? { stroke: c.lit, strokeWidth: 2.5 } : { stroke: c.stroke, strokeWidth: 1.5, opacity: on(e) ? 1 : 0.12 },
        labelStyle: { fill: c.label, fontSize: 10, opacity: on(e) ? 1 : 0.2 },
        labelBgStyle: { fill: c.labelBg },
      })),
    }
  }, [flow, hi, view, theme])

  async function exportPng() {
    const b = getNodesBounds(getNodes()), pad = 40
    const width = b.width + pad * 2, height = b.height + pad * 2
    // ponytail: pixelRatio 2 fixed; huge graphs can exceed browser canvas limits -> lower it if export comes out blank
    const url = await toPng(document.querySelector('.react-flow__viewport'), {
      backgroundColor: EDGE[theme].png, width, height, pixelRatio: 2,
      filter: (el) => !['min', 'rm', 'add'].some((c) => el.classList?.contains(c)),
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
        colorMode={theme}
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
  const [theme, setTheme] = useState('light')
  const t = LANGS[lang]
  const graph = useMemo(() => (snap ? buildGraph(snap, t) : null), [snap, t])
  const [q, setQ] = useState('')
  const [listType, setListType] = useState('workstream')
  const [hideTypes, setHideTypes] = useState([])
  const [focusId, setFocusId] = useState(null)
  const [selId, setSelId] = useState(null)
  const [edit, setEdit] = useState(false)
  const [dialog, setDialog] = useState(null) // { kind: 'add', queue } | { kind: 'confirm', action, queue, user }
  const [busy, setBusy] = useState(false)
  const [editError, setEditError] = useState(null)
  const [toast, setToast] = useState(null)

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
    // follow the PPTB theme (or the system one outside PPTB)
    const applyTheme = () => currentTheme().then((th) => { document.documentElement.dataset.theme = th; setTheme(th) }, () => {})
    applyTheme()
    if (inPptb()) toolboxAPI.events.on((_, p) => (p?.event === 'connection:updated' ? load() : p?.event === 'settings:updated' && applyTheme()))
    else matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
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

  // One membership change, then re-read only memberships/users (focus and layout stay put).
  async function run(action, queue, user) {
    await (action === 'add' ? addMember : removeMember)(queue.id, user.id)
    const part = await loadFromPptb(MEMBER_TABLES)
    if (part) setSnap((s) => ({ ...s, raw: { ...s.raw, ...part.raw } }))
  }
  async function apply() {
    const { action, queue, user } = dialog
    setBusy(true)
    setEditError(null)
    try {
      await run(action, queue, user)
      const text = action === 'add' ? t.edit.added(user.label, queue.label) : t.edit.removed(user.label, queue.label)
      notify(t.edit.mode, `${text} · ${snap.org} (${snap.environment})`, 'success')
      setToast({ text: `${text} · ${snap.org} (${snap.environment})`, undo: () => run(action === 'add' ? 'remove' : 'add', queue, user) })
      setDialog(null)
    } catch (e) {
      setEditError(String(e?.message ?? e))
      notify(t.edit.failed, String(e?.message ?? e), 'error')
    } finally {
      setBusy(false)
    }
  }
  async function undo() {
    setBusy(true)
    try {
      await toast.undo()
      setToast(null)
    } catch (e) {
      notify(t.edit.failed, String(e?.message ?? e), 'error')
    } finally {
      setBusy(false)
    }
  }

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
        {snap.environment && (
          <div className="envrow">
            <span className={'env ' + snap.environment.toLowerCase()} title={t.edit.env}>{snap.environment}</span>
            {inPptb() && (
              <label className="switch">
                <input type="checkbox" checked={edit} onChange={(e) => setEdit(e.target.checked)} /> {t.edit.mode}
              </label>
            )}
          </div>
        )}
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
          <Diagram graph={graph} focusId={focusId} hideTypes={hideTypes} onSelect={setSelId} t={t} theme={theme} edit={edit}
            onAdd={(queue) => { setEditError(null); setDialog({ kind: 'add', queue }) }}
            onRemove={(queue, user) => { setEditError(null); setDialog({ kind: 'confirm', action: 'remove', queue, user }) }} />
          {toast && <Toast toast={toast} busy={busy} onUndo={undo} onClose={() => setToast(null)} t={t} />}
        </ReactFlowProvider>
      </main>
      {sel && (
        <aside className="detail">
          <button className="close" onClick={() => setSelId(null)}>×</button>
          <div className="kind" style={{ background: TYPES[sel.type]?.color }}>{t.types[sel.type]}</div>
          <h2>{sel.label}</h2>
          {sel.id !== focusId && <button onClick={() => focus(sel.id)}>{t.text.centerHere}</button>}
          <dl>
            {Object.entries(sel.data ?? {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v)}</dd></div>
            ))}
          </dl>
        </aside>
      )}
      {dialog && <EditDialog dialog={dialog} setDialog={setDialog} apply={apply} busy={busy} error={editError} org={snap.org} env={snap.environment} t={t} />}
    </div>
  )
}
