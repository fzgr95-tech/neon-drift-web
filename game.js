/**
 * NEON DRIFT - Web Version
 * Cyberpunk Endless Runner Game
 * HTML5 Canvas + JavaScript
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

const GAME_CONFIG = {
    LANE_COUNT: 3,
    INITIAL_SPEED: 5,
    MAX_SPEED: 20,
    SPEED_INCREMENT: 0.003,
    OBSTACLE_SPAWN_RATE: 90,
    POWERUP_SPAWN_RATE: 400,
    COIN_SPAWN_RATE: 150,
    PLAYER_WIDTH: 40,
    PLAYER_HEIGHT: 70
};

const STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
};

// ============ GAME CLASS ============
class NeonDrift {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Game state
        this.state = STATES.MENU;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neonDriftHighScore')) || 0;
        this.coins = parseInt(localStorage.getItem('neonDriftCoins')) || 0;
        this.gameSpeed = GAME_CONFIG.INITIAL_SPEED;

        // Road dimensions
        this.roadWidth = this.canvas.width * 0.8;
        this.roadLeft = (this.canvas.width - this.roadWidth) / 2;
        this.laneWidth = this.roadWidth / GAME_CONFIG.LANE_COUNT;

        // Player
        this.player = {
            lane: 1,
            targetLane: 1,
            x: 0,
            y: 0,
            width: GAME_CONFIG.PLAYER_WIDTH,
            height: GAME_CONFIG.PLAYER_HEIGHT,
            moving: false,
            moveProgress: 0,
            shieldActive: false,
            shieldTimer: 0,
            color: COLORS.NEON_CYAN
        };
        this.updatePlayerPosition();

        // Game objects
        this.obstacles = [];
        this.powerups = [];
        this.coins_list = [];
        this.particles = [];
        this.stars = [];

        // Timers
        this.obstacleTimer = 0;
        this.powerupTimer = 0;
        this.coinTimer = 0;

        // Road stripes
        this.roadOffset = 0;

        // Create stars
        this.createStars();

        // Setup controls
        this.setupControls();

        // Animation
        this.animationFrame = 0;

        // Hide loading screen immediately
        try {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
        } catch (e) {
            console.log('Loading screen error:', e);
        }

        // Start game loop
        this.lastTime = 0;
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    resize() {
        const container = document.getElementById('game-container');
        const maxWidth = 450;
        const maxHeight = window.innerHeight;

        let width = Math.min(window.innerWidth, maxWidth);
        let height = maxHeight;

        // Maintain aspect ratio
        const aspectRatio = 9 / 16;
        if (width / height > aspectRatio) {
            width = height * aspectRatio;
        }

        this.canvas.width = width;
        this.canvas.height = height;

        // Update road dimensions
        this.roadWidth = this.canvas.width * 0.75;
        this.roadLeft = (this.canvas.width - this.roadWidth) / 2;
        this.laneWidth = this.roadWidth / GAME_CONFIG.LANE_COUNT;

        this.updatePlayerPosition();
    }

    createStars() {
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 1 + 0.5,
                brightness: Math.random() * 100 + 50
            });
        }
    }

    setupControls() {
        // Touch controls
        const leftZone = document.getElementById('left-zone');
        const rightZone = document.getElementById('right-zone');
        const leftIndicator = document.getElementById('left-indicator');
        const rightIndicator = document.getElementById('right-indicator');

        leftZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            leftIndicator.classList.add('active');
            this.handleInput('left');
        });

        leftZone.addEventListener('touchend', () => {
            leftIndicator.classList.remove('active');
        });

        rightZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            rightIndicator.classList.add('active');
            this.handleInput('right');
        });

        rightZone.addEventListener('touchend', () => {
            rightIndicator.classList.remove('active');
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                this.handleInput('left');
                document.getElementById('left-indicator').classList.add('active');
            } else if (e.key === 'ArrowRight' || e.key === 'd') {
                this.handleInput('right');
                document.getElementById('right-indicator').classList.add('active');
            } else if (e.key === ' ' || e.key === 'Enter') {
                this.handleInput('action');
            } else if (e.key === 'Escape') {
                this.handleInput('pause');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                document.getElementById('left-indicator').classList.remove('active');
            } else if (e.key === 'ArrowRight' || e.key === 'd') {
                document.getElementById('right-indicator').classList.remove('active');
            }
        });

        // Canvas click for menu
        this.canvas.addEventListener('click', () => {
            if (this.state === STATES.MENU || this.state === STATES.GAMEOVER) {
                this.handleInput('action');
            }
        });
    }

    handleInput(direction) {
        if (this.state === STATES.MENU) {
            this.startGame();
        } else if (this.state === STATES.PLAYING) {
            if (direction === 'left' && this.player.lane > 0 && !this.player.moving) {
                this.player.targetLane = this.player.lane - 1;
                this.player.moving = true;
                this.player.moveProgress = 0;
            } else if (direction === 'right' && this.player.lane < GAME_CONFIG.LANE_COUNT - 1 && !this.player.moving) {
                this.player.targetLane = this.player.lane + 1;
                this.player.moving = true;
                this.player.moveProgress = 0;
            } else if (direction === 'pause') {
                this.state = STATES.PAUSED;
            }
        } else if (this.state === STATES.PAUSED) {
            if (direction === 'pause' || direction === 'action') {
                this.state = STATES.PLAYING;
            }
        } else if (this.state === STATES.GAMEOVER) {
            this.startGame();
        }
    }

    startGame() {
        this.state = STATES.PLAYING;
        this.score = 0;
        this.gameSpeed = GAME_CONFIG.INITIAL_SPEED;
        this.player.lane = 1;
        this.player.targetLane = 1;
        this.player.shieldActive = false;
        this.player.moving = false;
        this.updatePlayerPosition();

        this.obstacles = [];
        this.powerups = [];
        this.coins_list = [];
        this.particles = [];

        this.obstacleTimer = 0;
        this.powerupTimer = 0;
        this.coinTimer = 0;
    }

    gameOver() {
        this.state = STATES.GAMEOVER;

        // Save high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neonDriftHighScore', this.highScore);
        }

        // Create explosion particles
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: this.player.x,
                y: this.player.y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 60,
                color: [COLORS.NEON_PINK, COLORS.NEON_CYAN, COLORS.NEON_RED][Math.floor(Math.random() * 3)],
                size: Math.random() * 5 + 2
            });
        }
    }

    getLaneCenter(lane) {
        return this.roadLeft + this.laneWidth * lane + this.laneWidth / 2;
    }

    updatePlayerPosition() {
        this.player.x = this.getLaneCenter(this.player.lane);
        this.player.y = this.canvas.height - 120;
    }

    // ============ UPDATE ============
    update(deltaTime) {
        this.animationFrame++;

        // Update stars
        this.stars.forEach(star => {
            star.y += star.speed * (this.state === STATES.PLAYING ? this.gameSpeed / 3 : 1);
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        });

        // Update road offset
        this.roadOffset += this.state === STATES.PLAYING ? this.gameSpeed : 2;
        if (this.roadOffset > 40) this.roadOffset = 0;

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
        });

        if (this.state !== STATES.PLAYING) return;

        // Player movement
        if (this.player.moving) {
            this.player.moveProgress += 12;
            const startX = this.getLaneCenter(this.player.lane);
            const endX = this.getLaneCenter(this.player.targetLane);
            const t = Math.min(this.player.moveProgress / 100, 1);
            const smoothT = t * t * (3 - 2 * t);
            this.player.x = startX + (endX - startX) * smoothT;

            if (this.player.moveProgress >= 100) {
                this.player.lane = this.player.targetLane;
                this.player.x = this.getLaneCenter(this.player.lane);
                this.player.moving = false;
            }
        }

        // Shield timer
        if (this.player.shieldActive) {
            this.player.shieldTimer--;
            if (this.player.shieldTimer <= 0) {
                this.player.shieldActive = false;
            }
        }

        // Spawn obstacles
        this.obstacleTimer++;
        if (this.obstacleTimer >= GAME_CONFIG.OBSTACLE_SPAWN_RATE - this.gameSpeed * 3) {
            this.spawnObstacle();
            this.obstacleTimer = 0;
        }

        // Spawn coins
        this.coinTimer++;
        if (this.coinTimer >= GAME_CONFIG.COIN_SPAWN_RATE) {
            this.spawnCoin();
            this.coinTimer = 0;
        }

        // Spawn powerups
        this.powerupTimer++;
        if (this.powerupTimer >= GAME_CONFIG.POWERUP_SPAWN_RATE) {
            this.spawnPowerup();
            this.powerupTimer = 0;
        }

        // Update obstacles
        this.obstacles = this.obstacles.filter(obs => {
            obs.y += this.gameSpeed;

            // Check collision
            if (this.checkCollision(this.player, obs)) {
                if (this.player.shieldActive) {
                    this.player.shieldActive = false;
                    this.createExplosion(obs.x, obs.y, COLORS.NEON_GREEN);
                    return false;
                } else {
                    this.gameOver();
                    return true;
                }
            }

            return obs.y < this.canvas.height + 50;
        });

        // Update coins
        this.coins_list = this.coins_list.filter(coin => {
            coin.y += this.gameSpeed;
            coin.rotation += 5;

            if (this.checkCollision(this.player, coin)) {
                this.score += 10;
                this.coins++;
                localStorage.setItem('neonDriftCoins', this.coins);
                this.createExplosion(coin.x, coin.y, COLORS.NEON_YELLOW);
                return false;
            }

            return coin.y < this.canvas.height + 30;
        });

        // Update powerups
        this.powerups = this.powerups.filter(pw => {
            pw.y += this.gameSpeed;
            pw.pulse = (pw.pulse + 0.1) % (Math.PI * 2);

            if (this.checkCollision(this.player, pw)) {
                this.activatePowerup(pw.type);
                this.createExplosion(pw.x, pw.y, pw.color);
                return false;
            }

            return pw.y < this.canvas.height + 40;
        });

        // Update score
        this.score += Math.floor(1 + this.gameSpeed / 5);

        // Increase speed
        this.gameSpeed = Math.min(GAME_CONFIG.MAX_SPEED, this.gameSpeed + GAME_CONFIG.SPEED_INCREMENT);
    }

    spawnObstacle() {
        const lane = Math.floor(Math.random() * GAME_CONFIG.LANE_COUNT);
        this.obstacles.push({
            x: this.getLaneCenter(lane),
            y: -50,
            width: 50,
            height: 35,
            color: COLORS.NEON_RED
        });
    }

    spawnCoin() {
        const lane = Math.floor(Math.random() * GAME_CONFIG.LANE_COUNT);
        this.coins_list.push({
            x: this.getLaneCenter(lane),
            y: -20,
            width: 20,
            height: 20,
            rotation: 0,
            color: COLORS.NEON_YELLOW
        });
    }

    spawnPowerup() {
        const lane = Math.floor(Math.random() * GAME_CONFIG.LANE_COUNT);
        const types = ['shield', 'slowmo'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = {
            shield: COLORS.NEON_GREEN,
            slowmo: COLORS.NEON_BLUE
        };

        this.powerups.push({
            x: this.getLaneCenter(lane),
            y: -30,
            width: 35,
            height: 35,
            type: type,
            color: colors[type],
            pulse: 0
        });
    }

    activatePowerup(type) {
        if (type === 'shield') {
            this.player.shieldActive = true;
            this.player.shieldTimer = 300;
        } else if (type === 'slowmo') {
            this.gameSpeed = Math.max(GAME_CONFIG.INITIAL_SPEED, this.gameSpeed - 5);
        }
    }

    checkCollision(a, b) {
        const padding = 8;
        return a.x - a.width / 2 + padding < b.x + b.width / 2 &&
            a.x + a.width / 2 - padding > b.x - b.width / 2 &&
            a.y - a.height / 2 + padding < b.y + b.height / 2 &&
            a.y + a.height / 2 - padding > b.y - b.height / 2;
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 30,
                color: color,
                size: Math.random() * 4 + 2
            });
        }
    }

    // ============ DRAW ============
    draw() {
        // Clear
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw stars
        this.stars.forEach(star => {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness / 150})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw road
        this.drawRoad();

        // Draw game objects based on state
        if (this.state === STATES.MENU) {
            this.drawMenu();
        } else if (this.state === STATES.PLAYING || this.state === STATES.PAUSED) {
            this.drawGameObjects();
            this.drawHUD();
            if (this.state === STATES.PAUSED) {
                this.drawPause();
            }
        } else if (this.state === STATES.GAMEOVER) {
            this.drawGameObjects();
            this.drawGameOver();
        }

        // Draw particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life / 60;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });
    }

    drawRoad() {
        // Road background
        this.ctx.fillStyle = COLORS.DARK_GRAY;
        this.ctx.fillRect(this.roadLeft, 0, this.roadWidth, this.canvas.height);

        // Road edges (neon glow)
        this.ctx.strokeStyle = COLORS.NEON_PINK;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = COLORS.NEON_PINK;
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(this.roadLeft, 0);
        this.ctx.lineTo(this.roadLeft, this.canvas.height);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(this.roadLeft + this.roadWidth, 0);
        this.ctx.lineTo(this.roadLeft + this.roadWidth, this.canvas.height);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Lane dividers
        this.ctx.setLineDash([30, 20]);
        this.ctx.strokeStyle = COLORS.NEON_CYAN;
        this.ctx.lineWidth = 2;

        for (let i = 1; i < GAME_CONFIG.LANE_COUNT; i++) {
            const x = this.roadLeft + this.laneWidth * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, -this.roadOffset);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        this.ctx.setLineDash([]);
    }

    drawPlayer() {
        const p = this.player;
        const cx = p.x;
        const cy = p.y;

        // Glow
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 15;

        // Car body
        this.ctx.fillStyle = COLORS.DARK_GRAY;
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.moveTo(cx - 18, cy + 30);
        this.ctx.lineTo(cx - 22, cy + 5);
        this.ctx.lineTo(cx - 18, cy - 18);
        this.ctx.lineTo(cx - 8, cy - 32);
        this.ctx.lineTo(cx, cy - 36);
        this.ctx.lineTo(cx + 8, cy - 32);
        this.ctx.lineTo(cx + 18, cy - 18);
        this.ctx.lineTo(cx + 22, cy + 5);
        this.ctx.lineTo(cx + 18, cy + 30);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Windshield
        this.ctx.fillStyle = '#323250';
        this.ctx.beginPath();
        this.ctx.moveTo(cx - 10, cy - 12);
        this.ctx.lineTo(cx - 6, cy - 25);
        this.ctx.lineTo(cx + 6, cy - 25);
        this.ctx.lineTo(cx + 10, cy - 12);
        this.ctx.closePath();
        this.ctx.fill();

        // Headlights
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(cx - 7, cy - 28, 3, 0, Math.PI * 2);
        this.ctx.arc(cx + 7, cy - 28, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Engine lights
        this.ctx.fillStyle = COLORS.NEON_PINK;
        this.ctx.fillRect(cx - 15, cy + 26, 7, 3);
        this.ctx.fillRect(cx + 8, cy + 26, 7, 3);

        this.ctx.shadowBlur = 0;

        // Shield
        if (p.shieldActive) {
            const pulse = Math.sin(this.animationFrame * 0.1) * 0.2 + 0.8;
            this.ctx.globalAlpha = 0.3 * pulse;
            this.ctx.strokeStyle = COLORS.NEON_GREEN;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 45, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
        }
    }

    drawGameObjects() {
        // Draw obstacles
        this.obstacles.forEach(obs => {
            this.ctx.shadowColor = obs.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = COLORS.DARK_GRAY;
            this.ctx.strokeStyle = obs.color;
            this.ctx.lineWidth = 2;

            const x = obs.x - obs.width / 2;
            const y = obs.y - obs.height / 2;
            this.ctx.fillRect(x, y, obs.width, obs.height);
            this.ctx.strokeRect(x, y, obs.width, obs.height);
        });

        // Draw coins
        this.coins_list.forEach(coin => {
            this.ctx.shadowColor = coin.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = coin.color;
            this.ctx.beginPath();
            this.ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = COLORS.WHITE;
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('$', coin.x, coin.y);
        });

        // Draw powerups
        this.powerups.forEach(pw => {
            const pulse = Math.sin(pw.pulse) * 3;
            this.ctx.shadowColor = pw.color;
            this.ctx.shadowBlur = 15 + pulse * 2;
            this.ctx.fillStyle = COLORS.DARK_GRAY;
            this.ctx.strokeStyle = pw.color;
            this.ctx.lineWidth = 2;

            const size = pw.width / 2 + pulse;
            this.ctx.beginPath();
            this.ctx.arc(pw.x, pw.y, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Icon
            this.ctx.fillStyle = pw.color;
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(pw.type === 'shield' ? '🛡️' : '⏱️', pw.x, pw.y);
        });

        this.ctx.shadowBlur = 0;

        // Draw player
        this.drawPlayer();
    }

    drawHUD() {
        // Score
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.shadowColor = COLORS.NEON_CYAN;
        this.ctx.shadowBlur = 10;
        this.ctx.fillText(`${Math.floor(this.score)}`, 20, 40);
        this.ctx.shadowBlur = 0;

        // Coins
        this.ctx.fillStyle = COLORS.NEON_YELLOW;
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`🪙 ${this.coins}`, this.canvas.width - 20, 40);

        // Speed bar
        const barWidth = 80;
        const barHeight = 6;
        const barX = 20;
        const barY = 55;
        const speedPercent = (this.gameSpeed - GAME_CONFIG.INITIAL_SPEED) / (GAME_CONFIG.MAX_SPEED - GAME_CONFIG.INITIAL_SPEED);

        this.ctx.fillStyle = COLORS.DARK_GRAY;
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        this.ctx.fillStyle = COLORS.NEON_PINK;
        this.ctx.fillRect(barX, barY, barWidth * speedPercent, barHeight);
    }

    drawMenu() {
        // Title
        this.ctx.textAlign = 'center';

        // NEON
        this.ctx.fillStyle = COLORS.NEON_PINK;
        this.ctx.font = 'bold 48px Arial';
        this.ctx.shadowColor = COLORS.NEON_PINK;
        this.ctx.shadowBlur = 20;
        this.ctx.fillText('NEON', this.canvas.width / 2 - 70, 150);

        // DRIFT
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.shadowColor = COLORS.NEON_CYAN;
        this.ctx.fillText('DRIFT', this.canvas.width / 2 + 70, 150);
        this.ctx.shadowBlur = 0;

        // High score
        this.ctx.fillStyle = COLORS.NEON_YELLOW;
        this.ctx.font = '18px Arial';
        this.ctx.fillText(`En Yüksek: ${this.highScore}`, this.canvas.width / 2, 220);

        // Coins
        this.ctx.fillStyle = COLORS.NEON_YELLOW;
        this.ctx.fillText(`🪙 ${this.coins}`, this.canvas.width / 2, 250);

        // Start prompt
        const pulse = Math.sin(this.animationFrame * 0.05) * 0.3 + 0.7;
        this.ctx.globalAlpha = pulse;
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '20px Arial';
        this.ctx.fillText('DOKUNARAK BAŞLA', this.canvas.width / 2, this.canvas.height - 150);
        this.ctx.globalAlpha = 1;

        // Controls hint
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Sol/Sağ dokunarak yön değiştir', this.canvas.width / 2, this.canvas.height - 100);
    }

    drawPause() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = COLORS.NEON_CYAN;
        this.ctx.shadowBlur = 15;
        this.ctx.fillText('DURAKLADI', this.canvas.width / 2, this.canvas.height / 2 - 20);
        this.ctx.shadowBlur = 0;

        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Devam etmek için dokun', this.canvas.width / 2, this.canvas.height / 2 + 30);
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.textAlign = 'center';

        // Game Over text
        this.ctx.fillStyle = COLORS.NEON_RED;
        this.ctx.font = 'bold 36px Arial';
        this.ctx.shadowColor = COLORS.NEON_RED;
        this.ctx.shadowBlur = 15;
        this.ctx.fillText('OYUN BİTTİ', this.canvas.width / 2, this.canvas.height / 2 - 60);
        this.ctx.shadowBlur = 0;

        // Score
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Skor: ${Math.floor(this.score)}`, this.canvas.width / 2, this.canvas.height / 2);

        // High score
        if (this.score >= this.highScore) {
            this.ctx.fillStyle = COLORS.NEON_YELLOW;
            this.ctx.fillText('🏆 YENİ REKOR!', this.canvas.width / 2, this.canvas.height / 2 + 40);
        }

        // Restart
        const pulse = Math.sin(this.animationFrame * 0.05) * 0.3 + 0.7;
        this.ctx.globalAlpha = pulse;
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Tekrar oynamak için dokun', this.canvas.width / 2, this.canvas.height / 2 + 100);
        this.ctx.globalAlpha = 1;
    }

    // ============ GAME LOOP ============
    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// ============ INITIALIZE ============
window.addEventListener('load', () => {
    new NeonDrift();
});
