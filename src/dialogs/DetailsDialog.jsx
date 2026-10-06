import { useState } from 'react'
import { initialForm, planDetails, profileUse, UNIT_BASED, PROFILE_BASED } from '../details.js'
import { normGuid } from '../rules.js'
import { rows } from '../queries.js'
import { Modal, Target } from './common.jsx'

const LABELS = (t) => ({
  msdyn_name: t.edit.name, name: t.edit.name, msdyn_capacityformat: t.edit.capacity, msdyn_capacityrequired: t.edit.unitsRequired,
  _msdyn_defaultqueue_value: t.fields.defaultQueue, msdyn_priority: t.edit.priority, _msdyn_operatinghourid_value: t.edit.hours,
  msdyn_defaultmaxunits: t.fields.maxUnits, msdyn_blockassignment: t.fields.blockAssignment,
})
const profileName = (raw, id) => rows(raw, 'capacityProfiles').find((profile) => normGuid(profile.msdyn_capacityprofileid) === normGuid(id))?.msdyn_name ?? id
function displayValue(col, value, raw, queues, t) {
  if (value == null || value === '') return t.edit.none
  if (col === 'msdyn_capacityformat') return value === PROFILE_BASED ? t.edit.byProfile : t.edit.byUnits
  if (col === '_msdyn_defaultqueue_value') return queues.find((queue) => queue.id === value)?.label ?? value
  if (col === '_msdyn_operatinghourid_value') return rows(raw, 'operatingHours').find((schedule) => normGuid(schedule.msdyn_operatinghourid) === value)?.msdyn_name ?? value
  if (typeof value === 'boolean') return value ? t.edit.yes : t.edit.no
  return String(value)
}
const isWhole = (value, min) => Number.isInteger(value) && value >= min
const toNumber = (text) => (text === '' ? null : Number(text))
// how many workstreams editing a capacity profile affects
const ProfileScope = ({ raw, node, t }) => <p className="muted small">{t.edit.profileScope(profileUse(raw, node.id.split(':')[1]))}</p>

// Shown in the detail panel instead of the read-only list. Options come from what the org has
// (queues, operating hours, capacity profiles); "Review changes" opens the confirmation.
export function DetailsForm({ node, raw, queues, t, onReview, onCancel }) {
  const [initial] = useState(() => initialForm(raw, node))
  const [form, setForm] = useState(initial)
  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch }))
  const nameCol = node.type === 'queue' ? 'name' : 'msdyn_name'
  const clean = { ...form, [nameCol]: (form[nameCol] ?? '').trim() }
  const plan = planDetails(raw, node, clean)
  const isByProfile = form.msdyn_capacityformat === PROFILE_BASED
  const newProfile = form.newProfile
  const updateNewProfile = (patch) => updateForm({ newProfile: { ...newProfile, ...patch } })
  const isMissingProfile = node.type === 'workstream' && isByProfile && !form.profiles.length && !newProfile
  const isValid = clean[nameCol] && !isMissingProfile && (
    node.type === 'workstream' ? (isByProfile ? !newProfile || (newProfile.name.trim() && isWhole(newProfile.units, 1)) : isWhole(form.msdyn_capacityrequired, 0))
    : node.type === 'queue' ? isWhole(form.msdyn_priority, 0)
    : isWhole(form.msdyn_defaultmaxunits, 1))
  const numberInput = (col, min) => <input type="number" min={min} value={form[col] ?? ''} onChange={(e) => updateForm({ [col]: toNumber(e.target.value) })} />

  return (
    <div className="details-form">
      <label className="field">{t.edit.name}<input autoFocus value={form[nameCol] ?? ''} onChange={(e) => updateForm({ [nameCol]: e.target.value })} /></label>
      {node.type === 'workstream' && (
        <>
          <label className="field">{t.fields.defaultQueue}
            <select value={form._msdyn_defaultqueue_value ?? ''} onChange={(e) => updateForm({ _msdyn_defaultqueue_value: e.target.value || null })}>
              {!initial._msdyn_defaultqueue_value && <option value="">{t.edit.none}</option>}
              {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.label}</option>)}
            </select>
          </label>
          <div className="field">{t.edit.capacity}
            <div className="seg" role="radiogroup" aria-label={t.edit.capacity}>
              {[[UNIT_BASED, t.edit.byUnits], [PROFILE_BASED, t.edit.byProfile]].map(([format, label]) => (
                <button key={format} role="radio" aria-checked={form.msdyn_capacityformat === format} className={form.msdyn_capacityformat === format ? 'on' : ''} onClick={() => updateForm({ msdyn_capacityformat: format })}>{label}</button>
              ))}
            </div>
          </div>
          {isByProfile ? (
            <div className="profiles">
              {rows(raw, 'capacityProfiles').map((profile) => {
                const id = normGuid(profile.msdyn_capacityprofileid)
                const isLinked = form.profiles.includes(id)
                return (
                  <label key={id} className="check">
                    <input type="checkbox" checked={isLinked} onChange={() => updateForm({ profiles: isLinked ? form.profiles.filter((linkedId) => linkedId !== id) : [...form.profiles, id] })} />
                    <span>{profile.msdyn_name} <small className="muted">{t.text.max(profile.msdyn_defaultmaxunits)}</small></span>
                  </label>
                )
              })}
              {newProfile ? (
                <div className="new-profile">
                  <label className="field">{t.edit.newProfileName}<input autoFocus value={newProfile.name} onChange={(e) => updateNewProfile({ name: e.target.value })} /></label>
                  <label className="field">{t.fields.maxUnits}<input type="number" min="1" value={newProfile.units ?? ''} onChange={(e) => updateNewProfile({ units: toNumber(e.target.value) })} /></label>
                  <label className="check"><input type="checkbox" checked={newProfile.block} onChange={(e) => updateNewProfile({ block: e.target.checked })} /> {t.fields.blockAssignment}</label>
                  <button className="link" onClick={() => updateForm({ newProfile: null })}>{t.edit.cancel}</button>
                </div>
              ) : (
                <button className="link" onClick={() => updateForm({ newProfile: { id: crypto.randomUUID(), name: '', units: 1, block: true } })}>{t.edit.newProfile}</button>
              )}
              {isMissingProfile && <p className="err">{t.edit.needProfile}</p>}
            </div>
          ) : (
            <label className="field">{t.edit.unitsRequired}{numberInput('msdyn_capacityrequired', 0)}</label>
          )}
          <p className="muted small">{t.edit.fixedNote}</p>
        </>
      )}
      {node.type === 'queue' && (
        <>
          <label className="field">{t.edit.priority}{numberInput('msdyn_priority', 0)}</label>
          <label className="field">{t.edit.hours}
            <select value={form._msdyn_operatinghourid_value ?? ''} onChange={(e) => updateForm({ _msdyn_operatinghourid_value: e.target.value || null })}>
              <option value="">{t.edit.none}</option>
              {rows(raw, 'operatingHours').map((schedule) => <option key={schedule.msdyn_operatinghourid} value={normGuid(schedule.msdyn_operatinghourid)}>{schedule.msdyn_name}</option>)}
            </select>
          </label>
        </>
      )}
      {node.type === 'capacity' && (
        <>
          <label className="field">{t.fields.maxUnits}{numberInput('msdyn_defaultmaxunits', 1)}</label>
          <label className="check"><input type="checkbox" checked={!!form.msdyn_blockassignment} onChange={(e) => updateForm({ msdyn_blockassignment: e.target.checked })} /> {t.fields.blockAssignment}</label>
          <ProfileScope raw={raw} node={node} t={t} />
        </>
      )}
      <div className="form-foot">
        <button onClick={onCancel}>{t.edit.cancel}</button>
        <button className="primary" disabled={!isValid || !plan.steps.length} onClick={() => onReview(plan)}>{t.edit.review}</button>
      </div>
    </div>
  )
}

// Before/after of every field, plus the capacity profile links and records that will be written.
export function DetailsDialog({ node, plan, raw, queues, org, env, busy, error, onApply, onBack, onClose, t }) {
  const labels = LABELS(t)
  return (
    <Modal tone="details" title={t.edit.detailsTitle(node.label)} subtitle={t.types[node.type]} onClose={() => !busy && onClose()}
      footer={<>
        <button disabled={busy} onClick={onBack}>{t.edit.back}</button>
        <button disabled={busy} onClick={onClose}>{t.edit.cancel}</button>
        <button className="primary" disabled={busy} onClick={onApply}>{busy ? t.edit.working : t.edit.save}</button>
      </>}>
      <p className="preview">{t.edit.confirmDetails}</p>
      <ul className="records changes">
        {plan.changes.map((change) => (
          <li key={change.col}><b>{labels[change.col]}</b>: <span className="from">{displayValue(change.col, change.from, raw, queues, t)}</span> → <span className="to">{displayValue(change.col, change.to, raw, queues, t)}</span></li>
        ))}
        {plan.unlink.map((link) => <li key={link.msdyn_liveworkstreamcapacityprofileid}>{t.edit.unlinkProfile(profileName(raw, link._msdyn_capacityprofile_id_value))}</li>)}
        {plan.newProfile && <li>{t.edit.createProfile(plan.newProfile.name.trim(), plan.newProfile.units)}</li>}
        {plan.link.map((id) => <li key={id}>{t.edit.linkProfile(profileName(raw, id))}</li>)}
      </ul>
      {node.type === 'capacity' && <ProfileScope raw={raw} node={node} t={t} />}
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}
