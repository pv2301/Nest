/* Testes da API contra um Postgres em memória (pg-mem).
   Exercita o handler de verdade — o mesmo arquivo que o Vercel executa — incluindo
   sessão por cookie, permissões por papel e os casos negativos. */

import { newDb } from 'pg-mem';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'teste';
process.env.CODIGO_CONFIG = '424242';

let falhas = 0, total = 0;
const t = (nome, cond, extra) => {
  total++;
  if(cond) console.log('  OK ' + nome);
  else { falhas++; console.log('  XX ' + nome + (extra ? '\n       ' + extra : '')); }
};

/* ---------- banco em memória ---------- */
const db = newDb();
db.public.registerFunction({ name:'now', returns: 'timestamptz', implementation: () => new Date() });
const pg = db.adapters.createPg();

const _db = require('../api/_db.js');
_db.usarFabrica(() => new pg.Pool());

const handler = require('../api/index.js');

/* ---------- requisição e resposta de mentira ---------- */
let cookieAtual = '';

function chamar(acao, dados, { comCookie = true } = {}){
  return new Promise(resolve => {
    const req = {
      method:'POST',
      headers: comCookie && cookieAtual ? { cookie: cookieAtual } : {},
      body: JSON.stringify({ acao, dados: dados || {} })
    };
    const res = {
      statusCode: 200,
      cabecalhos: {},
      setHeader(k, v){
        this.cabecalhos[k] = v;
        if(k === 'Set-Cookie'){
          const c = String(v).split(';')[0];
          cookieAtual = c.endsWith('=') ? '' : c;
        }
      },
      status(c){ this.statusCode = c; return this; },
      end(corpo){ resolve({ http:this.statusCode, ...JSON.parse(corpo) }); },
      json(o){ resolve({ http:this.statusCode, ...o }); }
    };
    handler(req, res);
  });
}

const CHAVE_G = 'a'.repeat(64);
const CHAVE_M = 'b'.repeat(64);
const CHAVE_X = 'c'.repeat(64);

console.log('\n=== Configuração inicial ===');
let r = await chamar('estado');
t('começa pedindo configuração', r.ok && r.dados.precisaConfigurar === true);

r = await chamar('configurar', { nome:'Tallita Lima', login:'tallita.lima', chave:CHAVE_G, codigo:'errado' });
t('código errado é recusado', !r.ok && r.codigo === 'codigo', JSON.stringify(r));

r = await chamar('configurar', { nome:'Tallita Lima', login:'TallitaLima', chave:CHAVE_G, codigo:'424242' });
t('login fora do formato é recusado', !r.ok && r.codigo === 'login');

r = await chamar('configurar', { nome:'Tallita Lima', login:'tallita.lima', chave:CHAVE_G, codigo:'424242' });
t('gestão criada', r.ok && r.dados.papel === 'gestao', JSON.stringify(r));
t('hash da senha nunca sai', r.ok && !JSON.stringify(r).includes('senha_hash'));

r = await chamar('estado');
t('deixa de pedir configuração', r.ok && r.dados.precisaConfigurar === false);

r = await chamar('configurar', { nome:'Outra Pessoa', login:'outra.pessoa', chave:CHAVE_X, codigo:'424242' });
t('segunda configuração é barrada', !r.ok && r.codigo === 'ja_configurado');

console.log('\n=== Entrada e sessão ===');
r = await chamar('eu', {}, { comCookie:false });
t('sem cookie não há sessão', !r.ok && r.codigo === 'sessao' && r.http === 401);

r = await chamar('entrar', { login:'tallita.lima', chave:CHAVE_X });
t('senha errada é recusada', !r.ok && r.codigo === 'credenciais');

r = await chamar('entrar', { login:'nao.existe', chave:CHAVE_G });
t('login inexistente dá a MESMA mensagem', !r.ok && r.erro === 'Login ou senha incorretos.');

r = await chamar('entrar', { login:'tallita.lima', chave:CHAVE_G });
t('gestão entra', r.ok && r.dados.conta.login === 'tallita.lima', JSON.stringify(r));
t('cookie de sessão foi posto', !!cookieAtual && cookieAtual.startsWith('reg_sessao='));

r = await chamar('eu');
t('sessão reconhecida pelo cookie', r.ok && r.dados.login === 'tallita.lima');

console.log('\n=== Cadastro e aprovação ===');
const cookieGestao = cookieAtual;
r = await chamar('criarConta', { nome:'Carolina Mendes', login:'carolina.mendes', chave:CHAVE_M, papel:'miss', turma:'Verde' });
t('conta nova nasce pendente', r.ok && r.dados.status === 'pendente');

r = await chamar('criarConta', { nome:'Carolina Mendes', login:'carolina.mendes', chave:CHAVE_M });
t('login repetido é recusado', !r.ok && r.codigo === 'duplicado');

cookieAtual = '';
r = await chamar('entrar', { login:'carolina.mendes', chave:CHAVE_M });
t('conta pendente NÃO entra', !r.ok && r.codigo === 'pendente', JSON.stringify(r));

cookieAtual = cookieGestao;
r = await chamar('atualizarConta', { login:'carolina.mendes', patch:{ status:'ativo', aprovadoPor:'tallita.lima' } });
t('gestão aprova', r.ok && r.dados.status === 'ativo');

cookieAtual = '';
r = await chamar('entrar', { login:'carolina.mendes', chave:CHAVE_M });
t('aprovada entra', r.ok && r.dados.conta.papel === 'miss');
let cookieMiss = cookieAtual;

console.log('\n=== Permissões ===');
r = await chamar('contas');
t('Miss não lista contas', !r.ok && r.codigo === 'permissao' && r.http === 403);
r = await chamar('salvarTurma', { turma:{ id:'t9', nome:'Pirata' } });
t('Miss não cria turma', !r.ok && r.codigo === 'permissao');

cookieAtual = cookieGestao;
r = await chamar('contas');
t('gestão lista contas', r.ok && r.dados.length === 2);
r = await chamar('atualizarConta', { login:'tallita.lima', patch:{ papel:'miss' } });
t('não rebaixa a própria conta', !r.ok && r.codigo === 'si_mesmo');

console.log('\n=== Turmas e alunos ===');
r = await chamar('salvarTurma', { turma:{ id:'t1', nome:'Verde', faixa:'2 a 3 anos' } });
t('turma criada', r.ok && r.dados.length === 1);
r = await chamar('salvarTurma', { turma:{ id:'t2', nome:'verde' } });
t('turma repetida é recusada', !r.ok && r.codigo === 'duplicado');
r = await chamar('salvarTurma', { turma:{ id:'t1', nome:'Verde', missResponsavel:'carolina.mendes' } });
t('Miss responsável é gravada', r.ok && r.dados[0].missResponsavel === 'carolina.mendes');

r = await chamar('salvarAluno', { aluno:{ id:'c1', nome:'Helena Souza', turma:'Verde' } });
t('aluno criado pela gestão não é avulso', r.ok && r.dados.avulso === false);

cookieAtual = cookieMiss;
r = await chamar('salvarAluno', { aluno:{ id:'c9', nome:'Criança Nova', turma:'Verde' } });
t('Miss cria aluno em campo, marcado avulso', r.ok && r.dados.avulso === true);
r = await chamar('salvarAluno', { aluno:{ id:'c1', nome:'Nome Trocado' } });
t('Miss NÃO edita aluno já cadastrado', !r.ok && r.codigo === 'permissao');

console.log('\n=== Ocorrências e sigilo ===');
/* Registros completos de propósito: o servidor confere o que recebe com a mesma
   oQueFalta da tela, então um dado de teste esquelético não representa nada que o
   app consiga produzir. */
const ocMiss = { id:'9001', categoria:'Incidente', tipo:'Mordida', sev:2,
  autorLogin:'carolina.mendes', presenciou:true,
  desc:'Durante o brincar livre, houve uma mordida no braço, sem rompimento da pele.',
  envolvidos:[{ kid:'c1', papel:'Sofreu', turma:'Verde' }], chain:[{ nivel:'Gestão', st:'now' }] };
r = await chamar('salvarOcorrencia', { ocorrencia: ocMiss });
t('Miss grava ocorrência', r.ok && r.dados.id === '9001');

/* O servidor exigia só um id: um registro sem categoria, sem criança e sem descrição
   era gravado, e só a tela impedia. Quem não passa pela tela — um cliente velho em
   cache, uma chamada direta — gravava lixo no lugar onde ficam registros de criança. */
r = await chamar('salvarOcorrencia', { novo:true, ocorrencia:{ id:'9099', sev:2 } });
t('registro incompleto é recusado pelo servidor',
  !r.ok && r.codigo === 'incompleto' && r.http === 422, JSON.stringify(r));
t('e a recusa diz o que falta',
  !r.ok && /categoria/i.test(r.erro) && /crian/i.test(r.erro) && /descri/i.test(r.erro), r.erro);
r = await chamar('ocorrencias');
t('o registro incompleto não ficou no banco',
  r.ok && !r.dados.some(o => o.id === '9099'));

const ocOutra = { id:'9002', categoria:'Acidente', tipo:'Queda', sev:1,
  autorLogin:'tallita.lima', presenciou:true,
  desc:'Tropeçou no degrau do escorregador e caiu sentada na areia, sem marca.',
  /* c1, e não c9: c9 é o aluno que o teste de remoção precisa ver livre de
     registros. */
  envolvidos:[{ kid:'c1', papel:'Envolvida', turma:'Verde' }],
  chain:[{ nivel:'Gestão', st:'ok' }] };
cookieAtual = cookieGestao;
await chamar('salvarOcorrencia', { ocorrencia: ocOutra });

cookieAtual = cookieMiss;
r = await chamar('ocorrencias');
t('Miss vê só o que lhe cabe', r.ok && r.dados.length === 1 && r.dados[0].id === '9001',
  JSON.stringify(r.dados && r.dados.map(o => o.id)));

cookieAtual = cookieGestao;
r = await chamar('ocorrencias');
t('gestão vê todas', r.ok && r.dados.length === 2);

console.log('\n=== Quem pode alterar um registro ===');
/* Antes da guarda, qualquer conta autenticada sobrescrevia qualquer ocorrência —
   inclusive uma que nem consegue ver. Estes testes fixam a regra. */
const CHAVE_Z = 'd'.repeat(64);
cookieAtual = cookieGestao;
await chamar('salvarTurma', { turma:{ id:'t3', nome:'Azul' } });
await chamar('criarConta', { nome:'Bianca Rocha', login:'bianca.rocha', chave:CHAVE_Z, papel:'miss', turma:'Azul' });
await chamar('atualizarConta', { login:'bianca.rocha', patch:{ status:'ativo', aprovadoPor:'tallita.lima' } });
cookieAtual = '';
r = await chamar('entrar', { login:'bianca.rocha', chave:CHAVE_Z });
t('terceira Miss entra', r.ok === true);

r = await chamar('salvarOcorrencia', { ocorrencia: { ...ocMiss, desc:'texto trocado por estranha' } });
t('Miss de fora NÃO altera registro alheio', !r.ok && r.codigo === 'permissao' && r.http === 403,
  JSON.stringify(r));

cookieAtual = cookieGestao;
r = await chamar('ocorrencias');
const intacta = (r.dados || []).find(o => o.id === '9001');
t('o registro ficou intacto', !!intacta && intacta.desc !== 'texto trocado por estranha');

cookieAtual = cookieMiss;
r = await chamar('salvarOcorrencia', { ocorrencia: { ...ocMiss, acomp:'Família avisada no fim do turno.' } });
t('a autora altera o próprio registro', r.ok === true, JSON.stringify(r));

/* O id antigo tinha quatro dígitos e dava a volta a cada dez segundos: um registro
   novo podia nascer com o número de outro, e o servidor tratava isso como edição —
   sobrescrevendo um registro de verdade, sem avisar ninguém. Agora o cliente diz que
   é novo, e número ocupado é erro. */
r = await chamar('salvarOcorrencia', {
  ocorrencia: { ...ocMiss, desc:'registro novo que calhou de repetir o número' },
  novo: true });
t('registro NOVO com número já usado é recusado',
  !r.ok && r.codigo === 'id_ocupado' && r.http === 409, JSON.stringify(r));

cookieAtual = cookieGestao;
r = await chamar('ocorrencias');
const naoSobrescrito = (r.dados || []).find(o => o.id === ocMiss.id);
t('e o registro que estava lá continua intacto',
  !!naoSobrescrito && !/calhou de repetir/.test(naoSobrescrito.desc || ''),
  JSON.stringify(naoSobrescrito && naoSobrescrito.desc));
cookieAtual = cookieMiss;

cookieAtual = cookieGestao;
r = await chamar('salvarOcorrencia', { ocorrencia: { ...ocMiss, acomp:'Família avisada no fim do turno.',
  textoFamilia:'Helena se desentendeu com outra criança e recebeu um arranhão no braço.' } });
t('gestão altera qualquer registro', r.ok === true);

r = await chamar('ocorrencias');
const comTexto = (r.dados || []).find(o => o.id === '9001');
t('textoFamilia é guardado no registro',
  !!comTexto && comTexto.textoFamilia === 'Helena se desentendeu com outra criança e recebeu um arranhão no braço.',
  JSON.stringify(comTexto && comTexto.textoFamilia));
t('a descrição interna continua separada do texto da família',
  !!comTexto && comTexto.desc !== comTexto.textoFamilia);

console.log('\n=== O servidor manda só o que a tela mostra ===');
/* Antes o servidor tinha a sua própria versão da regra, mais frouxa: mandava à Miss
   todo registro cuja cadeia citasse a turma dela, inclusive o que estava na fila
   atrás de outra turma e que a interface escondia. Agora os dois lados chamam a
   mesma função de regras.mjs. */
/* Uma criança de cada turma, e a autora é de uma terceira: a cadeia nasce com a Miss
   da Verde na vez e a da Azul atrás dela. Quem monta a cadeia é o servidor, então
   aqui ela é consequência dos envolvidos, não um campo escolhido pelo cliente. */
const CHAVE_A = 'e'.repeat(64);
cookieAtual = cookieGestao;
await chamar('salvarTurma', { turma:{ id:'t4', nome:'Amarela' } });
await chamar('salvarAluno', { aluno:{ id:'c2', nome:'Davi Nunes', turma:'Azul' } });
await chamar('criarConta', { nome:'Elisa Prado', login:'elisa.prado', chave:CHAVE_A, papel:'miss', turma:'Amarela' });
await chamar('atualizarConta', { login:'elisa.prado', patch:{ status:'ativo', aprovadoPor:'tallita.lima' } });

cookieAtual = '';
await chamar('entrar', { login:'elisa.prado', chave:CHAVE_A });
const ocFila = { id:'9003', categoria:'Incidente', tipo:'Empurrão', sev:2,
  presenciou:true,
  desc:'As duas disputavam o mesmo brinquedo e houve um empurrão, sem queda.',
  envolvidos:[{ kid:'c1', papel:'Sofreu', turma:'Verde' },
              { kid:'c2', papel:'Causou', turma:'Azul' }],
  /* Cadeia mentirosa de propósito: se o servidor a aceitasse, a autora escolheria
     quem lê o registro. */
  chain:[{ nivel:'Gestão', st:'ok' }] };
r = await chamar('salvarOcorrencia', { ocorrencia: ocFila });
t('registro com duas turmas foi gravado', r.ok === true, JSON.stringify(r));

const cadeia = (r.dados || {}).chain || [];
t('o servidor ignorou a cadeia do cliente',
  cadeia.length === 3 && cadeia[0].st === 'now' && cadeia[0].nivel.includes('Verde'),
  JSON.stringify(cadeia));
t('a Miss da outra turma entra atrás, não junto',
  cadeia[1] && cadeia[1].st === 'wait' && cadeia[1].nivel.includes('Azul'),
  JSON.stringify(cadeia));
t('e a gestão fecha a fila', cadeia[2] && cadeia[2].nivel === 'Gestão', JSON.stringify(cadeia));
t('a autoria também é do servidor, não do que chegou',
  (r.dados || {}).autorLogin === 'elisa.prado', JSON.stringify((r.dados || {}).autorLogin));

cookieAtual = '';
r = await chamar('entrar', { login:'bianca.rocha', chave:CHAVE_Z });
const cookieAzul = cookieAtual;
r = await chamar('ocorrencias');
t('a Miss na fila NÃO recebe o registro',
  r.ok && !r.dados.some(o => o.id === '9003'),
  JSON.stringify(r.dados && r.dados.map(o => o.id)));

cookieAtual = '';
r = await chamar('entrar', { login:'carolina.mendes', chave:CHAVE_M });
r = await chamar('ocorrencias');
t('a Miss da vez recebe', r.ok && r.dados.some(o => o.id === '9003'));

/* A vez passa para a turma Azul. A cadeia que vale é a que o servidor montou, não a
   que o cliente mandou — então é dela que se parte. */
cookieAtual = cookieGestao;
await chamar('salvarOcorrencia', { ocorrencia: { ...ocFila,
  chain:[ { ...cadeia[0], st:'ok' }, { ...cadeia[1], st:'now' }, cadeia[2] ] } });
cookieAtual = cookieAzul;
r = await chamar('ocorrencias');
t('passada a vez, ela passa a receber', r.ok && r.dados.some(o => o.id === '9003'));

r = await chamar('salvarOcorrencia', { ocorrencia: { ...ocFila, desc:'agora pode',
  chain:[ { ...cadeia[0], st:'ok' }, { ...cadeia[1], st:'now' }, cadeia[2] ] } });
t('e passa a poder escrever nele', r.ok === true, JSON.stringify(r));

console.log('\n=== Recuperar a senha sem a gestão ===');
/* A tela de login dizia "Fale com a gestão", e numa sexta à noite isso trancava a
   pessoa fora. Com o código que ela guardou, ela se vira — e esta parte prova que
   ninguém mais se vira com ele. */
const CODIGO = 'K7M2-Q9XT-4BNR-P3WH';
const OUTRO_CODIGO = 'AAAA-BBBB-CCCC-DDDD';
const CHAVE_NOVA = '9'.repeat(64);

cookieAtual = '';
r = await chamar('entrar', { login:'carolina.mendes', chave:CHAVE_M });
t('a Miss entra com a senha de hoje', r.ok === true);
const cookieAntigo = cookieAtual;

r = await chamar('gerarRecuperacao', { codigo: CODIGO });
t('ela gera o próprio código', r.ok === true, JSON.stringify(r));

r = await chamar('eu');
t('o perfil passa a dizer que existe um código',
  r.ok && !!r.dados.recuperacaoEm, JSON.stringify(r.dados && r.dados.recuperacaoEm));
t('mas o código em si nunca volta do servidor',
  !JSON.stringify(r.dados).includes('K7M2') && !JSON.stringify(r.dados).includes('Q9XT'),
  JSON.stringify(r.dados));

cookieAtual = '';
r = await chamar('recuperarSenha', { login:'carolina.mendes', codigo:OUTRO_CODIGO, chave:CHAVE_NOVA });
const recusaCodigoErrado = r.erro;
t('código errado é recusado', !r.ok && r.http === 401, JSON.stringify(r));

r = await chamar('recuperarSenha', { login:'ninguem.existe', codigo:CODIGO, chave:CHAVE_NOVA });
t('login inexistente dá a MESMA recusa', !r.ok && r.erro === recusaCodigoErrado,
  `${r.erro} vs ${recusaCodigoErrado}`);

r = await chamar('recuperarSenha', { login:'bianca.rocha', codigo:CODIGO, chave:CHAVE_NOVA });
t('conta sem código dá a MESMA recusa também', !r.ok && r.erro === recusaCodigoErrado,
  `${r.erro} vs ${recusaCodigoErrado}`);

/* As três recusas acima já contam como tentativas: o limite dispara na quinta, então
   a recuperação boa precisa de um login que ainda não falhou. */
r = await chamar('recuperarSenha', { login:'carolina.mendes', codigo:CODIGO, chave:CHAVE_NOVA });
t('com o código certo, a senha troca', r.ok === true, JSON.stringify(r));

cookieAtual = cookieAntigo;
r = await chamar('ocorrencias');
t('a sessão aberta com a senha antiga foi encerrada',
  !r.ok && r.codigo === 'sessao', JSON.stringify(r));

cookieAtual = '';
r = await chamar('entrar', { login:'carolina.mendes', chave:CHAVE_NOVA });
t('ela entra com a senha nova', r.ok === true, JSON.stringify(r));

r = await chamar('recuperarSenha', { login:'carolina.mendes', codigo:CODIGO, chave:CHAVE_M });
t('o código usado não serve de novo', !r.ok && r.http === 401, JSON.stringify(r));

console.log('\n=== Limite de tentativas ===');
/* Não havia limite nenhum: dava para tentar senha indefinidamente. */
cookieAtual = '';
const alvo = 'alvo.do.limite';
let ultima = null;
for(let i = 0; i < 6; i++) ultima = await chamar('entrar', { login:alvo, chave:'0'.repeat(64) });
t('a sexta tentativa seguida é barrada',
  !ultima.ok && ultima.codigo === 'excesso' && ultima.http === 429, JSON.stringify(ultima));
t('e a recusa diz quanto esperar', /minuto/.test(ultima.erro || ''), ultima.erro);

r = await chamar('recuperarSenha', { login:alvo, codigo:CODIGO, chave:CHAVE_NOVA });
t('o limite vale para a recuperação também',
  !r.ok && r.codigo === 'excesso', JSON.stringify(r));

/* Limpa as tentativas, senão as suítes seguintes herdam o bloqueio. */
await _db.consultar(`DELETE FROM log WHERE acao IN ('entrada_negada','recuperacao_negada')`);

/* A recuperação encerrou as sessões da Miss de propósito, e a senha dela mudou. O
   resto da suíte continua usando essa conta, então a sessão é refeita aqui — a
   alternativa seria espalhar o conserto por cinco asserções distantes. */
cookieAtual = '';
await chamar('entrar', { login:'carolina.mendes', chave:CHAVE_NOVA });
cookieMiss = cookieAtual;
cookieAtual = cookieGestao;

console.log('\n=== Maiúscula de nome, no servidor ===');
/* A tela já normaliza; o servidor também, porque quem não passa pela tela — um
   cliente velho em cache, uma chamada direta — gravava o nome como viesse. */
cookieAtual = cookieGestao;
await chamar('salvarAluno', { aluno:{ id:'c20', nome:'  maria   da SILVA  ', turma:'Verde' } });
r = await chamar('alunos');
const c20 = (r.dados || []).find(a => a.id === 'c20');
t('nome de aluno sai normalizado do servidor',
  !!c20 && c20.nome === 'Maria da Silva', JSON.stringify(c20 && c20.nome));

r = await chamar('salvarTurma', { turma:{ id:'t20', nome:'pré ii' } });
t('nome de turma também', r.ok === true, JSON.stringify(r));
r = await chamar('sincronizar');
const t20 = (r.dados.turmas || []).find(x => x.id === 't20');
t('e algarismo romano fica de pé', t20 && t20.nome === 'Pré II', JSON.stringify(t20));

await chamar('criarConta', { nome:'joão pedro DE souza', login:'joao.pedro',
  chave:'f'.repeat(64), papel:'miss', turma:'Verde' });
r = await chamar('contas');
const jp = (r.dados || []).find(c => c.login === 'joao.pedro');
t('nome de conta também', jp && jp.nome === 'João Pedro de Souza', JSON.stringify(jp && jp.nome));

console.log('\n=== A passagem sobre o que já estava gravado ===');
/* Grava direto no banco, por fora da API, como se fosse dado antigo de antes de a
   normalização existir. */
await _db.consultar(`UPDATE alunos SET nome = 'joana   rocha dos SANTOS' WHERE id = 'c20'`);
await _db.consultar(`DELETE FROM config WHERE chave = 'nomesNormalizados'`);

const passagem = await _db.normalizarNomes();
t('a passagem corrigiu e disse quantos', passagem.mudou >= 1, JSON.stringify(passagem));
r = await chamar('alunos');
t('o nome antigo ficou certo',
  (r.dados || []).some(a => a.id === 'c20' && a.nome === 'Joana Rocha dos Santos'),
  JSON.stringify((r.dados || []).find(a => a.id === 'c20')));

const segunda = await _db.normalizarNomes();
t('rodar de novo não faz nada', segunda.pulou === true, JSON.stringify(segunda));

console.log('\n=== Remover aluno do cadastro ===');
cookieAtual = cookieMiss;
r = await chamar('removerAluno', { id:'c9' });
t('Miss não remove aluno', !r.ok && r.codigo === 'permissao' && r.http === 403);

cookieAtual = cookieGestao;
/* Antes isto era recusado: os registros guardam só o id da criança e passariam a
   apontar para ninguém. Agora o nome é copiado para dentro de cada registro antes de
   o cadastro sair, e é isso que esta parte prova — remover o cadastro não pode levar
   junto a legibilidade do que já aconteceu. */
r = await chamar('removerAluno', { id:'c1' });
t('aluno que aparece em registro agora é removido', r.ok === true, JSON.stringify(r));
r = await chamar('alunos');
t('e sai mesmo do cadastro', r.ok && !r.dados.some(a => a.id === 'c1'));

r = await chamar('ocorrencias');
const antigos = (r.dados || []).filter(o => (o.envolvidos || []).some(e => e.kid === 'c1'));
t('os registros em que ele aparecia continuam lá', antigos.length > 0, String(antigos.length));
t('e guardam o nome que ele tinha',
  antigos.every(o => o.envolvidos.filter(e => e.kid === 'c1')
    .every(e => typeof e.nomeArquivado === 'string' && e.nomeArquivado.length > 0)),
  JSON.stringify(antigos.map(o => o.envolvidos.map(e => e.nomeArquivado))));

r = await chamar('removerAluno', { id:'c9' });
t('aluno sem registro é removido', r.ok && !r.dados.some(a => a.id === 'c9'),
  JSON.stringify(r.dados && r.dados.map(a => a.id)));

r = await chamar('removerAluno', { id:'nao-existe' });
t('aluno inexistente responde 404', !r.ok && r.codigo === 'inexistente' && r.http === 404);

console.log('\n=== Sincronizar: uma requisição só ===');
r = await chamar('sincronizar');
const d = r.dados || {};
t('traz conta, ocorrências, diretório, alunos, turmas e contas',
  r.ok && d.conta && Array.isArray(d.ocorrencias) && Array.isArray(d.diretorio)
  && Array.isArray(d.alunos) && Array.isArray(d.turmas) && Array.isArray(d.contas),
  JSON.stringify(Object.keys(d)));
t('diretório não expõe senha', !JSON.stringify(d.diretorio).includes('hash'));

console.log('\n=== Sessão encerrada ===');
r = await chamar('sair');
t('sair responde', r.ok === true);
r = await chamar('eu');
t('depois de sair, não há sessão', !r.ok && r.codigo === 'sessao');

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE API PASSARAM ===`);
process.exit(falhas ? 1 : 0);
