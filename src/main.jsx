import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './styles.css'
import App from './App.jsx'

// `npm run dev` with ?fakehost: simulated ToolBox host (dev only, removed from the published build).
const boot = import.meta.env.DEV && location.search.includes('fakehost') ? import('./devhost.js').then((m) => m.installFakeHost()) : Promise.resolve()
boot.then(() => createRoot(document.getElementById('root')).render(<App />))
