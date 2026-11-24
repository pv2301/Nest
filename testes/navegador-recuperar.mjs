/* Recuperar a senha sem a gestão, no celular, com toque de verdade.

   A tela de login dizia "Esqueceu a senha? Fale com a gestão", e numa sexta à noite
   isso trancava a pessoa fora. Agora ela guarda um código e se vira.

   O que esta suíte prova é o ciclo inteiro — gerar, sair, recuperar, entrar com a
   senha nova — e, do outro lado, que o código some de vista depois de mostrado e que
   ninguém sem ele troca senha nenhuma.

   Toque pelo protocolo do Chromium, não eventos fabricados: é o único jeito de saber
   que estes botões respondem ao dedo.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';
import { abrirToque } from './toque.mjs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };
const texto = p => p.locator('#view').innerText();

(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(1600);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2200);
 await p.click('text=Agora não'); await p.waitForTimeout(900);

 const t = await abrirToque(p);

 console.log('\n=== O código nasce no perfil, com o dedo ===');
 await p.evaluate(()=>app.ir('conta')); await p.waitForTimeout(900);
 ok('o perfil oferece criar o código',
    (await p.locator('.urow:has-text("Código de recuperação")').count()) === 1, await texto(p));
 ok('e diz para que serve antes de criar',
    /trocar a senha sozinha/i.test(await texto(p)), await texto(p));

 await t.tocarElemento('.urow:has-text("Código de recuperação")');
 await p.waitForTimeout(1600);
 const codigo = await p.locator('.codigo').innerText().catch(()=>'');
 ok('o toque gera e mostra o código', /^[0-9A-HJ-NP-Z]{4}(-[0-9A-HJ-NP-Z]{4}){3}$/.test(codigo), codigo);
 ok('avisa que não será mostrado de novo', /não será mostrado de novo/i.test(await texto(p)));

 await t.tocarElemento('button:has-text("Já guardei")');
 await p.waitForTimeout(800);
 ok('depois de guardar, o código some da tela',
    (await p.locator('.codigo').count()) === 0);
 ok('e a linha passa a dizer desde quando existe',
    /Criado em/.test(await p.locator('.urow:has-text("Código")').innerText()),
    await p.locator('.urow:has-text("Código")').innerText());

 console.log('\n=== Esqueceu a senha deixa de ser uma frase morta ===');
 await p.evaluate(()=>app.sair()); await p.waitForTimeout(1600);
 const btn = p.locator('button:text-is("Entrar")');
 if(await btn.count()){ await btn.first().click(); await p.waitForTimeout(800); }
 ok('há um botão, e não um aviso para falar com a gestão',
    (await p.locator('button:has-text("Esqueceu a senha")').count()) === 1, await texto(p));
 ok('o texto antigo sumiu', !/Fale com a gestão/i.test(await texto(p)));

 await t.tocarElemento('button:has-text("Esqueceu a senha")');
 await p.waitForTimeout(1000);
 ok('o toque abre a tela de recuperar', (await p.locator('#r-codigo').count()) === 1, await texto(p));
 ok('que diz o que fazer sem o código', /a gestão redefine/i.test(await texto(p)));

 console.log('\n=== Código errado não troca senha nenhuma ===');
 await p.fill('#r-login','tallita.lima'); await p.fill('#r-codigo','AAAA-BBBB-CCCC-DDDD');
 await p.fill('#r-senha','OutraSenha2026'); await p.fill('#r-senha2','OutraSenha2026');
 await t.tocarElemento('button[type=submit]'); await p.waitForTimeout(2200);
 ok('recusa', /incorret/i.test(await texto(p)), (await texto(p)).slice(0,160));
 ok('e continua na tela de recuperar', (await p.locator('#r-codigo').count()) === 1);

 console.log('\n=== Com o código, ela troca e entra ===');
 await p.fill('#r-login','tallita.lima'); await p.fill('#r-codigo', codigo);
 await p.fill('#r-senha','NovaSenha2026'); await p.fill('#r-senha2','NovaSenha2026');
 await t.tocarElemento('button[type=submit]'); await p.waitForTimeout(2600);
 ok('volta para o login', (await p.locator('#f-login').count()) === 1, await texto(p));
 ok('dizendo que deu certo', /Senha trocada/i.test(await texto(p)), (await texto(p)).slice(0,160));

 await p.fill('#f-login','tallita.lima'); await p.fill('#f-senha','NovaSenha2026');
 await t.tocarElemento('button[type=submit]'); await p.waitForTimeout(2800);
 const dentro = await p.evaluate(()=>!!document.querySelector('.tabbar') ||
   /Desbloqueio/i.test(document.getElementById('view').innerText));
 ok('a senha nova entra', dentro, (await texto(p)).slice(0,160));

 const agora = p.locator('text=Agora não');
 if(await agora.count()){ await agora.click(); await p.waitForTimeout(900); }

 console.log('\n=== O código usado morre ===');
 await p.evaluate(()=>app.sair()); await p.waitForTimeout(1600);
 const b2 = p.locator('button:text-is("Entrar")');
 if(await b2.count()){ await b2.first().click(); await p.waitForTimeout(700); }
 await p.locator('button:has-text("Esqueceu a senha")').click(); await p.waitForTimeout(900);
 await p.fill('#r-login','tallita.lima'); await p.fill('#r-codigo', codigo);
 await p.fill('#r-senha','TerceiraSenha2026'); await p.fill('#r-senha2','TerceiraSenha2026');
 await p.click('button[type=submit]'); await p.waitForTimeout(2200);
 ok('o mesmo código não serve duas vezes', /incorret/i.test(await texto(p)),
    (await texto(p)).slice(0,160));

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
