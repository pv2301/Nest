/* "Quando e Onde" em tela cheia, a tarjeta de título e as listas.

   Três relatos de quem usa o app, nesta ordem:

   "A lista O que salta aos olhos está com margem distanciada da borda, por que? É pra
   exibir algo antes?" — não era para nada: 40px de recuo que o navegador dá a
   qualquer `<ul>` e que `list-style:none` não devolve.

   "Quando abre na horizontal não tem o ícone de fechar" e "o lado direito da tabela
   onde tem a coluna de 21h ficou cortada além da borda da tela". Os dois vinham do
   giro: medido no aparelho, a barra de cima virava uma tira vertical na borda direita
   e o × caía em y=861 — canto INFERIOR direito. E o eixo longo era `100vh`, que no
   celular é a altura sem a barra do navegador, então o fim dele ficava fora do que se
   vê e fora do que rola. Agora não gira e usa `dvh`.

   "Vamos usar lista para todos onde for necessário selecionar opções" — a regra de
   3/4/5 opções saiu.

   Medir a célula por `offsetWidth`, não por `getBoundingClientRect`: já me enganou
   duas vezes quando havia giro, e a lição fica.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';

let f = []; const ok = (n, c, x) => { if(c) console.log('  OK ' + n);
  else { f.push(n); console.log('  XX ' + n + (x ? '\n       ' + x : '')); } };

const EXPANDIR = 'button[title="Ver em tela cheia"]';
const FECHAR = '#heat-cheio button[aria-label="Fechar a tela cheia"]';

/** O que a tela cheia é agora. Medidas lógicas, e a posição do × na tela. */
const medir = p => p.evaluate(() => {
  const d = document.getElementById('heat-cheio');
  if(!d) return null;
  const rol = d.querySelector('.hc-rol');
  const g = rol.querySelector('.heat');
  const c = rol.querySelector('.cell');
  const nome = rol.querySelector('.rl');
  const x = d.querySelector('button[aria-label="Fechar a tela cheia"]');
  const rd = d.getBoundingClientRect(), rx = x.getBoundingClientRect();
  const hhs = [...rol.querySelectorAll('.hh')];
  return {
    noBody: d.parentElement === document.body,
    dentroDaJanela: rd.left >= -1 && rd.top >= -1
      && rd.right <= window.innerWidth + 1 && rd.bottom <= window.innerHeight + 1,
    xDaDireita: Math.round(window.innerWidth - rx.right),
    xDoTopo: Math.round(rx.top),
    xTamanho: Math.round(rx.width) + 'x' + Math.round(rx.height),
    papel: d.getAttribute('role'), modal: d.getAttribute('aria-modal'),
    filtros: d.querySelectorAll('.hc-filtros .chip').length,
    lado: c.offsetWidth, alto: c.offsetHeight,
    colunaNomes: nome.offsetWidth, nomeTexto: nome.textContent.trim(),
    rolaH: rol.scrollWidth > rol.clientWidth + 1,
    rolaV: rol.scrollHeight > rol.clientHeight + 1,
    horas: hhs.length, ultimaHora: hhs.length ? hhs[hhs.length - 1].textContent : null,
    locais: rol.querySelectorAll('.rl').length,
    pintada: !!c.style.background,
    grade: g.offsetWidth + 'x' + g.offsetHeight,
    area: rol.clientWidth + 'x' + rol.clientHeight
  };
});

/** Rola até o fim e diz se a última coluna de hora ficou visível. */
const ultimaColunaAlcancavel = p => p.evaluate(() => {
  const rol = document.querySelector('#heat-cheio .hc-rol');
  rol.scrollLeft = rol.scrollWidth;
  const u = [...rol.querySelectorAll('.hh')].pop().getBoundingClientRect();
  const r = rol.getBoundingClientRect();
  return u.left >= r.left - 1 && u.right <= r.right + 1;
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
 const lista = await p.evaluate(() => {
   const e = document.querySelector('.destaques');
   if(!e) return null;
   const c = getComputedStyle(e);
   return { padL: parseFloat(c.paddingLeft), mTop: parseFloat(c.marginTop),
     item: Math.round(e.firstElementChild.getBoundingClientRect().left),
     rotulo: Math.round(e.previousElementSibling.getBoundingClientRect().left) };
 });
 ok('a lista de destaques está na tela', !!lista);
 ok('sem os 40px de recuo do navegador', lista.padL === 0, 'padding-left=' + lista.padL);
 ok('e sem a margem de 1em', lista.mTop === 0, String(lista.mTop));
 ok('o primeiro cartão alinha com o rótulo acima',
    lista.item === lista.rotulo, lista.item + ' vs ' + lista.rotulo);

 console.log('\n=== A tarjeta de título ===');
 /* O título de seção virou pastilha; o rótulo de CAMPO não, porque nomeia o controle
    logo abaixo e não é título. A diferença é estrutural, então é só CSS. */
 const tarjetas = await p.evaluate(() => {
   const fundo = e => getComputedStyle(e).backgroundColor;
   const vazio = c => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
   const todos = [...document.querySelectorAll('#view .sec-label')];
   return { titulos: todos.filter(e => !e.closest('.esc, .field, .narrativa'))
              .map(e => ({ t: e.textContent.trim().slice(0, 20), temFundo: !vazio(fundo(e)) })),
            campos: todos.filter(e => e.closest('.esc, .field, .narrativa'))
              .map(e => ({ t: e.textContent.trim().slice(0, 20), temFundo: !vazio(fundo(e)) })) };
 });
 ok('há títulos de seção nesta tela', tarjetas.titulos.length > 0,
    JSON.stringify(tarjetas.titulos));
 ok('todo título de seção vem como tarjeta',
    tarjetas.titulos.every(x => x.temFundo), JSON.stringify(tarjetas.titulos));

 console.log('\n=== Um controle só para campo de formulário ===');
 await p.evaluate(() => app.iniciar('completo')); await p.waitForTimeout(900);
 ok('nenhum campo desenha segmentado',
    (await p.locator('#view .esc .seg').count()) === 0);
 ok('nenhum campo desenha chip',
    (await p.locator('#view .esc .chips .chip').count()) === 0);
 ok('o campo de categoria é campo com lista',
    (await p.locator('[data-escolha="cat"] .cl-campo').count()) === 1);
 await p.evaluate(() => app.ir('visao')); await p.waitForTimeout(900);
 ok('mas as três guias seguem segmentadas, que são navegação',
    (await p.locator('.seg[data-escolha="visao-guia"] [role=radio]').count()) === 3,
    String(await p.locator('.seg[data-escolha="visao-guia"] [role=radio]').count()));

 console.log('\n=== A tela cheia abre, e o × fica onde se procura ===');
 await p.evaluate(() => app.escolherLista('visao-guia', 'estatisticas')); await p.waitForTimeout(900);
 ok('há um botão de expandir', (await p.locator(EXPANDIR).count()) === 1);
 const cartao = await p.evaluate(() => {
   const c = document.querySelector('#view #heat .cell');
   return c ? c.offsetWidth : null;
 });
 ok('no cartão a célula continua nos 34px', cartao === 34, String(cartao));

 await p.click(EXPANDIR); await p.waitForTimeout(800);
 let m = await medir(p);
 ok('a tela cheia aparece', !!m);
 ok('e mora no body, não dentro de #view', m.noBody);
 ok('ocupa a janela sem sair dela', m.dentroDaJanela);
 /* O relato: "quando abre na horizontal não tem o ícone de fechar". O × estava no
    canto inferior direito, porque o painel girava. */
 ok('o × está no canto SUPERIOR direito',
    m.xDaDireita <= 14 && m.xDoTopo <= 14, `direita=${m.xDaDireita} topo=${m.xDoTopo}`);
 ok('e tem 44×44 para o polegar', m.xTamanho === '44x44', m.xTamanho);
 ok('se anuncia como diálogo modal', m.papel === 'dialog' && m.modal === 'true');
 ok('as células estão pintadas', m.pintada);

 console.log('\n=== Os filtros de período, dentro da tela cheia ===');
 ok('os cinco filtros estão lá', m.filtros === 5, String(m.filtros));
 const horasAntes = m.horas;
 await p.click('#heat-cheio .hc-filtros .chip:text-is("Hoje")'); await p.waitForTimeout(900);
 m = await medir(p);
 ok('tocar num filtro muda a tabela', !!m && m.horas !== horasAntes,
    `antes ${horasAntes}, depois ${m && m.horas}`);
 ok('e não fecha o painel', !!m);
 await p.click('#heat-cheio .hc-filtros .chip:text-is("1 ano")'); await p.waitForTimeout(900);
 m = await medir(p);

 console.log('\n=== A coluna dos nomes abraça o nome ===');
 /* Era fixa em 96–140px, e "Quadra" ocupa 38 — o resto ficava vazio à esquerda. */
 ok('a coluna tem a largura do nome, não uma largura fixa',
    m.colunaNomes < 130, m.colunaNomes + 'px para "' + m.nomeTexto + '"');
 ok('e não é estreita demais para o nome', m.colunaNomes >= 40, String(m.colunaNomes));

 console.log('\n=== Dimensiona pela tela, entre piso e teto ===');
 const PISO = 34, TETO = 72;
 const porTela = [];
 for(const [w, h, nome] of [[360,800,'telefone estreito'], [412,915,'telefone'],
                            [915,412,'paisagem'], [1024,768,'tablet'], [1440,900,'monitor']]){
   await p.setViewportSize({ width:w, height:h }); await p.waitForTimeout(600);
   const x = await medir(p);
   porTela.push({ nome, lado: x && x.lado });
   ok(`${nome}: entre ${PISO} e ${TETO}px`, !!x && x.lado >= PISO && x.lado <= TETO,
      x ? 'lado=' + x.lado : '(fechou)');
   ok(`${nome}: quadrada`, !!x && x.lado === x.alto, x ? x.lado + 'x' + x.alto : '');
 }
 ok('cresce, ou ao menos não encolhe, com a tela',
    porTela.every((x, i) => i === 0 || x.lado >= porTela[i - 1].lado),
    JSON.stringify(porTela.map(x => x.nome + '=' + x.lado)));

 console.log('\n=== O dia inteiro: 7h às 21h, o caso do relato ===');
 await p.setViewportSize({ width:412, height:915 }); await p.waitForTimeout(500);
 await p.click(FECHAR); await p.waitForTimeout(500);
 /* Gravados pela API, como a escola faria ao longo do dia. */
 const gravou = await p.evaluate(async () => {
   const locais = ['Pátio externo','Sala de aula','Refeitório','Parque de areia','Entrada / portaria'];
   let n = 0;
   for(let h = 7; h <= 21; h++){
     const d = new Date(); d.setHours(h, 15, 0, 0);
     const r = await fetch('/api', { method:'POST', headers:{'Content-Type':'application/json'},
       body: JSON.stringify({ acao:'salvarOcorrencia', dados:{ novo:true, ocorrencia:{
         id:'dia' + h, categoria:'Incidente', tipo:'Mordida', sev:2, presenciou:true,
         local: locais[h % locais.length], quandoISO: d.toISOString(),
         desc:'Registro de teste para medir a grade com o dia inteiro.',
         envolvidos:[{ kid:'c1', papel:'Sofreu', turma:'Verde' }],
         chain:[{ nivel:'Gestão', st:'now' }] } } }) });
     if((await r.json()).ok) n++;
   }
   return n;
 });
 ok('gravei um dia das 7h às 21h', gravou === 15, String(gravou));
 /* `recarregar` não está em `app`; recarregar a página chega ao mesmo lugar e é o
    que a pessoa faria. O cookie de sessão sobrevive. */
 await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(2600);
 await p.evaluate(() => app.ir('painel')); await p.waitForTimeout(1400);
 await p.click(EXPANDIR); await p.waitForTimeout(900);
 m = await medir(p);
 ok('a tabela tem as 15 colunas', m.horas === 15, String(m.horas));
 ok('e a última é 21h', m.ultimaHora === '21h', String(m.ultimaHora));
 ok('no retrato ela rola na horizontal, em vez de ser cortada', m.rolaH,
    'grade ' + m.grade + ' em área ' + m.area);
 ok('e rolando até o fim a coluna das 21h fica visível', await ultimaColunaAlcancavel(p));

 await p.setViewportSize({ width:915, height:412 }); await p.waitForTimeout(700);
 m = await medir(p);
 ok('virando o aparelho, o dia inteiro cabe sem rolar', !m.rolaH && !m.rolaV,
    'grade ' + m.grade + ' em área ' + m.area);
 ok('e o × continua no canto superior direito',
    m.xDaDireita <= 14 && m.xDoTopo <= 14, `direita=${m.xDaDireita} topo=${m.xDoTopo}`);

 console.log('\n=== Os caminhos de saída ===');
 await p.setViewportSize({ width:412, height:915 }); await p.waitForTimeout(600);
 await p.keyboard.press('Escape'); await p.waitForTimeout(500);
 ok('Esc fecha', (await medir(p)) === null);
 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.click(FECHAR); await p.waitForTimeout(600);
 ok('o × fecha', (await medir(p)) === null);
 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.goBack(); await p.waitForTimeout(700);
 ok('o voltar do aparelho fecha', (await medir(p)) === null);
 ok('e não sai do painel', (await p.locator('#view #heat').count()) === 1);
 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.evaluate(() => app.escolherLista('visao-guia', 'destaques')); await p.waitForTimeout(800);
 ok('trocar de guia fecha, sem painel órfão', (await medir(p)) === null);
 await p.evaluate(() => app.escolherLista('visao-guia', 'estatisticas')); await p.waitForTimeout(800);
 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.evaluate(() => app.ir('lista')); await p.waitForTimeout(800);
 ok('trocar de tela também fecha', (await medir(p)) === null);

 console.log('\n=== Não vai ao papel ===');
 await p.evaluate(() => app.ir('painel')); await p.waitForTimeout(900);
 await p.click(EXPANDIR); await p.waitForTimeout(600);
 await p.emulateMedia({ media:'print' }); await p.waitForTimeout(400);
 ok('a tela cheia não é impressa', !(await p.locator('#heat-cheio').isVisible()));
 await p.emulateMedia({ media:'screen' }); await p.waitForTimeout(300);

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 console.log(f.length ? `\n=== ${f.length} FALHARAM: ${f.join(', ')} ===` : '\n=== TUDO PASSOU ===');
 await b.close();
 process.exit(f.length ? 1 : 0);
})();
