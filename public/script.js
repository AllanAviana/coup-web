const socket = io();

let myName = '';
let gameStateData = null;

// Telas
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

// Elementos
const usernameInput = document.getElementById('username');
const loginError = document.getElementById('login-error');
const playerList = document.getElementById('player-list');
const gameLog = document.getElementById('game-log');
const gameStatus = document.getElementById('game-status');
const opponentsArea = document.getElementById('opponents-area');
const myCardsContainer = document.getElementById('my-cards-container');
const myCoinsDisplay = document.getElementById('my-coins');
const myNameDisplay = document.getElementById('my-name-display');
const actionsPanel = document.getElementById('actions-panel');
const reactionPanel = document.getElementById('reaction-panel');
const reactionText = document.getElementById('reaction-text');
const reactionButtons = document.getElementById('reaction-buttons');

const targetCaptain = document.getElementById('target-captain');
const targetAssassin = document.getElementById('target-assassin');

function showScreen(screen) {
    loginScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    screen.classList.add('active');
}

function login() {
    const name = usernameInput.value.trim();
    if (!name) return;
    socket.emit('login', name);
}

function startGame() {
    socket.emit('start_game');
}

function playAction(actionName) {
    let target = null;
    if (actionName === 'captain') {
        target = targetCaptain.value;
    } else if (actionName === 'assassin') {
        target = targetAssassin.value;
    }
    socket.emit('play_action', { actionName, target });
}

function doubt() {
    socket.emit('doubt');
}

function pass() {
    socket.emit('pass');
}

function block(blockChar) {
    socket.emit('block', { blockChar });
}

// Socket Events
socket.on('login_success', (name) => {
    myName = name;
    myNameDisplay.innerText = myName;
    showScreen(lobbyScreen);
});

socket.on('login_error', (msg) => {
    loginError.innerText = msg;
});

socket.on('action_error', (msg) => {
    alert(msg);
});

socket.on('game_log', (msg) => {
    const p = document.createElement('p');
    p.innerText = msg;
    gameLog.appendChild(p);
    gameLog.scrollTop = gameLog.scrollHeight;
});

socket.on('update_state', (state) => {
    gameStateData = state;
    
    if (state.gameState === 'LOBBY') {
        showScreen(lobbyScreen);
        renderLobby(state);
    } else if (state.gameState === 'PLAYING' || state.gameState === 'GAME_OVER') {
        showScreen(gameScreen);
        renderGame(state);
    }
});

function renderLobby(state) {
    playerList.innerHTML = '';
    for (let p in state.players) {
        if (state.players[p].isConnected) {
            const li = document.createElement('li');
            li.innerText = p;
            playerList.appendChild(li);
        }
    }
}

function renderGame(state) {
    // Alvos para as selects
    let aliveOpponents = [];
    opponentsArea.innerHTML = '';

    for (let p in state.players) {
        if (p === myName) continue;
        
        let pData = state.players[p];
        if (pData.isAlive) aliveOpponents.push(p);

        let div = document.createElement('div');
        div.className = `opponent-card ${pData.isAlive ? '' : 'dead'}`;
        div.innerHTML = `
            <h3>${p}</h3>
            <p>Moedas: ${pData.coins}</p>
            <p>Cartas: ${pData.cardCount}</p>
            ${!pData.isConnected ? '<p style="color:red">(Desconectado)</p>' : ''}
        `;
        opponentsArea.appendChild(div);
    }

    // Atualiza selects
    updateSelect(targetCaptain, aliveOpponents);
    updateSelect(targetAssassin, aliveOpponents);

    // Minha Área
    let myData = state.players[myName];
    myCoinsDisplay.innerText = myData.coins;

    myCardsContainer.innerHTML = '';
    
    // Modo perda de influência ou modo troca (embaixador)
    let isChoosingLoss = state.pendingLoss === myName;
    let isChoosingExchange = state.pendingExchange === myName;

    let cardsToRender = [];
    if (isChoosingExchange) {
        cardsToRender = [...myData.cards, ...state.exchangeCards]; // Mostra todas
    } else {
        cardsToRender = myData.cards;
    }

    let exchangeSelection = []; // indices selecionados para manter no embaixador

    cardsToRender.forEach((card, index) => {
        let cardDiv = document.createElement('div');
        cardDiv.className = `card ${card}`;
        cardDiv.innerHTML = `<span>${card}</span>`;

        if (isChoosingLoss) {
            cardDiv.classList.add('clickable');
            cardDiv.onclick = () => {
                socket.emit('lose_card', index);
            };
        } else if (isChoosingExchange) {
            cardDiv.classList.add('clickable');
            cardDiv.onclick = () => {
                let pos = exchangeSelection.indexOf(index);
                if (pos > -1) {
                    exchangeSelection.splice(pos, 1);
                    cardDiv.style.border = "3px solid #f1c40f"; // desmarca (amarelo padrão)
                } else {
                    if (exchangeSelection.length < myData.cards.length) {
                        exchangeSelection.push(index);
                        cardDiv.style.border = "5px solid #2ecc71"; // Marca verde
                    }
                }
                
                if (exchangeSelection.length === myData.cards.length) {
                    // Confirma automaticamente ou via botão, vou confirmar auto
                    setTimeout(() => {
                        if (confirm('Confirmar essas cartas?')) {
                            socket.emit('exchange_cards', exchangeSelection);
                        } else {
                            exchangeSelection = [];
                            renderGame(gameStateData); // reseta
                        }
                    }, 200);
                }
            };
        }

        myCardsContainer.appendChild(cardDiv);
    });

    // Status / Ações
    if (state.gameState === 'GAME_OVER') {
        gameStatus.innerText = "Fim de Jogo!";
        gameStatus.style.backgroundColor = "#27ae60";
        actionsPanel.classList.add('hidden');
        reactionPanel.classList.add('hidden');
        return;
    }

    if (isChoosingLoss) {
        gameStatus.innerText = state.pendingLossReason;
        gameStatus.style.backgroundColor = "#e74c3c";
        actionsPanel.classList.add('hidden');
        reactionPanel.classList.add('hidden');
    } else if (isChoosingExchange) {
        gameStatus.innerText = "Escolha as cartas para manter.";
        gameStatus.style.backgroundColor = "#f39c12";
        actionsPanel.classList.add('hidden');
        reactionPanel.classList.add('hidden');
    } else if (state.pendingAction) {
        actionsPanel.classList.add('hidden');
        reactionPanel.classList.remove('hidden');
        
        // Setup reaction panel
        let action = state.pendingAction;
        
        let actionDesc = '';
        if (action.type === 'action') {
            actionDesc = `${action.player} declarou ${action.character}`;
            if (action.target) actionDesc += ` contra ${action.target}`;
        } else {
            actionDesc = `${action.player} quer bloquear com ${action.character}`;
        }
        
        reactionText.innerText = actionDesc;
        reactionButtons.innerHTML = '';

        if (action.player !== myName && myData.isAlive) {
            // Eu posso reagir!
            reactionButtons.innerHTML += `<button onclick="doubt()">Duvidar!</button>`;
            reactionButtons.innerHTML += `<button onclick="pass()">Passar</button>`;
            
            // Lógica de bloqueio: só o alvo pode bloquear (para simplificar)
            // Assassino: alvo pode bloquear com condessa
            if (action.type === 'action' && action.target === myName) {
                if (action.actionName === 'assassin') {
                    reactionButtons.innerHTML += `<button onclick="block('Condessa')">Bloquear com Condessa</button>`;
                } else if (action.actionName === 'captain') {
                    reactionButtons.innerHTML += `<button onclick="block('Capitão')">Bloquear com Capitão</button>`;
                    reactionButtons.innerHTML += `<button onclick="block('Embaixador')">Bloquear com Embaixador</button>`;
                }
            }
        } else {
            reactionButtons.innerHTML = `<p>Aguardando reação dos outros jogadores...</p>`;
        }

        gameStatus.innerText = "Ação Pendente!";
        gameStatus.style.backgroundColor = "#e67e22";

    } else {
        reactionPanel.classList.add('hidden');
        
        if (state.turnOf === myName && myData.isAlive) {
            gameStatus.innerText = "Sua vez de jogar!";
            gameStatus.style.backgroundColor = "#27ae60";
            actionsPanel.classList.remove('hidden');
            
            // Desabilita botões se moedas < custo
            document.querySelector('.btn-assassino').disabled = myData.coins < 3;

        } else {
            gameStatus.innerText = `Aguardando a jogada de ${state.turnOf}...`;
            gameStatus.style.backgroundColor = "#2c3e50";
            actionsPanel.classList.add('hidden');
        }
    }
}

function updateSelect(selectEl, optionsArray) {
    let currentVal = selectEl.value;
    selectEl.innerHTML = '';
    optionsArray.forEach(opt => {
        let option = document.createElement('option');
        option.value = opt;
        option.innerText = opt;
        selectEl.appendChild(option);
    });
    if (optionsArray.includes(currentVal)) {
        selectEl.value = currentVal;
    }
}
