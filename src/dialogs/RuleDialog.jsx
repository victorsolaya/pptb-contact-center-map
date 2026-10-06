import { useEffect, useState } from 'react'
import { readContract, contractVariables, newId } from '../edit.js'
import { parseRules, simplify } from '../rules.js'
import { rows } from '../queries.js'
import { Modal, Target } from './common.jsx'

const CONTEXT = 'liveworkitemcontext.'
const shortName = (attr) => (attr.startsWith(CONTEXT) ? attr.slice(CONTEXT.length) : attr)
// first occurrence wins, so contract variables (typed) take precedence over attributes seen in rules (untyped)
const uniqueVariables = (vars) => [...new Map(vars.reverse().map((variable) => [variable.attr, variable])).values()].sort((a, b) => shortName(a.attr).localeCompare(shortName(b.attr)))
// attributes a ruleset already reads (conditions) or writes (set actions)
const usedAttrs = (xml, tag) =>
  [...(xml ?? '').matchAll(new RegExp(`<${tag}[^>]*>\\s*<lhs type="attribute">([^<]+)</lhs>`, 'g'))]
    .map((match) => ({ attr: match[1], type: 'string' }))
    .filter((variable) => variable.attr !== 'assign_to.queue')
// condition operators some ruleset of the org already uses ('==' always)
const usedOperators = (raw) =>
  [...new Set(['==', ...rows(raw, 'rulesets').flatMap((ruleset) => [...(ruleset.msdyn_rulesetdefinition ?? '').matchAll(/<condition operator="([^"]+)"/g)].map((match) => match[1]))])]

// context variables first, any other attribute (entity fields) in a second group
function AttrSelect({ vars, value, onChange, t }) {
  const context = vars.filter((variable) => variable.attr.startsWith(CONTEXT))
  const other = vars.filter((variable) => !variable.attr.startsWith(CONTEXT))
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} title={value}>
      <option value="" />
      {context.length > 0 && <optgroup label={t.edit.contextVars}>{context.map((variable) => <option key={variable.attr} value={variable.attr}>{shortName(variable.attr)}</option>)}</optgroup>}
      {other.length > 0 && <optgroup label={t.edit.otherAttrs}>{other.map((variable) => <option key={variable.attr} value={variable.attr}>{variable.attr}</option>)}</optgroup>}
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
  const isRoute = ruleset.kind === 'route'
  const [vars, setVars] = useState(null) // { inputs, outputs } | { error }
  const [form, setForm] = useState({ name: '', conditions: [], queue: queues[0]?.id ?? '', sets: [{ attr: '', value: '' }] })
  const [step, setStep] = useState('form')
  const existing = parseRules(ruleset.xml)
  const operators = usedOperators(raw)

  useEffect(() => {
    let live = true
    Promise.all([readContract(ruleset.inputContract), isRoute ? '' : readContract(ruleset.outputContract)]).then(
      ([inputXml, outputXml]) => live && setVars({
        inputs: uniqueVariables([...contractVariables(inputXml), ...usedAttrs(ruleset.xml, 'condition')]),
        outputs: uniqueVariables([...contractVariables(outputXml), ...(isRoute ? [] : usedAttrs(ruleset.xml, 'setattribute'))]),
      }),
      (e) => live && setVars({ error: String(e?.message ?? e) }),
    )
    return () => { live = false }
  }, [ruleset.id])

  const updateItem = (list, i, patch) => setForm((f) => ({ ...f, [list]: f[list].map((item, j) => (j === i ? { ...item, ...patch } : item)) }))
  const removeItem = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, j) => j !== i) }))
  const isValid = form.name.trim() && form.conditions.every((condition) => condition.attr && (condition.op === 'not-null' || condition.value !== '')) &&
    (isRoute ? form.queue : form.sets.length && form.sets.every((setAction) => setAction.attr && setAction.value !== ''))
  const typeOf = (list, attr) => vars?.[list]?.find((variable) => variable.attr === attr)?.type
  const when = form.conditions.map((condition) => `${condition.attr} ${condition.op}${condition.op === 'not-null' ? '' : ` "${condition.value}"`}`).join(' AND ')
  const then = isRoute ? `→ ${queues.find((queue) => queue.id === form.queue)?.label}` : `→ ${form.sets.map((setAction) => `${shortName(setAction.attr)} = "${setAction.value}"`).join(', ')}`
  const close = () => !busy && onClose()

  if (!vars || vars.error || step === 'form')
    return (
      <Modal tone="rule" title={t.edit.ruleTitle(ruleset.label)} onClose={close}
        footer={<>
          <button onClick={onClose}>{t.edit.cancel}</button>
          <button className="primary" disabled={!vars || vars.error || !isValid} onClick={() => setStep('confirm')}>{t.edit.next}</button>
        </>}>
        {!vars ? <p className="muted">{t.edit.loadingContract}</p> : vars.error ? <p className="err">{t.edit.failed}: {vars.error}</p> : (
          <>
            <label className="field">{t.edit.ruleName}<input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
            <div className="section-title">{t.edit.conditions}</div>
            <div className="cond-list">
              {form.conditions.length === 0 && <p className="muted small">{t.edit.noConditions}</p>}
              {form.conditions.map((condition, i) => (
                <div key={i}>
                  {i > 0 && <span className="and">{t.edit.and}</span>}
                  <div className="cond-row">
                    <AttrSelect vars={vars.inputs} value={condition.attr} onChange={(attr) => updateItem('conditions', i, { attr })} t={t} />
                    <select className="op" value={condition.op} onChange={(e) => updateItem('conditions', i, { op: e.target.value })}>{operators.map((operator) => <option key={operator}>{operator}</option>)}</select>
                    {condition.op !== 'not-null' && <ValueInput type={typeOf('inputs', condition.attr)} value={condition.value} onChange={(value) => updateItem('conditions', i, { value })} t={t} />}
                    <button className="rm" aria-label="×" onClick={() => removeItem('conditions', i)}>×</button>
                  </div>
                </div>
              ))}
              <button className="link" onClick={() => setForm((f) => ({ ...f, conditions: [...f.conditions, { attr: '', op: '==', value: '' }] }))}>{t.edit.addCondition}</button>
            </div>
            <div className="section-title">{t.edit.then}</div>
            <div className="then-box">
              {isRoute ? (
                <label className="field">{t.edit.routeTo}
                  <select value={form.queue} onChange={(e) => setForm((f) => ({ ...f, queue: e.target.value }))}>
                    {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.label}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  {form.sets.map((setAction, i) => (
                    <div key={i} className="cond-row">
                      <span className="verb">{t.edit.setVar}</span>
                      <AttrSelect vars={vars.outputs} value={setAction.attr} onChange={(attr) => updateItem('sets', i, { attr })} t={t} />
                      <span className="verb">=</span>
                      <ValueInput type={typeOf('outputs', setAction.attr)} value={setAction.value} onChange={(value) => updateItem('sets', i, { value })} t={t} />
                      {form.sets.length > 1 && <button className="rm" aria-label="×" onClick={() => removeItem('sets', i)}>×</button>}
                    </div>
                  ))}
                  <button className="link" onClick={() => setForm((f) => ({ ...f, sets: [...f.sets, { attr: '', value: '' }] }))}>{t.edit.addSet}</button>
                </>
              )}
            </div>
            <p className="muted small">{t.edit.appendNote}</p>
            {!isValid && <p className="muted small">{t.edit.required}</p>}
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
          onClick={() => onApply({ id: newId(), name: form.name.trim(), conditions: form.conditions, sets: isRoute ? [{ attr: 'assign_to.queue', value: form.queue }] : form.sets })}>
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
