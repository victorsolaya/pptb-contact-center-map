import { useEffect, useState } from 'react'
import { searchUsers } from '../edit.js'
import { Modal, Target } from './common.jsx'

// Two steps for adds (pick user -> preview), one for removes (preview).
export function MemberDialog({ dialog, setDialog, apply, busy, error, org, env, t }) {
  const [text, setText] = useState('')
  const [found, setFound] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const { queue, user, action } = dialog
  const members = new Set((queue.members ?? []).map((member) => member.id))

  useEffect(() => {
    if (dialog.kind !== 'add') return
    let live = true
    const id = setTimeout(() => {
      if (!text.trim()) return setFound(null)
      setFound(undefined)
      searchUsers(text).then((results) => live && (setFound(results), setSearchError(null)), (e) => live && (setFound([]), setSearchError(e.message)))
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
          {found?.map((candidate) => (
            <li key={candidate.id} className={members.has(candidate.id) ? 'disabled' : ''} onClick={() => !members.has(candidate.id) && setDialog({ kind: 'confirm', action: 'add', queue, user: candidate })}>
              <span className="avatar" aria-hidden>{candidate.label.slice(0, 1)}</span>
              <span><b>{candidate.label}</b><small>{candidate.sub}{members.has(candidate.id) ? ` (${t.edit.alreadyMember})` : ''}</small></span>
            </li>
          ))}
        </ul>
      </Modal>
    )
  const isAdding = action === 'add'
  return (
    <Modal tone={isAdding ? 'add' : 'remove'} title={isAdding ? t.edit.addTitle(queue.label) : t.edit.removeTitle} onClose={close}
      footer={<>
        {isAdding && <button disabled={busy} onClick={() => setDialog({ kind: 'add', queue })}>{t.edit.back}</button>}
        <button disabled={busy} onClick={close}>{t.edit.cancel}</button>
        <button className={isAdding ? 'primary' : 'danger'} disabled={busy} onClick={apply}>{busy ? t.edit.working : isAdding ? t.edit.add : t.edit.removeBtn}</button>
      </>}>
      <p className="preview">{isAdding ? t.edit.confirmAdd(user.label, queue.label) : t.edit.confirmRemove(user.label, queue.label)}</p>
      <Target org={org} env={env} error={error} t={t} />
    </Modal>
  )
}
