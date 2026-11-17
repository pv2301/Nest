/* Roda todas as suítes que não precisam de navegador. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(AQUI).filter(f => f.endsWith('.test.mjs')).sort();

let falhou = false;
for(const s of suites){
  console.log(`\n────────── ${s} ──────────`);
  const r = spawnSync(process.execPath, [path.join(AQUI, s)], { stdio:'inherit' });
  if(r.status !== 0) falhou = true;
}
console.log(falhou ? '\n*** HOUVE FALHAS ***' : '\n*** TUDO PASSOU ***');
process.exit(falhou ? 1 : 0);
