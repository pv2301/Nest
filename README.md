# Registro interno de ocorrências

Aplicativo web para a equipe pedagógica registrar ocorrências do dia a dia, com cadeia
de ciência entre professora e gestão.

Abre no celular a partir de um link, sem instalar nada e sem exigir conta de nenhum
outro serviço. Quem recebe o link cria a sua conta e passa a usar assim que a gestão
aprovar.

---

## Como funciona

**Dois perfis.** *Miss* registra o que aconteceu e toma ciência do que envolve a sua
turma. *Gestão* vê tudo, aprova contas, comunica a família e encaminha.

**Cadeia de ciência.** Um registro sobe um nível por vez e cada nível confirma por
escrito. Quando há crianças de turmas diferentes, a ciência é paralela — uma professora
por turma envolvida — e só depois chega à gestão.

**Conta nova entra pendente.** Qualquer pessoa com o link se cadastra; ninguém vê nada
até a gestão aprovar.

**Funções concedidas uma a uma.** Além do perfil, a gestão liga ou desliga o painel de
estatísticas, o quadro horário e as relações, por usuário.

---

## Arquitetura

```
index.html            casca da página
config.js             identidade da escola e endereço da API
assets/               front-end: módulos ES, sem build e sem framework
api/                  funções serverless (Node) executadas pelo Vercel
  index.js            roteador de todas as ações
  foto.js             envio e leitura de imagem
  cron.js             limpeza diária
  _db.js              Postgres e migrações automáticas
  _auth.js            sessão, senha e permissões
testes/               suítes que rodam sem navegador, com Postgres em memória
backend-apps-script/  backend antigo, aposentado (histórico)
```

Front e API moram no mesmo endereço, então não há CORS nem token para administrar.
O banco é Postgres; as tabelas são criadas sozinhas na primeira requisição.

---

## Publicar

O projeto está no Vercel. Cada push na branch padrão publica sozinho.

### Configuração, uma vez só

1. **Storage → Create Database → Postgres.** As variáveis de ambiente entram sozinhas.
2. **Storage → Create → Blob.** O `BLOB_READ_WRITE_TOKEN` entra sozinho. Sem ele, só
   a foto deixa de funcionar; o resto do app roda.
3. **Settings → Environment Variables**, em Production e Preview:

   | Variável | Para que serve |
   |---|---|
   | `CODIGO_CONFIG` | Libera a criação da primeira conta de gestão. Use uma vez e apague. |
   | `CRON_SECRET` | Opcional. Com ela, só o cron do Vercel dispara a limpeza diária. |

4. Abra o site. Como não há conta nenhuma, ele mostra **Configuração inicial**:
   preencha nome, login (`nome.sobrenome`), senha e o `CODIGO_CONFIG`.

Depois disso, apague o `CODIGO_CONFIG` — ele já cumpriu a função.

---

## Desenvolvimento

Não precisa de banco instalado: o servidor local usa Postgres em memória.

```bash
npm install
node testes/servidor-local.mjs      # http://localhost:8222
npm test                            # suítes de API e de foto
```

O servidor local roda **os mesmos handlers** que o Vercel executa, então o que passa
aqui vale lá. O banco é recriado a cada reinício, e o código de configuração é
`424242`.

Para rodar sem servidor nenhum, esvazie `API_URL` em `config.js`: o app entra em modo
local, guardando tudo no navegador daquele aparelho. Útil para experimentar as telas;
inútil para uso real, porque nada é compartilhado.

---

## Segurança — o que vale saber

**A senha nunca sai do aparelho.** O navegador deriva uma chave com PBKDF2-SHA256
(150.000 iterações) e só ela trafega. O servidor aplica **bcrypt** sobre essa chave.
Duas camadas: a senha em claro não viaja, e um vazamento do banco não a entrega.

**A sessão vive num cookie httpOnly**, com SameSite=Lax e Secure. O JavaScript da
página não o alcança, então um XSS não rouba a sessão. No banco fica o resumo do
token, não o token.

**Nada sensível no repositório.** Ele é público: aqui não há senha, hash, chave nem
segredo. A primeira conta de gestão é criada na primeira visita, protegida pelo
`CODIGO_CONFIG`, que só existe nas variáveis de ambiente.

**A foto só sai pela API**, que confere a sessão e se a pessoa está na cadeia de
ciência daquele registro ou é gestão. Cada visualização vai para o log, e a imagem é
apagada 90 dias depois, salvo quando a gestão marca preservar.

*Ressalva honesta:* no plano atual do Vercel o arquivo tem URL pública, ainda que
impossível de adivinhar. Servir pela API impede listagem e acesso sem sessão, mas quem
obtiver a URL final consegue abrir. Com retenção curta é aceitável; privacidade real
exigiria o recurso pago.

**A identidade da escola pode sair do repositório.** `config.js` é o único lugar que a
cita. Esvaziando esses campos e preenchendo a tabela `config` do banco
(`escolaNome`, `escolaSubtitulo`, `escolaLogo`), o nome passa a vir do servidor.

---

## Testes

`npm test` roda as suítes de API e de foto contra um Postgres em memória — o mesmo
código que vai para produção, incluindo os casos negativos: conta pendente não entra,
Miss não acessa rotas de gestão, Miss de outra turma não vê a foto, sessão expirada é
recusada, anexo some aos 90 dias e sobrevive quando preservado.

As suítes de navegador ficam fora do repositório, na área de trabalho da sessão, e
rodam contra `testes/servidor-local.mjs`.
