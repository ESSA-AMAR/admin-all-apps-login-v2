import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/cm-tokens.css'
import './styles/cm-web-tokens.css'
import './index.css'
import './styles/figma-theme.css'
import './styles/pos-theme.css'
import './styles/pos-login.css'
import './styles/pos-v3-system.css'
import './styles/backoffice.css'
import './styles/bo-screens.css'
import './styles/dash-tabs.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
