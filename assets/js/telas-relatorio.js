/* O que sai impresso. São dois documentos, porque são dois destinos:

   - Ficha interna (sem identificar / uso interno): estrutura numerada, para o arquivo
     da escola e para estudo de caso em reunião.
   - Comunicado para a família: documento próprio. Fica fora tudo o que é interno —
     cadeia de ciência, escala de gravidade, numeração de seções. Entra a linha de
     assinatura, porque é um papel que volta assinado.

   Antes os três modos imprimiam a mesma folha. O rodapé mandava "registrar fatos
   observáveis" num documento já preenchido — instrução que só cabia no papel em
   branco — e declarava ser de uso interno na própria via entregue aos pais.

   A descrição é texto livre e quase sempre nomeia as outras crianças, então a via da
   família não a reaproveita: a autora revisa um texto próprio, guardado no registro.
   Assim a escola fica sabendo exatamente o que foi entregue.

   A impressão usa window.print(); o navegador oferece "Salvar como PDF". */

import { S, app, registrarTela, ir, toast, render, aluno } from './core.js';
import { Store } from './store.js';
import { esc, SEAL, semAcento, dataCompleta, soData } from './util.js';
import { SEVL } from './dados.js';
import { tipoDe, localDe } from './telas-registro.js';

app.abrirFicha = id => {
  const o = S.ocs.find(x => x.id === id);
  /* Nasce anonimizado: identificar é escolha deliberada, não o padrão. */
  S.ficha = { id, modo:'anonimo',
    focoKid: (o && o.envolvidos && o.envolvidos[0]) ? o.envolvidos[0].kid : null,
    incluirFoto:false };
  ir('ficha');
};

app.fichaModo = m => { S.ficha.modo = m; render(); };
app.fichaFoco = k => { S.ficha.focoKid = k; render(); };
app.fichaFoto = () => { S.ficha.incluirFoto = !S.ficha.incluirFoto; render(); };

/** Protocolo legível: 20261117-4F3A. O id cru é base36 ("o1abc23de") e não diz nada a
    quem recebe o papel, nem permite referência por telefone. */
function protocolo(o){
  const d = new Date(o.quandoISO || o.criadoEm || Date.now());
  const ymd = isNaN(d) ? ''
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `${ymd}-${String(o.id || '').slice(-4).toUpperCase()}`;
}

const quandoFicha = o => o.quandoISO ? dataCompleta(o.quandoISO) : (o.quando || '—');

/** Rótulo da criança conforme o modo. Anônimo vira Criança A, Criança B… pela ordem em
    que aparece no registro, para a ficha continuar legível sem nomear ninguém. */
function nomeNaFicha(kid, idx){
  const f = S.ficha;
  if(f.modo === 'interna') return aluno(kid).nome;
  if(f.modo === 'familia' && kid === f.focoKid) return aluno(kid).nome;
  return 'Criança ' + String.fromCharCode(65 + idx);
}

/** A turma só aparece quando alguém já está nomeado: turma somada a data identifica. */
const mostraTurma = () => S.ficha.modo === 'interna';

/** O relato que a família lê. Começa como a descrição interna e é revisado antes de
    imprimir; o original nunca é alterado. */
const textoFamilia = o => o.textoFamilia != null ? o.textoFamilia : (o.desc || '');

/** Nomes das outras crianças que sobraram no texto da família. Pedir "revise antes de
    imprimir" depende de a pessoa lembrar; apontar o nome, não. */
function nomesVazados(o, texto){
  const alvo = semAcento(String(texto || '')).toLowerCase();
  return (o.envolvidos || [])
    .filter(e => e.kid !== S.ficha.focoKid)
    .map(e => aluno(e.kid).nome)
    .filter(nome => nome && nome.split(/\s+/)
      .filter(parte => parte.length > 2)
      .some(parte => new RegExp('(^|[^a-z])' +
        semAcento(parte).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '([^a-z]|$)').test(alvo)));
}

function avisoVazamento(o, texto){
  const nomes = nomesVazados(o, texto);
  if(!nomes.length) return '';
  return `<div class="notice alert"><span class="ic">!</span><div>
    O texto cita <b>${nomes.map(esc).join('</b>, <b>')}</b>.</div></div>`;
}

app.checarFamilia = () => {
  const o = S.ocs.find(x => x.id === S.ficha.id);
  const campo = document.getElementById('f-familia');
  const alvo = document.getElementById('f-vaza');
  /* Atualiza só o aviso: re-renderizar apagaria o que está sendo digitado. */
  if(o && campo && alvo) alvo.innerHTML = avisoVazamento(o, campo.value);
};

app.imprimirFicha = async () => {
  const o = S.ocs.find(x => x.id === S.ficha.id);
  const campo = document.getElementById('f-familia');
  if(o && S.ficha.modo === 'familia' && campo){
    const novo = campo.value.trim();
    if(novo !== String(textoFamilia(o)).trim()){
      /* O papel sai com o que está na tela, salve ou não: a impressão não pode ficar
         presa à rede. Se o registro não aceitar, a pessoa fica sabendo. */
      o.textoFamilia = novo;
      render();
      try { await Store.salvarOcorrencia(o); }
      catch { toast('O texto saiu no papel, mas não ficou salvo no registro.'); }
    }
  }
  if(typeof window.print !== 'function') return toast('Este navegador não oferece impressão.');
  window.print();
};

/* ---------------------------------------------------------------- anexo */
function anexo(o){
  if(!o.foto || o.fotoPurgada || !S.ficha.incluirFoto) return '';
  const url = o.fotoId ? Store.urlFoto(o.fotoId) : null;
  return `<section class="ficha-anexo"><h2>Anexo</h2>
    ${url ? `<img class="ficha-img" src="${esc(url)}" alt="Registro fotográfico do ocorrido">`
          : `<p class="ficha-texto">1 fotografia arquivada no sistema.</p>`}</section>`;
}

/* ---------------------------------------------------------------- ficha interna */
function fichaInterna(o){
  const envolvidos = o.envolvidos || [];
  let n = 0;
  const sec = () => ++n;

  return `<article class="ficha">
    <header class="ficha-topo">
      <div class="ficha-selo">${SEAL}</div>
      <div>
        <h1>Registro interno de ocorrência</h1>
        <p>${esc(S.escola.nome || '')}${S.escola.nome ? ' · ' : ''}nº ${esc(protocolo(o))}</p>
      </div>
    </header>

    <section>
      <h2>${sec()} · Identificação</h2>
      <dl class="ficha-kv">
        <dt>Categoria</dt><dd>${esc(o.categoria || '—')}</dd>
        <dt>Tipo</dt><dd>${esc(tipoDe(o))}</dd>
        <dt>Gravidade</dt><dd>${esc(SEVL[o.sev] || '—')}</dd>
        <dt>Data e hora</dt><dd>${esc(quandoFicha(o))}</dd>
        <dt>Local</dt><dd>${esc(localDe(o))}</dd>
        <dt>Registrado por</dt><dd>${esc(o.autor)}</dd>
        <dt>Origem</dt><dd>${o.presenciou ? 'Presenciado por quem registrou'
          : 'Relato de ' + esc((o.informante && o.informante.nome) || '—') +
            ((o.informante && o.informante.canal) ? ' · ' + esc(o.informante.canal) : '')}</dd>
      </dl>
    </section>

    <section>
      <h2>${sec()} · Crianças envolvidas</h2>
      <table class="ficha-tab">
        <thead><tr><th>Criança</th><th>Papel</th><th>Condição</th><th>Lesão</th></tr></thead>
        <tbody>${envolvidos.map((e, i) => `<tr>
          <td>${esc(nomeNaFicha(e.kid, i))}${mostraTurma() && aluno(e.kid).turma
            ? `<br><span class="ficha-sub">Turma ${esc(aluno(e.kid).turma)}</span>` : ''}</td>
          <td>${esc(e.papel || '—')}</td>
          <td>${esc(e.cond || '—')}</td>
          <td>${esc(e.lesao || '—')}</td>
        </tr>`).join('')}</tbody>
      </table>
    </section>

    <section>
      <h2>${sec()} · Descrição do ocorrido</h2>
      <p class="ficha-texto">${esc(o.desc)}</p>
    </section>

    <section>
      <h2>${sec()} · Providências e intervenções</h2>
      ${(o.prov || []).length
        ? `<ul class="ficha-lista">${o.prov.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
        : '<p class="ficha-texto">Nenhuma providência registrada.</p>'}
    </section>

    ${o.acomp ? `<section><h2>${sec()} · Comunicação e acompanhamento</h2>
      <p class="ficha-texto">${esc(o.acomp)}</p></section>` : ''}

    <section>
      <h2>${sec()} · Ciência</h2>
      <table class="ficha-tab">
        <thead><tr><th>Nível</th><th>Situação</th><th>Parecer</th></tr></thead>
        <tbody>${(o.chain || []).map(c => `<tr>
          <td>${esc(c.nivel)}</td>
          <td>${c.st === 'ok'
            ? (c.quandoISO ? 'Ciência em ' + esc(dataCompleta(c.quandoISO))
               : c.quando ? 'Ciência em ' + esc(c.quando) : 'Ciência dada')
            : 'Pendente'}</td>
          <td>${esc(c.parecer || '—')}</td>
        </tr>`).join('')}</tbody>
      </table>
    </section>

    ${anexo(o)}

    <footer class="ficha-rodape">
      <p>Emitido em ${esc(dataCompleta(new Date().toISOString()))} · ${S.ficha.modo === 'interna'
        ? 'crianças identificadas' : 'crianças não identificadas'}.</p>
      <p>Documento interno, de acesso restrito aos profissionais autorizados.</p>
    </footer>
  </article>`;
}

/* ---------------------------------------------------------------- família */
function comunicadoFamilia(o){
  const envolvidos = o.envolvidos || [];
  const dela = envolvidos.find(e => e.kid === S.ficha.focoKid) || envolvidos[0] || {};
  const condicao = [dela.cond, dela.lesao].filter(x => x && x !== '—').join(' · ');

  return `<article class="ficha">
    <header class="ficha-topo">
      <div class="ficha-selo">${SEAL}</div>
      <div>
        <h1>Comunicado de ocorrência</h1>
        <p>${esc(S.escola.nome || '')}${S.escola.nome ? ' · ' : ''}nº ${esc(protocolo(o))}</p>
      </div>
    </header>

    <dl class="ficha-kv">
      <dt>Criança</dt><dd>${esc(dela.kid ? aluno(dela.kid).nome : '—')}</dd>
      ${condicao ? `<dt>Condição</dt><dd>${esc(condicao)}</dd>` : ''}
      <dt>Data e hora</dt><dd>${esc(quandoFicha(o))}</dd>
      <dt>Local</dt><dd>${esc(localDe(o))}</dd>
    </dl>

    <section>
      <h2>O que aconteceu</h2>
      <p class="ficha-texto">${esc(textoFamilia(o)) || '—'}</p>
    </section>

    <section>
      <h2>O que a escola fez</h2>
      ${(o.prov || []).length
        ? `<ul class="ficha-lista">${o.prov.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
        : '<p class="ficha-texto">—</p>'}
    </section>

    ${o.acomp ? `<section><h2>Acompanhamento</h2>
      <p class="ficha-texto">${esc(o.acomp)}</p></section>` : ''}

    ${anexo(o)}

    <footer class="ficha-rodape">
      <p>Registrado por ${esc(o.autor)} · emitido em ${esc(soData(new Date().toISOString()))}</p>
      <div class="ficha-assina"><span></span><p>Assinatura do responsável</p></div>
    </footer>
  </article>`;
}

/* ---------------------------------------------------------------- tela */
registrarTela('ficha', () => {
  const o = S.ocs.find(x => x.id === S.ficha.id);
  if(!o) return `<div class="empty"><div class="big">Registro não encontrado</div></div>`;
  const f = S.ficha;
  const envolvidos = o.envolvidos || [];
  const temFoto = o.foto && !o.fotoPurgada;

  const modos = [
    ['anonimo', 'Sem identificar', 'Criança A, Criança B', true],
    ['familia', 'Para a família',  'Só a criança da família', false],
    ['interna', 'Uso interno',     'Todas nomeadas', false]
  ];

  const controles = `
    <div class="naoimprime stack s18">
      <div>
        <p class="sec-label">Para quem é</p>
        <div class="stack s8">
          ${modos.map(([id, titulo, nota, padrao]) => `
          <button class="switch" aria-pressed="${f.modo === id}" onclick="app.fichaModo('${id}')">
            <span class="grow">
              <span style="display:block;font-size:13px;font-weight:600">${titulo}${padrao
                ? ' <span class="pill" style="font-size:9.5px">padrão</span>' : ''}</span>
              <span class="fs11 muted">${nota}</span>
            </span>
            <span class="track"></span></button>`).join('')}
        </div>
      </div>

      ${f.modo === 'familia' && envolvidos.length > 1 ? `<div>
        <p class="sec-label">Qual criança</p>
        <div class="chips">${envolvidos.map(e => `
          <button class="chip sm" aria-pressed="${f.focoKid === e.kid}"
            onclick="app.fichaFoco('${esc(e.kid)}')">${esc(aluno(e.kid).nome)}</button>`).join('')}</div>
      </div>` : ''}

      ${f.modo === 'familia' ? `<div class="field">
        <label for="f-familia">O que aconteceu</label>
        <textarea class="input" id="f-familia" rows="5"
          oninput="app.checarFamilia()">${esc(textoFamilia(o))}</textarea>
        <div id="f-vaza" style="margin-top:8px">${avisoVazamento(o, textoFamilia(o))}</div>
      </div>` : ''}

      ${temFoto ? `<button class="switch" aria-pressed="${f.incluirFoto}" onclick="app.fichaFoto()">
        <span class="grow"><span style="display:block;font-size:13px;font-weight:600">Incluir a foto</span></span>
        <span class="track"></span></button>` : ''}

      <button class="btn" onclick="app.imprimirFicha()">Gerar PDF</button>
    </div>`;

  return `<div class="stack s18">${controles}${
    f.modo === 'familia' ? comunicadoFamilia(o) : fichaInterna(o)}</div>`;
});
