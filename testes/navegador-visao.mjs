/* A Visão geral, no navegador.

   Eram duas entradas na Gestão — Painel e Calendário — para o mesmo conjunto de
   registros. Agora é uma tela com três guias, e o que se prova aqui é que cada guia
   mostra o seu conteúdo, que o controle de cada uma fica na sua (o seletor de
   semana/mês/ano só no calendário, o filtro de período só nas outras duas), e que os
   endereços antigos continuam chegando na guia certa.

   Dos destaques, o que importa é o silêncio: sem evidência, nenhuma frase. Um app que
   inventa tendência com três registros faz a equipe parar de registrar.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };

const guia = (p, nome) => p.locator(`.seg button:text-is("${nome}"), .chip:text-is("${nome}")`).first();

(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(1500);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(1800);
 await p.click('text=Agora não'); await p.waitForTimeout(900);

 console.log('\n=== Sem registros, os destaques ficam calados ===');
 await p.evaluate(()=>app.ir('visao')); await p.waitForTimeout(900);
 const vazio = await p.locator('#view').innerText();
 ok('a tela abre nos destaques', (await guia(p, 'Destaques').getAttribute('aria-checked')) === 'true',
    vazio.slice(0, 160));
 ok('sem registros não há frase nenhuma', /Nada a destacar/i.test(vazio), vazio.slice(0, 200));
 ok('e nenhuma tendência inventada', !/tendência|subiu|caiu|concentra/i.test(vazio));

 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2300);
 await p.evaluate(()=>app.ir('visao')); await p.waitForTimeout(1000);

 console.log('\n=== As três guias ===');
 for(const g of ['Destaques','Calendário','Estatísticas'])
   ok(`a guia ${g} existe`, await guia(p, g).count() === 1);

 const d = await p.locator('#view').innerText();
 ok('com a demonstração, algum destaque aparece', /O que salta aos olhos/i.test(d), d.slice(0, 220));

 await guia(p, 'Calendário').click(); await p.waitForTimeout(900);
 const c = await p.locator('#view').innerText();
 ok('o calendário tem o seletor próprio', /Semana/.test(c) && /Mês/.test(c) && /Ano/.test(c), c.slice(0, 200));
 ok('e a guia marcada é a do calendário',
    (await guia(p, 'Calendário').getAttribute('aria-checked')) === 'true');

 await guia(p, 'Estatísticas').click(); await p.waitForTimeout(900);
 const e = await p.locator('#view').innerText();
 ok('as estatísticas mostram as métricas do período', /registros/i.test(e), e.slice(0, 200));
 ok('o seletor semana/mês/ano do calendário não vaza para cá', !/Doze meses|12 meses/i.test(e));
 ok('o filtro de período aparece aqui', /6 meses/.test(e), e.slice(0, 200));
 ok('e também nos destaques', await (async()=>{
     await p.evaluate(()=>app.escolherLista('visao-guia','destaques')); await p.waitForTimeout(700);
     return /6 meses/.test(await p.locator('#view').innerText());
   })());
 ok('mas não no calendário, que tem o seu', await (async()=>{
     await p.evaluate(()=>app.escolherLista('visao-guia','calendario')); await p.waitForTimeout(700);
     return !/6 meses/.test(await p.locator('#view').innerText());
   })());

 console.log('\n=== A guia escolhida sobrevive ao ir e voltar ===');
 await guia(p, 'Estatísticas').click(); await p.waitForTimeout(700);
 await p.evaluate(()=>app.ir('gestao')); await p.waitForTimeout(700);
 await p.evaluate(()=>app.ir('visao')); await p.waitForTimeout(900);
 ok('voltando, continua nas estatísticas',
    (await guia(p, 'Estatísticas').getAttribute('aria-checked')) === 'true');

 console.log('\n=== Os endereços antigos ===');
 for(const [tela, marca] of [['painel','Estatísticas'], ['calendario','Calendário']]){
   await p.evaluate(t=>app.ir(t), tela); await p.waitForTimeout(900);
   ok(`${tela} cai na guia ${marca}`,
      (await guia(p, marca).getAttribute('aria-checked')) === 'true',
      (await p.locator('#view').innerText()).slice(0, 140));
 }

 console.log('\n=== Nada sobre criança além da contagem ===');
 await p.evaluate(()=>app.ir('visao')); await p.waitForTimeout(700);
 await p.evaluate(()=>app.escolherLista('visao-guia','destaques')); await p.waitForTimeout(900);
 const dd = await p.locator('.destaques').innerText().catch(()=>'');
 ok('nenhum adjetivo sobre criança nos destaques',
    !/agressiv|problem|difícil|birra|teimos/i.test(dd), dd.slice(0, 240));
 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));

 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
