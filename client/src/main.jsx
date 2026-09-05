import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { loadAndApplyBranding } from './lib/brandingClient'
import { sanearSessao } from './lib/api'

// ANTES de montar o app: se sobrou usuário guardado sem refresh token, a
// sessão está pela metade e o app entraria num laço de recarregamento.
// Limpar aqui é o que garante que a tela de login apareça, e apareça uma vez.
sanearSessao()

// Aplica a marca do sistema (logo/favicon/cor definidos no Painel Master).
loadAndApplyBranding()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
