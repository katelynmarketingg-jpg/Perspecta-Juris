// ─────────────────────────────────────────────────────────────────────────
//  Impressão de documentos com identidade visual do escritório.
//  Lê o logo e o papel timbrado das Configurações → Escritório e aplica
//  em TODOS os documentos gerados.
// ─────────────────────────────────────────────────────────────────────────
import { getOffice } from './tenant'
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const esc = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Monta o cabeçalho timbrado a partir dos dados do escritório
function cabecalhoHTML(office) {
  const linhas = [
    [office.oab && `OAB ${office.oab}`, office.cnpj && `CNPJ ${office.cnpj}`].filter(Boolean).join(' · '),
    [office.addressStreet, office.addressCity, office.addressState].filter(Boolean).join(', '),
    [office.phone, office.email].filter(Boolean).join(' · '),
  ].filter(Boolean).map(l => `<div class="lh-sub">${esc(l)}</div>`).join('')
  return `<div class="lh">
    ${office.logoDataUrl ? `<img src="${office.logoDataUrl}" class="lh-logo" alt="logo"/>` : ''}
    <div class="lh-info">
      <div class="lh-name">${esc(office.name || 'Escritório')}</div>
      ${linhas}
    </div>
  </div>`
}

/**
 * Abre a janela de impressão com um ou mais documentos.
 * @param {string[]} corpos  textos dos documentos (um por página)
 * @param {{titulo?:string}} opts
 */
export function printDocumentos(corpos, { titulo = 'Documento' } = {}) {
  const bodies = Array.isArray(corpos) ? corpos : [corpos]
  const office = getOffice()
  const usarTimbradoImg = office.usarTimbrado && office.timbradoDataUrl
  const temCabecalho = !usarTimbradoImg && (office.logoDataUrl || office.name) && office.usarTimbrado !== false

  const pageBg = usarTimbradoImg
    ? `background-image:url('${office.timbradoDataUrl}');background-size:210mm 297mm;background-repeat:no-repeat;background-position:top center;`
    : ''
  const padTop = usarTimbradoImg ? '45mm' : '30mm'   // espaço p/ o timbrado da imagem

  // Marcador de assinatura (definido no cadastro) vira uma linha de assinatura ao imprimir.
  const limparMarcador = (t) => String(t ?? '').replace(/\[ASSINATURA(?:S|_CLIENTE|_EMPRESA| DO CLIENTE)?\]/gi, '\n_________________________________________\n')
  const header = temCabecalho ? cabecalhoHTML(office) : ''
  const pages = bodies.map(b => `<div class="page" style="${pageBg}">${header}<pre>${esc(limparMarcador(b))}</pre></div>`).join('')

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.8;color:#000;background:#fff}
  .page{width:210mm;min-height:297mm;padding:${padTop} 25mm 25mm 30mm;page-break-after:always}
  .page:last-child{page-break-after:auto}
  pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:inherit;line-height:inherit;text-align:justify}
  .lh{display:flex;align-items:center;gap:16px;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:26px}
  .lh-logo{height:64px;max-width:120px;object-fit:contain}
  .lh-name{font-family:Arial,sans-serif;font-weight:700;font-size:14pt;color:#111}
  .lh-sub{font-family:Arial,sans-serif;font-size:8.5pt;color:#555;line-height:1.4}
  @media print{@page{size:A4;margin:0}.page{margin:0}}
  @media screen{body{background:#e5e7eb}.page{box-shadow:0 0 30px rgba(0,0,0,.2);margin:20px auto;background:#fff}}
</style></head>
<body>${pages}<script>window.onload=()=>window.print()<\/script></body></html>`)
  win.document.close()
}
