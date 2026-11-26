/* Quem é "Souza"? O motor de citações.

   Esta suíte existe por um relato: ao gerar o relatório de uma criança aparecia uma
   terceira, de outra família, que não esteve na ocorrência — e a legenda "Quem é
   quem" mostrava o nome real dela.

   A causa era a pergunta. O app perguntava, por criança, "esta aparece no texto?", e
   com quatro Souzas matriculadas a resposta era sim quatro vezes. A pergunta certa é
   "este trecho nomeia alguém — quem?", e quando a resposta é mais de uma criança o
   app tem de perguntar, não escolher.

   O que estes testes travam: o trecho mais longo ganha; adulto e título não são
   criança; as regras resolvem o caso comum em silêncio e perguntam só o indecidível;
   a resposta da pessoa vence um cadastro que mudou depois.

   Cada regra foi conferida reprovando o código sem ela antes de entrar aqui. */

import * as C from '../assets/js/citacoes.mjs';

let falhas = 0, total = 0;
const t = (nome, cond, extra) => {
  total++;
  if(cond) console.log('  OK ' + nome);
  else { falhas++; console.log('  XX ' + nome + (extra ? '\n       ' + extra : '')); }
};

/* O cadastro do relato, com os nomes que você deu: três Souzas e um sobrenome
   composto que também começa com Souza. */
const ESCOLA = [
  { id:'c1', nome:'Helena Souza',       crianca:true,  turma:'Verde' },
  { id:'c2', nome:'Theo Martins',       crianca:true,  turma:'Verde' },
  { id:'c7', nome:'Ricardo Souza',      crianca:true,  turma:'Azul' },
  { id:'c8', nome:'Telma Souza',        crianca:true,  turma:'Verde' },
  { id:'c9', nome:'Souza Cruz',         crianca:true,  turma:'Amarela' },
  { id:'u1', nome:'Ana Paula Ribeiro',  crianca:false, turma:'Verde' },
  { id:'u2', nome:'Beatriz Souza',      crianca:false, turma:'Azul' }
];
const IDX = C.indiceDePessoas(ESCOLA);
const nomeDe = id => (ESCOLA.find(p => p.id === id) || {}).nome || String(id);

/** Resolve e devolve uma linha por citação, legível. */
const ler = (texto, ctx) => C.resolverCitacoes(texto, IDX, ctx || {})
  .map(r => `${r.texto}=${r.kid ? nomeDe(r.kid) : r.nivel}`);

console.log('\n=== O índice diz de quantas crianças cada nome pode ser ===');
t('"Souza" é de quatro crianças',
  IDX.get('souza').pessoas.filter(p => p.crianca).length === 4,
  JSON.stringify(IDX.get('souza').pessoas.map(p => p.nome)));
t('"Helena Souza" é de uma', IDX.get('helena souza').pessoas.length === 1);
t('"Souza Cruz" é de uma', IDX.get('souza cruz').pessoas.length === 1);
t('o adulto entra no mesmo índice',
  IDX.get('ana paula').pessoas.every(p => !p.crianca),
  JSON.stringify((IDX.get('ana paula') || {}).pessoas));

console.log('\n=== O trecho mais longo ganha ===');
let m = C.mencoesNoTexto('Souza Cruz empurrou o Theo no pátio.', IDX);
t('"Souza Cruz" é uma citação, não duas',
  m.length === 2 && m[0].texto === 'Souza Cruz',
  JSON.stringify(m.map(x => x.texto)));
t('e por isso resolve sozinha, sem perguntar',
  ler('Souza Cruz empurrou o Theo.', { envolvidos:['c2'] }).join(' | ')
    === 'Souza Cruz=Souza Cruz | Theo=Theo Martins',
  ler('Souza Cruz empurrou o Theo.', { envolvidos:['c2'] }).join(' | '));
t('as citações não se sobrepõem',
  C.mencoesNoTexto('Helena Souza e Theo brigaram.', IDX)
    .every((x, i, a) => i === 0 || x.ini >= a[i - 1].fim));

console.log('\n=== Adulto não é criança ===');
/* O defeito que o índice único conserta de graça: sem ele, "Ana" dentro de "Ana
   Paula" arrastaria uma criança chamada Ana. */
const COM_ANA = C.indiceDePessoas(ESCOLA.concat(
  [{ id:'c5', nome:'Ana Clara Dias', crianca:true, turma:'Verde' }]));
const lerAna = (txt, ctx) => C.resolverCitacoes(txt, COM_ANA, ctx || {})
  .map(r => `${r.texto}=${r.kid ? nomeDe(r.kid) || r.kid : r.nivel}`);
t('a Miss citada pelo nome não arrasta criança',
  lerAna('Theo caiu. Chamei a Miss Ana Paula.', { envolvidos:['c2'] })
    .join(' | ') === 'Theo=Theo Martins | Ana Paula=nao-crianca',
  lerAna('Theo caiu. Chamei a Miss Ana Paula.', { envolvidos:['c2'] }).join(' | '));
t('e a criança de nome parecido continua sendo achada',
  C.resolverCitacoes('Theo caiu e a Ana Clara avisou.', COM_ANA, {})
    .some(r => r.kid === 'c5'));
t('o sobrenome da Miss não arrasta as Souzas',
  C.resolverCitacoes('A Beatriz Souza levou o Theo à sala.', IDX, { envolvidos:['c2'] })
    .filter(r => r.nivel === 'nao-crianca').length === 1,
  JSON.stringify(ler('A Beatriz Souza levou o Theo à sala.', { envolvidos:['c2'] })));

console.log('\n=== Título antes do nome ===');
/* Cobre o adulto que não tem conta no sistema, e por isso não está no índice. */
for(const [frase, tit] of [
  ['Theo caiu e a Miss Telma acolheu.',        true],
  ['Theo caiu e a tia Telma acolheu.',         true],
  ['Theo caiu e a professora Telma acolheu.',  true],
  ['Theo caiu e a Telma empurrou.',            false]
]){
  const r = C.resolverCitacoes(frase, IDX, { envolvidos:['c2'] })
    .find(x => /telma/i.test(x.texto));
  t(`${tit ? 'com' : 'sem'} título: ${frase}`,
    !!r && (r.nivel === 'nao-crianca') === tit, r && r.nivel);
}
t('"a mãe da Helena" não deixa de ser a Helena',
  C.resolverCitacoes('A mãe da Helena veio buscar.', IDX, {}).some(r => r.kid === 'c1'),
  JSON.stringify(ler('A mãe da Helena veio buscar.')));

console.log('\n=== As regras, na ordem ===');
/* A tabela do plano, linha por linha. São os casos que decidem se o app incomoda a
   Miss à toa ou cala quando devia perguntar. */
const casos = [
  ['sem apoio nenhum, pergunta',
   'Souza empurrou o Theo no pátio.', { envolvidos:['c2'], turmas:['Verde'] },
   'Souza=ambigua | Theo=Theo Martins'],
  ['envolvida no registro decide',
   'Helena Souza e Theo disputavam o balde. Souza ficou com ele.',
   { envolvidos:['c1','c2'], turmas:['Verde'] },
   'Helena Souza=Helena Souza | Theo=Theo Martins | Souza=Helena Souza'],
  ['outro nome dela no texto decide',
   'Ricardo chegou chorando e disse que Souza bateu nele.',
   { envolvidos:['c2'], turmas:['Verde'] },
   'Ricardo=Ricardo Souza | Souza=Ricardo Souza'],
  ['duas envolvidas com o mesmo sobrenome, pergunta',
   'Helena Souza e Telma Souza brigaram. Souza chorou muito.',
   { envolvidos:['c1','c8'], turmas:['Verde'] },
   'Helena Souza=Helena Souza | Telma Souza=Telma Souza | Souza=ambigua']
];
for(const [nome, texto, ctx, esperado] of casos){
  const saiu = ler(texto, ctx).join(' | ');
  t(nome, saiu === esperado, saiu);
}

console.log('\n=== O motivo é dizível ===');
const r1 = C.resolverCitacoes('Helena Souza e Theo brigaram. Souza chorou.', IDX,
  { envolvidos:['c1','c2'] }).find(x => x.texto === 'Souza');
t('resolve como provável, não como certa', r1.nivel === 'provavel', r1.nivel);
t('e diz por quê', /envolvidas/.test(r1.motivo), r1.motivo);
const r2 = C.resolverCitacoes('Theo caiu.', IDX, {}).find(x => x.texto === 'Theo');
t('nome único é certa', r2.nivel === 'certa' && /só uma criança/.test(r2.motivo), r2.motivo);

console.log('\n=== A ordem das candidatas na pergunta ===');
const pend = C.citacoesPendentes('Souza empurrou o Theo no pátio.', IDX,
  { envolvidos:['c2'], turmas:['Verde'] });
t('uma pergunta só', pend.length === 1, JSON.stringify(pend.map(p => p.forma)));
t('todas as quatro candidatas', pend[0].candidatos.length === 4);
t('as da turma das envolvidas primeiro',
  pend[0].candidatos.slice(0, 2).every(p => p.turma === 'Verde'),
  JSON.stringify(pend[0].candidatos.map(p => p.nome + '/' + p.turma)));

console.log('\n=== Uma resposta por forma, não por citação ===');
/* Você escolheu assim: o texto do registro pode ser corrigido antes da ciência, e
   uma resposta amarrada à posição não sobreviveria a isso. */
const tresVezes = 'Souza empurrou. Depois Souza caiu. No fim Souza chorou.';
t('três "Souza" são uma pergunta',
  C.citacoesPendentes(tresVezes, IDX, { envolvidos:['c2'] }).length === 1);
t('e uma resposta resolve as três',
  C.resolverCitacoes(tresVezes, IDX, { guardadas:{ souza:'c7' } })
    .every(r => r.kid === 'c7'),
  JSON.stringify(ler(tresVezes, { guardadas:{ souza:'c7' } })));

console.log('\n=== A resposta guardada vence o cadastro que mudou ===');
/* Uma criança nova se matricula e torna ambígua uma citação que era única quando foi
   escrita. O que já foi confirmado não pode voltar a perguntar. */
const COM_NOVA = C.indiceDePessoas(ESCOLA.concat(
  [{ id:'cX', nome:'Pedro Martins', crianca:true, turma:'Verde' }]));
t('sem resposta, o nome que ficou ambíguo pergunta',
  C.citacoesPendentes('Martins empurrou o balde.', COM_NOVA, {}).length === 1,
  JSON.stringify(C.citacoesPendentes('Martins empurrou o balde.', COM_NOVA, {})));
t('com resposta guardada, não pergunta mais',
  C.citacoesPendentes('Martins empurrou o balde.', COM_NOVA,
    { guardadas:{ martins:'c2' } }).length === 0);
t('e a resposta é respeitada',
  C.resolverCitacoes('Martins empurrou o balde.', COM_NOVA,
    { guardadas:{ martins:'c2' } })[0].kid === 'c2');
t('"não é uma criança" também é uma resposta',
  C.resolverCitacoes('Souza empurrou.', IDX, { guardadas:{ souza:'' } })[0].nivel
    === 'nao-crianca');
t('resposta apontando criança que saiu do cadastro volta a perguntar',
  C.citacoesPendentes('Souza empurrou.', IDX, { guardadas:{ souza:'cZZ' } }).length === 1);

console.log('\n=== Duas crianças de nome idêntico ===');
/* Caso real em escola, e o único em que a dúvida é permanente: nenhuma forma do nome
   distingue as duas. O app tem de perguntar sempre, e a tela mostra turma e idade. */
const GEMEAS = C.indiceDePessoas([
  { id:'g1', nome:'Maria Silva', crianca:true, turma:'Verde',   nascimento:'2022-03-01' },
  { id:'g2', nome:'Maria Silva', crianca:true, turma:'Amarela', nascimento:'2021-08-20' }
]);
const pg = C.citacoesPendentes('Maria Silva derrubou o copo.', GEMEAS, {});
t('pergunta mesmo com o nome inteiro escrito', pg.length === 1, JSON.stringify(pg));
t('e oferece as duas', pg[0] && pg[0].candidatos.length === 2);
t('que só se distinguem por turma e nascimento',
  pg[0].candidatos[0].turma !== pg[0].candidatos[1].turma);
t('estando uma delas envolvida, resolve sem perguntar',
  C.citacoesPendentes('Maria Silva derrubou o copo.', GEMEAS,
    { envolvidos:['g1'] }).length === 0);

console.log('\n=== O bug original: a terceira criança ===');
/* Era o relato: ao gerar o relatório aparecia uma criança de outra família. O
   conserto anterior tirava quem só aparecia por uma forma de alguém já mapeado — uma
   regra de exclusão, que calava a dúvida. Aqui o mesmo caso nem chega a ser dúvida:
   "Helena Souza" é o trecho mais longo, consome o texto, e o "Souza" que arrastava o
   irmão nunca existe como citação separada. */
const BUG = C.indiceDePessoas([
  { id:'c1', nome:'Helena Souza',      crianca:true, turma:'Verde' },
  { id:'c2', nome:'Theo Martins',      crianca:true, turma:'Verde' },
  { id:'cP', nome:'Pedro Souza',       crianca:true, turma:'Azul' },
  { id:'cB', nome:'Ana Beatriz Lima',  crianca:true, turma:'Verde' },
  { id:'cC', nome:'Ana Clara Dias',    crianca:true, turma:'Azul' },
  { id:'cN', nome:'Benício Rocha',     crianca:true, turma:'Verde' }
]);
const quem = (txt, env) => C.resolverCitacoes(txt, BUG, { envolvidos:env })
  .map(r => r.kid).filter(Boolean);
const pergunta = (txt, env) => C.citacoesPendentes(txt, BUG, { envolvidos:env }).length;

let k = quem('Helena Souza e Theo disputavam o carrinho. Theo mordeu a Helena.', ['c1','c2']);
t('o irmão não entra pelo sobrenome', !k.includes('cP'), JSON.stringify(k));
t('e nem precisa perguntar: o trecho mais longo já resolveu',
  pergunta('Helena Souza e Theo disputavam o carrinho.', ['c1','c2']) === 0);

k = quem('Ana Beatriz empurrou o balde.', ['cB']);
t('quem só divide o primeiro nome não entra', !k.includes('cC'), JSON.stringify(k));
t('e a envolvida é achada', k.includes('cB'), JSON.stringify(k));

k = quem('Helena caiu. Benício viu tudo e chamou a Miss.', ['c1']);
t('a testemunha de verdade entra', k.includes('cN'), JSON.stringify(k));

k = quem('Helena caiu e Pedro Souza ajudou a levantar.', ['c1']);
t('citado pelo nome inteiro entra, irmão ou não', k.includes('cP'), JSON.stringify(k));

console.log('\n=== A troca respeita o que foi confirmado ===');
/* O caso que a implementação antiga não tinha como acertar: ela rodava um replace por
   forma de cada nome, e com duas crianças dividindo o sobrenome quem trocasse
   primeiro ficava com a citação — a confirmação da pessoa não entrava na conta. */
const PARES = [
  { kid:'c1', nome:'Helena Souza',  rotulo:'Criança A' },
  { kid:'c7', nome:'Ricardo Souza', rotulo:'Criança B' }
];
const FRASE = 'Helena brigou. Souza chorou depois.';
t('confirmado Ricardo, o "Souza" vira a criança B',
  C.trocarNomes(FRASE, PARES, { guardadas:{ souza:'c7' } })
    === 'A criança A brigou. A criança B chorou depois.',
  C.trocarNomes(FRASE, PARES, { guardadas:{ souza:'c7' } }));
t('confirmado Helena, vira a criança A',
  C.trocarNomes(FRASE, PARES, { guardadas:{ souza:'c1' } })
    === 'A criança A brigou. A criança A chorou depois.',
  C.trocarNomes(FRASE, PARES, { guardadas:{ souza:'c1' } }));
t('sem confirmação o nome sai de todo jeito — errar o rótulo é menos grave que vazar',
  !/Souza/.test(C.trocarNomes(FRASE, PARES)),
  C.trocarNomes(FRASE, PARES));
t('rótulo vazio mantém o nome: é a criança nomeada no comunicado da família dela',
  C.trocarNomes('Helena brigou com Ricardo.',
    [{ kid:'c1', nome:'Helena Souza', rotulo:'' }, PARES[1]])
    === 'Helena brigou com a criança B.',
  C.trocarNomes('Helena brigou com Ricardo.',
    [{ kid:'c1', nome:'Helena Souza', rotulo:'' }, PARES[1]]));
t('a Miss homónima fica, a criança sai',
  C.trocarNomes('A Miss Helena acolheu a Helena.', PARES)
    === 'A Miss Helena acolheu a criança A.',
  C.trocarNomes('A Miss Helena acolheu a Helena.', PARES));

console.log('\n=== Bordas ===');
t('texto vazio não quebra', C.mencoesNoTexto('', IDX).length === 0);
t('texto nulo não quebra', C.mencoesNoTexto(null, IDX).length === 0);
t('índice vazio não quebra', C.mencoesNoTexto('Souza caiu.', new Map()).length === 0);
t('cadastro vazio não quebra', C.indiceDePessoas([]).size === 0);
t('cadastro nulo não quebra', C.indiceDePessoas(null).size === 0);
t('pessoa sem nome é ignorada', C.indiceDePessoas([{ id:'x' }]).size === 0);
t('sem contexto não quebra', C.resolverCitacoes('Theo caiu.', IDX).length === 1);
t('nome repetido no cadastro não duplica a pessoa',
  C.indiceDePessoas([{ id:'c1', nome:'Helena Souza', crianca:true },
                     { id:'c1', nome:'Helena Souza', crianca:true }])
    .get('souza').pessoas.length === 1);

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE CITAÇÕES PASSARAM ===`);
process.exit(falhas ? 1 : 0);
