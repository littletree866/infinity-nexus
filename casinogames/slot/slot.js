const SYMBOLS = [
    { name: '🪙', payout: 5,   color: 'red' },
    { name: '🏅', payout: 8,   color: 'yellow' },
    { name: '🥇', payout: 10,  color: 'orange' },
    { name: '💎', payout: 12,  color: 'purple' },
    { name: '👑', payout: 20,  color: 'gold' },
    { name: '🏆', payout: 50,  color: 'cyan' },
    { name: '⭐', payout: 100, color: 'white' },
    { name: '7', payout: 200, color: 'rainbow' }
];

let balance = 500;
let currentBet = 10;
let spinning = false;
let lastWinAmount = 0;
let gridState = Array(9).fill('A');  

const balanceSpan = document.getElementById('balanceValue');
const betSpan = document.getElementById('betValue');
const lastWinSpan = document.getElementById('lastWinDisplay');
const spinBtn = document.getElementById('spinBtn');
const resultDiv = document.getElementById('resultMsgArea');
const reels = document.querySelectorAll('.reel');
const betChips = document.querySelectorAll('.bet-chip-btn');
const paytableDiv = document.getElementById('paytableList');

function updateUI() {
    balanceSpan.innerText = Math.floor(balance);
    betSpan.innerText = currentBet;
    lastWinSpan.innerText = lastWinAmount;
    if (balance <= 0) {
        spinBtn.disabled = true;
        resultDiv.innerHTML = 'Game over. Refresh to restart.';
    } else {
        spinBtn.disabled = spinning;
    }
}

function buildPaytable() {
    paytableDiv.innerHTML = '';
    SYMBOLS.forEach(sym => {
        const div = document.createElement('div');
        div.className = 'pay-item';
        div.innerHTML = `<span>${sym.name} match</span><span class="slot-payout">$${sym.payout * currentBet}</span>`;
        paytableDiv.appendChild(div);
    });
}

function refreshPaytableMultiplier() {
    const items = paytableDiv.querySelectorAll('.pay-item');
    items.forEach((item, idx) => {
        if (idx < SYMBOLS.length) {
            const payoutAmount = SYMBOLS[idx].payout * currentBet;
            item.innerHTML = `<span>${SYMBOLS[idx].name} match</span><span class="slot-payout">$${payoutAmount}</span>`;
        }
    });
}

async function spinSlots() {
    if (spinning) return;
    if (balance < currentBet) {
        resultDiv.innerHTML = 'Insufficient balance. Change bet or restart.';
        resultDiv.classList.add('lose-text');
        setTimeout(() => resultDiv.classList.remove('lose-text'), 1200);
        return;
    }

    spinning = true;
    spinBtn.disabled = true;
    balance -= currentBet;
    updateUI();

    resultDiv.innerHTML = 'Spinning...';
    resultDiv.classList.remove('win-text', 'lose-text');
    
    reels.forEach(reel => reel.classList.add('spinning'));
    
    gridState = Array(9).fill(null).map(() => {
        const randIdx = Math.floor(Math.random() * SYMBOLS.length);
        return SYMBOLS[randIdx].name;
    });
    
    let rollSteps = 16;
    let step = 0;
    const rollInterval = setInterval(() => {
        reels.forEach((reel, idx) => {
            const randomSym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].name;
            reel.innerText = randomSym;
        });
        step++;
        if (step >= rollSteps) {
            clearInterval(rollInterval);
            reels.forEach((reel, idx) => {
                reel.innerText = gridState[idx];
            });
            reels.forEach(reel => reel.classList.remove('spinning'));
            evaluateWin();
            spinning = false;
            spinBtn.disabled = false;
            updateUI();
        }
    }, 70);
}

function evaluateWin() {
    let winAmount = 0;
    let winLines = [];
    const grid = gridState;

    for (let row = 0; row < 3; row++) {
        const start = row * 3;
        if (grid[start] === grid[start+1] && grid[start+1] === grid[start+2]) {
            const found = SYMBOLS.find(s => s.name === grid[start]);
            if (found) {
                winAmount += found.payout * currentBet;
                winLines.push([start, start+1, start+2]);
            }
        }
    }

    for (let col = 0; col < 3; col++) {
        if (grid[col] === grid[col+3] && grid[col+3] === grid[col+6]) {
            const found = SYMBOLS.find(s => s.name === grid[col]);
            if (found) {
                winAmount += found.payout * currentBet;
                winLines.push([col, col+3, col+6]);
            }
        }
    }

    if (grid[0] === grid[4] && grid[4] === grid[8]) {
        const found = SYMBOLS.find(s => s.name === grid[0]);
        if (found) {
            winAmount += found.payout * currentBet;
            winLines.push([0, 4, 8]);
        }
    }
    if (grid[2] === grid[4] && grid[4] === grid[6]) {
        const found = SYMBOLS.find(s => s.name === grid[2]);
        if (found) {
            winAmount += found.payout * currentBet;
            winLines.push([2, 4, 6]);
        }
    }
    
    if (winAmount > 0) {
        balance += winAmount;
        lastWinAmount = winAmount;
        updateUI();
        const lineCount = winLines.length;
        resultDiv.innerHTML = `Win! ${lineCount} line(s): +$${winAmount}`;
        resultDiv.classList.add('win-text');
        const winningIndices = new Set(winLines.flat());
        reels.forEach((reel, idx) => {
            if (winningIndices.has(idx)) {
                reel.classList.add('win-highlight');
                setTimeout(() => reel.classList.remove('win-highlight'), 900);
            }
        });
        createConfettiEffect();
        playWinEffect();
    } else {
        resultDiv.innerHTML = `No match. Lost $${currentBet}.`;
        resultDiv.classList.add('lose-text');
        setTimeout(() => resultDiv.classList.remove('lose-text'), 1500);
    }
    lastWinSpan.innerText = lastWinAmount;
    if (balance <= 0) updateUI();
    
    setTimeout(() => {
        if (!spinning && resultDiv.innerHTML !== 'Spinning...') {
            resultDiv.innerHTML = 'Ready to spin';
            resultDiv.classList.remove('win-text', 'lose-text');
        }
    }, 2800);
}

function createConfettiEffect() {
    for (let i=0; i<60; i++) {
        const conf = document.createElement('div');
        conf.style.position = 'fixed';
        conf.style.width = `${6+Math.random()*8}px`;
        conf.style.height = `${6+Math.random()*8}px`;
        conf.style.backgroundColor = `hsl(${Math.random()*360}, 75%, 55%)`;
        conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        conf.style.left = `${Math.random() * window.innerWidth}px`;
        conf.style.top = '-20px';
        conf.style.pointerEvents = 'none';
        conf.style.zIndex = 9999;
        document.body.appendChild(conf);
        const duration = 1200 + Math.random() * 800;
        const velocityX = (Math.random() - 0.5) * 6;
        conf.animate([
            { transform: `translate(0,0) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${velocityX * 20}px, ${window.innerHeight+40}px) rotate(${Math.random()*720}deg)`, opacity: 0 }
        ], { duration: duration, easing: 'cubic-bezier(0.3,0.9,0.4,1)' }).onfinish = () => conf.remove();
    }
}

function playWinEffect() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1600, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        setTimeout(() => ctx.close(), 600);
    } catch(e) {}
}

function setBet(amount) {
    if (spinning) return;
    if (balance > 0 && balance < amount && amount > balance) return;
    currentBet = amount;
    betSpan.innerText = currentBet;
    betChips.forEach(btn => {
        const val = parseInt(btn.dataset.bet);
        if (val === amount) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    refreshPaytableMultiplier();
}

function resetBankruptcy() {
    if (balance <= 0) {
        balance = 500;
        currentBet = 10;
        lastWinAmount = 0;
        spinning = false;
        updateUI();
        setBet(10);
        resultDiv.innerHTML = 'Game reset. Balance: 500';
        spinBtn.disabled = false;
    }
}

function tryReset() {
    if (balance <= 0) resetBankruptcy();
    else {
        resultDiv.innerHTML = 'Balance OK';
    }
    updateUI();
}

document.addEventListener('keydown', (e) => {
    if (spinning) return;
    if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        spinSlots();
    }
    if (e.code === 'Digit1') setBet(5);
    if (e.code === 'Digit2') setBet(10);
    if (e.code === 'Digit3') setBet(25);
    if (e.code === 'Digit4') setBet(50);
    if (e.code === 'Digit5') setBet(100);
    if (e.code === 'KeyR') tryReset();
});

function init() {
    buildPaytable();
    setBet(10);
    updateUI();
    spinBtn.addEventListener('click', spinSlots);
    betChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (spinning) return;
            const betVal = parseInt(chip.dataset.bet);
            setBet(betVal);
        });
    });
    if (balance <= 0) resetBankruptcy();
}

init();