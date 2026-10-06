import { useEffect, useState } from 'react'
import { parseIdentification, rewriteIdentification, describeIdentification, valueOptions, valueLabel, operatorText, isConversationValue, takesValue, FIXED_OPERATORS, tableColumns, formatXml, xmlProblem, lineDiff } from '../identification.js'
import { recordOf } from '../details.js'
import { Modal, Target } from './common.jsx'

const optionKey = ({ value, source }) => `${value}|${source ?? ''}`
const FIXED = 'fixed' // value-select entry: compare with a fixed value instead of a conversation value

// Column of the table: a list from the table's metadata, or free text if the metadata can't be read.
function ColumnSelect({ columns, value, onChange, t }) {
  if (!Array.isArray(columns)) return <input placeholder={t.edit.identColumns} value={value} onChange={(e) => onChange(e.target.value.trim())} />
  const known = columns.some((column) => column.name === value)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} title={value}>
      <option value="" />
      {!known && value && <option value={value}>{value}</option>}
      {columns.map((column) => <option key={column.name} value={column.name}>{column.label} ({column.name})</option>)}
    </select>
  )
}

// One condition: a column of the table, the operator, and a conversation value or a fixed value
// (statuscode = 1, not-null...). `isAlternative`: it follows an "or"; `onAddOr`: only on the last line.
function ConditionLine({ condition, columns, options, isAlternative, onChange, onRemove, onAddOr, t }) {
  const isFixed = !isConversationValue(condition)
  return (
    <div className="ident-match">
      <div className="ident-field">
        {isAlternative && <span className="and">{t.text.or}</span>}
        <ColumnSelect columns={columns} value={condition.attribute} t={t} onChange={(attribute) => onChange({ ...condition, attribute })} />
        {onAddOr && <button className="add-or" title={t.edit.identAddField} onClick={onAddOr}>+ {t.text.or}</button>}
      </div>
      {isFixed ? (
        <select className="ident-op" aria-label={t.edit.identFixedValue} value={condition.operator}
          onChange={(e) => onChange({ ...condition, operator: e.target.value, value: takesValue(e.target.value) ? condition.value ?? '' : undefined })}>
          {[...new Set([...FIXED_OPERATORS, condition.operator])].map((operator) => <option key={operator} value={operator}>{operatorText(operator)}</option>)}
        </select>
      ) : <span className="ident-op" aria-hidden>{operatorText(condition.operator)}</span>}
      <div className={'ident-value' + (isFixed && takesValue(condition.operator) ? ' fixed' : '')}>
        <select value={isFixed ? FIXED : optionKey(condition)}
          onChange={(e) => onChange(e.target.value === FIXED
            ? { ...condition, value: '', source: undefined }
            : { ...condition, operator: isFixed ? 'eq' : condition.operator, ...options.find((option) => optionKey(option) === e.target.value) })}>
          {options.map((option) => <option key={optionKey(option)} value={optionKey(option)}>{valueLabel(option, t)}</option>)}
          <option value={FIXED}>{t.edit.identFixedValue}</option>
        </select>
        {isFixed && takesValue(condition.operator) && <input placeholder={t.edit.value} value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} />}
      </div>
      <button className="rm" aria-label="×" onClick={onRemove}>×</button>
    </div>
  )
}

// One row of the filter: a condition, or alternatives where any may match (an OR group). A new
// alternative starts as a copy of the last one with no column, handy for "any of these phone columns".
function MatchRow({ match, columns, options, onChange, onRemove, t }) {
  const setConditions = (conditions) => (conditions.length ? onChange({ conditions }) : onRemove())
  const last = match.conditions.length - 1
  return (
    <div className={'ident-row' + (last > 0 ? ' any' : '')}>
      {match.conditions.map((condition, index) => (
        <ConditionLine key={index} condition={condition} columns={columns} options={options} isAlternative={index > 0} t={t}
          onChange={(next) => setConditions(match.conditions.map((current, i) => (i === index ? next : current)))}
          onRemove={() => setConditions(match.conditions.filter((_, i) => i !== index))}
          onAddOr={index === last ? () => setConditions([...match.conditions, { ...match.conditions[last], attribute: '' }]) : null} />
      ))}
    </div>
  )
}

// One table (account, contact, case): which columns must match which conversation values.
function RuleCard({ rule, edited, columns, options, onChange, onPrefer, t }) {
  const updateMatch = (index, next) => onChange(edited.matches.map((match, i) => (i === index ? next : match)))
  return (
    <div className="ident-card">
      <div className="ident-head">
        <b>{t.text.identTables[rule.entity] ?? rule.entity}</b>
        {rule.preferred !== null && (
          <label className="check"><input type="radio" name="preferred" checked={edited.preferred} onChange={onPrefer} /> {t.edit.identPreferred}</label>
        )}
      </div>
      {!rule.supported ? <p className="muted small">{t.edit.identAdvancedNote}</p> : (
        <>
          <div className="ident-match ident-cols" aria-hidden>
            <span>{t.edit.identColumns}</span><span /><span>{t.edit.identValue}</span><span />
          </div>
          {edited.matches.map((match, index) => (
            <MatchRow key={index} match={match} columns={columns} options={options} t={t}
              onChange={(next) => updateMatch(index, next)} onRemove={() => onChange(edited.matches.filter((_, i) => i !== index))} />
          ))}
          <button className="link" onClick={() => onChange([...edited.matches, { conditions: [{ attribute: '', operator: 'eq', ...options[0] }] }])}>{t.edit.identAddMatch}</button>
        </>
      )}
    </div>
  )
}

// Review: per table, the matches that are added and the ones that go away.
function TableChanges({ before, after, t }) {
  const removed = before.lines.filter((line) => !after.lines.includes(line))
  const added = after.lines.filter((line) => !before.lines.includes(line))
  const changed = removed.length || added.length || before.title !== after.title
  const xmlOnly = !changed && before.xml !== after.xml // e.g. an advanced rule edited in the FetchXML view
  return (
    <li>
      <b>{after.title}</b>
      {!changed && <span className="muted"> {xmlOnly ? t.edit.identChangedXml : t.edit.identUnchanged}</span>}
      {before.title !== after.title && <div className="from">{before.title}</div>}
      {removed.map((line) => <div key={'-' + line} className="from">{line}</div>)}
      {added.map((line) => <div key={'+' + line} className="to">{line}</div>)}
    </li>
  )
}


// The browser's own XML parser as a second opinion on well-formedness (not available under node).
function parserProblem(xml) {
  if (typeof DOMParser === 'undefined') return null
  const error = new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror')
  return error && { code: 'notWellFormed', detail: error.textContent.trim().split('\n')[0].slice(0, 120) }
}
const problemText = (problem, t) => {
  const message = t.edit.identXmlProblems[problem.code]
  return typeof message === 'function' ? message(problem.detail) : message
}
const conditionsOf = (rule) => rule.matches.flatMap((match) => match.conditions)
// "contact#1", "contact#2"...: pairs the tables before and after a change by entity, not by position
const withKeys = (tables) => {
  const seen = {}
  return tables.map((table) => ({ ...table, key: `${table.entity}#${(seen[table.entity] = (seen[table.entity] ?? 0) + 1)}` }))
}
const editableCopy = (xml) => parseIdentification(xml).map((rule) => ({ preferred: rule.preferred, matches: structuredClone(rule.matches) }))

// The workstream's record identification rules, edited visually (column = value matches per table and
// the preferred table) or as FetchXML. Both views edit the same text: switching carries the changes over.
// The review lists, per table, what is added and what goes away, plus the changed XML lines.
export function IdentificationDialog({ workstream, raw, org, env, busy, error, onApply, onClose, t }) {
  const before = (recordOf(raw, workstream)?.msdyn_recordidentificationrule ?? '').replace(/\r\n/g, '\n')
  const [base, setBase] = useState(before) // the XML the visual view applies its edits to
  const [edited, setEdited] = useState(() => editableCopy(before))
  const [view, setView] = useState('visual')
  const [draft, setDraft] = useState('') // the XML being edited in the FetchXML view
  const [columns, setColumns] = useState({}) // table -> [{ name, label }] | 'error'
  const [step, setStep] = useState('form')
  const rules = parseIdentification(base)
  const tables = rules.filter((rule) => rule.supported).map((rule) => rule.entity).join() // editable tables, whose columns are listed

  useEffect(() => {
    let live = true
    for (const rule of rules.filter((candidate) => candidate.supported && !(candidate.entity in columns)))
      tableColumns(rule.entity).then(
        (list) => live && setColumns((current) => ({ ...current, [rule.entity]: list })),
        () => live && setColumns((current) => ({ ...current, [rule.entity]: 'error' })),
      )
    return () => { live = false }
  }, [tables])

  const workstreamOptions = valueOptions(raw, workstream.id.split(':')[1])
  // a conversation value already in this rule stays selectable even if nothing else uses it
  const optionsFor = (rule) => [...workstreamOptions, ...conditionsOf(rule)
    .filter((condition) => isConversationValue(condition) && !workstreamOptions.some((option) => optionKey(option) === optionKey(condition)))
    .map(({ value, source }) => ({ value, source }))]
  const visualNext = rewriteIdentification(base, edited)
  const next = view === 'xml' ? draft : visualNext
  // rows of the visual tab: a changed table keeps a conversation value, and every row is complete
  const rowsValid = rules.every((rule, i) => !rule.supported || JSON.stringify(edited[i].matches) === JSON.stringify(rule.matches)
    || (conditionsOf(edited[i]).some(isConversationValue)
      && conditionsOf(edited[i]).every((condition) => condition.attribute && (!takesValue(condition.operator) || (condition.value ?? '') !== ''))))
  // what would be saved must pass the XML checks too, whichever tab produced it (e.g. two preferred tables)
  const problem = view === 'xml' ? xmlProblem(draft) ?? parserProblem(draft) : xmlProblem(visualNext)
  const isValid = !problem && (view === 'xml' || rowsValid)
  // only formatting differs (e.g. after looking at the FetchXML view): nothing to save
  const isUnchanged = next === before || formatXml(next) === formatXml(before)
  const close = () => !busy && onClose()
  const setRule = (index, patch) => setEdited((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
  const prefer = (index) => setEdited((current) => current.map((rule, i) => (rule.preferred === null ? rule : { ...rule, preferred: i === index })))
  const showXml = () => { setDraft(formatXml(visualNext)); setView('xml') }
  const showVisual = () => {
    // nothing edited in the XML: keep the original text (and its formatting) under the visual edits
    if (formatXml(draft) !== formatXml(visualNext)) { setBase(draft); setEdited(editableCopy(draft)) }
    setView('visual')
  }

  if (!before.trim())
    return (
      <Modal tone="details" title={t.edit.identTitle(workstream.label)} onClose={close} footer={<button onClick={onClose}>{t.edit.cancel}</button>}>
        <p className="muted">{t.edit.identNone}</p>
      </Modal>
    )
  if (step === 'form')
    return (
      <Modal tone="details" title={t.edit.identTitle(workstream.label)} onClose={close}
        footer={<>
          <button onClick={onClose}>{t.edit.cancel}</button>
          <button className="primary" disabled={!isValid || isUnchanged} onClick={() => setStep('confirm')}>{t.edit.review}</button>
        </>}>
        <div className="seg ident-tabs" role="tablist">
          <button role="tab" aria-selected={view === 'visual'} className={view === 'visual' ? 'on' : ''} disabled={view === 'xml' && Boolean(problem)} onClick={() => view === 'xml' && showVisual()}>{t.edit.identVisual}</button>
          <button role="tab" aria-selected={view === 'xml'} className={view === 'xml' ? 'on' : ''} disabled={view === 'visual' && !rowsValid} onClick={() => view === 'visual' && showXml()}>{t.edit.identXml}</button>
        </div>
        {view === 'xml' ? (
          <>
            <p className="muted small">{t.edit.identXmlHint}</p>
            <textarea className="xml-editor" spellCheck={false} aria-label={t.edit.identXml} value={draft} onChange={(e) => setDraft(e.target.value)} />
            {problem && <p className="err">{problemText(problem, t)}</p>}
          </>
        ) : (
          <>
            <p className="muted small">{t.edit.identIntro}</p>
            {rules.map((rule, i) => (
              <RuleCard key={i} rule={rule} edited={edited[i]} columns={columns[rule.entity]} options={optionsFor(edited[i])} t={t}
                onChange={(matches) => setRule(i, { matches })} onPrefer={() => prefer(i)} />
            ))}
            {!rowsValid && <p className="err">{t.edit.identNeedMatch}</p>}
            {problem && <p className="err">{problemText(problem, t)}</p>}
          </>
        )}
      </Modal>
    )
  const tablesBefore = withKeys(describeIdentification(before, t))
  const tablesAfter = withKeys(describeIdentification(next, t))
  const xmlChanges = lineDiff(formatXml(before), formatXml(next))
  return (
    <Modal tone="details" title={t.edit.identTitle(workstream.label)} subtitle={t.types.workstream} onClose={close}
      footer={<>
        <button disabled={busy} onClick={() => setStep('form')}>{t.edit.back}</button>
        <button disabled={busy} onClick={onClose}>{t.edit.cancel}</button>
        <button className="primary" disabled={busy} onClick={() => onApply(before, next)}>{busy ? t.edit.working : t.edit.save}</button>
      </>}>
      <p className="preview">{t.edit.identConfirm}</p>
      <ul className="records changes ident-review">
        {[...tablesAfter, ...tablesBefore.filter((table) => !tablesAfter.some((other) => other.key === table.key))].map(({ key }) => {
          const old = tablesBefore.find((table) => table.key === key)
          const now = tablesAfter.find((table) => table.key === key)
          // an added table has no old lines, a removed one no new lines
          return <TableChanges key={key} before={old ?? { ...now, lines: [], xml: '' }} after={now ?? { ...old, lines: [], xml: '' }} t={t} />
        })}
      </ul>
      <details className="xml-diff">
        <summary>{t.edit.identXmlChanges(xmlChanges.length)}</summary>
        <pre>{xmlChanges.map((change, i) => <div key={i} className={change.type === '+' ? 'to' : 'from'}>{change.type} {change.text}</div>)}</pre>
      </details>
      <p className="muted small">{t.edit.identNoEditor}</p>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}
