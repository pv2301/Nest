/* Catálogos do domínio e dados de demonstração.
   Os catálogos serão editáveis pela gestão quando o backend entrar; por ora vivem aqui. */

export const PAPEIS_CONTA = [
  { id:'assistente', nome:'Assistente' },
  { id:'miss',       nome:'Miss' },
  { id:'gestao',     nome:'Gestão' }
];

export const FUNCOES = [
  { id:'painel',   nome:'Painel de estatísticas', desc:'Heatmap, recorrência e qualidade do processo', pronta:true },
  { id:'horario',  nome:'Quadro horário',         desc:'Quem está em qual turma e turno',              pronta:false },
  { id:'relacoes', nome:'Relações',               desc:'Vínculo entre Miss, assistente, turma e crianças', pronta:false }
];

export const TURMAS = ['Verde','Azul','Amarela'];

export const KIDS = [
  { id:'c1', nome:'Helena S.',  turma:'Verde', ini:'HS', recentes:2 },
  { id:'c2', nome:'Theo M.',    turma:'Verde', ini:'TM', recentes:3 },
  { id:'c3', nome:'Benício R.', turma:'Verde', ini:'BR', recentes:0 },
  { id:'c4', nome:'Alice G.',   turma:'Verde', ini:'AG', recentes:0 },
  { id:'c5', nome:'Lara F.',    turma:'Azul',  ini:'LF', recentes:1 },
  { id:'c6', nome:'Cecília A.', turma:'Azul',  ini:'CA', recentes:0 }
];

export const CATS = {
  'Físico / acidente':      ['Queda','Batida / colisão','Arranhão','Prensou / entalou'],
  'Interação entre pares':  ['Mordida','Empurrão','Conflito por objeto','Exclusão'],
  'Regulação emocional':    ['Choro intenso','Desregulação','Dificuldade de separação','Recusa de atividade'],
  'Saúde / corpo':          ['Lesão visível','Febre / mal-estar','Vômito','Medicação'],
  'Rotina e cuidados':      ['Alimentação','Higiene','Sono','Banheiro']
};

export const LOCAIS = ['Pátio externo','Sala Verde','Sala Azul','Refeitório','Parque de areia','Corredor','Banheiro'];
export const PROVIDENCIAS = ['Intervenção imediata','Acolhimento','Higienização','Primeiros cuidados','Mediação do conflito','Orientação pedagógica','Comunicação à coordenação','Observação posterior'];
export const CONDICOES = ['Retornou às atividades','Permaneceu chorosa','Precisou de acompanhamento','Relatou dor/desconforto','Marca/lesão visível'];
export const REGIOES = ['Cabeça / rosto','Braço direito','Braço esquerdo','Mão direita','Mão esquerda','Tronco','Costas','Perna direita','Perna esquerda','Pé direito','Pé esquerdo','Não se aplica'];
export const PAPEIS_ENVOLVIDO = ['Sofreu','Causou','Ambos','Envolvida','Testemunhou'];
export const SEVL = { 1:'Informativo', 2:'Atenção', 3:'Relevante', 4:'Urgente' };

/* Palavras que denunciam julgamento em vez de fato observável. Aviso, nunca bloqueio. */
export const JULGAMENTO = ['agressivo','agressiva','mal-educado','mal educada','malcriado','malcriada','birra','manhoso','manhosa','preguiçoso','chato','chata','sempre','nunca','de propósito','propositalmente','bagunceiro','teimoso','teimosa','difícil','problema','culpa','mentiroso','fingindo','drama','terrível','impossível'];

export const HEAT = [
  ['Pátio externo', [0,1,4,2,1,0]],
  ['Sala Verde',    [1,1,0,1,2,1]],
  ['Parque areia',  [0,0,2,3,1,0]],
  ['Refeitório',    [0,0,1,3,0,0]],
  ['Sala Azul',     [2,1,0,0,1,1]]
];
export const HORAS = ['8h','9h','10h','11h','14h','15h'];

/* ---------- demonstração ----------
   Contas de demonstração nascem SEM senha utilizável (resumo nulo): para entrar como
   uma delas, a gestão redefine a senha pela própria tela de usuários. Assim nenhuma
   credencial fica escrita no repositório, que é público. */

export const DEMO_CONTAS = [
  { login:'ana.paula',       nome:'Ana Paula Ribeiro', papel:'assistente', turma:'Verde', funcoes:[],         status:'ativo',    resumo:null, criadoEm:'2026-11-01T12:00:00.000Z', aprovadoPor:'demonstração' },
  { login:'carolina.mendes', nome:'Carolina Mendes',   papel:'miss',       turma:'Verde', funcoes:['painel'], status:'ativo',    resumo:null, criadoEm:'2026-11-01T12:00:00.000Z', aprovadoPor:'demonstração' },
  { login:'beatriz.souza',   nome:'Beatriz Souza',     papel:'miss',       turma:'Azul',  funcoes:[],         status:'ativo',    resumo:null, criadoEm:'2026-11-01T12:00:00.000Z', aprovadoPor:'demonstração' },
  { login:'marina.alves',    nome:'Marina Alves',      papel:'assistente', turma:'Azul',  funcoes:[],         status:'pendente', resumo:null, criadoEm:'2026-11-14T13:20:00.000Z' }
];

const MC = 'Carolina Mendes (Turma Verde)';
const MB = 'Beatriz Souza (Turma Azul)';

export const DEMO_OCORRENCIAS = [
  { id:'0412', tipo:'Mordida', cat:'Interação entre pares', sev:2, local:'Pátio externo', quando:'Hoje, 10:18',
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'assistente',
    envolvidos:[{kid:'c1',papel:'Sofreu',cond:'Permaneceu chorosa',lesao:'Mão direita'},{kid:'c2',papel:'Causou',cond:'Retornou às atividades',lesao:''}],
    desc:'Durante o brincar livre no pátio, Helena e Theo disputavam o mesmo balde de areia. Theo mordeu a mão direita de Helena. Separei as duas imediatamente e acolhi Helena, que chorou por cerca de três minutos.',
    prov:['Intervenção imediata','Acolhimento','Higienização'], foto:true, fotoDias:90, presenciou:true,
    chain:[{nivel:MC,st:'now'},{nivel:'Gestão',st:'wait'}], status:'aguarda_miss', prazo:'22h restantes' },

  { id:'0410', tipo:'Batida / colisão', cat:'Físico / acidente', sev:3, local:'Corredor', quando:'Hoje, 09:05',
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'assistente',
    envolvidos:[{kid:'c4',papel:'Sofreu',cond:'Relatou dor/desconforto',lesao:'Cabeça / rosto'}],
    desc:'Alice correu no corredor durante a transição para o parque e bateu a testa na quina da porta aberta. Apliquei compressa fria por cinco minutos. Formou-se marca avermelhada, sem corte.',
    prov:['Primeiros cuidados','Acolhimento','Comunicação à coordenação'], foto:true, fotoDias:90, presenciou:true,
    chain:[{nivel:MC,st:'ok',quando:'Hoje, 09:22',parecer:'Confirmo o nível 3. Marca visível na testa — a família precisa saber ainda hoje.'},{nivel:'Gestão',st:'now'}],
    status:'aguarda_gestao', prazo:'3h restantes' },

  { id:'0408', tipo:'Conflito por objeto', cat:'Interação entre pares', sev:2, local:'Refeitório', quando:'Ontem, 11:40',
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'assistente',
    envolvidos:[{kid:'c6',papel:'Envolvida',cond:'Retornou às atividades',lesao:''},{kid:'c2',papel:'Envolvida',cond:'Retornou às atividades',lesao:''}],
    desc:'Cecília e Theo puxaram o mesmo livro durante a espera do almoço. Houve choro de ambos, sem contato físico. Mediei a situação e combinamos o revezamento.',
    prov:['Mediação do conflito','Orientação pedagógica'], foto:false, presenciou:true,
    chain:[{nivel:MC,st:'ok',quando:'Ontem, 12:15'},{nivel:MB,st:'now'},{nivel:'Gestão',st:'wait'}],
    status:'aguarda_miss', prazo:'6h restantes', duas:true },

  { id:'0411', tipo:'Queda', cat:'Físico / acidente', sev:3, local:'Parque de areia', quando:'Ontem, 15:02',
    autor:'Carolina Mendes', autorLogin:'carolina.mendes', autorPapel:'miss',
    envolvidos:[{kid:'c3',papel:'Sofreu',cond:'Relatou dor/desconforto',lesao:'Perna esquerda'}],
    desc:'Benício escorregou ao descer o escorregador e caiu sentado na areia. Relatou dor no joelho esquerdo. Apliquei compressa fria e observei a marcha nos minutos seguintes, sem alteração.',
    prov:['Primeiros cuidados','Comunicação à coordenação','Observação posterior'], foto:true, fotoDias:89, presenciou:true,
    chain:[{nivel:'Gestão',st:'ok',quando:'Ontem, 15:40',parecer:'Família comunicada no mesmo dia por telefone. Observar o joelho até sexta.'}],
    status:'acompanhamento', acomp:'Observar marcha até 18/11 · Carolina Mendes' },

  { id:'0409', tipo:'Choro intenso', cat:'Regulação emocional', sev:1, local:'Sala Azul', quando:'Ontem, 08:12',
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'assistente',
    envolvidos:[{kid:'c5',papel:'Envolvida',cond:'Retornou às atividades',lesao:''}],
    desc:'Lara chorou na despedida da mãe por cerca de dez minutos. Foi acolhida no canto da leitura e retornou à roda com o grupo.',
    prov:['Acolhimento'], foto:false, presenciou:true,
    chain:[{nivel:MB,st:'ok',quando:'Ontem, 09:05',parecer:'Padrão das segundas-feiras. Sigo acompanhando a rotina de chegada.'}],
    status:'concluido' },

  { id:'0405', tipo:'Arranhão', cat:'Físico / acidente', sev:2, local:'Sala Verde', quando:'11/11, 14:20',
    autor:'Carolina Mendes', autorLogin:'carolina.mendes', autorPapel:'miss',
    envolvidos:[{kid:'c1',papel:'Sofreu',cond:'Retornou às atividades',lesao:'Braço direito'}],
    desc:'Helena arranhou o braço direito na quina da estante ao se levantar depressa. Higienizei o local; marca superficial, sem sangramento.',
    prov:['Higienização','Primeiros cuidados'], foto:false, presenciou:true,
    chain:[{nivel:'Gestão',st:'ok',quando:'11/11, 16:30',parecer:'Ciente. Protetor de quina solicitado à manutenção.'}],
    status:'concluido' },

  { id:'0287', tipo:'Mordida', cat:'Interação entre pares', sev:2, local:'Pátio externo', quando:'14/08, 10:22',
    autor:'Carolina Mendes', autorLogin:'carolina.mendes', autorPapel:'miss',
    envolvidos:[{kid:'c1',papel:'Sofreu',cond:'Retornou às atividades',lesao:'Braço esquerdo'}],
    desc:'Helena e Theo disputavam o mesmo carrinho no pátio. Theo mordeu o braço esquerdo de Helena, sem rompimento da pele. Higienizei o local e mediei a devolução do brinquedo.',
    prov:['Intervenção imediata','Higienização','Mediação do conflito'], foto:true, fotoPurgada:'12/11', presenciou:true,
    chain:[{nivel:'Gestão',st:'ok',quando:'14/08, 11:10',parecer:'Família comunicada no mesmo dia. Sem necessidade de novo contato.'}],
    status:'concluido' }
];

export const kid = id => KIDS.find(k => k.id === id);
