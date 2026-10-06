import { useEffect, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { TYPES } from './graph.js'
import { buildGraph } from './build.js'
import { inPptb, loadFromPptb, currentTheme } from './pptb.js'
import { recordOf } from './details.js'
import { LANGS, initialLang, saveLang } from './i18n.js'
import { Diagram } from './Diagram.jsx'
import { useEditActions } from './useEditActions.js'
import { Toast } from './dialogs/common.jsx'
import { MemberDialog } from './dialogs/MemberDialog.jsx'
import { QueueDialog } from './dialogs/QueueDialog.jsx'
import { RuleDialog, RemoveRuleDialog } from './dialogs/RuleDialog.jsx'
import { WorkstreamDialog } from './dialogs/WorkstreamDialog.jsx'
import { DetailsForm, DetailsDialog } from './dialogs/DetailsDialog.jsx'

// Power Platform ToolBox: the host's active connection. `npm run dev`: dev/raw.json (gitignored,
// a saved Web API snapshot of a real org). null = nothing to show yet.
async function loadSnapshot() {
  if (inPptb()) return loadFromPptb()
  if (!import.meta.env.DEV) return null // published build: data only ever comes from ToolBox
  const response = await fetch('dev/raw.json')
  return response.ok && response.headers.get('content-type')?.includes('json') ? response.json() : null
}

export default function App() {
  const [snapshot, setSnapshot] = useState(undefined) // undefined = loading, null = no data / no connection
  const [error, setError] = useState(null)
  const [lang, setLang] = useState(initialLang)
  const [theme, setTheme] = useState('light')
  const t = LANGS[lang]
  const graph = useMemo(() => (snapshot ? buildGraph(snapshot, t) : null), [snapshot, t])
  const [search, setSearch] = useState('')
  const [listType, setListType] = useState('workstream')
  const [hideTypes, setHideTypes] = useState([])
  const [focusId, setFocusId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [edit, setEdit] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState(null) // node whose details are being edited in the detail panel
  const focus = (id) => { setFocusId(id); setSelectedId(id) }
  const {
    dialog, setDialog, openDialog, busy, editError, setEditError, toast, setToast, undo,
    applyMember, applyQueue, applyRule, applyRemoveRule, applyWorkstream, applyDetails,
  } = useEditActions({ snapshot, setSnapshot, t, focus, setEditingId })

  useEffect(() => {
    const load = () => {
      setSnapshot(undefined)
      setError(null)
      setFocusId(null)
      setSelectedId(null)
      // nothing from the previous connection may act on the new one
      setDialog(null)
      setToast(null)
      setEdit(false)
      setEditingId(null)
      loadSnapshot().then(setSnapshot, (e) => setError(e.message))
    }
    load()
    // In PPTB, reload when the user switches connection and follow the ToolBox theme; outside it, follow the system theme.
    const applyTheme = () => currentTheme().then((nextTheme) => { document.documentElement.dataset.theme = nextTheme; setTheme(nextTheme) }, () => {})
    applyTheme()
    if (inPptb()) toolboxAPI.events.on((_, payload) => (payload?.event === 'connection:updated' ? load() : payload?.event === 'settings:updated' && applyTheme()))
    else matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])
  // after a refresh the focused item may be gone (deleted in the admin center)
  useEffect(() => { if (graph && focusId && !graph.nodes.some((node) => node.id === focusId)) setFocusId(null) }, [graph])

  const counts = useMemo(() => {
    const byType = {}
    for (const node of graph?.nodes ?? []) byType[node.type] = (byType[node.type] ?? 0) + 1
    return byType
  }, [graph])

  const list = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (graph?.nodes ?? [])
      .filter((node) => (term ? (node.label + ' ' + (node.sub ?? '')).toLowerCase().includes(term) : node.type === listType))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 300)
  }, [graph, search, listType])

  if (error) return <div className="empty">{error}</div>
  if (snapshot === undefined) return <div className="empty">{t.text.loading}</div>
  if (!graph) return <div className="empty">{inPptb() ? t.text.noConnection : t.text.noData}</div>
  const selected = graph.nodes.find((node) => node.id === selectedId)
  const canEditSelected = edit && selected && recordOf(snapshot.raw, selected)
  // re-read everything from the same connection, keeping what is selected and where the map is
  const refresh = () => {
    setEditingId(null) // the form's values would be older than the refreshed map
    setRefreshing(true)
    loadSnapshot().then(setSnapshot, (e) => setError(e.message)).finally(() => setRefreshing(false))
  }
  // queues a rule or a workstream can point to (placeholders for queues not found are left out)
  const queueOptions = graph.nodes
    .filter((node) => node.type === 'queue' && !node.missing)
    .map((node) => ({ id: node.id.split(':')[1], label: node.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  // what every edit dialog shows: where the change goes, whether it is running, why it failed
  const dialogProps = { org: snapshot.org, env: snapshot.environment, busy, error: editError, t }

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
        {snapshot.environment && (
          <div className="envrow">
            <span className={'env ' + snapshot.environment.toLowerCase()} title={t.edit.env}>{snapshot.environment}</span>
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
            {graph.meta.warnings.map((warning) => <div key={warning}>{warning}</div>)}
          </details>
        )}
        <input placeholder={t.text.search} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="types">
          {Object.entries(TYPES).filter(([type]) => counts[type]).map(([type, typeStyle]) => (
            <label key={type} className={listType === type && !search ? 'on' : ''}>
              <input
                type="checkbox"
                title={t.text.showInDiagram}
                checked={!hideTypes.includes(type)}
                onChange={(e) => setHideTypes((hidden) => (e.target.checked ? hidden.filter((hiddenType) => hiddenType !== type) : [...hidden, type]))}
              />
              <span className="dot" style={{ background: typeStyle.color }} />
              <span onClick={(e) => { e.preventDefault(); setSearch(''); setListType(type) }}>{t.types[type]} ({counts[type]})</span>
            </label>
          ))}
        </div>
        <ul className="list">
          {list.map((node) => (
            <li key={node.id} className={node.id === focusId ? 'on' : ''} onClick={() => focus(node.id)}>
              <span className="dot" style={{ background: TYPES[node.type]?.color }} />
              {node.label}
              {node.sub && <small>{node.sub}</small>}
            </li>
          ))}
        </ul>
      </aside>
      <main className="main">
        <ReactFlowProvider>
          <Diagram graph={graph} focusId={focusId} hideTypes={hideTypes} onSelect={setSelectedId} t={t} theme={theme} edit={edit}
            onAdd={(queue) => openDialog({ kind: 'add', queue })}
            onRemove={(queue, user) => openDialog({ kind: 'confirm', action: 'remove', queue, user })}
            onAddRule={(ruleset) => openDialog({ kind: 'rule', ruleset })}
            onRemoveRule={(rule) => openDialog({ kind: 'removeRule', rule, ruleset: graph.nodes.find((node) => node.id === rule.rulesetId) })} />
          {edit && <div className={'edit-banner ' + (snapshot.environment ?? '').toLowerCase()}>✎ {t.edit.banner(snapshot.org, snapshot.environment ?? '?')}</div>}
          {toast && <Toast toast={toast} busy={busy} onUndo={undo} onClose={() => setToast(null)} t={t} />}
        </ReactFlowProvider>
      </main>
      {selected && (
        <aside className="detail">
          <button className="close" onClick={() => setSelectedId(null)}>×</button>
          <div className="kind" style={{ background: TYPES[selected.type]?.color }}>{t.types[selected.type]}</div>
          <h2>{selected.label}</h2>
          <div className="detail-actions">
            {selected.id !== focusId && <button onClick={() => focus(selected.id)}>{t.text.centerHere}</button>}
            {canEditSelected && editingId !== selected.id && <button className="primary" onClick={() => setEditingId(selected.id)}>✎ {t.edit.editDetails}</button>}
          </div>
          {canEditSelected && editingId === selected.id ? (
            <DetailsForm key={selected.id} node={selected} raw={snapshot.raw} queues={queueOptions} t={t} onCancel={() => setEditingId(null)}
              onReview={(plan) => openDialog({ kind: 'details', node: selected, plan })} />
          ) : (
            <dl>
              {Object.entries(selected.data ?? {}).filter(([, value]) => value != null && value !== '').map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)}</dd></div>
              ))}
            </dl>
          )}
        </aside>
      )}
      {(dialog?.kind === 'add' || dialog?.kind === 'confirm') && (
        <MemberDialog dialog={dialog} setDialog={openDialog} apply={applyMember} {...dialogProps} />
      )}
      {dialog?.kind === 'workstream' && (
        <WorkstreamDialog raw={snapshot.raw} {...dialogProps} onApply={applyWorkstream} onBack={() => setEditError(null)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'queue' && (
        <QueueDialog raw={snapshot.raw} {...dialogProps} onApply={applyQueue} onBack={() => setEditError(null)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'rule' && (
        <RuleDialog ruleset={dialog.ruleset} raw={snapshot.raw} queues={queueOptions} {...dialogProps}
          onApply={(rule) => applyRule(dialog.ruleset, rule)} onBack={() => setEditError(null)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'details' && (
        <DetailsDialog node={dialog.node} plan={dialog.plan} raw={snapshot.raw} queues={queueOptions} {...dialogProps}
          onApply={() => applyDetails(dialog.node, dialog.plan)} onBack={() => setDialog(null)} onClose={() => { setDialog(null); setEditingId(null) }} />
      )}
      {dialog?.kind === 'removeRule' && (
        <RemoveRuleDialog rule={dialog.rule} ruleset={dialog.ruleset} {...dialogProps}
          onApply={() => applyRemoveRule(dialog.ruleset, dialog.rule)} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
