// Click on the extension icon while on a D365 tab: read the Contact Center config through that
// tab's own session (same-origin Web API, no token/app registration), store it, open the map.

import { QUERIES, fetchAll } from './queries.js'

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.action.setBadgeText({ text: '…' })
  let snap
  try {
    const host = new URL(tab.url ?? 'about:blank').hostname
    if (!/\.dynamics\.(com|us|cn)$/.test(host)) throw new Error('Pulsa el icono estando en una pestaña de Dynamics 365 con la sesión iniciada.')
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchAll, args: [QUERIES] })
    snap = { org: host, extractedAt: new Date().toISOString(), raw: result }
  } catch (e) {
    snap = { error: String(e.message ?? e) }
  }
  await chrome.storage.local.set({ snap })
  await chrome.action.setBadgeText({ text: '' })
  await chrome.tabs.create({ url: 'index.html' })
})
