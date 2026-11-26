/* Substituição de nomes na narrativa — o coração da anonimização.

   Antes, o relatório "sem identificar" trocava os nomes só na tabela e imprimia a
   narrativa intacta logo abaixo: a tabela dizia Criança A e o parágrafo seguinte
   dizia "Paulo mordeu a mão de Tallita". Estes testes fixam o que a troca precisa
   acertar, incluindo os casos que quebram uma implementação ingênua. */

import { readFileSync } from 'node:fs';

/* O maquinário de nomes mora em citacoes.mjs, que é .mjs justamente para o Node
   importá-lo pelo caminho — como regras.mjs e nomes.mjs. Antes isto vinha de util.js
   por data URL, porque um .js não é importável como módulo ES de dentro de um package
   commonjs. */
import * as Cit from '../assets/js/citacoes.mjs';
import * as N from '../assets/js/nomes.mjs';

/* util.js segue precisando do rodeio, e agora com um detalhe: ele importa
   './citacoes.mjs', e um data URL não tem de onde resolver um caminho relativo. Por
   isso o caminho é trocado pelo absoluto antes de codificar. Só o que é exclusivo de
   util.js — id e código de recuperação — vem daqui. */
const alvoCitacoes = new URL('../assets/js/citacoes.mjs', import.meta.url).href;
const fonte = readFileSync(new URL('../assets/js/util.js', import.meta.url), 'utf8')
  .replace(/'\.\/citacoes\.mjs'/g, JSON.stringify(alvoCitacoes));
const Util = await import('data:text/javascript;base64,' + Buffer.from(fonte).toString('base64'));

/* Reexportar de util.js é parte do contrato: quem importava de lá continua podendo.
   Um `U` que junta os dois trava isso — se o reexport cair, o teste cai. */
const U = { ...Cit, ...Util };

let falhas = 0, total = 0;
const t = (nome, cond, extra) => {
  total++;
  if(cond) console.log('  OK ' + nome);
  else { falhas++; console.log('  XX ' + nome + (extra ? '\n       ' + extra : '')); }
};

const troca = (texto, pares) => U.trocarNomes(texto, pares);
const A = { nome:'Paulo Victor Silva', rotulo:'Criança A' };
const B = { nome:'Tallita Lima',       rotulo:'Criança B' };
const C = { nome:'Cecília Rocha',      rotulo:'Criança C' };

console.log('\n=== Troca básica ===');
/* O rótulo entra com artigo, e a preposição que vinha antes do nome contrai com
   ele: trocar seco deixava "Criança A mordeu a mão de Criança B", que não é
   português. */
let r = troca('Paulo mordeu a mão de Tallita.', [A, B]);
t('primeiro nome vira o rótulo com artigo',
  r === 'A criança A mordeu a mão da criança B.', r);

r = troca('Paulo Victor Silva empurrou Tallita Lima.', [A, B]);
t('nome completo vira o rótulo', r === 'A criança A empurrou a criança B.', r);

console.log('\n=== Nome parcial: o caso que quebra o ingênuo ===');
r = troca('Paulo Victor chorou. Depois Paulo voltou a brincar.', [A]);
t('nome composto some inteiro, sem deixar sobra',
  r === 'A criança A chorou. Depois a criança A voltou a brincar.', r);
t('não sobrou "Victor" solto', !/Victor/.test(r), r);

r = troca('Paulo Silva pediu desculpas.', [A]);
t('nome com a parte do meio pulada também vira um rótulo só',
  r === 'A criança A pediu desculpas.', r);

console.log('\n=== Acento e caixa ===');
r = troca('Cecilia caiu; CECÍLIA foi acolhida; cecília voltou.', [C]);
t('escrito sem acento é trocado', !/Cecilia/.test(r), r);
t('maiúsculas são trocadas', !/CECÍLIA/.test(r), r);
t('minúsculas são trocadas', !/cecília/i.test(r), r);
t('virou tudo rótulo', (r.match(/criança C/gi) || []).length === 3, r);

console.log('\n=== Onde NÃO pode trocar ===');
r = troca('O paulista Paulinho e a paulada não são o Paulo.', [A]);
t('não troca nome dentro de outra palavra',
  r === 'O paulista Paulinho e a paulada não são a criança A.', r);

r = troca('A Lima da receita é fruta.', [B]);
t('parte do sobrenome ainda é trocada quando aparece sozinha',
  r === 'A criança B da receita é fruta.', r);

console.log('\n=== Nomes seguidos ===');
r = troca('Paulo Paulo Paulo', [A]);
t('três seguidos, nenhum escapa', r === 'A criança A a criança A a criança A', r);

r = troca('Paulo, Tallita e Paulo saíram.', [A, B]);
t('intercalados e repetidos',
  r === 'A criança A, a criança B e a criança A saíram.', r);

console.log('\n=== Bordas ===');
t('texto vazio não quebra', troca('', [A]) === '');
t('texto nulo não quebra', troca(null, [A]) === null);
t('sem pares, texto intacto', troca('Paulo caiu.', []) === 'Paulo caiu.');
r = troca('Paulo', [A]);
t('nome sozinho, sem pontuação', r === 'A criança A', r);
r = troca('(Paulo) e [Tallita]', [A, B]);
t('entre parênteses e colchetes', r === '(a criança A) e [a criança B]', r);

console.log('\n=== Partes curtas não contam ===');
t('"de" e "da" ficam de fora das formas',
  !U.formasDoNome('Ana de Lima').includes('de'),
  JSON.stringify(U.formasDoNome('Ana de Lima')));
r = troca('A bola de futebol da escola.', [{ nome:'Ana de Lima', rotulo:'Criança D' }]);
t('não trocou "de" nem "da"', r === 'A bola de futebol da escola.', r);

console.log('\n=== Artigo e contração ===');
/* O caso que motivou isto, escrito como a pessoa escreveria. */
const O = { nome:'Otto Nunes',   rotulo:'Criança A' };
const R = { nome:'Raissa Lima',  rotulo:'Criança B' };
r = troca('Otto fez tal coisa e Raissa nao gostou.', [O, R]);
t('o exemplo da escola sai em português',
  r === 'A criança A fez tal coisa e a criança B nao gostou.', r);

const casos = [
  ['de contrai em da',        'Mordeu o braço de Otto.',      'Mordeu o braço da criança A.'],
  ['em contrai em na',        'Bateu em Otto sem querer.',    'Bateu na criança A sem querer.'],
  ['por contrai em pela',     'Passou por Otto no corredor.', 'Passou pela criança A no corredor.'],
  ['para só ganha o artigo',  'Entregou para Otto.',          'Entregou para a criança A.'],
  ['com só ganha o artigo',   'Brincava com Otto.',           'Brincava com a criança A.'],
  ['artigo que já estava não vira dois', 'O choro da Otto durou.', 'O choro da criança A durou.'],
  ['início de frase sobe',    'Otto chorou.',                 'A criança A chorou.'],
  ['depois de ponto também',  'Entrou. Otto chorou.',         'Entrou. A criança A chorou.'],
  ['no meio fica minúsculo',  'Vi que Otto chorou.',          'Vi que a criança A chorou.']
];
for(const [nome, entra, sai] of casos){
  const saiu = troca(entra, [O]);
  t(nome, saiu === sai, saiu);
}

/* "a" não contrai de propósito: em "entregou a Helena" a crase caberia, em "a Helena
   chorou" não, e distinguir exige entender a frase. */
r = troca('A Otto chorou.', [O]);
t('"a" antes do nome não vira crase', r === 'A criança A chorou.', r);

console.log('\n=== Gênero do determinante ===');
/* "criança" é feminino. Antes saía "O criança A mordeu" e "o irmão do criança A": o
   nome era trocado, mas a frase ainda dizia que ali havia um menino. */
const L = { nome:'Luiz Felipe Costa', rotulo:'Criança A' };
const M = { nome:'Miguel Santos',     rotulo:'Criança A' };
const genero = [
  ['o vira a',            'O Luiz Felipe mordeu.',        'A criança A mordeu.',        L],
  ['o no meio da frase',  'Foi o Luiz que mordeu.',       'Foi a criança A que mordeu.', L],
  ['do vira da',          'O irmão do Miguel chegou.',    'O irmão da criança A chegou.', M],
  ['no vira na',          'Theo bateu no Miguel.',        'Theo bateu na criança A.',   M],
  ['pelo vira pela',      'Foi levado pelo Miguel.',      'Foi levado pela criança A.',  M],
  ['ao vira à',           'Entregou ao Miguel a bola.',   'Entregou à criança A a bola.', M],
  ['um vira uma',         'Chamou um Miguel qualquer.',   'Chamou uma criança A qualquer.', M],
  ['feminino fica',       'A Miguel? Não era ela.',       'A criança A? Não era ela.',  M]
];
for(const [nome, entra, sai, quem] of genero){
  const saiu = troca(entra, [quem]);
  t(nome, saiu === sai, saiu);
}

/* Ponto e vírgula e dois-pontos não abrem frase em português; a quebra de linha abre. */
r = troca('Veio buscar; o Miguel chorou.', [M]);
t('ponto e vírgula não sobe a inicial', r === 'Veio buscar; a criança A chorou.', r);
r = troca('Eu vi tudo: o Miguel caiu.', [M]);
t('dois-pontos também não', r === 'Eu vi tudo: a criança A caiu.', r);
r = troca('Primeira linha\nMiguel caiu.', [M]);
t('quebra de linha sobe', r === 'Primeira linha\nA criança A caiu.', r);

console.log('\n=== Pedaço curto do nome ===');
/* "Ana Lu Dias" saía como "A criança A Lu derrubou o copo": partes de até duas letras
   eram descartadas e o "Lu" ficava no papel. Agora entram nas combinações, mas nunca
   sozinhas — "Vi" é nome de gente e também verbo. */
const AL = { nome:'Ana Lu Dias', rotulo:'Criança A' };
r = troca('Ana Lu derrubou o copo.', [AL]);
t('o pedaço curto sai junto, sem sobra', r === 'A criança A derrubou o copo.', r);
t('e não sobrou "Lu"', !/\bLu\b/.test(r), r);
r = troca('Ana Lu Dias chamou a Miss.', [AL]);
t('nome inteiro também', r === 'A criança A chamou a Miss.', r);
t('"Lu" sozinho não é forma', !U.formasDoNome('Ana Lu Dias').includes('Lu'),
  JSON.stringify(U.formasDoNome('Ana Lu Dias')));
r = troca('Eu vi tudo: a Ana Vi caiu.', [{ nome:'Ana Vi', rotulo:'Criança B' }]);
t('o verbo "vi" sobrevive a uma criança chamada Vi',
  r === 'Eu vi tudo: a criança B caiu.', r);
t('nome de uma parte só ainda é forma, curto ou não',
  U.formasDoNome('Lu').length === 1, JSON.stringify(U.formasDoNome('Lu')));

console.log('\n=== Partícula no meio do nome ===');
/* "Maria de Souza" saía "a criança A da criança A": a forma "Maria Souza" não achava
   o "de" do texto, caíam as formas soltas, e o mesmo nome era rotulado duas vezes. */
const MS = { nome:'Maria de Souza', rotulo:'Criança A' };
r = troca('Maria de Souza empurrou o balde.', [MS]);
t('nome com partícula vira um rótulo só', r === 'A criança A empurrou o balde.', r);
r = troca('A Maria de Souza chorou.', [MS]);
t('com determinante antes também', r === 'A criança A chorou.', r);
r = troca('Maria dos Santos caiu.', [{ nome:'Maria dos Santos', rotulo:'Criança A' }]);
t('"dos" também', r === 'A criança A caiu.', r);

/* O bloco "Quem a narrativa cita de verdade" mudou de arquivo. A regra de exclusão
   que ele travava — `citadosNoTexto` — foi substituída pelo motor de citações, que
   responde a mesma pergunta melhor: em vez de tirar quem só aparece por uma forma de
   outra criança, ele lê o texto em trechos e, quando não sabe, pergunta. Os quatro
   casos daquele bloco estão em citacoes.test.mjs, em "O bug original". Duas regras
   para a mesma pergunta era justamente como o relatório tinha chegado a errar. */

console.log('\n=== Localizar citação ===');
t('acha o nome citado', U.posicaoNome('Depois Helena chamou a Miss.', 'Helena Souza') === 6,
  String(U.posicaoNome('Depois Helena chamou a Miss.', 'Helena Souza')));
t('devolve -1 quando não cita', U.posicaoNome('Ninguém viu.', 'Helena Souza') === -1);
t('não confunde pedaço de palavra', U.posicaoNome('A helicóptero.', 'Hel Souza') === -1);

/* `posicaoForma` pergunta por UMA forma; `posicaoNome` procura a pessoa por todas.
   Usar a segunda no lugar da primeira foi o que trouxe o irmão para o relatório.

   O índice cai na borda antes do nome, não na primeira letra: `regexNome` consome essa
   borda. Mesma convenção de `posicaoNome`, e serve só para ordenar. */
t('a forma pedida é achada',
  U.posicaoForma('Helena Souza e Theo disputavam.', 'Souza') === 6,
  String(U.posicaoForma('Helena Souza e Theo disputavam.', 'Souza')));
t('e a que não está no texto, não',
  U.posicaoForma('Helena Souza e Theo disputavam.', 'Pedro Souza') === -1);

console.log('\n=== Maiúscula de nome próprio ===');
const T = N.tituloNome;
t('nome em minúsculas sobe', T('maria silva') === 'Maria Silva', T('maria silva'));
t('partícula fica minúscula', T('maria da silva') === 'Maria da Silva', T('maria da silva'));
t('partícula que abre o nome sobe', T('da silva junior') === 'Da Silva Junior', T('da silva junior'));
t('CAIXA ALTA também se acerta', T('MARIA DA SILVA') === 'Maria da Silva', T('MARIA DA SILVA'));
t('acento preservado', T('cecília almeida') === 'Cecília Almeida', T('cecília almeida'));
t('apóstrofo sobe a seguinte', T("maria d'ávila") === "Maria D'Ávila", T("maria d'ávila"));
t('hífen sobe a seguinte', T('jean-pierre lima') === 'Jean-Pierre Lima', T('jean-pierre lima'));
t('espaços sobrando somem', T('  ana   paula  ') === 'Ana Paula', JSON.stringify(T('  ana   paula  ')));
t('vazio continua vazio', T('') === '' && T(null) === '');
t('"e" entre nomes fica minúsculo', T('ana e beatriz') === 'Ana e Beatriz', T('ana e beatriz'));
t('frase sobe só a primeira', N.primeiraMaiuscula('sala dos professores') === 'Sala dos professores',
  N.primeiraMaiuscula('sala dos professores'));

/* Estes dois reprovavam: "Pré II" saía "Pré Ii" e "Grupo 3A" saía "Grupo 3a", e
   nome de turma já passava por aqui. */
t('algarismo romano fica de pé', T('Pré II') === 'Pré II', T('Pré II'));
t('romano sozinho também', T('Jardim I') === 'Jardim I', T('Jardim I'));
t('código com dígito sobe inteiro', T('grupo 3a') === 'Grupo 3A', T('grupo 3a'));
t('mas VIVI não é numeral', T('VIVI SOUZA') === 'Vivi Souza', T('VIVI SOUZA'));
t('nem LILI', T('lili') === 'Lili', T('lili'));
t('romano em minúscula não vira numeral em nome de pessoa',
  T('maria ii') === 'Maria Ii', T('maria ii'));
t('mas vira em nome de turma, que é onde ele existe',
  T('pré ii', { romanos:true }) === 'Pré II', T('pré ii', { romanos:true }));
/* VIVI não está na lista de romanos, então nem com a opção ligada vira numeral. */
t('e nem assim VIVI deixa de ser nome',
  T('vivi', { romanos:true }) === 'Vivi', T('vivi', { romanos:true }));
t('der não é partícula: Van Der Berg fica',
  T('van der berg') === 'Van Der Berg', T('van der berg'));
t('é idempotente', T(T('MARIA DAS DORES')) === T('MARIA DAS DORES'), T(T('MARIA DAS DORES')));
t('apóstrofo e hífen seguem subindo',
  T("d'ávila jean-pierre") === "D'Ávila Jean-Pierre", T("d'ávila jean-pierre"));

console.log('\n=== Identificador de registro ===');
/* O antigo era String(Date.now()).slice(-4): quatro dígitos que davam a volta a cada
   dez segundos, e dois registros feitos com 10s de diferença recebiam o mesmo número.

   Mil sorteios não provam aleatoriedade, mas provam o tamanho do espaço: com sufixo
   de quatro caracteres esta asserção reprovava uma vez a cada três execuções, o que
   foi justamente como o espaço curto apareceu. Com seis, uma em três mil. */
const ids = Array.from({ length: 1000 }, () => U.novoId());
t('mil ids seguidos, nenhum repetido', new Set(ids).size === 1000,
  `${1000 - new Set(ids).size} repetidos`);
t('a data abre o id', /^\d{6}-[0-9A-HJ-NP-Z]{6}$/.test(ids[0]), ids[0]);
t('a data é a de hoje', ids[0].startsWith(
  [new Date().getFullYear() % 100, new Date().getMonth()+1, new Date().getDate()]
    .map(n => String(n).padStart(2,'0')).join('')), ids[0]);
t('o sufixo não usa I nem O, que se confundem com 1 e 0',
  ids.every(x => !/[IO]/.test(x.split('-')[1])));
t('o id antigo de quatro dígitos repetiria',
  new Set(Array.from({length:50}, () => String(Date.now()).slice(-4))).size < 50);

console.log('\n=== Identificador de aluno ===');
/* Era `'a' + Date.now().toString(36)`: cinquenta cadastros seguidos num laço davam um
   id só, e o servidor, achando a linha, fazia UPDATE — uma criança sobrescrevia a
   outra em silêncio. */
const idsAluno = new Set();
for(let i = 0; i < 2000; i++) idsAluno.add(U.novoIdAluno());
t('dois mil cadastros seguidos, nenhum repetido', idsAluno.size === 2000, String(idsAluno.size));
t('o id antigo repetiria no mesmo milissegundo', (() => {
  const velhos = new Set();
  for(let i = 0; i < 50; i++) velhos.add('a' + Date.now().toString(36));
  return velhos.size < 50;
})());
t('começa com a e traz a data', /^a\d{6}[0-9A-HJ-NP-Z]{6}$/.test(U.novoIdAluno()),
  U.novoIdAluno());
t('sem I e sem O no sufixo',
  Array.from({ length: 300 }, () => U.novoIdAluno()).every(x => !/[IO]/.test(x)));

console.log('\n=== Código de recuperação ===');
const cods = Array.from({ length: 2000 }, () => U.novoCodigoRecuperacao());
t('o formato é quatro grupos de quatro', /^[0-9A-HJ-NP-Z]{4}(-[0-9A-HJ-NP-Z]{4}){3}$/.test(cods[0]), cods[0]);
t('dois mil sorteios, nenhum repetido', new Set(cods).size === 2000,
  `${2000 - new Set(cods).size} repetidos`);
t('sem I e sem O, que à mão viram 1 e 0', cods.every(c => !/[IO]/.test(c)));
t('digitado torto é a mesma chave',
  U.normalizaCodigo(' k7m2 q9xt-4bnr p3wh ') === U.normalizaCodigo('K7M2-Q9XT-4BNR-P3WH'),
  U.normalizaCodigo(' k7m2 q9xt-4bnr p3wh '));
t('e a chave normalizada tem 16 caracteres',
  U.normalizaCodigo(cods[0]).length === 16, U.normalizaCodigo(cods[0]));

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE NOMES PASSARAM ===`);
process.exit(falhas ? 1 : 0);
