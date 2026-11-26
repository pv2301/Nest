/* O ir e voltar: cada voltar tem de sair de uma tela, nunca ser em branco.

   Relato: "temos esses problemas de voltar na navegação dentro das páginas da aba
   Gestão". Reproduzido antes do conserto:

     Gestão → Alunos → abrir um aluno → Salvar
       voltar #1 -> alunos      <- não acontecia nada
       voltar #2 -> gestao

   A causa estava em `ir(tela, { guardar:false })`: ela troca `S.tela` sem desfazer
   nem `S.pilha` nem o histórico. Ao entrar na ficha do aluno, a pilha ganhou 'alunos'
   e o histórico uma entrada; ao salvar, voltávamos para 'alunos' sem desfazer
   nenhuma das duas, e sobrava uma entrada apontando para a tela onde a pessoa já
   estava. Agora esses pontos usam `voltarPara`, que volta de verdade quando o topo da
   pilha já é o destino.

   O que esta suíte trava: nenhum voltar em branco nos caminhos de salvar, e a ordem
   das telas ao voltar sendo a ordem em que se passou por elas.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';

let f = []; const ok = (n, c, x) => { if(c) console.log('  OK ' + n);
  else { f.push(n); console.log('  XX ' + n + (x ? '\n       ' + x : '')); } };

/* A tela que o app diz estar desenhando. Vem de `view.dataset.tela`, que `render()`
   escreve — antes disto o teste adivinhava por um trecho de texto, e adivinhar errado
   me fez relatar defeito do app que era defeito do instrumento. */
const onde = p => p.evaluate(() => {
  const v = document.getElementById('view');
  return v ? (v.dataset.tela || '(sem marca)') : '(fora do app)';
});

/** Volta `n` vezes, devolvendo a tela depois de cada volta. */
async function voltando(p, n){
  const passos = [];
  for(let i = 0; i < n; i++){
    await p.goBack(); await p.waitForTimeout(700);
    passos.push(await onde(p));
  }
  return passos;
}

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

 console.log('\n=== Salvar um aluno e voltar ===');
 await p.evaluate(() => app.ir('gestao')); await p.waitForTimeout(800);
 await p.evaluate(() => app.ir('alunos')); await p.waitForTimeout(800);
 ok('estou na lista de alunos', (await onde(p)) === 'alunos', await onde(p));
 await p.evaluate(() => {
   for(const b of document.querySelectorAll('button'))
     if(/Helena/.test(b.textContent)){ b.click(); return; }
 });
 await p.waitForTimeout(800);
 ok('abri a ficha de um aluno', (await onde(p)) === 'aluno', await onde(p));

 await p.click('button:has-text("Salvar")'); await p.waitForTimeout(1900);
 ok('salvar devolve à lista', (await onde(p)) === 'alunos', await onde(p));

 let passos = await voltando(p, 2);
 ok('o primeiro voltar NÃO é em branco — sai de alunos',
    passos[0] !== 'alunos', JSON.stringify(passos));
 ok('e vai para a tela de onde se veio', passos[0] === 'gestao', JSON.stringify(passos));

 console.log('\n=== Abrir e voltar sem salvar, que já funcionava ===');
 await p.evaluate(() => app.ir('alunos')); await p.waitForTimeout(800);
 await p.evaluate(() => {
   for(const b of document.querySelectorAll('button'))
     if(/Theo/.test(b.textContent)){ b.click(); return; }
 });
 await p.waitForTimeout(800);
 ok('abri outra ficha', (await onde(p)) === 'aluno', await onde(p));
 passos = await voltando(p, 1);
 ok('um voltar devolve à lista', passos[0] === 'alunos', JSON.stringify(passos));

 console.log('\n=== Arquivar um aluno e voltar ===');
 /* Mesmo caminho de `voltarPara`, por outra porta. */
 await p.evaluate(() => {
   for(const b of document.querySelectorAll('button'))
     if(/Lara/.test(b.textContent)){ b.click(); return; }
 });
 await p.waitForTimeout(800);
 const temArquivar = await p.locator('button:has-text("Arquivar aluno")').count();
 if(temArquivar){
   await p.click('button:has-text("Arquivar aluno")'); await p.waitForTimeout(1900);
   ok('arquivar devolve à lista', (await onde(p)) === 'alunos', await onde(p));
   passos = await voltando(p, 1);
   ok('e o voltar seguinte sai de alunos', passos[0] !== 'alunos', JSON.stringify(passos));
 } else {
   ok('(sem botão de arquivar nesta ficha, caminho não exercitado)', true);
   ok('(idem)', true);
 }

 console.log('\n=== A ordem ao voltar é a ordem em que se passou ===');
 await p.evaluate(() => app.ir('home')); await p.waitForTimeout(700);
 await p.evaluate(() => app.ir('lista')); await p.waitForTimeout(700);
 await p.evaluate(() => app.ir('visao')); await p.waitForTimeout(700);
 await p.evaluate(() => app.ir('gestao')); await p.waitForTimeout(700);
 passos = await voltando(p, 3);
 ok('volta na ordem inversa da ida',
    passos.join(' → ') === 'visao → lista → home', JSON.stringify(passos));
 ok('e nenhum passo repete o anterior',
    passos.every((x, i) => i === 0 || x !== passos[i - 1]), JSON.stringify(passos));

 console.log('\n=== No fundo da pilha, uma tela de verdade ===');
 /* Sem passar do fundo: mais um voltar sairia da página do app, e aí não há #view
    para perguntar nada — é o navegador saindo do site, não o app errando. */
 passos = await voltando(p, 1);
 ok('ainda numa tela do app', passos[0] !== '(fora do app)' && passos[0] !== '(sem marca)',
    JSON.stringify(passos));

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 console.log(f.length ? `\n=== ${f.length} FALHARAM: ${f.join(', ')} ===` : '\n=== TUDO PASSOU ===');
 await b.close();
 process.exit(f.length ? 1 : 0);
})();
