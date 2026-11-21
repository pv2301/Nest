/* Puxar para atualizar.

   O app já sabe recarregar — recarregar() em core.js busca tudo de novo —, mas só
   havia como pedir isso entrando e saindo de uma tela. Num celular o gesto esperado
   é arrastar a lista para baixo, e é o que falta.

   Vale em qualquer tela, porque o que se recarrega é o estado inteiro e não o que
   está em vista. Só não se arma antes do login: ali não há sessão, e recarregar()
   voltaria sem fazer nada — um gesto que não responde ensina que o gesto não existe.

   O conteúdo desce com o dedo e o indicador aparece atrás dele. A resistência (45%
   do arrasto) é o que faz o gesto parecer preso ao dedo em vez de solto; sem ela, um
   deslize distraído já dispara a atualização.

   O navegador não tem o gesto nativo aqui: .scroll usa overscroll-behavior:contain,
   então este é o único que existe e não há dois a disputar. */

import { S, recarregar } from './core.js';

const LIMITE = 56;    /* a partir daqui, soltar atualiza */
const TETO   = 96;    /* o conteúdo não desce mais que isto */
const ATRITO = 0.45;  /* quanto do arrasto vira deslocamento */

let caixa, conteudo, marca;
let inicioY = null, dist = 0, puxando = false, ocupado = false;

const mover = px => {
  conteudo.style.transform = px ? `translateY(${px}px)` : '';
  conteudo.style.transition = px ? 'none' : 'transform .22s ease-out';
  marca.style.opacity = px ? Math.min(1, px / LIMITE) : 0;
  marca.classList.toggle('pronto', px >= LIMITE);
};

function comecar(e){
  if(ocupado || !S.conta || e.touches.length !== 1) return;
  /* Só do topo: no meio da lista o arrasto para baixo é rolagem, não atualização. */
  if(caixa.scrollTop > 0) return;
  inicioY = e.touches[0].clientY;
  dist = 0;
}

function arrastar(e){
  if(inicioY === null) return;
  const cru = e.touches[0].clientY - inicioY;
  /* Subindo, ou já rolou: o gesto é rolagem. Devolve o controle ao navegador. */
  if(cru <= 0 || caixa.scrollTop > 0){ cancelar(); return; }
  puxando = true;
  dist = Math.min(cru * ATRITO, TETO);
  /* Só agora: um preventDefault antes de saber a direção mataria a rolagem normal. */
  if(e.cancelable) e.preventDefault();
  mover(dist);
}

async function soltar(){
  if(inicioY === null) return;
  const disparar = puxando && dist >= LIMITE;
  inicioY = null; puxando = false;
  if(!disparar) return mover(0);

  ocupado = true;
  mover(LIMITE);
  marca.classList.add('girando-ativo');
  try { await recarregar({ silencioso:true }); }
  finally {
    marca.classList.remove('girando-ativo');
    ocupado = false;
    mover(0);
    /* render() do recarregar troca o HTML de #view; a transformação mora em #view,
       então é reposta aqui, depois. */
  }
}

function cancelar(){
  if(inicioY === null) return;
  inicioY = null; puxando = false;
  mover(0);
}

/** Liga o gesto. Chamado uma vez, na partida do app. */
export function ligarPuxar(){
  caixa = document.getElementById('scroll');
  conteudo = document.getElementById('view');
  marca = document.getElementById('puxar');
  if(!caixa || !conteudo || !marca) return;
  caixa.addEventListener('touchstart', comecar, { passive:true });
  caixa.addEventListener('touchmove', arrastar, { passive:false });
  caixa.addEventListener('touchend', soltar);
  caixa.addEventListener('touchcancel', cancelar);
}
