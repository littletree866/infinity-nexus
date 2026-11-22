const SAVE_KEY = 'clicker_medieval_save';
    const THEME_KEY = 'clicker_theme';

    let gold = 0;
    let clickPower = 1;
    let passiveIncome = 0;
    let clickUpgradeLevel = 0;
    let autoUpgradeLevel = 0;
    let critUpgradeLevel = 0;
    let magnetUpgradeLevel = 0;
    let comboUpgradeLevel = 0;
    let energyUpgradeLevel = 0;
    let ascensionCount = 0;
    let totalClicks = 0;

    let clickCost = 12;
    let autoCost = 28;
    let critCost = 1200;
    let magnetCost = 700;
    let comboCost = 250;
    let energyCostUpgrade = 400;

    const MAX_LEVEL = 50;

    let boostActive = false;
    let boostTimer = null;
    let boostTimeLeft = 0;

    let critChanceBase = 8;
    let critDamage = 5;

    let maxEnergy = 100;
    let currentEnergy = 100;
    let energyRegenRate = 0.4;
    let energyCostPerClick = 1;

    let comboCount = 0;
    let lastClickTime = 0;
    let comboTimeout = 500;

    let achievements = {};
    let lastDailyBonusDate = '';
    let eventActive = false;
    let eventType = '';

    let floatNumbersEnabled = true;
    let orbsEnabled = true;

    let currentShopTab = 'upgrades';

    function getGlobalMult() {
        let mult = 1 + (ascensionCount * 0.15) + (magnetUpgradeLevel * 0.15);
        if (boostActive) mult *= 3;
        if (eventActive && eventType === 'double') mult *= 2;
        return mult;
    }

    function getCritChance() { return Math.min(80, critChanceBase + (critUpgradeLevel * 4)); }
    function getCritDamage() { return critDamage + (critUpgradeLevel * 1.2); }
    function getComboBonus() { return 0.05 + (comboUpgradeLevel * 0.02); }
    function getMaxEnergy() { return maxEnergy + (energyUpgradeLevel * 25); }

    function formatMoney(val) {
        if (val >= 1e9) return (val/1e9).toFixed(2).replace(/\.00$/,'') + 'B';
        if (val >= 1e6) return (val/1e6).toFixed(2).replace(/\.00$/,'') + 'M';
        if (val >= 1e3) return (val/1e3).toFixed(2).replace(/\.00$/,'') + 'K';
        return Math.floor(val).toString();
    }

    function updateUI() {
        const mult = getGlobalMult();
        document.getElementById('moneyDisplay').textContent = formatMoney(gold);
        document.getElementById('incomeDisplay').textContent = formatMoney(passiveIncome * mult) + '/s';
        document.getElementById('multiplierDisplay').textContent = mult.toFixed(2) + 'x';
        document.getElementById('clickCountDisplay').textContent = formatMoney(totalClicks);
        document.getElementById('prestigeBonusSpan').textContent = ascensionCount * 15;

        const maxE = getMaxEnergy();
        const energyPercent = Math.max(0, Math.min(100, (currentEnergy / maxE) * 100));
        document.getElementById('energyBar').style.width = energyPercent + '%';
        document.getElementById('energyText').textContent = `${Math.floor(currentEnergy)} / ${maxE}`;

        const comboDiv = document.getElementById('comboDisplay');
        if (comboCount > 1) {
            comboDiv.textContent = `${comboCount}x combo (+${Math.floor(comboCount * getComboBonus() * 100)}%)`;
        } else {
            comboDiv.textContent = '';
        }

        const chestBtn = document.getElementById('chestBtn');
        chestBtn.classList.toggle('boost-active', boostActive);

        document.getElementById('prestigeActionBtn').disabled = gold < 10000;

        if (document.getElementById('shopPopup').classList.contains('active')) {
            const upgrades = getUpgrades();
            upgrades.forEach(u => {
                const row = document.querySelector(`.upgrade-item[data-upgrade="${u.id}"]`);
                if (!row) return;
                const maxed = u.level >= u.max;
                const disabled = maxed || gold < u.cost;
                row.classList.toggle('disabled', disabled);
                row.classList.toggle('maxed', maxed);
            });
            const boostRow = document.querySelector('.upgrade-item[data-boost="1"]');
            if (boostRow) {
                boostRow.classList.toggle('disabled', gold < 600 || boostActive);
            }
        }
    }

    function showToast(msg, isErr = false) {
        const toast = document.getElementById('toastMsg');
        toast.textContent = msg;
        toast.classList.toggle('error', isErr);
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function checkAchievement(key) {
        if (achievements[key]) return;
        achievements[key] = true;
        const rewards = {
            first_100: 10, first_1k: 25, first_10k: 50, first_100k: 100,
            first_upgrade: 5, prestige_first: 50, combo_10: 15, crit_hit: 5
        };
        if (rewards[key]) gold += rewards[key];
    }

    function addFloatingNumber(value, x, y, isCrit = false) {
        if (!floatNumbersEnabled) return;
        const div = document.createElement('div');
        div.className = 'floating-number';
        div.textContent = `+${formatMoney(value)}`;
        div.style.left = x + 'px';
        div.style.top = y + 'px';
        if (isCrit) {
            div.style.color = '#f0c040';
            div.style.fontSize = '1.4rem';
        }
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 800);
    }

    function handleClick(e) {
        if (currentEnergy < energyCostPerClick) {
            showToast('Not enough energy', true);
            return;
        }

        currentEnergy -= energyCostPerClick;

        const now = Date.now();
        if (now - lastClickTime > comboTimeout) comboCount = 0;
        comboCount++;
        lastClickTime = now;

        let comboMult = 1 + (comboCount * getComboBonus());
        let value = clickPower * getGlobalMult() * comboMult;
        const isCrit = Math.random() * 100 < getCritChance();
        if (isCrit) {
            value *= getCritDamage();
            checkAchievement('crit_hit');
        }

        if (comboCount >= 10) checkAchievement('combo_10');

        gold += value;
        totalClicks++;

        if (gold >= 100) checkAchievement('first_100');
        if (gold >= 1000) checkAchievement('first_1k');
        if (gold >= 10000) checkAchievement('first_10k');
        if (gold >= 100000) checkAchievement('first_100k');

        let clientX = e.clientX, clientY = e.clientY;
        if (!clientX || !clientY) {
            const rect = document.getElementById('chestBtn').getBoundingClientRect();
            clientX = rect.left + rect.width/2;
            clientY = rect.top + rect.height/2;
        }
        addFloatingNumber(value, clientX, clientY - 30, isCrit);
        updateUI();
    }

    function getUpgrades() {
        return [
            {
                id: 'click', name: 'Strike Power', icon: 'fa-fist-raised',
                desc: 'Increases gold gained per click by 50%.',
                level: clickUpgradeLevel, cost: clickCost, max: MAX_LEVEL,
                meta: [`+${(clickPower * getGlobalMult()).toFixed(1)}/click`],
                buy: () => {
                    if (gold < clickCost || clickUpgradeLevel >= MAX_LEVEL) return;
                    gold -= clickCost;
                    clickPower = Math.floor(clickPower * 1.5) + 1;
                    clickUpgradeLevel++;
                    clickCost = Math.floor(clickCost * 1.25);
                    checkAchievement('first_upgrade');
                    showToast('Strike Power upgraded');
                }
            },
            {
                id: 'auto', name: 'Passive Income', icon: 'fa-coins',
                desc: 'Generates gold automatically every second.',
                level: autoUpgradeLevel, cost: autoCost, max: MAX_LEVEL,
                meta: [`+${(passiveIncome * getGlobalMult()).toFixed(1)}/s`],
                buy: () => {
                    if (gold < autoCost || autoUpgradeLevel >= MAX_LEVEL) return;
                    gold -= autoCost;
                    passiveIncome += 1;
                    autoUpgradeLevel++;
                    autoCost = Math.floor(autoCost * 1.35);
                    checkAchievement('first_upgrade');
                    showToast('Passive income increased');
                }
            },
            {
                id: 'crit', name: 'Critical Hit', icon: 'fa-bolt',
                desc: 'Increases critical hit chance and damage.',
                level: critUpgradeLevel, cost: critCost, max: MAX_LEVEL,
                meta: [`Crit ${getCritChance()}%`, `x${getCritDamage().toFixed(1)}`],
                buy: () => {
                    if (gold < critCost || critUpgradeLevel >= MAX_LEVEL) return;
                    gold -= critCost;
                    critUpgradeLevel++;
                    critCost = Math.floor(critCost * 1.4);
                    checkAchievement('first_upgrade');
                    showToast(`Critical chance: ${getCritChance()}%`);
                }
            },
            {
                id: 'magnet', name: 'Global Boost', icon: 'fa-magnet',
                desc: 'Increases all earnings by 15% per level.',
                level: magnetUpgradeLevel, cost: magnetCost, max: MAX_LEVEL,
                meta: [`+${Math.floor(magnetUpgradeLevel * 15)}% total`],
                buy: () => {
                    if (gold < magnetCost || magnetUpgradeLevel >= MAX_LEVEL) return;
                    gold -= magnetCost;
                    magnetUpgradeLevel++;
                    magnetCost = Math.floor(magnetCost * 1.35);
                    checkAchievement('first_upgrade');
                    showToast('Global boost +15%');
                }
            },
            {
                id: 'combo', name: 'Combo Master', icon: 'fa-fire',
                desc: 'Increases the bonus gained per combo click.',
                level: comboUpgradeLevel, cost: comboCost, max: MAX_LEVEL,
                meta: [`+${Math.floor(getComboBonus() * 100)}% per combo`],
                buy: () => {
                    if (gold < comboCost || comboUpgradeLevel >= MAX_LEVEL) return;
                    gold -= comboCost;
                    comboUpgradeLevel++;
                    comboCost = Math.floor(comboCost * 1.4);
                    checkAchievement('first_upgrade');
                    showToast('Combo bonus increased');
                }
            },
            {
                id: 'energy', name: 'Energy Capacity', icon: 'fa-battery-full',
                desc: 'Increases maximum energy by 25.',
                level: energyUpgradeLevel, cost: energyCostUpgrade, max: MAX_LEVEL,
                meta: [`Max ${getMaxEnergy()} energy`],
                buy: () => {
                    if (gold < energyCostUpgrade || energyUpgradeLevel >= MAX_LEVEL) return;
                    gold -= energyCostUpgrade;
                    energyUpgradeLevel++;
                    energyCostUpgrade = Math.floor(energyCostUpgrade * 1.4);
                    checkAchievement('first_upgrade');
                    showToast('Max energy +25');
                }
            }
        ];
    }

    function renderShop() {
        const body = document.getElementById('shopBody');
        if (currentShopTab === 'upgrades') {
            const upgrades = getUpgrades();
            body.innerHTML = upgrades.map(u => {
                const maxed = u.level >= u.max;
                const disabled = maxed || gold < u.cost;
                const metaHtml = u.meta.map(m => `<span>${m}</span>`).join('') +
                    `<span>Lv. ${u.level} / ${u.max}</span>`;
                return `
                    <div class="upgrade-item ${maxed ? 'maxed' : ''} ${disabled ? 'disabled' : ''}" data-upgrade="${u.id}">
                        <div class="upgrade-item-left">
                            <div class="upgrade-item-name">
                                <i class="fas ${u.icon} upgrade-item-icon"></i>${u.name}
                            </div>
                            <div class="upgrade-item-desc">${u.desc}</div>
                            <div class="upgrade-item-meta">${metaHtml}</div>
                        </div>
                        <button class="buy-btn ${maxed ? 'maxed' : ''}" ${disabled ? 'disabled' : ''}>
                            ${maxed ? 'MAX' : '$' + formatMoney(u.cost)}
                        </button>
                    </div>
                `;
            }).join('');

            body.querySelectorAll('.upgrade-item[data-upgrade]').forEach(item => {
                item.addEventListener('click', () => {
                    if (item.classList.contains('disabled') || item.classList.contains('maxed')) return;
                    const id = item.dataset.upgrade;
                    const upg = getUpgrades().find(u => u.id === id);
                    if (upg) {
                        upg.buy();
                        updateUI();
                        saveGame();
                        renderShop();
                    }
                });
            });
        } else {
            body.innerHTML = `
                <div class="upgrade-item" data-boost="1">
                    <div class="upgrade-item-left">
                        <div class="upgrade-item-name"><i class="fas fa-rocket upgrade-item-icon"></i>Speed Boost</div>
                        <div class="upgrade-item-desc">Triples all earnings for 45 seconds.</div>
                        <div class="upgrade-item-meta"><span>3x earnings</span><span>45s duration</span></div>
                    </div>
                    <button class="buy-btn" ${gold < 600 || boostActive ? 'disabled' : ''}>
                        ${boostActive ? `${Math.floor(boostTimeLeft)}s` : '$600'}
                    </button>
                </div>
                <div class="upgrade-item">
                    <div class="upgrade-item-left">
                        <div class="upgrade-item-name"><i class="fas fa-gem upgrade-item-icon"></i>Gold Orb</div>
                        <div class="upgrade-item-desc">A bonus orb appears every 20 seconds. Click it for free gold.</div>
                        <div class="upgrade-item-meta"><span>+${formatMoney(80 + magnetUpgradeLevel * 30)} base</span></div>
                    </div>
                    <button class="buy-btn" disabled>Automatic</button>
                </div>
            `;
            document.querySelector('.upgrade-item[data-boost="1"]')?.addEventListener('click', () => {
                if (gold < 600 || boostActive) return;
                activateBoost();
                renderShop();
            });
        }
    }

    function activateBoost() {
        if (boostActive) return;
        if (gold < 600) { showToast('Need $600', true); return; }
        gold -= 600;
        boostActive = true;
        boostTimeLeft = 45;
        if (boostTimer) clearInterval(boostTimer);
        boostTimer = setInterval(() => {
            boostTimeLeft--;
            if (boostTimeLeft <= 0) {
                clearInterval(boostTimer);
                boostActive = false;
                showToast('Boost ended');
            }
            updateUI();
        }, 1000);
        showToast('Boost active: 3x for 45s');
        updateUI();
        saveGame();
    }

    function ascension() {
        if (gold < 10000) { showToast('Need $10K to prestige', true); return; }
        if (!confirm('Prestige now? You will reset all progress for a permanent +15% bonus.')) return;
        ascensionCount++;
        gold = 0;
        clickPower = 1;
        passiveIncome = 0;
        clickUpgradeLevel = 0;
        autoUpgradeLevel = 0;
        critUpgradeLevel = 0;
        magnetUpgradeLevel = 0;
        comboUpgradeLevel = 0;
        energyUpgradeLevel = 0;
        clickCost = 12;
        autoCost = 28;
        critCost = 1200;
        magnetCost = 700;
        comboCost = 250;
        energyCostUpgrade = 400;
        comboCount = 0;
        currentEnergy = getMaxEnergy();
        if (boostActive) { clearInterval(boostTimer); boostActive = false; }
        checkAchievement('prestige_first');
        showToast(`Prestige! +${ascensionCount * 15}% permanent bonus`);
        updateUI();
        saveGame();
    }

    let energyRegenInterval;
    function startEnergyRegen() {
        if (energyRegenInterval) clearInterval(energyRegenInterval);
        energyRegenInterval = setInterval(() => {
            const maxE = getMaxEnergy();
            if (currentEnergy < maxE) {
                currentEnergy = Math.min(maxE, currentEnergy + energyRegenRate);
                updateUI();
            }
        }, 100);
    }

    let passiveInterval;
    function startPassive() {
        if (passiveInterval) clearInterval(passiveInterval);
        passiveInterval = setInterval(() => {
            if (passiveIncome > 0) {
                gold += passiveIncome * getGlobalMult();
                updateUI();
            }
        }, 1000);
    }

    function triggerRandomEvent() {
        if (Math.random() < 0.15 && !eventActive) {
            eventActive = true;
            eventType = 'double';
            const banner = document.getElementById('eventBanner');
            banner.className = 'event-banner';
            banner.textContent = 'Royal Decree: 2x earnings for 30 seconds!';
            setTimeout(() => {
                eventActive = false;
                banner.textContent = '';
                banner.className = '';
                updateUI();
            }, 30000);
            updateUI();
        }
    }

    function spawnOrb() {
        if (!orbsEnabled) return;
        const orb = document.createElement('div');
        orb.className = 'bonus-orb';
        orb.innerHTML = '&#9670;';
        orb.style.left = Math.random() * 80 + 10 + '%';
        orb.style.bottom = '20px';
        document.body.appendChild(orb);
        orb.addEventListener('click', (e) => {
            e.stopPropagation();
            const magnetBonus = 1 + (magnetUpgradeLevel * 0.15);
            const bonus = Math.floor((Math.random() * 200 + 80) * magnetBonus);
            gold += bonus;
            showToast(`+${formatMoney(bonus)} gold`);
            orb.remove();
            updateUI();
            saveGame();
        });
        setTimeout(() => { if (orb.parentNode) orb.remove(); }, 6000);
    }

    function saveGame() {
        const data = {
            gold, clickPower, passiveIncome, clickUpgradeLevel, autoUpgradeLevel,
            critUpgradeLevel, magnetUpgradeLevel, comboUpgradeLevel, energyUpgradeLevel,
            clickCost, autoCost, critCost, magnetCost, comboCost, energyCostUpgrade,
            ascensionCount, totalClicks, currentEnergy, achievements,
            lastBonusDate: lastDailyBonusDate
        };
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch(e) {}
    }

    function loadGame() {
        const raw = localStorage.getItem(SAVE_KEY);
        let savedDate = '';
        if (raw) {
            try {
                const d = JSON.parse(raw);
                gold = d.gold ?? 0;
                clickPower = d.clickPower ?? 1;
                passiveIncome = d.passiveIncome ?? 0;
                clickUpgradeLevel = d.clickUpgradeLevel ?? 0;
                autoUpgradeLevel = d.autoUpgradeLevel ?? 0;
                critUpgradeLevel = d.critUpgradeLevel ?? 0;
                magnetUpgradeLevel = d.magnetUpgradeLevel ?? 0;
                comboUpgradeLevel = d.comboUpgradeLevel ?? 0;
                energyUpgradeLevel = d.energyUpgradeLevel ?? 0;
                clickCost = d.clickCost ?? 12;
                autoCost = d.autoCost ?? 28;
                critCost = d.critCost ?? 1200;
                magnetCost = d.magnetCost ?? 700;
                comboCost = d.comboCost ?? 250;
                energyCostUpgrade = d.energyCostUpgrade ?? 400;
                ascensionCount = d.ascensionCount ?? 0;
                totalClicks = d.totalClicks ?? 0;
                currentEnergy = d.currentEnergy ?? getMaxEnergy();
                achievements = d.achievements ?? {};
                savedDate = d.lastBonusDate ?? '';
            } catch(e) {}
        }

        const today = new Date().toDateString();
        if (savedDate !== today) {
            gold += 80;
            showToast('+80 gold daily bonus');
            lastDailyBonusDate = today;
            saveGame();
        } else {
            lastDailyBonusDate = today;
        }

        if (currentEnergy > getMaxEnergy()) currentEnergy = getMaxEnergy();
        updateUI();
    }

    function resetGame() {
        if (!confirm('Erase ALL progress? This cannot be undone.')) return;
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(THEME_KEY);
        location.reload();
    }

    function onKey(e) {
        const key = e.key;
        if (document.getElementById('shopPopup').classList.contains('active') ||
            document.getElementById('settingsPopup').classList.contains('active')) {
            if (key === 'Escape') {
                document.getElementById('shopPopup').classList.remove('active');
                document.getElementById('settingsPopup').classList.remove('active');
            }
            return;
        }
        if (key === ' ' || key === 'Space') {
            e.preventDefault();
            handleClick({ clientX: window.innerWidth/2, clientY: window.innerHeight/2 });
        }
        if (key === 's' || key === 'S') document.getElementById('shopBtn').click();
    }

    function applyTheme(dark) {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        document.getElementById('themeToggle').classList.toggle('active', dark);
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    }

    function openShop() {
        document.getElementById('shopPopup').classList.add('active');
        renderShop();
    }

    document.getElementById('chestBtn').addEventListener('click', handleClick);
    document.getElementById('prestigeActionBtn').addEventListener('click', ascension);

    document.getElementById('shopBtn').addEventListener('click', openShop);
    document.getElementById('shopCloseBtn').addEventListener('click', () => {
        document.getElementById('shopPopup').classList.remove('active');
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsPopup').classList.add('active');
    });
    document.getElementById('settingsCloseBtn').addEventListener('click', () => {
        document.getElementById('settingsPopup').classList.remove('active');
    });

    document.querySelectorAll('.popup-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentShopTab = tab.dataset.tab;
            renderShop();
        });
    });

    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        const isDark = !themeToggle.classList.contains('active');
        applyTheme(isDark);
    });

    const floatToggle = document.getElementById('floatToggle');
    floatToggle.addEventListener('click', () => {
        floatNumbersEnabled = !floatNumbersEnabled;
        floatToggle.classList.toggle('active', floatNumbersEnabled);
    });

    const orbToggle = document.getElementById('orbToggle');
    orbToggle.addEventListener('click', () => {
        orbsEnabled = !orbsEnabled;
        orbToggle.classList.toggle('active', orbsEnabled);
    });

    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.addEventListener('keydown', onKey);

    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme === 'dark');

    loadGame();
    startPassive();
    startEnergyRegen();
    setInterval(spawnOrb, 20000);
    setInterval(triggerRandomEvent, 80000);
    setInterval(saveGame, 15000);