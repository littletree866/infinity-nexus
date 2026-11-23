let balance = 1000;
let pot = 0;
let currentBetSize = 100;        
let playerBetPlaced = 0;
let dealerBet = 0;
let stage = 0;                   
let gamesPlayed = 0;
let gamesWon = 0;

let deck = [];
let playerHand = [];
let dealerHand = [];
let community = [];

let gameActive = true;            
let playerFolded = false;

const bankSpan = document.getElementById('bankAmount');
const potSpan = document.getElementById('potAmount');
const currentBetSpan = document.getElementById('currentBetDisplay');
const dealerCardsDiv = document.getElementById('dealerCards');
const playerCardsDiv = document.getElementById('playerCards');
const communityDiv = document.getElementById('communityCards');
const playerStrengthSpan = document.getElementById('playerStrengthLabel');
const dealerStrengthSpan = document.getElementById('dealerStrengthLabel');
const betAction = document.getElementById('betActionBtn');
const callAction = document.getElementById('callActionBtn');
const raiseAction = document.getElementById('raiseActionBtn');
const checkAction = document.getElementById('checkActionBtn');
const foldAction = document.getElementById('foldActionBtn');
const newGameBtn = document.getElementById('newGameBtn');

function buildDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let newDeck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            newDeck.push({ rank, suit, color: (suit === '♥' || suit === '♦') ? 'red' : 'black' });
        }
    }
    return shuffle(newDeck);
}
function shuffle(deckArr) {
    for (let i = deckArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckArr[i], deckArr[j]] = [deckArr[j], deckArr[i]];
    }
    return deckArr;
}

function drawCards(n) {
    return deck.splice(0, n);
}

function renderCard(card, hidden = false) {
    const div = document.createElement('div');
    div.className = 'playing-card';
    if (hidden) {
        div.classList.add('card-back');
        div.innerHTML = '<div class="poker-card-back">🂠</div>';
        return div;
    }
    div.classList.add(card.color);
    div.innerHTML = `
        <div class="card-rank">${card.rank}</div>
        <div class="card-suit">${card.suit}</div>
    `;
    return div;
}

function updateUI() {
    bankSpan.innerText = Math.floor(balance);
    potSpan.innerText = pot;
    currentBetSpan.innerText = currentBetSize;
    communityDiv.innerHTML = '';
    community.forEach(c => communityDiv.appendChild(renderCard(c, false)));
    playerCardsDiv.innerHTML = '';
    playerHand.forEach(c => playerCardsDiv.appendChild(renderCard(c, false)));
    dealerCardsDiv.innerHTML = '';
    dealerHand.forEach((c, idx) => {
        if (stage < 4 && !playerFolded && gameActive && idx === 1) {
            dealerCardsDiv.appendChild(renderCard(c, true));
        } else {
            dealerCardsDiv.appendChild(renderCard(c, false));
        }
    });
    document.querySelectorAll('.stage').forEach(el => {
        const s = parseInt(el.dataset.stage);
        if (s === stage) el.classList.add('active');
        else el.classList.remove('active');
    });
    if (stage > 0 && !playerFolded && gameActive) {
        const playerEval = evaluateBestHand([...playerHand, ...community]);
        playerStrengthSpan.innerText = playerEval.name;
        if (stage === 4 || !gameActive) {
            const dealerEval = evaluateBestHand([...dealerHand, ...community]);
            dealerStrengthSpan.innerText = dealerEval.name;
        } else {
            dealerStrengthSpan.innerText = '??';
        }
    } else {
        if (playerFolded) playerStrengthSpan.innerText = 'FOLDED';
        else if (stage === 0) playerStrengthSpan.innerText = 'Waiting';
    }
    if (stage === 4 || !gameActive) {
        const dealerEval = evaluateBestHand([...dealerHand, ...community]);
        dealerStrengthSpan.innerText = dealerEval.name;
    }
}

function evaluateBestHand(cards) {
    if (cards.length < 5) return { rank: 0, name: 'High Card', score: 0 };
    const allCombos = getCombinations(cards, 5);
    let bestRank = -1;
    let bestScore = 0;
    for (let combo of allCombos) {
        const result = evaluateFiveCards(combo);
        if (result.rank > bestRank || (result.rank === bestRank && result.score > bestScore)) {
            bestRank = result.rank;
            bestScore = result.score;
        }
    }
    const names = ['High Card', 'One Pair', 'Two Pair', 'Three of Kind', 'Straight', 'Flush', 'Full House', 'Four of Kind', 'Straight Flush', 'Royal Flush'];
    return { rank: bestRank, name: names[bestRank], score: bestScore };
}

function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    const combosWithFirst = getCombinations(rest, k-1).map(c => [first, ...c]);
    const combosWithoutFirst = getCombinations(rest, k);
    return [...combosWithFirst, ...combosWithoutFirst];
}

function evaluateFiveCards(cards) {
    const rankMap = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
    const values = cards.map(c => rankMap[c.rank]).sort((a,b)=>a-b);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);
    let isStraight = false;
    let straightHigh = 0;
    let uniqueVals = [...new Set(values)];
    if (uniqueVals.length >=5) {
        for (let i=0; i<=uniqueVals.length-5; i++) {
            if (uniqueVals[i+4] - uniqueVals[i] === 4) { isStraight=true; straightHigh=uniqueVals[i+4]; break; }
        }
        if (!isStraight && uniqueVals.includes(14) && uniqueVals.includes(2) && uniqueVals.includes(3) && uniqueVals.includes(4) && uniqueVals.includes(5)) {
            isStraight = true;
            straightHigh = 5;
        }
    }
    const valueCounts = {};
    values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
    const counts = Object.values(valueCounts).sort((a,b)=>b-a);
    const hasFour = counts[0] === 4;
    const hasThree = counts[0] === 3;
    const hasPair = counts[0] === 2;
    const twoPair = counts[0] === 2 && counts[1] === 2;
    const fullHouse = hasThree && counts[1] === 2;

    if (isStraight && isFlush && straightHigh === 14) return { rank: 9, score: 1000, name:'Royal Flush' };
    if (isStraight && isFlush) return { rank: 8, score: 900 + straightHigh };
    if (hasFour) return { rank: 7, score: 800 };
    if (fullHouse) return { rank: 6, score: 700 };
    if (isFlush) return { rank: 5, score: 600 };
    if (isStraight) return { rank: 4, score: 500 + straightHigh };
    if (hasThree) return { rank: 3, score: 400 };
    if (twoPair) return { rank: 2, score: 300 };
    if (hasPair) return { rank: 1, score: 200 };
    return { rank: 0, score: Math.max(...values) };
}

function advanceStage() {
    if (!gameActive || playerFolded) return;
    
    setTimeout(() => {
        if (!gameActive) return;
        
        const dealerStrength = Math.random();
        
        if (dealerStrength < 0.25) {
            gameActive = false;
            gamesPlayed++;
            gamesWon++;
            balance += pot;
            const winAmount = pot;
            showResultModal(true, false, `Dealer folded! +${winAmount} chips.`, 'Dealer Fold', 'N/A');
            pot = 0;
            updateUI();
            adjustButtons();
            return;
        }
        
        if (stage === 0) {
            community = drawCards(3);
            stage = 1;
        } else if (stage === 1) {
            community.push(...drawCards(1));
            stage = 2;
        } else if (stage === 2) {
            community.push(...drawCards(1));
            stage = 3;
        } else if (stage === 3) {
            stage = 4;
            showdown();
            return;
        }
        updateUI();
        adjustButtons();
    }, 500);
}

function showdown() {
    if (!gameActive && playerFolded) return;
    const playerEval = evaluateBestHand([...playerHand, ...community]);
    const dealerEval = evaluateBestHand([...dealerHand, ...community]);
    let resultMsg = '';
    let win = false;
    let tie = false;
    if (playerEval.rank > dealerEval.rank) win = true;
    else if (playerEval.rank < dealerEval.rank) win = false;
    else {
        if (playerEval.score > dealerEval.score) win = true;
        else if (playerEval.score < dealerEval.score) win = false;
        else tie = true;
    }
    if (tie) {
        const split = pot / 2;
        balance += split;
        resultMsg = `TIE! Split pot: +${Math.floor(split)} chips.`;
        gamesPlayed++;
    } else if (win) {
        balance += pot;
        gamesWon++;
        gamesPlayed++;
        resultMsg = `YOU WIN! +${pot} chips with ${playerEval.name}!`;
    } else {
        gamesPlayed++;
        resultMsg = `Dealer wins with ${dealerEval.name}. You lose ${pot - (playerBetPlaced+dealerBet)} chips.`;
    }
    if (!tie && win) pot = 0;
    else if (!tie && !win) pot = 0;
    else pot = 0;
    updateUI();
    showResultModal(win, tie, resultMsg, playerEval.name, dealerEval.name);
    gameActive = false;
    adjustButtons();
}

function showResultModal(isWin, isTie, msg, playerHandName, dealerHandName) {
    const modal = document.getElementById('resultModal');
    document.getElementById('resultTitle').innerHTML = isWin ? '🏆 VICTORY!' : (isTie ? '🤝 PUSH' : '💀 DEFEAT');
    document.getElementById('resultMessage').innerText = msg;
    document.getElementById('playerHandRank').innerText = playerHandName;
    document.getElementById('dealerHandRank').innerText = dealerHandName;
    modal.classList.add('show');
}

function placeBet() {
    if (!gameActive || playerFolded || stage > 0) return;
    if (balance < currentBetSize) { alert('Insufficient chips!'); return; }
    balance -= currentBetSize;
    playerBetPlaced = currentBetSize;
    pot += currentBetSize;
    updateUI();
    advanceStage();
}
function callActionFunc() {
    if (!gameActive || playerFolded) return;
    if (balance < currentBetSize) { alert('Cannot call'); return; }
    balance -= currentBetSize;
    pot += currentBetSize;
    updateUI();
    advanceStage();
}
function raiseActionFunc() {
    if (!gameActive || playerFolded) return;
    let raiseAmount = currentBetSize * 2;
    if (balance < raiseAmount) { alert('Not enough for raise'); return; }
    balance -= raiseAmount;
    pot += raiseAmount;
    currentBetSize = raiseAmount;
    updateUI();
    advanceStage();
}
function checkActionFunc() {
    if (!gameActive || playerFolded) return;
    advanceStage();
}
function foldActionFunc() {
    if (!gameActive) return;
    playerFolded = true;
    gameActive = false;
    gamesPlayed++;
    balance += dealerBet;  
    const lossAmount = playerBetPlaced - dealerBet;
    showResultModal(false, false, `You folded. Lost ${Math.max(0, lossAmount)} chips.`, 'Fold', 'N/A');
    pot = 0;
    updateUI();
    adjustButtons();
}

function newGameReset() {
    balance = 1000;
    pot = 0;
    currentBetSize = 100;
    playerBetPlaced = 0;
    dealerBet = 0;
    stage = 0;
    gameActive = true;
    playerFolded = false;
    deck = buildDeck();
    playerHand = drawCards(2);
    dealerHand = drawCards(2);
    community = [];
    updateUI();
    adjustButtons();
    const modal = document.getElementById('resultModal');
    modal.classList.remove('show');
}

function adjustButtons() {
    if (!gameActive || playerFolded || stage === 4) {
        betAction.style.display = 'none';
        callAction.style.display = 'none';
        raiseAction.style.display = 'none';
        checkAction.style.display = 'none';
        foldAction.style.display = 'none';
        newGameBtn.style.display = 'flex';
        return;
    }
    newGameBtn.style.display = 'none';
    if (stage === 0) {
        betAction.style.display = 'flex';
        callAction.style.display = 'none';
        raiseAction.style.display = 'none';
        checkAction.style.display = 'flex';
        foldAction.style.display = 'flex';
    } else {
        betAction.style.display = 'none';
        callAction.style.display = 'flex';
        raiseAction.style.display = 'flex';
        checkAction.style.display = 'flex';
        foldAction.style.display = 'flex';
    }
}

function init() {
    newGameReset();
    document.getElementById('betActionBtn').onclick = placeBet;
    document.getElementById('callActionBtn').onclick = callActionFunc;
    document.getElementById('raiseActionBtn').onclick = raiseActionFunc;
    document.getElementById('checkActionBtn').onclick = checkActionFunc;
    document.getElementById('foldActionBtn').onclick = foldActionFunc;
    document.getElementById('newGameBtn').onclick = newGameReset;
    document.getElementById('closeModalBtn').onclick = () => {
        document.getElementById('resultModal').classList.remove('show');
        if (!gameActive && stage === 4) newGameReset();
    };
    document.querySelectorAll('.bet-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.bet-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentBetSize = parseInt(chip.dataset.bet);
            updateUI();
        });
    });
    window.addEventListener('keydown', (e) => {
        if (document.getElementById('resultModal').classList.contains('show')) {
            if (e.key === 'Enter') document.getElementById('closeModalBtn').click();
            return;
        }
        const key = e.key.toLowerCase();
        if (key === 'b') document.getElementById('betActionBtn').click();
        else if (key === 'c') document.getElementById('callActionBtn').click();
        else if (key === 'r') document.getElementById('raiseActionBtn').click();
        else if (key === 'k') document.getElementById('checkActionBtn').click();
        else if (key === 'f') document.getElementById('foldActionBtn').click();
        else if (key === '1') { document.querySelector('.bet-chip[data-bet="100"]').click(); }
        else if (key === '2') { document.querySelector('.bet-chip[data-bet="250"]').click(); }
        else if (key === '3') { document.querySelector('.bet-chip[data-bet="500"]').click(); }
    });
}

init();