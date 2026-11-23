let balance = 500;
let currentBet = 0;
let isRolling = false;
let gameActive = false;     

const balanceSpan = document.getElementById('balanceValue');
const betAmountSpan = document.getElementById('betAmount');
const betInput = document.getElementById('betInput');
const placeBetBtn = document.getElementById('placeBetBtn');
const clearBetBtn = document.getElementById('clearBetBtn');
const newGameBtn = document.getElementById('newGameBtn');
const diceContainer = document.getElementById('diceContainer');
const die1Elem = document.getElementById('die1');
const die2Elem = document.getElementById('die2');
const resultContainer = document.getElementById('resultContainer');

function updateDieUI(dieElement, value, highlightType = null) {
    const span = dieElement.querySelector('.die-value');
    if (value === null || value === undefined) {
        span.textContent = '🎲';
    } else {
        span.textContent = value;
    }
    dieElement.classList.remove('highlight-win', 'highlight-lose');
    if (highlightType === 'win') dieElement.classList.add('highlight-win');
    if (highlightType === 'lose') dieElement.classList.add('highlight-lose');
}

function resetDiceNeutral() {
    updateDieUI(die1Elem, null);
    updateDieUI(die2Elem, null);
    die1Elem.classList.remove('rolling-animation');
    die2Elem.classList.remove('rolling-animation');
}

function setDiceRolling(rolling) {
    if (rolling) {
        die1Elem.classList.add('rolling-animation');
        die2Elem.classList.add('rolling-animation');
        updateDieUI(die1Elem, '🎲');
        updateDieUI(die2Elem, '🎲');
    } else {
        die1Elem.classList.remove('rolling-animation');
        die2Elem.classList.remove('rolling-animation');
    }
}

function displayFinalRoll(val1, val2, highlightOutcome) {
    updateDieUI(die1Elem, val1, highlightOutcome);
    updateDieUI(die2Elem, val2, highlightOutcome);
}

function refreshUI() {
    balanceSpan.innerText = Math.floor(balance);
    betAmountSpan.innerText = currentBet;
    const canPlaceBet = (!isRolling && !gameActive && currentBet === 0 && balance > 0);
    placeBetBtn.disabled = !canPlaceBet;
    clearBetBtn.disabled = (gameActive || isRolling || currentBet === 0);
    betInput.disabled = (gameActive || isRolling);
    if (balance <= 0) {
        placeBetBtn.disabled = true;
        clearBetBtn.disabled = true;
        if (!resultContainer.innerHTML.includes('game over')) {
            showResultMessage('💀 Game over — Your soul is bankrupt 💀', 'lose');
        }
    }
}

function showResultMessage(message, type = 'neutral') {
    let resultDiv = document.createElement('div');
    resultDiv.className = 'result-card';
    if (type === 'win') resultDiv.classList.add('result-win');
    else if (type === 'lose') resultDiv.classList.add('result-lose');
    else resultDiv.classList.add('result-push');
    resultDiv.innerHTML = `<span class="dice-result-message">${message}</span>`;
    resultContainer.innerHTML = '';
    resultContainer.appendChild(resultDiv);
}

function clearResult() {
    resultContainer.innerHTML = '';
}

function evaluateRoll(total, roll1, roll2) {
    let outcomeType = '';
    let winnings = 0;
    let message = '';
    let highlightType = 'lose';

    if (total >= 13) {
        const profit = Math.floor(currentBet * 1.5);
        const totalReturn = currentBet + profit;
        balance += totalReturn;
        winnings = profit;
        outcomeType = 'win';
        message = `✨ High roll (${total})! You won +$${profit}! ✨`;
        highlightType = 'win';
    } 
    else if (total >= 10 && total <= 12) {
        const profit = currentBet;
        balance += currentBet + profit;
        winnings = profit;
        outcomeType = 'win';
        message = `🎲 Mid roll (${total})! You won +$${profit}! 🎲`;
        highlightType = 'win';
    }
    else if (total >= 7 && total <= 9) {
        message = `💀 Low roll (${total})! You lost $${currentBet}. 💀`;
        outcomeType = 'lose';
        highlightType = 'lose';
    }
    else if (total >= 2 && total <= 6) {
        const curseLoss = Math.floor(currentBet * 1.5);
        balance = Math.max(0, balance - curseLoss);
        message = `⚠️ Cursed roll (${total})! You lost an extra $${curseLoss} (1.5x penalty)! ⚠️`;
        outcomeType = 'lose';
        highlightType = 'lose';
    }
    else if (total === 1) {
        balance = 0;
        message = `☠️☠️ Snake eyes (1)!! Your balance is obliterated! ☠️☠️`;
        outcomeType = 'lose';
        highlightType = 'lose';
    }

    saveBalanceToLocal();
    refreshUI();
    showResultMessage(message, outcomeType === 'win' ? 'win' : 'lose');
    displayFinalRoll(roll1, roll2, highlightType);
    return outcomeType;
}

async function performRoll() {
    if (isRolling) return;
    isRolling = true;
    clearResult();
    setDiceRolling(true);
    
    let finalVal1 = 0, finalVal2 = 0;
    let rollsCount = 0;
    const MAX_SPINS = 15;
    
    const spinInterval = setInterval(() => {
        const fake1 = Math.floor(Math.random() * 6) + 1;
        const fake2 = Math.floor(Math.random() * 6) + 1;
        updateDieUI(die1Elem, fake1);
        updateDieUI(die2Elem, fake2);
        rollsCount++;
        if (rollsCount >= MAX_SPINS) {
            clearInterval(spinInterval);
            finalVal1 = Math.floor(Math.random() * 6) + 1;
            finalVal2 = Math.floor(Math.random() * 6) + 1;
            const total = finalVal1 + finalVal2;
            setDiceRolling(false);
            evaluateRoll(total, finalVal1, finalVal2);
            gameActive = false;
            isRolling = false;
            if (balance <= 0) {
                newGameBtn.style.display = 'flex';
                clearBetBtn.style.display = 'none';
            } else {
                newGameBtn.style.display = 'none';
                clearBetBtn.style.display = 'flex';
            }
            refreshUI();
            if (balance > 0 && !gameActive && currentBet === 0) {
                placeBetBtn.disabled = false;
            } else {
                placeBetBtn.disabled = true;
            }
        }
    }, 80);
}

function placeBet() {
    if (isRolling || gameActive) return;
    let betAmount = parseInt(betInput.value);
    if (isNaN(betAmount) || betAmount <= 0) {
        showResultMessage("Enter a valid positive bet amount.", "lose");
        return;
    }
    if (betAmount > balance) {
        showResultMessage(`Insufficient balance! Max bet: $${balance}`, "lose");
        return;
    }
    if (balance <= 0) {
        showResultMessage("You are bankrupt! Press new game.", "lose");
        return;
    }
    currentBet = betAmount;
    balance -= currentBet;
    gameActive = true;
    refreshUI();
    clearResult();
    resetDiceNeutral();
    betInput.value = '';
    performRoll().catch(e => console.warn(e));
}

function clearBet() {
    if (isRolling || gameActive) return;
    if (currentBet !== 0) {
        balance += currentBet;
        currentBet = 0;
        refreshUI();
        resetDiceNeutral();
        clearResult();
        placeBetBtn.disabled = false;
    }
    betInput.value = '';
}

function resetFullGame() {
    if (isRolling) return;
    balance = 500;
    currentBet = 0;
    gameActive = false;
    isRolling = false;
    saveBalanceToLocal();
    refreshUI();
    resetDiceNeutral();
    clearResult();
    betInput.value = '';
    newGameBtn.style.display = 'none';
    clearBetBtn.style.display = 'flex';
    showResultMessage("🔄 New game started! 500 chips restored. Good luck.", "push");
    setTimeout(() => {
        if (resultContainer.innerHTML.includes("New game started")) clearResult();
    }, 2000);
}

function quickBet(amount) {
    if (isRolling || gameActive) return;
    if (amount > balance) {
        showResultMessage(`Can't afford $${amount} bet`, "lose");
        return;
    }
    betInput.value = amount;
    placeBet();
}

function saveBalanceToLocal() {
    localStorage.setItem('cursed_dice_balance', Math.floor(balance));
}

function loadBalanceFromStorage() {
    const saved = localStorage.getItem('cursed_dice_balance');
    if (saved && !isNaN(parseInt(saved)) && parseInt(saved) > 0) {
        balance = parseInt(saved);
    } else {
        balance = 500;
    }
    if (balance <= 0) balance = 500;
    refreshUI();
}

placeBetBtn.addEventListener('click', placeBet);
clearBetBtn.addEventListener('click', clearBet);
newGameBtn.addEventListener('click', resetFullGame);

document.querySelectorAll('.chip-quick').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = parseInt(btn.getAttribute('data-quick'));
        if (!isNaN(val) && !isRolling && !gameActive) {
            quickBet(val);
        }
    });
});

loadBalanceFromStorage();
resetDiceNeutral();
refreshUI();
clearResult();
if (balance <= 0) {
    newGameBtn.style.display = 'flex';
    clearBetBtn.style.display = 'none';
    showResultMessage("Game over — Click new game to revive", "lose");
} else {
    newGameBtn.style.display = 'none';
    clearBetBtn.style.display = 'flex';
}
betInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isRolling && !gameActive) {
        placeBet();
    }
});
updateDieUI(die1Elem, null);
updateDieUI(die2Elem, null);