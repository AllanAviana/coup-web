const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Estado do Jogo
const ALLOWED_NAMES = ['Allan', 'Daniel', 'Gustavo'];
const CARDS = ['Duque', 'Condessa', 'Capitão', 'Assassino', 'Embaixador'];

let players = {}; // name -> { socketId, cards: [], coins: 2, isAlive: true, isConnected: true }
let turnOrder = [];
let currentIndex = 0;
let deck = [];
let gameState = 'LOBBY'; // LOBBY, PLAYING, GAME_OVER

let pendingAction = null; 
// Estrutura de pendingAction:
// {
//   type: 'action' | 'block',
//   character: string, // o personagem sendo declarado (ex: Duque, Assassino, Condessa)
//   actionName: string, // 'duke', 'assassin', etc
//   player: string, // quem está jogando/bloqueando
//   target: string | null, // alvo da ação
//   passCount: 0,
//   doubters: []
// }

let pendingLoss = null; // { player: string, reason: string, callback: function }
let pendingExchange = null; // { player: string, drawnCards: [] }
let originalAction = null; // Guarda a ação original se estivermos resolvendo um bloqueio

function initDeck() {
    deck = [];
    for (let c of CARDS) {
        deck.push(c, c, c); // 3 de cada
    }
    deck = deck.sort(() => Math.random() - 0.5);
}

function distributeInitial() {
    initDeck();
    turnOrder = Object.keys(players).filter(p => players[p].isConnected);
    turnOrder = turnOrder.sort(() => Math.random() - 0.5);
    currentIndex = 0;

    for (let p of turnOrder) {
        players[p].cards = [deck.pop(), deck.pop()];
        players[p].coins = 2;
        players[p].isAlive = true;
    }
}

function getPrivateState(playerName) {
    const state = {
        gameState,
        players: {},
        turnOf: turnOrder[currentIndex],
        pendingAction,
        pendingLoss: pendingLoss ? pendingLoss.player : null,
        pendingLossReason: pendingLoss ? pendingLoss.reason : null,
        pendingExchange: pendingExchange ? pendingExchange.player : null,
        exchangeCards: (pendingExchange && pendingExchange.player === playerName) ? pendingExchange.drawnCards : null
    };

    for (let p in players) {
        state.players[p] = {
            coins: players[p].coins,
            cardCount: players[p].cards.length,
            isAlive: players[p].isAlive,
            isConnected: players[p].isConnected,
            cards: p === playerName ? players[p].cards : [] // Só vê as próprias cartas
        };
    }
    return state;
}

function broadcastState() {
    for (let p in players) {
        if (players[p].isConnected) {
            io.to(players[p].socketId).emit('update_state', getPrivateState(p));
        }
    }
}

function logToAll(msg) {
    io.emit('game_log', msg);
}

function nextTurn() {
    pendingAction = null;
    originalAction = null;
    
    // Verifica fim de jogo
    const alive = turnOrder.filter(p => players[p].isAlive);
    if (alive.length === 1) {
        gameState = 'GAME_OVER';
        logToAll(`Fim de Jogo! ${alive[0]} venceu!`);
        broadcastState();
        return;
    }

    do {
        currentIndex = (currentIndex + 1) % turnOrder.length;
    } while (!players[turnOrder[currentIndex]].isAlive);

    logToAll(`É a vez de ${turnOrder[currentIndex]}.`);
    broadcastState();
}

function executeAction(actionObj) {
    const { actionName, player, target } = actionObj;
    let pObj = players[player];
    
    if (actionName === 'income') {
        pObj.coins += 1;
        logToAll(`${player} pegou 1 moeda de Renda.`);
        nextTurn();
    } else if (actionName === 'duke') {
        pObj.coins += 3;
        logToAll(`${player} pegou 3 moedas como Duque.`);
        nextTurn();
    } else if (actionName === 'captain') {
        let tObj = players[target];
        let stolen = Math.min(2, tObj.coins);
        tObj.coins -= stolen;
        pObj.coins += stolen;
        logToAll(`${player} roubou ${stolen} moedas de ${target} como Capitão.`);
        nextTurn();
    } else if (actionName === 'assassin') {
        logToAll(`${player} executou o assassinato de ${target}!`);
        requireInfluenceLoss(target, "Você foi assassinado. Escolha uma influência para perder.", nextTurn);
    } else if (actionName === 'ambassador') {
        let drawn = [deck.pop(), deck.pop()];
        logToAll(`${player} está trocando cartas como Embaixador...`);
        pendingExchange = { player, drawnCards: drawn };
        broadcastState();
    }
}

function requireInfluenceLoss(playerName, reason, callback) {
    if (!players[playerName].isAlive) {
        callback();
        return;
    }
    if (players[playerName].cards.length === 0) {
        players[playerName].isAlive = false;
        callback();
        return;
    }
    pendingLoss = { player: playerName, reason, callback };
    logToAll(`${playerName} precisa perder uma influência!`);
    broadcastState();
}


io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('login', (name) => {
        if (!ALLOWED_NAMES.includes(name)) {
            socket.emit('login_error', 'Nome não permitido. Use Allan, Daniel ou Gustavo.');
            return;
        }
        if (players[name] && players[name].isConnected) {
            socket.emit('login_error', 'Este jogador já está conectado.');
            return;
        }

        currentUser = name;
        if (!players[name]) {
            players[name] = { socketId: socket.id, cards: [], coins: 0, isAlive: false, isConnected: true };
        } else {
            players[name].socketId = socket.id;
            players[name].isConnected = true;
        }

        socket.emit('login_success', name);
        logToAll(`${name} entrou na sala.`);
        broadcastState();
    });

    socket.on('start_game', () => {
        if (gameState === 'PLAYING') return;
        const onlineCount = Object.values(players).filter(p => p.isConnected).length;
        if (onlineCount < 2) {
            socket.emit('action_error', 'É necessário pelo menos 2 jogadores para iniciar.');
            return;
        }
        gameState = 'PLAYING';
        distributeInitial();
        logToAll('O jogo começou!');
        logToAll(`É a vez de ${turnOrder[currentIndex]}.`);
        broadcastState();
    });

    socket.on('play_action', (data) => {
        const { actionName, target } = data;
        if (gameState !== 'PLAYING' || turnOrder[currentIndex] !== currentUser || pendingAction || pendingLoss || pendingExchange) {
            socket.emit('action_error', 'Não é possível fazer isso agora.');
            return;
        }

        // Renda não pode ser duvidada
        if (actionName === 'income') {
            executeAction({ actionName, player: currentUser, target: null });
            return;
        }

        let character = '';
        if (actionName === 'duke') character = 'Duque';
        if (actionName === 'captain') {
            character = 'Capitão';
            if (target === currentUser || !players[target] || !players[target].isAlive) {
                socket.emit('action_error', 'Alvo inválido.');
                return;
            }
        }
        if (actionName === 'assassin') {
            character = 'Assassino';
            if (players[currentUser].coins < 3) {
                socket.emit('action_error', 'Moedas insuficientes para Assassinar (custa 3).');
                return;
            }
            if (target === currentUser || !players[target] || !players[target].isAlive) {
                socket.emit('action_error', 'Alvo inválido.');
                return;
            }
            players[currentUser].coins -= 3; // Paga imediatamente
        }
        if (actionName === 'ambassador') character = 'Embaixador';

        pendingAction = {
            type: 'action',
            character,
            actionName,
            player: currentUser,
            target,
            passCount: 0
        };

        logToAll(`${currentUser} declarou ação de ${character}${target ? ' contra ' + target : ''}.`);
        broadcastState();
    });

    socket.on('doubt', () => {
        if (!pendingAction || pendingAction.player === currentUser || !players[currentUser].isAlive) return;

        logToAll(`${currentUser} duvidou de ${pendingAction.player}!`);
        
        let claimsChar = pendingAction.character;
        let playedPlayer = pendingAction.player;
        let pObj = players[playedPlayer];
        
        // Verifica se o jogador possui a carta
        let hasCard = pObj.cards.includes(claimsChar);

        if (hasCard) {
            logToAll(`${playedPlayer} REALMENTE tinha ${claimsChar}!`);
            // Troca a carta
            pObj.cards.splice(pObj.cards.indexOf(claimsChar), 1);
            deck.push(claimsChar);
            deck = deck.sort(() => Math.random() - 0.5);
            pObj.cards.push(deck.pop());

            // Quem duvidou perde influência
            requireInfluenceLoss(currentUser, `Você duvidou errado de ${playedPlayer}. Perca uma influência.`, () => {
                // Depois que perder influência, a ação (ou bloqueio) executa
                if (pendingAction.type === 'action') {
                    executeAction(pendingAction);
                } else if (pendingAction.type === 'block') {
                    logToAll(`Bloqueio de ${pendingAction.player} foi bem sucedido!`);
                    nextTurn(); // A ação original é cancelada
                }
            });

        } else {
            logToAll(`${playedPlayer} ESTAVA MENTINDO sobre ${claimsChar}!`);
            
            // Quem mentiu perde influência
            requireInfluenceLoss(playedPlayer, `Você foi pego mentindo sobre ${claimsChar}. Perca uma influência.`, () => {
                // Ação ou bloqueio falha
                if (pendingAction.type === 'action') {
                    // Se era assassino e falhou, ele já gastou os 3 coins. Apenas passa o turno.
                    logToAll(`A ação de ${pendingAction.player} falhou.`);
                    nextTurn();
                } else if (pendingAction.type === 'block') {
                    // Bloqueio falhou! Executa a ação original.
                    logToAll(`O bloqueio falhou. A ação original prossegue.`);
                    executeAction(originalAction);
                }
            });
        }
    });

    socket.on('block', (data) => {
        // Ex: Bloquear assassino com Condessa
        if (!pendingAction || pendingAction.type !== 'action') return;
        const { blockChar } = data; // 'Condessa', 'Capitão' etc

        if (pendingAction.actionName === 'assassin' && pendingAction.target === currentUser && blockChar === 'Condessa') {
            logToAll(`${currentUser} declarou bloqueio com Condessa!`);
            originalAction = pendingAction;
            pendingAction = {
                type: 'block',
                character: 'Condessa',
                actionName: 'block_assassin',
                player: currentUser,
                target: originalAction.player,
                passCount: 0
            };
            broadcastState();
        } else if (pendingAction.actionName === 'captain' && pendingAction.target === currentUser && (blockChar === 'Capitão' || blockChar === 'Embaixador')) {
            logToAll(`${currentUser} declarou bloqueio com ${blockChar}!`);
            originalAction = pendingAction;
            pendingAction = {
                type: 'block',
                character: blockChar,
                actionName: 'block_captain',
                player: currentUser,
                target: originalAction.player,
                passCount: 0
            };
            broadcastState();
        }
    });

    socket.on('pass', () => {
        if (!pendingAction || pendingAction.player === currentUser || !players[currentUser].isAlive) return;

        pendingAction.passCount++;
        let aliveOthers = turnOrder.filter(p => players[p].isAlive && p !== pendingAction.player).length;

        // Se o alvo não bloqueou e passou (ou todos passaram se for ação global)
        if (pendingAction.passCount >= aliveOthers) {
            if (pendingAction.type === 'action') {
                executeAction(pendingAction);
            } else if (pendingAction.type === 'block') {
                logToAll(`Bloqueio de ${pendingAction.player} não foi contestado.`);
                nextTurn(); // Ação original cancelada
            }
        } else {
            // Apenas atualiza estado pra quem passou
            broadcastState();
        }
    });

    socket.on('lose_card', (cardIndex) => {
        if (!pendingLoss || pendingLoss.player !== currentUser) return;
        
        let pObj = players[currentUser];
        if (cardIndex < 0 || cardIndex >= pObj.cards.length) return;

        let lostCard = pObj.cards.splice(cardIndex, 1)[0];
        logToAll(`${currentUser} perdeu a influência: ${lostCard}`);
        
        if (pObj.cards.length === 0) {
            pObj.isAlive = false;
            logToAll(`${currentUser} foi ELIMINADO!`);
        }

        let callback = pendingLoss.callback;
        pendingLoss = null;
        callback();
    });

    socket.on('exchange_cards', (keepIndices) => {
        // Para o embaixador
        if (!pendingExchange || pendingExchange.player !== currentUser) return;
        let pObj = players[currentUser];
        
        // keepIndices é array com os índices das cartas que ele quer manter. 
        // Ex: Se tem 2 cartas + 2 draw = 4. keepIndices deve ter tamanho igual a pObj.cards.length
        let allCards = [...pObj.cards, ...pendingExchange.drawnCards];
        
        let newHand = [];
        let returnToDeck = [];
        
        for (let i = 0; i < allCards.length; i++) {
            if (keepIndices.includes(i) && newHand.length < pObj.cards.length) {
                newHand.push(allCards[i]);
            } else {
                returnToDeck.push(allCards[i]);
            }
        }
        
        pObj.cards = newHand;
        deck.push(...returnToDeck);
        deck = deck.sort(() => Math.random() - 0.5);

        logToAll(`${currentUser} finalizou a troca de cartas.`);
        pendingExchange = null;
        nextTurn();
    });

    socket.on('disconnect', () => {
        if (currentUser && players[currentUser]) {
            players[currentUser].isConnected = false;
            logToAll(`${currentUser} desconectou.`);
            broadcastState();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Para jogar, acesse http://localhost:${PORT} neste computador`);
    console.log(`Em outros computadores da rede local, digite o IP desta máquina seguido de :${PORT}`);
});
