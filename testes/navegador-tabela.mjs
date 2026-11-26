/* A tabela do "quando e onde" em tela cheia, e a margem fantasma das listas.

   Dois relatos de quem usa o app:

   "A lista O que salta aos olhos está com margem distanciada da borda, por que? É pra
   exibir algo antes?" — não era para nada: 40px de recuo e 14px de margem que o
   navegador dá a qualquer `<ul>`, e que `list-style:none` não devolve.

   "A tabela pode ter um fullscreen para exibir na horizontal da tela completa" — e
   depois: "deve ser adaptativo de modo a dimensionar de acordo com o tamanho das
   telas que abrem". Num telefone de 412px, um dia escolar de 12 horas deixava 172px
   da tabela fora da tela.

   O que estes testes travam: a margem em zero; a tela cheia abrindo dentro da janela,
   fechando por três caminhos, mostrando todos os locais; e a célula crescendo com a
   tela, entre o piso e o teto, sem rolar quando não precisa.

   Medir o tamanho da célula por `offsetWidth`, e não por `getBoundingClientRect`: com
   o palco girado no retrato o rect devolve a caixa VISUAL, com os eixos trocados. Isso
   me enganou duas vezes ao construir isto.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';

let f = []; const ok = (n, c, x) => { if(c) console.log('  OK ' + n);
  else { f.push(n); console.log('  XX ' + n + (x ? '\n       ' + x : '')); } };

const EXPANDIR = 'button[title="Ver em tela cheia"]';

/** O que a tela cheia é agora. Tudo em medida lógica, imune ao giro. */
const medir = p => p.evaluate(() => {
  const d = document.getElementById('heat-cheio');
  if(!d) return null;
  const rol = d.querySelector('.hc-rol');
  const g = d.querySelector('.heat');
  const c = d.querySelector('.cell');
  const r = d.getBoundingClientRect();
  return {
    noBody: d.parentElement === document.body,
    dentroDaJanela: r.left >= -1 && r.top >= -1
      && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
    lado: c.offsetWidth, alto: c.offsetHeight,
    rolaH: rol.scrollWidth > rol.clientWidth + 1,
    rolaV: rol.scrollHeight > rol.clientHeight + 1,
    locais: d.querySelectorAll('.rl').length,
    horas: d.querySelectorAll('.hh').length,
    pintada: !!c.style.background,
    girado: /rotate/.test(getComputedStyle(d.querySelector('.hc-palco')).transform || '')
      || getComputedStyle(d.querySelector('.hc-palco')).transform !== 'none'
  };
});

(async () => {
 const b = await chromium.launch();
 const p = await (await b.newContext({ viewport:{ width:412, height:915 } })).newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message));

 await p.goto(BASE); await p.waitForTimeout(1500);
 await p.fill('#g-nome', 'Tallita Lima'); await p.fill('#g-senha', 'Gestora2026');
 await p.fill('#g-senha2', 'Gestora2026'); await p.fill('#g-codigo', '424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(1900);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(() => app.demo(true)); await p.waitForTimeout(2300);

 console.log('\n=== A margem que não exibia nada ===');
 await p.evaluate(() => app.ir('visao')); await p.waitForTimeout(1000);
 const listas = await p.evaluate(() => {
   const ler = sel => {
     const e = document.querySelector(sel);
     if(!e) return null;
     const c = getComputedStyle(e);
     const rot = e.previousElementSibling;
     return { padL: parseFloat(c.paddingLeft), mTop: parseFloat(c.marginTop),
       mBot: parseFloat(c.marginBottom),
       item: Math.round(e.firstElementChild.getBoundingClientRect().left),
       rotulo: rot ? Math.round(rot.getBoundingClientRect().left) : null };
   };
   return { destaques: ler('.destaques') };
 });
 ok('a lista de destaques existe na tela', !!listas.destaques, JSON.stringify(listas));
 ok('sem os 40px de recuo do navegador', listas.destaques.padL === 0,
    'padding-left=' + listas.destaques.padL);
 ok('e sem a margem de 1em que brigava com o stack',
    listas.destaques.mTop === 0 && listas.destaques.mBot === 0,
    listas.destaques.mTop + '/' + listas.destaques.mBot);
 ok('o primeiro cartão alinha com o rótulo acima dele',
    listas.destaques.item === listas.destaques.rotulo,
    'cartão em ' + listas.destaques.item + ', rótulo em ' + listas.destaques.rotulo);

 console.log('\n=== A tela cheia abre ===');
 await p.evaluate(() => app.escolherLista('visao-guia', 'estatisticas')); await p.waitForTimeout(900);
 ok('há um botão de expandir ao lado do rótulo', (await p.locator(EXPANDIR).count()) === 1);
 const cartao = await p.evaluate(() => {
   const c = document.querySelector('#view #heat .cell');
   return c ? { lado:c.offsetWidth, rola: (() => {
     const r = document.querySelector('.heat-rolagem');
     return r.scrollWidth > r.clientWidth + 1; })() } : null;
 });
 ok('no cartão a célula continua nos 34px, como antes', cartao && cartao.lado === 34,
    JSON.stringify(cartao));

 await p.click(EXPANDIR); await p.waitForTimeout(700);
 let m = await medir(p);
 ok('a tela cheia aparece', !!m);
 ok('e mora no body, não dentro de #view', m.noBody);
 ok('ocupa a janela sem sair dela', m.dentroDaJanela);
 ok('no retrato o palco está girado', m.girado);
 ok('as células estão pintadas', m.pintada);

 console.log('\n=== Mostra mais do que o cartão ===');
 ok('mais locais que os 6 do cartão, ou todos os que houver',
    m.locais >= Math.min(6, m.locais), 'locais=' + m.locais);
 ok('a célula é maior que a do cartão', m.lado > 34, 'lado=' + m.lado);
 ok('é quadrada', m.lado === m.alto, m.lado + 'x' + m.alto);
 ok('e não precisa rolar', !m.rolaH && !m.rolaV,
    'rola ' + (m.rolaH ? 'H' : '') + (m.rolaV ? 'V' : ''));

 console.log('\n=== Dimensiona pela tela que abre ===');
 /* O pedido: adaptativo. A célula cresce com a tela, entre o piso de 34px — o mínimo
    que se lê e se acerta com o dedo — e o teto de 72px, acima do qual ela vira um
    quadrado vazio em volta de um dígito. */
 const PISO = 34, TETO = 72;
 const porTela = [];
 for(const [w, h, nome] of [[360,800,'telefone estreito'], [412,915,'telefone'],
                            [915,412,'paisagem'], [1024,768,'tablet'], [1440,900,'monitor']]){
   await p.setViewportSize({ width:w, height:h }); await p.waitForTimeout(500);
   const x = await medir(p);
   porTela.push({ nome, lado: x && x.lado, quadrada: x && x.lado === x.alto,
                  girado: x && x.girado });
   ok(`${nome}: entre ${PISO} e ${TETO}px`, !!x && x.lado >= PISO && x.lado <= TETO,
      x ? 'lado=' + x.lado : '(fechou)');
   ok(`${nome}: quadrada`, !!x && x.lado === x.alto, x ? x.lado + 'x' + x.alto : '');
 }
 ok('não encolhe quando a tela cresce',
    porTela.every((x, i) => i === 0 || x.lado >= porTela[i - 1].lado),
    JSON.stringify(porTela.map(x => x.nome + '=' + x.lado)));
 ok('na paisagem o palco NÃO está girado — senão viraria duas vezes',
    porTela.find(x => x.nome === 'paisagem').girado === false,
    JSON.stringify(porTela.map(x => x.nome + ':' + x.girado)));
 ok('no tablet a célula é maior que no telefone',
    porTela.find(x => x.nome === 'tablet').lado
      > porTela.find(x => x.nome === 'telefone').lado,
    JSON.stringify(porTela.map(x => x.nome + '=' + x.lado)));

 console.log('\n=== Os três caminhos de saída ===');
 await p.setViewportSize({ width:412, height:915 }); await p.waitForTimeout(500);
 await p.keyboard.press('Escape'); await p.waitForTimeout(500);
 ok('Esc fecha', (await medir(p)) === null);

 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.click('#heat-cheio button[aria-label="Fechar a tela cheia"]'); await p.waitForTimeout(600);
 ok('o botão de fechar fecha', (await medir(p)) === null);

 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.goBack(); await p.waitForTimeout(700);
 ok('o voltar do aparelho fecha', (await medir(p)) === null);
 ok('e não sai do painel ao fazer isso',
    (await p.locator('#view #heat').count()) === 1);

 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.evaluate(() => app.escolherLista('visao-guia', 'destaques')); await p.waitForTimeout(800);
 ok('trocar de guia fecha, sem deixar painel órfão', (await medir(p)) === null);
 ok('e a guia realmente trocou — entrando por "painel" ela ficava presa',
    (await p.locator('.destaques').count()) === 1
      || /Nada a destacar/i.test(await p.locator('#view').innerText()));

 await p.evaluate(() => app.escolherLista('visao-guia', 'estatisticas')); await p.waitForTimeout(800);
 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.evaluate(() => app.ir('lista')); await p.waitForTimeout(800);
 ok('trocar de tela também fecha', (await medir(p)) === null);

 console.log('\n=== Não vai ao papel ===');
 await p.evaluate(() => app.ir('painel')); await p.waitForTimeout(900);
 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.emulateMedia({ media:'print' }); await p.waitForTimeout(400);
 ok('a tela cheia não é impressa',
    !(await p.locator('#heat-cheio').isVisible()));
 await p.emulateMedia({ media:'screen' }); await p.waitForTimeout(300);

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 console.log(f.length ? `\n=== ${f.length} FALHARAM: ${f.join(', ')} ===` : '\n=== TUDO PASSOU ===');
 await b.close();
 process.exit(f.length ? 1 : 0);
})();
