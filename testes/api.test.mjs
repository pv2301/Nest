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
const cookieMiss = cookieAtual;

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
const ocMiss = { id:'9001', tipo:'Mordida', sev:2, autorLogin:'carolina.mendes',
  envolvidos:[{ kid:'c1', papel:'Sofreu', turma:'Verde' }], chain:[{ nivel:'Gestão', st:'now' }] };
r = await chamar('salvarOcorrencia', { ocorrencia: ocMiss });
t('Miss grava ocorrência', r.ok && r.dados.id === '9001');

const ocOutra = { id:'9002', tipo:'Queda', sev:1, autorLogin:'tallita.lima',
  envolvidos:[], chain:[{ nivel:'Gestão', st:'ok' }] };
cookieAtual = cookieGestao;
await chamar('salvarOcorrencia', { ocorrencia: ocOutra });

cookieAtual = cookieMiss;
r = await chamar('ocorrencias');
t('Miss vê só o que lhe cabe', r.ok && r.dados.length === 1 && r.dados[0].id === '9001',
  JSON.stringify(r.dados && r.dados.map(o => o.id)));

cookieAtual = cookieGestao;
r = await chamar('ocorrencias');
t('gestão vê todas', r.ok && r.dados.length === 2);

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
