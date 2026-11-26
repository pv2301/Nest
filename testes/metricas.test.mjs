/* O tamanho da grade do "quando e onde", e os locais que ela mostra.

   Duas coisas que decidem se a tabela cabe na tela, e as duas são aritmética pura —
   então ficam aqui, sem navegador.

   A primeira nasceu de um pedido: a tela cheia tem de se dimensionar pela tela que
   abre. Tentei resolver só com CSS e não dá — `minmax(34px,1fr)` enche mas não tem
   teto, `minmax(34px,72px)` leva toda trilha ao teto. Daí a conta, e daí este teste:
   é ele que trava o piso, o teto e o "cabe ou rola". */

import { readFileSync } from 'node:fs';

/* metricas.js e vocabulario.js são módulos ES num package commonjs, então o Node não
   os importa pelo caminho — apontar para o `file://` de um .js o faz ler como
   CommonJS, e os exports nomeados somem.

   O rodeio: cada um vira um data URL, e o import relativo de metricas.js é trocado
   pelo data URL de vocabulario.js, aninhado. Mesma saída de cores.test.mjs e
   nomes.test.mjs; o dia em que isto incomodar, o arquivo vira .mjs como citacoes. */
const dataUrl = fonte => 'data:text/javascript;base64,' + Buffer.from(fonte).toString('base64');
const urlVoc = dataUrl(readFileSync(new URL('../assets/js/vocabulario.js', import.meta.url), 'utf8'));
const fonte = readFileSync(new URL('../assets/js/metricas.js', import.meta.url), 'utf8')
  .replace(/'\.\/vocabulario\.js'/g, JSON.stringify(urlVoc));
const M = await import(dataUrl(fonte));

let falhas = 0, total = 0;
const t = (nome, cond, extra) => {
  total++;
  if(cond) console.log('  OK ' + nome);
  else { falhas++; console.log('  XX ' + nome + (extra ? '\n       ' + extra : '')); }
};

/* As áreas úteis que medi na tela cheia, com o palco girado no retrato. */
const TELAS = {
  'telefone estreito': { largura: 784,  altura: 316 },
  'telefone':          { largura: 899,  altura: 368 },
  'tablet':            { largura: 1008, altura: 724 },
  'monitor':           { largura: 1424, altura: 856 }
};
const lado = (tela, horas, locais) => {
  const a = TELAS[tela];
  return M.ladoDaCelula({ largura: a.largura, altura: a.altura, horas, locais,
    colunaNomes: M.colunaDeNomes(a.largura), linhaHoras: M.LINHA_HORAS });
};
/** A grade inteira cabe na área, ou vai rolar? A conta é a de montar a grade: a
    coluna de nomes e a linha das horas, mais `n` células com um vão cada. */
const cabe = (tela, horas, locais) => {
  const a = TELAS[tela], x = lado(tela, horas, locais);
  return M.colunaDeNomes(a.largura) + horas * (x + 3) <= a.largura + 1
      && M.LINHA_HORAS + locais * (x + 3) <= a.altura + 1;
};

console.log('\n=== A célula cresce com a tela ===');
/* Um dia escolar inteiro: é o caso que motivou a tela cheia. No cartão, 172px da
   tabela ficavam fora da tela. */
const dozeHoras = Object.keys(TELAS).map(k => lado(k, 12, 8));
t('cresce do telefone estreito ao monitor',
  dozeHoras.every((x, i) => i === 0 || x >= dozeHoras[i - 1]),
  JSON.stringify(dozeHoras));
t('no telefone de 412px um dia de 12h cabe inteiro, sem rolar',
  cabe('telefone', 12, 8), 'lado=' + lado('telefone', 12, 8));
t('e a célula fica maior que os 34px do cartão',
  lado('telefone', 12, 8) > 34, String(lado('telefone', 12, 8)));
t('no tablet é maior ainda', lado('tablet', 12, 8) > lado('telefone', 12, 8),
  lado('tablet', 12, 8) + ' vs ' + lado('telefone', 12, 8));

console.log('\n=== O piso: encolher menos que isto não se lê ===');
t('dia de 14h e 10 locais num telefone estreito vai ao piso',
  lado('telefone estreito', 14, 10) === M.CELULA_MIN,
  String(lado('telefone estreito', 14, 10)));
t('e aí a grade rola, em vez de espremer a célula',
  !cabe('telefone estreito', 14, 10));
t('nunca abaixo do piso, nem no absurdo',
  M.ladoDaCelula({ largura: 100, altura: 100, horas: 24, locais: 30 }) === M.CELULA_MIN);

console.log('\n=== O teto: acima disto é quadrado vazio ===');
/* Sem teto, 6 horas e 3 locais num monitor davam 192x212px. */
t('período curto num monitor para no teto',
  lado('monitor', 6, 3) === M.CELULA_MAX, String(lado('monitor', 6, 3)));
t('e no telefone também, quando sobra espaço',
  lado('telefone', 4, 2) === M.CELULA_MAX, String(lado('telefone', 4, 2)));
t('nunca acima do teto',
  M.ladoDaCelula({ largura: 9000, altura: 9000, horas: 1, locais: 1 }) === M.CELULA_MAX);

console.log('\n=== A célula é quadrada, e manda o eixo mais apertado ===');
/* Muita hora e pouco local: a largura é que limita. Pouca hora e muito local: a
   altura. Quem decide é o menor dos dois, senão a grade estoura num dos eixos. */
t('com muitas horas manda a largura',
  M.ladoDaCelula({ largura: 400, altura: 4000, horas: 10, locais: 2, colunaNomes: 100 }) < 40);
t('com muitos locais manda a altura',
  M.ladoDaCelula({ largura: 4000, altura: 400, horas: 2, locais: 10, colunaNomes: 100 }) < 40);

console.log('\n=== A coluna dos nomes ===');
t('não encolhe abaixo de 96px', M.colunaDeNomes(300) === 96, String(M.colunaDeNomes(300)));
t('cresce com a tela', M.colunaDeNomes(899) > 96 && M.colunaDeNomes(899) <= 140,
  String(M.colunaDeNomes(899)));
t('e para em 140px', M.colunaDeNomes(4000) === 140, String(M.colunaDeNomes(4000)));

console.log('\n=== Bordas ===');
t('zero hora não divide por zero',
  Number.isFinite(M.ladoDaCelula({ largura: 400, altura: 400, horas: 0, locais: 0 })));
t('sem argumento nenhum devolve o piso',
  M.ladoDaCelula({}) === M.CELULA_MIN);

console.log('\n=== Todos os locais, quando há espaço ===');
/* O cartão corta nos 6 locais com mais registros, por falta de espaço. A tela cheia
   chama a MESMA função sem limite — é o parâmetro que já existia. */
const reg = (local, hora) => ({ local, quandoISO: new Date(2026, 10, 10, hora).toISOString(),
  envolvidos: [] });
const ocs = ['Pátio externo', 'Sala de aula', 'Refeitório', 'Parque de areia',
             'Corredor', 'Banheiro', 'Quadra', 'Entrada / portaria']
  .map((l, i) => reg(l, 8 + i));
t('o cartão mostra 6', M.agregaPorHoraLocal(ocs).linhas.length === 6,
  String(M.agregaPorHoraLocal(ocs).linhas.length));
t('a tela cheia mostra todos', M.agregaPorHoraLocal(ocs, Infinity).linhas.length === 8,
  String(M.agregaPorHoraLocal(ocs, Infinity).linhas.length));
t('e as horas são as mesmas nos dois',
  M.agregaPorHoraLocal(ocs).horas.join() === M.agregaPorHoraLocal(ocs, Infinity).horas.join());

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE MÉTRICAS PASSARAM ===`);
process.exit(falhas ? 1 : 0);
