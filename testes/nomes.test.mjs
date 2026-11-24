/* Substituição de nomes na narrativa — o coração da anonimização.

   Antes, o relatório "sem identificar" trocava os nomes só na tabela e imprimia a
   narrativa intacta logo abaixo: a tabela dizia Criança A e o parágrafo seguinte
   dizia "Paulo mordeu a mão de Tallita". Estes testes fixam o que a troca precisa
   acertar, incluindo os casos que quebram uma implementação ingênua. */

import { readFileSync } from 'node:fs';

/* util.js é módulo ES e o package é commonjs, então o Node não o importa pelo
   caminho. Como ele não importa nada, carregá-lo como data URL resolve sem cópia
   temporária nem mudança no projeto. */
const fonte = readFileSync(new URL('../assets/js/util.js', import.meta.url), 'utf8');
const U = await import('data:text/javascript;base64,' + Buffer.from(fonte).toString('base64'));

/* nomes.mjs é .mjs justamente para o Node importá-lo pelo caminho, como regras.mjs.
   Só util.js precisa do rodeio do data URL. */
import * as N from '../assets/js/nomes.mjs';

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
  r === 'O paulista Paulinho e a paulada não são o criança A.', r);

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

console.log('\n=== Localizar citação ===');
t('acha o nome citado', U.posicaoNome('Depois Helena chamou a Miss.', 'Helena Souza') === 6,
  String(U.posicaoNome('Depois Helena chamou a Miss.', 'Helena Souza')));
t('devolve -1 quando não cita', U.posicaoNome('Ninguém viu.', 'Helena Souza') === -1);
t('não confunde pedaço de palavra', U.posicaoNome('A helicóptero.', 'Hel Souza') === -1);

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
