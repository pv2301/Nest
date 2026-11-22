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

/* As escolhas viraram campo com lista: a suíte aciona o componente diretamente, em
   vez de caçar chips. Quem exercita o componente pela interface é navegador-busca. */
const escolher = (p, id, v) => p.evaluate(([i, x]) => app.escolherLista(i, x), [id, v]);

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
 await escolher(p, 'cat', 'Incidente'); await p.waitForTimeout(350);
 await escolher(p, 'tipo', 'Mordida'); await p.waitForTimeout(350);
 await p.click('.sevpick button[data-n="2"]'); await p.waitForTimeout(350);
 await p.evaluate(()=>app.irPasso(2)); await p.waitForTimeout(700);

 /* Os três primeiros alunos da lista, pelo id e pelo nome. */
 await p.evaluate(()=>app.abrirLista('kids')); await p.waitForTimeout(600);
 const alunos = await p.evaluate(() => Array.from(document.querySelectorAll('.cl-op')).slice(0, 3)
   .map(b => ({ id: (b.getAttribute('onclick').match(/,'([^']+)'/) || [])[1],
                nome: b.querySelector('.cl-nome').textContent.trim() })));
 const [a1, a2, a3] = alunos;
 const n1 = a1.nome, n2 = a2.nome, n3 = a3.nome;
 console.log(`  (crianças do teste: ${n1} / ${n2} / ${n3})`);
 await escolher(p, 'kids', a1.id); await p.waitForTimeout(400);
 await escolher(p, 'kids', a2.id); await p.waitForTimeout(500);
 await escolher(p, 'papel-0', 'Sofreu'); await p.waitForTimeout(250);
 await escolher(p, 'cond-0', 'Permaneceu chorosa'); await p.waitForTimeout(250);
 await escolher(p, 'papel-1', 'Causou'); await p.waitForTimeout(250);

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
 /* Na tabela o rótulo abre maiúsculo; na narrativa ele entra com artigo e vira
    "a criança A". Por isso a comparação ignora a caixa. */
 ok('aparecem Criança A, B e C',
    /criança A/i.test(t) && /criança B/i.test(t) && /criança C/i.test(t), t.slice(0,500));
 ok('na narrativa o rótulo vem com artigo, não solto',
    /\ba criança [ABC]\b/.test(t) || /^A criança [ABC]\b/m.test(t), t.slice(0,500));
 ok('a turma não aparece', !/Turma /.test(t));

 console.log('\n=== A prévia mostra o texto antes de gerar o PDF ===');
 const prev = await p.locator('.previa').innerText().catch(()=>'');
 ok('a prévia aparece no uso interno', /como vai sair/i.test(prev), prev.slice(0,120));
 ok('e já traz o artigo junto do rótulo', /\ba criança [AB]\b|^A criança [AB]\b/mi.test(prev), prev.slice(0,220));
 ok('a prévia não vai ao papel',
    await p.evaluate(()=>{ const e=document.querySelector('.previa');
      return !!e && getComputedStyle(e).display !== 'none'; }));

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
