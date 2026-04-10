/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// ── Environment ──────────────────────────────────────────────────
// Electron injects window.electronAPI via contextBridge in preload.ts.
// In the browser this is absent — components use api.ts fallbacks instead.
// Do NOT inject a fake electronAPI here; it breaks isElectron() detection.

createRoot(document.getElementById('root')!).render(<App />);
