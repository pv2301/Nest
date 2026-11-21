/* Varre o app aberto procurando palavras que não devem aparecer na interface.

   Abre cada tela e lê o texto realmente renderizado, que é diferente do que o grep
   encontra no código: nomes de classe, funções e comentários não chegam aos olhos de
   ninguém, e o CSS transforma parte do texto em maiúsculas.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

/* O Playwright é carregado por require, como as outras suítes do projeto: o import
   de ESM não consulta NODE_PATH, então uma instalação global não seria encontrada. */
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:430,height:900}});
 const p=await ctx.newPage();
 await p.goto(BASE); await p.waitForTimeout(1500);

 /* Termos que não podem aparecer na interface, e por quê. */
 const PROIBIDOS = [
   [/\bficha\b/i,            'o documento se chama relatório'],
   [/restantes/i,             'o prazo nunca foi calculado; a etiqueta mentia'],
   [/fatos observáveis/i,     'instrução de preenchimento, num documento já preenchido'],
   [/adendo/i,                'não existe tela de adendo'],
 ];

 const achados=[];
 const olhar = async rotulo => {
   const t = await p.locator('body').innerText().catch(()=> '');
   for(const linha of t.split('\n')){
     for(const [termo, porque] of PROIBIDOS){
       if(termo.test(linha)) achados.push(`${rotulo}: "${linha.trim()}" — ${porque}`);
     }
   }
 };

 await olhar('configurar');
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(1800);
 await olhar('biometria');
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2200);

 for(const tela of ['home','lista','ciencia','painel','horario','relacoes','alunos','usuarios','conta','ajuda','novo']){
   await p.evaluate(t=>app.ir(t), tela); await p.waitForTimeout(700);
   await olhar(tela);
 }
 /* telas que precisam de contexto */
 await p.evaluate(()=>app.iniciar('completo')); await p.waitForTimeout(700); await olhar('wizard p1');
 await p.evaluate(()=>app.iniciar('rapido')); await p.waitForTimeout(700); await olhar('rapido');
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(800);
 await p.click('.item'); await p.waitForTimeout(1200); await olhar('detalhe');
 await p.click('button:has-text("Gerar relatório")'); await p.waitForTimeout(900); await olhar('relatorio anonimo');
 await p.evaluate(()=>app.fichaDestino('familia')); await p.waitForTimeout(700); await olhar('relatorio familia');
 await p.evaluate(()=>app.fichaDestino('interna')); await p.waitForTimeout(700); await olhar('relatorio interna');
 await p.evaluate(()=>app.fichaAnonima()); await p.waitForTimeout(700); await olhar('relatorio identificado');
 await p.evaluate(()=>app.ir('usuarios')); await p.waitForTimeout(800); await olhar('usuarios');
 try { await p.locator('.urow').first().click({timeout:3000});
       await p.waitForTimeout(900); await olhar('usuario'); } catch { console.log('(usuário: sem item clicável)'); }
 await p.evaluate(()=>app.ir('alunos')); await p.waitForTimeout(900);
 try { await p.locator('.urow').first().click({timeout:3000});
       await p.waitForTimeout(900); await olhar('aluno'); } catch { console.log('(aluno: sem item clicável)'); }
 await p.evaluate(()=>app.ir('trocarSenha')); await p.waitForTimeout(700); await olhar('trocarSenha');
 await p.evaluate(()=>app.sair()); await p.waitForTimeout(1400); await olhar('entrada');
 await p.click('button:text-is("Entrar")'); await p.waitForTimeout(700); await olhar('entrar');
 await p.evaluate(()=>app.voltar()); await p.waitForTimeout(700);
 await p.click('button:text-is("Criar conta")'); await p.waitForTimeout(800); await olhar('criar');

 /* Antes isto só imprimia e saía com código 0: o runner diria "passou" mesmo com
    termo proibido na tela. */
 console.log(achados.length
   ? `  XX ${achados.length} ocorrência(s):\n       ` + achados.join('\n       ')
   : '  OK nenhum termo proibido aparece na interface');
 await b.close();
 process.exit(achados.length ? 1 : 0);
})();
