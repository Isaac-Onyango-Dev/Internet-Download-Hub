/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { webAPI } from './lib/web-api';

// In web mode (no Electron), inject the browser-compatible API synchronously
// so all hooks that check window.electronAPI work from the very first render.
if (typeof window !== 'undefined' && !window.electronAPI) {
  (window as any).electronAPI = webAPI;
}

createRoot(document.getElementById('root')!).render(<App />);
