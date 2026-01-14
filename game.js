/**
 * NEON DRIFT - Full Web Version
 * Cyberpunk Endless Runner Game
 */

// ============ CONSTANTS ============
const COLORS = {
    BLACK: '#0a0a0f',
    NEON_PINK: '#ff00ff',
    NEON_CYAN: '#00ffff',
    NEON_BLUE: '#0096ff',
    NEON_PURPLE: '#b400ff',
    NEON_RED: '#ff3366',
    NEON_ORANGE: '#ff6400',
    NEON_GREEN: '#00ff64',
    NEON_YELLOW: '#ffff00',
    WHITE: '#ffffff',
    DARK_GRAY: '#1e1e28'
};

const VEHICLES = {
    sport: { name: "Spor", price: 0, desc: "Standart Hız" },
    suv: { name: "SUV", price: 300, desc: "Daha Dayanıklı" },
    moto: { name: "Motor", price: 400, desc: "Çevik" },
    future: { name: "Gelecek", price: 600, desc: "Maksimum Hız" },
    retro: { name: "Retro", price: 500, desc: "Klasik Stil" }
};

const THEMES = {
    default: { name: "Varsayılan", price: 0, primary: COLORS.NEON_CYAN, secondary: COLORS.NEON_PINK },
    ocean: { name: "Okyanus", price: 100, primary: COLORS.NEON_BLUE, secondary: COLORS.NEON_CYAN },
    emerald: { name: "Zümrüt", price: 150, primary: COLORS.NEON_GREEN, secondary: COLORS.NEON_CYAN },
    fire: { name: "Ateş", price: 200, primary: COLORS.NEON_RED, secondary: COLORS.NEON_ORANGE },
    gold: { name: "Altın", price: 250, primary: COLORS.NEON_YELLOW, secondary: COLORS.NEON_ORANGE },
    rainbow: { name: "Gökkuşağı", price: 500, primary: null, secondary: null } // Special
};

const STATES = {
    MENU: 'menu',
    GARAGE: 'garage',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
};

// ============ GARAGE SYSTEM ============
class GarageManager {
    constructor() {
        this.loadData();
    }

    loadData() {
        const data = JSON.parse(localStorage.getItem('neonDriftData')) || {
            coins: 0,
            ownedVehicles: ['sport'],
            ownedColors: ['default'],
            currentVehicle: 'sport',
            currentColor: 'default',
            highScore: 0
        };
        this.data = data;
    }

    saveData() {
        localStorage.setItem('neonDriftData', JSON.stringify(this.data));
    }

    addCoins(amount) {
        this.data.coins += amount;
        this.saveData();
    }

    buyVehicle(id) {
        const vehicle = VEHICLES[id];
        if (this.data.coins >= vehicle.price && !this.data.ownedVehicles.includes(id)) {
            this.data.coins -= vehicle.price;
            this.data.ownedVehicles.push(id);
            this.saveData();
            return true;
        }
        return false;
    }

    buyColor(id) {
        const color = THEMES[id];
        if (this.data.coins >= color.price && !this.data.ownedColors.includes(id)) {
            this.data.coins -= color.price;
            this.data.ownedColors.push(id);
            this.saveData();
            return true;
        }
        return false;
    }

    selectVehicle(id) {
        if (this.data.ownedVehicles.includes(id)) {
            this.data.currentVehicle = id;
            this.saveData();
        }
    }

    selectColor(id) {
        if (this.data.ownedColors.includes(id)) {
            this.data.currentColor = id;
            this.saveData();
        }
    }

    getCurrentColors() {
        const themeId = this.data.currentColor;
        if (themeId === 'rainbow') {
            const hue = (Date.now() / 20) % 360;
            return {
                primary: `hsl(${hue}, 100%, 50%)`,
                secondary: `hsl(${(hue + 180) % 360}, 100%, 50%)`
            };
        }
        return {
            primary: THEMES[themeId].primary,
            secondary: THEMES[themeId].secondary
        };
    }
}

// ============ GAME CLASS ============
class NeonDrift {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.garage = new GarageManager();

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.state = STATES.MENU;
        this.score = 0;
        this.speed = 5;
        this.roadOffset = 0;

        // Touch
        this.touchStartX = 0;
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKey(e));

        // Player
        this.player = {
            lane: 1,
            targetLane: 1,
            x: 0,
            y: 0,
            moving: false,
            moveProgress: 0,
            shield: 0
        };

        // Objects
        this.obstacles = [];
        this.coins = [];
        this.powerups = [];
        this.particles = [];
        this.timers = { obstacle: 0, coin: 0, powerup: 0 };

        // Menu/Garage UI state
        this.garageTab = 0; // 0: Vehicles, 1: Colors
        this.garageIndex = 0;

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        // Keep 9:16 aspect ratio or fill screen
        const aspect = 9 / 16;
        let w = window.innerWidth;
        let h = window.innerHeight;

        if (w / h > aspect) {
            w = h * aspect;
        }

        this.canvas.width = w;
        this.canvas.height = h;

        this.roadWidth = w * 0.8;
        this.roadLeft = (w - this.roadWidth) / 2;
        this.laneWidth = this.roadWidth / 3;

        this.player.y = h - 120;
        this.player.x = this.getLaneX(this.player.lane);
    }

    getLaneX(lane) {
        return this.roadLeft + this.laneWidth * lane + this.laneWidth / 2;
    }

    // --- INPUT HANDLING ---
    handleTouchStart(e) {
        e.preventDefault();
        this.touchStartX = e.touches[0].clientX;

        // Menu/Garage taps
        if (this.state === STATES.MENU) {
            const y = e.touches[0].clientY;
            // Garage button area (top left/right)
            if (y < 100 && e.touches[0].clientX > this.canvas.width - 60) {
                this.state = STATES.GARAGE;
                return;
            }
            this.startGame();
        } else if (this.state === STATES.GAMEOVER) {
            this.state = STATES.MENU;
        } else if (this.state === STATES.GARAGE) {
            // Simple tap zones for garage
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            const w = this.canvas.width;
            const h = this.canvas.height;

            // Back button
            if (y < 60 && x < 60) {
                this.state = STATES.MENU;
                return;
            }

            // Tab switch
            if (y > 80 && y < 140) {
                this.garageTab = x < w / 2 ? 0 : 1;
                this.garageIndex = 0;
                return;
            }

            // Arrows
            if (y > h / 2 && y < h / 2 + 100) {
                if (x < 80) this.garageNav(-1);
                else if (x > w - 80) this.garageNav(1);
            }

            // Buy/Select button
            if (y > h - 150) {
                this.garageAction();
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const endX = e.changedTouches[0].clientX;
        const diff = endX - this.touchStartX;

        if (this.state === STATES.PLAYING) {
            if (Math.abs(diff) > 30) {
                if (diff < 0) this.movePlayer(-1);
                else this.movePlayer(1);
            }
        }
    }

    handleKey(e) {
        if (this.state === STATES.PLAYING) {
            if (e.key === 'ArrowLeft') this.movePlayer(-1);
            if (e.key === 'ArrowRight') this.movePlayer(1);
        } else if (this.state === STATES.MENU) {
            if (e.key === 'Enter') this.startGame();
            if (e.key === 'g') this.state = STATES.GARAGE;
        } else if (this.state === STATES.GARAGE) {
            if (e.key === 'Escape') this.state = STATES.MENU;
            if (e.key === 'ArrowLeft') this.garageNav(-1);
            if (e.key === 'ArrowRight') this.garageNav(1);
            if (e.key === 'Enter') this.garageAction();
            if (e.key === 'Tab') {
                e.preventDefault();
                this.garageTab = 1 - this.garageTab;
                this.garageIndex = 0;
            }
        } else if (this.state === STATES.GAMEOVER) {
            if (e.key === 'Enter') this.state = STATES.MENU;
        }
    }

    handleClick(e) {
        // Desktop mouse clicks
        if (this.state === STATES.GARAGE) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Logic similar to touch
            if (y < 60 && x < 60) { this.state = STATES.MENU; return; }
            if (y > 80 && y < 140) { this.garageTab = x < this.canvas.width / 2 ? 0 : 1; this.garageIndex = 0; return; }
            if (y > this.canvas.height / 2 && y < this.canvas.height / 2 + 100) {
                if (x < 80) this.garageNav(-1);
                else if (x > this.canvas.width - 80) this.garageNav(1);
            }
            if (y > this.canvas.height - 150) this.garageAction();
        } else if (this.state === STATES.MENU) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (y < 100 && x > this.canvas.width - 60) {
                this.state = STATES.GARAGE;
            } else {
                this.startGame();
            }
        }
    }

    // --- GAME LOGIC ---
    movePlayer(dir) {
        const newLane = this.player.lane + dir;
        if (newLane >= 0 && newLane <= 2 && !this.player.moving) {
            this.player.targetLane = newLane;
            this.player.moving = true;
            this.player.moveProgress = 0;
        }
    }

    startGame() {
        this.state = STATES.PLAYING;
        this.score = 0;
        this.speed = 5;
        this.player.lane = 1;
        this.player.targetLane = 1;
        this.player.x = this.getLaneX(1);
        this.player.moving = false;
        this.player.shield = 0;

        this.obstacles = [];
        this.coins = [];
        this.powerups = [];
        this.particles = [];
    }

    gameOver() {
        this.state = STATES.GAMEOVER;
        if (this.score > this.garage.data.highScore) {
            this.garage.data.highScore = Math.floor(this.score);
            this.garage.saveData();
        }
        // Save score as coins (10% conversion)
        const earned = Math.floor(this.score / 10);
        this.garage.addCoins(earned);
    }

    spawnObjects() {
        // Obstacles
        this.timers.obstacle++;
        const spawnRate = Math.max(30, 90 - this.speed * 2);
        if (this.timers.obstacle > spawnRate) {
            const lane = Math.floor(Math.random() * 3);
            this.obstacles.push({ x: this.getLaneX(lane), y: -50, w: 40, h: 30 });
            this.timers.obstacle = 0;
        }

        // Coins
        this.timers.coin++;
        if (this.timers.coin > 60) {
            if (Math.random() < 0.3) {
                const lane = Math.floor(Math.random() * 3);
                this.coins.push({ x: this.getLaneX(lane), y: -30 });
            }
            this.timers.coin = 0;
        }

        // Powerups
        this.timers.powerup++;
        if (this.timers.powerup > 500) {
            const lane = Math.floor(Math.random() * 3);
            const type = Math.random() < 0.5 ? 'shield' : 'slow';
            this.powerups.push({ x: this.getLaneX(lane), y: -30, type: type });
            this.timers.powerup = 0;
        }
    }

    update() {
        if (this.state !== STATES.PLAYING) return;

        this.speed = Math.min(20, this.speed + 0.002);
        this.score += this.speed / 10;
        this.roadOffset = (this.roadOffset + this.speed) % 40;

        // Player move
        if (this.player.moving) {
            this.player.moveProgress += 15;
            const start = this.getLaneX(this.player.lane);
            const end = this.getLaneX(this.player.targetLane);
            const t = Math.min(this.player.moveProgress / 100, 1);
            this.player.x = start + (end - start) * t; // Linear is safer for mobile

            if (this.player.moveProgress >= 100) {
                this.player.lane = this.player.targetLane;
                this.player.moving = false;
            }
        }

        if (this.player.shield > 0) this.player.shield--;

        this.spawnObjects();

        // Update Obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let o = this.obstacles[i];
            o.y += this.speed;

            if (this.checkCollision(this.player, o, 30)) {
                if (this.player.shield > 0) {
                    this.player.shield = 0;
                    this.obstacles.splice(i, 1);
                    this.addParticles(o.x, o.y, COLORS.NEON_RED);
                } else {
                    this.gameOver();
                }
            } else if (o.y > this.canvas.height + 50) {
                this.obstacles.splice(i, 1);
            }
        }

        // Update Coins
        for (let i = this.coins.length - 1; i >= 0; i--) {
            let c = this.coins[i];
            c.y += this.speed;
            if (this.checkCollision(this.player, c, 40)) {
                this.garage.addCoins(1);
                this.score += 50;
                this.coins.splice(i, 1);
            } else if (c.y > this.canvas.height + 50) this.coins.splice(i, 1);
        }

        // Powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            let p = this.powerups[i];
            p.y += this.speed;
            if (this.checkCollision(this.player, p, 40)) {
                if (p.type === 'shield') this.player.shield = 300;
                else this.speed = Math.max(5, this.speed - 5);
                this.powerups.splice(i, 1);
            } else if (p.y > this.canvas.height + 50) this.powerups.splice(i, 1);
        }
    }

    checkCollision(p, o, dist) {
        return Math.abs(p.x - o.x) < dist && Math.abs(p.y - o.y) < dist;
    }

    addParticles(x, y, color) {
        // Simple placeholder
    }

    // --- GARAGE LOGIC ---
    garageNav(dir) {
        const list = this.garageTab === 0 ? Object.keys(VEHICLES) : Object.keys(THEMES);
        let idx = this.garageIndex + dir;
        if (idx < 0) idx = list.length - 1;
        if (idx >= list.length) idx = 0;
        this.garageIndex = idx;
    }

    garageAction() {
        const list = this.garageTab === 0 ? Object.keys(VEHICLES) : Object.keys(THEMES);
        const id = list[this.garageIndex];

        if (this.garageTab === 0) {
            if (this.garage.data.ownedVehicles.includes(id)) {
                this.garage.selectVehicle(id);
            } else {
                this.garage.buyVehicle(id);
            }
        } else {
            if (this.garage.data.ownedColors.includes(id)) {
                this.garage.selectColor(id);
            } else {
                this.garage.buyColor(id);
            }
        }
    }

    // --- DRAWING ---
    loop(t) {
        this.update();
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    draw() {
        // BG
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawRoad();

        if (this.state === STATES.MENU) this.drawMenu();
        else if (this.state === STATES.GARAGE) this.drawGarage();
        else if (this.state === STATES.PLAYING) {
            this.drawGameObjects();
            this.drawHUD();
        } else if (this.state === STATES.GAMEOVER) {
            this.drawGameObjects();
            this.drawGameOver();
        }
    }

    drawRoad() {
        this.ctx.fillStyle = COLORS.DARK_GRAY;
        this.ctx.fillRect(this.roadLeft, 0, this.roadWidth, this.canvas.height);

        this.ctx.strokeStyle = COLORS.NEON_PINK;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.roadLeft, 0);
        this.ctx.lineTo(this.roadLeft, this.canvas.height);
        this.ctx.moveTo(this.roadLeft + this.roadWidth, 0);
        this.ctx.lineTo(this.roadLeft + this.roadWidth, this.canvas.height);
        this.ctx.stroke();

        this.ctx.strokeStyle = COLORS.NEON_CYAN;
        this.ctx.setLineDash([30, 20]);
        for (let i = 1; i < 3; i++) {
            const x = this.getLaneX(i) - this.laneWidth / 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, -this.roadOffset);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        this.ctx.setLineDash([]);
    }

    drawPlayer(x, y, scale = 1) {
        const colors = this.garage.getCurrentColors();
        const type = this.garage.data.currentVehicle;
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.scale(scale, scale);

        // Glow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = colors.primary;

        this.ctx.fillStyle = COLORS.DARK_GRAY;
        this.ctx.strokeStyle = colors.primary;
        this.ctx.lineWidth = 3;

        this.ctx.beginPath();
        if (type === 'sport') {
            this.ctx.moveTo(-18, 30); this.ctx.lineTo(-22, 0); this.ctx.lineTo(-15, -25);
            this.ctx.lineTo(0, -35); this.ctx.lineTo(15, -25); this.ctx.lineTo(22, 0); this.ctx.lineTo(18, 30);
        } else if (type === 'suv') {
            this.ctx.rect(-20, -30, 40, 65);
        } else if (type === 'moto') {
            this.ctx.moveTo(-10, 30); this.ctx.lineTo(-10, -25); this.ctx.lineTo(0, -35);
            this.ctx.lineTo(10, -25); this.ctx.lineTo(10, 30);
        } else if (type === 'future') {
            this.ctx.moveTo(-20, 30); this.ctx.lineTo(0, -40); this.ctx.lineTo(20, 30);
        } else { // retro
            this.ctx.roundRect(-20, -30, 40, 60, 5);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Accents
        this.ctx.fillStyle = colors.secondary;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Shield
        if (this.player.shield > 0) {
            this.ctx.strokeStyle = COLORS.NEON_GREEN;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 45, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    drawGameObjects() {
        this.coins.forEach(c => {
            this.ctx.fillStyle = COLORS.NEON_YELLOW;
            this.ctx.beginPath(); this.ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.fillStyle = COLORS.BLACK; this.ctx.fillText('$', c.x - 3, c.y + 4);
        });

        this.powerups.forEach(p => {
            this.ctx.fillStyle = p.type === 'shield' ? COLORS.NEON_GREEN : COLORS.NEON_BLUE;
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.fillStyle = COLORS.BLACK; this.ctx.fillText(p.type === 'shield' ? 'S' : 'T', p.x - 4, p.y + 4);
        });

        this.obstacles.forEach(o => {
            this.ctx.fillStyle = COLORS.DARK_GRAY;
            this.ctx.strokeStyle = COLORS.NEON_RED;
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = COLORS.NEON_RED;
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(o.x - 20, o.y - 15, 40, 30);
            this.ctx.strokeRect(o.x - 20, o.y - 15, 40, 30);
            this.ctx.shadowBlur = 0;
        });

        this.drawPlayer(this.player.x, this.player.y);
    }

    drawHUD() {
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.font = "bold 24px Arial";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`Skor: ${Math.floor(this.score)}`, 20, 40);

        this.ctx.textAlign = "right";
        this.ctx.fillStyle = COLORS.NEON_YELLOW;
        this.ctx.fillText(`🪙 ${this.garage.data.coins}`, this.canvas.width - 20, 40);
    }

    drawMenu() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        this.ctx.textAlign = "center";
        this.ctx.font = "bold 40px Arial";
        this.ctx.fillStyle = COLORS.NEON_PINK;
        this.ctx.fillText("NEON", cx, cy - 60);
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.fillText("DRIFT", cx, cy - 20);

        this.ctx.font = "20px Arial";
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.fillText("Başlamak İçin Dokun", cx, cy + 50);

        // Garage Button
        this.ctx.font = "30px Arial";
        this.ctx.fillText("🚗", this.canvas.width - 40, 50);
        this.ctx.font = "12px Arial";
        this.ctx.fillText("Garaj", this.canvas.width - 40, 70);
    }

    drawGarage() {
        const cx = this.canvas.width / 2;

        // Header
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.textAlign = "center";
        this.ctx.font = "bold 30px Arial";
        this.ctx.fillStyle = COLORS.NEON_YELLOW;
        this.ctx.fillText("GARAJ", cx, 50);

        this.ctx.font = "20px Arial";
        this.ctx.fillText(`🪙 ${this.garage.data.coins}`, cx, 80);

        // Tabs
        this.ctx.fillStyle = this.garageTab === 0 ? COLORS.NEON_CYAN : COLORS.DARK_GRAY;
        this.ctx.fillText("ARAÇLAR", cx - 80, 120);
        this.ctx.fillStyle = this.garageTab === 1 ? COLORS.NEON_CYAN : COLORS.DARK_GRAY;
        this.ctx.fillText("RENKLER", cx + 80, 120);

        // Item Display
        const list = this.garageTab === 0 ? Object.keys(VEHICLES) : Object.keys(THEMES);
        const id = list[this.garageIndex];
        const item = this.garageTab === 0 ? VEHICLES[id] : THEMES[id];

        this.ctx.font = "bold 24px Arial";
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.fillText(item.name.toUpperCase(), cx, 180);

        // Preview
        const previewY = 260;
        if (this.garageTab === 0) {
            // Temp swap current vehicle for preview
            const old = this.garage.data.currentVehicle;
            this.garage.data.currentVehicle = id;
            this.drawPlayer(cx, previewY, 1.5);
            this.garage.data.currentVehicle = old;
        } else {
            // Color preview circle
            this.ctx.fillStyle = item.primary || `hsl(${(Date.now() / 20) % 360},100%,50%)`;
            this.ctx.beginPath(); this.ctx.arc(cx, previewY, 40, 0, Math.PI * 2); this.ctx.fill();
        }

        // Info
        this.ctx.font = "16px Arial";
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        if (item.desc) this.ctx.fillText(item.desc, cx, 350);

        // Buy/Select Button
        const isOwned = this.garageTab === 0
            ? this.garage.data.ownedVehicles.includes(id)
            : this.garage.data.ownedColors.includes(id);

        const isSelected = this.garageTab === 0
            ? this.garage.data.currentVehicle === id
            : this.garage.data.currentColor === id;

        let btnText = `SATIN AL (${item.price})`;
        let btnColor = COLORS.NEON_RED;

        if (isOwned) {
            btnText = isSelected ? "SEÇİLİ" : "SEÇ";
            btnColor = isSelected ? COLORS.NEON_GREEN : COLORS.NEON_BLUE;
        } else if (this.garage.data.coins >= item.price) {
            btnColor = COLORS.NEON_YELLOW;
        }

        // Button Box
        this.ctx.fillStyle = btnColor;
        this.ctx.fillRect(cx - 100, this.canvas.height - 150, 200, 50);
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.font = "bold 20px Arial";
        this.ctx.fillText(btnText, cx, this.canvas.height - 118);

        // Navigation Arrows
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = "40px Arial";
        this.ctx.fillText("←", 40, this.canvas.height / 2 + 50);
        this.ctx.fillText("→", this.canvas.width - 40, this.canvas.height / 2 + 50);

        // Back Button
        this.ctx.font = "30px Arial";
        this.ctx.fillText("🔙", 30, 40);
    }

    drawGameOver() {
        this.ctx.fillStyle = "rgba(0,0,0,0.8)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        this.ctx.textAlign = "center";
        this.ctx.font = "bold 40px Arial";
        this.ctx.fillStyle = COLORS.NEON_RED;
        this.ctx.fillText("OYUN BİTTİ", cx, cy - 50);

        this.ctx.font = "24px Arial";
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.fillText(`Skor: ${Math.floor(this.score)}`, cx, cy);

        this.ctx.fillStyle = COLORS.NEON_YELLOW;
        this.ctx.fillText(`Toplam Altın: ${this.garage.data.coins}`, cx, cy + 40);

        this.ctx.font = "18px Arial";
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.fillText("Tekrar Oyna", cx, cy + 100);
    }
}

// Start
window.onload = () => new NeonDrift();
