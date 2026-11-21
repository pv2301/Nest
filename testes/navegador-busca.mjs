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

 console.log('\n=== registro · busca dentro do campo de crianças ===');
 await p.evaluate(()=>app.iniciar('completo')); await p.waitForTimeout(700);
 await p.evaluate(()=>app.irPasso(2)); await p.waitForTimeout(800);
 await p.evaluate(()=>app.abrirLista('kids')); await p.waitForTimeout(600);
 ok('a lista abriu com busca', (await p.locator('#bl-kids').count()) === 1);
 await espiar('bl-kids');
 await p.locator('#bl-kids').tap();
 for(const ch of 'hel'){ await p.keyboard.type(ch); await p.waitForTimeout(240); }
 const c = await contar();
 ok('digitar não faz o campo perder o foco', c.perdas === 0, 'perdas: ' + c.perdas);
 ok('digitar não redesenha a tela', c.redesenhos === 0, 'redesenhos: ' + c.redesenhos);
 ok('filtrou para uma criança', (await p.locator('.cl-op').count()) === 1,
    'opções: ' + await p.locator('.cl-op').count());
 /* Digitar no meio da palavra, que o cursor forçado ao fim impedia. */
 await p.locator('#bl-kids').fill(''); await p.waitForTimeout(300);
 await p.locator('#bl-kids').tap();
 await p.keyboard.type('hl'); await p.waitForTimeout(250);
 await p.keyboard.press('ArrowLeft'); await p.keyboard.type('e'); await p.waitForTimeout(250);
 ok('dá para inserir letra no meio', (await p.locator('#bl-kids').inputValue()) === 'hel',
    JSON.stringify(await p.locator('#bl-kids').inputValue()));
 ok('escolher na lista marca a criança',
    await (async()=>{ await p.locator('.cl-op').first().click(); await p.waitForTimeout(700);
      return (await p.locator('.tok').count()) === 1; })());

 console.log('\n=== O controle segue o número de opções ===');
 await p.evaluate(()=>app.irPasso(3)); await p.waitForTimeout(700);
 ok('2 opções vêm segmentadas, lado a lado',
    (await p.locator('.seg [role=radio]').count()) === 2,
    'segmentos: ' + await p.locator('.seg [role=radio]').count());
 ok('9 opções vêm como campo com lista',
    (await p.locator('.cl-campo').count()) >= 1);

 console.log('\n=== Teclado ===');
 await p.evaluate(()=>app.abrirLista('local')); await p.waitForTimeout(600);
 ok('a lista abriu', (await p.locator('.cl-ops [role=option]').count()) > 0);
 ok('a lista se anuncia como listbox',
    (await p.locator('.cl-ops[role=listbox]').count()) === 1);
 ok('o campo se anuncia como combobox aberto',
    (await p.locator('.cl-campo[role=combobox][aria-expanded=true]').count()) === 1);
 await p.keyboard.press('Escape'); await p.waitForTimeout(500);
 ok('Esc fecha a lista', (await p.locator('.cl-ops').count()) === 0);
 ok('e devolve o foco ao campo',
    (await p.evaluate(()=>document.activeElement && document.activeElement.id)) === 'cp-local');

 await p.evaluate(()=>app.abrirLista('local')); await p.waitForTimeout(600);
 await p.locator('.cl-ops [role=option]').first().focus();
 await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
 await p.keyboard.press('Enter'); await p.waitForTimeout(700);
 ok('seta e Enter escolhem sem o mouse',
    (await p.locator('.cl-campo .cl-val').first().innerText()).trim().length > 0,
    'valor: ' + (await p.locator('.cl-campo').first().innerText()).trim());

 console.log('\n=== Voltar nativo fecha a lista ===');
 await p.evaluate(()=>app.abrirLista('local')); await p.waitForTimeout(600);
 await p.goBack(); await p.waitForTimeout(800);
 ok('voltar fecha a lista em vez de sair da tela',
    (await p.locator('.cl-ops').count()) === 0 &&
    (await p.locator('.appbar h2').innerText()).includes('Registro'),
    'tela: ' + (await p.locator('.appbar h2').innerText()));

 console.log('\n=== Campo obrigatório em branco ===');
 await p.evaluate(()=>app.irPasso(4)); await p.waitForTimeout(600);
 await p.click('#btn-enviar'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.irPasso(1)); await p.waitForTimeout(700);
 ok('o campo que faltou fica marcado como inválido',
    (await p.locator('[aria-invalid=true]').count()) >= 1,
    'marcados: ' + await p.locator('[aria-invalid=true]').count());
 ok('e diz o que falta junto do campo',
    (await p.locator('.esc.com-erro .erromsg').count()) >= 1);

 console.log(f.length ? `\n=== ${f.length} FALHARAM ===` : '\n=== TUDO PASSOU ===');
 await b.close(); process.exit(f.length?1:0);
})();
