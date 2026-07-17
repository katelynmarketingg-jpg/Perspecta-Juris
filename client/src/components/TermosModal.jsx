import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'

// Termo de Uso e Responsabilidade — MODELO. Revise com um(a) advogado(a)
// antes de usar em produção. Aparece no 1º acesso de cada escritório.
export const TERMOS_VERSAO = '1.0'
export const TERMOS_TEXTO = `TERMO DE USO, ASSINATURA E RESPONSABILIDADE — PERSPECTA JURIS

Ao acessar e utilizar a plataforma Perspecta Juris ("Plataforma"), o escritório/usuário ("Contratante") declara que leu, compreendeu e concorda com as condições abaixo.

1. OBJETO
A Plataforma é um sistema de gestão para escritórios de advocacia (clientes, processos, prazos, financeiro, documentos e ferramentas correlatas). É uma ferramenta de organização — não substitui a análise, a decisão e a responsabilidade profissional do(a) advogado(a).

2. CONTA E ACESSO
2.1. O Contratante é o único responsável pela guarda de seus logins e senhas e por todas as ações praticadas em sua conta.
2.2. Cada escritório é responsável pelos usuários (colaboradores) que cadastra e pelos acessos que concede.

3. PAGAMENTO E ASSINATURA
3.1. O uso da Plataforma pode estar sujeito a plano/assinatura, conforme condições comerciais informadas no ato da contratação.
3.2. Os valores, a periodicidade e a forma de cobrança são os vigentes na contratação; o não pagamento pode acarretar suspensão ou encerramento do acesso, sem prejuízo dos valores devidos.
3.3. Recursos de cobrança de terceiros (ex.: boletos, PIX e links de pagamento gerados via integrações) são operados pelas respectivas instituições/gateways; a Plataforma apenas intermedeia a emissão e não é parte na relação financeira entre o escritório e seus clientes.
3.4. Cálculos, valores de honorários, juros, multas, correção e estimativas exibidos são apoios de trabalho e devem ser conferidos pelo Contratante; a Plataforma não garante exatidão para fins de cobrança ou processo.

4. DADOS E LGPD
4.1. Cada escritório é o Controlador dos dados de seus clientes e responsável pela base legal, finalidade e tratamento desses dados (Lei 13.709/2018 - LGPD).
4.2. A Plataforma atua como Operadora, tratando os dados conforme as instruções do Contratante e as finalidades do serviço.
4.3. O Contratante é responsável por obter os consentimentos necessários e por manter seus dados corretos e atualizados.

5. ASSINATURA ELETRÔNICA
5.1. As assinaturas eletrônicas coletadas pela Plataforma têm natureza de assinatura eletrônica (MP 2.200-2/2001 e Lei 14.063/2020) e valem entre as partes signatárias.
5.2. A validade e a força probatória em cada caso dependem do conjunto de evidências e do tipo de ato; para atos que exijam assinatura qualificada (ICP-Brasil), o Contratante deve utilizar o meio adequado.

6. LIMITAÇÃO DE RESPONSABILIDADE
6.1. A Plataforma é fornecida "no estado em que se encontra". Na máxima extensão permitida em lei, não nos responsabilizamos por perdas, prazos perdidos, decisões, danos diretos ou indiretos decorrentes do uso ou da indisponibilidade do serviço.
6.2. É dever do Contratante manter cópias/backups e conferir prazos e informações nos sistemas oficiais dos tribunais.

7. DISPONIBILIDADE
Podemos atualizar, alterar ou interromper funcionalidades para manutenção e evolução, buscando o menor impacto possível.

8. ACEITE
O aceite deste Termo é registrado com data/hora e usuário. O uso continuado implica concordância com eventuais atualizações.

Ao clicar em "Li e aceito", o Contratante concorda com este Termo.`

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }

export function precisaAceitarTermos(user) {
  if (!user?.id || user.role === 'master') return false
  const rec = lsGet(`pj_termos_${user.id}`, null)
  return !rec || rec.versao !== TERMOS_VERSAO
}

export default function TermosModal({ onAccept }) {
  const user = useAuthStore(s => s.user)
  const [lido, setLido] = useState(false)

  const aceitar = () => {
    localStorage.setItem(`pj_termos_${user?.id}`, JSON.stringify({ versao: TERMOS_VERSAO, aceitoEm: new Date().toISOString(), usuario: user?.name }))
    onAccept?.()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[88vh]">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">📜 Termos de Uso e Responsabilidade</p>
          <p className="text-[11px] text-[var(--text-muted)]">Leia e aceite para continuar · versão {TERMOS_VERSAO}</p>
        </div>
        <div className="p-5 overflow-y-auto flex-1"
          onScroll={e => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setLido(true) }}>
          <pre className="text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap" style={{ fontFamily: 'inherit' }}>{TERMOS_TEXTO}</pre>
        </div>
        <div className="px-5 py-4 border-t border-[var(--border)] space-y-2">
          <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={lido} onChange={e => setLido(e.target.checked)} className="mt-0.5 accent-brand-500" />
            Li e aceito os Termos de Uso e a Política de Responsabilidade acima.
          </label>
          <div className="flex justify-end">
            <button onClick={aceitar} disabled={!lido} className="btn-primary text-sm disabled:opacity-50">Li e aceito · continuar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
