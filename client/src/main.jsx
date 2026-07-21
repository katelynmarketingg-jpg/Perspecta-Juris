import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { loadAndApplyBranding } from './lib/brandingClient'

// Aplica a marca do sistema (logo/favicon/cor definidos no Painel Master).
loadAndApplyBranding()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
