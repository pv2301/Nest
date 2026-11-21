/* As cores do evento, conferidas contra a folha de estilo.

   O matiz diz a categoria e a luminosidade diz a gravidade. São duas coisas que
   moram em arquivos diferentes — a categoria em vocabulario.js, a cor em app.css —
   e nada no JavaScript quebra se uma categoria nova nascer sem regra `.cat-*`: o
   ponto simplesmente aparece transparente no calendário, e ninguém percebe até
   alguém perguntar por que terça-feira está vazia.

   Estas asserções são a costura entre os dois arquivos. Também conferem que a escala
   de gravidade continua indo do claro ao escuro nos dois temas, porque o pedido era
   esse e é fácil inverter um valor sem notar. */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* vocabulario.js é módulo ES e o package é commonjs, então o Node não o importa
   pelo caminho. Ele não importa nada, então o data URL resolve — mesma saída que
   nomes.test.mjs usa para util.js. */
const fonteVoc = readFileSync(new URL('../assets/js/vocabulario.js', import.meta.url), 'utf8');
const { CATS, CAT_ID, catId } =
  await import('data:text/javascript;base64,' + Buffer.from(fonteVoc).toString('base64'));

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(AQUI, '..', 'assets', 'css', 'app.css'), 'utf8');

let falhas = 0, total = 0;
const t = (nome, cond, extra) => {
  total++;
  if(cond) console.log('  OK ' + nome);
  else { falhas++; console.log('  XX ' + nome + (extra ? '\n       ' + extra : '')); }
};

/** Luminância relativa de um #rrggbb, pela fórmula do WCAG. */
function lum(hex){
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

console.log('\n=== Toda categoria tem cor ===');
for(const nome of Object.keys(CATS)){
  const id = catId(nome);
  t(`${nome} tem identificador`, !!id, 'catId devolveu vazio');
  t(`${nome} tem regra .cat-${id}`, new RegExp(`\\.cat-${id}\\s*\\{`).test(css));
}
t('nenhum identificador sobra em CAT_ID',
  Object.keys(CAT_ID).every(k => k in CATS),
  Object.keys(CAT_ID).filter(k => !(k in CATS)).join(', '));
t('os identificadores são únicos',
  new Set(Object.values(CAT_ID)).size === Object.values(CAT_ID).length);
t('categoria desconhecida não inventa classe', catId('Categoria que não existe') === '');

console.log('\n=== A escala de gravidade vai do claro ao escuro ===');
/* Os quatro passos de cada tema, lidos da folha: --sevN:#rrggbb */
const temas = {
  claro:  css.slice(css.indexOf(':root{'), css.indexOf('@media (prefers-color-scheme:dark)')),
  escuro: css.slice(css.indexOf(':root[data-theme="dark"]{'))
};
for(const [tema, trecho] of Object.entries(temas)){
  const passos = [1, 2, 3, 4].map(n => {
    const m = trecho.match(new RegExp(`--sev${n}:\\s*(#[0-9A-Fa-f]{6})`));
    return m && m[1];
  });
  t(`tema ${tema}: os quatro passos existem`, passos.every(Boolean), JSON.stringify(passos));
  if(!passos.every(Boolean)) continue;
  const l = passos.map(lum);
  t(`tema ${tema}: cada passo é mais escuro que o anterior`,
    l[0] > l[1] && l[1] > l[2] && l[2] > l[3],
    passos.map((p, i) => `${p}=${l[i].toFixed(3)}`).join(' '));

  /* A tinta de cada passo tem de ser legível sobre ele. 11px em negrito não conta
     como texto grande: o alvo é 4,5:1. */
  for(const n of [1, 2, 3, 4]){
    const fundo = trecho.match(new RegExp(`--sev${n}:\\s*(#[0-9A-Fa-f]{6})`))[1];
    const tinta = trecho.match(new RegExp(`--sev${n}-t:\\s*(#[0-9A-Fa-f]{6})`));
    t(`tema ${tema}: a tinta do nível ${n} é legível`,
      !!tinta && contraste(fundo, tinta[1]) >= 4.5,
      tinta ? `${contraste(fundo, tinta[1]).toFixed(2)}:1` : 'sem --sev' + n + '-t');
  }
}

console.log(`\n=== ${total} TESTES DE CORES ${falhas ? 'FALHARAM ' + falhas : 'PASSARAM'} ===`);
process.exit(falhas ? 1 : 0);
