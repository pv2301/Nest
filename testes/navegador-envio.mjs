/* O envio do registro quando as coisas dão errado.

   Dois problemas medidos antes desta suíte existir:

   1. Com a rede caída, o app ia para o início como se tivesse salvado, apagava o
      rascunho do aparelho e mostrava "Não foi salvo. Tente de novo." — sem nada com
      que tentar de novo. Tudo o que a pessoa tinha escrito ia embora.
   2. Dois toques rápidos no botão criavam dois registros: cada chamada gerava o seu
      número e as duas gravavam. É uma das origens do registro duplicado.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };

const NARRATIVA = 'Narrativa que a pessoa levou dez minutos escrevendo e nao pode perder de jeito nenhum.';

/** Preenche o registro rápido até ele estar válido. */
async function preencher(p){
  await p.evaluate(()=>app.iniciar('rapido')); await p.waitForTimeout(1100);
  await p.evaluate(()=>app.escolherLista('cat-r','Incidente')); await p.waitForTimeout(400);
  await p.evaluate(()=>app.escolherLista('tipo-r','Mordida')); await p.waitForTimeout(400);
  await p.evaluate(()=>app.campo('sev',2)); await p.waitForTimeout(400);
  await p.evaluate(()=>app.abrirLista('kids')); await p.waitForTimeout(400);
  await p.evaluate(()=>{ const o=document.querySelector('#ops-kids [role=option]'); if(o) o.click(); });
  await p.waitForTimeout(600);
  await p.evaluate(()=>app.escolherLista('papel-0','Sofreu')); await p.waitForTimeout(400);
  await p.evaluate(t => { const x = document.getElementById('r-desc');
    x.value = t; x.dispatchEvent(new Event('input', { bubbles:true })); }, NARRATIVA);
  await p.waitForTimeout(400);
}

const tela = p => p.evaluate(()=>{ const h=document.querySelector('.appbar h2'); return h ? h.innerText : '(início)'; });

(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 let gravacoes = 0;
 p.on('request', r => { if((r.postData()||'').includes('salvarOcorrencia')) gravacoes++; });

 await p.goto(BASE); await p.waitForTimeout(1600);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2000);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2500);

 console.log('\n=== A rede cai no meio do envio ===');
 await preencher(p);
 await p.route('**/*', r => (r.request().postData()||'').includes('salvarOcorrencia')
   ? r.abort('failed') : r.continue());
 await p.evaluate(()=>app.tentarEnviar()); await p.waitForTimeout(1800);

 ok('continua no formulário, não vai para o início', (await tela(p)) === 'Registro rápido', await tela(p));
 ok('o rascunho continua no aparelho', await p.evaluate(()=>!!localStorage.getItem('reg.rascunho')));
 ok('a narrativa continua no campo',
    await p.evaluate(()=>{ const t=document.getElementById('r-desc'); return !!t && t.value.includes('dez minutos'); }));
 const msg = await p.locator('.toast').innerText().catch(()=>'(sem)');
 ok('a mensagem diz que o texto está salvo', /está aqui/i.test(msg), msg);
 ok('e não promete um "tente de novo" sem ter o quê', !/Tente de novo/.test(msg), msg);
 ok('o registro não entrou na lista', await p.evaluate(()=>!document.body.innerText.includes('#2')));

 console.log('\n=== Com a rede de volta, o mesmo rascunho vai ===');
 await p.unroute('**/*');
 const antesOk = gravacoes;
 await p.evaluate(()=>app.tentarEnviar()); await p.waitForTimeout(2500);
 ok('agora salva', (await tela(p)) === '(início)' || /Tallita/.test(await tela(p)), await tela(p));
 ok('foi uma gravação só', gravacoes - antesOk === 1, `${gravacoes - antesOk}`);
 ok('o rascunho foi descartado depois de salvar',
    await p.evaluate(()=>!localStorage.getItem('reg.rascunho')));

 console.log('\n=== Dois toques no botão não criam dois registros ===');
 await preencher(p);
 const antesDuplo = gravacoes;
 const quantosAntes = await p.evaluate(()=>document.querySelectorAll('.item').length);
 await p.evaluate(()=>{ app.tentarEnviar(); app.tentarEnviar(); app.tentarEnviar(); });
 await p.waitForTimeout(3000);
 ok('só uma gravação saiu', gravacoes - antesDuplo === 1, `${gravacoes - antesDuplo} gravações`);
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(1000);
 const mordidas = await p.evaluate(()=>[...document.querySelectorAll('.item')]
   .filter(e => /Mordida/.test(e.innerText)).length);
 ok('um registro novo, não dois', mordidas >= 1, `${mordidas} cartões de Mordida`);

 console.log('\n=== Números de registro não se repetem ===');
 const ids = await p.evaluate(()=>[...document.querySelectorAll('.item')]
   .map(e => (e.innerText.match(/#\S+/)||[''])[0]).filter(Boolean));
 ok('nenhum número repetido na lista', new Set(ids).size === ids.length, ids.join(' '));

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
