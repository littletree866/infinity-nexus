let balance = 1000;
let currentBet = 0;
let playerCards = [];
let dealerCards = [];
let gameActive = false;     // game in progress (hitting/standing)
let dealerRevealed = false;
let deck = [];
let cardsUsed = 0;

const balanceSpan = document.getElementById('balanceValue');
const betSpan = document.getElementById('betAmount');
const dealerScoreSpan = document.getElementById('dealerScore');
const playerScoreSpan = document.getElementById('playerScore');
const dealerCardCount = document.getElementById('dealerCardCount');
const playerCardCount = document.getElementById('playerCardCount');
const dealerContainer = document.getElementById('dealerHandContainer');
const playerContainer = document.getElementById('playerHandContainer');
const resultBox = document.getElementById('resultBox');
const hitBtn = document.getElementById('hitActionBtn');
const standBtn = document.getElementById('standActionBtn');
const newRoundBtn = document.getElementById('newRoundBtn');
const dealBtn = document.getElementById('dealGameBtn');
const clearBetBtn = document.getElementById('clearBetBtn');
const gameStateLabel = document.getElementById('gameStateLabel');
const chipElements = document.querySelectorAll('.chip');

const suits = ['♥', '♦', '♠', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function initializeDeck() {
    deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ rank, suit });
        }
    }
    shuffleDeck();
    cardsUsed = 0;
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function getRandomCard() {
    if (cardsUsed >= 52) {
        initializeDeck();
    }
    const card = deck[cardsUsed];
    cardsUsed++;
    return card;
}

function computeHandTotal(hand) {
    let sum = 0;
    let aces = 0;
    for (let card of hand) {
        if (card.rank === 'A') {
            aces++;
            sum += 11;
        } else if (['K', 'Q', 'J'].includes(card.rank)) {
            sum += 10;
        } else {
            sum += parseInt(card.rank);
        }
    }
    while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
    }
    return sum;
}

function renderCardElement(card, hidden = false) {
    const div = document.createElement('div');
    div.className = 'card';
    if (hidden) {
        div.classList.add('card-back');
        div.innerHTML = `<div class="card-back-symbol">🂠</div>`;
        return div;
    }
    const isRed = card.suit === '♥' || card.suit === '♦';
    div.setAttribute('data-suit', card.suit);
    let rankDisplay = card.rank;
    if (card.rank === 'A') rankDisplay = 'A';
    else if (card.rank === 'J') rankDisplay = 'J';
    else if (card.rank === 'Q') rankDisplay = 'Q';
    else if (card.rank === 'K') rankDisplay = 'K';
    div.innerHTML = `
        <div class="corner corner-top">${rankDisplay}<br>${card.suit}</div>
        <div class="card-suit-large">${card.suit}</div>
        <div class="corner corner-bottom">${rankDisplay}<br>${card.suit}</div>
    `;
    if (isRed) div.style.color = '#c33';
    return div;
}

function updateUI() {
    balanceSpan.innerText = Math.floor(balance);
    betSpan.innerText = currentBet;
    playerContainer.innerHTML = '';
    playerCards.forEach(card => {
        playerContainer.appendChild(renderCardElement(card, false));
    });
    dealerContainer.innerHTML = '';
    dealerCards.forEach((card, idx) => {
        if (!dealerRevealed && idx === 1 && gameActive) {
            dealerContainer.appendChild(renderCardElement(card, true));
        } else {
            dealerContainer.appendChild(renderCardElement(card, false));
        }
    });
    const playerTotal = computeHandTotal(playerCards);
    playerScoreSpan.innerText = playerTotal;
    playerCardCount.innerText = playerCards.length + ' card' + (playerCards.length !== 1 ? 's' : '');
    
    if (dealerRevealed || !gameActive) {
        const dealerTotal = computeHandTotal(dealerCards);
        dealerScoreSpan.innerText = dealerTotal;
    } else {
        if (dealerCards.length > 0) {
            const firstCardTotal = computeHandTotal([dealerCards[0]]);
            dealerScoreSpan.innerText = firstCardTotal;
        } else {
            dealerScoreSpan.innerText = '?';
        }
    }
    dealerCardCount.innerText = dealerCards.length + ' card' + (dealerCards.length !== 1 ? 's' : '');
    chipElements.forEach(chip => {
        const betVal = parseInt(chip.getAttribute('data-bet'));
        chip.style.opacity = (gameActive || balance < betVal) ? '0.5' : '1';
        chip.disabled = gameActive || balance < betVal;
    });
    dealBtn.disabled = gameActive || currentBet === 0 || balance < currentBet;
    clearBetBtn.disabled = gameActive;
    if (!gameActive) {
        hitBtn.style.display = 'none';
        standBtn.style.display = 'none';
    }
}

function setGameStatusMessage(text, type = '') {
    resultBox.innerHTML = `<div class="result-message ${type}">${text}</div>`;
}

function clearMessage() {
    resultBox.innerHTML = '';
}

function resetGameUIForNewRound() {
    gameActive = false;
    dealerRevealed = false;
    playerCards = [];
    dealerCards = [];
    hitBtn.style.display = 'none';
    standBtn.style.display = 'none';
    newRoundBtn.style.display = 'none';
    dealBtn.style.display = 'inline-block';
    clearBetBtn.style.display = 'inline-block';
    gameStateLabel.innerText = '● Ready';
    gameStateLabel.style.color = '#9aff9e';
    clearMessage();
    updateUI();
}

function endGame(outcome, message, payoutModifier = 1, winAmountAdjust = 0) {
    gameActive = false;
    dealerRevealed = true;
    if (outcome === 'win') {
        let winnings = currentBet * payoutModifier;
        if (winAmountAdjust) winnings = winAmountAdjust;
        balance += winnings * 2; // return original bet + winnings
        setGameStatusMessage(`${message}  +$${winnings} `, 'win-message');
    } else if (outcome === 'lose') {
        setGameStatusMessage(`${message}  -$${currentBet} `, 'lose-message');
    } else if (outcome === 'push') {
        balance += currentBet; // return bet
        setGameStatusMessage(`${message}  Bet returned`, 'push-message');
    }
    gameStateLabel.innerText = '● Game over';
    gameStateLabel.style.color = '#ffaa66';
    saveBalanceToLocal();
    updateUI();
    hitBtn.style.display = 'none';
    standBtn.style.display = 'none';
    newRoundBtn.style.display = 'inline-block';
    dealBtn.style.display = 'none';
    clearBetBtn.style.display = 'none';
}

function checkNaturalBlackjack() {
    const playerTotal = computeHandTotal(playerCards);
    if (playerTotal === 21 && playerCards.length === 2) {
        dealerRevealed = true;
        const dealerTotal = computeHandTotal(dealerCards);
        if (dealerTotal === 21 && dealerCards.length === 2) {
            endGame('push', "Blackjack push! Both have 21.", 0);
        } else {
            const blackjackPayout = Math.floor(currentBet * 1.5);
            endGame('win', "Blackjack! Instant royale victory!", 1.5, blackjackPayout);
        }
        return true;
    }
    return false;
}

function dealerTurn() {
    dealerRevealed = true;
    updateUI();
    let dealerTotal = computeHandTotal(dealerCards);
    const interval = setInterval(() => {
        dealerTotal = computeHandTotal(dealerCards);
        if (dealerTotal < 17) {
            dealerCards.push(getRandomCard());
            updateUI();
        } else {
            clearInterval(interval);
            finalizeGameResult();
        }
    }, 380);
}

function finalizeGameResult() {
    const playerScore = computeHandTotal(playerCards);
    const dealerScore = computeHandTotal(dealerCards);
    if (playerScore > 21) {
        endGame('lose', `Bust! You went over 21. Dealer wins.`, 0);
    } else if (dealerScore > 21) {
        endGame('win', `Dealer busts! You win!`, 1);
    } else if (playerScore > dealerScore) {
        endGame('win', `You win! ${playerScore} vs ${dealerScore}`, 1);
    } else if (playerScore < dealerScore) {
        endGame('lose', `Dealer wins! ${dealerScore} vs ${playerScore}`, 0);
    } else {
        endGame('push', `Push! Both have ${playerScore}`, 0);
    }
    updateUI();
}

function startGame() {
    if (currentBet <= 0 || balance < currentBet) return;
    gameActive = true;
    dealerRevealed = false;
    balance -= currentBet;
    updateUI();
    playerCards = [getRandomCard(), getRandomCard()];
    dealerCards = [getRandomCard(), getRandomCard()];
    clearMessage();
    hitBtn.style.display = 'inline-block';
    standBtn.style.display = 'inline-block';
    newRoundBtn.style.display = 'none';
    gameStateLabel.innerText = '● In play';
    gameStateLabel.style.color = '#ffd966';
    updateUI();
    const hasBJ = checkNaturalBlackjack();
    if (hasBJ) {
        gameActive = false;
        updateUI();
        return;
    }
    if (computeHandTotal(playerCards) === 21) {
        dealerTurn();
    }
}

function playerHit() {
    if (!gameActive) return;
    playerCards.push(getRandomCard());
    updateUI();
    const playerTotal = computeHandTotal(playerCards);
    if (playerTotal > 21) {
        dealerRevealed = true;
        updateUI();
        endGame('lose', `Bust! You exceeded 21.`, 0);
    }
}

function playerStand() {
    if (!gameActive) return;
    dealerTurn();
}

function newRound() {
    if (gameActive) return;
    playerCards = [];
    dealerCards = [];
    gameActive = false;
    dealerRevealed = false;
    currentBet = 0;
    hitBtn.style.display = 'none';
    standBtn.style.display = 'none';
    newRoundBtn.style.display = 'none';
    dealBtn.style.display = 'inline-block';
    clearBetBtn.style.display = 'inline-block';
    gameStateLabel.innerText = '● Ready';
    gameStateLabel.style.color = '#9aff9e';
    clearMessage();
    updateUI();
    saveBalanceToLocal();
}

function setBet(amount) {
    if (gameActive) return;
    if (balance >= amount) {
        currentBet = amount;
        updateUI();
    } else {
        setGameStatusMessage("Insufficient balance!", 'lose-message');
        setTimeout(() => clearMessage(), 1200);
    }
}

function clearBet() {
    if (!gameActive) {
        currentBet = 0;
        updateUI();
    }
}

function saveBalanceToLocal() {
    localStorage.setItem('blackjack_royale_balance', Math.floor(balance));
}

function loadBalance() {
    const saved = localStorage.getItem('blackjack_royale_balance');
    if (saved && !isNaN(parseInt(saved))) {
        balance = parseInt(saved);
        if (balance <= 0) balance = 1000;
    } else {
        balance = 1000;
    }
    updateUI();
}

chipElements.forEach(chip => {
    chip.addEventListener('click', () => {
        const val = parseInt(chip.getAttribute('data-bet'));
        setBet(val);
    });
});
clearBetBtn.addEventListener('click', clearBet);
dealBtn.addEventListener('click', startGame);
hitBtn.addEventListener('click', playerHit);
standBtn.addEventListener('click', playerStand);
newRoundBtn.addEventListener('click', newRound);

initializeDeck();
loadBalance();
resetGameUIForNewRound();
updateUI();