import { useState } from 'react'
import { templates, planWorkstream } from '../workstream.js'
import { formatted } from '../queries.js'
import { Modal, Target } from './common.jsx'

// Clones a template workstream (same channel). The preview lists the records from the same plan
// that `createWorkstream` executes, so what is shown is exactly what gets created.
export function WorkstreamDialog({ raw, org, env, busy, error, onApply, onBack, onClose, t }) {
  const options = templates(raw)
  const [form, setForm] = useState({ name: '', templateId: options[0]?.msdyn_liveworkstreamid ?? '', copyRules: true })
  const [step, setStep] = useState('form')
  const plan = form.templateId ? planWorkstream(raw, form.templateId, { copyRules: form.copyRules }) : null
  const channelOf = (workstream) => formatted(workstream, 'msdyn_streamsource')
  const isValid = form.name.trim() && plan
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
          <button className="primary" disabled={!isValid} onClick={() => setStep('confirm')}>{t.edit.next}</button>
        </>}>
        <label className="field">{t.edit.name}<input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
        <label className="field">{t.edit.template}
          <select value={form.templateId} onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}>
            {options.map((workstream) => <option key={workstream.msdyn_liveworkstreamid} value={workstream.msdyn_liveworkstreamid}>{workstream.msdyn_name} ({channelOf(workstream)})</option>)}
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
  const variableNames = plan.variables.map((variable) => variable.msdyn_name).join(', ')
  return (
    <Modal tone="workstream" title={t.edit.wsTitle} subtitle={form.name.trim()} onClose={close}
      footer={<>
        <button disabled={busy} onClick={() => { onBack(); setStep('form') }}>{t.edit.back}</button>
        <button disabled={busy} onClick={onClose}>{t.edit.cancel}</button>
        <button className="primary" disabled={busy} onClick={() => onApply(form.name.trim(), plan)}>{busy ? t.edit.working : t.edit.add}</button>
      </>}>
      <p className="preview">{t.edit.confirmWs(form.name.trim())}</p>
      <ol className="records">
        <li>{t.edit.recWorkstream(channelOf(plan.template))}</li>
        <li>{t.edit.recContract(plan.variables.length)}</li>
        {plan.variables.length > 0 && <li>{t.edit.recVariables(variableNames)}</li>}
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
