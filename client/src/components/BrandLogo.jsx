import { useEffect, useState } from 'react'
import { getBrandingCached } from '../lib/brandingClient'
import marcaPerspecta from '../assets/perspecta-marca.png'

// ─────────────────────────────────────────────────────────────────
//  A marca do sistema.
//
//  O padrão era um ícone genérico de balança — desenho de biblioteca, não a
//  marca. Agora o padrão é a marca Perspecta de verdade, tirada do arquivo
//  oficial do manual. O miolo dela é VAZADO (fundo transparente), então ela
//  funciona sobre o preto, o cinza e o claro sem recorte branco em volta.
//
//  Um logo enviado no Painel Master continua tendo prioridade: é o escritório
//  que está vendo a própria marca, não a nossa.
// ─────────────────────────────────────────────────────────────────
export default function BrandLogo({ size = 20, className = '' }) {
  const [logo, setLogo] = useState(() => getBrandingCached().logoDataUrl || '')
  useEffect(() => {
    const re = () => setLogo(getBrandingCached().logoDataUrl || '')
    window.addEventListener('pj-branding', re)
    return () => window.removeEventListener('pj-branding', re)
  }, [])
  return (
    <img
      src={logo || marcaPerspecta}
      alt="Perspecta"
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
