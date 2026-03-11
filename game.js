// Geometry Dash Game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Audio Context
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Sound effects
function playSound(type) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    switch(type) {
        case 'jump':
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'death':
            oscillator.frequency.setValueAtTime(300, now);
            oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            oscillator.stop(now + 0.5);
            break;
    }
}

// Game state
const game = {
    running: false,
    titleScreen: true,
    attempts: 1,
    distance: 0,
    speed: 6,
    cameraX: 0,
    player: {
        x: 150,
        y: 350,
        width: 40,
        height: 40,
        velocityY: 0,
        gravity: 0.8,
        jumpPower: -15,
        onGround: false,
        color: '#00ffff',
        rotation: 0,
        mode: 'cube', // 'cube' or 'ship'
        shipTimer: 0,
        shipWarning: false
    },
    obstacles: [],
    ground: {
        y: 400,
        height: 100
    },
    keys: {},
    particles: [],
    deathAnimation: false,
    deathTimer: 0,
    finishLine: null,
    levelComplete: false
};

// Generate obstacles
function generateObstacles() {
    game.obstacles = [];
    let lastX = 500;

    for (let i = 0; i < 30; i++) {
        const gap = Math.random() * 400 + 300;
        lastX += gap;

        const type = Math.random();

        if (type < 0.15) {
            // Ship portal - switches to flying mode
            game.obstacles.push({
                x: lastX,
                y: game.ground.y - 100,
                width: 30,
                height: 100,
                type: 'ship_portal',
                color: '#ffff00'
            });
        } else if (type < 0.25) {
            // Cube portal - switches back to cube mode
            game.obstacles.push({
                x: lastX,
                y: game.ground.y - 100,
                width: 30,
                height: 100,
                type: 'cube_portal',
                color: '#00ff00'
            });
        } else if (type < 0.45) {
            // Spike
            game.obstacles.push({
                x: lastX,
                y: game.ground.y - 40,
                width: 40,
                height: 40,
                type: 'spike',
                color: '#ff00ff'
            });
        } else if (type < 0.5) {
            // Gap
            game.obstacles.push({
                x: lastX,
                y: game.ground.y,
                width: 120,
                height: game.ground.height,
                type: 'gap',
                color: '#0a0a1a'
            });
        } else {
            // Ladder of platforms - only going up
            const steps = 5;
            const stepSpacing = 120;
            const stepHeight = 60;
            const ladderWidth = steps * stepSpacing;
            const topHeight = game.ground.y - (60 + (steps - 1) * stepHeight);

            // Add spike pit below the ladder - fewer spikes
            for (let spikeX = lastX; spikeX < lastX + ladderWidth; spikeX += 80) {
                game.obstacles.push({
                    x: spikeX,
                    y: game.ground.y - 40,
                    width: 40,
                    height: 40,
                    type: 'spike',
                    color: '#ff00ff'
                });
            }

            // Going up only
            for (let j = 0; j < steps; j++) {
                game.obstacles.push({
                    x: lastX + (j * stepSpacing),
                    y: game.ground.y - (60 + j * stepHeight),
                    width: 100,
                    height: 20,
                    type: 'platform',
                    color: '#00ff00'
                });
            }

            // Add "upstairs" section - just one flat platform at medium height
            const upstairsLength = 20000; // Much longer so it doesn't disappear
            const mediumHeight = game.ground.y - 180; // Medium height, not too high

            game.obstacles.push({
                x: lastX + ladderWidth,
                y: mediumHeight,
                width: upstairsLength,
                height: 20,
                type: 'platform',
                color: '#00ff00'
            });

            // Add spikes on the medium floor - start further away to give landing space, fewer spikes
            for (let obstX = lastX + ladderWidth + 600; obstX < lastX + ladderWidth + upstairsLength; obstX += 500) {
                game.obstacles.push({
                    x: obstX,
                    y: mediumHeight - 40,
                    width: 40,
                    height: 40,
                    type: 'spike',
                    color: '#ff00ff'
                });
            }

            lastX += ladderWidth + upstairsLength;
        }
    }

    // Add finish line at the end
    game.finishLine = {
        x: lastX + 500,
        y: 0,
        width: 60,
        height: game.ground.y
    };
}

// Check collision
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Create explosion particles
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = Math.random() * 5 + 3;
        game.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 6 + 3,
            color: color,
            life: 60,
            maxLife: 60
        });
    }
}

// Update game
function update() {
    // Don't update on title screen or level complete
    if (game.titleScreen || game.levelComplete) return;

    // Handle death animation FIRST (before running check)
    if (game.deathAnimation) {
        game.deathTimer++;

        // Update particles
        game.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.3; // Gravity on particles
            particle.life--;
        });

        game.particles = game.particles.filter(p => p.life > 0);

        // After animation, restart
        if (game.deathTimer > 90) {
            restart();
        }
        return;
    }

    if (!game.running) return;

    const player = game.player;

    // Physics based on mode
    if (player.mode === 'ship') {
        // Increment ship timer
        player.shipTimer++;

        // Check if 50 seconds have passed (50 seconds * 60 fps = 3000 frames)
        if (player.shipTimer >= 2400) { // 40 seconds warning
            player.shipWarning = true;
        }

        if (player.shipTimer >= 3000) { // 50 seconds - switch back to cube
            player.mode = 'cube';
            player.shipTimer = 0;
            player.shipWarning = false;
            playSound('hit');
        }

        // Ship mode - hold to fly up, release to fall
        if (game.keys[' '] || game.keys['click']) {
            player.velocityY -= 1.2; // Fly up
        } else {
            player.velocityY += 0.8; // Fall down
        }

        // Cap velocity
        player.velocityY = Math.max(-10, Math.min(10, player.velocityY));
        player.y += player.velocityY;

        // Rotate ship based on velocity
        player.rotation = player.velocityY * 3;

        // Keep ship in bounds
        if (player.y < 10) {
            player.y = 10;
            player.velocityY = 0;
        }
        if (player.y + player.height > canvas.height - 10) {
            die();
        }

        player.onGround = false;

    } else {
        // Cube mode - normal jumping
        // Apply gravity
        player.velocityY += player.gravity;
        player.y += player.velocityY;

        // Check ground collision
        let onSurface = false;

        if (player.y + player.height >= game.ground.y) {
            player.y = game.ground.y - player.height;
            player.velocityY = 0;
            onSurface = true;
            player.rotation = 0; // Reset rotation on ground
        }

        // Check platform collisions
        game.obstacles.forEach(obstacle => {
            const obstacleScreenX = obstacle.x - game.cameraX;

            if (obstacle.type === 'platform') {
                // Check if player is landing on platform from above
                if (player.velocityY >= 0 &&
                    player.x + player.width > obstacleScreenX &&
                    player.x < obstacleScreenX + obstacle.width &&
                    player.y + player.height >= obstacle.y &&
                    player.y + player.height <= obstacle.y + 20) {

                    player.y = obstacle.y - player.height;
                    player.velocityY = 0;
                    onSurface = true;
                    player.rotation = 0;
                }
            }
        });

        player.onGround = onSurface;

        // Rotate while in air
        if (!player.onGround) {
            player.rotation += 5;
        }

        // Jump
        if ((game.keys[' '] || game.keys['click']) && player.onGround) {
            player.velocityY = player.jumpPower;
            player.onGround = false;
            playSound('jump');
            game.keys['click'] = false; // Prevent continuous jumping from held click
        }
    }

    // Move camera forward
    game.cameraX += game.speed;
    game.distance = Math.floor(game.cameraX / 10);

    // Check collision with obstacles
    game.obstacles.forEach(obstacle => {
        // Adjust obstacle position relative to camera
        const obstacleScreenX = obstacle.x - game.cameraX;

        if (obstacle.type === 'ship_portal') {
            // Switch to ship mode
            if (checkCollision(player, {
                x: obstacleScreenX,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
            })) {
                if (player.mode !== 'ship') {
                    player.mode = 'ship';
                    player.shipTimer = 0;
                    player.shipWarning = false;
                }
            }
        } else if (obstacle.type === 'cube_portal') {
            // Switch to cube mode
            if (checkCollision(player, {
                x: obstacleScreenX,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
            })) {
                player.mode = 'cube';
                player.shipTimer = 0;
                player.shipWarning = false;
            }
        } else if (obstacle.type === 'spike') {
            if (checkCollision(player, {
                x: obstacleScreenX,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
            })) {
                die();
            }
        } else if (obstacle.type === 'gap') {
            // Check if player fell into gap (only in cube mode)
            if (player.mode === 'cube' &&
                player.x + player.width > obstacleScreenX &&
                player.x < obstacleScreenX + obstacle.width &&
                player.y + player.height >= obstacle.y) {
                die();
            }
        }
        // Platforms are not deadly - player lands on them
    });

    // Check if player fell off screen
    if (player.y > canvas.height) {
        die();
    }

    // Check finish line collision
    if (game.finishLine) {
        const finishScreenX = game.finishLine.x - game.cameraX;
        if (player.x + player.width >= finishScreenX &&
            player.x <= finishScreenX + game.finishLine.width) {
            levelComplete();
        }
    }

    // Increase speed gradually (slower increase)
    if (game.distance % 200 === 0 && game.distance > 0) {
        game.speed += 0.05;
    }

    updateUI();
}

// Draw game
function draw() {
    // Clear canvas - dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background grid pattern
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let i = 0; i < canvas.width; i += 50) {
        const x = i - (game.cameraX % 50);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Draw ground - darker with neon edge
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, game.ground.y, canvas.width, game.ground.height);

    // Ground top edge glow
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, game.ground.y);
    ctx.lineTo(canvas.width, game.ground.y);
    ctx.stroke();

    // Draw ground grid pattern
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        const x = i - (game.cameraX % 50);
        ctx.beginPath();
        ctx.moveTo(x, game.ground.y);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Draw obstacles
    game.obstacles.forEach(obstacle => {
        const screenX = obstacle.x - game.cameraX;

        // Only draw if on screen (check if any part of obstacle is visible)
        const onScreen = screenX + obstacle.width > -100 && screenX < canvas.width + 100;

        if (onScreen) {
            if (obstacle.type === 'spike') {
                // Draw spike glow
                ctx.shadowBlur = 20;
                ctx.shadowColor = obstacle.color;

                // Draw spike as triangle
                ctx.fillStyle = obstacle.color;
                ctx.beginPath();
                ctx.moveTo(screenX, obstacle.y + obstacle.height);
                ctx.lineTo(screenX + obstacle.width / 2, obstacle.y);
                ctx.lineTo(screenX + obstacle.width, obstacle.y + obstacle.height);
                ctx.closePath();
                ctx.fill();

                // Spike outline
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.shadowBlur = 0;
            } else if (obstacle.type === 'ship_portal') {
                // Draw ship portal (yellow)
                ctx.shadowBlur = 30;
                ctx.shadowColor = obstacle.color;

                // Portal rectangle
                ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);

                // Portal outline
                ctx.strokeStyle = obstacle.color;
                ctx.lineWidth = 4;
                ctx.strokeRect(screenX, obstacle.y, obstacle.width, obstacle.height);

                // Draw ship icon inside
                ctx.fillStyle = obstacle.color;
                ctx.beginPath();
                ctx.moveTo(screenX + 20, obstacle.y + 50);
                ctx.lineTo(screenX + 5, obstacle.y + 35);
                ctx.lineTo(screenX + 5, obstacle.y + 65);
                ctx.closePath();
                ctx.fill();

                ctx.shadowBlur = 0;
            } else if (obstacle.type === 'cube_portal') {
                // Draw cube portal (green)
                ctx.shadowBlur = 30;
                ctx.shadowColor = obstacle.color;

                // Portal rectangle
                ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);

                // Portal outline
                ctx.strokeStyle = obstacle.color;
                ctx.lineWidth = 4;
                ctx.strokeRect(screenX, obstacle.y, obstacle.width, obstacle.height);

                // Draw cube icon inside
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(screenX + 8, obstacle.y + 40, 15, 15);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX + 8, obstacle.y + 40, 15, 15);

                ctx.shadowBlur = 0;
            } else if (obstacle.type === 'gap') {
                // Draw gap (void in ground)
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);

                // Gap edges
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(screenX, obstacle.y);
                ctx.lineTo(screenX, canvas.height);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(screenX + obstacle.width, obstacle.y);
                ctx.lineTo(screenX + obstacle.width, canvas.height);
                ctx.stroke();
            } else if (obstacle.type === 'platform') {
                // Draw platform with glow
                ctx.shadowBlur = 20;
                ctx.shadowColor = obstacle.color;

                // Draw platform
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);

                // Platform outline
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.strokeRect(screenX, obstacle.y, obstacle.width, obstacle.height);

                // Inner detail
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(screenX + 5, obstacle.y + 5, obstacle.width - 10, obstacle.height - 10);

                ctx.shadowBlur = 0;
            }
        }
    });

    // Draw player (with rotation) - hide during death animation
    if (!game.deathAnimation) {
        const player = game.player;
        ctx.save();

        // Translate to player center
        ctx.translate(player.x + player.width / 2, player.y + player.height / 2);

        // Rotate
        ctx.rotate((player.rotation * Math.PI) / 180);

        // Draw glow effect
        ctx.shadowBlur = 30;
        ctx.shadowColor = player.color;

        if (player.mode === 'ship') {
            // Draw ship (triangle pointing right)
            ctx.fillStyle = player.color;
            ctx.beginPath();
            ctx.moveTo(player.width / 2, 0); // Front tip
            ctx.lineTo(-player.width / 2, -player.height / 2); // Top back
            ctx.lineTo(-player.width / 2, player.height / 2); // Bottom back
            ctx.closePath();
            ctx.fill();

            // Ship outline
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Ship detail
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(player.width / 2 - 10, 0);
            ctx.lineTo(-player.width / 2 + 8, -player.height / 2 + 8);
            ctx.lineTo(-player.width / 2 + 8, player.height / 2 - 8);
            ctx.closePath();
            ctx.fill();

        } else {
            // Draw cube
            ctx.fillStyle = player.color;
            ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

            // Draw cube outline
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);

            // Draw inner detail
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(-player.width / 2 + 8, -player.height / 2 + 8, player.width - 16, player.height - 16);

            // Draw face
            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(-player.width / 2 + 10, -player.height / 2 + 10, 6, 6); // Left eye
            ctx.fillRect(-player.width / 2 + 24, -player.height / 2 + 10, 6, 6); // Right eye

            // Mouth (smile)
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -player.height / 2 + 18, 8, 0.2, Math.PI - 0.2);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Draw particles (explosion)
    game.particles.forEach(particle => {
        const alpha = particle.life / particle.maxLife;
        ctx.globalAlpha = alpha;

        ctx.shadowBlur = 15;
        ctx.shadowColor = particle.color;

        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    });

    // Draw finish line
    if (game.finishLine) {
        const finishScreenX = game.finishLine.x - game.cameraX;

        if (finishScreenX > -100 && finishScreenX < canvas.width + 100) {
            // Draw checkered pattern
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#00ff00';

            const squareSize = 30;
            for (let y = 0; y < game.finishLine.height; y += squareSize) {
                for (let x = 0; x < game.finishLine.width; x += squareSize) {
                    const isBlack = ((x / squareSize) + (y / squareSize)) % 2 === 0;
                    ctx.fillStyle = isBlack ? '#000' : '#fff';
                    ctx.fillRect(finishScreenX + x, y, squareSize, squareSize);
                }
            }

            // Outline
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(finishScreenX, 0, game.finishLine.width, game.finishLine.height);

            ctx.shadowBlur = 0;
        }
    }

    // Draw distance markers
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 16px Arial';
    for (let i = 0; i < 100; i++) {
        const markerX = (i * 100) - game.cameraX;
        if (markerX > 0 && markerX < canvas.width) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
            ctx.fillRect(markerX, game.ground.y - 10, 2, 10);
            ctx.fillText(i * 10 + 'm', markerX - 15, game.ground.y - 15);
            ctx.shadowBlur = 0;
        }
    }

    // Draw title screen
    if (game.titleScreen) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';

        // Title
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 70px Arial';
        ctx.fillText('GEOMETRY DASH', canvas.width / 2, canvas.height / 2 - 80);

        ctx.shadowColor = '#ffff00';
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 40px Arial';
        ctx.fillText('GLOW EDITION', canvas.width / 2, canvas.height / 2 - 30);

        ctx.shadowBlur = 0;

        // Author credit
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('by camilla f', canvas.width / 2, canvas.height / 2 + 30);

        // Instructions
        ctx.font = '20px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Hold SPACE to Jump/Fly', canvas.width / 2, canvas.height / 2 + 100);
        ctx.fillText('Yellow Portals = Ship Mode', canvas.width / 2, canvas.height / 2 + 130);

        // Start prompt (blinking)
        const blink = Math.floor(Date.now() / 500) % 2;
        if (blink) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff00ff';
            ctx.font = 'bold 50px Arial';
            ctx.fillStyle = '#ff00ff';
            ctx.fillText('PRESS SPACE TO START', canvas.width / 2, canvas.height / 2 + 200);
            ctx.shadowBlur = 0;
        }

        ctx.textAlign = 'left';
    }

    // Draw ship mode warning
    if (game.player.shipWarning && game.player.mode === 'ship') {
        const blink = Math.floor(Date.now() / 300) % 2;
        if (blink) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.textAlign = 'center';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0000';
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 40px Arial';
            ctx.fillText('SHIP MODE ENDING SOON!', canvas.width / 2, 50);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
        }
    }

    // Draw level complete screen
    if (game.levelComplete) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';

        // Victory text
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 80px Arial';
        ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 50);

        ctx.shadowBlur = 0;

        // Stats
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#ffff00';
        ctx.fillText('Distance: ' + game.distance + 'm', canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillText('Attempts: ' + game.attempts, canvas.width / 2, canvas.height / 2 + 70);

        // Play again prompt
        ctx.font = '24px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('Press SPACE to Play Again', canvas.width / 2, canvas.height / 2 + 140);

        ctx.textAlign = 'left';
    }
}

// Update UI
function updateUI() {
    document.getElementById('distance').textContent = game.distance;
    document.getElementById('attempts').textContent = game.attempts;
}

// Die
function die() {
    if (!game.running) return;
    if (game.deathAnimation) return; // Already dying

    game.running = false;
    game.deathAnimation = true;
    game.deathTimer = 0;
    playSound('death');

    // Create explosion at player position
    createExplosion(
        game.player.x + game.player.width / 2,
        game.player.y + game.player.height / 2,
        game.player.color
    );

    game.attempts++;
}

// Level Complete
function levelComplete() {
    if (!game.running) return;
    if (game.levelComplete) return;

    game.running = false;
    game.levelComplete = true;
    playSound('powerup');
}

// Restart game
function restart() {
    game.running = true;
    game.titleScreen = false;
    game.deathAnimation = false;
    game.deathTimer = 0;
    game.levelComplete = false;
    game.particles = [];
    game.distance = 0;
    game.speed = 6;
    game.cameraX = 0;
    game.player.x = 150;
    game.player.y = 350;
    game.player.velocityY = 0;
    game.player.onGround = false;
    game.player.rotation = 0;
    game.player.mode = 'cube';
    game.player.shipTimer = 0;
    game.player.shipWarning = false;
    generateObstacles();
    document.getElementById('gameOver').style.display = 'none';
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Input handling
document.addEventListener('keydown', (e) => {
    // Start game from title screen
    if (game.titleScreen && e.key === ' ') {
        game.titleScreen = false;
        game.running = true;
        generateObstacles();
        return;
    }

    // Restart from level complete
    if (game.levelComplete && e.key === ' ') {
        restart();
        return;
    }

    game.keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    game.keys[e.key] = false;
});

// Click to jump
canvas.addEventListener('mousedown', () => {
    // Start game from title screen
    if (game.titleScreen) {
        game.titleScreen = false;
        game.running = true;
        generateObstacles();
        return;
    }

    // Restart from level complete
    if (game.levelComplete) {
        restart();
        return;
    }

    game.keys['click'] = true;
});

canvas.addEventListener('mouseup', () => {
    game.keys['click'] = false;
});

// Start game
updateUI();
gameLoop();
