const Game = {
            state: {
                money: 100,
                loan: 0,
                day: 1,
                inventory: [], 
                reputation: 20,
                artUnlocked: false,
                timeLeft: 15,
                activeCustomers: [],
                currentQuest: null,
                questCompleted: false,
                moneyEarnedSinceQuestStart: 0,
                dailyEvent: null
            },
            config: {
                DAY_DURATION: 15,
                CUSTOMER_PATIENCE: 7000,
                LOAN_AMOUNT: 250,
                LOAN_REPAYMENT: 300,
                LOAN_TERM_DAYS: 30
            },
            shopItems: [
                { id: 1, name: "Coffee", cost: 5, sellPrice: 10, icon: "fas fa-coffee", description: "Hot brewed coffee", color: "#6f4e37" },
                { id: 2, name: "Sandwich", cost: 8, sellPrice: 15, icon: "fas fa-bread-slice", description: "Fresh deli sandwich", color: "#ffb347" },
                { id: 3, name: "Book", cost: 12, sellPrice: 25, icon: "fas fa-book", description: "Bestselling novel", color: "#8b4513" },
                { id: 4, name: "Painting Supplies", cost: 50, sellPrice: 0, unlocksArt: true, icon: "fas fa-paint-brush", description: "Unlocks art studio", color: "#a777e3" }
            ],
            quests: [
                { description: "Sell 3 coffees", targetItem: "Coffee", targetCount: 3, reward: 30, progress: 0 },
                { description: "Sell 2 sandwiches", targetItem: "Sandwich", targetCount: 2, reward: 30, progress: 0 },
                { description: "Sell 1 book", targetItem: "Book", targetCount: 1, reward: 25, progress: 0 },
                { description: "Create 2 paintings", targetItem: "Painting", targetCount: 2, reward: 100, progress: 0 },
                { description: "Earn $50 in one day", targetItem: "Money", targetCount: 50, reward: 75, progress: 0 }
            ],
            dailyEvents: [
                { name: "Rainy Day", description: "Coffee is in high demand! (+50% sell price)", item: "Coffee", multiplier: 1.5 },
                { name: "Heatwave", description: "Everyone wants a quick bite! Sandwiches sell for more. (+30% sell price)", item: "Sandwich", multiplier: 1.3 },
                { name: "Book Fair", description: "Local school visit! Books sell for more. (+40% sell price)", item: "Book", multiplier: 1.4 },
                { name: "Art Exhibition", description: "Art collectors are in town! (+50% sell price)", item: "Painting", multiplier: 1.5 },
                { name: "Normal Day", description: "Business as usual.", item: null, multiplier: 1.0 }
            ],
            dayInterval: null,

            init() {
                this.loadGame();
                this.startDayCycle();
                this.updateUI();
                this.renderShop();
                this.renderInventory();
                this.setupKeyboardShortcuts();

                if (!localStorage.getItem('snd_tutorial_shown')) {
                    this.showTutorial();
                    localStorage.setItem('snd_tutorial_shown', 'true');
                }

                setTimeout(() => {
                    for (let i = 0; i < 2; i++) this.addCustomer();
                }, 1000);
            },

            startSupplyDemand() {
                document.getElementById('homeScreen').style.display = 'none';
                this.init();
            },

            startDayCycle() {
                clearInterval(this.dayInterval);
                this.state.timeLeft = this.config.DAY_DURATION;

                this.dayInterval = setInterval(() => {
                    this.state.timeLeft--;
                    this.updateTimerUI();

                    if (this.state.timeLeft <= 0) {
                        this.nextDay();
                    }

                    this.updateCustomerTimers();

                    if (this.state.timeLeft % 10 === 0) {
                        this.saveGame();
                    }
                }, 1000);
            },

            updateTimerUI() {
                const timeLeftEl = document.getElementById('time-left');
                const timerFillEl = document.getElementById('timer-fill');

                if (timeLeftEl) timeLeftEl.textContent = this.state.timeLeft;
                if (timerFillEl) {
                    const percentage = (this.state.timeLeft / this.config.DAY_DURATION) * 100;
                    timerFillEl.style.width = `${percentage}%`;

                    if (percentage < 25) {
                        timerFillEl.style.background = 'linear-gradient(to right, #ff9800, #f44336)';
                    } else if (percentage < 50) {
                        timerFillEl.style.background = 'linear-gradient(to right, #ffeb3b, #ff9800)';
                    } else {
                        timerFillEl.style.background = 'linear-gradient(to right, var(--primary), var(--secondary))';
                    }
                }
            },

            nextDay() {
                clearInterval(this.dayInterval);
                this.state.day++;

                this.state.activeCustomers.forEach(customer => clearTimeout(customer.timeout));
                this.state.activeCustomers = [];

                const newCustomerCount = Math.floor(this.state.reputation / 20) + Math.floor(Math.random() * 3) + 1;
                this.state.customersWaiting = newCustomerCount;

                
                if (Math.random() < 0.4) {
                    const specialEvents = this.dailyEvents.filter(e => e.name !== "Normal Day");
                    this.state.dailyEvent = specialEvents[Math.floor(Math.random() * specialEvents.length)];
                } else {
                    this.state.dailyEvent = this.dailyEvents.find(e => e.name === "Normal Day");
                }

                for (let i = 0; i < newCustomerCount; i++) {
                    setTimeout(() => this.addCustomer(), i * 800);
                }

                if (this.state.loan > 0 && this.state.day % this.config.LOAN_TERM_DAYS === 0) {
                    if (this.state.money >= this.state.loan) {
                        this.state.money -= this.state.loan;
                        this.state.loan = 0;
                        this.showNotification("Loan paid off automatically!", "success");
                    } else {
                        this.state.reputation = Math.max(0, this.state.reputation - 20);
                        this.showNotification("Failed to pay loan! Reputation -20", "danger");
                    }
                }

                this.showNotification(`Day ${this.state.day} has begun! ${this.state.dailyEvent.name}`, "info");

                this.updateUI();
                this.renderCustomers();
                this.startDayCycle();

                this.state.moneyEarnedSinceQuestStart = 0;
            },

            borrowMoney() {
                if (this.state.loan > 0) {
                    this.showNotification("You already have an outstanding loan!", "warning");
                    return;
                }

                this.state.money += this.config.LOAN_AMOUNT;
                this.state.loan = this.config.LOAN_REPAYMENT;

                this.showNotification(`Borrowed $${this.config.LOAN_AMOUNT}. Repay $${this.config.LOAN_REPAYMENT} in ${this.config.LOAN_TERM_DAYS} days.`, "warning");
                this.updateUI();
            },

            buyItem(itemId, event) {
                const item = this.shopItems.find(i => i.id === itemId);
                if (!item) return;

                if (this.state.money < item.cost) {
                    this.showNotification("Not enough money!", "danger");
                    return;
                }

                this.state.money -= item.cost;
                if (event) this.showFloatingText(`-$${item.cost}`, 'danger', event.clientX, event.clientY);

                if (item.unlocksArt) {
                    this.state.artUnlocked = true;
                    document.getElementById('art-studio').style.display = 'block';
                    this.showNotification("Art studio unlocked! You can now create paintings.", "success");
                    this.renderShop();
                } else {
                    const existing = this.state.inventory.find(i => i.id === item.id);
                    if (existing) {
                        existing.quantity++;
                    } else {
                        this.state.inventory.push({
                            id: item.id, name: item.name, cost: item.cost,
                            sellPrice: item.sellPrice, icon: item.icon, color: item.color, quantity: 1
                        });
                    }
                    this.showNotification(`Bought ${item.name} for $${item.cost}`, "success");
                    this.renderInventory();
                }

                this.updateUI();
            },

            sellItem(itemIndex, event) {
                if (this.state.activeCustomers.length === 0) {
                    this.showNotification("No customers to serve!", "warning");
                    return;
                }

                if (itemIndex < 0 || itemIndex >= this.state.inventory.length) return;

                const item = this.state.inventory[itemIndex];
                const customer = this.state.activeCustomers[0]; 

                let revenue = item.sellPrice;
                
                
                if (this.state.dailyEvent && this.state.dailyEvent.item === item.name) {
                    revenue = Math.floor(revenue * this.state.dailyEvent.multiplier);
                }

                let repChange = 2;
                let isPerfectMatch = false;

                const isPainting = item.name.includes("Painting");
                const customerWantsThis = customer.desiredItem === item.name || (customer.desiredItem === "Painting" && isPainting);

                if (customer && customerWantsThis) {
                    revenue += 5; 
                    repChange += 3;
                    isPerfectMatch = true;
                }

                this.state.money += revenue;
                this.state.reputation = Math.min(100, this.state.reputation + repChange);
                this.state.customersWaiting = Math.max(0, this.state.customersWaiting - 1);

                if (customer) {
                    clearTimeout(customer.timeout);
                    this.state.activeCustomers.shift();
                }

                item.quantity--;
                if (item.quantity <= 0) {
                    this.state.inventory.splice(itemIndex, 1);
                }

                this.updateQuestProgress(item.name, revenue);
                
                if (event) {
                    this.showFloatingText(`+$${revenue}${isPerfectMatch ? ' (Perfect!)' : ''}`, isPerfectMatch ? 'success' : 'info', event.clientX, event.clientY);
                }

                this.updateUI();
                this.renderInventory();
                this.renderCustomers();
            },

            createArt(event) {
                if (!this.state.artUnlocked) return;

                const artValue = Math.floor(Math.random() * 101) + 50; 
                const paintingTypes = ["Abstract", "Portrait", "Landscape", "Modern", "Classic"];
                const paintingType = paintingTypes[Math.floor(Math.random() * paintingTypes.length)];
                const itemName = `${paintingType} Painting`;

                const existing = this.state.inventory.find(i => i.name === itemName);
                if (existing) {
                    const totalValue = (existing.sellPrice * existing.quantity) + artValue;
                    existing.quantity++;
                    existing.sellPrice = Math.floor(totalValue / existing.quantity);
                } else {
                    this.state.inventory.push({
                        id: 100 + Math.floor(Math.random() * 1000),
                        name: itemName, cost: 0, sellPrice: artValue,
                        icon: "fas fa-palette", color: "#a777e3", quantity: 1
                    });
                }

                this.updateQuestProgress("Painting");
                this.showNotification(`Created a ${paintingType} painting worth $${artValue}!`, "success");
                if (event) this.showFloatingText("Art Created!", "info", event.clientX, event.clientY);
                this.renderInventory();
            },

            addCustomer() {
                if (this.state.activeCustomers.length >= 8) return;

                const customerId = Date.now() + Math.random();
                
                let desiredItem = "Coffee";
                const rand = Math.random();
                if (rand < 0.4) desiredItem = "Coffee";
                else if (rand < 0.7) desiredItem = "Sandwich";
                else if (rand < 0.9) desiredItem = "Book";
                else if (this.state.artUnlocked) desiredItem = "Painting";

                const messages = {
                    "Coffee": ["I need a caffeine fix!", "A hot coffee would be perfect.", "Do you have fresh coffee?"],
                    "Sandwich": ["I'm starving, got any sandwiches?", "A quick lunch would be great.", "Do you sell sandwiches?"],
                    "Book": ["Looking for a good read.", "Any interesting books today?", "I love browsing books."],
                    "Painting": ["I'm looking for unique art.", "Do you have any original paintings?", "I want to buy a painting!"]
                };
                
                const arr = messages[desiredItem] || ["I'll have the usual!"];
                const customerMessage = arr[Math.floor(Math.random() * arr.length)];

                const customerIcons = ["fas fa-user", "fas fa-user-tie", "fas fa-user-graduate", "fas fa-user-ninja", "fas fa-user-astronaut", "fas fa-user-md", "fas fa-user-secret"];
                const customerIcon = customerIcons[Math.floor(Math.random() * customerIcons.length)];

                const customer = {
                    id: customerId,
                    icon: customerIcon,
                    message: customerMessage,
                    desiredItem: desiredItem,
                    patience: 100,
                    startTime: Date.now(),
                    timeout: setTimeout(() => {
                        this.state.activeCustomers = this.state.activeCustomers.filter(c => c.id !== customerId);
                        this.state.customersWaiting = Math.max(0, this.state.customersWaiting - 1);
                        this.state.reputation = Math.max(0, this.state.reputation - 1);

                        this.showNotification("A customer left without being served! Reputation -1", "danger");
                        this.updateUI();
                        this.renderCustomers();
                    }, this.config.CUSTOMER_PATIENCE)
                };

                this.state.activeCustomers.push(customer);
                this.renderCustomers();
            },

            updateCustomerTimers() {
                this.state.activeCustomers.forEach(customer => {
                    if (customer.startTime) {
                        const elapsed = Date.now() - customer.startTime;
                        customer.patience = Math.max(0, 100 - (elapsed / this.config.CUSTOMER_PATIENCE * 100));
                    } else {
                        customer.startTime = Date.now();
                    }
                });

                if (this.state.activeCustomers.length > 0) {
                    this.renderCustomers();
                }
            },

            interactWithQuestGiver() {
                if (!this.state.currentQuest) {
                    const availableQuests = this.quests.filter(q => (q.targetItem !== "Painting" || this.state.artUnlocked));

                    if (availableQuests.length > 0) {
                        this.state.currentQuest = { ...availableQuests[Math.floor(Math.random() * availableQuests.length)] };
                        this.state.moneyEarnedSinceQuestStart = 0;
                        this.state.currentQuest.progress = 0;

                        this.showNotification(`New Quest: ${this.state.currentQuest.description}`, "info");
                        this.updateQuestUI();
                    } else {
                        this.showNotification("No quests available right now. Come back later!", "warning");
                    }
                } else if (this.state.questCompleted) {
                    this.state.money += this.state.currentQuest.reward;
                    this.showNotification(`Quest completed! You received $${this.state.currentQuest.reward}`, "success");
                    this.showFloatingText(`+$${this.state.currentQuest.reward}`, 'success', window.innerWidth / 2, window.innerHeight / 2);

                    this.state.currentQuest = null;
                    this.state.questCompleted = false;
                    this.state.moneyEarnedSinceQuestStart = 0;

                    this.updateQuestUI();
                    this.updateUI();
                } else {
                    this.showNotification(`Current Quest: ${this.state.currentQuest.description}\nProgress: ${this.state.currentQuest.progress}/${this.state.currentQuest.targetCount}`, "info");
                }
            },

            updateQuestProgress(itemName, amountEarned = 0) {
                if (!this.state.currentQuest || this.state.questCompleted) return;

                if (this.state.currentQuest.targetItem === "Money") {
                    this.state.moneyEarnedSinceQuestStart += amountEarned;
                    this.state.currentQuest.progress = this.state.moneyEarnedSinceQuestStart;
                } else if (itemName === this.state.currentQuest.targetItem || (this.state.currentQuest.targetItem === "Painting" && itemName.includes("Painting"))) {
                    this.state.currentQuest.progress++;
                }

                if (this.state.currentQuest.progress >= this.state.currentQuest.targetCount) {
                    this.state.questCompleted = true;
                    this.showNotification("Quest completed! Return to the quest giver for your reward.", "success");
                }

                this.updateQuestUI();
            },

            updateQuestUI() {
                const questTitle = document.getElementById('quest-title');
                const questDescription = document.getElementById('quest-description');
                const questProgress = document.getElementById('quest-progress');
                const questProgressBar = document.getElementById('quest-progress-bar');
                const questProgressText = document.getElementById('quest-progress-text');
                const questReward = document.getElementById('quest-reward');

                if (this.state.currentQuest) {
                    questTitle.textContent = "Active Quest";
                    questDescription.textContent = this.state.currentQuest.description;
                    questProgress.style.display = 'block';

                    const progressPercentage = Math.min(100, (this.state.currentQuest.progress / this.state.currentQuest.targetCount) * 100);
                    questProgressBar.style.width = `${progressPercentage}%`;
                    questProgressText.textContent = `${this.state.currentQuest.progress}/${this.state.currentQuest.targetCount}`;
                    questReward.textContent = `Reward: $${this.state.currentQuest.reward}`;
                } else {
                    questTitle.textContent = "No Active Quest";
                    questDescription.textContent = "Talk to the quest giver to get a quest!";
                    questProgress.style.display = 'none';
                }
            },

            showNotification(message, type = "info") {
                const container = document.getElementById('notification-container');
                const notification = document.createElement('div');
                notification.className = `notification ${type}`;

                let icon = "fas fa-info-circle";
                if (type === "success") icon = "fas fa-check-circle";
                if (type === "warning") icon = "fas fa-exclamation-triangle";
                if (type === "danger") icon = "fas fa-times-circle";

                notification.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
                container.appendChild(notification);

                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100%)';
                        setTimeout(() => {
                            if (notification.parentNode) notification.parentNode.removeChild(notification);
                        }, 300);
                    }
                }, 4000);
            },

            showFloatingText(text, type, x, y) {
                const el = document.createElement('div');
                el.className = `floating-text ${type}`;
                el.textContent = text;
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 1200);
            },

            renderShop() {
                const shopContainer = document.getElementById('shop-items');
                const emptyState = document.getElementById('shop-empty');
                if (!shopContainer) return;
                shopContainer.innerHTML = '';

                this.shopItems.forEach(item => {
                    const itemElement = document.createElement('div');
                    const alreadyPurchased = item.unlocksArt && this.state.artUnlocked;
                    itemElement.className = `shop-item ${alreadyPurchased ? 'disabled' : ''}`;
                    itemElement.onclick = (e) => !alreadyPurchased && this.buyItem(item.id, e);

                    itemElement.innerHTML = `
                        <div class="item-icon" >
                            <i class="${item.icon}"></i>
                        </div>
                        <div class="item-info">
                            <div class="item-name">${item.name}</div>
                            <div class="item-desc">${item.description}</div>
                            <div class="item-price">
                                <span class="price-tag">$${item.cost}</span>
                                ${item.sellPrice > 0 ? `<span class="sell-price">Sells for $${item.sellPrice}</span>` : ''}
                                ${item.unlocksArt ? `<span class="art-unlock-status">${alreadyPurchased ? '✓ Purchased' : 'Unlocks Art Studio'}</span>` : ''}
                            </div>
                        </div>
                    `;
                    shopContainer.appendChild(itemElement);
                });

                emptyState.style.display = this.shopItems.length === 0 ? 'block' : 'none';
            },

            renderInventory() {
                const inventoryContainer = document.getElementById('inventory-items');
                const emptyState = document.getElementById('inventory-empty');
                if (!inventoryContainer) return;
                inventoryContainer.innerHTML = '';

                if (this.state.inventory.length === 0) {
                    emptyState.style.display = 'block';
                    return;
                }

                emptyState.style.display = 'none';

                this.state.inventory.forEach((item, index) => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'inventory-item';
                    itemElement.onclick = (e) => this.sellItem(index, e);

                    itemElement.innerHTML = `
                        <div class="item-icon" >
                            <i class="${item.icon || 'fas fa-box'}"></i>
                        </div>
                        <div class="item-info">
                            <div class="item-name">${item.name} <span class="inventory-quantity">x${item.quantity}</span></div>
                            <div class="item-price">
                                <span class="price-tag">Sell for $${item.sellPrice}</span>
                                <span class="inventory-hint">Click to serve</span>
                            </div>
                        </div>
                    `;
                    inventoryContainer.appendChild(itemElement);
                });
            },

            renderCustomers() {
                const customersContainer = document.getElementById('customers-container');
                const emptyState = document.getElementById('customers-empty');
                const waitingCountEl = document.getElementById('customers-waiting');

                if (!customersContainer) return;
                customersContainer.innerHTML = '';

                if (this.state.activeCustomers.length === 0) {
                    emptyState.style.display = 'block';
                    if (waitingCountEl) waitingCountEl.textContent = '0';
                    return;
                }

                emptyState.style.display = 'none';
                if (waitingCountEl) waitingCountEl.textContent = this.state.activeCustomers.length.toString();

                this.state.activeCustomers.forEach(customer => {
                    const customerElement = document.createElement('div');
                    customerElement.className = `customer ${customer.patience < 30 ? 'impatient' : ''}`;
                    customerElement.id = `customer-${customer.id}`;

                    const isLeavingSoon = customer.patience < 15;
                    
                    let desireText = "", desireColor = "var(--primary)";
                    if (customer.desiredItem === "Coffee") { desireText = "☕ Wants Coffee"; desireColor = "#6f4e37"; }
                    else if (customer.desiredItem === "Sandwich") { desireText = "🥪 Wants Sandwich"; desireColor = "#ffb347"; }
                    else if (customer.desiredItem === "Book") { desireText = "📚 Wants Book"; desireColor = "#8b4513"; }
                    else if (customer.desiredItem === "Painting") { desireText = "🎨 Wants Painting"; desireColor = "#a777e3"; }

                    customerElement.innerHTML = `
                        <div class="customer-avatar">
                            <i class="${customer.icon}"></i>
                        </div>
                        <div class="customer-message">"${customer.message}"</div>
                        <div class="desire-text" data-desire-color="${desireColor}">${desireText}</div>
                        <div class="customer-timer">
                            <div class="customer-timer-fill" ></div>
                        </div>
                        ${isLeavingSoon ? '<div class="impatient-warning">Getting impatient!</div>' : ''}
                    `;

                    customersContainer.appendChild(customerElement);
                });
            },

            updateUI() {
                document.getElementById('day').textContent = this.state.day;
                document.getElementById('money').textContent = `$${this.state.money}`;
                document.getElementById('loan').textContent = `$${this.state.loan}`;
                document.getElementById('reputation').textContent = `${this.state.reputation}/100`;

                this.updateTimerUI();

                const reputationEl = document.getElementById('reputation');
                if (this.state.reputation >= 80) reputationEl.style.color = '#2ecc71';
                else if (this.state.reputation >= 50) reputationEl.style.color = '#f39c12';
                else reputationEl.style.color = '#e74c3c';

                const loanStat = document.querySelector('.stat-card:nth-child(3)');
                const existingBadge = loanStat ? loanStat.querySelector('.loan-badge') : null;

                if (this.state.loan > 0 && loanStat && !existingBadge) {
                    const badge = document.createElement('div');
                    badge.className = 'loan-badge';
                    badge.innerHTML = '<i class="fas fa-exclamation"></i>';
                    badge.title = `Loan due in ${this.config.LOAN_TERM_DAYS - (this.state.day % this.config.LOAN_TERM_DAYS)} days`;
                    loanStat.style.position = 'relative';
                    loanStat.appendChild(badge);
                } else if (this.state.loan === 0 && existingBadge) {
                    existingBadge.remove();
                }

                
                const eventPanel = document.getElementById('event-panel');
                const eventDesc = document.getElementById('event-description');
                if (this.state.dailyEvent && this.state.dailyEvent.name !== "Normal Day") {
                    eventPanel.style.display = 'block';
                    eventDesc.textContent = `${this.state.dailyEvent.name}: ${this.state.dailyEvent.description}`;
                } else {
                    eventPanel.style.display = 'none';
                }
            },

            saveGame() {
                const gameState = {
                    money: this.state.money, loan: this.state.loan, day: this.state.day,
                    inventory: this.state.inventory, reputation: this.state.reputation,
                    customersWaiting: this.state.customersWaiting, artUnlocked: this.state.artUnlocked,
                    currentQuest: this.state.currentQuest, questCompleted: this.state.questCompleted,
                    moneyEarnedSinceQuestStart: this.state.moneyEarnedSinceQuestStart
                };
                try { localStorage.setItem('snd_save', JSON.stringify(gameState)); } 
                catch (e) { console.error('Failed to save game:', e); }
            },

            loadGame() {
                try {
                    const saved = localStorage.getItem('snd_save');
                    if (!saved) return;

                    const gameState = JSON.parse(saved);
                    this.state.money = gameState.money ?? this.state.money;
                    this.state.loan = gameState.loan ?? this.state.loan;
                    this.state.day = gameState.day ?? this.state.day;
                    this.state.inventory = gameState.inventory ?? this.state.inventory;
                    this.state.reputation = gameState.reputation ?? this.state.reputation;
                    this.state.customersWaiting = gameState.customersWaiting ?? this.state.customersWaiting;
                    this.state.artUnlocked = gameState.artUnlocked ?? this.state.artUnlocked;
                    this.state.currentQuest = gameState.currentQuest ?? this.state.currentQuest;
                    this.state.questCompleted = gameState.questCompleted ?? this.state.questCompleted;
                    this.state.moneyEarnedSinceQuestStart = gameState.moneyEarnedSinceQuestStart ?? this.state.moneyEarnedSinceQuestStart;

                    if (this.state.artUnlocked) {
                        document.getElementById('art-studio').style.display = 'block';
                    }
                } catch (e) { console.error('Failed to load game:', e); }
            },

            setupKeyboardShortcuts() {
                document.addEventListener('keydown', (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                    switch (e.key.toLowerCase()) {
                        case 'b': e.preventDefault(); this.borrowMoney(); break;
                        case 'n': e.preventDefault(); this.nextDay(); break;
                        case '1': case '2': case '3': case '4':
                            e.preventDefault();
                            const index = parseInt(e.key) - 1;
                            if (index < this.shopItems.length) this.buyItem(this.shopItems[index].id);
                            break;
                        case 'q': e.preventDefault(); this.interactWithQuestGiver(); break;
                        case 's': e.preventDefault(); if (this.state.inventory.length > 0) this.sellItem(0); break;
                        case 'a': e.preventDefault(); if (this.state.artUnlocked) this.createArt(); break;
                        case 'r': e.preventDefault();
                            if (confirm('Reset game? All progress will be lost.')) {
                                localStorage.removeItem('snd_save');
                                localStorage.removeItem('snd_tutorial_shown');
                                location.reload();
                            }
                            break;
                    }
                });
            },

            showTutorial() {
                if (document.getElementById('tutorial-overlay')) return;
                const tutorial = document.createElement('div');
                tutorial.className = 'tutorial-overlay';
                tutorial.id = 'tutorial-overlay';

                tutorial.innerHTML = `
                    <div class="tutorial-content">
                        <h2><i class="fas fa-graduation-cap"></i> Welcome to Supply & Demand!</h2>
                        <p>Manage your shop by buying items at wholesale prices and selling them to customers for profit.</p>
                        
                        <h3 class="tutorial-heading">New Features:</h3>
                        <ul class="tutorial-list">
                            <li><strong>Customer Desires:</strong> Serve customers what they specifically want for a bonus!</li>
                            <li><strong>Daily Events:</strong> Watch for special events that boost specific item prices.</li>
                            <li><strong>Stackable Inventory:</strong> Items now group together to keep your screen clean.</li>
                        </ul>
                        
                        <h3>Keyboard Shortcuts:</h3>
                        <div class="hotkeys">
                            <div class="hotkey-item"><span class="hotkey-key">B</span> Borrow money</div>
                            <div class="hotkey-item"><span class="hotkey-key">N</span> Next day</div>
                            <div class="hotkey-item"><span class="hotkey-key">1-4</span> Buy shop items</div>
                            <div class="hotkey-item"><span class="hotkey-key">Q</span> Talk to quest giver</div>
                            <div class="hotkey-item"><span class="hotkey-key">S</span> Sell first inventory item</div>
                            <div class="hotkey-item"><span class="hotkey-key">A</span> Create art (if unlocked)</div>
                        </div>
                        
                        <button class="btn btn-primary tutorial-close" id="close-tutorial">
                            <i class="fas fa-play"></i> Start Playing!
                        </button>
                    </div>
                `;
                document.body.appendChild(tutorial);
            }
        };

        window.onload = () => {
            
        };

document.getElementById('start-supply-demand')?.addEventListener('click', () => Game.startSupplyDemand());
document.getElementById('borrow-money')?.addEventListener('click', () => Game.borrowMoney());
document.getElementById('next-day')?.addEventListener('click', () => Game.nextDay());
document.getElementById('create-art')?.addEventListener('click', () => Game.createArt());
document.getElementById('quest-giver')?.addEventListener('click', () => Game.interactWithQuestGiver());
document.getElementById('close-tutorial')?.addEventListener('click', () => document.getElementById('tutorial-overlay')?.remove());
