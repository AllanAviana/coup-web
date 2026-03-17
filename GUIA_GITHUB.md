# Hospedando o Coup no GitHub 🚀

O GitHub Pages é uma plataforma fantástica e gratuita para hospedar sites, mas ele tem uma limitação: **ele só hospeda a parte "Visual" do site (Frontend - HTML, CSS e JS)**. Ele não roda servidores backend como o nosso `server.js` (Node.js).

Para que seus amigos possam jogar pelo link do GitHub, precisaremos dividir o projeto em duas partes:
1. **Frontend (Visual)**: Ficará no GitHub Pages (ex: `https://allanviana.github.io/coup`).
2. **Backend (Servidor)**: Precisará ficar rodando na nuvem em um serviço gratuito de Node.js (como **Render** ou **Glitch**).

Vou te mostrar o passo a passo exato para fazermos isso usando o **Glitch** para o Servidor (pois é instantâneo) e o **GitHub Pages** para o Cliente.

---

## Parte 1: Hospedando o Backend no Glitch (Instantâneo) ⚙️

1. Acesse [Glitch.com](https://glitch.com/) e crie uma conta gratuita (pode usar o próprio login do GitHub).
2. Clique no botão **"New Project"** no canto superior direito e escolha **"Glitch: Hello-Express"**.
3. O Glitch vai criar um projeto web novo. Na barra lateral esquerda, clique em **`package.json`**.
   - Adicione o `socket.io` em dependencies para ficar assim:
   ```json
   "dependencies": {
     "express": "^4.18.2",
     "socket.io": "^4.7.2"
   }
   ```
4. Na barra lateral esquerda, clique em **`server.js`**, apague tudo e cole o código inteiro do nosso arquivo `server.js` (da sua máquina).
5. Pronto! O servidor já está rodando. 
6. No canto superior esquerdo, clique no botão **"Share"** (ou botão "Preview" -> "Copy URL"). Copie o link principal do projeto (ex: `https://projeto-legal.glitch.me`). **Guarde este link!**

---

## Parte 2: Ajustando o Frontend e Subindo no GitHub 🌐

Agora que temos o servidor na nuvem, precisamos dizer para o nosso site visual se conectar nele!

### 2.1 - Alterando o Código
Abra o arquivo `public/script.js` no seu VS Code. Lembra da primeira linha? Nós vamos trocar:

**De:**
```javascript
const socket = io();
```

**Para:** (usando o link que você pegou do Glitch):
```javascript
// ATENÇÃO: Substitua pela URL real do seu Glitch
const socket = io('https://projeto-legal.glitch.me');
```

Abra o arquivo `public/index.html`. Na linha que carrega o Socket.io, mude:
**De:**
```html
<script src="/socket.io/socket.io.js"></script>
```
**Para:**
```html
<!-- Pega a biblioteca direto da internet -->
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
```

### 2.2 - Subindo para o GitHub (Para seus amigos)
1. Acesse seu [GitHub](https://github.com/) e crie um **Novo Repositório** chamado `coup-web`. Marque como "Public".
2. Depois de criar, o GitHub vai mostrar a tela vazia. Clique no link **"uploading an existing file"** que aparece pequeno na tela.
3. Arraste **APENAS** os arquivos que estão dentro da pasta `public` (`index.html`, `style.css` e `script.js`) solte na tela verde do Github e clique em "Commit Changes".
*(Não precisa mandar o `server.js` nem `package.json`, pois eles estão no Glitch!)*

### 2.3 - Ativando o GitHub Pages
1. Na página do repositório que você acabou de criar no GitHub, clique na aba **"Settings"** (Configurações) no topo.
2. Na barra lateral esquerda, clique em **"Pages"**.
3. Em "Source" (ou "Build and deployment"), certifique-se que está como "Deploy from a branch".
4. Onde diz "Branch", mude de "None" para **`main`** (ou `master`) e clique em **Save**.
5. Aguarde cerca de 2 minutos. Atualize a página e o GitHub mostrará uma mensagem verde com o link do seu jogo online:
👉 `https://allanviana.github.io/coup-web/`

**Mandou esse link pros amigos? Pronto! O Frontend (no GitHub) vai se comunicar com o Backend (no Glitch) e tudo funcionará perfeito!**
