import { useState } from 'react'
import { loadFromPptb, notify } from './pptb.js'
import { addMember, removeMember, createQueue, deleteQueue, appendRule, removeRule, buildRuleXml, writeRuleset, errorText, MEMBER_TABLES, QUEUE_TABLES, RULE_TABLES } from './edit.js'
import { runSteps, undoAll, DETAIL_TABLES } from './details.js'
import { createWorkstream, deleteCreated, WORKSTREAM_TABLES } from './workstream.js'
import { writeIdentification, IDENTIFICATION_TABLES } from './identification.js'
import { normGuid } from './rules.js'

// Edit mode: the open dialog, the change being written and how it ended (error in the dialog, or a
// toast offering Undo). `focus` centers the map on a new record; `setEditingId` closes the details form.
export function useEditActions({ snapshot, setSnapshot, t, focus, setEditingId }) {
  const [dialog, setDialog] = useState(null) // { kind: 'add' | 'confirm' | 'queue' | 'rule' | 'removeRule' | 'workstream' | 'details', ...what that dialog needs }
  const [busy, setBusy] = useState(false)
  const [editError, setEditError] = useState(null)
  const [toast, setToast] = useState(null)

  const openDialog = (nextDialog) => { setEditError(null); setDialog(nextDialog) }

  // After a change only the affected tables are re-read (focus and layout stay put).
  async function refreshTables(keys) {
    const reloaded = await loadFromPptb(keys)
    if (reloaded) setSnapshot((current) => current && { ...current, raw: { ...current.raw, ...reloaded.raw } }) // current is undefined if the connection changed meanwhile
  }

  // `change` applies one change and returns the function that reverts it (offered as Undo).
  async function perform(change, text) {
    setBusy(true)
    setEditError(null)
    try {
      const revert = await change()
      const message = t.edit.inOrg(text, snapshot.org, snapshot.environment)
      notify(t.edit.mode, message, 'success')
      setToast({ text: message, undo: revert })
      setDialog(null)
    } catch (e) {
      setEditError(errorText(e, t))
      notify(t.edit.failed, errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  // Undo of a multi-record change: `revert` returns what it could not revert, so a retry only does those.
  const retryingUndo = (pending, revert, tables, code) => async () => {
    pending = await revert(pending)
    await refreshTables(tables)
    if (pending.length) throw Object.assign(new Error(t.edit.failed), { code, leftovers: pending })
  }

  async function changeMembership(action, queue, user) {
    await (action === 'add' ? addMember : removeMember)(queue.id, user.id)
    await refreshTables(MEMBER_TABLES)
  }
  const applyMember = () => {
    const { action, queue, user } = dialog
    return perform(async () => {
      await changeMembership(action, queue, user)
      return () => changeMembership(action === 'add' ? 'remove' : 'add', queue, user)
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

  const applyWorkstream = (name, plan) =>
    perform(async () => {
      const { workstreamId, created } = await createWorkstream(name, plan)
      await refreshTables(WORKSTREAM_TABLES)
      focus(`workstream:${normGuid(workstreamId)}`)
      return retryingUndo(created, deleteCreated, WORKSTREAM_TABLES, 'partial')
    }, t.edit.wsCreated(name))

  // Details edited in the detail panel
  const applyDetails = (node, plan) =>
    perform(async () => {
      const undos = await runSteps(plan.steps)
      await refreshTables(DETAIL_TABLES[node.type])
      setEditingId(null)
      return retryingUndo(undos, undoAll, DETAIL_TABLES[node.type], 'notReverted')
    }, t.edit.saved(plan.changes.find((change) => /^(msdyn_)?name$/.test(change.col))?.to ?? node.label))

  // Record identification rules: the whole column is written, after checking nobody changed it; undo writes it back.
  const applyIdentification = (workstream, before, next) =>
    perform(async () => {
      const workstreamId = workstream.id.split(':')[1]
      await writeIdentification(workstreamId, before, next)
      await refreshTables(IDENTIFICATION_TABLES)
      return async () => { await writeIdentification(workstreamId, next, before); await refreshTables(IDENTIFICATION_TABLES) }
    }, t.edit.identSaved(workstream.label))

  async function undo() {
    setBusy(true)
    try {
      await toast.undo()
      setToast(null)
    } catch (e) {
      notify(t.edit.failed, errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return {
    dialog, setDialog, openDialog, busy, editError, setEditError, toast, setToast, undo,
    applyMember, applyQueue, applyRule, applyRemoveRule, applyWorkstream, applyDetails, applyIdentification,
  }
}
