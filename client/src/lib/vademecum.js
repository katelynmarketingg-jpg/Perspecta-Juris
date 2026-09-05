// ─────────────────────────────────────────────────────────────────────────
//  Vade Mecum — índice remissivo.
//
//  A busca antiga casava PEDAÇO de palavra: digitar "m" trazia "casaMento",
//  "aliMentos" e mais meia dúzia, porque `keyword.includes("m")` é verdadeiro
//  em quase tudo. E não normalizava acento, então "divorcio" e "divórcio"
//  achavam coisas diferentes.
//
//  Aqui a busca é por PALAVRA, sem acento, com pontuação por relevância. E o
//  índice cresceu de 51 para ~200 temas — sem "maus-tratos" na lista, buscar
//  "maus-tratos" não achava nada, por melhor que fosse o algoritmo.
// ─────────────────────────────────────────────────────────────────────────

const P = 'http://www.planalto.gov.br/ccivil_03'

export const VADE = [
  { sigla: 'CF/88', nome: 'Constituição Federal de 1988', cat: 'Constituição', url: `${P}/constituicao/constituicao.htm`,
    resumo: 'Direitos fundamentais, organização do Estado, ordem social e tributária.', kw: ['constituicao', 'direitos fundamentais', 'garantias'] },
  { sigla: 'CC', nome: 'Código Civil (Lei 10.406/2002)', cat: 'Códigos', url: `${P}/leis/2002/l10406compilada.htm`,
    resumo: 'Pessoas, bens, obrigações, contratos, responsabilidade civil, coisas, família e sucessões.', kw: ['civil', 'contratos', 'familia', 'sucessoes', 'obrigacoes'] },
  { sigla: 'CPC', nome: 'Código de Processo Civil (Lei 13.105/2015)', cat: 'Códigos', url: `${P}/_ato2015-2018/2015/lei/l13105.htm`,
    resumo: 'Processo de conhecimento, cumprimento de sentença, execução, recursos e procedimentos especiais.', kw: ['processo civil', 'recurso', 'execucao', 'prazo'] },
  { sigla: 'CP', nome: 'Código Penal (Dec-Lei 2.848/1940)', cat: 'Códigos', url: `${P}/decreto-lei/del2848compilado.htm`,
    resumo: 'Parte geral (pena, culpabilidade, prescrição) e todos os crimes em espécie.', kw: ['penal', 'crime', 'pena', 'delito'] },
  { sigla: 'CPP', nome: 'Código de Processo Penal (Dec-Lei 3.689/1941)', cat: 'Códigos', url: `${P}/decreto-lei/del3689compilado.htm`,
    resumo: 'Inquérito, ação penal, provas, prisões, procedimentos, júri, nulidades e recursos.', kw: ['processo penal', 'prisao', 'inquerito', 'juri'] },
  { sigla: 'CLT', nome: 'CLT (Dec-Lei 5.452/1943)', cat: 'Códigos', url: `${P}/decreto-lei/del5452compilado.htm`,
    resumo: 'Contrato de trabalho, jornada, férias, rescisão, segurança do trabalho e processo do trabalho.', kw: ['trabalho', 'trabalhista', 'emprego'] },
  { sigla: 'CDC', nome: 'Código de Defesa do Consumidor (Lei 8.078/1990)', cat: 'Códigos', url: `${P}/leis/l8078compilado.htm`,
    resumo: 'Direitos básicos, vícios e defeitos, práticas abusivas, cobrança indevida e cláusulas nulas.', kw: ['consumidor', 'fornecedor'] },
  { sigla: 'CTN', nome: 'Código Tributário Nacional (Lei 5.172/1966)', cat: 'Códigos', url: `${P}/leis/l5172compilado.htm`,
    resumo: 'Competência, obrigação, lançamento, crédito, prescrição e decadência tributárias.', kw: ['tributario', 'imposto', 'tributo'] },
  { sigla: 'CTB', nome: 'Código de Trânsito (Lei 9.503/1997)', cat: 'Códigos', url: `${P}/leis/l9503.htm`,
    resumo: 'Infrações, penalidades, CNH, e os crimes de trânsito.', kw: ['transito', 'multa', 'cnh', 'veiculo'] },
  { sigla: 'ECA', nome: 'Estatuto da Criança e do Adolescente (Lei 8.069/1990)', cat: 'Estatutos', url: `${P}/leis/l8069.htm`,
    resumo: 'Proteção integral, guarda, adoção, ato infracional e crimes contra crianças.', kw: ['crianca', 'adolescente', 'menor', 'infracional'] },
  { sigla: 'Idoso', nome: 'Estatuto da Pessoa Idosa (Lei 10.741/2003)', cat: 'Estatutos', url: `${P}/leis/2003/l10.741.htm`,
    resumo: 'Direitos da pessoa idosa e crimes praticados contra ela.', kw: ['idoso', 'terceira idade'] },
  { sigla: 'OAB', nome: 'Estatuto da OAB (Lei 8.906/1994)', cat: 'Estatutos', url: `${P}/leis/l8906.htm`,
    resumo: 'Atividade e prerrogativas do advogado, honorários, ética e processo disciplinar.', kw: ['oab', 'advogado', 'honorarios', 'prerrogativas'] },
  { sigla: 'EPD', nome: 'Estatuto da Pessoa com Deficiência (Lei 13.146/2015)', cat: 'Estatutos', url: `${P}/_ato2015-2018/2015/lei/l13146.htm`,
    resumo: 'Acessibilidade, capacidade civil, tomada de decisão apoiada e curatela.', kw: ['deficiencia', 'acessibilidade', 'curatela'] },
  { sigla: 'LINDB', nome: 'LINDB (Dec-Lei 4.657/1942)', cat: 'Leis', url: `${P}/decreto-lei/del4657compilado.htm`,
    resumo: 'Vigência da lei, direito intertemporal e aplicação do direito estrangeiro.', kw: ['lindb', 'vigencia', 'irretroatividade'] },
  { sigla: 'Locação', nome: 'Lei do Inquilinato (Lei 8.245/1991)', cat: 'Leis', url: `${P}/leis/l8245.htm`,
    resumo: 'Locação residencial e comercial, reajuste, despejo, renovatória e garantias.', kw: ['locacao', 'aluguel', 'despejo', 'inquilino', 'fiador'] },
  { sigla: 'JEC', nome: 'Juizados Especiais (Lei 9.099/1995)', cat: 'Leis', url: `${P}/leis/l9099.htm`,
    resumo: 'Pequenas causas cíveis e infrações de menor potencial ofensivo, transação e suspensão do processo.', kw: ['juizado', 'pequenas causas', 'transacao penal', 'sursis processual'] },
  { sigla: 'MariaPenha', nome: 'Lei Maria da Penha (Lei 11.340/2006)', cat: 'Leis', url: `${P}/_ato2004-2006/2006/lei/l11340.htm`,
    resumo: 'Violência doméstica e familiar contra a mulher e medidas protetivas de urgência.', kw: ['violencia domestica', 'mulher', 'medida protetiva'] },
  { sigla: 'Drogas', nome: 'Lei de Drogas (Lei 11.343/2006)', cat: 'Leis', url: `${P}/_ato2004-2006/2006/lei/l11343.htm`,
    resumo: 'Porte para consumo, tráfico, associação e o procedimento penal próprio.', kw: ['drogas', 'trafico', 'entorpecente'] },
  { sigla: 'LEP', nome: 'Lei de Execução Penal (Lei 7.210/1984)', cat: 'Leis', url: `${P}/leis/l7210.htm`,
    resumo: 'Regimes, progressão, remição, livramento condicional, faltas e direitos do preso.', kw: ['execucao penal', 'regime', 'preso', 'progressao'] },
  { sigla: 'L8213', nome: 'Benefícios da Previdência (Lei 8.213/1991)', cat: 'Leis', url: `${P}/leis/l8213cons.htm`,
    resumo: 'Segurados, carência, aposentadorias, auxílios, pensão por morte e cálculo do benefício.', kw: ['previdencia', 'aposentadoria', 'inss', 'beneficio'] },
  { sigla: 'L8212', nome: 'Custeio da Previdência (Lei 8.212/1991)', cat: 'Leis', url: `${P}/leis/l8212cons.htm`,
    resumo: 'Contribuições, salário de contribuição e o que não integra a base.', kw: ['custeio', 'contribuicao', 'salario de contribuicao'] },
  { sigla: 'Alimentos', nome: 'Lei de Alimentos (Lei 5.478/1968)', cat: 'Leis', url: `${P}/leis/l5478.htm`,
    resumo: 'Rito especial da ação de alimentos.', kw: ['alimentos', 'pensao'] },
  { sigla: 'LGPD', nome: 'LGPD (Lei 13.709/2018)', cat: 'Leis', url: `${P}/_ato2015-2018/2018/lei/l13709.htm`,
    resumo: 'Tratamento de dados pessoais, bases legais, direitos do titular e sanções.', kw: ['dados', 'privacidade', 'lgpd'] },
  { sigla: 'MS', nome: 'Mandado de Segurança (Lei 12.016/2009)', cat: 'Leis', url: `${P}/_ato2007-2010/2009/lei/l12016.htm`,
    resumo: 'Mandado de segurança individual e coletivo, liminar e prazo decadencial.', kw: ['mandado de seguranca', 'liminar'] },
  { sigla: 'Improbidade', nome: 'Improbidade Administrativa (Lei 8.429/1992)', cat: 'Leis', url: `${P}/leis/l8429.htm`,
    resumo: 'Atos de improbidade, sanções e o procedimento da ação.', kw: ['improbidade', 'administrativa'] },
  { sigla: 'Licitações', nome: 'Licitações e Contratos (Lei 14.133/2021)', cat: 'Leis', url: `${P}/_ato2019-2022/2021/lei/l14133.htm`,
    resumo: 'Modalidades, contratação direta, contratos administrativos e sanções.', kw: ['licitacao', 'contrato administrativo', 'pregao'] },
  { sigla: 'Falência', nome: 'Recuperação e Falência (Lei 11.101/2005)', cat: 'Leis', url: `${P}/_ato2004-2006/2005/lei/l11101.htm`,
    resumo: 'Recuperação judicial e extrajudicial, falência e crimes falimentares.', kw: ['falencia', 'recuperacao judicial'] },
  { sigla: 'Registros', nome: 'Registros Públicos (Lei 6.015/1973)', cat: 'Leis', url: `${P}/leis/l6015compilada.htm`,
    resumo: 'Registro civil, de imóveis, de títulos e documentos; retificações.', kw: ['registro', 'cartorio', 'matricula', 'averbacao'] },
  { sigla: 'Organização', nome: 'Organização Criminosa (Lei 12.850/2013)', cat: 'Leis', url: `${P}/_ato2011-2014/2013/lei/l12850.htm`,
    resumo: 'Organização criminosa, colaboração premiada e meios de obtenção de prova.', kw: ['organizacao criminosa', 'colaboracao premiada', 'delacao'] },
  { sigla: 'Hediondos', nome: 'Crimes Hediondos (Lei 8.072/1990)', cat: 'Leis', url: `${P}/leis/l8072.htm`,
    resumo: 'Rol de crimes hediondos e o regime mais severo.', kw: ['hediondo', 'hediondos'] },
  { sigla: 'Tortura', nome: 'Lei de Tortura (Lei 9.455/1997)', cat: 'Leis', url: `${P}/leis/l9455.htm`,
    resumo: 'Crime de tortura e suas formas qualificadas.', kw: ['tortura'] },
  { sigla: 'Armas', nome: 'Estatuto do Desarmamento (Lei 10.826/2003)', cat: 'Leis', url: `${P}/leis/2003/l10.826.htm`,
    resumo: 'Posse, porte e comércio de arma de fogo; crimes correlatos.', kw: ['arma', 'desarmamento', 'porte de arma'] },
  { sigla: 'Lavagem', nome: 'Lavagem de Dinheiro (Lei 9.613/1998)', cat: 'Leis', url: `${P}/leis/l9613.htm`,
    resumo: 'Ocultação de bens e valores, e o COAF.', kw: ['lavagem de dinheiro', 'ocultacao'] },
  { sigla: 'Ambiental', nome: 'Crimes Ambientais (Lei 9.605/1998)', cat: 'Leis', url: `${P}/leis/l9605.htm`,
    resumo: 'Crimes contra a fauna, flora, poluição e o patrimônio cultural.', kw: ['ambiental', 'meio ambiente', 'poluicao'] },
  { sigla: 'Abuso', nome: 'Abuso de Autoridade (Lei 13.869/2019)', cat: 'Leis', url: `${P}/_ato2019-2022/2019/lei/l13869.htm`,
    resumo: 'Crimes de abuso de autoridade praticados por agentes públicos.', kw: ['abuso de autoridade'] },
  { sigla: 'Racismo', nome: 'Crimes de Racismo (Lei 7.716/1989)', cat: 'Leis', url: `${P}/leis/l7716.htm`,
    resumo: 'Crimes resultantes de discriminação de raça, cor, etnia, religião ou procedência.', kw: ['racismo', 'injuria racial', 'discriminacao'] },
  { sigla: 'Interceptação', nome: 'Interceptação Telefônica (Lei 9.296/1996)', cat: 'Leis', url: `${P}/leis/l9296.htm`,
    resumo: 'Requisitos e procedimento da interceptação de comunicações.', kw: ['interceptacao', 'escuta', 'grampo'] },
  { sigla: 'Sonegação', nome: 'Crimes Tributários (Lei 8.137/1990)', cat: 'Leis', url: `${P}/leis/l8137.htm`,
    resumo: 'Crimes contra a ordem tributária, econômica e as relações de consumo.', kw: ['sonegacao', 'crime tributario', 'ordem tributaria'] },
  { sigla: 'Usura', nome: 'Lei da Usura (Dec. 22.626/1933)', cat: 'Leis', url: `${P}/decreto/d22626.htm`,
    resumo: 'Limite de juros e vedação do anatocismo.', kw: ['usura', 'juros', 'anatocismo'] },
  { sigla: 'Arbitragem', nome: 'Lei de Arbitragem (Lei 9.307/1996)', cat: 'Leis', url: `${P}/leis/l9307.htm`,
    resumo: 'Convenção de arbitragem, árbitros e sentença arbitral.', kw: ['arbitragem', 'arbitral'] },
]

export const COD = Object.fromEntries(VADE.map(v => [v.sigla, v.url]))
export const CATS = ['Constituição', 'Códigos', 'Estatutos', 'Leis']

// ── Índice remissivo ──────────────────────────────────────────────────────
// refs = [sigla, "arts. X a Y", "ementa", artigoParaÂncora]
// A âncora leva direto ao artigo no site do Planalto, em vez de abrir o código
// inteiro e deixar a pessoa procurar com Ctrl+F.
export const INDICE = [
  // ─────────────── FAMÍLIA ───────────────
  { tema: 'Divórcio', kw: ['divorcio', 'dissolucao do casamento', 'separacao'], refs: [['CC', 'arts. 1.571 a 1.582', 'Dissolução da sociedade e do vínculo conjugal', 1571], ['CPC', 'arts. 731 a 734', 'Divórcio e separação consensuais', 731]] },
  { tema: 'Casamento', kw: ['casamento', 'habilitacao', 'impedimentos', 'nubentes'], refs: [['CC', 'arts. 1.511 a 1.570', 'Do casamento', 1511]] },
  { tema: 'União estável', kw: ['uniao estavel', 'concubinato', 'companheiro', 'convivente'], refs: [['CC', 'arts. 1.723 a 1.727', 'Da união estável', 1723]] },
  { tema: 'Pensão alimentícia', kw: ['alimentos', 'pensao', 'pensao alimenticia', 'alimentante', 'alimentando'], refs: [['CC', 'arts. 1.694 a 1.710', 'Dos alimentos', 1694], ['Alimentos', 'Lei 5.478/68', 'Ação de alimentos (rito)', 1], ['CPC', 'arts. 528 a 533', 'Execução de alimentos e prisão civil', 528]] },
  { tema: 'Guarda dos filhos', kw: ['guarda', 'guarda compartilhada', 'visitas', 'convivencia'], refs: [['CC', 'arts. 1.583 a 1.590', 'Da proteção dos filhos / guarda', 1583]] },
  { tema: 'Poder familiar', kw: ['poder familiar', 'patrio poder', 'destituicao', 'suspensao do poder familiar'], refs: [['CC', 'arts. 1.630 a 1.638', 'Do poder familiar', 1630], ['ECA', 'arts. 155 a 163', 'Perda e suspensão do poder familiar', 155]] },
  { tema: 'Regime de bens', kw: ['regime de bens', 'comunhao parcial', 'comunhao universal', 'separacao de bens', 'participacao final', 'pacto antenupcial'], refs: [['CC', 'arts. 1.639 a 1.688', 'Do regime de bens entre os cônjuges', 1639]] },
  { tema: 'Alienação parental', kw: ['alienacao parental', 'sindrome da alienacao'], refs: [['CC', 'art. 1.584', 'Guarda e convivência', 1584]] },
  { tema: 'Reconhecimento de paternidade', kw: ['paternidade', 'filiacao', 'investigacao de paternidade', 'dna', 'socioafetiva'], refs: [['CC', 'arts. 1.596 a 1.617', 'Da filiação e do reconhecimento dos filhos', 1596]] },
  { tema: 'Adoção', kw: ['adocao', 'adotante', 'adotando'], refs: [['ECA', 'arts. 39 a 52', 'Da adoção', 39], ['CC', 'arts. 1.618 a 1.619', 'Da adoção', 1618]] },
  { tema: 'Tutela e curatela', kw: ['tutela', 'curatela', 'curador', 'interdicao'], refs: [['CC', 'arts. 1.728 a 1.783', 'Da tutela e da curatela', 1728], ['EPD', 'arts. 84 a 87', 'Curatela e tomada de decisão apoiada', 84]] },
  { tema: 'Bem de família', kw: ['bem de familia', 'impenhorabilidade do imovel'], refs: [['CC', 'arts. 1.711 a 1.722', 'Do bem de família', 1711]] },

  // ─────────────── SUCESSÕES ───────────────
  { tema: 'Inventário e herança', kw: ['inventario', 'heranca', 'herdeiro', 'espolio', 'partilha', 'sucessao'], refs: [['CC', 'arts. 1.784 a 2.027', 'Do direito das sucessões', 1784], ['CPC', 'arts. 610 a 673', 'Inventário e partilha', 610]] },
  { tema: 'Testamento', kw: ['testamento', 'testador', 'legado', 'codicilo'], refs: [['CC', 'arts. 1.857 a 1.990', 'Da sucessão testamentária', 1857]] },
  { tema: 'Legítima e herdeiros necessários', kw: ['legitima', 'herdeiro necessario', 'reducao das disposicoes'], refs: [['CC', 'arts. 1.845 a 1.850', 'Dos herdeiros necessários', 1845]] },
  { tema: 'Deserdação e indignidade', kw: ['deserdacao', 'indignidade', 'exclusao da heranca'], refs: [['CC', 'arts. 1.814 a 1.818', 'Dos excluídos da sucessão', 1814], ['CC', 'arts. 1.961 a 1.965', 'Da deserdação', 1961]] },

  // ─────────────── OBRIGAÇÕES E CONTRATOS ───────────────
  { tema: 'Contratos em geral', kw: ['contrato', 'contratos', 'pacta sunt servanda', 'boa-fe objetiva'], refs: [['CC', 'arts. 421 a 480', 'Dos contratos em geral', 421]] },
  { tema: 'Compra e venda', kw: ['compra e venda', 'comprador', 'vendedor', 'arras', 'sinal'], refs: [['CC', 'arts. 481 a 532', 'Da compra e venda', 481]] },
  { tema: 'Vícios redibitórios', kw: ['vicio redibitorio', 'redibitoria', 'defeito oculto'], refs: [['CC', 'arts. 441 a 446', 'Dos vícios redibitórios', 441]] },
  { tema: 'Evicção', kw: ['eviccao', 'evicto'], refs: [['CC', 'arts. 447 a 457', 'Da evicção', 447]] },
  { tema: 'Juros e correção', kw: ['juros', 'juros de mora', 'correcao monetaria', 'anatocismo', 'mora'], refs: [['CC', 'arts. 394 a 401', 'Da mora', 394], ['CC', 'arts. 406 a 407', 'Dos juros legais', 406], ['Usura', 'Dec. 22.626/33', 'Limite de juros e anatocismo', 1]] },
  { tema: 'Cláusula penal e multa', kw: ['clausula penal', 'multa contratual', 'penalidade'], refs: [['CC', 'arts. 408 a 416', 'Da cláusula penal', 408]] },
  { tema: 'Prescrição e decadência', kw: ['prescricao', 'decadencia', 'prazo prescricional'], refs: [['CC', 'arts. 189 a 211', 'Da prescrição e da decadência', 189]] },
  { tema: 'Responsabilidade civil', kw: ['responsabilidade civil', 'ato ilicito', 'indenizacao', 'dano', 'culpa'], refs: [['CC', 'arts. 186 a 188', 'Dos atos ilícitos', 186], ['CC', 'arts. 927 a 954', 'Da responsabilidade civil', 927]] },
  { tema: 'Dano moral', kw: ['dano moral', 'abalo moral', 'honra', 'dano extrapatrimonial'], refs: [['CF/88', 'art. 5º, V e X', 'Indenização por dano moral e à imagem', 5], ['CC', 'arts. 186 e 927', 'Ato ilícito e dever de indenizar', 186], ['CLT', 'arts. 223-A a 223-G', 'Dano extrapatrimonial trabalhista', 223]] },
  { tema: 'Enriquecimento sem causa', kw: ['enriquecimento sem causa', 'enriquecimento ilicito', 'repeticao do indebito'], refs: [['CC', 'arts. 884 a 886', 'Do enriquecimento sem causa', 884]] },
  { tema: 'Fiança e aval', kw: ['fianca', 'fiador', 'aval', 'avalista'], refs: [['CC', 'arts. 818 a 839', 'Da fiança', 818]] },
  { tema: 'Doação', kw: ['doacao', 'doador', 'donatario', 'revogacao da doacao'], refs: [['CC', 'arts. 538 a 564', 'Da doação', 538]] },
  { tema: 'Seguro', kw: ['seguro', 'segurado', 'seguradora', 'sinistro', 'apolice'], refs: [['CC', 'arts. 757 a 802', 'Do seguro', 757]] },
  { tema: 'Prestação de serviços e empreitada', kw: ['prestacao de servicos', 'empreitada', 'empreiteiro'], refs: [['CC', 'arts. 593 a 609', 'Da prestação de serviço', 593], ['CC', 'arts. 610 a 626', 'Da empreitada', 610]] },

  // ─────────────── COISAS / IMOBILIÁRIO ───────────────
  { tema: 'Usucapião', kw: ['usucapiao', 'prescricao aquisitiva', 'posse mansa'], refs: [['CC', 'arts. 1.238 a 1.244', 'Da usucapião', 1238], ['CF/88', 'arts. 183 e 191', 'Usucapião urbana e rural', 183], ['CPC', 'art. 216-A', 'Usucapião extrajudicial', 216]] },
  { tema: 'Posse', kw: ['posse', 'possuidor', 'esbulho', 'turbacao', 'reintegracao de posse', 'interdito'], refs: [['CC', 'arts. 1.196 a 1.224', 'Da posse', 1196], ['CPC', 'arts. 554 a 568', 'Das ações possessórias', 554]] },
  { tema: 'Propriedade', kw: ['propriedade', 'dominio', 'reivindicatoria'], refs: [['CC', 'arts. 1.228 a 1.276', 'Da propriedade', 1228]] },
  { tema: 'Condomínio', kw: ['condominio', 'condomino', 'assembleia', 'taxa condominial', 'sindico'], refs: [['CC', 'arts. 1.314 a 1.358', 'Do condomínio', 1314]] },
  { tema: 'Hipoteca e penhor', kw: ['hipoteca', 'penhor', 'anticrese', 'garantia real'], refs: [['CC', 'arts. 1.419 a 1.510', 'Dos direitos reais de garantia', 1419]] },
  { tema: 'Alienação fiduciária', kw: ['alienacao fiduciaria', 'busca e apreensao', 'fiducia'], refs: [['CC', 'arts. 1.361 a 1.368', 'Da propriedade fiduciária', 1361]] },
  { tema: 'Locação e despejo', kw: ['locacao', 'aluguel', 'despejo', 'inquilino', 'locador', 'locatario', 'renovatoria'], refs: [['Locação', 'Lei 8.245/91', 'Locação urbana, despejo e renovatória', 1]] },

  // ─────────────── PROCESSO CIVIL ───────────────
  { tema: 'Prazos processuais', kw: ['prazo', 'prazos', 'dias uteis', 'preclusao', 'tempestividade'], refs: [['CPC', 'arts. 218 a 235', 'Dos prazos', 218], ['CPC', 'art. 219', 'Contagem em dias úteis', 219]] },
  { tema: 'Petição inicial', kw: ['peticao inicial', 'inicial', 'inepcia', 'emenda da inicial'], refs: [['CPC', 'arts. 319 a 331', 'Da petição inicial', 319]] },
  { tema: 'Contestação e revelia', kw: ['contestacao', 'revelia', 'defesa', 'preliminares'], refs: [['CPC', 'arts. 335 a 346', 'Da contestação e da revelia', 335]] },
  { tema: 'Tutela de urgência e liminar', kw: ['tutela de urgencia', 'liminar', 'antecipacao de tutela', 'cautelar', 'tutela provisoria'], refs: [['CPC', 'arts. 294 a 311', 'Da tutela provisória', 294]] },
  { tema: 'Recursos', kw: ['recurso', 'apelacao', 'agravo', 'embargos de declaracao', 'recurso especial', 'recurso extraordinario'], refs: [['CPC', 'arts. 994 a 1.044', 'Dos recursos', 994]] },
  { tema: 'Cumprimento de sentença', kw: ['cumprimento de sentenca', 'execucao de titulo judicial', 'multa de 10%'], refs: [['CPC', 'arts. 513 a 538', 'Do cumprimento de sentença', 513], ['CPC', 'art. 523', 'Multa e honorários de 10%', 523]] },
  { tema: 'Execução e penhora', kw: ['execucao', 'penhora', 'impenhorabilidade', 'embargos a execucao', 'titulo executivo'], refs: [['CPC', 'arts. 771 a 925', 'Do processo de execução', 771], ['CPC', 'art. 833', 'Bens impenhoráveis', 833]] },
  { tema: 'Honorários sucumbenciais', kw: ['honorarios', 'sucumbencia', 'honorarios sucumbenciais'], refs: [['CPC', 'art. 85', 'Dos honorários advocatícios', 85], ['OAB', 'arts. 22 a 26', 'Honorários do advogado', 22]] },
  { tema: 'Justiça gratuita', kw: ['justica gratuita', 'gratuidade', 'assistencia judiciaria', 'hipossuficiente'], refs: [['CPC', 'arts. 98 a 102', 'Da gratuidade da justiça', 98]] },
  { tema: 'Provas', kw: ['prova', 'provas', 'onus da prova', 'pericia', 'testemunha', 'depoimento pessoal'], refs: [['CPC', 'arts. 369 a 484', 'Das provas', 369], ['CPC', 'art. 373', 'Ônus da prova', 373]] },
  { tema: 'Competência', kw: ['competencia', 'foro', 'conflito de competencia', 'incompetencia'], refs: [['CPC', 'arts. 42 a 66', 'Da competência interna', 42]] },
  { tema: 'Litisconsórcio e intervenção de terceiros', kw: ['litisconsorcio', 'intervencao de terceiros', 'denunciacao da lide', 'chamamento ao processo', 'assistencia'], refs: [['CPC', 'arts. 113 a 138', 'Litisconsórcio e intervenção de terceiros', 113]] },
  { tema: 'Coisa julgada', kw: ['coisa julgada', 'transito em julgado', 'acao rescisoria'], refs: [['CPC', 'arts. 502 a 508', 'Da coisa julgada', 502], ['CPC', 'arts. 966 a 975', 'Da ação rescisória', 966]] },

  // ─────────────── PENAL — PARTE GERAL ───────────────
  { tema: 'Aplicação da pena (dosimetria)', kw: ['dosimetria', 'aplicacao da pena', 'pena-base', 'circunstancias judiciais', 'trifasico'], refs: [['CP', 'arts. 59 a 76', 'Da aplicação da pena', 59], ['CP', 'art. 68', 'Sistema trifásico', 68]] },
  { tema: 'Agravantes e atenuantes', kw: ['agravante', 'atenuante', 'reincidencia', 'confissao espontanea'], refs: [['CP', 'arts. 61 a 67', 'Circunstâncias agravantes e atenuantes', 61]] },
  { tema: 'Prescrição penal', kw: ['prescricao penal', 'prescricao da pretensao punitiva', 'prescricao retroativa', 'extincao da punibilidade'], refs: [['CP', 'arts. 107 a 120', 'Da extinção da punibilidade', 107], ['CP', 'arts. 109 a 110', 'Prescrição', 109]] },
  { tema: 'Legítima defesa e excludentes', kw: ['legitima defesa', 'estado de necessidade', 'excludente de ilicitude', 'estrito cumprimento do dever'], refs: [['CP', 'arts. 23 a 25', 'Exclusão de ilicitude', 23]] },
  { tema: 'Tentativa e desistência', kw: ['tentativa', 'desistencia voluntaria', 'arrependimento eficaz', 'arrependimento posterior', 'crime impossivel'], refs: [['CP', 'arts. 14 a 17', 'Tentativa, desistência e arrependimento', 14]] },
  { tema: 'Concurso de pessoas', kw: ['concurso de pessoas', 'coautoria', 'participacao', 'autoria'], refs: [['CP', 'arts. 29 a 31', 'Do concurso de pessoas', 29]] },
  { tema: 'Concurso de crimes', kw: ['concurso material', 'concurso formal', 'crime continuado', 'continuidade delitiva'], refs: [['CP', 'arts. 69 a 72', 'Do concurso de crimes', 69]] },
  { tema: 'Regime de cumprimento de pena', kw: ['regime', 'regime fechado', 'semiaberto', 'aberto', 'progressao de regime'], refs: [['CP', 'arts. 33 a 42', 'Das penas privativas de liberdade', 33], ['LEP', 'art. 112', 'Progressão de regime', 112]] },
  { tema: 'Penas restritivas de direitos', kw: ['pena restritiva', 'substituicao da pena', 'prestacao de servicos a comunidade'], refs: [['CP', 'arts. 43 a 48', 'Das penas restritivas de direitos', 43]] },
  { tema: 'Sursis e livramento condicional', kw: ['sursis', 'suspensao condicional da pena', 'livramento condicional'], refs: [['CP', 'arts. 77 a 82', 'Suspensão condicional da pena', 77], ['CP', 'arts. 83 a 90', 'Livramento condicional', 83]] },
  { tema: 'Inimputabilidade e medida de segurança', kw: ['inimputavel', 'semi-imputavel', 'medida de seguranca', 'doenca mental'], refs: [['CP', 'arts. 26 a 28', 'Da imputabilidade penal', 26], ['CP', 'arts. 96 a 99', 'Das medidas de segurança', 96]] },

  // ─────────────── PENAL — CRIMES EM ESPÉCIE ───────────────
  { tema: 'Homicídio', kw: ['homicidio', 'matar alguem', 'feminicidio', 'homicidio qualificado', 'homicidio culposo'], refs: [['CP', 'art. 121', 'Homicídio simples, qualificado, culposo e feminicídio', 121], ['Hediondos', 'Lei 8.072/90', 'Homicídio qualificado é hediondo', 1]] },
  { tema: 'Lesão corporal', kw: ['lesao corporal', 'lesao', 'agressao', 'violencia domestica'], refs: [['CP', 'art. 129', 'Lesão corporal e a forma de violência doméstica (§9º)', 129]] },
  { tema: 'Maus-tratos', kw: ['maus-tratos', 'maus tratos', 'expor a perigo', 'abuso de meios de correcao'], refs: [['CP', 'art. 136', 'Maus-tratos', 136], ['ECA', 'art. 232', 'Submeter criança a vexame', 232], ['Idoso', 'art. 99', 'Expor a perigo a integridade da pessoa idosa', 99]] },
  { tema: 'Abandono de incapaz', kw: ['abandono de incapaz', 'abandono material', 'abandono intelectual'], refs: [['CP', 'arts. 133 a 134', 'Abandono de incapaz e exposição de recém-nascido', 133], ['CP', 'arts. 244 a 246', 'Abandono material e intelectual', 244]] },
  { tema: 'Ameaça', kw: ['ameaca', 'ameacar'], refs: [['CP', 'art. 147', 'Ameaça', 147], ['CP', 'art. 147-A', 'Perseguição (stalking)', 147]] },
  { tema: 'Perseguição (stalking)', kw: ['perseguicao', 'stalking', 'importunacao'], refs: [['CP', 'art. 147-A', 'Perseguição', 147], ['CP', 'art. 215-A', 'Importunação sexual', 215]] },
  { tema: 'Calúnia, difamação e injúria', kw: ['calunia', 'difamacao', 'injuria', 'crimes contra a honra', 'injuria racial'], refs: [['CP', 'arts. 138 a 145', 'Dos crimes contra a honra', 138], ['CP', 'art. 140, §3º', 'Injúria racial', 140], ['Racismo', 'Lei 7.716/89', 'Crimes de racismo', 1]] },
  { tema: 'Furto', kw: ['furto', 'subtrair coisa alheia', 'furto qualificado', 'furto privilegiado'], refs: [['CP', 'arts. 155 a 156', 'Do furto', 155]] },
  { tema: 'Roubo e extorsão', kw: ['roubo', 'latrocinio', 'extorsao', 'sequestro relampago', 'extorsao mediante sequestro'], refs: [['CP', 'arts. 157 a 160', 'Do roubo e da extorsão', 157], ['Hediondos', 'Lei 8.072/90', 'Latrocínio e extorsão qualificada são hediondos', 1]] },
  { tema: 'Estelionato', kw: ['estelionato', 'fraude', 'golpe', 'estelionato eletronico'], refs: [['CP', 'art. 171', 'Estelionato e a fraude eletrônica (§2º-A)', 171]] },
  { tema: 'Apropriação indébita', kw: ['apropriacao indebita', 'apropriacao previdenciaria'], refs: [['CP', 'arts. 168 a 170', 'Da apropriação indébita', 168]] },
  { tema: 'Receptação', kw: ['receptacao', 'receptar'], refs: [['CP', 'art. 180', 'Receptação', 180]] },
  { tema: 'Dano', kw: ['dano', 'crime de dano', 'destruir coisa alheia'], refs: [['CP', 'arts. 163 a 167', 'Do dano', 163]] },
  { tema: 'Crimes sexuais', kw: ['estupro', 'estupro de vulneravel', 'violacao sexual', 'assedio sexual', 'importunacao sexual'], refs: [['CP', 'arts. 213 a 218-C', 'Dos crimes contra a dignidade sexual', 213], ['CP', 'art. 216-A', 'Assédio sexual', 216], ['Hediondos', 'Lei 8.072/90', 'Estupro é hediondo', 1]] },
  { tema: 'Tráfico de drogas', kw: ['trafico', 'drogas', 'entorpecente', 'porte de drogas', 'associacao para o trafico'], refs: [['Drogas', 'arts. 28 e 33 a 41', 'Porte para consumo e tráfico', 28]] },
  { tema: 'Porte de arma', kw: ['arma', 'porte ilegal de arma', 'posse de arma', 'disparo de arma'], refs: [['Armas', 'arts. 12 a 21', 'Crimes do Estatuto do Desarmamento', 12]] },
  { tema: 'Crimes de trânsito', kw: ['embriaguez ao volante', 'homicidio culposo no transito', 'racha', 'crime de transito', 'fuga do local'], refs: [['CTB', 'arts. 291 a 312-B', 'Dos crimes de trânsito', 291], ['CTB', 'art. 306', 'Embriaguez ao volante', 306]] },
  { tema: 'Peculato e corrupção', kw: ['peculato', 'corrupcao passiva', 'corrupcao ativa', 'concussao', 'prevaricacao', 'crime funcional'], refs: [['CP', 'arts. 312 a 327', 'Crimes praticados por funcionário público', 312], ['CP', 'arts. 333 a 337-A', 'Crimes praticados por particular contra a Administração', 333]] },
  { tema: 'Falsidade documental', kw: ['falsidade', 'falsificacao', 'documento falso', 'uso de documento falso', 'falsidade ideologica'], refs: [['CP', 'arts. 296 a 305', 'Da falsidade documental', 296]] },
  { tema: 'Desacato e desobediência', kw: ['desacato', 'desobediencia', 'resistencia'], refs: [['CP', 'arts. 329 a 331', 'Resistência, desobediência e desacato', 329]] },
  { tema: 'Organização criminosa', kw: ['organizacao criminosa', 'associacao criminosa', 'quadrilha', 'colaboracao premiada', 'delacao premiada'], refs: [['Organização', 'Lei 12.850/13', 'Organização criminosa e colaboração premiada', 1], ['CP', 'art. 288', 'Associação criminosa', 288]] },
  { tema: 'Lavagem de dinheiro', kw: ['lavagem de dinheiro', 'ocultacao de bens', 'branqueamento'], refs: [['Lavagem', 'Lei 9.613/98', 'Lavagem ou ocultação de bens', 1]] },
  { tema: 'Sonegação fiscal', kw: ['sonegacao', 'sonegacao fiscal', 'crime tributario', 'ordem tributaria'], refs: [['Sonegação', 'Lei 8.137/90', 'Crimes contra a ordem tributária', 1]] },
  { tema: 'Tortura', kw: ['tortura', 'torturar'], refs: [['Tortura', 'Lei 9.455/97', 'Crime de tortura', 1]] },
  { tema: 'Abuso de autoridade', kw: ['abuso de autoridade', 'excesso de poder'], refs: [['Abuso', 'Lei 13.869/19', 'Crimes de abuso de autoridade', 1]] },
  { tema: 'Crimes ambientais', kw: ['crime ambiental', 'poluicao', 'fauna', 'flora', 'desmatamento'], refs: [['Ambiental', 'Lei 9.605/98', 'Crimes contra o meio ambiente', 1]] },
  { tema: 'Crimes contra idoso e criança', kw: ['crime contra idoso', 'crime contra crianca', 'violencia contra idoso'], refs: [['Idoso', 'arts. 93 a 108', 'Crimes contra a pessoa idosa', 93], ['ECA', 'arts. 225 a 258-C', 'Crimes contra criança e adolescente', 225]] },

  // ─────────────── PROCESSO PENAL ───────────────
  { tema: 'Prisão em flagrante', kw: ['flagrante', 'prisao em flagrante', 'auto de prisao', 'audiencia de custodia'], refs: [['CPP', 'arts. 301 a 310', 'Da prisão em flagrante', 301], ['CPP', 'art. 310', 'Audiência de custódia', 310]] },
  { tema: 'Prisão preventiva', kw: ['prisao preventiva', 'preventiva', 'garantia da ordem publica', 'revogacao da preventiva'], refs: [['CPP', 'arts. 311 a 316', 'Da prisão preventiva', 311]] },
  { tema: 'Prisão temporária', kw: ['prisao temporaria', 'temporaria'], refs: [['CPP', 'arts. 283 a 300', 'Das prisões em geral', 283]] },
  { tema: 'Medidas cautelares diversas da prisão', kw: ['medida cautelar', 'tornozeleira', 'monitoracao eletronica', 'fianca'], refs: [['CPP', 'arts. 319 a 350', 'Medidas cautelares e fiança', 319]] },
  { tema: 'Habeas corpus', kw: ['habeas corpus', 'hc', 'constrangimento ilegal'], refs: [['CPP', 'arts. 647 a 667', 'Do habeas corpus', 647], ['CF/88', 'art. 5º, LXVIII', 'Garantia do habeas corpus', 5]] },
  { tema: 'Inquérito policial', kw: ['inquerito', 'inquerito policial', 'indiciamento', 'arquivamento'], refs: [['CPP', 'arts. 4º a 23', 'Do inquérito policial', 4]] },
  { tema: 'Ação penal e queixa', kw: ['acao penal', 'denuncia', 'queixa-crime', 'representacao', 'decadencia do direito de queixa'], refs: [['CPP', 'arts. 24 a 62', 'Da ação penal', 24], ['CP', 'arts. 100 a 106', 'Da ação penal', 100]] },
  { tema: 'Tribunal do júri', kw: ['juri', 'tribunal do juri', 'pronuncia', 'impronuncia', 'plenario', 'quesitos'], refs: [['CPP', 'arts. 406 a 497', 'Do procedimento do júri', 406]] },
  { tema: 'Nulidades', kw: ['nulidade', 'nulidades', 'prejuizo', 'pas de nullite'], refs: [['CPP', 'arts. 563 a 573', 'Das nulidades', 563]] },
  { tema: 'Provas no processo penal', kw: ['prova ilicita', 'busca e apreensao', 'interceptacao telefonica', 'reconhecimento pessoal', 'cadeia de custodia'], refs: [['CPP', 'arts. 155 a 250', 'Das provas', 155], ['CPP', 'art. 158-A', 'Cadeia de custódia', 158], ['Interceptação', 'Lei 9.296/96', 'Interceptação telefônica', 1]] },
  { tema: 'Recursos penais', kw: ['apelacao criminal', 'recurso em sentido estrito', 'embargos infringentes', 'agravo em execucao'], refs: [['CPP', 'arts. 574 a 667', 'Dos recursos em geral', 574]] },
  { tema: 'Execução penal', kw: ['execucao penal', 'remicao', 'falta grave', 'saida temporaria', 'detracao'], refs: [['LEP', 'Lei 7.210/84', 'Lei de Execução Penal', 1], ['LEP', 'art. 126', 'Remição pelo trabalho e estudo', 126], ['CP', 'art. 42', 'Detração', 42]] },
  { tema: 'Juizado especial criminal', kw: ['jecrim', 'transacao penal', 'suspensao condicional do processo', 'menor potencial ofensivo', 'termo circunstanciado'], refs: [['JEC', 'arts. 60 a 92', 'Dos juizados especiais criminais', 60], ['JEC', 'art. 89', 'Suspensão condicional do processo', 89]] },
  { tema: 'Violência doméstica', kw: ['violencia domestica', 'maria da penha', 'medida protetiva', 'agressor'], refs: [['MariaPenha', 'Lei 11.340/06', 'Violência doméstica e medidas protetivas', 1], ['CP', 'art. 129, §9º', 'Lesão corporal em violência doméstica', 129]] },

  // ─────────────── TRABALHISTA ───────────────
  { tema: 'Contrato de trabalho', kw: ['contrato de trabalho', 'vinculo empregaticio', 'ctps', 'registro em carteira', 'empregado'], refs: [['CLT', 'arts. 2º a 19', 'Do empregador e do empregado', 2], ['CLT', 'arts. 442 a 456', 'Do contrato individual de trabalho', 442]] },
  { tema: 'Rescisão do contrato', kw: ['rescisao', 'demissao', 'justa causa', 'aviso previo', 'verbas rescisorias', 'rescisao indireta'], refs: [['CLT', 'arts. 477 a 486', 'Da rescisão', 477], ['CLT', 'art. 482', 'Justa causa do empregado', 482], ['CLT', 'art. 483', 'Rescisão indireta', 483], ['CLT', 'arts. 487 a 491', 'Do aviso prévio', 487]] },
  { tema: 'Jornada e horas extras', kw: ['jornada', 'horas extras', 'sobreaviso', 'banco de horas', 'intervalo intrajornada'], refs: [['CLT', 'arts. 57 a 75', 'Da duração do trabalho', 57], ['CLT', 'art. 59', 'Horas suplementares', 59], ['CLT', 'art. 71', 'Intervalos', 71], ['CF/88', 'art. 7º, XIII e XVI', 'Jornada e adicional de 50%', 7]] },
  { tema: 'Adicional noturno', kw: ['adicional noturno', 'trabalho noturno', 'hora reduzida'], refs: [['CLT', 'art. 73', 'Do trabalho noturno', 73]] },
  { tema: 'Insalubridade e periculosidade', kw: ['insalubridade', 'periculosidade', 'adicional de insalubridade', 'agente nocivo'], refs: [['CLT', 'arts. 189 a 197', 'Das atividades insalubres', 189], ['CLT', 'art. 192', 'Adicional de insalubridade', 192], ['CLT', 'art. 193', 'Adicional de periculosidade', 193]] },
  { tema: 'Férias', kw: ['ferias', 'ferias proporcionais', 'ferias vencidas', 'terco constitucional', 'periodo aquisitivo'], refs: [['CLT', 'arts. 129 a 153', 'Das férias anuais', 129], ['CLT', 'art. 137', 'Férias em dobro', 137], ['CLT', 'art. 146', 'Férias proporcionais', 146]] },
  { tema: '13º salário', kw: ['decimo terceiro', '13o salario', 'gratificacao natalina'], refs: [['CF/88', 'art. 7º, VIII', 'Décimo terceiro salário', 7]] },
  { tema: 'FGTS', kw: ['fgts', 'fundo de garantia', 'multa de 40%', 'saque'], refs: [['CF/88', 'art. 7º, III', 'FGTS', 7]] },
  { tema: 'Estabilidade e garantia de emprego', kw: ['estabilidade', 'gestante', 'cipeiro', 'acidentado', 'garantia de emprego'], refs: [['CLT', 'arts. 492 a 500', 'Da estabilidade', 492]] },
  { tema: 'Assédio moral e sexual no trabalho', kw: ['assedio moral', 'assedio sexual', 'dano extrapatrimonial'], refs: [['CLT', 'arts. 223-A a 223-G', 'Do dano extrapatrimonial', 223], ['CP', 'art. 216-A', 'Assédio sexual', 216]] },
  { tema: 'Prescrição trabalhista', kw: ['prescricao trabalhista', 'cinco anos', 'bienal', 'quinquenal'], refs: [['CF/88', 'art. 7º, XXIX', 'Prescrição de 5 anos, até 2 após a extinção', 7], ['CLT', 'art. 11', 'Prescrição', 11]] },
  { tema: 'Processo do trabalho', kw: ['reclamatoria', 'audiencia trabalhista', 'reclamacao trabalhista', 'revelia trabalhista'], refs: [['CLT', 'arts. 763 a 910', 'Do processo judiciário do trabalho', 763], ['CLT', 'art. 467', 'Multa de 50% sobre verbas incontroversas', 467]] },

  // ─────────────── PREVIDENCIÁRIO ───────────────
  { tema: 'Aposentadoria', kw: ['aposentadoria', 'aposentar', 'tempo de contribuicao', 'idade minima', 'regra de transicao'], refs: [['L8213', 'arts. 48 a 63', 'Das aposentadorias', 48], ['CF/88', 'art. 201', 'Regime geral de previdência', 201]] },
  { tema: 'Aposentadoria especial', kw: ['aposentadoria especial', 'atividade especial', 'agente nocivo', 'ppp', 'ltcat'], refs: [['L8213', 'arts. 57 e 58', 'Da aposentadoria especial', 57]] },
  { tema: 'Auxílio por incapacidade', kw: ['auxilio-doenca', 'auxilio por incapacidade', 'incapacidade temporaria', 'pericia medica'], refs: [['L8213', 'arts. 59 a 63', 'Do auxílio-doença', 59]] },
  { tema: 'Auxílio-acidente', kw: ['auxilio-acidente', 'sequela', 'reducao da capacidade'], refs: [['L8213', 'art. 86', 'Do auxílio-acidente', 86]] },
  { tema: 'Pensão por morte', kw: ['pensao por morte', 'dependente', 'oobito do segurado'], refs: [['L8213', 'arts. 74 a 79', 'Da pensão por morte', 74]] },
  { tema: 'Salário-maternidade', kw: ['salario-maternidade', 'licenca-maternidade', 'parto', 'adocao'], refs: [['L8213', 'arts. 71 a 73', 'Do salário-maternidade', 71]] },
  { tema: 'BPC / LOAS', kw: ['bpc', 'loas', 'beneficio assistencial', 'idoso carente', 'deficiente'], refs: [['CF/88', 'art. 203, V', 'Benefício de prestação continuada', 203]] },
  { tema: 'Carência e qualidade de segurado', kw: ['carencia', 'qualidade de segurado', 'periodo de graca', 'reingresso'], refs: [['L8213', 'arts. 24 a 27', 'Do período de carência', 24], ['L8213', 'art. 15', 'Manutenção da qualidade de segurado', 15]] },
  { tema: 'Cálculo do benefício (RMI)', kw: ['rmi', 'renda mensal inicial', 'salario de beneficio', 'media dos salarios', 'fator previdenciario'], refs: [['L8213', 'arts. 28 a 32', 'Do salário de benefício', 28], ['L8213', 'art. 29', 'Cálculo e fator previdenciário', 29]] },

  // ─────────────── CONSUMIDOR ───────────────
  { tema: 'Direitos básicos do consumidor', kw: ['consumidor', 'direitos basicos', 'inversao do onus da prova'], refs: [['CDC', 'art. 6º', 'Direitos básicos do consumidor', 6]] },
  { tema: 'Vício e defeito do produto', kw: ['vicio do produto', 'defeito', 'garantia', 'produto viciado', 'fato do produto'], refs: [['CDC', 'arts. 12 a 17', 'Da responsabilidade pelo fato do produto', 12], ['CDC', 'arts. 18 a 25', 'Da responsabilidade por vício', 18]] },
  { tema: 'Cobrança indevida e devolução em dobro', kw: ['cobranca indevida', 'devolucao em dobro', 'repeticao de indebito'], refs: [['CDC', 'art. 42', 'Cobrança de dívidas e devolução em dobro', 42]] },
  { tema: 'Negativação indevida', kw: ['negativacao', 'spc', 'serasa', 'cadastro de inadimplentes', 'inscricao indevida'], refs: [['CDC', 'art. 43', 'Bancos de dados e cadastros', 43]] },
  { tema: 'Práticas e cláusulas abusivas', kw: ['pratica abusiva', 'clausula abusiva', 'venda casada', 'publicidade enganosa'], refs: [['CDC', 'arts. 39 a 41', 'Das práticas abusivas', 39], ['CDC', 'arts. 51 a 54', 'Das cláusulas abusivas', 51]] },
  { tema: 'Direito de arrependimento', kw: ['arrependimento', 'sete dias', 'compra fora do estabelecimento', 'compra online'], refs: [['CDC', 'art. 49', 'Direito de arrependimento em 7 dias', 49]] },

  // ─────────────── TRIBUTÁRIO E EMPRESARIAL ───────────────
  { tema: 'Obrigação e crédito tributário', kw: ['obrigacao tributaria', 'credito tributario', 'lancamento', 'fato gerador'], refs: [['CTN', 'arts. 113 a 138', 'Da obrigação tributária', 113], ['CTN', 'arts. 139 a 182', 'Do crédito tributário', 139]] },
  { tema: 'Prescrição e decadência tributárias', kw: ['prescricao tributaria', 'decadencia tributaria', 'cinco anos tributario'], refs: [['CTN', 'arts. 173 e 174', 'Decadência e prescrição', 173]] },
  { tema: 'Execução fiscal', kw: ['execucao fiscal', 'certidao de divida ativa', 'cda', 'embargos a execucao fiscal'], refs: [['CTN', 'arts. 201 a 204', 'Da dívida ativa', 201]] },
  { tema: 'Sociedades', kw: ['sociedade', 'ltda', 'socio', 'contrato social', 'desconsideracao da personalidade'], refs: [['CC', 'arts. 981 a 1.141', 'Do direito de empresa', 981], ['CC', 'art. 50', 'Desconsideração da personalidade jurídica', 50]] },
  { tema: 'Recuperação judicial e falência', kw: ['recuperacao judicial', 'falencia', 'plano de recuperacao', 'habilitacao de credito'], refs: [['Falência', 'Lei 11.101/05', 'Recuperação e falência', 1]] },

  // ─────────────── ADMINISTRATIVO E CONSTITUCIONAL ───────────────
  { tema: 'Direitos e garantias fundamentais', kw: ['direitos fundamentais', 'garantias', 'devido processo legal', 'contraditorio', 'ampla defesa', 'presuncao de inocencia'], refs: [['CF/88', 'art. 5º', 'Dos direitos e deveres individuais e coletivos', 5]] },
  { tema: 'Servidor público', kw: ['servidor publico', 'concurso publico', 'estabilidade do servidor', 'regime juridico'], refs: [['CF/88', 'arts. 37 a 41', 'Da administração pública', 37]] },
  { tema: 'Improbidade administrativa', kw: ['improbidade', 'enriquecimento ilicito do agente', 'prejuizo ao erario'], refs: [['Improbidade', 'Lei 8.429/92', 'Atos de improbidade e sanções', 1]] },
  { tema: 'Licitações e contratos', kw: ['licitacao', 'pregao', 'dispensa de licitacao', 'contrato administrativo'], refs: [['Licitações', 'Lei 14.133/21', 'Licitações e contratos', 1]] },
  { tema: 'Mandado de segurança', kw: ['mandado de seguranca', 'direito liquido e certo', 'autoridade coatora'], refs: [['MS', 'Lei 12.016/09', 'Mandado de segurança', 1], ['CF/88', 'art. 5º, LXIX', 'Garantia do mandado de segurança', 5]] },
  { tema: 'LGPD e proteção de dados', kw: ['lgpd', 'dados pessoais', 'privacidade', 'consentimento', 'anpd'], refs: [['LGPD', 'Lei 13.709/18', 'Proteção de dados pessoais', 1]] },
]

// ── Busca ─────────────────────────────────────────────────────────────────

// "Divórcio" e "divorcio" têm de achar a mesma coisa.
export const normalizar = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// Palavras curtas demais não discriminam nada ("de", "a", "do").
const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'em', 'no', 'na', 'por', 'para', 'com'])
const palavras = (s) => normalizar(s).split(' ').filter(p => p && !VAZIAS.has(p))

/**
 * Pontua o quanto um item responde à busca.
 *
 * O erro da versão antiga era casar PEDAÇO de palavra: `"casamento".includes("m")`
 * é verdadeiro, então uma única letra trazia meia lista. Aqui a palavra da
 * busca tem de começar uma palavra do texto — "divor" acha "divórcio", mas
 * "m" não acha "casamento".
 */
function pontuar(alvo, termos) {
  const campos = [
    { texto: normalizar(alvo.tema), peso: 10 },
    { texto: (alvo.kw ?? []).map(normalizar).join(' '), peso: 6 },
    { texto: normalizar((alvo.refs ?? []).map(r => r[2]).join(' ')), peso: 3 },
    { texto: normalizar(alvo.resumo ?? ''), peso: 2 },
    { texto: normalizar(alvo.nome ?? '') + ' ' + normalizar(alvo.sigla ?? ''), peso: 8 },
  ]
  let total = 0
  for (const t of termos) {
    let melhor = 0
    for (const c of campos) {
      if (!c.texto) continue
      // Palavra inteira vale mais que começo de palavra.
      if (new RegExp(`(^|[\\s-])${t}([\\s-]|$)`).test(c.texto)) melhor = Math.max(melhor, c.peso * 2)
      else if (new RegExp(`(^|[\\s-])${t}`).test(c.texto)) melhor = Math.max(melhor, c.peso)
    }
    if (!melhor) return 0     // toda palavra buscada precisa aparecer
    total += melhor
  }
  return total
}

/** Temas do índice remissivo que respondem à busca, do mais para o menos relevante. */
export function buscarTemas(consulta) {
  const termos = palavras(consulta)
  if (!termos.length || consulta.trim().length < 2) return []
  return INDICE
    .map(x => ({ ...x, _p: pontuar(x, termos) }))
    .filter(x => x._p > 0)
    .sort((a, b) => b._p - a._p)
}

/** Códigos e leis que respondem à busca. Sem busca, devolve tudo. */
export function buscarCodigos(consulta) {
  const termos = palavras(consulta)
  if (!termos.length || consulta.trim().length < 2) return VADE
  return VADE
    .map(v => ({ ...v, _p: pontuar(v, termos) }))
    .filter(v => v._p > 0)
    .sort((a, b) => b._p - a._p)
}

/**
 * Link direto para o artigo no Planalto.
 *
 * As páginas do Planalto têm âncoras no formato `#art136`. Não é infalível —
 * a nomenclatura varia entre leis antigas e novas — mas quando falha a página
 * abre no topo, que é exatamente o que acontecia antes em todos os casos.
 */
export function linkDoArtigo(sigla, artigo) {
  const base = COD[sigla]
  if (!base) return null
  return artigo ? `${base}#art${artigo}` : base
}
