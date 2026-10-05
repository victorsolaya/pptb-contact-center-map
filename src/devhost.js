// DEV ONLY (`npm run dev`, URL with ?fakehost[&env=Production]): an in-memory stand-in for the PPTB
// host backed by dev/raw.json, so the edit flow can be exercised without touching a real org.
// main.jsx only imports it when import.meta.env.DEV, so it never ships in the published build.
import { QUERIES } from './queries.js'

const EXTRA_USERS = ['Olivia Brown', 'Noah Wilson', 'Emma Davis'].map((name, i) => ({
  systemuserid: `00000000-0000-4000-9000-00000000000${i + 1}`, fullname: name, internalemailaddress: name.toLowerCase().replace(' ', '.') + '@contoso.com', isdisabled: false,
}))

export async function installFakeHost() {
  const snap = await (await fetch('dev/raw.json')).json()
  const raw = structuredClone(snap.raw)
  const allUsers = [...raw.users, ...EXTRA_USERS]
  const syncUsers = () => { raw.users = allUsers.filter((u) => raw.memberships.some((m) => m.systemuserid === u.systemuserid)) }
  const env = new URLSearchParams(location.search).get('env') ?? snap.environment ?? 'Dev'

  globalThis.toolboxAPI = {
    connections: { getActiveConnection: async () => ({ name: snap.org, url: `https://${snap.org}`, environment: env }) },
    events: { on() {} },
    utils: {
      showNotification: async ({ type, title, body }) => console.info(`[fake notify:${type}] ${title} — ${body}`),
      copyToClipboard: (t) => navigator.clipboard.writeText(t),
      getCurrentTheme: async () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    },
    fileSystem: { saveFile: async (name) => (console.info('[fake saveFile]', name), name) },
  }
  globalThis.dataverseAPI = {
    queryData: async (q) => {
      const search = /contains\(fullname,'([^']*)'\)/.exec(q)
      if (search) {
        const text = decodeURIComponent(search[1]).replace(/''/g, "'").toLowerCase()
        return { value: allUsers.filter((u) => u.fullname.toLowerCase().includes(text) || u.internalemailaddress.includes(text)) }
      }
      const key = Object.keys(QUERIES).find((k) => QUERIES[k] === q)
      return { value: structuredClone(raw[key] ?? []) }
    },
    associate: async (_entity, queueId, _rel, _related, userId) => {
      if (env === 'Production' && location.search.includes('fail')) throw new Error('403 Principal user is missing prvAppendToQueue privilege (simulated)')
      raw.memberships.push({ queueid: queueId, systemuserid: userId })
      syncUsers()
    },
    disassociate: async (_entity, queueId, _rel, userId) => {
      raw.memberships = raw.memberships.filter((m) => !(m.queueid === queueId && m.systemuserid === userId))
      syncUsers()
    },
  }
}
