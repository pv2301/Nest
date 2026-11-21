/* Puxar para atualizar, em perfil de celular com toque.

   O que pode quebrar sem aparecer: o gesto roubar a rolagem normal (arrastar no meio
   da lista deixa de rolar), disparar com um deslize curto, ou não chamar o servidor
   de verdade. As três estão aqui.

   O Playwright não tem um "arrastar com o dedo" pronto: os eventos de toque são
   despachados à mão, que é também o jeito de medir se preventDefault foi chamado.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };

/** Arrasta o dedo verticalmente sobre #scroll, em passos, e devolve o que aconteceu. */
const puxar = (p, px, passos = 8) => p.evaluate(async ([total, n]) => {
  const alvo = document.getElementById('scroll');
  const toque = (tipo, y) => {
    const t = new Touch({ identifier:1, target:alvo, clientX:200, clientY:y });
    const e = new TouchEvent(tipo, { touches: tipo === 'touchend' ? [] : [t],
      changedTouches:[t], bubbles:true, cancelable:true });
    alvo.dispatchEvent(e);
    return e.defaultPrevented;
  };
  const y0 = 300;
  toque('touchstart', y0);
  let barrou = false;
  for(let i = 1; i <= n; i++){
    await new Promise(r => setTimeout(r, 16));
    if(toque('touchmove', y0 + (total * i / n))) barrou = true;
  }
  const desceu = getComputedStyle(document.getElementById('view')).transform;
  toque('touchend', y0 + total);
  return { barrou, desceu };
}, [px, passos]);

(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 let chamadas = 0;
 p.on('request', r => { if(r.method() === 'POST' && (r.postData()||'').includes('sincronizar')) chamadas++; });

 await p.goto(BASE); await p.waitForTimeout(1500);

 console.log('\n=== Antes do login o gesto não se arma ===');
 let r = await puxar(p, 200);
 ok('arrastar não desce a tela de entrada', r.desceu === 'none', r.desceu);

 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2000);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2400);

 console.log('\n=== O conteúdo segue o dedo ===');
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(900);
 r = await puxar(p, 180);
 /* matrix(a,b,c,d,tx,ty): o deslocamento vertical é o sexto número. */
 const px = m => m === 'none' ? 0 : Math.round(Number(m.match(/-?[\d.]+/g)[5]));
 ok('a tela desce ao arrastar do topo', px(r.desceu) > 20, r.desceu);
 ok('mas com atrito: desce menos do que o dedo andou', px(r.desceu) < 180, String(px(r.desceu)));
 ok('e não passa do teto', px(r.desceu) <= 96, String(px(r.desceu)));
 ok('o gesto assume a rolagem enquanto puxa', r.barrou === true);
 await p.waitForTimeout(600);
 ok('soltando, a tela volta ao lugar',
    px(await p.evaluate(()=>getComputedStyle(document.getElementById('view')).transform)) === 0);

 console.log('\n=== Um deslize curto não atualiza ===');
 const antes = chamadas;
 await puxar(p, 40, 4); await p.waitForTimeout(1200);
 ok('arrastar pouco não chama o servidor', chamadas === antes, `${chamadas - antes} chamada(s)`);

 console.log('\n=== Puxar até o limite atualiza ===');
 await puxar(p, 200); await p.waitForTimeout(2000);
 ok('arrastar até o fim chama o servidor', chamadas > antes, `${chamadas - antes} chamada(s)`);
 ok('e a tela volta ao lugar depois',
    px(await p.evaluate(()=>getComputedStyle(document.getElementById('view')).transform)) === 0);

 console.log('\n=== No meio da lista o arrasto é rolagem ===');
 await p.evaluate(()=>{ document.getElementById('scroll').scrollTop = 220; });
 await p.waitForTimeout(300);
 const rolado = await p.evaluate(()=>document.getElementById('scroll').scrollTop);
 if(rolado > 0){
   r = await puxar(p, 160);
   ok('não desce a tela fora do topo', px(r.desceu) === 0, r.desceu);
   ok('e não barra a rolagem do navegador', r.barrou === false);
 } else {
   ok('não desce a tela fora do topo', true, '(a lista não rola nesta altura)');
   ok('e não barra a rolagem do navegador', true, '(idem)');
 }

 console.log('\n=== Vale nas outras telas também ===');
 await p.evaluate(()=>{ document.getElementById('scroll').scrollTop = 0; });
 for(const tela of ['home','ciencia','conta']){
   await p.evaluate(t=>app.ir(t), tela); await p.waitForTimeout(800);
   await p.evaluate(()=>{ document.getElementById('scroll').scrollTop = 0; });
   const x = await puxar(p, 180);
   ok(`${tela} responde ao gesto`, px(x.desceu) > 20, x.desceu);
   await p.waitForTimeout(1500);
 }

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
