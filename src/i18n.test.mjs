import assert from 'node:assert/strict'
import { LANGS } from './i18n.js'

// every language must have exactly the same keys (and functions where English has functions)
const shape = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' ? shape(v) : typeof v]))
for (const [lang, dict] of Object.entries(LANGS)) assert.deepEqual(shape(dict), shape(LANGS.en), `${lang} differs from en`)
console.log('i18n ok')
