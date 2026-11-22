/* Ponto de entrada. Decide a primeira tela e inicia o app. */

import { S, render, autenticar } from './core.js';
import { Store } from './store.js';
import { criptoDisponivel } from './util.js';
import { ligarPuxar } from './puxar.js';

/* Os módulos de tela se registram ao serem importados. */
import './telas-auth.js';
import './telas-inicio.js';
import './telas-formulario.js';
import './telas-detalhe.js';
import './telas-auditoria.js';
import './telas-gestao.js';
import './telas-relatorio.js';
import './telas-visao.js';

function aplicarIdentidade(){
  const nome = S.escola.nome;
  document.title = nome ? `Registros ${nome}` : 'Registro de ocorrências';
}

async function iniciar(){
  S.modo = Store.modo();
  aplicarIdentidade();
  render();
  ligarPuxar();

  if(!criptoDisponivel()){
    S.formErro = 'Este navegador não oferece as funções de segurança necessárias. Abra o site por https (ou localhost).';
    S.tela = 'entrada';
    return render();
  }

  try {
    const estado = await Store.estado();
    S.precisaConfigurar = !!estado.precisaConfigurar;
    /* O cadastro acontece sem sessão, então as turmas vêm já no estado público. */
    if(Array.isArray(estado.turmas)) S.turmas = estado.turmas;
    /* A API pode mandar a identidade da escola, mantendo-a fora do repositório. */
    if(estado.escola){
      S.escola = { ...S.escola, ...estado.escola };
      aplicarIdentidade();
    }
  } catch(e){
    S.formErro = 'Não consegui falar com o servidor: ' + e.message;
    S.tela = 'entrada';
    return render();
  }

  if(S.precisaConfigurar){ S.tela = 'configurar'; return render(); }

  /* Sessão já guardada neste aparelho: entra direto. */
  const lembrado = Store.aparelhoLembrado();
  if(lembrado){
    const conta = await Store.retomarSessao();
    if(conta) return autenticar(conta);
    Store.esquecerAparelho();
  } else {
    const conta = await Store.retomarSessao();
    if(conta) return autenticar(conta);
  }

  S.tela = 'entrada';
  S.pronto = true;
  render();
}

iniciar();
