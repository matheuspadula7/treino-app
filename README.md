# Treino: app pessoal de ficha e evolução

PWA (abre como app no celular) com back-end em PHP e MySQL, pensado para a hospedagem compartilhada da Hostinger.

## O que o app faz

- Perfil inicial com peso, altura, idade e nível de atividade. Calcula IMC, gasto estimado e meta de calorias para perder gordura.
- Gera uma ficha (ABC, ABCD ou ABCDE) para perda de gordura, com cardio no final. Tudo editável.
- Treino em andamento com um exercício por vez: séries, carga do último treino, sugestão de progressão, cronômetro de descanso com vibração e som, e botão de série feita.
- Ao finalizar, você envia o print do relatório do Amazfit/Zepp. Uma IA de visão lê duração, calorias e batimentos, você confere e salva.
- Feedback automático comparando com o último treino do mesmo tipo.
- Corpo: peso, medidas (cintura, peito, braço, coxa, quadril) e fotos de evolução, com gráfico.
- Histórico de treinos com séries, dados do relógio e o print guardado.
- Funciona com sinal ruim: as séries ficam guardadas no celular e são enviadas quando a conexão volta.

## Instalação na Hostinger

1. **Banco de dados.** No hPanel, abra Bancos de dados > Gerenciamento MySQL e crie um banco e um usuário. Anote nome, usuário e senha.
2. **Subdomínio com SSL.** Crie algo como `treino.seudominio.com.br`. O modo "app" do celular exige HTTPS, e a Hostinger ativa o SSL gratuito.
3. **PHP.** Em Avançado > Configuração do PHP, use a versão 8.1 ou superior. Extensões necessárias (já vêm ativas por padrão): pdo_mysql, curl, fileinfo.
4. **Enviar os arquivos.** No Gerenciador de Arquivos, envie o zip para a pasta `public_html` do subdomínio e extraia lá. O `index.html` deve ficar direto nessa pasta.
5. **Configurar.** Na pasta `api`, copie `config.sample.php` para `config.php` e preencha banco, senha do app e a chave da IA.
6. **Criar as tabelas.** Abra `https://treino.seudominio.com.br/api/install.php?key=SUA_SENHA`. Deve aparecer "Instalação concluída". Depois **apague** `api/install.php` do servidor.
7. **Abrir no celular.** Acesse o endereço, entre com a senha e instale:
   - Android (Chrome): menu ⋮ > Instalar app.
   - iPhone (Safari): Compartilhar > Adicionar à Tela de Início.

## Deploy automatico

Veja o arquivo `DEPLOY.md`. O `config.php` e as fotos ficam na pasta `treino-private`, fora da pasta publicada.

## Chave da IA (leitura do print)

1. Crie uma conta em console.anthropic.com e gere uma chave de API.
2. Defina um limite de gasto mensal baixo na própria conta.
3. Cole a chave em `api/config.php`, no campo `anthropic_api_key`. Ela fica só no servidor.

Cada leitura de print tem custo baixo. Confira a tabela de preços atual no console da Anthropic. Se a chave não estiver configurada, o app avisa e você digita os números na mão.

## Segurança

- Use uma senha longa em `app_password`. Se preferir, guarde um hash gerado com `password_hash()` do PHP.
- Apague `api/install.php` depois da instalação.
- As fotos e prints ficam em `storage/`, bloqueada para acesso direto. Só são entregues pela API depois do login.
- Não compartilhe o `config.php`.
- Faça backup do banco de vez em quando (hPanel > phpMyAdmin > Exportar).

## Teste rápido depois de instalar

1. Entre, preencha o perfil e gere a ficha.
2. Faça um treino curto: marque uma série e veja o cronômetro de descanso.
3. Finalize, envie um print do Zepp e confira se os números foram lidos.
4. Abra `https://treino.seudominio.com.br/storage/qualquer.jpg`: deve dar acesso negado (403).

## Estrutura

```
index.html, css/, js/, sw.js, manifest.webmanifest, icons/   (front-end PWA)
api/        back-end PHP (index.php é o roteador)
schema.sql  tabelas do banco
storage/    fotos e prints (bloqueada)
```

## Ideias para a próxima versão

- Segundo perfil para a sua esposa (o banco já tem a coluna de usuário).
- Gráfico de carga por exercício.
- Lembrete de pesagem semanal.
