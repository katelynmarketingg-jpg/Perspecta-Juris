import { useEffect, useState } from 'react'
import { getBrandingCached } from '../lib/brandingClient'
import { IconScale } from './ui'

// Mostra o logo definido no Painel Master; se não houver, usa o ícone padrão.
export default function BrandLogo({ size = 20, className = '' }) {
  const [logo, setLogo] = useState(() => getBrandingCached().logoDataUrl || '')
  useEffect(() => {
    const re = () => setLogo(getBrandingCached().logoDataUrl || '')
    window.addEventListener('pj-branding', re)
    return () => window.removeEventListener('pj-branding', re)
  }, [])
  if (logo) {
    return <img src={logo} alt="logo" className={`object-contain ${className}`} style={{ width: size, height: size }} />
  }
  return <IconScale size={size} className={className} />
}
