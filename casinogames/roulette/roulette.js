const NUMBERS = Array.from({length: 37}, (_, i) => i); 
const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
function getNumberColor(num) {
    if (num === 0) return 'green';
    return RED_NUMS.includes(num) ? 'red' : 'black';
}

let balance = 1000;
let currentChip = 10;
let activeBets = [];        
let selectedSpecial = 'single';
let selectedNumbers = [];    
let spinning = false;
let spinHistory = [];

const balanceSpan = document.getElementById('balanceDisplay');
const totalBetSpan = document.getElementById('totalBetDisplay');
const wheelCanvas = document.getElementById('wheelCanvas');
const spinBtn = document.getElementById('spinWheelBtn');
const numberGridDiv = document.getElementById('numberGrid');
const specialBtns = document.querySelectorAll('.bet-type');
const placeBetBtn = document.getElementById('placeBetBtn');
const clearBetsBtn = document.getElementById('clearBetsBtn');
const activeBetsListDiv = document.getElementById('activeBetsList');
const lastResultSpan = document.getElementById('lastResultText');
const historyContainer = document.getElementById('historyContainer');

function updateBalanceUI() {
    balanceSpan.innerText = Math.floor(balance);
    const totalBetAmount = activeBets.reduce((sum, b) => sum + b.amount, 0);
    totalBetSpan.innerText = totalBetAmount;
}

const angleStep = (2 * Math.PI) / 37;
function drawWheel(rotationRad = 0) {
    const ctx = wheelCanvas.getContext('2d');
    const size = wheelCanvas.clientWidth;
    wheelCanvas.width = size;
    wheelCanvas.height = size;
    const centerX = size/2, centerY = size/2, radius = size/2 - 8;

    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i <= 36; i++) {
        const start = i * angleStep + rotationRad;
        const end = (i+1) * angleStep + rotationRad;
        const color = getNumberColor(i);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.fillStyle = color === 'red' ? '#c63232' : (color === 'green' ? '#2d7a4b' : '#1f1f2e');
        ctx.fill();
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(start + angleStep/2);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(12, size/18)}px "Space Grotesk"`;
        ctx.shadowBlur = 0;
        ctx.fillText(i.toString(), radius-22, 8);
        ctx.restore();
        ctx.strokeStyle = '#e0b85b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius*0.18, 0, 2*Math.PI);
    ctx.fillStyle = '#F5C542';
    ctx.fill();
    ctx.fillStyle = '#1f1a2b';
    ctx.font = `bold ${size/14}px "Inter"`;
    ctx.fillText("★", centerX-8, centerY+6);
}

let currentRotation = 0;
function resetWheel() { drawWheel(currentRotation); }
window.addEventListener('resize', () => resetWheel());

function buildNumberGrid() {
    numberGridDiv.innerHTML = '';
    const zeroBtn = document.createElement('button');
    zeroBtn.innerText = '0';
    zeroBtn.classList.add('num-btn', 'green-special');
    zeroBtn.dataset.num = '0';
    zeroBtn.addEventListener('click', () => toggleNumberSelection(0));
    numberGridDiv.appendChild(zeroBtn);
    for (let i = 1; i <= 36; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.classList.add('num-btn');
        if (RED_NUMS.includes(i)) btn.classList.add('red-tint');
        else btn.classList.add('black-tint');
        btn.dataset.num = i;
        btn.addEventListener('click', () => toggleNumberSelection(i));
        numberGridDiv.appendChild(btn);
    }
}

function toggleNumberSelection(num) {
    if (spinning) return;
    if (selectedSpecial !== 'single') {
        selectedSpecial = 'single';
        updateSpecialButtons('single');
        selectedNumbers = [];
    }
    const idx = selectedNumbers.indexOf(num);
    if (idx === -1) selectedNumbers.push(num);
    else selectedNumbers.splice(idx,1);
    updateNumberHighlight();
}

function updateNumberHighlight() {
    document.querySelectorAll('.num-btn').forEach(btn => {
        const num = parseInt(btn.dataset.num);
        if (selectedNumbers.includes(num)) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
}

function updateSpecialButtons(currentType) {
    specialBtns.forEach(btn => {
        const val = btn.dataset.special;
        if (val === currentType) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

function placeBet() {
    if (spinning) { showTempMsg("Wait for spin to finish", "#c97e5a"); return; }
    let totalCost = 0;
    let newBets = [];

    if (selectedSpecial === 'single') {
        if (selectedNumbers.length === 0) { showTempMsg("Select at least one number", "#ffaa66"); return; }
        for (let num of selectedNumbers) {
            const amount = currentChip;
            totalCost += amount;
            newBets.push({ number: num, amount: amount, type: 'single', id: Date.now()+Math.random() });
        }
    } else {
        totalCost = currentChip;
        newBets.push({ number: null, amount: currentChip, type: selectedSpecial, id: Date.now()+Math.random() });
    }

    if (totalCost > balance) { showTempMsg("Insufficient chips!", "#ff6b6b"); return; }
    balance -= totalCost;
    activeBets.push(...newBets);
    updateBalanceUI();
    renderBetList();
    if (selectedSpecial === 'single') {
        selectedNumbers = [];
        updateNumberHighlight();
    }
    showTempMsg(`Bet placed: +${totalCost} chips`, "#a3e0a0");
}

function clearAllBets() {
    if (spinning) return;
    const refund = activeBets.reduce((sum,b)=> sum + b.amount, 0);
    balance += refund;
    activeBets = [];
    updateBalanceUI();
    renderBetList();
    showTempMsg("Bets cleared, refunded", "#ffd966");
}

function renderBetList() {
    if (activeBets.length === 0) {
        activeBetsListDiv.innerHTML = '<div class="empty-bets">No active bets</div>';
        return;
    }
    let html = '';
    for (let bet of activeBets) {
        if (bet.type === 'single') {
            html += `<div class="active-bet-row">
                        <span>Number ${bet.number}</span><span class="bet-row-amount">${bet.amount}</span>
                        </div>`;
        } else {
            let specialName = bet.type;
            if (bet.type === 'even') specialName = 'Even';
            if (bet.type === 'odd') specialName = 'Odd';
            if (bet.type === 'red') specialName = 'Red';
            if (bet.type === 'black') specialName = 'Black';
            if (bet.type === 'low') specialName = '1-18';
            if (bet.type === 'high') specialName = '19-36';
            if (bet.type === 'dozen1') specialName = '1st 12';
            if (bet.type === 'dozen2') specialName = '2nd 12';
            if (bet.type === 'dozen3') specialName = '3rd 12';
            html += `<div class="active-bet-row">
                        <span>${specialName}</span><span class="bet-row-amount">${bet.amount}</span>
                        </div>`;
        }
    }
    activeBetsListDiv.innerHTML = html;
}

function checkBetWin(bet, winningNum, winningColor) {
    if (bet.type === 'single') return bet.number === winningNum;
    if (bet.type === 'even') return winningNum !== 0 && winningNum % 2 === 0;
    if (bet.type === 'odd') return winningNum !== 0 && winningNum % 2 === 1;
    if (bet.type === 'red') return winningColor === 'red';
    if (bet.type === 'black') return winningColor === 'black';
    if (bet.type === 'low') return winningNum >= 1 && winningNum <= 18;
    if (bet.type === 'high') return winningNum >= 19 && winningNum <= 36;
    if (bet.type === 'dozen1') return winningNum >= 1 && winningNum <= 12;
    if (bet.type === 'dozen2') return winningNum >= 13 && winningNum <= 24;
    if (bet.type === 'dozen3') return winningNum >= 25 && winningNum <= 36;
    return false;
}

function getPayout(bet) {
    if (bet.type === 'single') return bet.amount * 35;
    return bet.amount * 1;
}

function spinWheel() {
    if (spinning) return;
    if (activeBets.length === 0) { showTempMsg("Place a bet before spinning!", "#ffaa77"); return; }
    spinning = true;
    spinBtn.disabled = true;
    const winningNumber = Math.floor(Math.random() * 37);
    const winningColor = getNumberColor(winningNumber);
    const extraSpins = 12 + Math.floor(Math.random() * 8);
    const targetAngle = (2 * Math.PI) * extraSpins + (winningNumber * angleStep) + (angleStep/2);
    currentRotation += targetAngle;
    const duration = 2800;
    const start = performance.now();
    const startRot = currentRotation - targetAngle;
    function animateSpin(now) {
        const elapsed = now - start;
        let t = Math.min(1, elapsed / duration);
        const easeOut = 1 - Math.pow(1-t, 3);
        const rot = startRot + targetAngle * easeOut;
        drawWheel(rot);
        if (t < 1) requestAnimationFrame(animateSpin);
        else {
            drawWheel(startRot + targetAngle);
            finalizeSpin(winningNumber, winningColor);
        }
    }
    requestAnimationFrame(animateSpin);
}

function finalizeSpin(winNum, winColor) {
    let totalWin = 0;
    let winCount = 0;
    for (let bet of activeBets) {
        if (checkBetWin(bet, winNum, winColor)) {
            const winAmount = getPayout(bet);
            totalWin += winAmount;
            winCount++;
        }
    }
    balance += totalWin;
    updateBalanceUI();
    const winText = totalWin > 0 ? `WIN ${totalWin} chips` : `LOSE: number ${winNum} ${winColor}`;
    lastResultSpan.innerHTML = `<span class="strong-result">${winNum} (${winColor})</span> - ${winText}`;
    if (totalWin > 0) {
        createMiniConfetti();
    }
    spinHistory.unshift({ num: winNum, color: winColor, win: totalWin > 0 });
    if (spinHistory.length > 16) spinHistory.pop();
    renderHistory();
    activeBets = [];
    renderBetList();
    spinning = false;
    spinBtn.disabled = false;
    if (balance <= 0) {
        lastResultSpan.innerHTML += "<br>Bankrupt. Refresh to restart.";
    }
}

function renderHistory() {
    historyContainer.innerHTML = '';
    for (let h of spinHistory) {
        const ball = document.createElement('div');
        ball.className = `history-ball ${h.win ? 'win-bg' : 'lose-bg'}`;
        ball.innerText = h.num;
        ball.title = `${h.num} (${h.color}) ${h.win ? 'Win' : 'Lose'}`;
        historyContainer.appendChild(ball);
    }
}

function showTempMsg(msg, colorHex = "#e0c87a") {
    const old = lastResultSpan.innerHTML;
    lastResultSpan.innerHTML = `<span class="roulette-result-color" data-result-color="${colorHex}">${msg}</span>`;
    setTimeout(() => {
        if (!spinning) lastResultSpan.innerHTML = old;
        else if(lastResultSpan.innerHTML.includes(msg)) lastResultSpan.innerHTML = old;
    }, 1500);
}

function createMiniConfetti() {
    for (let i=0;i<40;i++) {
        const conf = document.createElement('div');
        conf.style.position = 'fixed';
        conf.style.width = '8px';
        conf.style.height = '8px';
        conf.style.background = `hsl(${Math.random()*360}, 70%, 60%)`;
        conf.style.left = Math.random() * window.innerWidth + 'px';
        conf.style.top = '-20px';
        conf.style.pointerEvents = 'none';
        conf.style.zIndex = 9999;
        conf.style.borderRadius = '50%';
        document.body.appendChild(conf);
        conf.animate([
            { transform: 'translateY(0px) rotate(0deg)', opacity: 1 },
            { transform: `translateY(${window.innerHeight+50}px) rotate(${Math.random()*360}deg)`, opacity: 0 }
        ], { duration: 1500 + Math.random()*800, easing: 'cubic-bezier(0.4,0,0.2,1)' }).onfinish = () => conf.remove();
    }
}

function init() {
    buildNumberGrid();
    resetWheel();
    drawWheel(0);
    document.querySelectorAll('.chip-item').forEach(chip => {
        chip.addEventListener('click', () => {
            if (spinning) return;
            currentChip = parseInt(chip.dataset.chip);
            document.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });
    document.querySelector('.chip-item[data-chip="10"]').classList.add('active');
    specialBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (spinning) return;
            selectedSpecial = btn.dataset.special;
            updateSpecialButtons(selectedSpecial);
            if (selectedSpecial !== 'single') selectedNumbers = [];
            updateNumberHighlight();
        });
    });
    placeBetBtn.addEventListener('click', placeBet);
    clearBetsBtn.addEventListener('click', clearAllBets);
    spinBtn.addEventListener('click', spinWheel);
    updateBalanceUI();
    renderBetList();
    updateSpecialButtons('single');
}
init();