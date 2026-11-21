/* Correção de registro e remoção de aluno, no navegador.

   A regra que importa: a autora corrige enquanto ninguém deu ciência, a gestão
   sempre, e depois da primeira ciência o botão some. O resto são as armadilhas que
   causariam perda de dado — duplicar o registro ao salvar, ou sobrescrever o
   corrigido ao começar um novo.

   Precisa de um servidor local novo. `npm run test:navegador` cuida disso. */

import { createRequire } from 'node:module';

/* O Playwright é carregado por require, como as outras suítes do projeto: o import
   de ESM não consulta NODE_PATH, então uma instalação global não seria encontrada. */
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';

/* As escolhas viraram campo com lista: a suíte aciona o componente diretamente, em
   vez de caçar chips. Quem exercita o componente pela interface é navegador-busca. */
const escolher = (p, id, v) => p.evaluate(([i, x]) => app.escolherLista(i, x), [id, v]);

let f=[]; const ok=(n,c,x)=>{ if(c) console.log('  OK '+n); else { f.push(n); console.log('  XX '+n+(x?'\n       '+x:'')); } };
const SENHA_G='Gestora2026', SENHA_M='MissTeste2026';

/* Troca de usuário pelo caminho real: a chave é derivada no navegador a partir da
   senha, então entrar pela API exigiria repetir o algoritmo dentro do teste. */
async function entrarComo(p, login, senha){
  await p.evaluate(()=>app.sair()); await p.waitForTimeout(1400);
  const btn = p.locator('button:text-is("Entrar")');
  if(await btn.count()) { await btn.first().click(); await p.waitForTimeout(700); }
  await p.fill('#f-login', login); await p.fill('#f-senha', senha);
  await p.click('button[type=submit]'); await p.waitForTimeout(2200);
  const agora = p.locator('text=Agora não');
  if(await agora.count()){ await agora.click(); await p.waitForTimeout(900); }
}

(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:430,height:900}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE); await p.waitForTimeout(1500);
 await p.fill('#g-nome','Tallita Lima'); await p.fill('#g-senha', SENHA_G);
 await p.fill('#g-senha2', SENHA_G); await p.fill('#g-codigo','424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(1800);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(()=>app.demo(true)); await p.waitForTimeout(2200);

 /* Uma Miss de verdade: cadastro pela tela, para ter senha utilizável, e aprovação
    pela API, com a sessão de gestão que já está aberta. */
 await p.evaluate(()=>app.sair()); await p.waitForTimeout(1400);
 await p.click('button:text-is("Criar conta")'); await p.waitForTimeout(800);
 await p.fill('#c-nome','Miss Teste'); await p.waitForTimeout(250);
 await p.fill('#c-login','miss.teste');
 await p.fill('#c-senha', SENHA_M); await p.fill('#c-senha2', SENHA_M);
 const chipTurma = p.locator('[data-grupo="turma"] .chip').first();
 if(await chipTurma.count()){ await chipTurma.click(); await p.waitForTimeout(250); }
 await p.click('button[type=submit]'); await p.waitForTimeout(2400);
 ok('a conta nova fica aguardando aprovação',
    /aguardando aprovação/i.test(await p.locator('#view').innerText()));

 await entrarComo(p, 'tallita.lima', SENHA_G);
 await p.evaluate(async () => {
   await fetch('/api', { method:'POST', headers:{'Content-Type':'application/json'},
     credentials:'same-origin', body: JSON.stringify({ acao:'atualizarConta',
       dados:{ login:'miss.teste', patch:{ status:'ativo', aprovadoPor:'tallita.lima' } } }) });
 });

 await entrarComo(p, 'miss.teste', SENHA_M);
 ok('a Miss entrou', (await p.locator('#view').innerText()).includes('Registrar ocorrência'));

 console.log('\n=== Barra de abas ===');
 /* A barra chegava a sete itens para a gestão. Agora a administração mora numa aba. */
 ok('a Miss sem funções concedidas vê três abas',
    (await p.locator('.tabbar button').count()) === 3,
    'abas: ' + (await p.locator('.tabbar').innerText()).replace(/\n/g, ' · '));
 ok('e não vê a aba Gestão',
    (await p.locator('.tabbar button:has-text("Gestão")').count()) === 0);

 console.log('\n=== A Miss registra e corrige ===');
 await p.evaluate(()=>app.iniciar('completo')); await p.waitForTimeout(700);
 await escolher(p, 'cat', 'Incidente'); await p.waitForTimeout(300);
 await escolher(p, 'tipo', 'Mordida'); await p.waitForTimeout(300);
 await p.click('.sevpick button[data-n="2"]'); await p.waitForTimeout(300);
 await p.evaluate(()=>app.irPasso(2)); await p.waitForTimeout(700);
 await p.evaluate(()=>app.abrirLista('kids')); await p.waitForTimeout(500);
 const primeiro = await p.evaluate(() =>
   (document.querySelector('.cl-op').getAttribute('onclick').match(/,'([^']+)'/) || [])[1]);
 await escolher(p, 'kids', primeiro); await p.waitForTimeout(400);
 await escolher(p, 'papel-0', 'Sofreu'); await p.waitForTimeout(300);
 await p.evaluate(()=>app.irPasso(3)); await p.waitForTimeout(600);
 await p.fill('#w-desc','Texto origihal com erro de digitacao.'); await p.waitForTimeout(400);
 await p.evaluate(()=>app.irPasso(4)); await p.waitForTimeout(600);
 await p.click('button:text-is("Enviar registro")'); await p.waitForTimeout(2600);

 const antes = await p.evaluate(()=>document.querySelectorAll('.item').length);
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(900);
 const quantos = await p.locator('.item').count();
 await p.locator('.item').first().click(); await p.waitForTimeout(1300);
 ok('a autora vê o botão de corrigir', (await p.locator('button:text-is("Corrigir registro")').count())===1);

 await p.click('button:text-is("Corrigir registro")'); await p.waitForTimeout(900);
 ok('a barra diz Corrigir registro', (await p.locator('.appbar h2').innerText()).includes('Corrigir'));
 await p.evaluate(()=>app.irPasso(3)); await p.waitForTimeout(600);
 ok('o formulário abre preenchido',
    (await p.locator('#w-desc').inputValue()).includes('origihal'));
 await p.fill('#w-desc','Texto original, agora sem erro.'); await p.waitForTimeout(400);
 await p.evaluate(()=>app.irPasso(4)); await p.waitForTimeout(600);
 ok('o botão diz Salvar correção', (await p.locator('#btn-enviar').innerText()).includes('Salvar correção'));
 await p.click('#btn-enviar'); await p.waitForTimeout(2600);

 let t = await p.locator('#view').innerText();
 ok('volta para o registro, já corrigido', /sem erro/.test(t), t.slice(0,200));
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(900);
 ok('não duplicou o registro', (await p.locator('.item').count())===quantos,
    `antes ${quantos}, agora ${await p.locator('.item').count()}`);

 console.log('\n=== Começar um registro novo não sobrescreve o corrigido ===');
 await p.evaluate(()=>app.iniciar('completo')); await p.waitForTimeout(600);
 await p.evaluate(()=>app.voltar()); await p.waitForTimeout(600);
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(800);
 await p.locator('.item').first().click(); await p.waitForTimeout(1200);
 ok('o registro corrigido continua lá', /sem erro/.test(await p.locator('#view').innerText()));

 console.log('\n=== Depois da ciência, trava para a autora ===');
 /* A cadeia deste registro começa na Miss da turma, não na gestão, então pela fila
    de ciência a gestão daria ciência em outro registro. A marca é posta direto no
    registro certo, com a sessão de gestão, só para montar o cenário. */
 await entrarComo(p, 'tallita.lima', SENHA_G);
 const deuCiencia = await p.evaluate(async () => {
   const post = (acao, dados) => fetch('/api', { method:'POST',
     headers:{'Content-Type':'application/json'}, credentials:'same-origin',
     body: JSON.stringify({ acao, dados }) }).then(r => r.json());
   const r = await post('ocorrencias', {});
   const o = (r.dados || []).find(x => String(x.desc || '').includes('sem erro'));
   if(!o) return 'registro não encontrado';
   o.chain = (o.chain || []).map((c, i) => i === 0
     ? { ...c, st:'ok', quandoISO:new Date().toISOString(), parecer:'Ciente.' } : c);
   const s = await post('salvarOcorrencia', { ocorrencia:o });
   return s.ok === true ? 'ok' : JSON.stringify(s);
 });
 ok('a ciência foi registrada no registro da Miss', deuCiencia === 'ok', String(deuCiencia));

 await entrarComo(p, 'miss.teste', SENHA_M);
 await p.evaluate(()=>app.ir('lista')); await p.waitForTimeout(900);
 await p.locator('.item').first().click(); await p.waitForTimeout(1200);
 t = await p.locator('#view').innerText();
 ok('o botão de corrigir sumiu para a autora',
    (await p.locator('button:text-is("Corrigir registro")').count())===0);
 ok('e a tela explica por quê', /travado pela ciência/i.test(t), t.slice(-250));

 console.log('\n=== A aba Gestão reúne a administração ===');
 await entrarComo(p, 'tallita.lima', SENHA_G);
 ok('a gestão vê quatro abas, não sete',
    (await p.locator('.tabbar button').count()) === 4,
    'abas: ' + (await p.locator('.tabbar').innerText()).replace(/\n/g, ' · '));
 await p.locator('.tabbar button:has-text("Gestão")').click(); await p.waitForTimeout(900);
 const hub = await p.locator('#view').innerText();
 ok('a tela reúne painel, alunos e usuários',
    /Painel/.test(hub) && /Alunos e turmas/.test(hub) && /Usuários/.test(hub), hub.slice(0, 200));
 ok('cada entrada diz o seu estado', /turmas/.test(hub) && /conta/.test(hub));
 await p.locator('.urow:has-text("Alunos e turmas")').click(); await p.waitForTimeout(1000);
 ok('a entrada abre a tela certa, com botão voltar',
    (await p.locator('.appbar .back').count()) === 1 &&
    /Alunos/.test(await p.locator('.appbar h2').innerText()));
 await p.evaluate(()=>app.voltar()); await p.waitForTimeout(800);

 console.log('\n=== Remover aluno pela tela ===');
 await p.evaluate(()=>app.ir('alunos')); await p.waitForTimeout(1000);
 /* Turmas também são linhas nesta tela, então o seletor mira a ação do aluno.
    Esta é a criança que a Miss usou no registro. */
 const linhaAluno = '.urow[onclick^="app.abrirAluno"]';
 await p.locator(linhaAluno).first().click(); await p.waitForTimeout(900);
 t = await p.locator('#view').innerText();
 const comRegistro = /Não dá para remover/i.test(t);
 ok('com registros, explica que não dá para remover', comRegistro, t.slice(-300));
 ok('e oferece arquivar', /Arquivar aluno/.test(t));

 await p.evaluate(()=>app.voltar()); await p.waitForTimeout(900);
 /* Um aluno novo, sem registro nenhum. */
 await p.click('button:has-text("+ Aluno")'); await p.waitForTimeout(800);
 await p.fill('#al-nome','Aluno Descartavel'); await p.waitForTimeout(300);
 await p.click('button:has-text("Adicionar aluno")'); await p.waitForTimeout(2200);
 await p.fill('#b-al','Descartavel'); await p.waitForTimeout(800);
 await p.locator(linhaAluno).first().click(); await p.waitForTimeout(900);
 ok('sem registros, oferece remover',
    (await p.locator('button:text-is("Remover do cadastro")').count())===1,
    (await p.locator('#view').innerText()).slice(-300));
 await p.click('button:text-is("Remover do cadastro")'); await p.waitForTimeout(600);
 ok('pede confirmação', /Não dá para desfazer/i.test(await p.locator('#view').innerText()));
 await p.click('button:text-is("Remover")'); await p.waitForTimeout(2400);
 await p.fill('#b-al','Descartavel'); await p.waitForTimeout(800);
 ok('o aluno sumiu do cadastro', (await p.locator(linhaAluno).count())===0);

 ok('nenhum erro de JavaScript', errs.length===0, errs.join(' | '));
 console.log(f.length ? `\n=== ${f.length} FALHARAM: ${f.join(', ')} ===` : '\n=== TUDO PASSOU ===');
 await b.close(); process.exit(f.length?1:0);
})();
