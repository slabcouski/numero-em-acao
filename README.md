# Número em Ação 🎓✨

## O que é?

**Número em Ação** é uma plataforma educativa divertida e interativa que ajuda crianças a aprender matemática de forma leve e envolvente. Através de um jogo com anéis rotativos, os alunos praticam operações matemáticas (soma, subtração, multiplicação e divisão) em diferentes níveis de dificuldade.

## Como Funciona?

### 🎮 O Jogo
A plataforma usa um sistema de anéis rotativos que funcionam como uma calculadora criativa:
- Você gira três anéis para escolher os números da conta
- Cada anel representa um número diferente (números de 1 a 12)
- Após girar, você vê qual operação matemática deve fazer (somar, subtrair, multiplicar ou dividir)
- Você então resolve mentalmente e marca a resposta correta girando outro anel

### 📚 Estrutura de Aprendizado
A plataforma tem **4 níveis de dificuldade** que progridem automaticamente:

1. **Adição (Soma)** - Começa com contas simples de somar
2. **Subtração** - Depois aprende a subtrair
3. **Multiplicação** - Avança para tabuada
4. **Divisão** - O nível mais desafiador

Cada nível tem várias rodadas para praticar bastante antes de avançar.

### ⭐ Sistema de Pontuação
- Cada resposta correta ganha pontos
- Respostas erradas ajudam a aprender sem perder pontos (você pode tentar novamente)
- Seu progresso é salvo automaticamente, então você pode retomar quando quiser

### 👤 Cadastro Simples
Para começar, você precisa:
- Criar uma conta com seu nome e uma senha
- Ou fazer login com sua conta Google (muito rápido!)
- Seu progresso fica salvo na plataforma

## Objetivo

Tornar o aprendizado de matemática **divertido**, **interativo** e **eficaz**, transformando a prática de contas em um jogo emocionante onde o aluno aprende brincando!

## Para Quem?

**Número em Ação** foi criada especialmente para apoiar crianças com **autismo**, **TDAH** e outros **neurodivergentes** no aprendizado de matemática. A plataforma utiliza uma abordagem lúdica e multissensorial, com estímulos visuais atraentes, feedback imediato e ritmo de aprendizado adaptável, respeitando as características e necessidades específicas de cada criança.

Qualquer criança em fase de aprendizado das operações matemáticas básicas, ou qualquer pessoa que queira praticar, também pode se beneficiar da experiência divertida que oferecemos!

---

## Execução e migração

O aplicativo usa funções Node.js na Vercel e um MySQL remoto. As credenciais do banco permanecem somente no servidor. Para executar localmente, copie `.env.example` para `.env.local`, preencha os valores, use `APP_URL=http://localhost:3000`, execute `npm install` e depois `npm start`. Para testar o Google localmente, autorize também `http://localhost:3000/api/auth/google/callback` no cliente OAuth.

O MySQL remoto deve permitir conexões da aplicação. Para TLS, configure `MYSQL_CA_PATH` localmente ou `MYSQL_CA_PEM` na Vercel com a CA fornecida pela hospedagem. A opção `MYSQL_ALLOW_INSECURE=true` permite conexões sem criptografia e expõe credenciais e dados na rede; use-a somente quando esse risco tiver sido expressamente aceito. A Vercel pode exigir uma solução de IP de saída fixo para acesso a um banco com lista de IPs permitidos.

Configure `APP_URL` com a origem pública da aplicação, sem caminho final. No cliente OAuth do Google, adicione `<APP_URL>/api/auth/google/callback` como URI de redirecionamento autorizada. Configure `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e as variáveis `MYSQL_*` nas variáveis de ambiente da Vercel. Use uma URL estável para evitar quebrar o callback entre implantações.

Para migrar uma instalação existente do Supabase:

1. Faça backup e interrompa gravações na aplicação antiga até concluir a troca.
2. Crie um banco MySQL vazio. Em `.env.local`, configure também `SUPABASE_URL` e uma `SUPABASE_SECRET_KEY` de uso exclusivo para a migração. Não publique essa chave nem a configure na Vercel.
3. Execute `node scripts/migrate-to-mysql.js` para verificar acesso e contagens sem gravar. Execute com `--execute` para criar as tabelas e copiar os dados. O comando recusa um destino que já contenha tabelas.
4. Configure e publique a nova aplicação, valide logins locais, Google e progresso, e somente então retome o uso. Se a migração for interrompida após criar as tabelas, examine o destino antes de uma nova tentativa: o comando não apaga tabelas existentes.

As senhas locais antigas são convertidas para hashes scrypt durante a cópia; as identidades Google são vinculadas pelo identificador Google original, não pelo e-mail. As sessões anteriores ao corte não são migradas, portanto os usuários precisarão entrar novamente. Execute `npm test` para verificar os testes automatizados.

**Aprenda matemática se divertindo com Número em Ação!** 🚀🎯
