/* As regras de negócio, isoladas.

   Elas moram em assets/js/regras.mjs porque precisam valer nos dois lados: o
   navegador importa direto, a API carrega por import dinâmico. Antes havia duas
   implementações de "quem vê" que discordavam — o servidor mandava à Miss registro
   que a tela escondia. Estas asserções fixam qual é a regra. */

import * as R from '../assets/js/regras.mjs';

let falhas = 0, total = 0;
const t = (nome, cond, extra) => {
  total++;
  if(cond) console.log('  OK ' + nome);
  else { falhas++; console.log('  XX ' + nome + (extra ? '\n       ' + extra : '')); }
};

const GESTAO = { papel:'gestao', login:'tallita.lima' };
const AUTORA = { papel:'miss', login:'ana.paula', turma:'Verde' };
const DA_VEZ = { papel:'miss', login:'carolina.mendes', turma:'Verde' };
const NA_FILA = { papel:'miss', login:'beatriz.souza', turma:'Azul' };
const DE_FORA = { papel:'miss', login:'outra.pessoa', turma:'Amarela' };

/* Duas turmas envolvidas: a Verde é a vez, a Azul espera. */
const oc = () => ({
  id:'1', autorLogin:'ana.paula',
  chain:[ { nivel:'Carolina Mendes (Turma Verde)', st:'now' },
          { nivel:'Beatriz Souza (Turma Azul)',    st:'wait' },
          { nivel:'Gestão',                        st:'wait' } ]
});

console.log('\n=== Quem vê ===');
t('gestão vê tudo',            R.quemVe(GESTAO, oc()));
t('a autora vê o que escreveu', R.quemVe(AUTORA, oc()));
t('a Miss da vez vê',          R.quemVe(DA_VEZ, oc()));
t('a Miss na fila NÃO vê',     !R.quemVe(NA_FILA, oc()),
  'era aqui que servidor e tela discordavam');
t('Miss de fora não vê',       !R.quemVe(DE_FORA, oc()));

const depois = oc();
depois.chain[0].st = 'ok'; depois.chain[1].st = 'now';
t('passada a vez, a seguinte vê',  R.quemVe(NA_FILA, depois));
t('e quem já deu ciência continua vendo', R.quemVe(DA_VEZ, depois));

console.log('\n=== Quem corrige ===');
t('a autora corrige antes da ciência', R.podeCorrigir(AUTORA, oc()));
t('a autora NÃO corrige depois',       !R.podeCorrigir(AUTORA, depois));
t('a gestão corrige sempre',           R.podeCorrigir(GESTAO, depois));
t('quem não é autora não corrige',     !R.podeCorrigir(DA_VEZ, oc()));

console.log('\n=== Para quem sobe ===');
const miss = t2 => ({ nome:'Miss ' + t2, login:'m.' + t2.toLowerCase() });
let d = R.montarDestinos({ papelAutor:'miss', turmaAutor:'Verde',
  turmas:['Verde','Azul'], missDaTurma:miss, sev:2 });
t('a autora não aparece na própria cadeia', !d.some(x => x.nivel.includes('Verde')),
  d.map(x => x.nivel).join(' / '));
t('a outra turma entra',  d.some(x => x.nivel.includes('Azul')));
t('gravidade 2 sobe à gestão', d.some(x => x.nivel === 'Gestão'));

d = R.montarDestinos({ papelAutor:'miss', turmaAutor:'Verde', turmas:['Verde'],
  missDaTurma:miss, sev:1 });
t('nível 1 sem gatilho encerra na Miss', d.some(x => x.encerra), d.map(x => x.nivel).join(' / '));
d = R.montarDestinos({ papelAutor:'miss', turmaAutor:'Verde', turmas:['Verde'],
  missDaTurma:miss, sev:1, temFoto:true });
t('nível 1 com foto sobe à gestão', d.some(x => x.nivel === 'Gestão'));
d = R.montarDestinos({ papelAutor:'gestao', turmas:['Verde'], missDaTurma:miss, sev:3 });
t('gestão registra e encerra', d.length === 1 && d[0].encerra);

d = R.montarDestinos({ papelAutor:'miss', turmaAutor:'Verde', turmas:['Verde','Azul'],
  missDaTurma:() => null, sev:1 });
t('turma sem Miss cai na gestão', d.some(x => x.nivel.includes('sem Miss ativa')),
  d.map(x => x.nivel).join(' / '));

console.log('\n=== Cadeia gravada ===');
const c = R.paraCadeia(R.montarDestinos({ papelAutor:'miss', turmaAutor:'Verde',
  turmas:['Verde','Azul'], missDaTurma:miss, sev:3 }));
t('o primeiro é a vez, o resto espera',
  c[0].st === 'now' && c.slice(1).every(x => x.st === 'wait'), JSON.stringify(c));
t('encerrar não vira elo da cadeia',
  !R.paraCadeia([{ nivel:'Encerra na Miss', encerra:true }]).some(x => x.nivel.includes('Encerra')));
t('cadeia vazia vira gestão',
  R.paraCadeia([]).length === 1 && R.paraCadeia([])[0].nivel === 'Gestão');

console.log('\n=== O que falta ===');
const falta = d2 => R.oQueFalta(d2).map(f => f.campo);
t('formulário vazio aponta categoria', falta({}).includes('categoria'));
t('sem gravidade aponta gravidade',
  falta({ categoria:'Incidente', tipo:'Mordida', envolvidos:[{kid:'a',papel:'Sofreu'}], desc:'x'.repeat(20) })
    .includes('gravidade'));
t('criança sem papel é apontada',
  falta({ categoria:'c', tipo:'t', sev:2, envolvidos:[{kid:'a'}], desc:'x'.repeat(20) }).includes('papel'));
t('descrição curta é apontada',
  falta({ categoria:'c', tipo:'t', sev:2, envolvidos:[{kid:'a',papel:'p'}], desc:'oi' }).includes('descricao'));
t('informante só quando não presenciou',
  falta({ categoria:'c', tipo:'t', sev:2, envolvidos:[{kid:'a',papel:'p'}],
          desc:'x'.repeat(20), presenciou:false }).includes('informante'));
t('completo não aponta nada',
  falta({ categoria:'c', tipo:'t', sev:2, envolvidos:[{kid:'a',papel:'p'}],
          desc:'x'.repeat(20), presenciou:true }).length === 0);

/* Citação de nome ambígua. Quem acha as citações é citacoes.mjs e quem conhece o
   cadastro é quem chama — por isso entra como contexto, e não como campo do rascunho.
   Sem o contexto a regra é pulada, que é o que deixa um chamador sem cadastro à mão
   usar o resto de oQueFalta. */
const pronto = { categoria:'c', tipo:'t', sev:2, envolvidos:[{kid:'a',papel:'p'}],
                 desc:'x'.repeat(20), presenciou:true };
t('sem contexto, a regra das citações é pulada',
  R.oQueFalta(pronto).length === 0);
t('uma citação pendente trava o envio',
  R.oQueFalta(pronto, { pendentes:1 }).some(f => f.campo === 'citacoes'));
t('e diz no singular',
  /de qual criança/.test(R.oQueFalta(pronto, { pendentes:1 })[0].texto),
  R.oQueFalta(pronto, { pendentes:1 })[0].texto);
t('duas pendentes dizem no plural, com o número',
  /2 nomes/.test(R.oQueFalta(pronto, { pendentes:2 })[0].texto),
  R.oQueFalta(pronto, { pendentes:2 })[0].texto);
t('zero pendentes não trava',
  R.oQueFalta(pronto, { pendentes:0 }).length === 0);
t('e a citação é cobrada no passo da narrativa',
  R.oQueFalta(pronto, { pendentes:1 })[0].passo === 3);

console.log(falhas
  ? `\n=== ${falhas} de ${total} FALHARAM ===`
  : `\n=== ${total} TESTES DE REGRAS PASSARAM ===`);
process.exit(falhas ? 1 : 0);
