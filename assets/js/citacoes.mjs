/* Nomes dentro de texto livre: achar, decidir de quem são, e trocar.

   Por que .mjs e não .js: este módulo roda nos dois lados. O navegador o importa
   direto; a API, que é CommonJS, o carrega por `await import()`. Mesma razão de
   regras.mjs e nomes.mjs — e aqui ela pesa mais que nas outras duas, porque é esta
   regra que o servidor precisa reexecutar para não aceitar registro com citação
   ambígua pendente. Uma regra, dois lados.

   É a parte do app onde um erro passa despercebido com mais facilidade: um nome que
   escapa não quebra nada, só vaza.

   O modelo é o da citação, não o da varredura. Durante muito tempo o app perguntava,
   para cada criança do cadastro, "esta criança aparece no texto?" — e com quatro
   Souzas matriculadas a resposta era sim quatro vezes, com o app escolhendo sozinho
   no escuro. Era o que punha no relatório de uma família o nome de uma criança de
   outra. A pergunta certa é a inversa: "este trecho nomeia alguém — quem?". Daí
   `mencoesNoTexto`, que devolve trechos com as suas candidatas, e
   `resolverCitacoes`, que decide ou admite que não sabe e manda perguntar. */

/* Mora aqui, e não em util.js, porque todo o resto deste arquivo depende dele e um
   .js não é importável de dentro do CommonJS. util.js o reexporta. */
export function semAcento(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g,''); }

/* ---------- achar um nome ----------

   A comparação ignora acento e caixa SEM reescrever o texto: cada letra vira a classe
   das suas variantes. Normalizar para comparar deslocaria as posições — "Cecília"
   encolhe ao virar "Cecilia" — e o recorte sairia torto. */
const VARIANTES = { a:'aáàâãä', e:'eéèêë', i:'iíìîï', o:'oóòôõö', u:'uúùûü', c:'cç', n:'nñ' };
const LETRA = 'A-Za-zÀ-ÿ';

/* Partículas de ligação. Não entram nas formas do nome — "de" e "da" sozinhos pegariam
   meio texto —, mas o texto pode trazê-las entre duas partes que a forma já juntou: a
   forma "Maria Souza" precisa achar "Maria de Souza" escrito na narrativa, e de uma
   vez. Sem isso ela falhava, caíam as formas soltas "Maria" e "Souza", e o mesmo
   nome saía rotulado duas vezes — "a criança A da criança A".

   "e" fica de fora de propósito: em "Ana e Beatriz" são duas crianças, não uma. */
const LIGACAO = ['de','da','do','das','dos','du','di'];
const ENTRE_PARTES = `\\s+(?:(?:${LIGACAO.join('|')})\\s+)*`;

export function padraoDoNome(nome){
  return semAcento(String(nome)).trim().replace(/\s+/g, ' ').toLowerCase()
    .split('')
    .map(ch => {
      if(ch === ' ') return ENTRE_PARTES;
      const v = VARIANTES[ch] || (/[a-z0-9]/.test(ch) ? ch : null);
      if(!v) return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return '[' + v + v.toUpperCase() + ']';
    })
    .join('');
}

/** Formas de um nome, das que cobrem mais partes para as que cobrem menos.

    Não basta listar o nome inteiro e as partes soltas: "Paulo Victor Silva" escrito
    como "Paulo Victor" trocaria parte por parte e sairia "Criança A Criança A". Por
    isso entram todas as combinações que preservam a ordem — "Paulo Victor", "Paulo
    Silva", "Victor Silva" —, e a mais abrangente é aplicada primeiro.

    Partículas de ligação não entram como parte: ENTRE_PARTES já as atravessa.

    Um pedaço curto de verdade — o "Lu" de "Ana Lu Dias" — entra nas combinações, mas
    nunca sozinho. Antes ele era descartado, e a troca deixava "A criança A Lu
    derrubou o copo" no papel. Sozinho também não serve: "Vi" é nome de gente e verbo,
    e apagaria o "vi" de "eu vi tudo". Nome de uma parte só é a exceção — ali não há
    resto a que juntar, e ficar sem forma nenhuma seria não anonimizar nada. */
export function formasDoNome(nome){
  const partes = String(nome || '').trim().split(/\s+/)
    .filter(p => p && !LIGACAO.includes(semAcento(p).toLowerCase()));
  if(!partes.length) return [];
  const formas = [];
  /* Cada bit de um contador binário diz se a parte entra na combinação. Nomes têm
     poucas partes, então o total é pequeno. */
  for(let mascara = 1; mascara < (1 << partes.length); mascara++){
    const grupo = partes.filter((_, i) => mascara & (1 << i));
    if(grupo.length === 1 && grupo[0].length <= 2 && partes.length > 1) continue;
    formas.push({ texto: grupo.join(' '), n: grupo.length });
  }
  return formas
    .sort((a, b) => b.n - a.n || b.texto.length - a.texto.length)
    .map(f => f.texto);
}

/* A borda da frente é consumida; a de trás é só espiada, para dois nomes seguidos não
   perderem o segundo. */
const regexNome = forma =>
  new RegExp(`(^|[^${LETRA}])(${padraoDoNome(forma)})(?![${LETRA}])`, 'g');

/* ---------- artigo no lugar do nome ----------

   Trocar "Otto" por "Criança A" seco deixa a frase capenga: "Otto fez e Raissa não
   gostou" vira "Criança A fez e Criança B não gostou". Em português o rótulo pede
   artigo — "A criança A fez e a criança B não gostou" —, e o artigo encontra a
   preposição que vinha antes do nome.

   Só estas três contraem. "a" de propósito fica de fora: em "entregou a Helena" a
   crase caberia, mas em "a Helena chorou" não, e não há como distinguir as duas sem
   entender a frase. Errar para o lado de não contrair deixa o texto simples; errar
   para o outro deixa o texto errado. */
const CONTRAI = { de:'da', em:'na', por:'pela' };

/* Palavras que já cumprem o papel do artigo: aqui não se acrescenta outro, só se
   troca o nome. "da Helena" vira "da criança A", e não "da a criança A". */
const JA_DETERMINA = ['a','o','as','os','da','do','na','no','pela','pelo',
                      'à','ao','um','uma'];

/* "criança" é feminino, e o determinante que acompanhava o nome muda de gênero junto.
   Sem isto saía "O criança A mordeu" e "o irmão do criança A" — o nome era trocado,
   mas a frase denunciava que ali havia um menino. */
const FEMININO = { o:'a', os:'as', do:'da', no:'na', pelo:'pela', ao:'à', um:'uma' };

const PRE = Object.keys(CONTRAI).concat(JA_DETERMINA)
  .sort((x, y) => y.length - x.length).join('|');

/** O determinante que vem imediatamente antes de um trecho, se houver.

    Antes isto era parte do regex que achava o nome. Virou uma olhada no prefixo
    porque a troca passou a ser por trecho resolvido, e não mais um `replace` por
    forma de cada nome — era aquela sequência de replaces que rotulava "Maria de
    Souza" duas vezes. */
const RE_DET = new RegExp(`(^|[^${LETRA}])(${PRE})([ \t]+)$`, 'i');
function determinanteAntes(prefixo){
  const m = RE_DET.exec(String(prefixo));
  return m ? { palavra:m[2], desde: m.index + m[1].length } : null;
}

/** Começa frase? Depois de pontuação final, de quebra de linha, ou no início.

    Ponto e vírgula e dois-pontos não abrem frase em português: estavam na lista e
    saía "veio buscar; A criança A chorou". A quebra de linha abre, e por isso é
    testada antes de o espaço do fim ser aparado. */
const abreFrase = antes => {
  const bruto = String(antes);
  if(/\n[^\S\n]*$/.test(bruto)) return true;
  const t = bruto.replace(/\s+$/u, '');
  return t === '' || /[.!?…]$/.test(t);
};

/** "criança A" com o artigo e a contração que a frase pede. */
function rotuloNaFrase(rotulo, anterior, inicio){
  const base = String(rotulo).charAt(0).toLocaleLowerCase('pt-BR') + String(rotulo).slice(1);
  const p = String(anterior || '').toLocaleLowerCase('pt-BR');
  const det = CONTRAI[p] || FEMININO[p] || p;
  const saida = det ? det + ' ' + base : 'a ' + base;
  return inicio ? saida.charAt(0).toLocaleUpperCase('pt-BR') + saida.slice(1) : saida;
}

/** Posição de UMA forma do nome no texto, ou -1. Diferente de `posicaoNome`, que
    procura a pessoa por todas as formas dela: aqui se pergunta por uma só.

    A diferença importa no relatório. Para decidir se um aluno do cadastro foi citado
    na narrativa era usada `posicaoNome`, que reexpande o nome — e bastava o sobrenome
    bater para o irmão da criança envolvida entrar numa ocorrência que não teve. */
export function posicaoForma(texto, forma){
  const m = regexNome(forma).exec(String(texto || ''));
  return m ? m.index : -1;
}

/** Posição da primeira citação do nome no texto, ou -1 se não houver. */
export function posicaoNome(texto, nome){
  let menor = -1;
  for(const forma of formasDoNome(nome)){
    const i = posicaoForma(texto, forma);
    if(i >= 0 && (menor < 0 || i < menor)) menor = i;
  }
  return menor;
}

/* ================================================================ citações

   Daqui para baixo é o modelo novo: o texto é varrido uma vez e devolve TRECHOS com
   as suas candidatas, em vez de uma resposta sim/não por criança. */

/** Chave de comparação de uma forma: sem acento, minúscula, espaço simples. */
export const chaveForma = f => semAcento(String(f ?? '')).toLowerCase().trim().replace(/\s+/g, ' ');

/* Palavra que, imediatamente antes do nome, diz que ali não há criança: "a Miss Ana"
   é a Miss, mesmo que exista uma criança chamada Ana. Cobre o adulto que não tem
   conta no sistema, e por isso não está no índice.

   "mãe" e "pai" entram porque "a mãe Ana veio buscar" aparece; "a mãe da Helena" não
   é afetado, ali o título não está imediatamente antes do nome da criança. */
export const TITULOS = ['miss', 'tia', 'tio', 'professora', 'professor', 'prof',
  'dona', 'dono', 'sr', 'sra', 'senhor', 'senhora', 'dr', 'dra', 'doutora', 'doutor',
  'mae', 'pai', 'mamae', 'papai', 'avo', 'avoa', 'vovo', 'vovoa', 'babysitter', 'motorista'];

const TITULO_ANTES = new RegExp(
  `(?:^|[^${LETRA}])(?:${TITULOS.join('|')})[ \\t]+$`, 'i');

/** Índice forma → pessoas, de um cadastro inteiro.

    Crianças e adultos entram JUNTOS, cada um marcado. Isso não é economia de código:
    é o que faz "Chamei a Miss Ana Paula" não arrastar a criança Ana Clara. A regra do
    trecho mais longo, aplicada depois, prefere "Ana Paula" (duas partes, adulta) a
    "Ana" (uma parte, criança), consome o trecho, e a criança nunca é considerada.
    Sem o índice único isso precisaria de uma exceção escrita à mão.

    `pessoas` é [{ id, nome, crianca, turma, nascimento }]. */
export function indiceDePessoas(pessoas){
  const idx = new Map();
  for(const p of pessoas || []){
    if(!p || !p.nome) continue;
    for(const forma of formasDoNome(p.nome)){
      const k = chaveForma(forma);
      if(!idx.has(k)) idx.set(k, { forma, pessoas: [] });
      const alvo = idx.get(k).pessoas;
      if(!alvo.some(x => x.id === p.id)) alvo.push(p);
    }
  }
  return idx;
}

/** Os trechos do texto que nomeiam gente, da esquerda para a direita.

    O trecho mais longo ganha, e trechos não se sobrepõem: "Souza Cruz" é uma citação
    só, não "Souza" mais "Cruz". É essa regra que resolve de graça tanto o sobrenome
    composto quanto o nome da Miss.

    Devolve [{ ini, fim, texto, forma, pessoas, titulo }], onde `pessoas` são todas as
    do cadastro com aquela forma e `titulo` diz se vinha logo depois de Miss, Tia e
    afins. */
export function mencoesNoTexto(texto, indice){
  const alvo = String(texto || '');
  if(!alvo || !indice || !indice.size) return [];

  const achados = [];
  for(const [k, v] of indice){
    const re = new RegExp(`(^|[^${LETRA}])(${padraoDoNome(v.forma)})(?![${LETRA}])`, 'g');
    let m;
    while((m = re.exec(alvo))){
      const ini = m.index + m[1].length;
      achados.push({ ini, fim: ini + m[2].length, texto: m[2], forma: k, pessoas: v.pessoas });
      /* Volta um caractere: a borda da frente foi consumida, e dois nomes seguidos
         compartilham o separador. */
      re.lastIndex = Math.max(m.index + m[0].length - 1, ini + 1);
    }
  }

  /* Mais à esquerda primeiro; empatando a posição, o trecho mais longo. */
  achados.sort((a, b) => a.ini - b.ini || (b.fim - b.ini) - (a.fim - a.ini));

  const fora = [];
  for(const a of achados){
    if(fora.some(b => a.ini < b.fim && b.ini < a.fim)) continue;
    a.titulo = TITULO_ANTES.test(alvo.slice(0, a.ini));
    fora.push(a);
  }
  return fora;
}

/* ---------- de quem é a citação ----------

   Regras em ordem. Cada uma só decide quando aponta para UMA criança; senão passa a
   vez à seguinte. Nada de pesos somados: toda decisão tem de caber numa frase que a
   Miss leia, e num teste.

   `certa` e `provável` resolvem em silêncio — mas aparecem resolvidas na tela, com o
   motivo, e podem ser trocadas. `ambígua` pergunta. */

const MOTIVO = {
  guardada: 'você já confirmou neste registro',
  titulo:   'vem depois de um título, então é adulto',
  adulto:   'é nome de adulto, não de criança',
  unica:    'só uma criança tem esse nome',
  envolvida:'está entre as crianças envolvidas',
  eco:      'outro nome dela também aparece no texto'
};

/** Resolve cada citação do texto.

    `ctx`: { envolvidos:[kid], turmas:[nome], guardadas:{ forma: kid|'' } }
    `guardadas` é a resposta da pessoa, por forma — `''` significa "não é criança".

    Devolve [{ ...mencao, kid, nivel, motivo, candidatos }], onde `nivel` é
    'certa' | 'provavel' | 'ambigua' | 'nao-crianca'. */
export function resolverCitacoes(texto, indice, ctx){
  const c = ctx || {};
  const envolvidos = c.envolvidos || [];
  const turmas = c.turmas || [];
  const guardadas = c.guardadas || {};
  const mencoes = mencoesNoTexto(texto, indice);

  /* Quem o texto nomeia sem nenhuma dúvida. Serve de apoio para as formas ambíguas:
     se "Ricardo" está no texto e só o Ricardo Souza se chama Ricardo, então o "Souza"
     da frase seguinte é dele. Calculado antes, numa passada só. */
  const semDuvida = new Set();
  for(const m of mencoes){
    if(m.titulo) continue;
    const cri = m.pessoas.filter(p => p.crianca);
    if(cri.length === 1 && m.pessoas.length === 1) semDuvida.add(cri[0].id);
  }

  return mencoes.map(m => {
    const cri = m.pessoas.filter(p => p.crianca);

    /* 1 — o que a pessoa respondeu vence tudo, inclusive um cadastro que mudou
       depois. Uma criança nova matriculada não pode reabrir o que já foi confirmado. */
    if(Object.prototype.hasOwnProperty.call(guardadas, m.forma)){
      const kid = guardadas[m.forma];
      if(!kid) return { ...m, kid:null, nivel:'nao-crianca', motivo:MOTIVO.guardada, candidatos:cri };
      if(cri.some(p => p.id === kid))
        return { ...m, kid, nivel:'certa', motivo:MOTIVO.guardada, candidatos:cri };
      /* Respondida com uma criança que saiu do cadastro: volta a perguntar. */
    }

    /* 2 — adulto, ou título imediatamente antes. */
    if(m.titulo) return { ...m, kid:null, nivel:'nao-crianca', motivo:MOTIVO.titulo, candidatos:cri };
    if(!cri.length) return { ...m, kid:null, nivel:'nao-crianca', motivo:MOTIVO.adulto, candidatos:cri };
    if(cri.length < m.pessoas.length && cri.length === 1 && m.pessoas.length > 1){
      /* A forma é de uma criança E de um adulto, e nada mais decide. Perguntar é mais
         honesto que escolher: "Beatriz" pode ser a Miss Beatriz ou a criança. */
      return { ...m, kid:null, nivel:'ambigua', motivo:'', candidatos:cri };
    }

    /* 3 — uma criança só tem esse nome. */
    if(cri.length === 1)
      return { ...m, kid:cri[0].id, nivel:'certa', motivo:MOTIVO.unica, candidatos:cri };

    /* 4 — exatamente uma candidata está entre as envolvidas no registro. */
    const env = cri.filter(p => envolvidos.includes(p.id));
    if(env.length === 1)
      return { ...m, kid:env[0].id, nivel:'provavel', motivo:MOTIVO.envolvida, candidatos:cri };

    /* 5 — exatamente uma candidata tem outro nome dela no texto. */
    const eco = cri.filter(p => semDuvida.has(p.id));
    if(eco.length === 1)
      return { ...m, kid:eco[0].id, nivel:'provavel', motivo:MOTIVO.eco, candidatos:cri };

    /* 6 — não sabe. Pergunta, com as candidatas na ordem das regras acima e, por
       último critério, a turma das envolvidas: é a Miss delas que escreve. */
    const peso = p => (env.includes(p) ? 4 : 0) + (eco.includes(p) ? 2 : 0) +
      (turmas.includes(p.turma) ? 1 : 0);
    const candidatos = [...cri].sort((a, b) => peso(b) - peso(a) ||
      String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return { ...m, kid:null, nivel:'ambigua', motivo:'', candidatos };
  });
}

/** As formas que ainda precisam de resposta, uma por forma, na ordem do texto.

    Uma resposta por forma e por registro, não por citação: o texto do registro pode
    ser corrigido antes da ciência, e uma resposta amarrada à posição não sobreviveria
    a isso. Três "Souza" na mesma narrativa são uma pergunta, não três. */
export function citacoesPendentes(texto, indice, ctx){
  const vistas = new Set();
  const fora = [];
  for(const r of resolverCitacoes(texto, indice, ctx)){
    if(r.nivel !== 'ambigua' || vistas.has(r.forma)) continue;
    vistas.add(r.forma);
    fora.push({ forma:r.forma, texto:r.texto, candidatos:r.candidatos });
  }
  return fora;
}

/* ================================================================ troca

   A troca acontece sobre os TRECHOS resolvidos, da direita para a esquerda — da
   direita porque cada substituição desloca o resto do texto, e indo de trás para a
   frente os índices ainda não usados continuam valendo.

   Antes era um `String.replace` por forma de cada nome, repetido. Daquela sequência
   vinham dois defeitos: "Maria de Souza" saía "a criança A da criança A", porque a
   forma inteira falhava e as soltas acertavam uma a uma; e, com duas crianças que
   dividem um sobrenome, quem trocasse primeiro ficava com a citação, mesmo que a
   pessoa tivesse confirmado a outra. Resolvendo antes e trocando o trecho, a
   confirmação dela é que decide. */

/** Troca cada nome pelo seu rótulo.

    `pares` é [{ nome, rotulo, kid }] — `rotulo` vazio deixa o nome como está, que é
    como a criança nomeada no comunicado da própria família sai com o nome dela.
    `ctx` leva o que a pessoa confirmou: { guardadas:{ forma: kid|'' } }. */
export function trocarNomes(texto, pares, ctx){
  if(!texto) return texto;
  const lista = (pares || []).filter(p => p && p.nome);
  if(!lista.length) return texto;

  const pessoas = lista.map((p, i) => ({
    id: p.kid || 'p' + i, nome: p.nome, crianca: true, turma: p.turma || '' }));
  const rotuloDe = new Map(pessoas.map((p, i) => [p.id, lista[i].rotulo]));

  const citacoes = resolverCitacoes(texto, indiceDePessoas(pessoas), {
    ...(ctx || {}), envolvidos: pessoas.map(p => p.id) });

  let fora = String(texto);
  for(const c of citacoes.slice().reverse()){
    if(c.nivel === 'nao-crianca') continue;
    /* Ambígua aqui é última linha de defesa, não caminho normal: a tela já perguntou
       antes de chegar ao papel. Mesmo sem saber qual das duas é, trocar apaga o nome
       — deixá-lo seria vazar o nome de uma criança de verdade para errar menos num
       rótulo. */
    const kid = c.kid || (c.candidatos[0] || {}).id;
    const rot = kid ? rotuloDe.get(kid) : null;
    if(!rot) continue;

    const det = determinanteAntes(fora.slice(0, c.ini));
    const corte = det ? det.desde : c.ini;
    fora = fora.slice(0, corte) +
      rotuloNaFrase(rot, det && det.palavra, abreFrase(fora.slice(0, corte))) +
      fora.slice(c.fim);
  }
  return fora;
}
