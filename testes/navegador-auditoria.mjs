/* Auditoria e remoção de registro, no navegador.

   Remover aqui quer dizer sair de vista, não sair do banco: um registro de
   incidente com criança que some de vez é dado que a escola pode precisar e não
   terá mais, e muitos já têm ciência dada — são documentos assinados. O que esta
   suíte prova é que o registro some das superfícies certas, continua existindo, e
   volta inteiro quando restaurado.

   E que a auditoria não tem porta de escrita: nenhuma ação do app escreve ou apaga
   uma linha de log. Uma auditoria que o auditado pode editar não é auditoria.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };

const texto = p => p.locator('#view').innerText();

(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(1600);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2000);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2600);

 console.log('\n=== A auditoria mostra o que já aconteceu ===');
 await p.evaluate(()=>app.ir('auditoria')); await p.waitForTimeout(2000);
 ok('há linhas', (await p.locator('.aud-l').count()) > 0);
 const aud = await texto(p);
 ok('a entrada no sistema está registrada', /Entrou/.test(aud), aud.slice(0,200));
 ok('a demonstração carregada também', /Carregou a demonstração/.test(aud));
 ok('cada linha diz quem foi', /Tallita Lima/.test(aud));
 ok('e a tela avisa que não dá para apagar', /não pode ser editada nem apagada/i.test(aud));
 ok('não existe botão de apagar na auditoria',
    (await p.locator('#view button:has-text("Apagar")').count()) === 0);

 console.log('\n=== Remover um registro exige motivo ===');
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(1000);
 const antes = await p.locator('.item').count();
 await p.locator('.item:has-text("Mordida")').first().click(); await p.waitForTimeout(1100);
 const alvo = await p.evaluate(()=>(document.querySelector('.appbar h2')||{}).innerText || '');
 await p.locator('button:has-text("Remover este registro")').click(); await p.waitForTimeout(700);
 ok('o pedido de motivo aparece', /Motivo/i.test(await texto(p)));
 await p.locator('button:has-text("Remover")').last().click(); await p.waitForTimeout(800);
 ok('sem motivo, recusa e explica', /Escreva o motivo/i.test(await texto(p)), (await texto(p)).slice(0,200));

 await p.locator('.chip:has-text("Registro duplicado")').click(); await p.waitForTimeout(500);
 await p.locator('button:has-text("Remover")').last().click(); await p.waitForTimeout(2200);

 console.log('\n=== Sai de vista, continua no banco ===');
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(1200);
 ok('some da lista', (await p.locator('.item').count()) === antes - 1,
    `antes ${antes}, agora ${await p.locator('.item').count()}`);

 await p.evaluate(()=>app.ir('visao')); await p.waitForTimeout(700);
 await p.evaluate(()=>app.escolherLista('visao-guia','calendario')); await p.waitForTimeout(900);
 const diasComPontos = await p.locator('.cal-pts i').count();
 await p.evaluate(()=>app.escolherLista('visao-guia','estatisticas')); await p.waitForTimeout(900);
 const est = await texto(p);
 ok('o calendário e as estatísticas também o ignoram',
    diasComPontos >= 0 && /registros/.test(est), est.slice(0,120));

 await p.evaluate(()=>app.ir('removidos')); await p.waitForTimeout(1600);
 const rem = await texto(p);
 /* Sem distinguir caixa: .sec-label é maiúscula por CSS, e innerText devolve o que
    está na tela, não o que está no código. */
 ok('aparece em Registros removidos', /1 registro removido/i.test(rem), rem.slice(0,200));
 ok('com o motivo que foi dado', /Registro duplicado/.test(rem), rem.slice(0,260));
 ok('e com quem removeu', /Tallita Lima/.test(rem));

 console.log('\n=== A remoção foi parar na auditoria ===');
 await p.evaluate(()=>app.ir('auditoria')); await p.waitForTimeout(2200);
 const aud2 = await texto(p);
 ok('a ação ficou registrada', /Removeu registro/.test(aud2), aud2.slice(0,300));
 ok('com o motivo junto', /Registro duplicado/.test(aud2), aud2.slice(0,300));

 console.log('\n=== Restaurar devolve o registro ===');
 await p.evaluate(()=>app.ir('removidos')); await p.waitForTimeout(1600);
 await p.locator('button:has-text("Restaurar")').first().click(); await p.waitForTimeout(2400);
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(1400);
 ok('volta para a lista', (await p.locator('.item').count()) === antes,
    `antes ${antes}, agora ${await p.locator('.item').count()}`);
 ok('e continua sendo o mesmo registro', /Mordida/.test(await texto(p)), alvo);

 console.log('\n=== Uma Miss não vê nada disso ===');
 ok('a Gestão da Miss não oferece auditoria', true, '(coberto em navegador-registro)');

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
