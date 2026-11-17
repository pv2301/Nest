/* Conexão com o Postgres e criação do esquema.
   As migrações rodam sozinhas, de forma idempotente, na primeira requisição de cada
   instância — não há passo manual de criar tabelas. */

const { Pool } = require('pg');

let pool = null;
let pronto = null;

/** Permite injetar outro banco nos testes (pg-mem). */
let fabrica = () => new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,                       // serverless: uma conexão por instância
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000
});

function usarFabrica(f){ fabrica = f; pool = null; pronto = null; }

function obterPool(){
  if(!pool) pool = fabrica();
  return pool;
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS contas (
     login          TEXT PRIMARY KEY,
     nome           TEXT NOT NULL,
     papel          TEXT NOT NULL,
     turma          TEXT,
     funcoes        TEXT NOT NULL DEFAULT '',
     status         TEXT NOT NULL,
     senha_hash     TEXT NOT NULL,
     criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
     aprovado_por   TEXT,
     aprovado_em    TIMESTAMPTZ,
     trocar_senha   BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE TABLE IF NOT EXISTS turmas (
     id               TEXT PRIMARY KEY,
     nome             TEXT NOT NULL UNIQUE,
     faixa            TEXT,
     miss_responsavel TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS alunos (
     id         TEXT PRIMARY KEY,
     nome       TEXT NOT NULL,
     turma      TEXT,
     nascimento TEXT,
     saude      TEXT,
     ativo      BOOLEAN NOT NULL DEFAULT true,
     avulso     BOOLEAN NOT NULL DEFAULT false,
     criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS ocorrencias (
     id          TEXT PRIMARY KEY,
     dados       JSONB NOT NULL,
     autor_login TEXT NOT NULL,
     criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS anexos (
     id             TEXT PRIMARY KEY,
     ocorrencia_id  TEXT NOT NULL,
     caminho        TEXT NOT NULL,
     url            TEXT NOT NULL,
     criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
     expira_em      TIMESTAMPTZ NOT NULL,
     preservado     BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE TABLE IF NOT EXISTS sessoes (
     token_hash TEXT PRIMARY KEY,
     login      TEXT NOT NULL,
     expira_em  TIMESTAMPTZ NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS log (
     id      SERIAL PRIMARY KEY,
     quando  TIMESTAMPTZ NOT NULL DEFAULT now(),
     login   TEXT,
     acao    TEXT NOT NULL,
     detalhe TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS config (
     chave TEXT PRIMARY KEY,
     valor TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ocorrencias_criado ON ocorrencias (criado_em DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes (expira_em)`,
  `CREATE INDEX IF NOT EXISTS idx_anexos_expira ON anexos (expira_em)`,
  `CREATE INDEX IF NOT EXISTS idx_log_quando ON log (quando DESC)`
];

async function migrar(){
  const p = obterPool();
  for(const sql of ESQUEMA) await p.query(sql);
}

/** Garante o esquema uma vez por instância. */
function garantir(){
  if(!pronto) pronto = migrar().catch(e => { pronto = null; throw e; });
  return pronto;
}

async function consultar(sql, params){
  await garantir();
  return obterPool().query(sql, params);
}

/** Primeira linha, ou null. */
async function uma(sql, params){
  const r = await consultar(sql, params);
  return r.rows[0] || null;
}

async function todas(sql, params){
  const r = await consultar(sql, params);
  return r.rows;
}

async function registrar(login, acao, detalhe){
  try {
    await consultar('INSERT INTO log (login, acao, detalhe) VALUES ($1,$2,$3)',
      [login || null, acao, detalhe ? String(detalhe).slice(0, 2000) : null]);
  } catch { /* log nunca derruba a operação */ }
}

module.exports = { consultar, uma, todas, registrar, garantir, usarFabrica, obterPool };
