/* O toque no celular, elemento por elemento.

   Esta suíte existe por causa de uma regressão: o puxar-para-atualizar chamava
   preventDefault() no touchmove assim que o dedo andava 1px, e isso cancela o clique
   que o navegador sintetiza ao fim do toque. Medido num Pixel 7, 2px de deriva já
   matavam a seleção de criança, o botão "Sem identificar" do relatório e a linha
   "Continuar registro" — isto é, três relatos de "não funciona no celular" que eram
   um bug só.

   Nenhum dedo real encosta na tela sem andar dois pixels. Por isso o que se mede
   aqui é o toque COM deriva, e não o toque perfeito que o Playwright produz por
   padrão: um page.click() passaria mesmo com o bug presente.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };

/** Toca no elemento arrastando `deriva` pixels, como um dedo. Devolve se o clique
    chegou a acontecer — o navegador só o sintetiza quando nada barrou o touchmove. */
const tocar = (p, seletor, deriva) => p.evaluate(([s, d]) => {
  const el = document.querySelector(s);
  if(!el) return { erro:'sem elemento: ' + s };
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const ev = (tipo, yy) => {
    const t = new Touch({ identifier:1, target:el, clientX:x, clientY:yy });
    const e = new TouchEvent(tipo, { touches: tipo === 'touchend' ? [] : [t],
      changedTouches:[t], bubbles:true, cancelable:true });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  };
  ev('touchstart', y);
  let barrou = false;
  /* Em passos, como um dedo de verdade: um salto único esconderia o momento em que
     o gesto decide assumir. */
  for(let i = 1; i <= 4; i++) if(ev('touchmove', y + d * i / 4)) barrou = true;
  ev('touchend', y + d);
  if(!barrou) el.click();
  return { barrou, clicou: !barrou };
}, [seletor, deriva]);

const noTopo = p => p.evaluate(() => { document.getElementById('scroll').scrollTop = 0; });

(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({ ...devices['Pixel 7'] })).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(1600);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
 await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(2000);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2500);

 console.log('\n=== Escolher a categoria, com o dedo tremendo ===');
 await p.evaluate(()=>app.iniciar('completo')); await p.waitForTimeout(1100);
 await noTopo(p);
 for(const d of [0, 2, 5, 9]){
   const r = await tocar(p, '#cp-cat', d);
   ok(`${String(d).padStart(2)}px de deriva ainda é um toque`, r.clicou === true, JSON.stringify(r));
   await p.waitForTimeout(300);
   await p.evaluate(()=>{ if(app.fecharLista) app.fecharLista(); });
   await p.waitForTimeout(200); await noTopo(p);
 }
 const longe = await tocar(p, '#cp-cat', 40);
 ok('40px já é o gesto de atualizar, não um toque', longe.barrou === true, JSON.stringify(longe));
 await p.waitForTimeout(900);

 console.log('\n=== O botão Sem identificar do relatório ===');
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(900);
 await p.locator('.item').first().click(); await p.waitForTimeout(1100);
 await p.click('button:has-text("Gerar relatório")'); await p.waitForTimeout(1100);
 await noTopo(p);
 const estado = () => p.evaluate(()=>document.querySelector('.switch').getAttribute('aria-pressed'));
 const antes = await estado();
 await tocar(p, '.switch', 4); await p.waitForTimeout(700);
 ok('tocar com 4px alterna a marca', (await estado()) !== antes, `antes ${antes}, depois ${await estado()}`);

 console.log('\n=== Continuar registro, no início ===');
 await p.evaluate(()=>app.ir('home')); await p.waitForTimeout(900);
 await noTopo(p);
 const linha = await p.locator('.rascunho').count();
 if(linha){
   await tocar(p, '.rascunho', 4); await p.waitForTimeout(1100);
   ok('tocar com 4px retoma o rascunho',
      await p.evaluate(()=>!!document.getElementById('cp-cat') || !!document.querySelector('.steps')));
 } else {
   ok('tocar com 4px retoma o rascunho', false, 'a linha de rascunho não apareceu');
 }

 console.log('\n=== O gesto de atualizar continua funcionando ===');
 await p.evaluate(()=>app.ir('home')); await p.waitForTimeout(900);
 await noTopo(p);
 let chamou = 0;
 p.on('request', r => { if((r.postData()||'').includes('sincronizar')) chamou++; });
 const base = chamou;
 await p.evaluate(async()=>{
   const alvo = document.getElementById('scroll');
   const ev = (tipo, y) => { const t = new Touch({identifier:1,target:alvo,clientX:200,clientY:y});
     alvo.dispatchEvent(new TouchEvent(tipo,{touches:tipo==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true})); };
   ev('touchstart', 300);
   for(let i=1;i<=10;i++){ await new Promise(r=>setTimeout(r,16)); ev('touchmove', 300 + i*20); }
   ev('touchend', 500);
 });
 await p.waitForTimeout(2200);
 ok('puxar 200px ainda atualiza', chamou > base, `${chamou - base} chamada(s)`);

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM: ` + f.join(', ') + ' ==='); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
