/* A digitação na busca, medida em perfil de celular.

   O relato era "a pesquisa por aluno não funciona". A filtragem estava certa; o
   caminho é que estava errado: cada tecla chamava render(), que troca o HTML inteiro
   da tela e destrói o campo em foco. Na área de trabalho o foco é reconectado e
   ninguém percebe; no celular o teclado preditivo perde a sessão de composição, e é
   aí que letras somem.

   Estas asserções falham com o código antigo: quatro letras produziam quatro perdas
   de foco e cinco redesenhos. Agora a digitação reescreve só a lista.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

/* Carregado por require, como as outras suítes: o import de ESM não consulta
   NODE_PATH e não acharia uma instalação global. */
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };
(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
 await p.goto(BASE); await p.waitForTimeout(1800);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2000);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2300);

 const espiar = async (campo) => p.evaluate(id => {
   window.__p = 0; window.__r = 0;
   new MutationObserver(() => { window.__r++; }).observe(document.getElementById('view'), {childList:true});
   document.addEventListener('focusout', e => { if(e.target.id === id) window.__p++; }, true);
 }, campo);
 const contar = () => p.evaluate(()=>({ perdas: window.__p, redesenhos: window.__r }));

 for(const [tela, campo, texto, alvo] of [
   ['alunos', 'b-al',    'alic', '.urow[onclick^="app.abrirAluno"]'],
   ['lista',  'b-lista', 'mord', '.item'],
 ]){
   console.log(`\n=== ${tela} · #${campo} ===`);
   await p.evaluate(t=>app.ir(t), tela); await p.waitForTimeout(1100);
   await espiar(campo);
   await p.locator('#'+campo).tap();
   for(const ch of texto){ await p.keyboard.type(ch); await p.waitForTimeout(240); }
   const c = await contar();
   ok('digitar não faz o campo perder o foco', c.perdas === 0, 'perdas: ' + c.perdas);
   ok('digitar não redesenha a tela', c.redesenhos === 0, 'redesenhos: ' + c.redesenhos);
   ok('o campo manteve o que foi digitado',
      (await p.locator('#'+campo).inputValue()) === texto);
   ok('a lista filtrou', (await p.locator(alvo).count()) >= 1 && (await p.locator(alvo).count()) < 6,
      'linhas: ' + await p.locator(alvo).count());
   for(let i=0;i<texto.length;i++){ await p.keyboard.press('Backspace'); await p.waitForTimeout(200); }
   ok('apagar tudo devolve a lista completa', (await p.locator(alvo).count()) > 2,
      'linhas: ' + await p.locator(alvo).count());
 }

 console.log('\n=== registro · #b-aluno ===');
 await p.evaluate(()=>app.iniciar('completo')); await p.waitForTimeout(700);
 await p.evaluate(()=>app.irPasso(2)); await p.waitForTimeout(800);
 await espiar('b-aluno');
 await p.locator('#b-aluno').tap();
 for(const ch of 'hel'){ await p.keyboard.type(ch); await p.waitForTimeout(240); }
 const c = await contar();
 ok('digitar não faz o campo perder o foco', c.perdas === 0, 'perdas: ' + c.perdas);
 ok('digitar não redesenha a tela', c.redesenhos === 0, 'redesenhos: ' + c.redesenhos);
 ok('filtrou para uma criança', (await p.locator('.pick.kid').count()) === 1);
 /* Digitar no meio da palavra, que o cursor forçado ao fim impedia. */
 await p.locator('#b-aluno').fill(''); await p.waitForTimeout(300);
 await p.locator('#b-aluno').tap();
 await p.keyboard.type('hl'); await p.waitForTimeout(250);
 await p.keyboard.press('ArrowLeft'); await p.keyboard.type('e'); await p.waitForTimeout(250);
 ok('dá para inserir letra no meio', (await p.locator('#b-aluno').inputValue()) === 'hel',
    JSON.stringify(await p.locator('#b-aluno').inputValue()));

 console.log(f.length ? `\n=== ${f.length} FALHARAM ===` : '\n=== TUDO PASSOU ===');
 await b.close(); process.exit(f.length?1:0);
})();
