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
let r = troca('Paulo mordeu a mão de Tallita.', [A, B]);
t('primeiro nome vira o rótulo', r === 'Criança A mordeu a mão de Criança B.', r);

r = troca('Paulo Victor Silva empurrou Tallita Lima.', [A, B]);
t('nome completo vira o rótulo', r === 'Criança A empurrou Criança B.', r);

console.log('\n=== Nome parcial: o caso que quebra o ingênuo ===');
r = troca('Paulo Victor chorou. Depois Paulo voltou a brincar.', [A]);
t('nome composto some inteiro, sem deixar sobra',
  r === 'Criança A chorou. Depois Criança A voltou a brincar.', r);
t('não sobrou "Victor" solto', !/Victor/.test(r), r);

r = troca('Paulo Silva pediu desculpas.', [A]);
t('nome com a parte do meio pulada também vira um rótulo só',
  r === 'Criança A pediu desculpas.', r);

console.log('\n=== Acento e caixa ===');
r = troca('Cecilia caiu; CECÍLIA foi acolhida; cecília voltou.', [C]);
t('escrito sem acento é trocado', !/Cecilia/.test(r), r);
t('maiúsculas são trocadas', !/CECÍLIA/.test(r), r);
t('minúsculas são trocadas', !/cecília/i.test(r), r);
t('virou tudo rótulo', (r.match(/Criança C/g) || []).length === 3, r);

console.log('\n=== Onde NÃO pode trocar ===');
r = troca('O paulista Paulinho e a paulada não são o Paulo.', [A]);
t('não troca nome dentro de outra palavra',
  r === 'O paulista Paulinho e a paulada não são o Criança A.', r);

r = troca('A Lima da receita é fruta.', [B]);
t('parte do sobrenome ainda é trocada quando aparece sozinha',
  r === 'A Criança B da receita é fruta.', r);

console.log('\n=== Nomes seguidos ===');
r = troca('Paulo Paulo Paulo', [A]);
t('três seguidos, nenhum escapa', r === 'Criança A Criança A Criança A', r);

r = troca('Paulo, Tallita e Paulo saíram.', [A, B]);
t('intercalados e repetidos', r === 'Criança A, Criança B e Criança A saíram.', r);

console.log('\n=== Bordas ===');
t('texto vazio não quebra', troca('', [A]) === '');
t('texto nulo não quebra', troca(null, [A]) === null);
t('sem pares, texto intacto', troca('Paulo caiu.', []) === 'Paulo caiu.');
r = troca('Paulo', [A]);
t('nome sozinho, sem pontuação', r === 'Criança A', r);
r = troca('(Paulo) e [Tallita]', [A, B]);
t('entre parênteses e colchetes', r === '(Criança A) e [Criança B]', r);

console.log('\n=== Partes curtas não contam ===');
t('"de" e "da" ficam de fora das formas',
  !U.formasDoNome('Ana de Lima').includes('de'),
  JSON.stringify(U.formasDoNome('Ana de Lima')));
r = troca('A bola de futebol da escola.', [{ nome:'Ana de Lima', rotulo:'Criança D' }]);
t('não trocou "de" nem "da"', r === 'A bola de futebol da escola.', r);

console.log('\n=== Localizar citação ===');
t('acha o nome citado', U.posicaoNome('Depois Helena chamou a Miss.', 'Helena Souza') === 6,
  String(U.posicaoNome('Depois Helena chamou a Miss.', 'Helena Souza')));
t('devolve -1 quando não cita', U.posicaoNome('Ninguém viu.', 'Helena Souza') === -1);
t('não confunde pedaço de palavra', U.posicaoNome('A helicóptero.', 'Hel Souza') === -1);

console.log('\n=== Maiúscula de nome próprio ===');
const T = U.tituloNome;
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
t('frase sobe só a primeira', U.primeiraMaiuscula('sala dos professores') === 'Sala dos professores',
  U.primeiraMaiuscula('sala dos professores'));

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE NOMES PASSARAM ===`);
process.exit(falhas ? 1 : 0);
