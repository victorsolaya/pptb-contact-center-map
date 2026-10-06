import { useState } from 'react'
import { rows, formatted } from '../queries.js'
import { Modal, Target } from './common.jsx'

// distinct option values already used in the org, with Dataverse's own (localized) label
const usedOptions = (records, field) => [...new Map(records.filter((record) => record[field] != null).map((record) => [record[field], String(formatted(record, field))])).entries()]

// Type and assignment method only offer values that existing omnichannel queues already use.
export function QueueDialog({ raw, org, env, busy, error, onApply, onBack, onClose, t }) {
  const queues = rows(raw, 'queues')
  const hours = rows(raw, 'operatingHours')
  const types = usedOptions(queues, 'msdyn_queuetype')
  const [form, setForm] = useState({ name: '', type: types[0]?.[0], strategy: undefined, priority: 100, hoursId: '' })
  const [step, setStep] = useState('form')
  const strategies = usedOptions(queues.filter((queue) => queue.msdyn_queuetype === form.type), 'msdyn_assignmentstrategy')
  const strategy = form.strategy ?? strategies[0]?.[0]
  const labelOf = (options, value) => options.find(([optionValue]) => optionValue === value)?.[1]
  const isValid = form.name.trim() && form.type != null && strategy != null
  const close = () => !busy && onClose()

  if (step === 'form')
    return (
      <Modal tone="queue" title={t.edit.queueTitle} onClose={close}
        footer={<>
          <button onClick={onClose}>{t.edit.cancel}</button>
          <button className="primary" disabled={!isValid} onClick={() => setStep('confirm')}>{t.edit.next}</button>
        </>}>
        <label className="field">{t.edit.name}<input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
        <div className="grid2">
          <label className="field">{t.edit.queueType}
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: Number(e.target.value), strategy: undefined }))}>
              {types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">{t.edit.strategy}
            <select value={strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: Number(e.target.value) }))}>
              {strategies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">{t.edit.priority}<input type="number" min="0" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} /></label>
          <label className="field">{t.edit.hours}
            <select value={form.hoursId} onChange={(e) => setForm((f) => ({ ...f, hoursId: e.target.value }))}>
              <option value="">{t.edit.none}</option>
              {hours.map((schedule) => <option key={schedule.msdyn_operatinghourid} value={schedule.msdyn_operatinghourid}>{schedule.msdyn_name}</option>)}
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
        <small>{t.edit.queueType}: {labelOf(types, form.type)}</small>
        <small>{t.edit.strategy}: {labelOf(strategies, strategy)}</small>
        <small>{t.edit.priority}: {form.priority}</small>
        <small>{t.edit.hours}: {hours.find((schedule) => schedule.msdyn_operatinghourid === form.hoursId)?.msdyn_name ?? t.edit.none}</small>
      </div>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}
