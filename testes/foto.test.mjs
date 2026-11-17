/* Testes do anexo: envio, leitura autorizada, recusa sem acesso e expurgo aos 90 dias.
   O Vercel Blob é substituído por um armazenamento de mentira, para o teste rodar
   sem rede e sem token. */

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
const foto = require('../api/foto.js');

/* ---------- Blob de mentira ---------- */
const arquivos = new Map();
foto.usarBlob({
  async put(caminho, corpo, opcoes){
    const url = 'https://blob.teste/' + caminho + '-' + Math.random().toString(36).slice(2);
    arquivos.set(url, { corpo, tipo: opcoes.contentType });
    return { url, pathname: caminho };
  },
  async del(url){ arquivos.delete(url); }
});

/* fetch de mentira, para a leitura do anexo */
globalThis.fetch = async url => {
  const a = arquivos.get(String(url));
  if(!a) return { ok:false, status:404 };
  return {
    ok:true,
    headers:{ get: k => k === 'content-type' ? a.tipo : null },
    arrayBuffer: async () => a.corpo
  };
};

let cookie = '';
const resposta = resolve => ({
  statusCode:200,
  setHeader(k, v){ if(k === 'Set-Cookie'){ const c = String(v).split(';')[0]; cookie = c.endsWith('=') ? '' : c; } },
  status(c){ this.statusCode = c; return this; },
  end(b){ resolve({ http:this.statusCode, corpo:b }); },
  json(o){ resolve({ http:this.statusCode, ...o }); }
});

const chamarApi = (acao, dados) => new Promise(r =>
  api({ method:'POST', headers: cookie ? { cookie } : {}, body: JSON.stringify({ acao, dados }) },
      { ...resposta(x => r(x.corpo ? { http:x.http, ...JSON.parse(x.corpo) } : x)),
        setHeader(k, v){ if(k === 'Set-Cookie'){ const c = String(v).split(';')[0]; cookie = c.endsWith('=') ? '' : c; } },
        status(c){ this.statusCode = c; return this; },
        end(b){ r({ http:this.statusCode, ...JSON.parse(b) }); },
        json(o){ r({ http:this.statusCode, ...o }); } }));

function chamarFoto(metodo, query, { corpo, tipo, usarCookie = true } = {}){
  return new Promise(resolve => {
    const req = {
      method: metodo,
      query,
      headers: { ...(tipo ? { 'content-type': tipo } : {}), ...(usarCookie && cookie ? { cookie } : {}) },
      async *[Symbol.asyncIterator](){ if(corpo) yield Buffer.from(corpo); }
    };
    const res = {
      statusCode:200, cabecalhos:{},
      setHeader(k, v){ this.cabecalhos[k] = v; },
      status(c){ this.statusCode = c; return this; },
      end(b){ resolve({ http:this.statusCode, binario:b, cabecalhos:this.cabecalhos }); },
      json(o){ resolve({ http:this.statusCode, ...o }); }
    };
    foto(req, res);
  });
}

const CHAVE_G = 'a'.repeat(64), CHAVE_M = 'b'.repeat(64), CHAVE_O = 'd'.repeat(64);
const IMAGEM = Buffer.from([0xFF,0xD8,0xFF,0xE0, ...Array(200).fill(7)]);

console.log('\n=== Preparação ===');
await chamarApi('configurar', { nome:'Tallita Lima', login:'tallita.lima', chave:CHAVE_G, codigo:'424242' });
await chamarApi('entrar', { login:'tallita.lima', chave:CHAVE_G });
await chamarApi('salvarTurma', { turma:{ id:'t1', nome:'Verde' } });
await chamarApi('salvarAluno', { aluno:{ id:'c1', nome:'Helena Souza', turma:'Verde' } });
await chamarApi('criarConta', { nome:'Carolina Mendes', login:'carolina.mendes', chave:CHAVE_M, papel:'miss', turma:'Verde' });
await chamarApi('atualizarConta', { login:'carolina.mendes', patch:{ status:'ativo' } });
await chamarApi('criarConta', { nome:'Outra Pessoa', login:'outra.pessoa', chave:CHAVE_O, papel:'miss', turma:'Roxa' });
await chamarApi('atualizarConta', { login:'outra.pessoa', patch:{ status:'ativo' } });

const cookieGestao = cookie;
cookie = '';
await chamarApi('entrar', { login:'carolina.mendes', chave:CHAVE_M });
const cookieMiss = cookie;
await chamarApi('salvarOcorrencia', { ocorrencia:{
  id:'7001', tipo:'Mordida', sev:2, autorLogin:'carolina.mendes',
  envolvidos:[{ kid:'c1', papel:'Sofreu', turma:'Verde' }],
  chain:[{ nivel:'Carolina Mendes (Turma Verde)', st:'ok' },{ nivel:'Gestão', st:'now' }] } });
t('cenário montado', true);

console.log('\n=== Envio ===');
let r = await chamarFoto('POST', { ocorrencia:'7001' }, { corpo:IMAGEM, tipo:'image/jpeg' });
t('autora envia a foto', r.ok === true && !!r.dados.id, JSON.stringify(r));
t('retenção de 90 dias informada', r.dados && r.dados.dias === 90);
const fotoId = r.dados && r.dados.id;

r = await chamarFoto('POST', { ocorrencia:'7001' }, { corpo:IMAGEM, tipo:'application/pdf' });
t('tipo não-imagem é recusado', !r.ok && r.codigo === 'tipo' && r.http === 415);

r = await chamarFoto('POST', { ocorrencia:'7001' }, { corpo:IMAGEM, tipo:'image/jpeg', usarCookie:false });
t('sem sessão não envia', !r.ok && r.http === 401);

console.log('\n=== Leitura ===');
r = await chamarFoto('GET', { id: fotoId });
t('autora lê a imagem', r.http === 200 && Buffer.isBuffer(r.binario) && r.binario.length === IMAGEM.length);
t('não é cacheada pelo navegador', r.cabecalhos && r.cabecalhos['Cache-Control'] === 'private, no-store');

r = await chamarFoto('GET', { id: fotoId }, { usarCookie:false });
t('sem sessão não lê', !r.ok && r.http === 401);

cookie = '';
await chamarApi('entrar', { login:'outra.pessoa', chave:CHAVE_O });
r = await chamarFoto('GET', { id: fotoId });
t('Miss de outra turma NÃO lê', !r.ok && r.codigo === 'permissao' && r.http === 403, JSON.stringify(r));

cookie = cookieGestao;
r = await chamarFoto('GET', { id: fotoId });
t('gestão lê', r.http === 200 && Buffer.isBuffer(r.binario));

console.log('\n=== Retenção de 90 dias ===');
let n = await foto.expurgar(new Date());
t('nada expira hoje', n === 0);
t('arquivo continua no armazenamento', arquivos.size === 1);

const daquiA91Dias = new Date(Date.now() + 91 * 864e5);
n = await foto.expurgar(daquiA91Dias);
t('expira aos 90 dias', n === 1);
t('arquivo foi apagado de verdade', arquivos.size === 0);

r = await chamarFoto('GET', { id: fotoId });
t('leitura depois do expurgo explica o motivo',
  !r.ok && r.http === 404 && /retenção/i.test(r.erro), JSON.stringify(r));

console.log('\n=== Preservação pela gestão ===');
r = await chamarFoto('POST', { ocorrencia:'7001' }, { corpo:IMAGEM, tipo:'image/jpeg' });
const id2 = r.dados.id;
await _db.consultar('UPDATE anexos SET preservado = true WHERE id = $1', [id2]);
n = await foto.expurgar(daquiA91Dias);
t('anexo preservado sobrevive ao expurgo', n === 0 && arquivos.size === 1);

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE FOTO PASSARAM ===`);
process.exit(falhas ? 1 : 0);
