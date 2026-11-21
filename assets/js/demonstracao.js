/* Conteúdo de exemplo, para quem abre o app pela primeira vez e quer ver como ele se
   comporta com dados dentro. Nenhuma criança real: nomes e episódios são inventados.

   Contas de demonstração nascem SEM senha utilizável (resumo nulo): para entrar como
   uma delas, a gestão redefine a senha pela tela de usuários. Assim nenhuma credencial
   fica escrita no repositório, que é público. */

export const SEMENTE_TURMAS = [
  { id:'t1', nome:'Verde',    faixa:'2 a 3 anos' },
  { id:'t2', nome:'Azul',     faixa:'3 a 4 anos' },
  { id:'t3', nome:'Amarela',  faixa:'4 a 5 anos' }
];

export const SEMENTE_ALUNOS = [
  { id:'c1', nome:'Helena Souza',    turma:'Verde', nascimento:'2023-04-12', saude:'', ativo:true },
  { id:'c2', nome:'Theo Martins',    turma:'Verde', nascimento:'2023-02-28', saude:'', ativo:true },
  { id:'c3', nome:'Benício Rocha',   turma:'Verde', nascimento:'2023-07-03', saude:'', ativo:true },
  { id:'c4', nome:'Alice Gomes',     turma:'Verde', nascimento:'2023-01-19', saude:'Alergia a amendoim', ativo:true },
  { id:'c5', nome:'Lara Ferreira',   turma:'Azul',  nascimento:'2022-09-30', saude:'', ativo:true },
  { id:'c6', nome:'Cecília Almeida', turma:'Azul',  nascimento:'2022-11-11', saude:'', ativo:true }
];

export const DEMO_CONTAS = [
  { login:'ana.paula',       nome:'Ana Paula Ribeiro', papel:'miss', turma:'Verde', funcoes:[],         status:'ativo',    resumo:null, criadoEm:'2026-11-01T12:00:00.000Z', aprovadoPor:'demonstração' },
  { login:'carolina.mendes', nome:'Carolina Mendes',   papel:'miss',       turma:'Verde', funcoes:['painel'], status:'ativo',    resumo:null, criadoEm:'2026-11-01T12:00:00.000Z', aprovadoPor:'demonstração' },
  { login:'beatriz.souza',   nome:'Beatriz Souza',     papel:'miss',       turma:'Azul',  funcoes:[],         status:'ativo',    resumo:null, criadoEm:'2026-11-01T12:00:00.000Z', aprovadoPor:'demonstração' },
  { login:'marina.alves',    nome:'Marina Alves',      papel:'miss', turma:'Azul',  funcoes:[],         status:'pendente', resumo:null, criadoEm:'2026-11-14T13:20:00.000Z' }
];

const MC = 'Carolina Mendes (Turma Verde)';
const MB = 'Beatriz Souza (Turma Azul)';

/* Datas relativas a hoje, para o filtro de período do painel ter o que mostrar. */
function hLantes(dias, hora, min){
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, min, 0, 0);
  return d.toISOString();
}

export const DEMO_OCORRENCIAS = [
  { id:'0412', categoria:'Incidente', tipo:'Mordida', sev:2, local:'Pátio externo', quandoISO:hLantes(0,10,18),
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'miss',
    envolvidos:[{kid:'c1',papel:'Sofreu',cond:'Permaneceu chorosa',lesao:'Mão direita'},{kid:'c2',papel:'Causou',cond:'Retornou às atividades',lesao:''}],
    desc:'Durante o brincar livre no pátio, Helena e Theo disputavam o mesmo balde de areia. Theo mordeu a mão direita de Helena. Separei as duas imediatamente e acolhi Helena, que chorou por cerca de três minutos.',
    prov:['Intervenção imediata','Acolhimento','Higienização'], foto:true, fotoDias:90, presenciou:true,
    chain:[{nivel:MC,st:'now'},{nivel:'Gestão',st:'wait'}], status:'aguarda_miss', prazo:'22h restantes' },

  { id:'0410', categoria:'Acidente', tipo:'Batida / colisão', sev:3, local:'Corredor', quandoISO:hLantes(0,9,5),
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'miss',
    envolvidos:[{kid:'c4',papel:'Sofreu',cond:'Relatou dor/desconforto',lesao:'Cabeça / rosto'}],
    desc:'Alice correu no corredor durante a transição para o parque e bateu a testa na quina da porta aberta. Apliquei compressa fria por cinco minutos. Formou-se marca avermelhada, sem corte.',
    prov:['Primeiros cuidados','Acolhimento','Comunicação à coordenação'], foto:true, fotoDias:90, presenciou:true,
    chain:[{nivel:MC,st:'ok',quando:'Hoje, 09:22',parecer:'Confirmo o nível 3. Marca visível na testa — a família precisa saber ainda hoje.'},{nivel:'Gestão',st:'now'}],
    status:'aguarda_gestao', prazo:'3h restantes' },

  { id:'0408', categoria:'Incidente', tipo:'Conflito por objeto', sev:2, local:'Refeitório', quandoISO:hLantes(1,11,40),
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'miss',
    envolvidos:[{kid:'c6',papel:'Envolvida',cond:'Retornou às atividades',lesao:''},{kid:'c2',papel:'Envolvida',cond:'Retornou às atividades',lesao:''}],
    desc:'Cecília e Theo puxaram o mesmo livro durante a espera do almoço. Houve choro de ambos, sem contato físico. Mediei a situação e combinamos o revezamento.',
    prov:['Mediação do conflito','Orientação pedagógica'], foto:false, presenciou:true,
    chain:[{nivel:MC,st:'ok',quando:'Ontem, 12:15'},{nivel:MB,st:'now'},{nivel:'Gestão',st:'wait'}],
    status:'aguarda_miss', prazo:'6h restantes', duas:true },

  { id:'0411', categoria:'Acidente', tipo:'Queda', sev:3, local:'Parque de areia', quandoISO:hLantes(1,15,2),
    autor:'Carolina Mendes', autorLogin:'carolina.mendes', autorPapel:'miss',
    envolvidos:[{kid:'c3',papel:'Sofreu',cond:'Relatou dor/desconforto',lesao:'Perna esquerda'}],
    desc:'Benício escorregou ao descer o escorregador e caiu sentado na areia. Relatou dor no joelho esquerdo. Apliquei compressa fria e observei a marcha nos minutos seguintes, sem alteração.',
    prov:['Primeiros cuidados','Comunicação à coordenação','Observação posterior'], foto:true, fotoDias:89, presenciou:true,
    chain:[{nivel:'Gestão',st:'ok',quando:'Ontem, 15:40',parecer:'Família comunicada no mesmo dia por telefone. Observar o joelho até sexta.'}],
    status:'acompanhamento', acomp:'Observar marcha por uma semana · Carolina Mendes' },

  { id:'0409', categoria:'Comportamento e emocional', tipo:'Choro intenso', sev:1, local:'Sala de aula', quandoISO:hLantes(1,8,12),
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'miss',
    envolvidos:[{kid:'c5',papel:'Envolvida',cond:'Retornou às atividades',lesao:''}],
    desc:'Lara chorou na despedida da mãe por cerca de dez minutos. Foi acolhida no canto da leitura e retornou à roda com o grupo.',
    prov:['Acolhimento'], foto:false, presenciou:true,
    chain:[{nivel:MB,st:'ok',quando:'Ontem, 09:05',parecer:'Padrão das segundas-feiras. Sigo acompanhando a rotina de chegada.'}],
    status:'concluido' },

  { id:'0405', categoria:'Incidente', tipo:'Arranhão', sev:2, local:'Sala de aula', quandoISO:hLantes(4,14,20),
    autor:'Carolina Mendes', autorLogin:'carolina.mendes', autorPapel:'miss',
    envolvidos:[{kid:'c1',papel:'Sofreu',cond:'Retornou às atividades',lesao:'Braço direito'}],
    desc:'Helena arranhou o braço direito na quina da estante ao se levantar depressa. Higienizei o local; marca superficial, sem sangramento.',
    prov:['Higienização','Primeiros cuidados'], foto:false, presenciou:true,
    chain:[{nivel:'Gestão',st:'ok',quando:'14:50',parecer:'Ciente. Protetor de quina solicitado à manutenção.'}],
    status:'concluido' },

  { id:'0398', categoria:'Incidente', tipo:'Mordida', sev:2, local:'Pátio externo', quandoISO:hLantes(9,10,35),
    autor:'Carolina Mendes', autorLogin:'carolina.mendes', autorPapel:'miss',
    envolvidos:[{kid:'c1',papel:'Sofreu',cond:'Permaneceu chorosa',lesao:'Braço esquerdo'},{kid:'c2',papel:'Causou',cond:'Retornou às atividades',lesao:''}],
    desc:'Helena e Theo disputavam o mesmo carrinho no pátio, pouco antes do lanche. Theo mordeu o braço esquerdo de Helena, sem rompimento da pele. Higienizei o local e mediei a devolução do brinquedo.',
    prov:['Intervenção imediata','Higienização','Mediação do conflito'], foto:false, presenciou:true,
    chain:[{nivel:'Gestão',st:'ok',quando:'11:10',parecer:'Família comunicada no mesmo dia. Terceiro episódio no mesmo horário.'}],
    status:'concluido' },

  { id:'0390', categoria:'Incidente', tipo:'Empurrão', sev:1, local:'Parque de areia', quandoISO:hLantes(16,10,50),
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'miss',
    envolvidos:[{kid:'c2',papel:'Causou',cond:'Retornou às atividades',lesao:''},{kid:'c3',papel:'Sofreu',cond:'Retornou às atividades',lesao:''}],
    desc:'Na fila para o lanche, Theo empurrou Benício para passar à frente. Nenhum dos dois caiu. Conversei com ambos sobre a espera.',
    prov:['Mediação do conflito','Orientação pedagógica'], foto:false, presenciou:true,
    chain:[{nivel:MC,st:'ok',quando:'11:00'}], status:'concluido' },

  { id:'0381', categoria:'Doença', tipo:'Febre / mal-estar', sev:3, local:'Sala de aula', quandoISO:hLantes(23,13,15),
    autor:'Carolina Mendes', autorLogin:'carolina.mendes', autorPapel:'miss',
    envolvidos:[{kid:'c4',papel:'Envolvida',cond:'Precisou de acompanhamento',lesao:''}],
    desc:'Após o almoço, Alice disse estar com dor de cabeça e recusou a atividade. Temperatura aferida: 37,9 °C. Permaneceu no espaço de descanso até a chegada da família.',
    prov:['Primeiros cuidados','Comunicação à coordenação'], foto:false, presenciou:true,
    chain:[{nivel:'Gestão',st:'ok',quando:'13:40',parecer:'Família buscou às 14h20. Orientada a procurar o pediatra.'}],
    status:'concluido' },

  { id:'0372', categoria:'Rotina e cuidados', tipo:'Alimentação', sev:1, local:'Refeitório', quandoISO:hLantes(45,11,45),
    autor:'Ana Paula Ribeiro', autorLogin:'ana.paula', autorPapel:'miss',
    envolvidos:[{kid:'c5',papel:'Envolvida',cond:'Retornou às atividades',lesao:''}],
    desc:'Lara recusou o prato principal e comeu apenas a fruta. Ofereci novamente em porção menor, sem insistir.',
    prov:['Observação posterior'], foto:false, presenciou:true,
    chain:[{nivel:MB,st:'ok',quando:'12:30'}], status:'concluido' }
];
