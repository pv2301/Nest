/* A varredura: cada elemento tocável de cada tela, com toque de verdade.

   O app tem 31 telas registradas e dezenas de funções ligadas a toque. Conferir isso
   de olho não dá, e acreditar numa amostra foi o que deixou passar o bug que quebrou
   a seleção no celular por uma semana. Aqui cada elemento é tocado pelo protocolo do
   Chromium — a mesma porta de um dedo real — e medido em quatro coisas:

     1. o toque dispara a função que o onclick promete
     2. nenhum erro de JavaScript
     3. o elemento não está coberto por outra coisa (a barra de abas é fixa no rodapé)
     4. o alvo tem ao menos 44px, que é o mínimo que um polegar acerta

   Os dois últimos nunca aparecem num teste de clique: ali o clique é programático e
   não existe nem polegar nem sobreposição.

   A varredura é cara — reabre a tela a cada toque, porque tocar muda o que está na
   tela. É o preço de não ter de lembrar de escrever um teste por botão: uma tela nova
   entra aqui sozinha.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';
import { abrirToque, instrumentar, zerar, chamadas, errosDeHandler,
         interativos, coberto } from './toque.mjs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';
const SO = process.env.VARRER_TELA || '';      /* para investigar uma tela só */
const ALVO_MINIMO = 44;

let f = [];
const ok = (n, c, x) => { if(c) console.log('  OK ' + n);
  else { f.push(n); console.log('  XX ' + n + (x ? '\n       ' + x : '')); } };

/* Como se chega em cada tela. As que precisam de contexto dizem como consegui-lo. */
const TELAS = {
  home:       p => p.evaluate(() => app.ir('home')),
  lista:      p => p.evaluate(() => app.ir('lista')),
  ciencia:    p => p.evaluate(() => app.ir('ciencia')),
  novo:       p => p.evaluate(() => app.ir('novo')),
  gestao:     p => p.evaluate(() => app.ir('gestao')),
  visao:      p => p.evaluate(() => app.ir('visao')),
  painel:     p => p.evaluate(() => app.ir('painel')),
  calendario: p => p.evaluate(() => app.ir('calendario')),
  auditoria:  p => p.evaluate(() => app.ir('auditoria')),
  removidos:  p => p.evaluate(() => app.ir('removidos')),
  alunos:     p => p.evaluate(() => app.ir('alunos')),
  usuarios:   p => p.evaluate(() => app.ir('usuarios')),
  conta:      p => p.evaluate(() => app.ir('conta')),
  ajuda:      p => p.evaluate(() => app.ir('ajuda')),
  horario:    p => p.evaluate(() => app.ir('horario')),
  relacoes:   p => p.evaluate(() => app.ir('relacoes')),
  rapido:     p => p.evaluate(() => app.iniciar('rapido')),
  wizard:     p => p.evaluate(() => app.iniciar('completo')),

  async detalhe(p){
    await p.evaluate(() => app.ir('lista')); await p.waitForTimeout(700);
    await p.evaluate(() => { const i = document.querySelector('.item'); if(i) i.click(); });
  },
  async ficha(p){
    await TELAS.detalhe(p); await p.waitForTimeout(900);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')]
      .find(x => /Gerar relat/i.test(x.innerText)); if(b) b.click(); });
  },
  async aluno(p){
    await p.evaluate(() => app.ir('alunos')); await p.waitForTimeout(800);
    await p.evaluate(() => { const r = document.querySelector('.urow[onclick*="abrirAluno"]');
      if(r) r.click(); });
  },
  async turma(p){
    await p.evaluate(() => app.ir('alunos')); await p.waitForTimeout(800);
    await p.evaluate(() => { const r = document.querySelector('.urow[onclick*="abrirTurma"]');
      if(r) r.click(); });
  },
  async usuario(p){
    await p.evaluate(() => app.ir('usuarios')); await p.waitForTimeout(800);
    await p.evaluate(() => { const r = document.querySelector('.urow[onclick*="abrirUsuario"]');
      if(r) r.click(); });
  }
};

/* As telas de antes do login. São metade do caminho de quem esqueceu a senha, e
   ficariam de fora de uma varredura que só olha o app logado. Cada uma diz como se
   chega nela a partir da tela de entrada. */
const TELAS_FORA = {
  entrada:  async p => { await p.goto(BASE); await p.waitForTimeout(1500);
    await instrumentar(p); },
  entrar:   async p => { await TELAS_FORA.entrada(p);
    const b = p.locator('button:text-is("Entrar")');
    if(await b.count()) await b.first().click(); },
  criar:    async p => { await TELAS_FORA.entrada(p);
    const b = p.locator('button:has-text("Criar conta")');
    if(await b.count()) await b.first().click(); },
  recuperar: async p => { await TELAS_FORA.entrar(p); await p.waitForTimeout(600);
    const b = p.locator('button:has-text("Esqueceu a senha")');
    if(await b.count()) await b.first().click(); }
};

/* Tocar nestes desfaz o cenário. São tocados do mesmo jeito — é justamente neles que
   um botão morto passaria despercebido —, mas o cenário é remontado depois. */
const DESFAZ = new Set(['sair','usarOutra','limparDemo','confirmarLimpeza','demo',
  'descartarRascunho','removerAluno','removerTurma','confirmarRemocao','arquivarAluno',
  'desativar','restaurar','reiniciar','revogarAparelho',
  /* A tabela em tela cheia cobre a janela de propósito: sem desfazer, todo elemento
     tocado depois dela aparece "coberto" — e o relatado seria a varredura, não o app.
     Reabrir a tela não basta, porque a tabela continua lá e a tela cheia com ela. */
  'heatCheio']);

/* Não se toca: abriria um seletor de arquivo do sistema, que trava a página. */
const PULA = el => el.tag === 'input' && el.tipo === 'file';

async function entrar(p){
  await p.goto(BASE); await p.waitForTimeout(1800);
  /* Tocar num botão destrutivo pode ou não ter derrubado a sessão: arquivar um aluno
     não derruba, sair derruba. Então o estado de partida aqui é desconhecido, e a
     primeira coisa é descobrir em qual das três telas estamos. */
  if(await p.locator('.tabbar').count()){
    await p.evaluate(() => { window.print = () => { window.__imprimiu = true; }; });
    await instrumentar(p);
    return;
  }
  if(await p.locator('#g-nome').count()){
    await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha','Gestora2026');
    await p.fill('#g-senha2','Gestora2026'); await p.fill('#g-codigo','424242');
    await p.click('button[type=submit]'); await p.waitForTimeout(2200);
  } else {
    const b = p.locator('button:text-is("Entrar")');
    if(await b.count()){ await b.first().click(); await p.waitForTimeout(700); }
    await p.fill('#f-login','tallita.lima'); await p.fill('#f-senha','Gestora2026');
    await p.click('button[type=submit]'); await p.waitForTimeout(2200);
  }
  const agora = p.locator('text=Agora não');
  if(await agora.count()){ await agora.click(); await p.waitForTimeout(800); }
  if(!(await p.evaluate(() => (window.__ocs || 0)))){
    await p.evaluate(() => app.demo(true)); await p.waitForTimeout(2400);
  }
  /* Imprimir abriria a caixa de diálogo do sistema e travaria a varredura. */
  await p.evaluate(() => { window.print = () => { window.__imprimiu = true; }; });
  await instrumentar(p);
}

(async()=>{
 const b = await chromium.launch();
 const ctx = await b.newContext({ ...devices['Pixel 7'] });
 const p = await ctx.newPage();
 const errosPagina = [];
 p.on('pageerror', e => errosPagina.push(e.message));

 await entrar(p);
 const t = await abrirToque(p);

 const problemas = [];
 const nomes = SO ? [SO] : Object.keys(TELAS);

 for(const tela of nomes){
   await TELAS[tela](p); await p.waitForTimeout(900);
   const lista = await interativos(p);
   console.log(`\n────── ${tela} — ${lista.length} elementos ──────`);
   if(!lista.length){ ok(`${tela}: tem algo com que interagir`, false, 'nenhum elemento'); continue; }

   for(let i = 0; i < lista.length; i++){
    try {
     /* Reabre a tela a cada toque: o toque anterior pode ter mudado o que está nela. */
     if(i > 0){ await TELAS[tela](p); await p.waitForTimeout(600); }
     const agora = await interativos(p);
     const el = agora[i];
     if(!el) continue;
     const id = `${tela} · ${el.etiqueta || el.tag}`;

     if(PULA(el)) continue;

     /* alvo pequeno demais para um polegar */
     if(el.dentroDaRolagem && Math.min(el.largura, el.altura) < ALVO_MINIMO && !el.desativado)
       problemas.push({ tela, alvo:el.etiqueta, tipo:'alvo pequeno',
         detalhe:`${el.largura}×${el.altura}px` });

     /* algo por cima no ponto do toque */
     const c = await coberto(p, el.marca);
     if(c.coberto)
       problemas.push({ tela, alvo:el.etiqueta, tipo:'coberto', detalhe:String(c.por) });

     if(el.desativado || !el.funcao) continue;

     await zerar(p);
     const antes = errosPagina.length;
     await t.tocarElemento(`[data-varredura="${el.marca}"]`);
     await p.waitForTimeout(450);

     const ch = await chamadas(p);
     if(!ch[el.funcao])
       problemas.push({ tela, alvo:el.etiqueta, tipo:'toque não dispara',
         detalhe:`esperava app.${el.funcao}` });

     const eh = await errosDeHandler(p);
     if(eh.length)
       problemas.push({ tela, alvo:el.etiqueta, tipo:'erro no handler', detalhe:eh.join('; ') });
     if(errosPagina.length > antes)
       problemas.push({ tela, alvo:el.etiqueta, tipo:'erro de página',
         detalhe:errosPagina.slice(antes).join('; ') });

     if(DESFAZ.has(el.funcao)){ await entrar(p); }
    } catch(e){
      /* Um elemento que explode não pode levar junto a varredura das outras trinta
         telas: anota e segue. */
      problemas.push({ tela, alvo:`elemento ${i}`, tipo:'erro de página',
        detalhe:String(e.message).split('\n')[0].slice(0, 90) });
      await entrar(p);
    }
   }
   const aqui = problemas.filter(x => x.tela === tela);
   ok(`${tela}: ${lista.length} elementos varridos`, true);
   /* Relatado na hora, e não só no fim: um tombo lá na frente levaria o relatório
      junto, que foi exatamente o que aconteceu na primeira execução. */
   for(const x of aqui) console.log(`     · ${x.tipo}: ${x.alvo} — ${x.detalhe}`);
 }

 /* Segunda passagem, deslogada. Vem no fim porque derruba a sessão. */
 if(!SO){
   await p.evaluate(() => app.sair()).catch(() => {});
   await p.waitForTimeout(1200);
   for(const tela of Object.keys(TELAS_FORA)){
     await TELAS_FORA[tela](p); await p.waitForTimeout(900);
     const lista = await interativos(p);
     console.log(`\n────── ${tela} (antes do login) — ${lista.length} elementos ──────`);
     for(let i = 0; i < lista.length; i++){
       try {
         if(i > 0){ await TELAS_FORA[tela](p); await p.waitForTimeout(600); }
         const agora = await interativos(p);
         const el = agora[i];
         if(!el || PULA(el)) continue;
         if(Math.min(el.largura, el.altura) < ALVO_MINIMO && !el.desativado && el.funcao)
           problemas.push({ tela, alvo:el.etiqueta, tipo:'alvo pequeno',
             detalhe:`${el.largura}×${el.altura}px` });
         const c = await coberto(p, el.marca);
         if(c.coberto) problemas.push({ tela, alvo:el.etiqueta, tipo:'coberto', detalhe:String(c.por) });
         if(el.desativado || !el.funcao) continue;
         await zerar(p);
         await t.tocarElemento(`[data-varredura="${el.marca}"]`);
         await p.waitForTimeout(450);
         const ch = await chamadas(p);
         if(!ch[el.funcao])
           problemas.push({ tela, alvo:el.etiqueta, tipo:'toque não dispara',
             detalhe:`esperava app.${el.funcao}` });
       } catch(e){
         problemas.push({ tela, alvo:`elemento ${i}`, tipo:'erro de página',
           detalhe:String(e.message).split('\n')[0].slice(0, 90) });
       }
     }
     const aqui = problemas.filter(x => x.tela === tela);
     ok(`${tela} (antes do login): ${lista.length} elementos varridos`, true);
     for(const x of aqui) console.log(`     · ${x.tipo}: ${x.alvo} — ${x.detalhe}`);
   }
 }

 console.log('\n══════════ RELATÓRIO ══════════');
 if(!problemas.length) console.log('Nenhum problema encontrado.');
 for(const tipo of ['toque não dispara','erro de página','erro no handler','coberto','alvo pequeno']){
   const d = problemas.filter(x => x.tipo === tipo);
   if(!d.length) continue;
   console.log(`\n── ${tipo} (${d.length}) ──`);
   for(const x of d) console.log(`   ${x.tela.padEnd(12)} ${String(x.alvo).padEnd(32)} ${x.detalhe}`);
 }

 const graves = problemas.filter(x =>
   x.tipo === 'toque não dispara' || x.tipo === 'erro de página' || x.tipo === 'erro no handler');
 ok('nenhum toque morto e nenhum erro', graves.length === 0, `${graves.length} caso(s)`);
 ok('nada coberto por outro elemento',
    problemas.filter(x => x.tipo === 'coberto').length === 0);
 /* O alvo pequeno não quebra o teste à toa: a varredura toca no centro de cada
    elemento, então ele passa mesmo pequeno. Quem erra é o polegar, que cobre uns 9mm
    e cai em qualquer lugar. Por isso isto é asserção e não aviso. */
 const pequenos = problemas.filter(x => x.tipo === 'alvo pequeno');
 ok(`nenhum alvo abaixo de ${ALVO_MINIMO}px`, pequenos.length === 0,
    pequenos.map(x => `${x.tela}/${x.alvo} ${x.detalhe}`).join(', '));

 await b.close();
 if(f.length){ console.log(`\n=== ${f.length} FALHARAM ===`); process.exit(1); }
 console.log('\n=== TUDO PASSOU ===');
})();
