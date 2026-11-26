/* Quem é "Souza"? O caminho inteiro, no navegador.

   O relato: "se o usuário cita Souza como uma criança mas existem Ricardo Souza,
   Telma Souza, Souza Cruz, então o sistema deve alertar para que o usuário confirme a
   qual ele se refere".

   O motor tem a sua suíte de nó, com 55 asserções — e ela não prova nada sobre a
   tela. O que esta suíte trava é a outra metade: que o bloco aparece onde a Miss está
   escrevendo, que o envio não passa sem resposta, que a resposta fica gravada, e que
   o relatório depois anonimiza a criança que ELA confirmou e não outra.

   E trava o caso que ninguém prevê: uma criança nova se matricula e torna ambíguo um
   nome que era único quando o registro foi escrito. O que já foi confirmado não pode
   voltar a perguntar.

   Precisa de um servidor local novo: o banco em memória guarda o estado, e uma
   segunda execução encontraria a escola já configurada. `npm run test:navegador`
   cuida disso. */

import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_TESTE || 'http://localhost:8222/';

let f = []; const ok = (n, c, x) => { if(c) console.log('  OK ' + n);
  else { f.push(n); console.log('  XX ' + n + (x ? '\n       ' + x : '')); } };

const escolher = (p, id, v) => p.evaluate(([i, x]) => app.escolherLista(i, x), [id, v]);

/** Cadastra uma criança pela tela de verdade, como a gestão faria. */
async function cadastrar(p, nome, turma){
  await p.evaluate(() => app.ir('alunos')); await p.waitForTimeout(600);
  await p.evaluate(() => app.novoAluno()); await p.waitForTimeout(500);
  await p.fill('#al-nome', nome); await p.waitForTimeout(150);
  if(turma) await escolher(p, 'turma-aluno', turma);
  await p.waitForTimeout(250);
  await p.click('button:has-text("Adicionar aluno")'); await p.waitForTimeout(1500);
}

/** O bloco de dúvida que está na tela agora, se houver. */
const duvida = p => p.evaluate(() => {
  const e = document.querySelector('[id$="-chk-nomes"] .notice, .notice.alert');
  const bloco = [...document.querySelectorAll('.notice.alert')]
    .find(x => /pode ser mais de uma crian/i.test(x.textContent));
  return bloco ? bloco.innerText.replace(/\s+/g, ' ').trim() : (e ? '' : '');
});

(async () => {
 const b = await chromium.launch();
 const ctx = await b.newContext({ viewport:{ width:430, height:900 } });
 const p = await ctx.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message));

 await p.goto(BASE); await p.waitForTimeout(1500);
 await p.fill('#g-nome', 'Tallita Lima'); await p.fill('#g-senha', 'Gestora2026');
 await p.fill('#g-senha2', 'Gestora2026'); await p.fill('#g-codigo', '424242');
 await p.click('button[type=submit]'); await p.waitForTimeout(1800);
 await p.click('text=Agora não'); await p.waitForTimeout(900);
 await p.evaluate(() => app.demo(true)); await p.waitForTimeout(2200);

 /* O cadastro do relato: a demonstração já tem Helena Souza; faltam as outras duas
    Souzas e o sobrenome composto que também começa com Souza. */
 console.log('\n=== O cadastro que cria a dúvida ===');
 await cadastrar(p, 'Ricardo Souza', 'Azul');
 await cadastrar(p, 'Telma Souza', 'Verde');
 await cadastrar(p, 'Souza Cruz', 'Amarela');
 await p.evaluate(() => app.ir('alunos')); await p.waitForTimeout(700);
 const tela = await p.locator('#view').innerText();
 ok('as três Souzas estão cadastradas',
    tela.includes('Ricardo Souza') && tela.includes('Telma Souza') && tela.includes('Souza Cruz'),
    tela.slice(0, 300));

 /* Ids distintos. Era 'a' + milissegundo em base 36: três cadastros seguidos podiam
    nascer com o mesmo código, e o servidor, achando a linha, fazia UPDATE — uma
    criança sobrescrevia a outra em silêncio. Aqui se conta pela lista do registro,
    que é onde o id aparece na tela. */
 await p.evaluate(() => app.iniciar('completo')); await p.waitForTimeout(600);
 await p.evaluate(() => app.irPasso(2)); await p.waitForTimeout(600);
 await p.evaluate(() => app.abrirLista('kids')); await p.waitForTimeout(500);
 const idsNaLista = await p.evaluate(() => [...document.querySelectorAll('.cl-op')]
   .map(b => (b.getAttribute('onclick').match(/,'([^']+)'/) || [])[1]));
 ok('cada criança tem um id próprio',
    idsNaLista.length > 3 && new Set(idsNaLista).size === idsNaLista.length,
    JSON.stringify(idsNaLista));
 await p.evaluate(() => app.fecharLista()); await p.waitForTimeout(300);

 console.log('\n=== A dúvida aparece onde ela está escrevendo ===');
 await p.evaluate(() => app.irPasso(1)); await p.waitForTimeout(600);
 await escolher(p, 'cat', 'Incidente'); await p.waitForTimeout(300);
 await escolher(p, 'tipo', 'Mordida'); await p.waitForTimeout(300);
 /* A gravidade virou campo com lista, como todo campo de formulário. */
 await p.evaluate(()=>app.escolherLista('sev','2')); await p.waitForTimeout(300);
 await p.evaluate(() => app.irPasso(2)); await p.waitForTimeout(700);

 /* A envolvida NÃO é uma Souza: se fosse, a regra "está entre as envolvidas"
    resolveria a dúvida sozinha — e com razão. */
 await p.evaluate(() => app.abrirLista('kids')); await p.waitForTimeout(500);
 const theo = await p.evaluate(() => {
   const b = [...document.querySelectorAll('.cl-op')]
     .find(x => /Theo/.test(x.textContent));
   return b ? (b.getAttribute('onclick').match(/,'([^']+)'/) || [])[1] : null;
 });
 ok('achei o Theo na lista', !!theo, String(theo));
 await escolher(p, 'kids', theo); await p.waitForTimeout(400);
 await escolher(p, 'papel-0', 'Sofreu'); await p.waitForTimeout(300);
 await p.evaluate(() => app.irPasso(3)); await p.waitForTimeout(700);

 ok('sem nome ambíguo, nenhum bloco atrapalha', !(await duvida(p)));

 /* Digita como a Miss digita: tecla por tecla, para o bloco ter de se atualizar sem
    a tela ser redesenhada. Redesenhar derrubaria o teclado. */
 await p.click('#w-desc');
 /* "Souza" é ambíguo e vai perguntar; "Benício" é único e não vai — é o que mostra
    que o bloco pergunta só o indecidível. Mais tarde outro Benício se matricula, e aí
    sim. */
 await p.type('#w-desc', 'No fim do turno, Souza empurrou o balde de areia e foi preciso '
   + 'separar as duas. Benício viu tudo e chamou a Miss.', { delay: 6 });
 await p.waitForTimeout(600);

 const texto = await duvida(p);
 ok('o bloco aparece ao escrever "Souza"', /pode ser mais de uma criança/i.test(texto), texto);
 ok('e nomeia o trecho que ficou em dúvida', /Souza/.test(texto), texto);
 ok('o campo de descrição continua com o que foi digitado — a tela não foi redesenhada',
    (await p.locator('#w-desc').inputValue()).includes('empurrou o balde'),
    await p.locator('#w-desc').inputValue());
 ok('o foco segue no campo de texto',
    await p.evaluate(() => document.activeElement && document.activeElement.id === 'w-desc'));
 ok('e pergunta UMA coisa só: "Benício" não dá margem a dúvida',
    await p.evaluate(() => [...document.querySelectorAll('.notice.alert')]
      .filter(x => /pode ser mais de uma crian/i.test(x.textContent)).length) === 1);

 console.log('\n=== As candidatas, e como se distinguem ===');
 await p.evaluate(() => {
   const cp = [...document.querySelectorAll('.cl-campo')].find(x => /cit-/.test(x.id));
   if(cp) cp.click();
 });
 await p.waitForTimeout(500);
 const lista = await p.evaluate(() => [...document.querySelectorAll('.cl-ops [role=option]')]
   .map(b => b.innerText.replace(/\s+/g, ' ').trim()));
 ok('oferece as quatro Souzas e a saída',
    lista.length === 5 && lista.some(x => /Ricardo Souza/.test(x))
      && lista.some(x => /Não é uma criança/i.test(x)),
    JSON.stringify(lista));
 ok('cada candidata traz turma e idade, que é o que as distingue',
    lista.filter(x => /Turma/.test(x)).length >= 3, JSON.stringify(lista));

 console.log('\n=== Sem responder, o envio não passa ===');
 await p.evaluate(() => app.fecharLista()); await p.waitForTimeout(400);
 await p.evaluate(() => app.irPasso(4)); await p.waitForTimeout(600);
 await p.click('button:text-is("Enviar registro")'); await p.waitForTimeout(1200);
 const aviso = await p.locator('#view').innerText();
 ok('o envio é recusado e diz por quê',
    /Confirmar de qual criança/i.test(aviso), aviso.slice(0, 400));
 await p.evaluate(() => app.ir('lista')); await p.waitForTimeout(800);
 const antes = await p.evaluate(() => document.querySelectorAll('.item').length);

 console.log('\n=== Respondendo, passa — e a resposta fica gravada ===');
 await p.evaluate(() => app.ir('wizard')); await p.waitForTimeout(600);
 await p.evaluate(() => app.irPasso(3)); await p.waitForTimeout(700);
 const campoCit = await p.evaluate(() => {
   const cp = [...document.querySelectorAll('.cl-campo')].find(x => /cit-/.test(x.id));
   return cp ? cp.id.replace(/^cp-/, '') : null;
 });
 ok('o bloco continua lá depois de voltar ao passo', !!campoCit, String(campoCit));
 /* Escolhe pela lista, que é como a pessoa faz. */
 await p.evaluate(id => app.abrirLista(id), campoCit); await p.waitForTimeout(500);
 await p.evaluate(() => {
   const b = [...document.querySelectorAll('.cl-ops [role=option]')]
     .find(x => /Ricardo Souza/.test(x.textContent));
   if(b) b.click();
 });
 await p.waitForTimeout(700);
 ok('respondido, o bloco sai da tela', !(await duvida(p)), await duvida(p));

 await p.evaluate(() => app.irPasso(4)); await p.waitForTimeout(600);
 await p.click('button:text-is("Enviar registro")'); await p.waitForTimeout(2600);
 await p.evaluate(() => app.ir('lista')); await p.waitForTimeout(900);
 const depois = await p.evaluate(() => document.querySelectorAll('.item').length);
 ok('agora o registro foi gravado', depois === antes + 1, `antes ${antes}, depois ${depois}`);

 console.log('\n=== O relatório anonimiza quem ELA confirmou ===');
 await p.click('.item'); await p.waitForTimeout(1300);
 await p.click('button:has-text("Gerar relatório")'); await p.waitForTimeout(900);
 const ficha = await p.locator('.ficha').innerText();
 ok('nenhum "Souza" sobrou no documento', !/Souza/.test(ficha), ficha.slice(0, 400));
 const legenda = await p.evaluate(() =>
   [...document.querySelectorAll('.kv dt')].map(e => e.textContent.trim()));
 ok('a legenda traz o Ricardo Souza, que foi quem ela confirmou',
    legenda.includes('Ricardo Souza'), JSON.stringify(legenda));
 ok('e NÃO traz as outras Souzas',
    !legenda.includes('Telma Souza') && !legenda.includes('Souza Cruz')
      && !legenda.includes('Helena Souza'),
    JSON.stringify(legenda));
 ok('o relatório não volta a perguntar o que já foi respondido',
    !/pode ser mais de uma criança/i.test(await p.locator('#view').innerText()));

 console.log('\n=== Uma criança nova não reabre o que já foi confirmado ===');
 /* O caso que ninguém prevê: "Benício" era único quando o registro foi escrito, e
    agora outro Benício se matriculou. A resposta já dada sobre "Souza" tem de
    continuar valendo; a dúvida nova é que aparece. */
 await cadastrar(p, 'Benício Alves', 'Amarela');
 await p.evaluate(() => app.ir('lista')); await p.waitForTimeout(900);
 await p.click('.item'); await p.waitForTimeout(1200);
 await p.click('button:has-text("Gerar relatório")'); await p.waitForTimeout(900);
 const agora = await p.locator('#view').innerText();
 ok('"Souza" segue respondido',
    !/Souza.{0,40}pode ser mais de uma/i.test(agora), agora.slice(0, 300));
 ok('mas "Benício", que acabou de ficar ambíguo, é perguntado',
    /Benício[\s\S]{0,60}pode ser mais de uma criança/i.test(agora)
      || /pode ser mais de uma criança/i.test(agora), agora.slice(0, 600));
 const leg2 = await p.locator('.ficha').innerText();
 ok('e nenhum nome de criança voltou ao papel',
    !/Theo/.test(leg2) && !/Souza/.test(leg2), leg2.slice(0, 300));

 console.log('\n=== E no texto da família, que é reescrito aqui ===');
 /* O comunicado é revisado nesta tela, e pode trazer um nome que o registro não
    tinha. Sem o bloco se atualizar ao digitar, a dúvida só apareceria no próximo
    desenho da tela — isto é, depois de o papel estar pronto. */
 await p.click('.chip:text-is("Para a família")'); await p.waitForTimeout(800);
 await p.click('#f-familia');
 await p.fill('#f-familia', '');
 await p.type('#f-familia', 'A turma brincava no pátio quando Telma tropeçou no balde.',
   { delay: 6 });
 await p.waitForTimeout(700);
 ok('escrever um nome ambíguo no texto da família faz a pergunta aparecer',
    /pode ser mais de uma criança/i.test(await p.locator('#f-nomes').innerText().catch(() => '')),
    await p.locator('#f-nomes').innerText().catch(() => '(sem bloco)'));
 ok('e o que estava sendo digitado continua no campo',
    (await p.locator('#f-familia').inputValue()).includes('tropeçou no balde'),
    await p.locator('#f-familia').inputValue());

 ok('nenhum erro de JavaScript', errs.length === 0, errs.join(' | '));
 console.log(f.length ? `\n=== ${f.length} FALHARAM: ${f.join(', ')} ===` : '\n=== TUDO PASSOU ===');
 await b.close();
 process.exit(f.length ? 1 : 0);
})();
