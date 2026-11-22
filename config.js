/* =============================================================================
   ÚNICO arquivo com a identidade da escola e o endereço do backend.
   O restante do código é genérico e nunca cita o nome da escola.

   ATENÇÃO: este repositório é público, então tudo aqui é legível por qualquer
   pessoa. Para que a identidade NÃO fique exposta, deixe os campos de ESCOLA
   vazios e preencha-os na planilha do backend (aba "config"): quando a API
   responde, os valores dela substituem os daqui.
   ============================================================================= */

export const CONFIG = {

  /* ---------------------------------------------------------------------------
     1. BACKEND
     Vazio = modo local: cada aparelho guarda as próprias contas e registros, e
     uma conta criada num celular NÃO aparece em outro.
     Preenchido = modo compartilhado: criar conta num aparelho e a gestão aprovar
     em outro funciona de verdade.

     No Vercel a API vive no mesmo endereço do site, então '/api' basta.
     Deixe vazio para rodar sem servidor, em modo local por aparelho.
     --------------------------------------------------------------------------- */
  API_URL: '/api',

  /* ---------------------------------------------------------------------------
     2. IDENTIDADE
     Usada no título da aba, na tela de entrada e no rodapé de confidencialidade.
     A API, quando configurada, pode sobrescrever estes três campos.
     --------------------------------------------------------------------------- */
  ESCOLA: {
    nome: 'The Nest',
    subtitulo: 'Registro interno de ocorrência',
    logo: 'assets/logo.png'   // vazio = usa apenas o selo de anéis desenhado em SVG
  },

  /* ---------------------------------------------------------------------------
     3. REGRAS DE NEGÓCIO
     Decididas nas conversas de desenho; ficam aqui para a gestão poder ajustar
     sem mexer no código.
     --------------------------------------------------------------------------- */
  REGRAS: {
    nivel1EncerraNaMiss: true,  // nível 1 sem gatilho se encerra na ciência da Miss
    // O prazo de guarda da foto mudou-se para assets/js/regras.mjs: o servidor
    // precisa lê-lo, e não consegue ler este arquivo. Ver RETENCAO_FOTO_DIAS.
  }
};
