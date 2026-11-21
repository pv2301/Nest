/* As regras de negócio, num lugar só.

   Por que .mjs e não .js: este módulo é carregado pelos dois lados. O navegador o
   importa direto; a API, que é CommonJS, o carrega por `await import()`. Assim a
   regra existe uma vez, e não duas que discordam — que era o caso: o servidor
   mandava à Miss todo registro cuja cadeia citasse a turma dela, em qualquer estado,
   enquanto a tela só mostrava depois que a ciência chegava até ela. O navegador
   recebia registro que a interface escondia.

   Nada aqui toca em tela, banco ou rede: entra dado, sai decisão. É o que permite
   testar os dois lados com as mesmas ocorrências e exigir o mesmo resultado.

   Sem import nenhum, de propósito: config.js é servido como módulo ao navegador mas
   o Node o lê como CommonJS, e um import aqui quebraria o lado servidor. O que era
   regra dentro da configuração veio para cá. */

/* Nível 1 sem gatilho se encerra na ciência da Miss, sem subir para a gestão.
   Estava em config.js como se fosse ajuste; é regra, e precisa valer nos dois lados. */
export const NIVEL1_ENCERRA_NA_MISS = true;

/* ---------------------------------------------------------------- quem vê */

/** O registro aguarda a ciência desta pessoa agora? */
export function aguardaCiencia(conta, o){
  const n = (o.chain || []).find(c => c && c.st === 'now');
  if(!n) return false;
  if(conta.papel === 'gestao') return String(n.nivel).startsWith('Gestão');
  if(conta.papel === 'miss')   return !!conta.turma && String(n.nivel).includes(conta.turma);
  return false;
}

/** Esta pessoa pode ver este registro?

    A gestão vê tudo. A Miss vê o que escreveu, o que aguarda a ciência dela, e o que
    a turma dela já reconheceu. Não vê o que está na fila atrás de outra turma — vai
    ver quando chegar a vez dela. */
export function quemVe(conta, o){
  if(!conta || !o) return false;
  if(conta.papel === 'gestao') return true;
  if(o.autorLogin === conta.login) return true;
  if(aguardaCiencia(conta, o)) return true;
  return conta.papel === 'miss' && !!conta.turma &&
    (o.chain || []).some(c => c && String(c.nivel).includes(conta.turma) && c.st === 'ok');
}

/** Quem corrige: a autora enquanto ninguém deu ciência, e a gestão sempre. */
export function podeCorrigir(conta, o){
  if(!conta || !o) return false;
  if(conta.papel === 'gestao') return true;
  if(o.autorLogin !== conta.login) return false;
  return !(o.chain || []).some(c => c.st === 'ok');
}

/* ---------------------------------------------------------------- cadeia */

/** Para quem o registro sobe, e por quê.

    Ciência paralela: uma Miss por turma envolvida, menos a própria autora; depois a
    gestão, quando houver gatilho. Devolve só a decisão — quem desenha é a tela, quem
    grava é o servidor, e ambos partem daqui. */
export function montarDestinos({ papelAutor, turmaAutor, turmas = [], missDaTurma = () => null,
                                 temAnterior = false, sev = 0, temFoto = false }){
  if(papelAutor === 'gestao')
    return [{ nivel:'Encerrado por você', nota:'A gestão registra e conclui no mesmo ato', encerra:true }];

  const out = [];
  for(const t of turmas){
    if(papelAutor === 'miss' && turmaAutor === t) continue;
    const m = missDaTurma(t);
    out.push(m
      ? { nivel:`${m.nome} (Turma ${t})`, nota:'Confirma a gravidade e acrescenta o contexto' }
      : { nivel:`Gestão (Turma ${t} sem Miss ativa)`, nota:'Nenhuma Miss cadastrada para esta turma' });
  }

  const gatilho = sev > 1 || temFoto || temAnterior;
  if(gatilho || !NIVEL1_ENCERRA_NA_MISS)
    out.push({ nivel:'Gestão', nota: sev > 1 ? 'Gravidade ' + sev : 'Gatilho: foto anexada ou registro recente' });
  else
    out.push({ nivel:'Encerra na Miss', nota:'Nível 1 sem gatilho · entra no resumo diário da gestão', encerra:true });

  return out;
}

/** Os destinos no formato que fica gravado no registro. */
export function paraCadeia(destinos){
  const c = (destinos || [])
    .filter(x => !x.encerra)
    .map((x, i) => ({ nivel:x.nivel, st: i === 0 ? 'now' : 'wait' }));
  return c.length ? c : [{ nivel:'Gestão', st:'now' }];
}

/* ---------------------------------------------------------------- o que falta */

/** O que impede o envio, e em qual passo. Cada item diz o campo, para o campo poder
    se marcar em vez de a pessoa caçar na tela qual era. */
export function oQueFalta(d){
  const f = [];
  if(!d) return f;
  const OUTRO = 'Outro';
  if(!d.categoria) f.push({ passo:1, campo:'categoria', texto:'Escolher a categoria' });
  else if(!d.tipo) f.push({ passo:1, campo:'tipo', texto:'Escolher o tipo' });
  if(d.tipo === OUTRO && !String(d.tipoOutro || '').trim())
    f.push({ passo:1, campo:'tipoOutro', texto:'Descrever o tipo em "Outro"' });
  if(!d.sev) f.push({ passo:1, campo:'gravidade', texto:'Escolher a gravidade' });
  if(!(d.envolvidos || []).length)
    f.push({ passo:2, campo:'criancas', texto:'Selecionar ao menos uma criança' });
  else if(d.envolvidos.some(e => !e.papel))
    f.push({ passo:2, campo:'papel', texto:'Marcar o papel de cada criança' });
  if(String(d.desc || '').trim().length <= 8)
    f.push({ passo:3, campo:'descricao', texto:'Escrever a descrição do ocorrido' });
  if(!d.presenciou && !String(d.informanteNome || '').trim())
    f.push({ passo:3, campo:'informante', texto:'Informar quem relatou' });
  return f;
}
