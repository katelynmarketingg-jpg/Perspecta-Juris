// ─────────────────────────────────────────────────────────────────
//  Marca do sistema (logo, favicon, cor) — definida no Painel Master
//  e aplicada em tempo real em todo o app.
// ─────────────────────────────────────────────────────────────────
import api from './api'

const CACHE = 'pj_branding'
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)))

function hexToRgb(hex) {
  const h = String(hex ?? '').replace('#', '').trim()
  if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
  if (h.length === 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  return null
}
const W = [255, 255, 255], B = [0, 0, 0]
const mix = (rgb, target, r) => rgb.map((c, i) => clamp(c * (1 - r) + target[i] * r))
const triple = (rgb) => rgb.join(' ')

// Gera a escala 50→950 a partir da cor primária escolhida.
const SHADES = {
  50: [W, 0.92], 100: [W, 0.84], 200: [W, 0.68], 300: [W, 0.48], 400: [W, 0.22],
  500: [W, 0], 600: [B, 0.12], 700: [B, 0.26], 800: [B, 0.45], 900: [B, 0.62], 950: [B, 0.76],
}

export function applyBrandColor(hex) {
  const base = hexToRgb(hex)
  if (!base) return
  const root = document.documentElement
  for (const [k, [tgt, r]] of Object.entries(SHADES)) {
    root.style.setProperty(`--c-brand-${k}`, triple(mix(base, tgt, r)))
  }
  root.style.setProperty('--c-accent-300', triple(mix(base, W, 0.36)))
  root.style.setProperty('--c-accent-400', triple(mix(base, W, 0.18)))
  root.style.setProperty('--c-accent-500', triple(base))
  root.style.setProperty('--brand', hex)
  root.style.setProperty('--border-focus', hex)
}

export function applyFavicon(dataUrl) {
  if (!dataUrl) return
  let link = document.querySelector("link[rel~='icon']")
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
  link.href = dataUrl
}

export function getBrandingCached() {
  try { return JSON.parse(localStorage.getItem(CACHE) ?? 'null') ?? {} } catch { return {} }
}

export function applyBranding(b) {
  if (!b || typeof b !== 'object') return
  try { localStorage.setItem(CACHE, JSON.stringify(b)) } catch { /* quota */ }
  if (b.brandColor) applyBrandColor(b.brandColor)
  if (b.faviconDataUrl) applyFavicon(b.faviconDataUrl)
  window.dispatchEvent(new Event('pj-branding'))
}

// Aplica o cache na hora (evita "piscar") e depois busca do servidor.
export async function loadAndApplyBranding() {
  applyBranding(getBrandingCached())
  try {
    const b = await api.branding()
    if (b && typeof b === 'object') applyBranding(b)
    return b
  } catch { return null }
}
