// ─────────────────────────────────────────────────────────────────────────
//  Coleta de Assinaturas — cliente
//  Usa o backend (/api/signatures) quando disponível; cai para o
//  localStorage automaticamente (via api.js → localHandle) quando o
//  servidor está offline. Com o backend + Neon ativos, a assinatura
//  funciona remotamente (o cliente assina pelo celular via link/WhatsApp).
// ─────────────────────────────────────────────────────────────────────────
import api from './api'

// ── Escritório (autenticado) ────────────────────────────────────────────────
export async function getRequestsByProcess(processId) {
  const rows = await api.signatures.list(processId)
  return Array.isArray(rows) ? rows : (rows?.data ?? [])
}

export async function createRequest({ processId, clientId, clientName, clientPhone, documentos, modo }) {
  return api.signatures.create({
    processId: processId ?? null,
    clientId: clientId ?? null,
    clientName: clientName ?? '',
    clientPhone: clientPhone ?? '',
    documentos: documentos ?? [],
    modo: modo ?? 'link',
  })
}

export async function deleteRequest(id) {
  return api.signatures.remove(id)
}

// ── Público (página de assinatura, sem login) ───────────────────────────────
export async function getRequest(id) {
  try { return await api.signatures.getPublic(id) }
  catch { return null }
}

export async function saveSignature(id, payload) {
  // payload: { signer, signatureImg, photoImg, consent, consentText, documentHash, evidencias }
  return api.signatures.sign(id, payload)
}

// ── Helpers síncronos ───────────────────────────────────────────────────────
export function signLink(id) {
  return `${window.location.origin}/assinar/${id}`
}

export function whatsappLink(phone, message) {
  const num = String(phone || '').replace(/\D/g, '')
  const full = num.length <= 11 ? `55${num}` : num
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`
}
