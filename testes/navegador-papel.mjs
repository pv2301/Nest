/* Escolher as crianças e marcar o papel de cada uma, só com o dedo.

   Isto virou suíte depois de um relato: "em Papel nesta ocorrência não é possível
   selecionar". A varredura de toque não pegava, e não pegaria nunca — ela abre cada
   tela do zero, e o campo de papel só existe depois de uma criança escolhida.

   O que estava errado não era o chip, que tem 44px e responde. Era a lista de
   crianças: por ser de escolha múltipla ela não fecha a cada toque, de propósito, e
   sem uma saída explícita virava armadilha. Ela ocupa 46vh com rolagem própria e
   overscroll-behavior:contain, então quem tentava rolar para alcançar o campo
   seguinte rolava a lista por dentro e a página não andava. Medido num Pixel 7 com
   duas crianças escolhidas: o primeiro chip de papel ficava em y=975 numa tela de
   915. Tocar fora fecharia, mas os campos de baixo estão dentro de um .esc, e o
   handler de fora ignora o que está dentro de um.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';
import { abrirToque, instrumentar, zerar, chamadas } from './toque.mjs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };

/* Escolha única marca com aria-checked; só a múltipla usa aria-pressed. Conferir só
   um dos dois dá falso negativo — já me enganou uma vez. */
const marcado = (p, sel, i) => p.evaluate(([s, n]) => {
  const bs = document.querySelectorAll(`${s} button`);
  return !!bs[n] && (bs[n].getAttribute('aria-checked') === 'true' ||
                     bs[n].getAttribute('aria-pressed') === 'true');
}, [sel, i]);

(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));

 await p.goto(BASE); await p.waitForTimeout(1700);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2300);
 await p.click('text=Agora não'); await p.waitForTimeout(800);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2500);

 const t = await abrirToque(p);
 await instrumentar(p);
 await p.evaluate(()=>app.iniciar('rapido')); await p.waitForTimeout(1100);

 console.log('\n=== Escolher duas crianças ===');
 await t.tocarElemento('#cp-kids'); await p.waitForTimeout(700);
 ok('a lista abre ao toque', (await p.locator('#ops-kids').count()) === 1);
 await t.tocarElemento('#ops-kids [role=option] >> nth=0'); await p.waitForTimeout(600);
 ok('a lista continua aberta depois da primeira — é escolha múltipla',
    (await p.locator('#ops-kids').count()) === 1);
 await t.tocarElemento('#ops-kids [role=option] >> nth=1'); await p.waitForTimeout(800);

 console.log('\n=== A saída da lista ===');
 ok('há um botão para sair da lista', (await p.locator('.cl-pronto').count()) === 1,
    await p.locator('#view').innerText().then(x=>x.slice(0,200)));
 ok('que diz quantas foram escolhidas',
    /Pronto\s*·\s*2/.test(await p.locator('.cl-pronto').innerText()),
    await p.locator('.cl-pronto').innerText());
 ok('e está dentro da tela, alcançável pelo dedo', await p.evaluate(()=>{
    const r = document.querySelector('.cl-pronto').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.height >= 44;
 }));

 await zerar(p);
 await t.tocarElemento('.cl-pronto'); await p.waitForTimeout(800);
 ok('tocar nele fecha a lista', (await p.locator('#ops-kids').count()) === 0);

 console.log('\n=== Marcar o papel de cada criança ===');
 const quantos = await p.locator('[data-escolha^="papel-"]').count();
 ok('há um campo de papel por criança', quantos === 2, String(quantos));

 /* O papel virou campo com lista, como todo campo de formulário: abrir e escolher.
    Antes era chip, e o toque ia direto no segundo botão do grupo. */
 for(let c = 0; c < quantos; c++){
   const id = await p.locator('[data-escolha^="papel-"]').nth(c).getAttribute('data-escolha');
   const dentroDaTela = await p.evaluate(x => {
     const e = document.querySelector(`[data-escolha="${x}"]`);
     e.scrollIntoView({ block:'center' });
     const r = e.getBoundingClientRect();
     return r.top >= 0 && r.bottom <= window.innerHeight;
   }, id);
   ok(`${id}: dá para chegar nele`, dentroDaTela);

   await zerar(p);
   await t.tocarElemento(`[data-escolha="${id}"] .cl-campo`);
   await p.waitForTimeout(600);
   ok(`${id}: o toque abre a lista`, (await p.locator(`#ops-${id}`).count()) === 1);

   await zerar(p);
   await t.tocarElemento(`#ops-${id} [role=option] >> nth=0`);
   await p.waitForTimeout(600);
   ok(`${id}: escolher dispara`, !!(await chamadas(p)).escolherLista);
   ok(`${id}: e o papel fica escrito no campo`,
      (await p.locator(`[data-escolha="${id}"] .cl-val`).count()) === 1,
      await p.locator(`[data-escolha="${id}"]`).innerText().catch(()=>''));
 }

 ok('a validação para de cobrar o papel',
    !/Marcar o papel/.test(await p.locator('#view').innerText()));
 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));

 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
