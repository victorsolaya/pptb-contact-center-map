import { useEffect } from 'react'

// Every dialog previews the change and names the org and the environment before applying it
// (PPTB marketplace policy for tools that modify data); Production gets an extra warning.

const TONE = { add: '#16a34a', remove: '#dc2626', queue: '#f59e0b', rule: '#d946ef', workstream: '#6366f1', details: '#2563eb' }
const ICON = { add: '+', remove: '×', queue: '▤', rule: '◆', workstream: '⇄', details: '✎' }

export function Modal({ tone, title, subtitle, footer, onClose, children }) {
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

export function Target({ org, env, error, t }) {
  return (
    <>
      <p className="target"><span className={'env ' + (env ?? '').toLowerCase()}>{env ?? '?'}</span> {org}</p>
      {env === 'Production' && <p className="prod">{t.edit.production}</p>}
      {error && <p className="err">{t.edit.failed}: {error}</p>}
    </>
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
