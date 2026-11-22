/* O que sai impresso. São dois documentos, porque são dois destinos:

   - Ficha interna: estrutura numerada, para o arquivo da escola.
   - Comunicado para a família: documento próprio, sem cadeia de ciência, sem escala
     de gravidade e sem numeração, com linha de assinatura.

   Sobre qualquer um deles corre a marca "sem identificar", ligada por padrão.
   Anonimizar não é um destino — é uma propriedade de cada destino.

   A anonimização anterior era de fachada: trocava os nomes na TABELA e imprimia a
   narrativa intacta logo abaixo. Um documento "sem identificar" saía com "Criança A"
   na tabela e "Paulo mordeu a mão de Tallita" no parágrafo seguinte. Agora a troca
   alcança os quatro campos de texto livre que vão ao papel — descrição, texto da
   família, acompanhamento e o parecer de cada ciência —, porque bastava um deles
   escapar para o documento inteiro deixar de proteger.

   O texto guardado no registro nunca muda: a substituição acontece ao desenhar. */

import { S, app, registrarTela, ir, toast, render, aluno } from './core.js';
import { Store } from './store.js';
import { escolha } from './escolha.js';
import { esc, SEAL, iniciais, dataCompleta, soData, posicaoNome, trocarNomes } from './util.js';
import { SEVL } from './vocabulario.js';
import { tipoDe, localDe } from './telas-comum.js';

app.abrirFicha = id => {
  const o = S.ocs.find(x => x.id === id);
  /* Nasce anonimizado: identificar é escolha deliberada, não o padrão. */
  S.ficha = { id, destino:'interna', semIdentificar:true,
    focoKid: (o && o.envolvidos && o.envolvidos[0]) ? o.envolvidos[0].kid : null,
    incluirFoto:false };
  ir('ficha');
};

app.fichaDestino = d => { S.ficha.destino = d; render(); };
app.fichaAnonima = () => { S.ficha.semIdentificar = !S.ficha.semIdentificar; render(); };
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

/** O relato que a família lê. Começa como a descrição interna e é revisado antes de
    imprimir; o original nunca é alterado. */
const textoFamilia = o => o.textoFamilia != null ? o.textoFamilia : (o.desc || '');

/* ================================================================ anonimização */

const rotuloPara = i => i < 26 ? 'Criança ' + String.fromCharCode(65 + i) : 'Criança ' + (i + 1);

/** Todo o texto livre que vai ao papel. É aqui que os nomes se escondiam. */
const textosDoRegistro = o => [
  o.desc, textoFamilia(o), o.acomp,
  ...(o.chain || []).map(c => c.parecer)
].filter(Boolean).join('\n');

/** Quem vira o quê. Primeiro os envolvidos, na ordem do registro; depois qualquer
    aluno do cadastro citado na narrativa, na ordem em que aparece — uma testemunha
    nomeada de passagem vazaria tanto quanto um envolvido.

    A letra é dada pela posição no registro, mesmo para quem sai nomeado, para a ficha
    interna e o comunicado da mesma ocorrência não discordarem sobre quem é Criança B. */
function mapaDeNomes(o){
  const f = S.ficha;
  const nomeada = f.destino === 'familia' ? f.focoKid : null;
  const mapa = [];
  const vistos = new Set();

  for(const e of (o.envolvidos || [])){
    if(!e.kid || vistos.has(e.kid)) continue;
    vistos.add(e.kid);
    mapa.push({ kid:e.kid, nome:aluno(e.kid).nome, rotulo:rotuloPara(mapa.length),
                nomeada: e.kid === nomeada, citada:false });
  }

  const texto = textosDoRegistro(o);
  (S.alunos || [])
    .filter(a => a.id && !vistos.has(a.id) && a.nome)
    .map(a => ({ a, pos: posicaoNome(texto, a.nome) }))
    .filter(x => x.pos >= 0)
    .sort((x, y) => x.pos - y.pos)
    .forEach(({ a }) => {
      mapa.push({ kid:a.id, nome:a.nome, rotulo:rotuloPara(mapa.length),
                  nomeada:false, citada:true });
    });

  return mapa;
}

/** Troca os nomes pelos rótulos. Quem sai nomeado é pulado. */
const anonimizar = (texto, mapa) => trocarNomes(texto, (mapa || []).filter(p => !p.nomeada));

/** Texto como vai ao papel. */
const comoSai = (txt, mapa) => S.ficha.semIdentificar ? anonimizar(txt, mapa) : txt;

/** Como o texto vai sair, mostrado antes de gerar o PDF.

    O campo onde se escreve continua com os nomes reais, porque é ele que fica
    guardado: trocar o conteúdo dele apagaria os nomes para sempre e a versão
    identificada do relatório deixaria de existir. Então a troca aparece aqui ao
    lado, marcada como prévia, sem precisar rolar até o documento inteiro. */
function previaSemNomes(txt, mapa){
  if(!S.ficha.semIdentificar) return '';
  const saida = anonimizar(txt, mapa);
  if(!String(txt || '').trim()) return '';
  return `<div class="previa">
    <p class="sec-label" style="margin:0 0 6px">Como vai sair, sem identificar</p>
    <p style="margin:0">${esc(saida)}</p>
  </div>`;
}

/** Nome de uma criança no documento. */
function nomeNaFicha(kid, mapa){
  if(!S.ficha.semIdentificar) return aluno(kid).nome;
  const p = mapa.find(x => x.kid === kid);
  if(!p) return aluno(kid).nome;
  return p.nomeada ? p.nome : p.rotulo;
}

/** A turma só aparece quando os nomes aparecem: turma somada a data identifica. */
const mostraTurma = () => !S.ficha.semIdentificar;

/* ================================================================ avisos da tela */

/** Com a marca ligada a troca é automática; este aviso só serve quando ela está
    desmarcada e o texto da família cita outra criança. */
function avisoVazamento(o, texto){
  if(S.ficha.semIdentificar) return '';
  const alvo = String(texto || '');
  const nomes = (o.envolvidos || [])
    .filter(e => e.kid !== S.ficha.focoKid)
    .map(e => aluno(e.kid).nome)
    .filter(nome => nome && posicaoNome(alvo, nome) >= 0);
  if(!nomes.length) return '';
  return `<div class="notice alert"><span class="ic">!</span><div>
    O texto cita <b>${nomes.map(esc).join('</b>, <b>')}</b>.</div></div>`;
}

app.checarFamilia = () => {
  const o = S.ocs.find(x => x.id === S.ficha.id);
  const campo = document.getElementById('f-familia');
  const alvo = document.getElementById('f-vaza');
  /* Atualiza só o aviso e a prévia: re-renderizar apagaria o que está sendo
     digitado — foi o que quebrou a busca de alunos no celular. */
  if(!o || !campo) return;
  if(alvo) alvo.innerHTML = avisoVazamento(o, campo.value);
  const previa = document.getElementById('f-previa');
  if(previa) previa.innerHTML = previaSemNomes(campo.value, mapaDeNomes(o));
};

/** Quem é quem. Fica na tela e só na tela: impressa, devolveria tudo o que a
    anonimização tirou. */
function legenda(mapa){
  if(!S.ficha.semIdentificar || !mapa.length) return '';
  return `<div>
    <p class="sec-label">Quem é quem</p>
    <div class="card flat"><dl class="kv">
      ${mapa.map(p => `<dt>${esc(p.nome)}</dt><dd>${p.nomeada
        ? 'nomeada no documento'
        : esc(p.rotulo) + (p.citada ? ' · citada na narrativa' : '')}</dd>`).join('')}
    </dl></div>
  </div>`;
}

app.imprimirFicha = async () => {
  const o = S.ocs.find(x => x.id === S.ficha.id);
  const campo = document.getElementById('f-familia');
  if(o && S.ficha.destino === 'familia' && campo){
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
function fichaInterna(o, mapa){
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
        <tbody>${envolvidos.map(e => `<tr>
          <td>${esc(nomeNaFicha(e.kid, mapa))}${mostraTurma() && aluno(e.kid).turma
            ? `<br><span class="ficha-sub">Turma ${esc(aluno(e.kid).turma)}</span>` : ''}</td>
          <td>${esc(e.papel || '—')}</td>
          <td>${esc(e.cond || '—')}</td>
          <td>${esc(e.lesao || '—')}</td>
        </tr>`).join('')}</tbody>
      </table>
    </section>

    <section>
      <h2>${sec()} · Descrição do ocorrido</h2>
      <p class="ficha-texto">${esc(comoSai(o.desc, mapa))}</p>
    </section>

    <section>
      <h2>${sec()} · Providências e intervenções</h2>
      ${(o.prov || []).length
        ? `<ul class="ficha-lista">${o.prov.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
        : '<p class="ficha-texto">Nenhuma providência registrada.</p>'}
    </section>

    ${o.acomp ? `<section><h2>${sec()} · Comunicação e acompanhamento</h2>
      <p class="ficha-texto">${esc(comoSai(o.acomp, mapa))}</p></section>` : ''}

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
          <td>${esc(comoSai(c.parecer, mapa) || '—')}</td>
        </tr>`).join('')}</tbody>
      </table>
    </section>

    ${anexo(o)}

    <footer class="ficha-rodape">
      <p>Emitido em ${esc(dataCompleta(new Date().toISOString()))} · ${S.ficha.semIdentificar
        ? 'crianças não identificadas' : 'crianças identificadas'}.</p>
      <p>Documento interno, de acesso restrito aos profissionais autorizados.</p>
    </footer>
  </article>`;
}

/* ---------------------------------------------------------------- família */
function comunicadoFamilia(o, mapa){
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
      <dt>Criança</dt><dd>${esc(dela.kid ? nomeNaFicha(dela.kid, mapa) : '—')}</dd>
      ${condicao ? `<dt>Condição</dt><dd>${esc(condicao)}</dd>` : ''}
      <dt>Data e hora</dt><dd>${esc(quandoFicha(o))}</dd>
      <dt>Local</dt><dd>${esc(localDe(o))}</dd>
    </dl>

    <section>
      <h2>O que aconteceu</h2>
      <p class="ficha-texto">${esc(comoSai(textoFamilia(o), mapa)) || '—'}</p>
    </section>

    <section>
      <h2>O que a escola fez</h2>
      ${(o.prov || []).length
        ? `<ul class="ficha-lista">${o.prov.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
        : '<p class="ficha-texto">—</p>'}
    </section>

    ${o.acomp ? `<section><h2>Acompanhamento</h2>
      <p class="ficha-texto">${esc(comoSai(o.acomp, mapa))}</p></section>` : ''}

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
  const mapa = mapaDeNomes(o);
  const temFoto = o.foto && !o.fotoPurgada;

  const controles = `
    <div class="naoimprime stack s18">
      <div>
        <p class="sec-label">Para quem é</p>
        <div class="chips">
          <button class="chip" aria-pressed="${f.destino === 'interna'}"
            onclick="app.fichaDestino('interna')">Uso interno</button>
          <button class="chip" aria-pressed="${f.destino === 'familia'}"
            onclick="app.fichaDestino('familia')">Para a família</button>
        </div>
      </div>

      <button class="switch" aria-pressed="${f.semIdentificar}" onclick="app.fichaAnonima()">
        <span class="grow"><span style="display:block;font-size:13px;font-weight:600">Sem identificar</span>
        <span class="fs11 muted">${f.destino === 'familia'
          ? 'Só a criança da família é nomeada'
          : 'Criança A, Criança B — inclusive na narrativa'}</span></span>
        <span class="track"></span></button>

      ${f.destino === 'familia' && envolvidos.length > 1
        ? escolha({ id:'foco', rotulo:'Qual criança',
            opcoes:envolvidos.map(e => ({ valor:e.kid, nome:aluno(e.kid).nome,
              ini:iniciais(aluno(e.kid).nome) })),
            valor:f.focoKid, placeholder:'Escolher a criança',
            aoEscolher:k => { S.ficha.focoKid = k; } })
        : ''}

      ${legenda(mapa)}

      ${f.destino === 'familia' ? `<div class="field">
        <label for="f-familia">O que aconteceu</label>
        <textarea class="input" id="f-familia" rows="5"
          spellcheck="true" autocorrect="on" autocapitalize="sentences"
          oninput="app.checarFamilia()">${esc(textoFamilia(o))}</textarea>
        <div id="f-vaza" style="margin-top:8px">${avisoVazamento(o, textoFamilia(o))}</div>
        <div id="f-previa">${previaSemNomes(textoFamilia(o), mapa)}</div>
      </div>` : `<div class="field">
        <label>O que aconteceu</label>
        <p class="fs13" style="margin:0 0 8px;white-space:pre-wrap">${esc(o.desc || '—')}</p>
        ${previaSemNomes(o.desc, mapa)}
      </div>`}

      ${temFoto ? `<button class="switch" aria-pressed="${f.incluirFoto}" onclick="app.fichaFoto()">
        <span class="grow"><span style="display:block;font-size:13px;font-weight:600">Incluir a foto</span></span>
        <span class="track"></span></button>` : ''}

      <button class="btn" onclick="app.imprimirFicha()">Gerar PDF</button>
    </div>`;

  return `<div class="stack s18">${controles}${
    f.destino === 'familia' ? comunicadoFamilia(o, mapa) : fichaInterna(o, mapa)}</div>`;
});
