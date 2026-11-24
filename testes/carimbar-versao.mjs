/* Escreve assets/versao.json com a data desta publicação.

   Existe porque "será que é cache?" era adivinhação dos dois lados. Com a data na
   tela de Como funciona, a primeira pergunta diante de um problema deixa de ser
   essa: dá para olhar e saber qual versão o aparelho está rodando.

   Roda à mão, antes de publicar — `npm run versao`. Não há etapa de compilação neste
   projeto, e inventar uma só para isto seria pagar caro por um carimbo. */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const destino = path.join(AQUI, '..', 'assets', 'versao.json');

/* O commit é o que já está gravado; o desta publicação só existe depois. A data é o
   que importa para saber se o aparelho está atualizado. */
let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { cwd: path.join(AQUI, '..') })
  .toString().trim(); } catch {}

const agora = new Date();
const dois = n => String(n).padStart(2, '0');
const publicado = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}` +
  `T${dois(agora.getHours())}:${dois(agora.getMinutes())}:${dois(agora.getSeconds())}`;

writeFileSync(destino, JSON.stringify({ publicado, commit }) + '\n');
console.log('versao.json carimbado:', publicado, commit);
