/* O relatório, conferido no navegador: é a única forma de ver o que realmente vai ao
   papel, porque a anonimização acontece ao desenhar o documento.

   O que estes testes travam: com a marca "sem identificar" ligada, nenhum nome de
   criança pode aparecer — nem na tabela, nem na narrativa, nem na criança citada de
   passagem; a legenda de quem é quem fica na tela e nunca na impressão; e no
   comunicado a criança daquela família sai nomeada enquanto as outras não.

   Precisa de um servidor local novo: o banco em memória guarda o estado, e uma
   segunda execução encontraria a escola já configurada. `npm run test:navegador`
   cuida disso. */

import { createRequire } from 'node:module';

/* O Playwright é carregado por require, como as outras suítes do projeto: o import
   de ESM não consulta NODE_PATH, então uma instalação global não seria encontrada. */
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };
const prim = n => n.split(' ')[0];
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:430,height:900}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(1500);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(1800);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2200);

 /* Duas crianças envolvidas e uma terceira citada só na narrativa: é o caso que a
    anonimização de fachada deixava passar. */
 await p.evaluate(()=>app.iniciar('completo')); await p.waitForTimeout(700);
 await p.click('.chip:text-is("Incidente")'); await p.waitForTimeout(350);
 await p.click('.chip:text-is("Mordida")'); await p.waitForTimeout(350);
 await p.click('.sevpick button[data-n="2"]'); await p.waitForTimeout(350);
 await p.evaluate(()=>app.irPasso(2)); await p.waitForTimeout(700);
 /* O chip é: iniciais, nome, turma. O nome é a linha do meio — pegar a última
    trazia a TURMA, e a narrativa do teste saía com "Verde e Verde". */
 const nomeDoChip = async i => {
   const linhas = (await p.locator('.chip.kid').nth(i).innerText())
     .split('\n').map(x => x.trim()).filter(Boolean);
   return linhas[1] || linhas[0];
 };
 const n1 = await nomeDoChip(0), n2 = await nomeDoChip(1), n3 = await nomeDoChip(2);
 console.log(`  (crianças do teste: ${n1} / ${n2} / ${n3})`);
 await p.locator('.chip.kid').nth(0).click(); await p.waitForTimeout(450);
 await p.locator('.chip.kid').nth(1).click(); await p.waitForTimeout(450);
 const cartoes=p.locator('.card.flat:has(.chip.sm)');
 await cartoes.nth(0).locator('.chip.sm:text-is("Sofreu")').click(); await p.waitForTimeout(250);
 await cartoes.nth(0).locator('.chip.sm:text-is("Permaneceu chorosa")').click(); await p.waitForTimeout(250);
 await cartoes.nth(1).locator('.chip.sm:text-is("Causou")').click(); await p.waitForTimeout(250);

 await p.evaluate(()=>app.irPasso(3)); await p.waitForTimeout(700);
 const DESC = `${prim(n1)} e ${prim(n2)} disputavam o balde. ${prim(n2)} mordeu a mão de ${prim(n1)}. ${prim(n3)} chamou a Miss.`;
 await p.fill('#w-desc', DESC); await p.waitForTimeout(400);
 await p.evaluate(()=>app.irPasso(4)); await p.waitForTimeout(600);
 await p.click('button:text-is("Enviar registro")'); await p.waitForTimeout(2600);

 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(900);
 await p.click('.item'); await p.waitForTimeout(1300);
 await p.click('button:has-text("Gerar relatório")'); await p.waitForTimeout(900);

 console.log('\n=== Padrão: uso interno, sem identificar ===');
 let t = await p.locator('.ficha').innerText();
 ok('nasce em Uso interno', await p.locator('.chip[aria-pressed=true]:text-is("Uso interno")').count()===1);
 ok('nasce com Sem identificar marcado',
    (await p.locator('.switch:has-text("Sem identificar")').getAttribute('aria-pressed'))==='true');
 ok('a tabela não nomeia ninguém',
    !t.includes(prim(n1)) && !t.includes(prim(n2)), t.slice(0,400));
 ok('a NARRATIVA também não nomeia — era aqui que vazava', !t.includes(prim(n1)) && !t.includes(prim(n2)));
 ok('a criança citada de passagem também sumiu', !t.includes(prim(n3)), 'ainda cita '+n3);
 ok('aparecem Criança A, B e C', /Criança A/.test(t) && /Criança B/.test(t) && /Criança C/.test(t), t.slice(0,500));
 ok('a turma não aparece', !/Turma /.test(t));

 console.log('\n=== Legenda: na tela, nunca no papel ===');
 const leg = await p.locator('#view').innerText();
 ok('a tela mostra quem é quem', /quem é quem/i.test(leg) && leg.includes(n1) && leg.includes(n2),
    'legenda: ' + (leg.split('\n').filter(l => l.includes('Criança') || /quem é quem/i.test(l)).join(' | ')));
 ok('a legenda marca quem foi só citada', /citada na narrativa/.test(leg));
 await p.emulateMedia({media:'print'}); await p.waitForTimeout(400);
 ok('a legenda NÃO vai para o papel', !(await p.locator('text=Quem é quem').first().isVisible()));
 const papel = await p.locator('.ficha').innerText();
 ok('no papel não há nome de criança nenhum',
    !papel.includes(prim(n1)) && !papel.includes(prim(n2)) && !papel.includes(prim(n3)));
 await p.emulateMedia({media:'screen'}); await p.waitForTimeout(300);

 console.log('\n=== Desmarcando, os nomes voltam ===');
 await p.click('.switch:has-text("Sem identificar")'); await p.waitForTimeout(700);
 t = await p.locator('.ficha').innerText();
 ok('os nomes voltam na tabela e na narrativa',
    t.includes(prim(n1)) && t.includes(prim(n2)) && t.includes(prim(n3)), t.slice(0,400));
 ok('a turma volta', /Turma /.test(t));

 console.log('\n=== Para a família ===');
 await p.click('.chip:text-is("Para a família")'); await p.waitForTimeout(700);
 await p.click('.switch:has-text("Sem identificar")'); await p.waitForTimeout(700);
 ok('voltou a marcar Sem identificar',
    (await p.locator('.switch:has-text("Sem identificar")').getAttribute('aria-pressed'))==='true');
 t = await p.locator('.ficha').innerText();
 ok('é um comunicado', /Comunicado de ocorrência/.test(t));
 ok('a criança daquela família sai NOMEADA', t.includes(prim(n1)), t.slice(0,300));
 ok('a outra envolvida, não', !t.includes(prim(n2)), t.slice(0,400));
 ok('a citada de passagem, também não', !t.includes(prim(n3)));
 ok('a legenda diz que ela é a nomeada', /nomeada no documento/.test(await p.locator('#view').innerText()));
 await p.emulateMedia({media:'print'}); await p.waitForTimeout(400);
 await p.emulateMedia({media:'screen'});

 ok('nenhum erro de JavaScript', errs.length===0, errs.join(' | '));
 console.log(f.length ? `\n=== ${f.length} FALHARAM: ${f.join(', ')} ===` : '\n=== TUDO PASSOU ===');
 await b.close(); process.exit(f.length?1:0);
})();
