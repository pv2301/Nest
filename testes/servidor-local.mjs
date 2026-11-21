/* Servidor de desenvolvimento: serve os arquivos estáticos e roteia /api para os
   MESMOS handlers que o Vercel executa, com Postgres em memória.

   Serve para rodar as suítes de navegador contra o backend de verdade, sem precisar
   de banco instalado nem de rede.

   Uso:  node testes/servidor-local.mjs [porta] */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newDb } from 'pg-mem';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.NODE_ENV = 'teste';           // cookie sem Secure, para http local
process.env.CODIGO_CONFIG = process.env.CODIGO_CONFIG || '424242';

/* ---------- banco em memória ---------- */
const db = newDb();
db.public.registerFunction({ name:'now', returns:'timestamptz', implementation: () => new Date() });
const pg = db.adapters.createPg();
const _db = require('../api/_db.js');
_db.usarFabrica(() => new pg.Pool());

/* ---------- Blob de mentira ---------- */
const arquivos = new Map();
const foto = require('../api/foto.js');
foto.usarBlob({
  async put(caminho, corpo, op){
    const url = 'memoria://' + caminho + '-' + Math.random().toString(36).slice(2);
    arquivos.set(url, { corpo, tipo: op.contentType });
    return { url, pathname: caminho };
  },
  async del(url){ arquivos.delete(url); }
});
const fetchReal = globalThis.fetch;
globalThis.fetch = async (url, op) => {
  const a = arquivos.get(String(url));
  if(!a) return fetchReal ? fetchReal(url, op) : { ok:false, status:404 };
  return { ok:true, headers:{ get: k => k === 'content-type' ? a.tipo : null },
           arrayBuffer: async () => a.corpo };
};

const apiIndex = require('../api/index.js');

/* ---------- adaptador: resposta do Node com a cara da do Vercel ---------- */
function adaptar(res){
  res.status = function(c){ this.statusCode = c; return this; };
  res.json = function(o){
    if(!this.getHeader('Content-Type')) this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(o));
    return this;
  };
  return res;
}

const TIPOS = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  /* Sem esta linha o .mjs saía como application/octet-stream e o navegador recusava o
     módulo: regras.mjs é carregado tanto pelo navegador quanto pela API. */
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.webmanifest':'application/manifest+json'
};

const servidor = http.createServer(async (req, res) => {
  adaptar(res);
  const url = new URL(req.url, 'http://localhost');
  req.query = Object.fromEntries(url.searchParams);

  try {
    if(url.pathname === '/api' || url.pathname === '/api/')   return void await apiIndex(req, res);
    if(url.pathname === '/api/foto')                          return void await foto(req, res);
    if(url.pathname === '/api/cron')                          return void await require('../api/cron.js')(req, res);

    /* estáticos */
    let rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const alvo = path.join(RAIZ, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if(!alvo.startsWith(RAIZ) || !fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()){
      res.statusCode = 404; return res.end('não encontrado');
    }
    res.setHeader('Content-Type', TIPOS[path.extname(alvo)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(alvo).pipe(res);
  } catch(e){
    console.error('erro no servidor local:', e);
    if(!res.headersSent){ res.statusCode = 500; res.end(JSON.stringify({ ok:false, erro:String(e.message || e) })); }
  }
});

const porta = Number(process.argv[2] || 8222);
servidor.listen(porta, () => {
  console.log(`servidor local em http://localhost:${porta}`);
  console.log(`CODIGO_CONFIG = ${process.env.CODIGO_CONFIG}`);
});
