import { useEffect, useState } from 'react'
import { searchUsers, readContract, contractVariables, newId } from './edit.js'
import { parseRules, simplify } from './rules.js'
import { templates, planWorkstream, formatted } from './workstream.js'

// Every dialog previews the change and names the org and the environment before applying it
// (PPTB marketplace policy for tools that modify data); Production gets an extra warning.

const TONE = { add: '#16a34a', remove: '#dc2626', queue: '#f59e0b', rule: '#d946ef', workstream: '#6366f1' }
const ICON = { add: '+', remove: '×', queue: '▤', rule: '◆', workstream: '⇄' }

function Modal({ tone, title, subtitle, footer, onClose, children }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} style={{ '--tone': TONE[tone] }} onClick={(e) => e.stopPropagation()}>
        <header className="dialog-head">
          <span className="icon" aria-hidden>{ICON[tone]}</span>
          <div>
            <h3>{title}</h3>
            {subtitle && <small>{subtitle}</small>}
          </div>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}

function Target({ org, env, error, t }) {
  return (
    <>
      <p className="target"><span className={'env ' + (env ?? '').toLowerCase()}>{env ?? '?'}</span> {org}</p>
      {env === 'Production' && <p className="prod">{t.edit.production}</p>}
      {error && <p className="err">{t.edit.failed}: {error}</p>}
    </>
  )
}

// ---------------------------------------------------------------- agents in a queue

// Two steps for adds (pick user -> preview), one for removes (preview).
export function EditDialog({ dialog, setDialog, apply, busy, error, org, env, t }) {
  const [text, setText] = useState('')
  const [found, setFound] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const { queue, user, action } = dialog
  const members = new Set((queue.members ?? []).map((m) => m.id))

  useEffect(() => {
    if (dialog.kind !== 'add') return
    let live = true
    const id = setTimeout(() => {
      if (!text.trim()) return setFound(null)
      setFound(undefined)
      searchUsers(text).then((r) => live && (setFound(r), setSearchError(null)), (e) => live && (setFound([]), setSearchError(e.message)))
    }, 300)
    return () => { live = false; clearTimeout(id) }
  }, [text, dialog.kind])

  const close = () => !busy && setDialog(null)
  if (dialog.kind === 'add')
    return (
      <Modal tone="add" title={t.edit.addTitle(queue.label)} onClose={close} footer={<button onClick={close}>{t.edit.cancel}</button>}>
        <input autoFocus placeholder={t.edit.searchUsers} value={text} onChange={(e) => setText(e.target.value)} />
        <ul className="results">
          {found === undefined && <li className="muted">{t.edit.searching}</li>}
          {found?.length === 0 && <li className="muted">{searchError ?? t.edit.noResults}</li>}
          {found?.map((u) => (
            <li key={u.id} className={members.has(u.id) ? 'disabled' : ''} onClick={() => !members.has(u.id) && setDialog({ kind: 'confirm', action: 'add', queue, user: u })}>
              <span className="avatar" aria-hidden>{u.label.slice(0, 1)}</span>
              <span><b>{u.label}</b><small>{u.sub}{members.has(u.id) ? ` (${t.edit.alreadyMember})` : ''}</small></span>
            </li>
          ))}
        </ul>
      </Modal>
    )
  const adding = action === 'add'
  return (
    <Modal tone={adding ? 'add' : 'remove'} title={adding ? t.edit.addTitle(queue.label) : t.edit.removeTitle} onClose={close}
      footer={<>
        {adding && <button disabled={busy} onClick={() => setDialog({ kind: 'add', queue })}>{t.edit.back}</button>}
        <button disabled={busy} onClick={close}>{t.edit.cancel}</button>
        <button className={adding ? 'primary' : 'danger'} disabled={busy} onClick={apply}>{busy ? t.edit.working : adding ? t.edit.add : t.edit.removeBtn}</button>
      </>}>
      <p className="preview">{adding ? t.edit.confirmAdd(user.label, queue.label) : t.edit.confirmRemove(user.label, queue.label)}</p>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}

export function Toast({ toast, onUndo, onClose, busy, t }) {
  useEffect(() => {
    const id = setTimeout(onClose, 12000)
    return () => clearTimeout(id)
  }, [toast])
  return (
    <div className="toast" role="status">
      <span className="ok" aria-hidden>✓</span>
      <span>{toast.text}</span>
      {toast.undo && <button disabled={busy} onClick={onUndo}>↶ {t.edit.undo}</button>}
      <button className="x" aria-label="×" onClick={onClose}>×</button>
    </div>
  )
}

// ---------------------------------------------------------------- new queue

// distinct option values already used in the org, with Dataverse's own (localized) label
const FV = '@OData.Community.Display.V1.FormattedValue'
const usedOptions = (rows, field) => [...new Map(rows.filter((r) => r[field] != null).map((r) => [r[field], r[field + FV] ?? String(r[field])])).entries()]

// Type and assignment method only offer values that existing omnichannel queues already use.
export function QueueDialog({ raw, org, env, busy, error, onApply, onBack, onClose, t }) {
  const queues = Array.isArray(raw.queues) ? raw.queues : []
  const hours = Array.isArray(raw.operatingHours) ? raw.operatingHours : []
  const types = usedOptions(queues, 'msdyn_queuetype')
  const [form, setForm] = useState({ name: '', type: types[0]?.[0], strategy: undefined, priority: 100, hoursId: '' })
  const [step, setStep] = useState('form')
  const strategies = usedOptions(queues.filter((q) => q.msdyn_queuetype === form.type), 'msdyn_assignmentstrategy')
  const strategy = form.strategy ?? strategies[0]?.[0]
  const label = (opts, v) => opts.find(([o]) => o === v)?.[1]
  const valid = form.name.trim() && form.type != null && strategy != null
  const close = () => !busy && onClose()

  if (step === 'form')
    return (
      <Modal tone="queue" title={t.edit.queueTitle} onClose={close}
        footer={<>
          <button onClick={onClose}>{t.edit.cancel}</button>
          <button className="primary" disabled={!valid} onClick={() => setStep('confirm')}>{t.edit.next}</button>
        </>}>
        <label className="field">{t.edit.name}<input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
        <div className="grid2">
          <label className="field">{t.edit.queueType}
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: Number(e.target.value), strategy: undefined }))}>
              {types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">{t.edit.strategy}
            <select value={strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: Number(e.target.value) }))}>
              {strategies.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">{t.edit.priority}<input type="number" min="0" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} /></label>
          <label className="field">{t.edit.hours}
            <select value={form.hoursId} onChange={(e) => setForm((f) => ({ ...f, hoursId: e.target.value }))}>
              <option value="">{t.edit.none}</option>
              {hours.map((h) => <option key={h.msdyn_operatinghourid} value={h.msdyn_operatinghourid}>{h.msdyn_name}</option>)}
            </select>
          </label>
        </div>
      </Modal>
    )
  return (
    <Modal tone="queue" title={t.edit.queueTitle} subtitle={form.name.trim()} onClose={close}
      footer={<>
        <button disabled={busy} onClick={() => { onBack(); setStep('form') }}>{t.edit.back}</button>
        <button disabled={busy} onClick={onClose}>{t.edit.cancel}</button>
        <button className="primary" disabled={busy}
          onClick={() => onApply({ name: form.name.trim(), type: form.type, strategy, priority: Number(form.priority) || 0, hoursId: form.hoursId || null })}>
          {busy ? t.edit.working : t.edit.add}
        </button>
      </>}>
      <p className="preview">{t.edit.confirmQueue(form.name.trim())}</p>
      <div className="card-preview queue">
        <span className="chip">{t.types.queue}</span>
        <b>{form.name.trim()}</b>
        <small>{t.edit.queueType}: {label(types, form.type)}</small>
        <small>{t.edit.strategy}: {label(strategies, strategy)}</small>
        <small>{t.edit.priority}: {form.priority}</small>
        <small>{t.edit.hours}: {hours.find((h) => h.msdyn_operatinghourid === form.hoursId)?.msdyn_name ?? t.edit.none}</small>
      </div>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}

// ---------------------------------------------------------------- new rule

const CONTEXT = 'liveworkitemcontext.'
const shortName = (attr) => (attr.startsWith(CONTEXT) ? attr.slice(CONTEXT.length) : attr)
// first occurrence wins, so contract variables (typed) take precedence over attributes seen in rules (untyped)
const uniq = (vars) => [...new Map(vars.reverse().map((v) => [v.attr, v])).values()].sort((a, b) => shortName(a.attr).localeCompare(shortName(b.attr)))
// attributes a ruleset already reads (conditions) or writes (set actions)
const usedAttrs = (xml, tag) =>
  [...(xml ?? '').matchAll(new RegExp(`<${tag}[^>]*>\\s*<lhs type="attribute">([^<]+)</lhs>`, 'g'))]
    .map((m) => ({ attr: m[1], type: 'string' }))
    .filter((v) => v.attr !== 'assign_to.queue')

// context variables first, any other attribute (entity fields) in a second group
function AttrSelect({ vars, value, onChange, t }) {
  const context = vars.filter((v) => v.attr.startsWith(CONTEXT))
  const other = vars.filter((v) => !v.attr.startsWith(CONTEXT))
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} title={value}>
      <option value="" />
      {context.length > 0 && <optgroup label={t.edit.contextVars}>{context.map((v) => <option key={v.attr} value={v.attr}>{shortName(v.attr)}</option>)}</optgroup>}
      {other.length > 0 && <optgroup label={t.edit.otherAttrs}>{other.map((v) => <option key={v.attr} value={v.attr}>{v.attr}</option>)}</optgroup>}
    </select>
  )
}

function ValueInput({ type, value, onChange, t }) {
  if (type === 'boolean')
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" /><option value="true">true</option><option value="false">false</option>
      </select>
    )
  return <input type={type === 'number' ? 'number' : 'text'} placeholder={t.edit.value} value={value} onChange={(e) => onChange(e.target.value)} />
}

// Conditions only offer variables of the ruleset's input contract (or attributes its rules already use) and
// operators already used somewhere in the org: nothing the routing engine hasn't seen before.
export function RuleDialog({ ruleset, raw, queues, org, env, busy, error, onApply, onBack, onClose, t }) {
  const route = ruleset.kind === 'route'
  const [vars, setVars] = useState(null) // { inputs, outputs } | { error }
  const [form, setForm] = useState({ name: '', conditions: [], queue: queues[0]?.id ?? '', sets: [{ attr: '', value: '' }] })
  const [step, setStep] = useState('form')
  const existing = parseRules(ruleset.xml)
  const ops = [...new Set(['==', ...(Array.isArray(raw.rulesets) ? raw.rulesets : []).flatMap((r) => [...(r.msdyn_rulesetdefinition ?? '').matchAll(/<condition operator="([^"]+)"/g)].map((m) => m[1]))])]

  useEffect(() => {
    let live = true
    Promise.all([readContract(ruleset.inputContract), route ? '' : readContract(ruleset.outputContract)]).then(
      ([i, o]) => live && setVars({
        inputs: uniq([...contractVariables(i), ...usedAttrs(ruleset.xml, 'condition')]),
        outputs: uniq([...contractVariables(o), ...(route ? [] : usedAttrs(ruleset.xml, 'setattribute'))]),
      }),
      (e) => live && setVars({ error: String(e?.message ?? e) }),
    )
    return () => { live = false }
  }, [ruleset.id])

  const upd = (list, i, patch) => setForm((f) => ({ ...f, [list]: f[list].map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const drop = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, j) => j !== i) }))
  const valid = form.name.trim() && form.conditions.every((c) => c.attr && (c.op === 'not-null' || c.value !== '')) &&
    (route ? form.queue : form.sets.length && form.sets.every((s) => s.attr && s.value !== ''))
  const typeOf = (list, attr) => vars?.[list]?.find((v) => v.attr === attr)?.type
  const when = form.conditions.map((c) => `${c.attr} ${c.op}${c.op === 'not-null' ? '' : ` "${c.value}"`}`).join(' AND ')
  const then = route ? `→ ${queues.find((q) => q.id === form.queue)?.label}` : `→ ${form.sets.map((s) => `${shortName(s.attr)} = "${s.value}"`).join(', ')}`
  const close = () => !busy && onClose()

  if (!vars || vars.error || step === 'form')
    return (
      <Modal tone="rule" title={t.edit.ruleTitle(ruleset.label)} onClose={close}
        footer={<>
          <button onClick={onClose}>{t.edit.cancel}</button>
          <button className="primary" disabled={!vars || vars.error || !valid} onClick={() => setStep('confirm')}>{t.edit.next}</button>
        </>}>
        {!vars ? <p className="muted">{t.edit.loadingContract}</p> : vars.error ? <p className="err">{t.edit.failed}: {vars.error}</p> : (
          <>
            <label className="field">{t.edit.ruleName}<input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
            <div className="section-title">{t.edit.conditions}</div>
            <div className="cond-list">
              {form.conditions.length === 0 && <p className="muted small">{t.edit.noConditions}</p>}
              {form.conditions.map((c, i) => (
                <div key={i}>
                  {i > 0 && <span className="and">{t.edit.and}</span>}
                  <div className="cond-row">
                    <AttrSelect vars={vars.inputs} value={c.attr} onChange={(attr) => upd('conditions', i, { attr })} t={t} />
                    <select className="op" value={c.op} onChange={(e) => upd('conditions', i, { op: e.target.value })}>{ops.map((o) => <option key={o}>{o}</option>)}</select>
                    {c.op !== 'not-null' && <ValueInput type={typeOf('inputs', c.attr)} value={c.value} onChange={(value) => upd('conditions', i, { value })} t={t} />}
                    <button className="rm" aria-label="×" onClick={() => drop('conditions', i)}>×</button>
                  </div>
                </div>
              ))}
              <button className="link" onClick={() => setForm((f) => ({ ...f, conditions: [...f.conditions, { attr: '', op: '==', value: '' }] }))}>{t.edit.addCondition}</button>
            </div>
            <div className="section-title">{t.edit.then}</div>
            <div className="then-box">
              {route ? (
                <label className="field">{t.edit.routeTo}
                  <select value={form.queue} onChange={(e) => setForm((f) => ({ ...f, queue: e.target.value }))}>
                    {queues.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  {form.sets.map((s, i) => (
                    <div key={i} className="cond-row">
                      <span className="verb">{t.edit.setVar}</span>
                      <AttrSelect vars={vars.outputs} value={s.attr} onChange={(attr) => upd('sets', i, { attr })} t={t} />
                      <span className="verb">=</span>
                      <ValueInput type={typeOf('outputs', s.attr)} value={s.value} onChange={(value) => upd('sets', i, { value })} t={t} />
                      {form.sets.length > 1 && <button className="rm" aria-label="×" onClick={() => drop('sets', i)}>×</button>}
                    </div>
                  ))}
                  <button className="link" onClick={() => setForm((f) => ({ ...f, sets: [...f.sets, { attr: '', value: '' }] }))}>{t.edit.addSet}</button>
                </>
              )}
            </div>
            <p className="muted small">{t.edit.appendNote}</p>
            {!valid && <p className="muted small">{t.edit.required}</p>}
          </>
        )}
      </Modal>
    )
  return (
    <Modal tone="rule" title={t.edit.ruleTitle(ruleset.label)} onClose={close}
      footer={<>
        <button disabled={busy} onClick={() => { onBack(); setStep('form') }}>{t.edit.back}</button>
        <button disabled={busy} onClick={onClose}>{t.edit.cancel}</button>
        <button className="primary" disabled={busy}
          onClick={() => onApply({ id: newId(), name: form.name.trim(), conditions: form.conditions, sets: route ? [{ attr: 'assign_to.queue', value: form.queue }] : form.sets })}>
          {busy ? t.edit.working : t.edit.add}
        </button>
      </>}>
      <p className="preview">{t.edit.confirmRule(ruleset.label)}</p>
      <div className="card-preview rule">
        <span className="chip">{t.types.rule} #{existing.length + 1}</span>
        <b>{form.name.trim()}</b>
        <small>{when ? t.text.when(simplify(when, t)) : t.text.alwaysCap}</small>
        <span className="then">{then}</span>
      </div>
      <p className="muted small">{t.edit.appendNote}</p>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}

// ---------------------------------------------------------------- delete a rule

export function RemoveRuleDialog({ rule, ruleset, org, env, busy, error, onApply, onClose, t }) {
  return (
    <Modal tone="remove" title={t.edit.removeRuleTitle} subtitle={ruleset.label} onClose={() => !busy && onClose()}
      footer={<>
        <button disabled={busy} onClick={onClose}>{t.edit.cancel}</button>
        <button className="danger" disabled={busy} onClick={onApply}>{busy ? t.edit.working : t.edit.removeRule}</button>
      </>}>
      <p className="preview">{t.edit.confirmRemoveRule(ruleset.label)}</p>
      <div className="card-preview rule removing">
        <span className="chip">{t.types.rule}</span>
        <b>{rule.label}</b>
        <small>{rule.sub === t.text.always ? t.text.alwaysCap : t.text.when(rule.sub)}</small>
        <span className="then">{rule.data?.[t.fields.actions]}</span>
      </div>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}

// ---------------------------------------------------------------- new workstream

// Clones a template workstream (same channel). The preview lists the records from the same plan
// that `createWorkstream` executes, so what is shown is exactly what gets created.
export function WorkstreamDialog({ raw, org, env, busy, error, onApply, onBack, onClose, t }) {
  const options = templates(raw)
  const [form, setForm] = useState({ name: '', templateId: options[0]?.msdyn_liveworkstreamid ?? '', copyRules: true })
  const [step, setStep] = useState('form')
  const plan = form.templateId ? planWorkstream(raw, form.templateId, { copyRules: form.copyRules }) : null
  const channel = (w) => formatted(w, 'msdyn_streamsource')
  const valid = form.name.trim() && plan
  const close = () => !busy && onClose()

  if (!options.length)
    return (
      <Modal tone="workstream" title={t.edit.wsTitle} onClose={close} footer={<button onClick={onClose}>{t.edit.cancel}</button>}>
        <p className="muted">{t.edit.noTemplates}</p>
      </Modal>
    )
  if (step === 'form')
    return (
      <Modal tone="workstream" title={t.edit.wsTitle} onClose={close}
        footer={<>
          <button onClick={onClose}>{t.edit.cancel}</button>
          <button className="primary" disabled={!valid} onClick={() => setStep('confirm')}>{t.edit.next}</button>
        </>}>
        <label className="field">{t.edit.name}<input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
        <label className="field">{t.edit.template}
          <select value={form.templateId} onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}>
            {options.map((w) => <option key={w.msdyn_liveworkstreamid} value={w.msdyn_liveworkstreamid}>{w.msdyn_name} ({channel(w)})</option>)}
          </select>
        </label>
        {plan?.route && (
          <label className="check">
            <input type="checkbox" checked={form.copyRules} onChange={(e) => setForm((f) => ({ ...f, copyRules: e.target.checked }))} /> {t.edit.copyRules}
          </label>
        )}
        <p className="muted small">{t.edit.wsNotes}</p>
      </Modal>
    )
  const names = plan.variables.map((v) => v.msdyn_name).join(', ')
  return (
    <Modal tone="workstream" title={t.edit.wsTitle} subtitle={form.name.trim()} onClose={close}
      footer={<>
        <button disabled={busy} onClick={() => { onBack(); setStep('form') }}>{t.edit.back}</button>
        <button disabled={busy} onClick={onClose}>{t.edit.cancel}</button>
        <button className="primary" disabled={busy} onClick={() => onApply(form.name.trim(), plan)}>{busy ? t.edit.working : t.edit.add}</button>
      </>}>
      <p className="preview">{t.edit.confirmWs(form.name.trim())}</p>
      <ol className="records">
        <li>{t.edit.recWorkstream(channel(plan.template))}</li>
        <li>{t.edit.recContract(plan.variables.length)}</li>
        {plan.variables.length > 0 && <li>{t.edit.recVariables(names)}</li>}
        {plan.capacity.length > 0 && <li>{t.edit.recCapacity(plan.capacity.length)}</li>}
        {plan.route && <li>{t.edit.recRouting(plan.route.rules)}</li>}
      </ol>
      {plan.skippedSteps > 0 && <p className="muted small">{t.edit.recSkipped}</p>}
      {plan.unknownSteps > 0 && <p className="err">{t.edit.routeUnknown}</p>}
      <p className="muted small">{t.edit.wsNotes}</p>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}
