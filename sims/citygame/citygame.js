(function() {
            const SAVE_KEY = 'metropolis_save_v3';
            const GRID_SIZE = 12;

            const BUILDINGS = {
                residential: {
                    name: 'Residential Zone',
                    cost: 150,
                    population: 15,
                    income: 8,
                    energy: -3,
                    symbol: '🏠',
                    maxLevel: 5,
                    upgradeCost: 200,
                    levelModifiers: { population: 1.8, income: 1.4, energy: 1.2 }
                },
                commercial: {
                    name: 'Commercial Hub',
                    cost: 250,
                    population: 0,
                    income: 25,
                    energy: -8,
                    symbol: '🏢',
                    maxLevel: 5,
                    upgradeCost: 400,
                    levelModifiers: { income: 1.7, energy: 1.3 }
                },
                industrial: {
                    name: 'Industrial Zone',
                    cost: 350,
                    population: 0,
                    income: 40,
                    energy: -15,
                    symbol: '🏭',
                    maxLevel: 5,
                    upgradeCost: 600,
                    levelModifiers: { income: 2.0, energy: 1.5 }
                },
                road: {
                    name: 'Road',
                    cost: 75,
                    population: 0,
                    income: 2,
                    energy: 0,
                    symbol: '🛣️',
                    maxLevel: 1
                },
                park: {
                    name: 'City Park',
                    cost: 120,
                    population: 5,
                    income: 5,
                    energy: -2,
                    symbol: '🌳',
                    maxLevel: 3,
                    upgradeCost: 200,
                    levelModifiers: { happiness: 1.5, environmental: 1.3 }
                },
                'power-plant': {
                    name: 'Power Plant',
                    cost: 500,
                    population: 0,
                    income: 0,
                    energy: 50,
                    symbol: '⚡',
                    maxLevel: 3,
                    upgradeCost: 800,
                    levelModifiers: { energy: 1.8 }
                }
            };

            const UPGRADES = {
                efficiency: {
                    name: 'Energy Efficiency',
                    description: 'Reduce consumption by 20%',
                    cost: 1000,
                    effect: (state) => { state.efficiencyMultiplier = 0.8; }
                },
                capacity: {
                    name: 'Population Capacity',
                    description: 'Increase residential capacity by 25%',
                    cost: 1500,
                    effect: (state) => { state.populationMultiplier = 1.25; }
                },
                renewable: {
                    name: 'Renewable Energy',
                    description: 'Power plants produce +15% energy',
                    cost: 2000,
                    effect: (state) => { state.renewableBonus = 1.15; }
                },
                tourism: {
                    name: 'Tourism Development',
                    description: 'Commercial income +30%',
                    cost: 2500,
                    effect: (state) => { state.tourismBonus = 1.3; }
                }
            };

            const CHALLENGES_CONFIG = [{
                id: 'residential5',
                name: 'Residential Growth',
                description: 'Build 5 residential zones',
                target: 5,
                reward: { type: 'money', value: 500 },
                check: (state) => state.residentialCount || 0
            }, {
                id: 'population100',
                name: 'Population Boom',
                description: 'Reach 100 citizens',
                target: 100,
                reward: { type: 'unlock', value: 'park' },
                check: (state) => state.population || 0
            }, {
                id: 'income1000',
                name: 'Economic Power',
                description: 'Earn 1000 in one cycle',
                target: 1000,
                reward: { type: 'energy', value: 10 },
                check: (state) => state.lastCycleIncome || 0
            }];

            let state = {
                money: 1000,
                population: 0,
                energy: 100,
                maxEnergy: 150,
                cycle: 0,
                speed: 1,
                selectedBuilding: 'residential',
                upgrades: {},
                grid: [],
                lastCycleIncome: 0,
                efficiency: 50,
                residentialCount: 0,
                commercialCount: 0,
                industrialCount: 0,
                parkCount: 0,
                powerPlantCount: 0,
                roadCount: 0,
                challenges: {},
                efficiencyMultiplier: 1,
                populationMultiplier: 1,
                renewableBonus: 1,
                tourismBonus: 1,
                timer: null,
                messageTimeout: null,
                isPaused: false
            };

            const $ = (sel) => document.querySelector(sel);
            const $$ = (sel) => Array.from(document.querySelectorAll(sel));

            function showMessage(text, type = 'info', duration = 3000) {
                const el = $('#message');
                clearTimeout(state.messageTimeout);
                el.textContent = text;
                el.className = 'message show ' + type;
                state.messageTimeout = setTimeout(() => el.classList.remove('show'), duration);
            }

            function initGrid() {
                const gridEl = $('#cityGrid');
                gridEl.innerHTML = '';
                state.grid = [];

                
                for (let y = 0; y < GRID_SIZE; y++) {
                    const row = [];
                    for (let x = 0; x < GRID_SIZE; x++) {
                        const cell = {
                            type: 'empty',
                            x,
                            y,
                            level: 1,
                            connected: false
                        };
                        row.push(cell);

                        const div = document.createElement('div');
                        div.className = 'cell ' + cell.type;
                        div.dataset.x = x;
                        div.dataset.y = y;
                        div.addEventListener('click', () => onCellClick(x, y));
                        div.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            onCellRightClick(x, y);
                        });
                        gridEl.appendChild(div);
                    }
                    state.grid.push(row);
                }

                
                const center = Math.floor(GRID_SIZE / 2);
                for (let i = 0; i < GRID_SIZE; i++) {
                    state.grid[center][i].type = 'road';
                    state.grid[center][i].connected = true;
                    state.grid[i][center].type = 'road';
                    state.grid[i][center].connected = true;
                }

                
                state.grid[center - 1][center - 1].type = 'residential';
                state.grid[center - 1][center - 1].level = 1;

                
                state.grid[center + 1][center + 1].type = 'commercial';
                state.grid[center + 1][center + 1].level = 1;

                updateGrid();
            }

            function getBuildingIncome(cell) {
                if (!cell || cell.type === 'empty') return 0;
                const cfg = BUILDINGS[cell.type];
                if (!cfg) return 0;
                let base = cfg.income || 0;
                const level = cell.level || 1;
                if (cfg.levelModifiers?.income) {
                    base = Math.floor(base * Math.pow(cfg.levelModifiers.income, level - 1));
                }
                if (state.upgrades.tourism && cell.type === 'commercial') {
                    base = Math.floor(base * 1.3);
                }
                return base;
            }

            function getBuildingEnergy(cell) {
                if (!cell || cell.type === 'empty') return 0;
                const cfg = BUILDINGS[cell.type];
                if (!cfg) return 0;
                let energy = cfg.energy || 0;
                const level = cell.level || 1;
                if (cfg.levelModifiers?.energy) {
                    energy = Math.floor(energy * Math.pow(cfg.levelModifiers.energy, level - 1));
                }
                if (state.upgrades.efficiency && energy < 0) {
                    energy = Math.floor(energy * 0.8);
                }
                if (cell.type === 'power-plant' && state.upgrades.renewable) {
                    energy = Math.floor(energy * 1.15);
                }
                return energy;
            }

            function getBuildingPopulation(cell) {
                if (!cell || cell.type !== 'residential') return 0;
                const cfg = BUILDINGS.residential;
                let pop = cfg.population || 0;
                const level = cell.level || 1;
                if (cfg.levelModifiers?.population) {
                    pop = Math.floor(pop * Math.pow(cfg.levelModifiers.population, level - 1));
                }
                if (state.upgrades.capacity) {
                    pop = Math.floor(pop * 1.25);
                }
                return pop;
            }

            function calculateStats() {
                let totalIncome = 0;
                let totalEnergy = 0;
                let totalPopulation = 0;
                let counts = {
                    residential: 0,
                    commercial: 0,
                    industrial: 0,
                    road: 0,
                    park: 0,
                    'power-plant': 0
                };

                for (let y = 0; y < GRID_SIZE; y++) {
                    for (let x = 0; x < GRID_SIZE; x++) {
                        const cell = state.grid[y][x];
                        if (cell.type === 'empty') continue;
                        totalIncome += getBuildingIncome(cell);
                        totalEnergy += getBuildingEnergy(cell);
                        totalPopulation += getBuildingPopulation(cell);
                        if (counts[cell.type] !== undefined) counts[cell.type]++;
                    }
                }

                state.lastCycleIncome = totalIncome;
                state.population = totalPopulation;
                state.residentialCount = counts.residential;
                state.commercialCount = counts.commercial;
                state.industrialCount = counts.industrial;
                state.roadCount = counts.road;
                state.parkCount = counts.park;
                state.powerPlantCount = counts['power-plant'];

                state.energy += totalEnergy;
                if (state.energy > state.maxEnergy) state.energy = state.maxEnergy;
                if (state.energy < 0) state.energy = 0;

                const usage = Math.abs(totalEnergy);
                state.efficiency = Math.min(100, Math.max(0,
                    totalEnergy > 0 ? 100 : Math.floor((state.maxEnergy - usage) / state.maxEnergy * 100)
                ));

                updateUI();
                updateStatistics(counts);
                updateChallenges();
            }

            function updateGrid() {
                const counts = { residential: 0, commercial: 0, industrial: 0, road: 0, park: 0, 'power-plant': 0 };

                for (let y = 0; y < GRID_SIZE; y++) {
                    for (let x = 0; x < GRID_SIZE; x++) {
                        const cell = state.grid[y][x];
                        const el = $(`.cell[data-x="${x}"][data-y="${y}"]`);
                        if (!el) continue;

                        el.className = 'cell ' + cell.type;
                        el.innerHTML = '';
                        el.style.borderColor = 'transparent';

                        if (cell.type !== 'empty') {
                            const cfg = BUILDINGS[cell.type];
                            if (cfg) {
                                const income = getBuildingIncome(cell);
                                el.innerHTML = `
                                    <span class="building-symbol">${cfg.symbol}</span>
                                    <span class="cell-label">L${cell.level}</span>
                                    ${income > 0 ? `<span class="cell-income">+${income}</span>` : ''}
                                `;
                                el.title = `${cfg.name} (Lv${cell.level}) | Income: +${income} | Energy: ${getBuildingEnergy(cell)}`;
                            }
                            counts[cell.type] = (counts[cell.type] || 0) + 1;
                        }
                    }
                }

                state.residentialCount = counts.residential || 0;
                state.commercialCount = counts.commercial || 0;
                state.industrialCount = counts.industrial || 0;
                state.roadCount = counts.road || 0;
                state.parkCount = counts.park || 0;
                state.powerPlantCount = counts['power-plant'] || 0;

                calculateStats();
                updateUI();
                updateChallenges();
            }

            function updateUI() {
                const fmt = (n) => n.toLocaleString();
                $('#money').textContent = fmt(state.money);
                $('#population').textContent = fmt(state.population);
                $('#energy').textContent = `${state.energy} / ${state.maxEnergy}`;
                $('#incomeDisplay').textContent = `+${fmt(state.lastCycleIncome)}`;

                $('#efficiencyValue').textContent = state.efficiency + '%';
                $('#efficiencyBar').style.width = state.efficiency + '%';

                $$('.building-card').forEach(card => {
                    const type = card.dataset.type;
                    if (type && BUILDINGS[type]) {
                        const costEl = card.querySelector('.cost');
                        if (costEl) {
                            costEl.textContent = `$${BUILDINGS[type].cost}`;
                            card.classList.toggle('disabled', state.money < BUILDINGS[type].cost);
                        }
                    }
                });
            }

            function updateStatistics(counts) {
                $('#residentialCount').textContent = counts?.residential || 0;
                $('#commercialCount').textContent = counts?.commercial || 0;
                $('#industrialCount').textContent = counts?.industrial || 0;
                $('#parkCount').textContent = counts?.park || 0;
                $('#powerPlantCount').textContent = counts?.['power-plant'] || 0;
                $('#roadCount').textContent = counts?.road || 0;
            }

            function updateChallenges() {
                CHALLENGES_CONFIG.forEach((config) => {
                    const current = config.check(state);
                    const progress = Math.min(100, (current / config.target) * 100);
                    const card = document.querySelector(`.challenge-card[data-id="${config.id}"]`);
                    if (!card) return;

                    const bar = card.querySelector('.challenge-bar');
                    if (bar) bar.style.width = progress + '%';

                    const isComplete = current >= config.target;
                    if (isComplete && !state.challenges[config.id]) {
                        state.challenges[config.id] = true;
                        card.classList.add('completed');
                        handleChallengeReward(config);
                    }
                });
            }

            function handleChallengeReward(config) {
                const reward = config.reward;
                if (reward.type === 'money') {
                    state.money += reward.value;
                    showMessage(`Goal achieved! +$${reward.value}`, 'success');
                } else if (reward.type === 'unlock') {
                    showMessage(`Unlocked: ${reward.value} structures`, 'success');
                } else if (reward.type === 'energy') {
                    state.maxEnergy += reward.value;
                    showMessage(`Max energy increased by ${reward.value}`, 'success');
                }
                updateUI();
            }

            function onCellClick(x, y) {
                const cell = state.grid[y][x];

                if (state.selectedBuilding === 'destroy') {
                    if (cell.type !== 'empty' && cell.type !== 'road') {
                        const cfg = BUILDINGS[cell.type];
                        const refund = Math.floor((cfg.cost || 0) * 0.5 * (cell.level || 1));
                        state.money += refund;
                        cell.type = 'empty';
                        cell.level = 1;
                        showMessage(`Demolished. Refund: $${refund}`, 'info');
                        updateGrid();
                    } else {
                        showMessage('Nothing to demolish here', 'warning');
                    }
                    return;
                }

                if (cell.type !== 'empty') {
                    showMessage('Right-click to upgrade', 'info');
                    return;
                }

                const cfg = BUILDINGS[state.selectedBuilding];
                if (!cfg) return;

                if (state.money < cfg.cost) {
                    showMessage(`Insufficient funds. Need $${cfg.cost}`, 'error');
                    return;
                }

                const energyCost = cfg.energy || 0;
                if (energyCost < 0 && state.energy + energyCost < 0) {
                    showMessage('Insufficient energy. Build a power plant first.', 'error');
                    return;
                }

                state.money -= cfg.cost;
                cell.type = state.selectedBuilding;
                cell.level = 1;

                showMessage(`Built ${cfg.name} for $${cfg.cost}`, 'success');
                updateGrid();
            }

            function onCellRightClick(x, y) {
                const cell = state.grid[y][x];
                if (cell.type === 'empty' || cell.type === 'road') {
                    showMessage('Cannot upgrade this structure', 'warning');
                    return;
                }

                const cfg = BUILDINGS[cell.type];
                if (!cfg || cell.level >= cfg.maxLevel) {
                    showMessage('Maximum level reached', 'info');
                    return;
                }

                const cost = (cfg.upgradeCost || 200) * cell.level;
                if (state.money < cost) {
                    showMessage(`Need $${cost} to upgrade`, 'error');
                    return;
                }

                state.money -= cost;
                cell.level++;
                showMessage(`${cfg.name} upgraded to level ${cell.level}`, 'success');
                updateGrid();
            }

            function initBuildingsUI() {
                const grid = $('#buildingsGrid');
                grid.innerHTML = '';

                Object.entries(BUILDINGS).forEach(([type, data]) => {
                    if (type === 'road') return;
                    const card = document.createElement('div');
                    card.className = 'building-card' + (type === state.selectedBuilding ? ' selected' : '');
                    card.dataset.type = type;
                    card.innerHTML = `
                        <span class="symbol">${data.symbol}</span>
                        <div class="name">${data.name}</div>
                        <div class="cost">$${data.cost}</div>
                        <div class="stats">${data.population ? `Pop: ${data.population}` : ''}${data.income ? ` | Income: +${data.income}` : ''}${data.energy ? ` | Energy: ${data.energy > 0 ? '+' : ''}${data.energy}` : ''}</div>
                    `;
                    card.addEventListener('click', () => {
                        state.selectedBuilding = type;
                        $$('.building-card').forEach(el => el.classList.remove('selected'));
                        card.classList.add('selected');
                        $('#destroyOption')?.classList.remove('selected');
                        showMessage(`Selected: ${data.name}`, 'info');
                    });
                    grid.appendChild(card);
                });

                const destroyEl = $('#destroyOption');
                destroyEl.addEventListener('click', () => {
                    state.selectedBuilding = 'destroy';
                    $$('.building-card').forEach(el => el.classList.remove('selected'));
                    destroyEl.classList.add('selected');
                    showMessage('Demolish mode activated', 'warning');
                });
            }

            function initUpgradesUI() {
                const grid = $('#upgradesGrid');
                grid.innerHTML = '';

                Object.entries(UPGRADES).forEach(([id, data]) => {
                    const card = document.createElement('div');
                    const purchased = !!state.upgrades[id];
                    card.className = 'building-card' + (purchased ? ' selected' : '');
                    card.innerHTML = `
                        <span class="symbol">${purchased ? '✅' : '⭐'}</span>
                        <div class="name">${data.name}</div>
                        <div class="cost">${purchased ? 'Purchased' : '$' + data.cost}</div>
                        <div class="stats">${data.description}</div>
                    `;
                    card.addEventListener('click', () => {
                        if (purchased) {
                            showMessage('Already purchased', 'info');
                            return;
                        }
                        if (state.money >= data.cost) {
                            state.money -= data.cost;
                            state.upgrades[id] = true;
                            data.effect(state);
                            card.classList.add('selected');
                            card.querySelector('.cost').textContent = 'Purchased';
                            card.querySelector('.symbol').textContent = '✅';
                            showMessage(`Upgrade purchased: ${data.name}`, 'success');
                            updateUI();
                            updateGrid();
                        } else {
                            showMessage(`Need $${data.cost} for this upgrade`, 'error');
                        }
                    });
                    grid.appendChild(card);
                });
            }

            function initChallengesUI() {
                const grid = $('#challengesGrid');
                grid.innerHTML = '';

                CHALLENGES_CONFIG.forEach((config) => {
                    const card = document.createElement('div');
                    card.className = 'challenge-card';
                    card.dataset.id = config.id;
                    card.innerHTML = `
                        <div class="challenge-name">${config.name}</div>
                        <div class="challenge-description">${config.description}</div>
                        <div class="challenge-progress"><div class="challenge-bar"></div></div>
                        <div class="challenge-reward">Reward: ${config.reward.type === 'money' ? '$' + config.reward.value : config.reward.type + ' bonus'}</div>
                    `;
                    grid.appendChild(card);
                });
            }

            function initTabs() {
                $$('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        const tabId = tab.dataset.tab;
                        $$('.tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        $$('.tab-content').forEach(c => c.classList.remove('active'));
                        const content = document.getElementById(tabId + 'Tab');
                        if (content) content.classList.add('active');
                        if (tabId === 'upgrades') initUpgradesUI();
                        if (tabId === 'stats') { updateUI();
                            updateGrid(); }
                    });
                });
            }

            function initTimeControls() {
                const speeds = [
                    { id: 'pauseBtn', speed: 0 },
                    { id: 'normalBtn', speed: 1 },
                    { id: 'fastBtn', speed: 2 },
                    { id: 'ultraBtn', speed: 3 }
                ];

                speeds.forEach(({ id, speed }) => {
                    $(`#${id}`).addEventListener('click', () => {
                        state.speed = speed;
                        $$('.time-btn').forEach(b => b.classList.remove('active'));
                        $(`#${id}`).classList.add('active');
                        showMessage(`Speed: ${['Paused', 'Normal', 'Fast', 'Ultra'][speed]}`, 'info');
                        if (speed === 0) {
                            clearInterval(state.timer);
                            state.timer = null;
                        } else if (!state.timer) {
                            startLoop();
                        }
                    });
                });
            }

            function startLoop() {
                clearInterval(state.timer);
                const interval = Math.max(500, 3000 / state.speed);
                state.timer = setInterval(() => {
                    if (state.speed === 0) return;
                    const income = state.lastCycleIncome;
                    state.money += income;
                    state.cycle++;

                    if (Math.random() < 0.008) triggerEvent();
                    updateUI();
                }, interval);
            }

            function triggerEvent() {
                const events = [
                    { message: 'Tourist influx! Commercial income boosted.', effect: () => {
                            const bonus = state.lastCycleIncome * 0.5;
                            state.money += bonus;
                            showMessage(`Tourism bonus: +$${bonus}`, 'success', 3000);
                        } },
                    { message: 'Energy efficiency campaign!', effect: () => {
                            state.efficiency = Math.min(100, state.efficiency + 10);
                            showMessage('Efficiency improved by 10%', 'success', 3000);
                        } },
                    { message: 'Housing demand spike!', effect: () => {
                            const pop = state.population + 20;
                            state.population = pop;
                            showMessage('Population increased by 20', 'success', 3000);
                        } }
                ];
                const evt = events[Math.floor(Math.random() * events.length)];
                evt.effect();
                updateUI();
            }

            function saveGame() {
                const data = {
                    money: state.money,
                    energy: state.energy,
                    maxEnergy: state.maxEnergy,
                    upgrades: state.upgrades,
                    grid: state.grid,
                    cycle: state.cycle,
                    challenges: state.challenges,
                    lastCycleIncome: state.lastCycleIncome,
                    efficiency: state.efficiency,
                    efficiencyMultiplier: state.efficiencyMultiplier,
                    populationMultiplier: state.populationMultiplier,
                    renewableBonus: state.renewableBonus,
                    tourismBonus: state.tourismBonus
                };
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
                    showMessage('Game saved', 'success', 2000);
                } catch (e) {
                    showMessage('Save failed', 'error');
                }
            }

            function loadGame() {
                try {
                    const raw = localStorage.getItem(SAVE_KEY);
                    if (!raw) { showMessage('No save found', 'warning'); return; }
                    const data = JSON.parse(raw);
                    Object.assign(state, data);
                    updateGrid();
                    updateUI();
                    initUpgradesUI();
                    showMessage('Game loaded', 'success');
                } catch (e) {
                    showMessage('Load failed', 'error');
                }
            }

            function initKeyboard() {
                document.addEventListener('keydown', (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                    switch (e.key.toLowerCase()) {
                        case ' ':
                            e.preventDefault();
                            if (state.speed === 0) {
                                state.speed = 1;
                                $$('.time-btn').forEach(b => b.classList.remove('active'));
                                $('#normalBtn').classList.add('active');
                                if (!state.timer) startLoop();
                                showMessage('Resumed', 'info');
                            } else {
                                state.speed = 0;
                                $$('.time-btn').forEach(b => b.classList.remove('active'));
                                $('#pauseBtn').classList.add('active');
                                clearInterval(state.timer);
                                state.timer = null;
                                showMessage('Paused', 'info');
                            }
                            break;
                        case 'd':
                            state.selectedBuilding = 'destroy';
                            $$('.building-card').forEach(el => el.classList.remove('selected'));
                            $('#destroyOption').classList.add('selected');
                            showMessage('Demolish mode', 'warning');
                            break;
                        case 'b':
                            const types = Object.keys(BUILDINGS).filter(t => t !== 'road');
                            const idx = types.indexOf(state.selectedBuilding);
                            const next = types[(idx + 1) % types.length];
                            state.selectedBuilding = next;
                            $$('.building-card').forEach(el => el.classList.remove('selected'));
                            $(`.building-card[data-type="${next}"]`)?.classList.add('selected');
                            $('#destroyOption')?.classList.remove('selected');
                            showMessage(`Selected: ${BUILDINGS[next].name}`, 'info');
                            break;
                        case 's':
                            if (e.ctrlKey) { e.preventDefault();
                                saveGame(); }
                            break;
                        case 'l':
                            if (e.ctrlKey) { e.preventDefault();
                                loadGame(); }
                            break;
                    }
                });
            }

            function init() {
                initGrid();
                initBuildingsUI();
                initChallengesUI();
                initTabs();
                initTimeControls();
                initKeyboard();
                startLoop();

                setTimeout(() => {
                    const saved = localStorage.getItem(SAVE_KEY);
                    if (saved) {
                        if (confirm('Load saved game?')) loadGame();
                    }
                }, 500);

                showMessage('Welcome to Metropolis Architect', 'info', 4000);
            }

            window.startGame = function() {
                $('#homeScreen').classList.add('hidden');
                init();
            };

            if (window.location.search.includes('start')) {
                window.startGame();
            }

        })();


document.getElementById('begin-city-game')?.addEventListener('click', () => window.startGame());
