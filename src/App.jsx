import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, useReactFlow, getNodesBounds } from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { toPng } from 'html-to-image'
import { TYPES, SECTIONS, neighborhood, toMermaid, foldIntoQueues } from './graph.js'
import { buildGraph } from './build.js'
import { inPptb, loadFromPptb, saveFile, copyText, currentTheme, notify } from './pptb.js'
import { addMember, removeMember, createQueue, deleteQueue, appendRule, removeRule, buildRuleXml, writeRuleset, MEMBER_TABLES, QUEUE_TABLES, RULE_TABLES } from './edit.js'
import { EditDialog, Toast, QueueDialog, RuleDialog, RemoveRuleDialog, WorkstreamDialog, DetailsForm, DetailsDialog } from './EditDialog.jsx'
import { recordOf, runSteps, undoAll, DETAIL_TABLES } from './details.js'
import { createWorkstream, deleteCreated, WORKSTREAM_TABLES } from './workstream.js'
import { normGuid } from './rules.js'
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
        {data.edit && data.ruleEditable && <button className="rm nodrag" title={t.edit.removeRule} onClick={stop(data.onRemoveRule)}>×</button>}
      </div>
      <div className="lbl">{data.label}</div>
      {data.sub && <div className="sub">{data.sub}</div>}
      {data.sets?.length > 0 && <div className="sets">→ {data.sets.join(', ')}</div>}
      {data.edit && data.type === 'ruleset' && data.kind && /<rules[\s/>]/.test(data.xml) && <button className="add add-rule nodrag" onClick={stop(data.onAddRule)}>{t.edit.addRule}</button>}
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

function Diagram({ graph, focusId, hideTypes, onSelect, t, theme, edit, onAdd, onRemove, onAddRule, onRemoveRule }) {
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
    members: edit && n.type === 'queue' && !n.missing ? n.members ?? [] : n.members, // edit mode: empty queues can get agents too
    onAdd: () => onAdd(n),
    onRemove: (m) => onRemove(n, m),
    onAddRule: () => onAddRule(n),
    ruleEditable: n.type === 'rule' && !!graph.nodes.find((x) => x.id === n.rulesetId)?.kind,
    onRemoveRule: () => onRemoveRule(n),
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
      // refit only when the focus or the filters change, so a refresh or folding a section doesn't move the view
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
        <span>{t.text.counts(view.nodes.length, view.edges.length)}</span>
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
  const [dialog, setDialog] = useState(null) // { kind: 'add' | 'confirm' | 'queue' | 'rule' | 'removeRule', ...what that dialog needs }
  const [busy, setBusy] = useState(false)
  const [editError, setEditError] = useState(null)
  const [toast, setToast] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState(null) // node whose details are being edited in the detail panel

  useEffect(() => {
    const load = () => {
      setSnap(undefined)
      setError(null)
      setFocusId(null)
      setSelId(null)
      // nothing from the previous connection may act on the new one
      setDialog(null)
      setToast(null)
      setEdit(false)
      setEditingId(null)
      loadSnapshot().then(setSnap, (e) => setError(e.message))
    }
    load()
    // In PPTB, reload when the user switches connection and follow the ToolBox theme; outside it, follow the system theme.
    const applyTheme = () => currentTheme().then((th) => { document.documentElement.dataset.theme = th; setTheme(th) }, () => {})
    applyTheme()
    if (inPptb()) toolboxAPI.events.on((_, p) => (p?.event === 'connection:updated' ? load() : p?.event === 'settings:updated' && applyTheme()))
    else matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])
  // after a refresh the focused item may be gone (deleted in the admin center)
  useEffect(() => { if (graph && focusId && !graph.nodes.some((n) => n.id === focusId)) setFocusId(null) }, [graph])

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
  // re-read everything from the same connection, keeping what is selected and where the map is
  const refresh = () => {
    setRefreshing(true)
    loadSnapshot().then(setSnap, (e) => setError(e.message)).finally(() => setRefreshing(false))
  }

  // After a change only the affected tables are re-read (focus and layout stay put).
  async function refreshTables(keys) {
    const part = await loadFromPptb(keys)
    if (part) setSnap((s) => s && { ...s, raw: { ...s.raw, ...part.raw } }) // s is undefined if the connection changed meanwhile
  }
  const errText = (e) => {
    const known = { stale: t.edit.stale, staleRecord: t.edit.staleRecord, badDefinition: t.edit.badDefinition, ruleNotFound: t.edit.ruleNotFound }[e?.code]
    if (known) return known
    const message = String(e?.message ?? e)
    // multi-record creates clean up after themselves; say whether that worked
    if (e?.code === 'rolledBack') return `${message}. ${t.edit.rolledBack}`
    if (e?.code === 'partial') return `${message}. ${t.edit.partial(e.leftovers.map((r) => r.label ?? `${r.entity} ${r.id}`).join(', '))}`
    return message
  }
  // `change` applies one change and returns the function that reverts it (offered as Undo).
  async function perform(change, text) {
    setBusy(true)
    setEditError(null)
    try {
      const revert = await change()
      const msg = t.edit.inOrg(text, snap.org, snap.environment)
      notify(t.edit.mode, msg, 'success')
      setToast({ text: msg, undo: revert })
      setDialog(null)
    } catch (e) {
      setEditError(errText(e))
      notify(t.edit.failed, errText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function member(action, queue, user) {
    await (action === 'add' ? addMember : removeMember)(queue.id, user.id)
    await refreshTables(MEMBER_TABLES)
  }
  const applyMember = () => {
    const { action, queue, user } = dialog
    return perform(async () => {
      await member(action, queue, user)
      return () => member(action === 'add' ? 'remove' : 'add', queue, user)
    }, action === 'add' ? t.edit.added(user.label, queue.label) : t.edit.removed(user.label, queue.label))
  }
  const applyQueue = (form) =>
    perform(async () => {
      const id = await createQueue(form)
      await refreshTables(QUEUE_TABLES)
      focus(`queue:${normGuid(id)}`)
      return async () => { await deleteQueue(id); await refreshTables(QUEUE_TABLES) }
    }, t.edit.queueCreated(form.name))
  // Rulesets are written whole: the new XML only differs by the added/removed <rule>, and every write
  // first checks nobody changed the ruleset since it was read. Undo writes the previous XML back.
  const writeRules = (ruleset, makeNext, text) =>
    perform(async () => {
      const before = ruleset.xml
      const next = makeNext(before)
      await writeRuleset(ruleset.guid, before, next)
      await refreshTables(RULE_TABLES)
      return async () => { await writeRuleset(ruleset.guid, next, before); await refreshTables(RULE_TABLES) }
    }, text)
  const applyRule = (ruleset, rule) => writeRules(ruleset, (xml) => appendRule(xml, buildRuleXml(rule)), t.edit.ruleAdded(ruleset.label))
  const applyRemoveRule = (ruleset, rule) => writeRules(ruleset, (xml) => removeRule(xml, rule.ruleId), t.edit.ruleRemoved(ruleset.label))
  const queueOptions = graph.nodes
    .filter((n) => n.type === 'queue' && !n.missing)
    .map((n) => ({ id: n.id.split(':')[1], label: n.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const applyWorkstream = (name, plan) =>
    perform(async () => {
      const { workstreamId, created } = await createWorkstream(name, plan)
      await refreshTables(WORKSTREAM_TABLES)
      focus(`workstream:${normGuid(workstreamId)}`)
      // a retried undo only deletes what an earlier attempt could not
      let remaining = created
      return async () => {
        remaining = await deleteCreated(remaining)
        await refreshTables(WORKSTREAM_TABLES)
        if (remaining.length) throw Object.assign(new Error(t.edit.failed), { code: 'partial', leftovers: remaining })
      }
    }, t.edit.wsCreated(name))
  // Details edited in the detail panel; a retried undo only redoes the steps an earlier attempt could not
  const applyDetails = (node, plan) =>
    perform(async () => {
      let remaining = await runSteps(plan.steps)
      await refreshTables(DETAIL_TABLES[node.type])
      setEditingId(null)
      return async () => {
        remaining = await undoAll(remaining)
        await refreshTables(DETAIL_TABLES[node.type])
        if (remaining.length) throw Object.assign(new Error(t.edit.failed), { code: 'partial', leftovers: remaining })
      }
    }, t.edit.saved(plan.changes.find((c) => /^(msdyn_)?name$/.test(c.col))?.to ?? node.label))
  const openDialog = (d) => { setEditError(null); setDialog(d) }
  async function undo() {
    setBusy(true)
    try {
      await toast.undo()
      setToast(null)
    } catch (e) {
      notify(t.edit.failed, errText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="head">
          <h1>{graph.meta?.org}</h1>
          <button className="refresh" title={t.text.refresh} aria-label={t.text.refresh} disabled={refreshing} onClick={refresh}>{refreshing ? '…' : '↻'}</button>
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
        {edit && (
          <div className="create-panel">
            <span className="create-title">{t.edit.createTitle}</span>
            <div className="create-grid">
              <button className="create-tile queue newq" title={t.edit.queueTitle} onClick={() => openDialog({ kind: 'queue' })}>
                <span className="tile-icon" aria-hidden>▤</span>{t.types.queue}
              </button>
              <button className="create-tile workstream newws" title={t.edit.wsTitle} onClick={() => openDialog({ kind: 'workstream' })}>
                <span className="tile-icon" aria-hidden>⇄</span>{t.types.workstream}
              </button>
            </div>
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
            onAdd={(queue) => openDialog({ kind: 'add', queue })}
            onRemove={(queue, user) => openDialog({ kind: 'confirm', action: 'remove', queue, user })}
            onAddRule={(ruleset) => openDialog({ kind: 'rule', ruleset })}
            onRemoveRule={(rule) => openDialog({ kind: 'removeRule', rule, ruleset: graph.nodes.find((n) => n.id === rule.rulesetId) })} />
          {edit && <div className={'edit-banner ' + (snap.environment ?? '').toLowerCase()}>✎ {t.edit.banner(snap.org, snap.environment ?? '?')}</div>}
          {toast && <Toast toast={toast} busy={busy} onUndo={undo} onClose={() => setToast(null)} t={t} />}
        </ReactFlowProvider>
      </main>
      {sel && (
        <aside className="detail">
          <button className="close" onClick={() => setSelId(null)}>×</button>
          <div className="kind" style={{ background: TYPES[sel.type]?.color }}>{t.types[sel.type]}</div>
          <h2>{sel.label}</h2>
          <div className="detail-actions">
            {sel.id !== focusId && <button onClick={() => focus(sel.id)}>{t.text.centerHere}</button>}
            {edit && editingId !== sel.id && recordOf(snap.raw, sel) && <button className="primary" onClick={() => setEditingId(sel.id)}>✎ {t.edit.editDetails}</button>}
          </div>
          {edit && editingId === sel.id ? (
            <DetailsForm key={sel.id} node={sel} raw={snap.raw} queues={queueOptions} t={t} onCancel={() => setEditingId(null)}
              onReview={(plan) => openDialog({ kind: 'details', node: sel, plan })} />
          ) : (
            <dl>
              {Object.entries(sel.data ?? {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v)}</dd></div>
              ))}
            </dl>
          )}
        </aside>
      )}
      {(dialog?.kind === 'add' || dialog?.kind === 'confirm') && (
        <EditDialog dialog={dialog} setDialog={(d) => { setEditError(null); setDialog(d) }} apply={applyMember} busy={busy} error={editError} org={snap.org} env={snap.environment} t={t} />
      )}
      {dialog?.kind === 'workstream' && (
        <WorkstreamDialog raw={snap.raw} org={snap.org} env={snap.environment} busy={busy} error={editError} onApply={applyWorkstream} onBack={() => setEditError(null)} onClose={() => setDialog(null)} t={t} />
      )}
      {dialog?.kind === 'queue' && (
        <QueueDialog raw={snap.raw} org={snap.org} env={snap.environment} busy={busy} error={editError} onApply={applyQueue} onBack={() => setEditError(null)} onClose={() => setDialog(null)} t={t} />
      )}
      {dialog?.kind === 'rule' && (
        <RuleDialog ruleset={dialog.ruleset} raw={snap.raw} queues={queueOptions} org={snap.org} env={snap.environment} busy={busy} error={editError}
          onApply={(rule) => applyRule(dialog.ruleset, rule)} onBack={() => setEditError(null)} onClose={() => setDialog(null)} t={t} />
      )}
      {dialog?.kind === 'details' && (
        <DetailsDialog node={dialog.node} plan={dialog.plan} raw={snap.raw} queues={queueOptions} org={snap.org} env={snap.environment} busy={busy} error={editError}
          onApply={() => applyDetails(dialog.node, dialog.plan)} onBack={() => setDialog(null)} onClose={() => { setDialog(null); setEditingId(null) }} t={t} />
      )}
      {dialog?.kind === 'removeRule' && (
        <RemoveRuleDialog rule={dialog.rule} ruleset={dialog.ruleset} org={snap.org} env={snap.environment} busy={busy} error={editError}
          onApply={() => applyRemoveRule(dialog.ruleset, dialog.rule)} onClose={() => setDialog(null)} t={t} />
      )}
    </div>
  )
}
