/* Dados de demonstração nunca podem ser confundidos com dados reais.

   O teste central cria dados REAIS que imitam de propósito o formato das sementes —
   aluno `c1`, turma de id curto, conta com "demonstração" escrito no campo de
   aprovação — e exige que sobrevivam à limpeza. Com a versão antiga, que decidia pelo
   padrão do id, este teste falha. */

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

const db = newDb();
db.public.registerFunction({ name:'now', returns:'timestamptz', implementation: () => new Date() });
const pg = db.adapters.createPg();
const _db = require('../api/_db.js');
_db.usarFabrica(() => new pg.Pool());
const api = require('../api/index.js');

let cookie = '';
const chamar = (acao, dados) => new Promise(resolve => {
  const req = { method:'POST', headers: cookie ? { cookie } : {}, body: JSON.stringify({ acao, dados: dados || {} }) };
  const res = {
    statusCode:200,
    setHeader(k, v){ if(k === 'Set-Cookie'){ const c = String(v).split(';')[0]; cookie = c.endsWith('=') ? '' : c; } },
    status(c){ this.statusCode = c; return this; },
    end(b){ resolve({ http:this.statusCode, ...JSON.parse(b) }); },
    json(o){ resolve({ http:this.statusCode, ...o }); }
  };
  api(req, res);
});

const CHAVE = 'a'.repeat(64);

const SEMENTE_TURMAS = [{ id:'t1', nome:'Verde' }, { id:'t2', nome:'Azul' }];
const SEMENTE_ALUNOS = [{ id:'c1', nome:'Helena Demo', turma:'Verde' },
                        { id:'c2', nome:'Theo Demo', turma:'Verde' }];
const SEMENTE_OCS = [{ id:'9001', tipo:'Mordida', sev:2, autorLogin:'tallita.lima',
                       envolvidos:[{ kid:'c1', papel:'Sofreu' }], chain:[] }];
const SEMENTE_CONTAS = [{ login:'ana.demo', nome:'Ana Demo', papel:'miss', turma:'Verde', status:'ativo' }];

console.log('\n=== Preparação ===');
await chamar('configurar', { nome:'Tallita Lima', login:'tallita.lima', chave:CHAVE, codigo:'424242' });
await chamar('entrar', { login:'tallita.lima', chave:CHAVE });
t('gestão autenticada', !!cookie);

console.log('\n=== Dados REAIS que imitam o formato das sementes ===');
/* Exatamente o que a versão antiga apagaria por engano. */
await chamar('salvarTurma', { turma:{ id:'t9', nome:'Maternal Real' } });
await chamar('salvarAluno', { aluno:{ id:'c1', nome:'Criança Real', turma:'Maternal Real' } });
await chamar('criarConta', { nome:'Pessoa Real', login:'pessoa.real', chave:'b'.repeat(64), papel:'miss' });
await chamar('atualizarConta', { login:'pessoa.real', patch:{ status:'ativo', aprovadoPor:'demonstração' } });
await chamar('salvarOcorrencia', { ocorrencia:{ id:'5000', tipo:'Queda', sev:1,
  autorLogin:'tallita.lima', envolvidos:[{ kid:'c1', papel:'Sofreu' }], chain:[] } });

let r = await chamar('sincronizar');
t('aluno real com id de semente existe', r.dados.alunos.some(a => a.id === 'c1' && a.nome === 'Criança Real'));
t('aluno real NÃO está marcado como demonstração',
  r.dados.alunos.find(a => a.id === 'c1').demo === false);
t('turma real de id curto existe', r.dados.turmas.some(x => x.id === 't9'));

console.log('\n=== Carregar demonstração ===');
r = await chamar('carregarDemo', { turmas:SEMENTE_TURMAS, alunos:SEMENTE_ALUNOS,
                                   ocorrencias:SEMENTE_OCS, contas:SEMENTE_CONTAS });
t('carga respondeu', r.ok === true, JSON.stringify(r));

r = await chamar('contarDemo');
t('contagem reconhece o que é demonstração',
  r.ok && r.dados.turmas === 2 && r.dados.alunos === 1 && r.dados.contas === 1 && r.dados.ocorrencias === 1,
  JSON.stringify(r.dados));
console.log('     → ' + JSON.stringify(r.dados));

r = await chamar('sincronizar');
const c1 = r.dados.alunos.find(a => a.id === 'c1');
t('aluno real com id c1 não virou demonstração', c1.nome === 'Criança Real' && c1.demo === false);
t('alunos de demonstração vêm marcados',
  r.dados.alunos.filter(a => a.demo).length === 1);
t('turmas de demonstração vêm marcadas',
  r.dados.turmas.filter(x => x.demo).map(x => x.id).sort().join(',') === 't1,t2');
t('conta de demonstração vem marcada',
  r.dados.contas.filter(c => c.demo).map(c => c.login).join(',') === 'ana.demo',
  'marcadas: ' + JSON.stringify(r.dados.contas.map(c => ({ login:c.login, demo:c.demo }))));

console.log('\n=== Limpar: o real precisa sobreviver ===');
r = await chamar('limparDemo');
t('limpeza responde com o que removeu', r.ok && r.dados.total === 5, JSON.stringify(r.dados));

r = await chamar('sincronizar');
const d = r.dados;
t('ALUNO real sobreviveu',  d.alunos.some(a => a.id === 'c1' && a.nome === 'Criança Real'));
t('TURMA real sobreviveu',  d.turmas.some(x => x.id === 't9' && x.nome === 'Maternal Real'));
t('CONTA real sobreviveu',  d.contas.some(c => c.login === 'pessoa.real'),
  'contas: ' + d.contas.map(c => c.login).join(','));
t('REGISTRO real sobreviveu', d.ocorrencias.some(o => o.id === '5000'));

t('aluno de demonstração sumiu',  !d.alunos.some(a => a.id === 'c2'));
t('turmas de demonstração sumiram', !d.turmas.some(x => x.id === 't1' || x.id === 't2'));
t('conta de demonstração sumiu',  !d.contas.some(c => c.login === 'ana.demo'));
t('registro de demonstração sumiu', !d.ocorrencias.some(o => o.id === '9001'));

r = await chamar('contarDemo');
t('não resta nada marcado', r.dados.total === 0, JSON.stringify(r.dados));

console.log('\n=== Adotar um registro de demonstração o torna real ===');
await chamar('carregarDemo', { turmas:SEMENTE_TURMAS, alunos:SEMENTE_ALUNOS, ocorrencias:[], contas:[] });
await chamar('salvarAluno', { aluno:{ id:'c2', nome:'Theo Adotado', turma:'Verde' } });
r = await chamar('sincronizar');
t('ao salvar, a marca de demonstração cai',
  r.dados.alunos.find(a => a.id === 'c2').demo === false);
await chamar('limparDemo');
r = await chamar('sincronizar');
t('o adotado sobrevive à limpeza seguinte',
  r.dados.alunos.some(a => a.id === 'c2' && a.nome === 'Theo Adotado'));

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE DEMONSTRAÇÃO PASSARAM ===`);
process.exit(falhas ? 1 : 0);
