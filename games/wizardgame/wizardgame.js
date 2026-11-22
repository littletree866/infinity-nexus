(function() {
        "use strict";

        
        const state = {
            player: {
                name: 'Mage',
                level: 1,
                hp: 100,
                maxHp: 100,
                mana: 100,
                maxMana: 100,
                xp: 0,
                xpNeeded: 100,
                gold: 0,
                potions: 2,  
                spells: {
                    fireball: { level: 1, cost: 12, damage: 22 },
                    frostbolt: { level: 1, cost: 8, damage: 16, slow: true },
                    lightning: { level: 1, cost: 14, damage: 28 },
                    heal: { level: 1, cost: 18, heal: 32 },
                    meteor: { level: 0, cost: 30, damage: 55, unlocked: false },
                    blizzard: { level: 0, cost: 28, damage: 48, slow: true, frozen: true, unlocked: false }
                }
            },
            enemy: null,
            map: {
                size: 10,
                px: 5, py: 5,
                enemies: [],   
                treasures: []  
            },
            inBattle: false,
            turnLock: false,
            enemiesDefeated: 0,
            shopItems: [
                { name: 'Health Potion', cost: 25, desc: 'Restore 50 HP', type: 'potion' },
                { name: 'Mana Potion', cost: 30, desc: 'Restore 40 MP', type: 'mana' },
                { name: 'Scroll of Fire', cost: 55, desc: 'Deal 40 fire dmg', type: 'scroll', spell: 'fireball' },
                { name: 'Scroll of Lightning', cost: 65, desc: 'Deal 55 lightning dmg', type: 'scroll', spell: 'lightning' }
            ],
            inventory: { scrolls: [] }
        };

        
        function generateEnemy(level) {
            const templates = [
                { name: 'Goblin Scavenger', emoji: '👺', baseHp: 45, baseAtk: 7, xp: 18, gold: 8 },
                { name: 'Skeleton Mage', emoji: '💀', baseHp: 60, baseAtk: 11, xp: 28, gold: 14 },
                { name: 'Shadow Wolf', emoji: '🐺', baseHp: 80, baseAtk: 15, xp: 42, gold: 22 },
                { name: 'Fire Elemental', emoji: '🔥', baseHp: 110, baseAtk: 20, xp: 65, gold: 35 },
                { name: 'Elder Lich', emoji: '🧛', baseHp: 150, baseAtk: 26, xp: 100, gold: 55 },
                { name: 'Dragon Whelp', emoji: '🐲', baseHp: 210, baseAtk: 34, xp: 150, gold: 80 }
            ];
            const idx = Math.min(level - 1, templates.length - 1);
            const t = templates[idx];
            const hpScale = 1 + (level - 1) * 0.12;
            const atkScale = 1 + (level - 1) * 0.10;
            return {
                name: t.name,
                emoji: t.emoji,
                maxHp: Math.floor(t.baseHp * hpScale),
                hp: Math.floor(t.baseHp * hpScale),
                atk: Math.floor(t.baseAtk * atkScale),
                xp: Math.floor(t.xp * (1 + (level-1)*0.08)),
                gold: Math.floor(t.gold * (1 + (level-1)*0.09)),
                slow: false,
                frozen: false
            };
        }

        
        const $ = id => document.getElementById(id);
        const pLevel = $('player-level-display');
        const pGold = $('gold-display');
        const pHpText = $('p-hp-text'), pMaxHp = $('p-maxhp-text'), pHpBar = $('p-hp-bar');
        const pManaText = $('p-mana-text'), pMaxMana = $('p-maxmana-text'), pManaBar = $('p-mana-bar');
        const pXpText = $('p-xp-text'), pXpNeed = $('p-xpneed-text'), pXpBar = $('p-xp-bar');
        const potionCount = $('potion-count');
        const eName = $('enemy-name-display'), eHpText = $('e-hp-text'), eMaxHp = $('e-maxhp-text'), eHpBar = $('e-hp-bar');
        const eStatus = $('enemy-status-badge'), eAtk = $('enemy-damage-display');
        const playerEmoji = $('player-emoji'), enemyEmoji = $('enemy-emoji');
        const logBox = $('log-box');
        const mapGrid = $('map-grid');
        const mapCoords = $('map-coords');
        const invList = $('inventory-list');
        const shopList = $('shop-list');
        const spellBtns = {
            fireball: $('spell-fireball'),
            frostbolt: $('spell-frostbolt'),
            lightning: $('spell-lightning'),
            heal: $('spell-heal'),
            meteor: $('spell-meteor'),
            blizzard: $('spell-blizzard')
        };
        const nextEnemyBtn = $('next-enemy-btn');
        const restBtn = $('rest-btn');
        const potionBtn = $('potion-btn');
        const returnMapBtn = $('return-map-btn');

        
        function updateUI() {
            const p = state.player;
            pLevel.textContent = p.level;
            pGold.textContent = p.gold;
            pHpText.textContent = Math.floor(p.hp);
            pMaxHp.textContent = p.maxHp;
            pHpBar.style.width = (p.hp / p.maxHp * 100) + '%';
            pManaText.textContent = Math.floor(p.mana);
            pMaxMana.textContent = p.maxMana;
            pManaBar.style.width = (p.mana / p.maxMana * 100) + '%';
            pXpText.textContent = p.xp;
            pXpNeed.textContent = p.xpNeeded;
            pXpBar.style.width = (p.xp / p.xpNeeded * 100) + '%';
            potionCount.textContent = p.potions;

            
            if (state.enemy) {
                const e = state.enemy;
                eName.textContent = e.name;
                eHpText.textContent = Math.floor(e.hp);
                eMaxHp.textContent = e.maxHp;
                eHpBar.style.width = (e.hp / e.maxHp * 100) + '%';
                eAtk.textContent = e.atk;
                let status = '⚔️ Normal';
                if (e.frozen) status = '❄️ Frozen';
                else if (e.slow) status = '🐌 Slowed';
                eStatus.textContent = status;
                enemyEmoji.textContent = e.emoji;
            } else {
                eName.textContent = '---';
                eHpText.textContent = '0';
                eMaxHp.textContent = '0';
                eHpBar.style.width = '0%';
                eStatus.textContent = '💀 Defeated';
                enemyEmoji.textContent = '💀';
            }
            playerEmoji.textContent = p.hp <= 0 ? '💀' : '🧙‍♂️';

            
            for (const [key, btn] of Object.entries(spellBtns)) {
                if (!btn) continue;
                const sp = p.spells[key];
                if (!sp) continue;
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                const cost = sp.cost || 0;
                const isUnlocked = key === 'meteor' ? p.spells.meteor.unlocked : key === 'blizzard' ? p.spells.blizzard.unlocked : true;
                if (!isUnlocked) { btn.classList.add('hidden'); continue; }
                btn.classList.remove('hidden');
                btn.innerHTML = `${emojiMap[key]} ${label} <span class="spell-cost">(${cost} MP)</span>`;
                btn.disabled = (p.mana < cost || state.inBattle === false || state.enemy === null || state.enemy.hp <= 0 || p.hp <= 0);
            }
            
            potionBtn.disabled = (p.potions <= 0 || p.hp >= p.maxHp || state.inBattle === false);
            
            nextEnemyBtn.disabled = (state.inBattle === true && state.enemy && state.enemy.hp > 0);
            restBtn.disabled = (state.inBattle === false || p.hp <= 0);
            
            mapCoords.textContent = `${state.map.px},${state.map.py}`;
            
            updateInventoryUI();
            updateShopUI();
        }

        const emojiMap = { fireball: '🔥', frostbolt: '❄️', lightning: '⚡', heal: '💚', meteor: '☄️', blizzard: '🌨️' };

        function addLog(msg, cls = '') {
            const p = document.createElement('p');
            p.textContent = msg;
            if (cls) p.classList.add(cls);
            logBox.appendChild(p);
            if (logBox.children.length > 12) logBox.removeChild(logBox.children[0]);
            logBox.scrollTop = logBox.scrollHeight;
        }

        
        function generateMap() {
            const size = state.map.size;
            state.map.enemies = [];
            state.map.treasures = [];
            
            const enemyCount = 4 + Math.floor(Math.random() * 4);
            for (let i = 0; i < enemyCount; i++) {
                let x, y, ok;
                let attempts = 0;
                do {
                    x = Math.floor(Math.random() * size);
                    y = Math.floor(Math.random() * size);
                    ok = !(x === state.map.px && y === state.map.py) &&
                         !state.map.enemies.some(e => e.x === x && e.y === y) &&
                         !state.map.treasures.some(t => t.x === x && t.y === y);
                    attempts++;
                } while (!ok && attempts < 40);
                if (ok) state.map.enemies.push({x, y});
            }
            
            const treasureCount = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < treasureCount; i++) {
                let x, y, ok;
                let attempts = 0;
                do {
                    x = Math.floor(Math.random() * size);
                    y = Math.floor(Math.random() * size);
                    ok = !(x === state.map.px && y === state.map.py) &&
                         !state.map.enemies.some(e => e.x === x && e.y === y) &&
                         !state.map.treasures.some(t => t.x === x && t.y === y);
                    attempts++;
                } while (!ok && attempts < 40);
                if (ok) state.map.treasures.push({x, y});
            }
            renderMap();
        }

        function renderMap() {
            const size = state.map.size;
            mapGrid.innerHTML = '';
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const tile = document.createElement('div');
                    tile.className = 'tile';
                    const isPlayer = (x === state.map.px && y === state.map.py);
                    const isEnemy = state.map.enemies.some(e => e.x === x && e.y === y);
                    const isTreasure = state.map.treasures.some(t => t.x === x && t.y === y);
                    if (isPlayer) tile.classList.add('player-tile');
                    if (isEnemy) tile.classList.add('enemy-tile');
                    if (isTreasure) tile.classList.add('treasure-tile');
                    if (isPlayer) tile.textContent = '🧙';
                    else if (isEnemy) tile.textContent = '👹';
                    else if (isTreasure) tile.textContent = '💎';
                    tile.dataset.x = x; tile.dataset.y = y;
                    tile.addEventListener('click', () => onTileClick(x, y));
                    mapGrid.appendChild(tile);
                }
            }
        }

        function onTileClick(x, y) {
            if (state.inBattle) { addLog('⚔️ You are in battle! Finish it first.', 'enemy'); return; }
            const dx = Math.abs(x - state.map.px), dy = Math.abs(y - state.map.py);
            if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                
                state.map.px = x; state.map.py = y;
                
                const enemyIdx = state.map.enemies.findIndex(e => e.x === x && e.y === y);
                if (enemyIdx !== -1) {
                    state.map.enemies.splice(enemyIdx, 1);
                    startBattle();
                    renderMap();
                    updateUI();
                    return;
                }
                
                const tresIdx = state.map.treasures.findIndex(t => t.x === x && t.y === y);
                if (tresIdx !== -1) {
                    state.map.treasures.splice(tresIdx, 1);
                    const goldFound = 12 + Math.floor(Math.random() * 45);
                    state.player.gold += goldFound;
                    addLog(`💎 Found treasure! +${goldFound} gold.`, 'special');
                }
                renderMap();
                updateUI();
            } else {
                addLog('🚫 You can only move one step (up/down/left/right).', 'enemy');
            }
        }

        
        function startBattle() {
            if (state.inBattle) return;
            state.inBattle = true;
            state.enemy = generateEnemy(state.player.level);
            state.enemy.slow = false;
            state.enemy.frozen = false;
            addLog(`⚔️ A wild ${state.enemy.name} appears!`, 'enemy');
            updateUI();
        }

        function endBattle() {
            state.inBattle = false;
            state.enemy = null;
            addLog('🏁 Battle ended. Explore the map.', 'special');
            updateUI();
            renderMap();
        }

        function playerCast(spellKey) {
            if (!state.inBattle || !state.enemy || state.enemy.hp <= 0 || state.player.hp <= 0) return;
            if (state.turnLock) return;
            const sp = state.player.spells[spellKey];
            if (!sp) return;
            if (state.player.mana < sp.cost) { addLog('❌ Not enough mana!', 'enemy'); return; }
            if (spellKey === 'meteor' && !sp.unlocked) return;
            if (spellKey === 'blizzard' && !sp.unlocked) return;

            state.turnLock = true;
            state.player.mana -= sp.cost;
            let damage = sp.damage || 0;
            let healAmt = sp.heal || 0;
            let msg = '';

            
            if (spellKey === 'heal') {
                const actual = Math.min(healAmt, state.player.maxHp - state.player.hp);
                state.player.hp += actual;
                msg = `💚 Healed ${actual} HP.`;
                addLog(msg, 'special');
                updateUI();
                state.turnLock = false;
                enemyTurn();
                return;
            }

            
            if (damage > 0) {
                
                const lvBonus = 1 + (sp.level - 1) * 0.18;
                let finalDamage = Math.floor(damage * lvBonus);
                
                if (state.enemy.frozen) finalDamage = Math.floor(finalDamage * 1.2);
                state.enemy.hp = Math.max(0, state.enemy.hp - finalDamage);
                msg = `💥 ${spellKey} deals ${finalDamage} damage!`;
                if (sp.slow) { state.enemy.slow = true; msg += ' 🐌 Slowed!'; }
                if (sp.frozen) { state.enemy.frozen = true; msg += ' ❄️ Frozen!'; }
                addLog(msg, 'special');
                
                enemyEmoji.style.transform = 'scale(1.2)';
                setTimeout(() => enemyEmoji.style.transform = '', 200);
            }

            updateUI();

            if (state.enemy.hp <= 0) {
                defeatEnemy();
                state.turnLock = false;
                return;
            }
            state.turnLock = false;
            enemyTurn();
        }

        function enemyTurn() {
            if (!state.inBattle || !state.enemy || state.enemy.hp <= 0 || state.player.hp <= 0) {
                state.turnLock = false;
                return;
            }
            state.turnLock = true;
            let atk = state.enemy.atk;
            if (state.enemy.slow) { atk = Math.floor(atk * 0.7); state.enemy.slow = false; }
            if (state.enemy.frozen) { atk = Math.floor(atk * 0.5); state.enemy.frozen = false; }
            state.player.hp = Math.max(0, state.player.hp - atk);
            addLog(`👹 ${state.enemy.name} attacks for ${atk} damage.`, 'enemy');
            updateUI();
            if (state.player.hp <= 0) {
                addLog('💀 You have been defeated! Meditate to recover.', 'enemy');
                state.turnLock = false;
                return;
            }
            state.turnLock = false;
            updateUI();
        }

        function defeatEnemy() {
            const e = state.enemy;
            const xpGain = e.xp || 20;
            const goldGain = e.gold || 10;
            state.player.xp += xpGain;
            state.player.gold += goldGain;
            state.enemiesDefeated++;
            addLog(`🏆 ${e.name} defeated! +${xpGain} XP, +${goldGain} gold.`, 'special');
            
            while (state.player.xp >= state.player.xpNeeded) {
                state.player.xp -= state.player.xpNeeded;
                state.player.level++;
                state.player.xpNeeded = Math.floor(state.player.xpNeeded * 1.5);
                state.player.maxHp += 18;
                state.player.hp = state.player.maxHp;
                state.player.maxMana += 14;
                state.player.mana = state.player.maxMana;
                
                upgradeRandomSpell();
                addLog(`🎉 Level up! Now level ${state.player.level}.`, 'special');
                
                if (state.player.level >= 5) {
                    state.player.spells.meteor.unlocked = true;
                    state.player.spells.blizzard.unlocked = true;
                }
            }
            
            if (Math.random() < 0.35) {
                state.player.potions++;
                addLog('🧪 You found a health potion!', 'special');
            }
            updateUI();
            state.enemy = null;
            state.inBattle = false;
            renderMap();
            updateUI();
            
            if (state.map.enemies.length === 0) {
                addLog('🗺️ The land is clear! New enemies appear...', 'special');
                generateMap();
            }
            state.turnLock = false;
        }

        function upgradeRandomSpell() {
            const available = Object.keys(state.player.spells).filter(k => {
                const s = state.player.spells[k];
                return s.level < 3 && (k !== 'meteor' ? true : s.unlocked) && (k !== 'blizzard' ? true : s.unlocked);
            });
            if (available.length === 0) return;
            const key = available[Math.floor(Math.random() * available.length)];
            const sp = state.player.spells[key];
            sp.level++;
            if (sp.damage) sp.damage = Math.floor(sp.damage * 1.25);
            if (sp.heal) sp.heal = Math.floor(sp.heal * 1.2);
            addLog(`✨ ${key} upgraded to level ${sp.level}!`, 'special');
        }

        
        function rest() {
            if (!state.inBattle) { addLog('🧘 You meditate in peace.', 'special'); }
            const hpRec = Math.min(40, state.player.maxHp - state.player.hp);
            const mpRec = Math.min(30, state.player.maxMana - state.player.mana);
            state.player.hp += hpRec;
            state.player.mana += mpRec;
            addLog(`🧘 Recovered ${hpRec} HP and ${mpRec} MP.`, 'special');
            if (state.inBattle && state.enemy && state.enemy.hp > 0 && Math.random() < 0.45) {
                setTimeout(() => { enemyTurn(); }, 400);
            }
            updateUI();
        }

        function usePotion() {
            if (state.player.potions <= 0 || state.player.hp >= state.player.maxHp) return;
            const heal = Math.min(50, state.player.maxHp - state.player.hp);
            state.player.hp += heal;
            state.player.potions--;
            addLog(`🧪 Used potion, +${heal} HP.`, 'special');
            updateUI();
            if (state.inBattle && state.enemy && state.enemy.hp > 0 && Math.random() < 0.3) {
                setTimeout(() => { enemyTurn(); }, 500);
            }
        }

        
        function updateInventoryUI() {
            invList.innerHTML = `<div class="item-row">🧪 Health Potions: <span>${state.player.potions}</span></div>
                                 <div class="item-row">📜 Scrolls: ${state.inventory.scrolls.length}</div>`;
        }

        function updateShopUI() {
            shopList.innerHTML = '';
            state.shopItems.forEach((item, idx) => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.innerHTML = `<span>${item.name} <small>(${item.desc})</small></span>
                                 <button data-shopidx="${idx}">${item.cost}🪙</button>`;
                row.querySelector('button').addEventListener('click', () => buyShopItem(idx));
                shopList.appendChild(row);
            });
        }

        function buyShopItem(idx) {
            const item = state.shopItems[idx];
            if (!item) return;
            if (state.player.gold < item.cost) { addLog('❌ Not enough gold.', 'enemy'); return; }
            state.player.gold -= item.cost;
            if (item.type === 'potion') {
                state.player.potions += 1;
                addLog(`🧪 Bought Health Potion.`, 'special');
            } else if (item.type === 'mana') {
                state.player.mana = Math.min(state.player.maxMana, state.player.mana + 40);
                addLog(`💧 Bought Mana Potion. +40 MP.`, 'special');
            } else if (item.type === 'scroll') {
                state.inventory.scrolls.push(item.spell);
                addLog(`📜 Bought ${item.name}.`, 'special');
            }
            updateUI();
        }

        
        function saveGame() {
            const data = {
                player: state.player,
                enemiesDefeated: state.enemiesDefeated,
                map: { px: state.map.px, py: state.map.py, enemies: state.map.enemies, treasures: state.map.treasures },
                inventory: state.inventory,
                inBattle: false
            };
            localStorage.setItem('arcane_duel_save', JSON.stringify(data));
            addLog('💾 Game saved.', 'special');
        }

        function loadGame() {
            const raw = localStorage.getItem('arcane_duel_save');
            if (!raw) { addLog('❌ No save found.', 'enemy'); return; }
            try {
                const data = JSON.parse(raw);
                Object.assign(state.player, data.player);
                state.enemiesDefeated = data.enemiesDefeated || 0;
                state.map.px = data.map.px ?? 5;
                state.map.py = data.map.py ?? 5;
                state.map.enemies = data.map.enemies || [];
                state.map.treasures = data.map.treasures || [];
                state.inventory = data.inventory || { scrolls: [] };
                state.inBattle = false;
                state.enemy = null;
                generateMap();
                updateUI();
                addLog('📂 Game loaded.', 'special');
            } catch(e) { addLog('❌ Load failed.', 'enemy'); }
        }

        
        function init() {
            
            state.map.px = 5; state.map.py = 5;
            generateMap();
            state.inBattle = false;
            state.enemy = null;
            
            for (const [key, btn] of Object.entries(spellBtns)) {
                if (btn) btn.addEventListener('click', () => playerCast(key));
            }
            nextEnemyBtn.addEventListener('click', () => {
                if (state.inBattle) { addLog('⚔️ Already in battle!', 'enemy'); return; }
                startBattle();
                updateUI();
            });
            restBtn.addEventListener('click', rest);
            potionBtn.addEventListener('click', usePotion);
            returnMapBtn.addEventListener('click', () => {
                if (state.inBattle) { addLog('⚔️ Finish the battle first!', 'enemy'); return; }
                renderMap();
                addLog('🗺️ Back to the map.', 'special');
            });
            $('save-btn').addEventListener('click', saveGame);
            $('load-btn').addEventListener('click', loadGame);

            
            startBattle();
            updateUI();
            addLog('⚡ Arcane Duel reworked: explore, fight, and master spells!', 'special');
        }

        
        window.__state = state;
        init();
    })();