/* O perfil e o tema, no navegador.

   O tema é a parte que mais fácil quebra sem alguém perceber: a escolha pode ser
   aplicada na raiz e não ser guardada, ou ser guardada e não ser lida antes da
   pintura — e aí a tela pisca no tema do sistema a cada abertura. Por isso o teste
   recarrega a página em vez de só clicar.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };
const tema = p => p.evaluate(() => document.documentElement.dataset.theme || 'sistema');

(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:430,height:900}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(1500);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2000);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.ir('conta')); await p.waitForTimeout(900);

 console.log('\n=== A tela está em três grupos ===');
 const t = await p.locator('#view').innerText();
 for(const g of ['Aparência','Este aparelho','Conta'])
   ok(`o grupo ${g} existe`, new RegExp(g, 'i').test(t), t.slice(0, 220));
 ok('o papel não é repetido numa linha de ficha', !/^Perfil$/mi.test(t), t.slice(0, 220));
 ok('o jargão "modo compartilhado" saiu', !/compartilhado/i.test(t), t);
 ok('o estado do desbloqueio não é dito duas vezes',
    (t.match(/desbloqueio rápido/gi) || []).length === 1, t);
 /* Sem o /i de propósito: "painel" minúsculo é o identificador interno, "Painel de
    estatísticas" é o nome que a Gestão escreve. */
 ok('a função aparece pelo nome, não pelo identificador',
    !/: *painel\b/.test(t) && /Painel de estatísticas/.test(t), t);
 ok('sair da conta está na tela', /Sair da conta/i.test(t));

 console.log('\n=== O tema é escolhido aqui ===');
 ok('começa seguindo o sistema', await tema(p) === 'sistema');
 ok('as três opções aparecem',
    (await p.locator('.seg button').count()) === 3,
    await p.locator('.seg').innerText());
 ok('cada opção tem o seu ícone',
    (await p.locator('.seg button svg').count()) === 3);

 await p.locator('.seg button:has-text("Escuro")').click(); await p.waitForTimeout(700);
 ok('escolher Escuro aplica na raiz', await tema(p) === 'dark');
 ok('e a cor da barra do navegador acompanha',
    (await p.evaluate(()=>document.querySelector('meta[name=theme-color]').content)) === '#101713');

 await p.reload(); await p.waitForTimeout(2300);
 ok('a escolha sobrevive a recarregar a página', await tema(p) === 'dark');
 /* O ponto do script no <head>: o atributo tem de existir antes de o app desenhar,
    senão a tela pisca clara a cada abertura. */
 const p2 = await ctx.newPage();
 await p2.goto(BASE, { waitUntil:'domcontentloaded' });
 ok('e já está aplicada antes de o app desenhar',
    (await p2.evaluate(()=>document.documentElement.dataset.theme)) === 'dark');
 await p2.close();

 await p.evaluate(()=>app.ir('conta')); await p.waitForTimeout(800);
 await p.locator('.seg button:has-text("Claro")').click(); await p.waitForTimeout(600);
 ok('Claro aplica o tema claro', await tema(p) === 'light');
 await p.locator('.seg button:has-text("Sistema")').click(); await p.waitForTimeout(600);
 ok('Sistema devolve a decisão ao aparelho', await tema(p) === 'sistema');

 console.log('\n=== Para começar não oferece mais compartilhar o link ===');
 await p.evaluate(()=>app.ir('home')); await p.waitForTimeout(900);
 const h = await p.locator('#view').innerText();
 ok('o passo saiu', !/compartilhe o link/i.test(h), h.slice(0, 300));
 ok('os dois que sobraram continuam',
    /Cadastre as turmas/i.test(h) && /Cadastre os alunos/i.test(h), h.slice(0, 300));

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
