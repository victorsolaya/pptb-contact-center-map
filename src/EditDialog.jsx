import { useEffect, useState } from 'react'
import { searchUsers } from './edit.js'

// Add/remove an agent. Two steps for adds (pick user -> preview), one for removes (preview).
// The preview always names the change, the org and the environment (PPTB marketplace policy for
// tools that modify data); Production gets an extra warning.
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
  return (
    <div className="modal" onClick={close}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {dialog.kind === 'add' ? (
          <>
            <h3>{t.edit.addTitle(queue.label)}</h3>
            <input autoFocus placeholder={t.edit.searchUsers} value={text} onChange={(e) => setText(e.target.value)} />
            <ul className="results">
              {found === undefined && <li className="muted">{t.edit.searching}</li>}
              {found?.length === 0 && <li className="muted">{searchError ?? t.edit.noResults}</li>}
              {found?.map((u) => (
                <li key={u.id} className={members.has(u.id) ? 'disabled' : ''} onClick={() => !members.has(u.id) && setDialog({ kind: 'confirm', action: 'add', queue, user: u })}>
                  <b>{u.label}</b> <small>{u.sub}{members.has(u.id) ? ` · ${t.edit.alreadyMember}` : ''}</small>
                </li>
              ))}
            </ul>
            <div className="buttons"><button onClick={close}>{t.edit.cancel}</button></div>
          </>
        ) : (
          <>
            <h3>{action === 'add' ? t.edit.addTitle(queue.label) : t.edit.removeTitle}</h3>
            <p className="preview">{action === 'add' ? t.edit.confirmAdd(user.label, queue.label) : t.edit.confirmRemove(user.label, queue.label)}</p>
            <p className="target">{t.edit.target(org, env ?? '?')}</p>
            {env === 'Production' && <p className="prod">{t.edit.production}</p>}
            {error && <p className="err">{t.edit.failed}: {error}</p>}
            <div className="buttons">
              {action === 'add' && <button disabled={busy} onClick={() => setDialog({ kind: 'add', queue })}>{t.edit.back}</button>}
              <button disabled={busy} onClick={close}>{t.edit.cancel}</button>
              <button className={action === 'add' ? 'primary' : 'danger'} disabled={busy} onClick={apply}>
                {busy ? t.edit.working : action === 'add' ? t.edit.add : t.edit.removeBtn}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Toast({ toast, onUndo, onClose, busy, t }) {
  useEffect(() => {
    const id = setTimeout(onClose, 12000)
    return () => clearTimeout(id)
  }, [toast])
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.undo && <button disabled={busy} onClick={onUndo}>{t.edit.undo}</button>}
      <button className="x" onClick={onClose}>×</button>
    </div>
  )
}
