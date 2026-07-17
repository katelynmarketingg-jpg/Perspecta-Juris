import { useState } from 'react'
import { Card, Button } from '../../components/ui'
import { getOffice } from '../../lib/tenant'

// ── Conteúdo do manual (compartilhado entre a tela e o PDF) ─────────────────
const SECOES = [
  { icone: '🏠', titulo: 'Dashboard', resumo: 'Visão geral do escritório no mês.', itens: [
    'Entrada de caixa, novos clientes e previsão a receber (boletos) do mês.',
    'Gráficos: entrada de caixa (6 meses), novos clientes, processos por área e previsão de entrada.',
    'Alerta de recebimentos vencidos e próximos prazos.',
    'Cada empresa vê apenas os próprios números.',
  ]},
  { icone: '👥', titulo: 'Clientes', resumo: 'Cadastro completo com abas de trabalho.', itens: [
    'Cadastro: dados pessoais, contato, endereço e bancários. Alterna Pessoa Física / Jurídica.',
    'Processos: lista e cria processos do cliente.',
    'Pagamentos: lançamentos, cobrança por WhatsApp (PIX / cartão / boleto) e organização de parcelas.',
    'Documentos: pastas, upload e geração de documentos com os dados do cliente.',
    'Área de Trabalho: cálculos, teses e modelos salvos do cliente.',
    'Tarefas & Observações: atribuições e mural da equipe.',
  ]},
  { icone: '⚖️', titulo: 'Processos', resumo: 'Gestão do processo do início ao fim.', itens: [
    'Cadastro com identificação, tribunal/vara, parte contrária e honorários.',
    'Honorários: busca os valores salvos nas Configurações (editável no processo).',
    'Forma de pagamento (à vista, entrada, parcelado, mensal) → gera os lançamentos em Pagamentos automaticamente.',
    'Abas: Movimentações, Assinaturas, Prazos, Financeiro, Documentos e Dados.',
    'Diário Oficial (DJEN) por processo dentro das Movimentações.',
  ]},
  { icone: '📡', titulo: 'Movimentações', resumo: 'Publicações do Diário (DJEN) por OAB.', itens: [
    'Sincroniza as publicações da OAB no DJEN/CNJ.',
    'Cada publicação vinculada a um processo gera: movimentação + tarefa + prazo.',
    'Sincronização automática a cada 1 minuto (enquanto o app está aberto).',
    'O prazo é sugerido (data da publicação + dias) e entra como “a confirmar”.',
  ]},
  { icone: '📅', titulo: 'Prazos', resumo: 'Agenda de prazos com cores de urgência.', itens: [
    'Vermelho: hoje ou vencido. Amarelo: próximos 7 dias. Laranja: 8 dias ou mais.',
    'Calendário e lista, com filtro por status.',
    'Prazos criados automaticamente pelas Movimentações aparecem aqui.',
  ]},
  { icone: '✅', titulo: 'Tarefas', resumo: 'Atribuições entre a equipe com prazos.', itens: [
    'Colunas: A Fazer, Em Andamento, Finalizadas.',
    'Cores por urgência (vermelho hoje, amarelo 7 dias, laranja 8+).',
    'Badge laranja no menu com o nº de tarefas em aberto do seu login.',
    'Ao concluir: verde para quem fez; azul “Resolvida” para quem enviou dar ciência.',
    'Filtros: Minhas, Enviadas, Todas.',
  ]},
  { icone: '💰', titulo: 'Financeiro & Cobrança', resumo: 'Lançamentos e cobrança por WhatsApp.', itens: [
    'Lançamentos a receber/pagar por cliente e processo.',
    'Cobrar via WhatsApp: envia PIX (chave do escritório), link de cartão ou boleto.',
    'Notificação laranja de lançamentos “a organizar” (vindos do processo).',
    'Editar vencimentos, marcar pago e (em breve) gerar boletos via Asaas.',
  ]},
  { icone: '📄', titulo: 'Documentos & Modelos', resumo: 'Geração de documentos com timbrado.', itens: [
    'Banco de Modelos (petições) e modelos de documento com variáveis {{cliente.nome}}.',
    'Selecione vários modelos e gere todos de uma vez com os dados do cliente.',
    'Logo e papel timbrado do escritório aplicados automaticamente (Configurações → Escritório).',
    'Copiar, baixar (.doc) e imprimir/PDF.',
  ]},
  { icone: '🧮', titulo: 'Calculadora Jurídica', resumo: 'Cálculos por ramo + previdenciário.', itens: [
    'Dezenas de cálculos (cível, trabalhista, previdenciário, tributário, família, penal…).',
    'Cada cálculo mostra memória de cálculo e base legal; exporta PDF/Excel.',
    'Planejamento Previdenciário: sobe o CNIS (PDF), lê vínculos e empresas, e compara as regras de aposentadoria.',
    'Resultados são estimativos — confira com profissional habilitado.',
  ]},
  { icone: '✍️', titulo: 'Assinaturas', resumo: 'Coleta de assinatura por link/WhatsApp.', itens: [
    'Dentro do processo: selecione documentos e gere para assinatura.',
    'Envie o link pelo WhatsApp — o cliente assina (desenho + CPF + foto).',
    'Acompanhe o status (pendente / assinado) e veja a comprovação.',
  ]},
  { icone: '⚙️', titulo: 'Configurações', resumo: 'Personalize o escritório.', itens: [
    'Áreas, Serviços (com documentos e formulários), Honorários (valores padrão).',
    'Usuários / Logins: cadastre a equipe (nome, login, senha, perfil).',
    'Aparência: tema claro/escuro, ordem dos botões e posição (lateral ou em cima).',
    'Escritório: dados, chave PIX, logo e papel timbrado.',
    'Integrações: OAB, DataJud e portais dos tribunais.',
  ]},
  { icone: '🏢', titulo: 'Empresas & Acessos', resumo: 'Multi-empresa e administrador.', itens: [
    'Cada empresa tem seus próprios dados, usuários e configurações (isolados).',
    'Login: Empresa + Usuário + Senha.',
    'Administrador do sistema (login separado): vê todas as empresas, total de clientes e gerencia acessos.',
  ]},
]

const FAQ = [
  { q: 'Como faço login?', a: 'Informe o nome da Empresa, seu Usuário e a Senha cadastrados em Configurações → Usuários. O administrador do sistema entra com a empresa “Perspecta Admin”.' },
  { q: 'Meus dados ficam salvos?', a: 'Sim. Tudo é salvo automaticamente no dispositivo. Para sincronizar entre computadores/celulares é necessário ativar o servidor (Neon) — a estrutura já está pronta.' },
  { q: 'Como troco entre tema claro e escuro?', a: 'No botão sol/lua da barra, ou em Configurações → Aparência.' },
  { q: 'Como coloco meu logo e papel timbrado nos documentos?', a: 'Configurações → Escritório → “Identidade dos documentos”. O logo/timbrado é aplicado em todos os documentos gerados.' },
  { q: 'Como cobro um cliente por WhatsApp?', a: 'No cliente → Pagamentos → botão “Cobrar (WhatsApp)”. Escolha PIX, cartão ou boleto. A chave PIX vem de Configurações → Escritório.' },
  { q: 'Como o sistema pega as publicações do Diário?', a: 'Aba Movimentações → Sincronizar (usa sua OAB). Ele roda a cada minuto com o app aberto e cria movimentação, tarefa e prazo automaticamente.' },
  { q: 'O prazo criado automaticamente é o prazo legal?', a: 'Não. É uma sugestão (data da publicação + dias) marcada como “a confirmar”. Confirme sempre o prazo processual correto.' },
  { q: 'Como subo o CNIS no planejamento previdenciário?', a: 'Calculadora → Planejamento Previdenciário → “Subir CNIS (PDF)”. O sistema lê os vínculos, empresas e salários.' },
  { q: 'Emito boletos de verdade?', a: 'Ainda não — o botão de boleto/cartão está pronto para a integração com o Asaas. Por enquanto, PIX funciona 100% e você pode colar links manualmente.' },
  { q: 'Posso reorganizar o menu?', a: 'Sim. Configurações → Aparência: reordene os botões e escolha se ficam na lateral ou em cima.' },
]

// ── PDF moderno do manual ───────────────────────────────────────────────────
function baixarManual() {
  const office = getOffice()
  const secoesHtml = SECOES.map((s, i) => `
    <div class="sec">
      <div class="sec-h"><span class="sec-ic">${s.icone}</span><div><div class="sec-t">${i + 1}. ${s.titulo}</div><div class="sec-r">${s.resumo}</div></div></div>
      <ul>${s.itens.map(it => `<li>${it}</li>`).join('')}</ul>
    </div>`).join('')
  const faqHtml = FAQ.map(f => `<div class="faq"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>`).join('')
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Manual — Perspecta Juris</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',system-ui,sans-serif;color:#1f2937;font-size:10.5pt;line-height:1.55}
  .cover{height:297mm;background:linear-gradient(135deg,#0a0a0a 0%,#1a0f08 55%,#c2410c 130%);color:#fff;padding:40mm 25mm;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
  .cover .brand{font-size:11pt;letter-spacing:.35em;text-transform:uppercase;color:#fb923c;font-weight:700}
  .cover h1{font-size:40pt;font-weight:800;line-height:1.05;margin:14px 0}
  .cover p{color:#d1d5db;font-size:12pt;max-width:120mm}
  .cover .tag{margin-top:40px;font-size:9pt;color:#9ca3af}
  .wrap{padding:22mm 22mm 25mm}
  h2{font-size:16pt;font-weight:800;color:#0a0a0a;border-bottom:3px solid #c2410c;padding-bottom:8px;margin:26px 0 14px}
  .sec{border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:12px;break-inside:avoid}
  .sec-h{display:flex;gap:12px;align-items:center;margin-bottom:8px}
  .sec-ic{font-size:20pt}
  .sec-t{font-size:12.5pt;font-weight:700;color:#111}
  .sec-r{font-size:9pt;color:#6b7280}
  ul{margin-left:16px;color:#374151}li{margin-bottom:4px}
  .faq{border-left:3px solid #c2410c;padding:6px 0 6px 14px;margin-bottom:12px;break-inside:avoid}
  .faq-q{font-weight:700;color:#111;font-size:11pt}
  .faq-a{color:#4b5563;margin-top:3px}
  .note{background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 14px;margin-top:16px;font-size:9pt;color:#9a3412}
  @media print{@page{size:A4;margin:0}}
</style></head><body>
  <div class="cover">
    <div class="brand">Perspecta · Juris</div>
    <h1>Manual do Sistema</h1>
    <p>Guia completo do ERP jurídico ${office.name ? '— ' + office.name : ''}: clientes, processos, prazos, financeiro, documentos e muito mais.</p>
    <div class="tag">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>
  <div class="wrap">
    <h2>Módulos do sistema</h2>
    ${secoesHtml}
    <h2>Perguntas frequentes</h2>
    ${faqHtml}
    <div class="note">Os cálculos e prazos gerados pelo sistema são estimativos e devem ser conferidos por profissional habilitado.</div>
  </div>
  <script>window.onload=()=>window.print()<\/script>
</body></html>`)
  win.document.close()
}

export default function SuportePage() {
  const [open, setOpen] = useState(null)   // FAQ aberta

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-500/15 to-transparent border border-brand-500/20 p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Suporte & Manual</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Tudo sobre o sistema, explicado em detalhes, e perguntas frequentes.</p>
        </div>
        <Button variant="primary" onClick={baixarManual}>📄 Baixar Manual (PDF)</Button>
      </div>

      {/* Módulos */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Como funciona cada parte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SECOES.map((s, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{s.icone}</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{s.titulo}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{s.resumo}</p>
                </div>
              </div>
              <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
                {s.itens.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Perguntas frequentes</h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <Card key={i} className="p-0 overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <span className="text-sm font-medium text-[var(--text-primary)]">{f.q}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[var(--text-muted)] transition-transform ${open === i ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {open === i && <p className="px-4 pb-3 text-sm text-[var(--text-secondary)]">{f.a}</p>}
            </Card>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-muted)] pt-2">Precisa de mais ajuda? Fale com o administrador do sistema.</p>
    </div>
  )
}
