# Guia de Deploy e Conexão Multiplayer do Jogo Coup

Este guia apresenta o passo a passo de como tornar o seu jogo local acessível para seus amigos jogarem pela internet. 

## A raiz do Problema: O CGNAT e o Port Forwarding 🌍

**Por que simplesmente abrir a porta no roteador (Port Forwarding) não funciona?**
Antigamente, cada roteador de internet recebia um endereço IP público exclusivo. Você entrava no roteador, apontava a porta 3000 para o seu PC e pronto! Qualquer pessoa no mundo acessava seu jogo. 

Hoje em dia, os endereços IP (IPv4) acabaram. Para lidar com isso, as operadoras de internet criaram o **CGNAT (Carrier-Grade NAT)**. Isso significa que o seu roteador divide o **mesmo IP Público** com dezenas ou centenas de outros vizinhos do seu bairro. Como você não tem um IP público exclusivo, abrir portas no seu roteador de casa não resolve o problema, porque a internet ("o mundo externo") não sabe como rotear o tráfego especificamente para a sua casa no meio de tantas outras.

Para contornar isso, usamos ferramentas como o **Ngrok** (que cria um túnel seguro ignorando seu roteador) ou hospedamos o jogo direto em uma **Nuvem** que possui um IP público de verdade.

---

## 🛠 Ajuste Necessário no Código Frontend (Para ambas as soluções)

Em jogos usando Socket.io, a forma mais resiliente de conectar o Frontend ao Backend sem se preocupar de onde ele está rodando (seu PC, Ngrok ou Nuvem) é **NÃO PASSAR NENHUMA URL no `io()`**. 

No seu arquivo `public/script.js`, no começo, deixe a linha exatamente assim:

```javascript
const socket = io();
```

Ao não passar nenhum argumento, o Socket.io usa recursos nativos do navegador para entender qual foi o endereço web que serviu a página (ex: `http://localhost:3000` ou `https://meu-jogo.ngrok-free.app`) e se conecta automaticamente usando aquele mesmo endereço. O seu código já está configurado assim!

---

## Solução 1: Túnel com Ngrok (Partida Rápida / Temporária) 🚇

O Ngrok cria uma URL pública (ex: `https://abcd-123.ngrok-free.app`) que redireciona o tráfego direto para a porta do seu PC, furando bloqueios de Roteador e CGNAT, **sem você precisar configurar nada na sua rede**.

1. Crie uma conta gratuita em [ngrok.com](https://ngrok.com/)
2. Baixe o Ngrok para o seu Mac e instale-o conforme as instruções no painel inicial deles (geralmente extraindo no seu computador e rodando o comando de *Autenticação* que eles fornecem com o seu token).
3. **Inicie o seu jogo normalmente** no terminal do VS Code:
   ```bash
   npm start
   ```
4. **Abra um NOVO terminal**, e inicie o Ngrok apontando para a porta 3000:
   ```bash
   ngrok http 3000
   ```
5. O Ngrok vai gerar uma tela preta cheia de dados. Procure na linha **"Forwarding"** por um link que começa com `https://...`.
6. Envie **APENAS ESSE LINK** (ex: `https://abcd-12.ngrok-free.app`) para o Daniel e o Gustavo. Eles colocarão isso no navegador e se conectarão instantaneamente ao seu servidor!

*Nota: Na versão gratuita, o link do Ngrok muda toda vez que você fecha e abre ele.*

---

## Solução 2: Hospedagem Gratuita na Nuvem com Render ☁️ (Hospedagem 24/7)

Se você não quer manter o seu PC ligado pra galera jogar, a solução é subir o código para a nuvem. O serviço **Render** (render.com) é perfeito e de graça. 

**Passo 1: Preparando o seu código**
Eu já modifiquei o seu arquivo `server.js` na linha da porta de conexão. Agora ele diz:
`const PORT = process.env.PORT || 3000;`
*(Isso diz para o seu código: "Se o Render me der uma porta obrigatória, eu uso ela. Se não tiver nada, eu uso a 3000")*

Seu arquivo `package.json` já tem o comando de inicio corretamente:
```json
"scripts": {
  "start": "node server.js"
}
```

**Passo 2: Subindo o código para o GitHub**
1. Crie uma conta no [GitHub](https://github.com/).
2. Crie um repositório novo (pode ser Público ou Privado).
3. Faça o upload dos arquivos da pasta `jogo_Cartas` para esse repositório (você pode arrastar os arquivos no próprio site do GitHub ou usar comandos Git).

**Passo 3: Conectando o Render**
1. Crie uma conta no [Render](https://render.com/) fazendo login com seu GitHub.
2. Clique em **"New +"** e escolha **"Web Service"**.
3. Escolha a opção de buscar um repositório do seu GitHub e selecione o repositório do jogo.
4. Na tela de configuração:
   - **Name**: Nome do seu projeto.
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (Gratuito)
5. Clique em **"Create Web Service"**.
6. O Render vai baixar, instalar e rodar seu jogo. No canto superior esquerdo, ele te dará o link oficial (ex: `https://jogo-cartas-xyz.onrender.com`).
7. Envie esse link para os amigos. Ficará online 24h sem você precisar estar no PC! *(O plano gratuito dorme após 15 minutos sem uso e demora uns 30 segundinhos pra "acordar" no primeiro acesso do dia).*
