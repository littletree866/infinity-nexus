const STORAGE_KEY = 'empireBuilder_v2';

const BUILDINGS = [
    { id: 'farm', icon: '🌾', name: 'Farm', cost: 80, effect: 'food', income: 2, pop: 5, desc: '+2 gold, +5 pop' },
    { id: 'house', icon: '🏠', name: 'House', cost: 120, effect: 'housing', income: 1, pop: 15, desc: '+1 gold, +15 pop' },
    { id: 'market', icon: '🏪', name: 'Market', cost: 200, effect: 'trade', income: 8, pop: 0, desc: '+8 gold' },
    { id: 'barracks', icon: '🏰', name: 'Barracks', cost: 300, effect: 'military', income: 0, pop: 0, military: 10, desc: '+10 military' },
    { id: 'temple', icon: '⛪', name: 'Temple', cost: 400, effect: 'faith', income: 3, pop: 0, happiness: 5, desc: '+3 gold, +5% happiness' },
    { id: 'university', icon: '🎓', name: 'University', cost: 500, effect: 'science', income: 0, pop: 0, science: 15, desc: '+15 science' }
];

const UPGRADES = [
    { id: 'agriculture', name: 'Agriculture', cost: 1000, desc: '+50% farm income', effect: 'farmBoost' },
    { id: 'trade', name: 'Trade Routes', cost: 1500, desc: '+30% all income', effect: 'tradeBoost' },
    { id: 'military', name: 'Military Tech', cost: 2000, desc: '+50% military power', effect: 'milBoost' },
    { id: 'education', name: 'Education', cost: 2500, desc: '+40% science gain', effect: 'sciBoost' }
];

const ACHIEVEMENTS = [
    { id: 'first_gold', name: 'First Gold', icon: '🪙', check: s => s.gold >= 1000 },
    { id: 'pop_1000', name: 'Growing Town', icon: '🏘️', check: s => s.population >= 1000 },
    { id: 'pop_10000', name: 'City', icon: '🌆', check: s => s.population >= 10000 },
    { id: 'gold_10000', name: 'Wealthy', icon: '💰', check: s => s.gold >= 10000 },
    { id: 'gold_100000', name: 'Rich', icon: '💎', check: s => s.gold >= 100000 },
    { id: 'mil_100', name: 'Militia', icon: '⚔️', check: s => s.military >= 100 },
    { id: 'mil_1000', name: 'Army', icon: '🏹', check: s => s.military >= 1000 },
    { id: 'sci_100', name: 'Scholar', icon: '📖', check: s => s.science >= 100 },
    { id: 'sci_1000', name: 'Academy', icon: '🏛️', check: s => s.science >= 1000 },
    { id: 'all_buildings', name: 'Diverse', icon: '🏗️', check: s => Object.values(s.buildings).every(v => v > 0) },
    { id: 'happiness_90', name: 'Utopia', icon: '😊', check: s => s.happiness >= 90 },
    { id: 'empire', name: 'Empire', icon: '👑', check: s => s.population >= 50000 && s.military >= 5000 }
];

let state = {
    gold: 500,
    population: 50,
    military: 10,
    science: 0,
    happiness: 50,
    buildings: {},
    upgrades: {},
    achievements: [],
    events: [],
    tickCount: 0,
    income: 0,
    era: 'Medieval',
    goldMultiplier: 1,
    sciMultiplier: 1,
    milMultiplier: 1,
    farmMultiplier: 1
};

let gameLoop = null;
let toastTimeout = null;

function initState() {
    BUILDINGS.forEach(b => { state.buildings[b.id] = 0; });
    UPGRADES.forEach(u => { state.upgrades[u.id] = false; });
}
initState();

function load() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(state, data);
        }
    } catch (e) {}
    render();
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toast(message, type = 'info') {
    const el = document.getElementById('toast');
    clearTimeout(toastTimeout);
    el.className = `toast ${type} show`;
    el.innerHTML = `<span class="t-icon">${type === 'good' ? '✅' : type === 'bad' ? '❌' : 'ℹ️'}</span> ${message}`;
    toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

function addEvent(text, type = 'neutral') {
    state.events.unshift({ text, type, time: Date.now() });
    if (state.events.length > 20) state.events.pop();
    renderEvents();
}

function render() {
    const fmt = n => n.toLocaleString();

    document.getElementById('goldDisplay').textContent = fmt(Math.floor(state.gold));
    document.getElementById('popDisplay').textContent = fmt(state.population);
    document.getElementById('milDisplay').textContent = fmt(state.military);
    document.getElementById('sciDisplay').textContent = fmt(state.science);

    document.getElementById('goldDetail').textContent = fmt(Math.floor(state.gold));
    document.getElementById('popDetail').textContent = fmt(state.population);
    document.getElementById('milDetail').textContent = fmt(state.military);
    document.getElementById('sciDetail').textContent = fmt(state.science);

    document.getElementById('hapDisplay').textContent = Math.min(100, Math.floor(state.happiness)) + '%';
    document.getElementById('hapBar').style.width = Math.min(100, state.happiness) + '%';

    const growth = Math.min(100, Math.floor((state.population / 100000) * 100));
    document.getElementById('growthDisplay').textContent = growth + '%';
    document.getElementById('growthBar').style.width = growth + '%';

    const income = calcIncome();
    state.income = income;
    document.getElementById('incomeDisplay').textContent = `+${fmt(income)}/s`;

    
    let era = 'Medieval';
    if (state.population >= 50000 && state.military >= 5000) era = 'Imperial';
    else if (state.population >= 20000 && state.military >= 2000) era = 'Renaissance';
    else if (state.population >= 10000) era = 'Feudal';
    else if (state.population >= 5000) era = 'Kingdom';
    else if (state.population >= 1000) era = 'Duchy';
    state.era = era;
    document.getElementById('eraDisplay').textContent = era;

    renderBuildings();
    renderUpgrades();
    renderAchievements();
    renderEvents();

    const totalAch = ACHIEVEMENTS.length;
    const unlocked = state.achievements.length;
    document.getElementById('achCount').textContent = `${unlocked}/${totalAch}`;
}

function calcIncome() {
    let total = 0;
    BUILDINGS.forEach(b => {
        const count = state.buildings[b.id] || 0;
        let income = b.income * count;
        if (b.id === 'farm') income *= state.farmMultiplier;
        total += income;
    });
    total *= state.goldMultiplier;
    return Math.floor(total);
}

function renderBuildings() {
    const container = document.getElementById('buildingsContainer');
    container.innerHTML = '';

    BUILDINGS.forEach(b => {
        const count = state.buildings[b.id] || 0;
        const btn = document.createElement('button');
        btn.className = `building-btn ${count > 0 ? 'owned' : ''}`;
        if (state.gold < b.cost) btn.classList.add('disabled');

        btn.innerHTML = `
            <span class="icon">${b.icon}</span>
            <span class="name">${b.name}</span>
            <span class="cost">💰${b.cost}</span>
            <span class="effect">${b.desc}</span>
            <span class="count">${count}</span>
        `;

        btn.addEventListener('click', () => buildBuilding(b.id));
        container.appendChild(btn);
    });
}

function renderUpgrades() {
    const container = document.getElementById('upgradesContainer');
    container.innerHTML = '';

    UPGRADES.forEach(u => {
        const purchased = state.upgrades[u.id];
        const btn = document.createElement('button');
        btn.className = `upgrade-btn ${purchased ? 'purchased' : ''}`;
        if (!purchased && state.gold < u.cost) btn.disabled = true;

        btn.innerHTML = `
            <div class="u-name">${u.name}</div>
            <div class="u-cost">${purchased ? '✅ Purchased' : '💰' + u.cost}</div>
            <div class="u-desc">${u.desc}</div>
        `;

        btn.addEventListener('click', () => buyUpgrade(u.id));
        container.appendChild(btn);
    });
}

function renderAchievements() {
    const container = document.getElementById('achievementsContainer');
    container.innerHTML = '';

    ACHIEVEMENTS.forEach(a => {
        const unlocked = state.achievements.includes(a.id);
        const div = document.createElement('div');
        div.className = `ach-item ${unlocked ? 'unlocked' : 'locked'}`;
        div.innerHTML = `
            <span class="icon">${a.icon}</span>
            <div class="a-name">${unlocked ? a.name : '???'}</div>
        `;
        div.title = a.name;
        container.appendChild(div);
    });
}

function renderEvents() {
    const container = document.getElementById('eventsContainer');
    container.innerHTML = '';
    state.events.slice(0, 8).forEach(e => {
        const div = document.createElement('div');
        div.className = `event-item ${e.type}`;
        div.textContent = e.text;
        container.appendChild(div);
    });
}

function buildBuilding(id) {
    const b = BUILDINGS.find(x => x.id === id);
    if (!b) return;
    if (state.gold < b.cost) {
        toast('Not enough gold!', 'bad');
        return;
    }

    state.gold -= b.cost;
    state.buildings[id] = (state.buildings[id] || 0) + 1;
    state.population += b.pop || 0;
    state.military += b.military || 0;
    state.science += b.science || 0;
    state.happiness = Math.min(100, state.happiness + (b.happiness || 0));

    
    const total = Object.values(state.buildings).reduce((a, b) => a + b, 0);
    if (total > 20 && total % 5 === 0) {
        state.happiness = Math.max(10, state.happiness - 2);
    }

    checkAchievements();
    save();
    render();
    toast(`Built ${b.name}!`, 'good');
    addEvent(`Built a ${b.name}`, 'good');

    
    if (Math.random() < 0.05) triggerRandomEvent();
}

function buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) return;
    if (state.upgrades[u.id]) {
        toast('Already purchased!', 'info');
        return;
    }
    if (state.gold < u.cost) {
        toast('Not enough gold!', 'bad');
        return;
    }

    state.gold -= u.cost;
    state.upgrades[u.id] = true;

    switch (u.id) {
        case 'agriculture': state.farmMultiplier = 1.5; break;
        case 'trade': state.goldMultiplier = 1.3; break;
        case 'military': state.milMultiplier = 1.5; break;
        case 'education': state.sciMultiplier = 1.4; break;
    }

    checkAchievements();
    save();
    render();
    toast(`Purchased ${u.name}!`, 'good');
    addEvent(`Researched ${u.name}`, 'good');
}

function collectTaxes() {
    const income = calcIncome();
    const bonus = Math.floor(income * 2.5);
    state.gold += bonus;
    save();
    render();
    toast(`Collected $${bonus} in taxes!`, 'good');
    addEvent(`Collected taxes: +$${bonus}`, 'good');
}

function trainSoldiers() {
    const cost = Math.floor(state.population * 0.1);
    if (state.gold < cost) {
        toast('Not enough gold!', 'bad');
        return;
    }
    const trained = Math.floor(state.population * 0.05) + 5;
    state.gold -= cost;
    state.military += trained;
    state.happiness = Math.max(10, state.happiness - 3);
    save();
    render();
    toast(`Trained ${trained} soldiers!`, 'good');
    addEvent(`Trained ${trained} soldiers`, 'good');
}

function researchScience() {
    const cost = 200 + state.science * 0.2;
    if (state.gold < cost) {
        toast('Not enough gold!', 'bad');
        return;
    }
    const gained = Math.floor(10 + state.science * 0.05);
    state.gold -= cost;
    state.science += gained;
    state.happiness = Math.min(100, state.happiness + 1);
    save();
    render();
    toast(`Gained ${gained} science points!`, 'good');
    addEvent(`Researched: +${gained} science`, 'good');
}

function checkAchievements() {
    let newAch = false;
    ACHIEVEMENTS.forEach(a => {
        if (!state.achievements.includes(a.id) && a.check(state)) {
            state.achievements.push(a.id);
            const reward = Math.floor(500 + state.population * 0.1);
            state.gold += reward;
            newAch = true;
            toast(`🏆 Achievement: ${a.name}! +$${reward}`, 'good');
            addEvent(`Achievement unlocked: ${a.name}`, 'good');
        }
    });
    if (newAch) save();
    render();
}

function triggerRandomEvent() {
    const events = [
        { text: 'A plague sweeps through the land! Population decreased.', type: 'bad', effect: () => { state.population = Math.max(10, Math.floor(state.population * 0.8)); } },
        { text: 'Bountiful harvest! Gold increased.', type: 'good', effect: () => { state.gold += 500; } },
        { text: 'Trading caravan arrives! +200 gold.', type: 'good', effect: () => { state.gold += 200; } },
        { text: 'Bandits raid the countryside! Military decreased.', type: 'bad', effect: () => { state.military = Math.max(0, Math.floor(state.military * 0.85)); } },
        { text: 'Festival boosts happiness!', type: 'good', effect: () => { state.happiness = Math.min(100, state.happiness + 10); } },
        { text: 'Drought reduces income temporarily.', type: 'bad', effect: () => { state.gold = Math.max(0, state.gold - 300); } },
    ];

    const evt = events[Math.floor(Math.random() * events.length)];
    evt.effect();
    addEvent(evt.text, evt.type);
    toast(evt.text, evt.type);
    save();
    render();
}

function resetGame() {
    if (confirm('Reset your empire? This cannot be undone!')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

function gameTick() {
    state.tickCount++;

    
    const income = calcIncome();
    state.gold += income;

    
    const growthRate = 0.002 + (state.happiness / 10000);
    state.population += Math.floor(state.population * growthRate) + 1;

    
    const sciGain = Math.floor(state.science * 0.01) + 1;
    state.science += Math.floor(sciGain * state.sciMultiplier);

    
    const targetHap = 50 + Math.floor(state.population / 1000) + Math.floor(state.gold / 10000);
    state.happiness += (Math.min(95, targetHap) - state.happiness) * 0.005;

    
    if (state.tickCount % 30 === 0 && Math.random() < 0.02) {
        triggerRandomEvent();
    }

    
    if (state.tickCount % 10 === 0) checkAchievements();

    save();
    render();
}

function startGame() {
    load();
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(gameTick, 1000);
    
    render();
    addEvent('Welcome to Empire Builder! Build your civilization.', 'neutral');
    toast('Build your empire!', 'info');
}


window.buildBuilding = buildBuilding;
window.buyUpgrade = buyUpgrade;
window.collectTaxes = collectTaxes;
window.trainSoldiers = trainSoldiers;
window.researchScience = researchScience;
window.resetGame = resetGame;

startGame();

document.getElementById('collect-taxes')?.addEventListener('click', collectTaxes);
document.getElementById('train-soldiers')?.addEventListener('click', trainSoldiers);
document.getElementById('research-science')?.addEventListener('click', researchScience);
document.getElementById('reset-empire')?.addEventListener('click', resetGame);
