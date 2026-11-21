/* Roda as suítes de navegador, cada uma contra um servidor recém-iniciado.

   O servidor local guarda o banco em memória: reaproveitá-lo entre suítes faria a
   segunda encontrar a escola já configurada e falhar na primeira linha. Aqui cada
   suíte ganha o seu, numa porta própria, e ele morre no fim.

   O Playwright não é dependência do projeto de propósito: baixa um navegador inteiro,
   e quem só quer rodar `npm test` não precisa dele. Para estas suítes:

     npm i -D playwright && npx playwright install chromium
*/

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SUITES = ['navegador-relatorio.mjs', 'navegador-registro.mjs', 'navegador-vocabulario.mjs'];

try {
  createRequire(import.meta.url)('playwright');
} catch {
  console.error('\nO Playwright não está instalado. Para rodar as suítes de navegador:\n' +
                '  npm i -D playwright && npx playwright install chromium\n');
  process.exit(1);
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function noAr(base, tentativas = 40){
  for(let i = 0; i < tentativas; i++){
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if(r.ok) return true;
    } catch {}
    await esperar(250);
  }
  return false;
}

let falhou = false;
let porta = Number(process.env.PORTA_BASE || 8300);

for(const suite of SUITES){
  porta++;
  const base = `http://localhost:${porta}/`;
  console.log(`\n────────── ${suite} ──────────`);

  const servidor = spawn(process.execPath, [path.join(AQUI, 'servidor-local.mjs'), String(porta)],
    { stdio:'ignore' });

  try {
    if(!await noAr(base)){
      console.error(`  servidor local não subiu na porta ${porta}`);
      falhou = true;
      continue;
    }
    const r = spawnSync(process.execPath, [path.join(AQUI, suite)],
      { stdio:'inherit', env:{ ...process.env, BASE_TESTE: base } });
    if(r.status !== 0) falhou = true;
  } finally {
    servidor.kill();
  }
}

console.log(falhou ? '\n*** HOUVE FALHAS NO NAVEGADOR ***' : '\n*** NAVEGADOR: TUDO PASSOU ***');
process.exit(falhou ? 1 : 0);
