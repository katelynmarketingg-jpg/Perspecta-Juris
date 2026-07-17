// ─────────────────────────────────────────────────────────────────────────
//  Prova de assinatura eletrônica — reforça a validade jurídica:
//   • Integridade: hash SHA-256 do conteúdo exato assinado
//   • Autenticação: IP, dispositivo/navegador, fuso, data-hora, geolocalização
//   • Consentimento: termo LGPD com aceite explícito
//   • Comprovante: documento + trilha de auditoria (PDF via impressão)
//  Base legal: MP 2.200-2/2001 e Lei 14.063/2020 (assinatura eletrônica).
// ─────────────────────────────────────────────────────────────────────────
import { getOffice } from './tenant'
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const esc = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const TERMO_LGPD =
  'Declaro que li e concordo com o(s) documento(s) acima e autorizo a coleta e o tratamento ' +
  'dos meus dados (nome, CPF, imagem da assinatura, foto de comprovação, endereço IP, ' +
  'localização aproximada, data/hora e dados do dispositivo) com a finalidade exclusiva de ' +
  'comprovar a autoria e a integridade desta assinatura eletrônica, nos termos da MP 2.200-2/2001, ' +
  'da Lei 14.063/2020 e da LGPD (Lei 13.709/2018). Estou ciente de que esta é uma assinatura ' +
  'eletrônica e tem validade jurídica entre as partes.'

// Concatena os documentos de forma determinística e gera o hash SHA-256 (hex).
export async function hashDocumentos(documentos) {
  const texto = (documentos ?? []).map(d => `# ${d.titulo ?? ''}\n${d.corpo ?? ''}`).join('\n\n----\n\n')
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}

// Melhor esforço: IP público (echo service) com timeout.
async function obterIP() {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3500)
    const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal })
    clearTimeout(t)
    const j = await r.json()
    return j?.ip ?? null
  } catch { return null }
}

// Melhor esforço: geolocalização (exige permissão do usuário).
function obterGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, precisao: Math.round(pos.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    )
  })
}

// Coleta todas as evidências do dispositivo do signatário no momento da assinatura.
export async function coletarEvidencias() {
  const [ip, geo] = await Promise.all([obterIP(), obterGeo()])
  return {
    ip,
    geo,
    userAgent: navigator.userAgent,
    plataforma: navigator.platform,
    idioma: navigator.language,
    tela: `${window.screen?.width || 0}×${window.screen?.height || 0}`,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
    carimboTempo: new Date().toISOString(),
  }
}

const fmt = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '—'

// Abre a janela de impressão com o Comprovante de Assinatura Eletrônica
// (documento assinado + manifesto/trilha de auditoria). Salvar como PDF.
export function imprimirComprovante(req) {
  const office = getOffice()
  const ev = req.evidencias ?? {}
  const s = req.signer ?? {}
  const docs = req.documentos ?? []

  const header = `<div class="lh">
    ${office.logoDataUrl ? `<img src="${office.logoDataUrl}" class="lh-logo" alt="logo"/>` : ''}
    <div><div class="lh-name">${esc(office.name || 'Escritório')}</div>
    ${[office.oab && `OAB ${office.oab}`, office.cnpj && `CNPJ ${office.cnpj}`].filter(Boolean).map(l => `<div class="lh-sub">${esc(l)}</div>`).join('')}</div>
  </div>`

  const paginasDoc = docs.map(d => `<div class="page">${header}
    <h2>${esc(d.titulo || 'Documento')}</h2>
    <pre>${esc(d.corpo)}</pre></div>`).join('')

  const geoTxt = ev.geo ? `${ev.geo.lat.toFixed(5)}, ${ev.geo.lon.toFixed(5)} (±${ev.geo.precisao} m)` : 'não autorizada pelo signatário'
  const linha = (rot, val) => `<tr><td class="k">${esc(rot)}</td><td class="v">${val}</td></tr>`

  const manifesto = `<div class="page">${header}
    <h2>Manifesto de Assinatura Eletrônica</h2>
    <p class="intro">Este comprovante atesta a autoria e a integridade da assinatura eletrônica dos documentos anteriores,
    coletada por meio eletrônico nos termos da <b>MP 2.200-2/2001</b> e da <b>Lei 14.063/2020</b>.</p>
    <table class="ev">
      ${linha('Signatário', esc(s.nome))}
      ${linha('CPF', esc(s.cpf))}
      ${linha('Documentos', esc(docs.map(d => d.titulo).join('; ')))}
      ${linha('Código de validação', `<b>${esc(req.validationCode)}</b>`)}
      ${linha('Hash SHA-256 do conteúdo', `<span class="hash">${esc(req.documentHash || '—')}</span>`)}
      ${linha('Criado em', esc(fmt(req.createdAt)))}
      ${linha('Assinado em', esc(fmt(req.signedAt)))}
      ${linha('Endereço IP', esc(ev.ip || '—'))}
      ${linha('Localização', esc(geoTxt))}
      ${linha('Dispositivo', esc(ev.userAgent || '—'))}
      ${linha('Plataforma / Idioma', esc([ev.plataforma, ev.idioma].filter(Boolean).join(' · ') || '—'))}
      ${linha('Tela / Fuso', esc([ev.tela, ev.fuso].filter(Boolean).join(' · ') || '—'))}
      ${linha('Consentimento LGPD', req.consent ? 'Aceito pelo signatário ✔' : 'Não registrado')}
    </table>
    <div class="imgs">
      <div><p class="cap">Assinatura</p>${req.signatureImg ? `<img src="${req.signatureImg}" class="sig"/>` : '—'}</div>
      <div><p class="cap">Foto de comprovação</p>${req.photoImg ? `<img src="${req.photoImg}" class="selfie"/>` : '—'}</div>
    </div>
    ${req.consentText ? `<p class="termo"><b>Termo aceito:</b> ${esc(req.consentText)}</p>` : ''}
    <p class="foot">Documento gerado eletronicamente pelo Perspecta Juris. A integridade pode ser verificada recalculando o hash SHA-256 do conteúdo assinado.</p>
  </div>`

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Comprovante — ${esc(s.nome || '')}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.7;color:#000;background:#fff}
  .page{width:210mm;min-height:297mm;padding:22mm 22mm;page-break-after:always}
  .page:last-child{page-break-after:auto}
  h2{font-family:Arial,sans-serif;font-size:14pt;margin:6px 0 14px;color:#111}
  pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:inherit;text-align:justify}
  .lh{display:flex;align-items:center;gap:14px;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:20px}
  .lh-logo{height:54px;max-width:110px;object-fit:contain}
  .lh-name{font-family:Arial,sans-serif;font-weight:700;font-size:13pt}
  .lh-sub{font-family:Arial,sans-serif;font-size:8pt;color:#555}
  .intro{font-size:10.5pt;color:#333;margin-bottom:14px;text-align:justify}
  table.ev{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:9.5pt;margin-bottom:16px}
  table.ev td{border:1px solid #ccc;padding:6px 8px;vertical-align:top}
  td.k{width:34%;background:#f3f4f6;font-weight:600;color:#333}
  .hash{font-family:'Courier New',monospace;font-size:8.5pt;word-break:break-all}
  .imgs{display:flex;gap:20px;margin:6px 0 14px}
  .imgs .cap{font-family:Arial,sans-serif;font-size:8.5pt;color:#666;margin-bottom:4px}
  .sig{max-height:80px;background:#fff;border:1px solid #ddd;border-radius:6px}
  .selfie{max-height:150px;border:1px solid #ddd;border-radius:6px;object-fit:cover}
  .termo{font-size:8.5pt;color:#444;text-align:justify;border-top:1px solid #eee;padding-top:10px;margin-top:6px}
  .foot{font-size:8pt;color:#888;margin-top:14px}
  @media print{@page{size:A4;margin:0}.page{margin:0}}
  @media screen{body{background:#e5e7eb}.page{box-shadow:0 0 30px rgba(0,0,0,.2);margin:20px auto;background:#fff}}
</style></head>
<body>${paginasDoc}${manifesto}<script>window.onload=()=>window.print()<\/script></body></html>`)
  win.document.close()
}
