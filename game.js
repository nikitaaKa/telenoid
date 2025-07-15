// 1. Глобальные переменные и константы

// --- ИЗМЕНЕНИЕ: Новые константы для аспекта ---
const PADDLE_ASPECT_RATIO = 5.0;     // Ширина платформы в 5 раз больше ее высоты
const BRICK_ASPECT_RATIO = 2.5;      // Ширина блока в 2 раза больше его высоты

// --- ИЗМЕНЕНИЕ: Убираем RATIO из ширины, оставляем только в высоте ---
const PADDLE_HEIGHT_RATIO = 0.025;   // Высота ракетки = 2.5% от высоты экрана
const PADDLE_Y_OFFSET_RATIO = 0.1;   // Смещение ракетки от низа = 10% высоты экрана
const BALL_DIAMETER_RATIO = 0.03;    // Диаметр мяча = 3% от высоты экрана

const BRICK_ROWS = 5;
const BRICKS_PER_ROW = 10;
const BRICK_AREA_HEIGHT_RATIO = 0.2;

const gameState = { score: 0, level: 1, lives: 3 };
let paddle, ball, bricks;
let scoreText, levelText, livesText;
let gameStarted = false;
let destroyableBricksCount = 0;
let gameScene;
let stars;
let emitters = {};
let ballTrail;
let bonuses; // НОВАЯ переменная для группы бонусов
let activeBonus = null; // Хранит активный бонус (например, 'laser')
let lasers; // НОВАЯ переменная для группы лазеров

// 2. Все функции игры

function preload() {
    const graphicsRect = this.add.graphics();
    graphicsRect.fillStyle(0xffffff, 1.0);
    graphicsRect.fillRect(0, 0, 1, 1);
    graphicsRect.generateTexture('pixel', 1, 1);
    graphicsRect.destroy();
}

function create() {
    gameScene = this;
    createStars()
    const { width, height } = gameScene.cameras.main;

    gameScene.input.setDefaultCursor('none');

    gameScene.physics.world.setBoundsCollision(true, true, true, false);

    const fontSize = Math.min(width * 0.04, height * 0.03);
    scoreText = gameScene.add.text(16, 16, `Счет: 0`, { fontSize: `${fontSize}px`, fill: '#fff', fontFamily: 'Arial' });
    levelText = gameScene.add.text(width - 16, 16, `Уровень: 1`, { fontSize: `${fontSize}px`, fill: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0);
    livesText = gameScene.add.text(width / 2, 16, `Жизни: 3`, { fontSize: `${fontSize}px`, fill: '#fff', fontFamily: 'Arial' }).setOrigin(0.5, 0);

    bricks = gameScene.physics.add.staticGroup();

    bonuses = gameScene.physics.add.group();
    lasers = gameScene.physics.add.group({
        defaultKey: 'pixel',
        maxSize: 10 // Ограничим количество лазеров на экране
    });

    const paddleHeight = height * PADDLE_HEIGHT_RATIO;
    const paddleWidth = paddleHeight * PADDLE_ASPECT_RATIO;

    paddle = gameScene.physics.add.sprite(width / 2, height - (height * PADDLE_Y_OFFSET_RATIO), 'pixel')
        .setDisplaySize(paddleWidth, paddleHeight).setTint(0xffffff).setImmovable(true);
    paddle.setCollideWorldBounds(true);

    const ballDiameter = height * BALL_DIAMETER_RATIO;
    const ballGraphics = gameScene.add.graphics();
    ballGraphics.fillStyle(0xffffff);
    ballGraphics.fillCircle(ballDiameter / 2, ballDiameter / 2, ballDiameter / 2);
    ballGraphics.generateTexture('ballDynamicTexture', ballDiameter, ballDiameter);
    ballGraphics.destroy();

    ball = gameScene.physics.add.sprite(width / 2, paddle.y - paddleHeight, 'ballDynamicTexture');
    ball.setCircle(ballDiameter / 2);
    ball.setCollideWorldBounds(true).setBounce(1);
    ball.body.setMaxVelocity(width * 1.5, height * 1.5);

    const blockColors = {
        blue: 0x00aaff,
        orange: 0xff8c00,
        gold: 0xffd700,
        red: 0xff4500,
        purple: 0x9400d3,
        green: 0x32cd32
    };

    // Создаем эмиттер для каждого цвета
    for (const colorName in blockColors) {
        const color = blockColors[colorName];

        const particles = gameScene.add.particles(0, 0, 'pixel', {
            speed: { min: -200, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            gravityY: 0,
            tint: color, // СРАЗУ ЗАДАЕМ ЦВЕТ
            emitting: false
        });

        // Сохраняем эмиттер в нашем объекте
        emitters[colorName] = particles;
    }

    // Трейл мяча
    ballTrail = gameScene.add.particles(0, 0, 'pixel', {
        speed: 10, // Небольшая скорость, чтобы частицы "отставали"
        scale: { start: 10, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 250,
        blendMode: 'ADD', // Режим смешивания для красивого свечения

        // ВАЖНО: Привязываем эмиттер к мячу СРАЗУ
        follow: ball,

        followOffset: {
            x: 0,
            y: 0
        }
    });

    ballTrail.stop();

    loadLevel(gameState.level);

    gameScene.input.on('pointermove', pointer => {
        paddle.x = Phaser.Math.Clamp(pointer.x, paddle.displayWidth / 2, width - paddle.displayWidth / 2);
    });
    gameScene.input.on('pointerdown', () => {
        // --- ОТЛАДКА ---
        console.log(`КЛИК! activeBonus = "${activeBonus}", isStuck = ${ball.getData('isStuck')}, gameStarted = ${gameStarted}`);

        if (activeBonus === 'L') {
            // --- ОТЛАДКА ---
            console.log(`%cЛАЗЕР: Условие для стрельбы выполнено.`, 'background: #ff0000; color: #fff;');
            fireLaser();
            return;
        }

        if (ball.getData('isStuck')) {
            // --- ОТЛАДКА ---
            console.log(`%cОТКЛЕИВАНИЕ: Условие для отклеивания выполнено.`, 'background: #ffdd00; color: #000;');
            ball.setData('isStuck', false);
            ball.body.setBounce(1);
            ball.body.setVelocity(Phaser.Math.Between(-gameScene.cameras.main.width * 0.4, gameScene.cameras.main.width * 0.4), -gameScene.cameras.main.height * 0.8);
            return;
        }

        if (!gameStarted) {
            // --- ОТЛАДКА ---
            console.log(`СТАРТ ИГРЫ: Запускаем мяч.`);
            gameStarted = true;
            ball.body.setVelocity(Phaser.Math.Between(-gameScene.cameras.main.width * 0.4, gameScene.cameras.main.width * 0.4), -gameScene.cameras.main.height * 0.8);
            ballTrail.start()
        }
    });

    gameScene.physics.add.collider(ball, paddle, hitPaddle);
    gameScene.physics.add.collider(ball, bricks, hitBrick);
    gameScene.physics.add.collider(lasers, bricks, hitBrickWithLaser);
    gameScene.physics.add.overlap(paddle, bonuses, collectBonus);
}

function update() {
    const { height } = gameScene.cameras.main;
    for (const star of stars.getChildren()) {
        // Двигаем звезду вниз с ее скоростью
        star.y += star.getData('speed') * (1 / 60); // Делим на 60 для плавности, независимо от FPS

        // Если звезда ушла за нижний край
        if (star.y > height) {
            // Перемещаем ее наверх в случайную горизонтальную позицию
            star.y = 0;
            star.x = Phaser.Math.Between(0, gameScene.cameras.main.width);
        }
    }

    if (!gameStarted) {
        ball.setPosition(paddle.x, paddle.y - (paddle.displayHeight / 2) - (ball.body.height / 2));
    }

    if (ball.getData('isStuck')) {
        // Жестко привязываем его к верху платформы, игнорируя физику
        ball.setPosition(paddle.x, paddle.y - (paddle.displayHeight / 2) - (ball.body.height / 2));
        ball.body.setVelocity(0,0); // На всякий случай гасим любую скорость
    }

    if (ball.y > gameScene.cameras.main.height) {
        loseLife();
    }

    if (destroyableBricksCount === 0 && gameStarted) {
        winLevel();
    }
}

function loadLevel(level) {
    destroyableBricksCount = 0;
    const levelLayout = generateLevel(level);
    const { width, height } = gameScene.cameras.main;

    // --- КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ ЗДЕСЬ ---

    // 1. Определяем общую ширину для всей сетки блоков (например, 95% от ширины экрана)
    const gridAreaWidth = width * 0.95;

    // 2. Рассчитываем ширину одного блока внутри этой области.
    // У нас 10 блоков (BRICKS_PER_ROW) и 9 отступов между ними.
    // Пусть отступ будет 5% от ширины блока. Итого 10 блоков + 9*0.05 = 10.45 "эквивалентных" ширин.
    const brickWidth = gridAreaWidth / (BRICKS_PER_ROW + (BRICKS_PER_ROW - 1) * 0.05);
    const brickMarginX = brickWidth * 0.05; // Горизонтальный отступ

    // 3. Рассчитываем высоту блока, исходя из его ширины и аспекта.
    const brickHeight = brickWidth / BRICK_ASPECT_RATIO;
    const brickMarginY = brickHeight * 0.05; // Вертикальный отступ

    // 4. Рассчитываем смещение всей сетки, чтобы отцентровать ее.
    const gridOffsetX = (width - gridAreaWidth) / 2;
    const topOffset = height * 0.1; // Начинаем рисовать с 10% от верха экрана

    // --- ДАЛЬШЕ ЛОГИКА ОСТАЕТСЯ ПРЕЖНЕЙ, НО ИСПОЛЬЗУЕТ НОВЫЕ РАСЧЕТЫ ---

    levelLayout.forEach((row, rowIndex) => {
        row.forEach((blockType, colIndex) => {
            if (blockType > 0) {
                // Используем gridOffsetX для центрирования
                const x = gridOffsetX + colIndex * (brickWidth + brickMarginX) + brickWidth / 2;
                const y = topOffset + rowIndex * (brickHeight + brickMarginY) + brickHeight / 2;
                const block = bricks.create(x, y, 'pixel');

                block.setDisplaySize(brickWidth, brickHeight)
                     .setData('type', blockType)
                     .setData('row', rowIndex)
                     .setData('col', colIndex);

                if (blockType === 1) {
                    block.setTint(0x00aaff);
                    destroyableBricksCount++;
                } else if (blockType === 2) {
                    block.setData('health', 2).setTint(0xff8c00);
                    destroyableBricksCount++;
                } else if (blockType === 3) {
                    block.setTint(0xff4500);
                    destroyableBricksCount++;
                } else if (blockType === 4) {
                    block.setTint(0x9400d3);
                    destroyableBricksCount++;
                } else if (blockType === 5) {
                    block.setTint(0x32cd32);
                } else if (blockType === 9) {
                    block.setTint(0x808080);
                }
                block.refreshBody();
            }
        });
    });

    updateUI();
}

function resetPaddleAndBall() {
    gameStarted = false;
    ballTrail.stop()
    const { width, height } = gameScene.cameras.main;
    paddle.setPosition(width / 2, height - (height * PADDLE_Y_OFFSET_RATIO));
    ball.body.setVelocity(0, 0);
}

function generateLevel(level) {
    const layout = [];
    const rows = BRICK_ROWS + Math.floor(level / 3);
    const cols = BRICKS_PER_ROW;
    let hasDestroyableBrick = false;

    for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
            const random = Math.random();
            let blockType = 0;

            if (random < 0.7 + level * 0.02) {
                if (level > 6 && random < 0.05) { blockType = 5; }
                else if (level > 5 && random < 0.10) { blockType = 4; }
                else if (level > 4 && random < 0.15) { blockType = 3; }
                else if (level > 3 && random < 0.20) { blockType = 9; }
                else if (level > 1 && random < 0.40) { blockType = 2; }
                else { blockType = 1; }
            }

            if (blockType >= 1 && blockType <= 5) { hasDestroyableBrick = true; }
            row.push(blockType);
        }
        layout.push(row);
    }

    if (!hasDestroyableBrick) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);
        layout[randomRow][randomCol] = 1;
    }
    return layout;
}

function hitBrick(ball, brick) {
    const willDropBonus = Math.random() < 0.2;
    const blockType = brick.getData('type');

    if (blockType === 1) {
        destroyBrick(brick, 1, willDropBonus);
    }
    else if (blockType === 2) {
        let health = brick.getData('health') - 1;
        brick.setData('health', health);
        if (health > 0) {
            // "Ранили" блок, но не уничтожили. Все равно покажем эффект.
            emitters.orange.emitParticleAt(brick.x, brick.y, 10); // Меньше частиц
            brick.setTint(0xffd700);
        } else {
            // Уничтожаем "раненый" блок
            destroyBrick(brick, 5, willDropBonus);
        }
    }
    else if (blockType === 3) { explodeBrick(brick); }
    else if (blockType === 4) {
        if (ball && ball.body) { ball.body.velocity.scale(1.25); }
        destroyBrick(brick, 1, willDropBonus);
    }
    else if (blockType === 5) {
        const brickData = { x: brick.x, y: brick.y, tint: brick.tintTopLeft, row: brick.getData('row'), col: brick.getData('col'), type: 5 };
        destroyBrick(brick, 1, false);
        gameScene.time.delayedCall(5000, () => regenerateBrick(brickData));
    }
}

function destroyBrick(brick, points = 1, dropBonus = false) {
    const blockType = brick.getData('type');

    // Определяем, какой эмиттер использовать
    let emitterToUse;
    if (blockType === 1) emitterToUse = emitters.blue;
    if (blockType === 2 && brick.getData('health') > 0) emitterToUse = emitters.orange;
    if (blockType === 2 && brick.getData('health') === 0) emitterToUse = emitters.gold; // Используем цвет "раненого" блока
    if (blockType === 3) emitterToUse = emitters.red;
    if (blockType === 4) emitterToUse = emitters.purple;
    if (blockType === 5) emitterToUse = emitters.green;

    // Запускаем нужный эмиттер
    if (emitterToUse) {
        emitterToUse.emitParticleAt(brick.x, brick.y, 30);
    }

    if (blockType !== 5) {
        destroyableBricksCount--;
    }

    brick.disableBody(true, true);
    updateScore(points);

    if (dropBonus) {
        spawnBonus(brick.x, brick.y);
    }
}

function hitBrickWithLaser(laser, brick) {
    laser.disableBody(true, true); // Уничтожаем лазер
    // Лазеры не могут уничтожить неразрушимые блоки
    if (brick.getData('type') !== 9) {
        // Мы вызываем hitBrick, чтобы повторно использовать всю логику
        // уничтожения (очки, счетчики, бонусы). Передаем null вместо мяча.
        hitBrick(null, brick);
    }
    if (brick.getData('type') !== 5) { destroyableBricksCount--; }
}

function explodeBrick(centerBrick, willDropBonus ) {
    const centerRow = centerBrick.getData('row');
    const centerCol = centerBrick.getData('col');
    destroyBrick(centerBrick, 3, willDropBonus );
    const childrenArray = bricks.children.entries;
    for (const child of childrenArray) {
        if (child && child.active) {
            const row = child.getData('row');
            const col = child.getData('col');
            if (Math.abs(row - centerRow) <= 1 && Math.abs(col - centerCol) <= 1) {
                const type = child.getData('type');
                if (type !== 9 && child !== centerBrick) {
                    gameScene.time.delayedCall(50, () => {
                        if (child.active) { hitBrick(null, child); }
                    });
                }
            }
        }
    }
}

function regenerateBrick(data) {
    let isOccupied = false;
    const childrenArray = bricks.children.entries;
    for (const child of childrenArray) {
        if (child.active && child.getData('row') === data.row && child.getData('col') === data.col) {
            isOccupied = true;
            break;
        }
    }
    if (!isOccupied) {
        const { width, height } = gameScene.cameras.main;
        const brickMarginX = width * 0.005;
        const totalMarginWidth = (BRICKS_PER_ROW + 1) * brickMarginX;
        const brickWidth = (width - totalMarginWidth) / BRICKS_PER_ROW;
        const brickMarginY = height * 0.005;
        const brickAreaHeight = height * BRICK_AREA_HEIGHT_RATIO;
        const numRows = generateLevel(gameState.level).length;
        const totalMarginHeight = (numRows + 1) * brickMarginY;
        const brickHeight = (brickAreaHeight - totalMarginHeight) / numRows;

        const block = bricks.create(data.x, data.y, 'pixel');
        block.setDisplaySize(brickWidth, brickHeight)
             .setTint(data.tint).setData('type', data.type)
             .setData('row', data.row).setData('col', data.col);
        block.refreshBody();
    }
}

function spawnBonus(x, y) {
    const bonusTypes = ['E', 'S', 'C', 'L', 'R'];
    const type = Phaser.Utils.Array.GetRandom(bonusTypes);

    // --- ОТЛАДКА ---
    console.log(`%cСПАУН: Создан бонус типа "${type}" в координатах (${Math.round(x)}, ${Math.round(y)})`, 'color: #00aaff');

    const bonusContainer = gameScene.add.container(x, y);
    const capsule = gameScene.add.sprite(0, 0, 'pixel').setDisplaySize(50, 25).setTint(0xff00ff);
    const letter = gameScene.add.text(0, 0, type, { fontSize: '20px', fill: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
    bonusContainer.add([capsule, letter]);
    bonuses.add(bonusContainer);
    bonusContainer.body.velocity.y = 200;
    bonusContainer.setData('type', type);
}

function collectBonus(paddle, bonus) {
    const type = bonus.getData('type');

    // --- ОТЛАДКА ---
    console.log(`%cПОДБОР: Подобран бонус типа "${type}"`, 'color: #32cd32; font-weight: bold;');

    bonus.destroy();
    resetBonusEffects(); // Сначала сбрасываем старые эффекты
    activeBonus = type;

    // --- ОТЛАДКА ---
    console.log(`АКТИВАЦИЯ: activeBonus теперь равен "${activeBonus}"`);

    switch (type) {
        case 'E': paddle.setDisplaySize(paddle.displayWidth * 1.5, paddle.displayHeight); break;
        case 'S': if (ball.body.velocity.length() > 200) { ball.body.velocity.scale(0.75); } break;
        case 'L': console.log("Эффект 'Лазер' активирован."); break;
        case 'C': console.log("Эффект 'Прилипание' активирован."); break;
        case 'R': paddle.setDisplaySize(paddle.displayWidth * 0.75, paddle.displayHeight); break;
    }
    if (type === 'E' || type === 'S' || type === 'R' || type === 'L') {
        gameScene.time.delayedCall(10000, resetBonusEffects, [], gameScene);
    }
}

function resetBonusEffects() {
    const { width, height } = gameScene.cameras.main;
    const paddleHeight = height * PADDLE_HEIGHT_RATIO;
    const paddleWidth = paddleHeight * PADDLE_ASPECT_RATIO;
    paddle.setDisplaySize(paddleWidth, paddleHeight);

    // Если мяч был приклеен, когда бонус закончился, отпускаем его
    if (ball.getData('isStuck')) {
        ball.setData('isStuck', false);
        ball.body.setBounce(1); // Возвращаем отскок
        ball.body.setVelocity(Phaser.Math.Between(-width * 0.4, width * 0.4), -height * 0.8);
    }

    activeBonus = null;
}

function fireLaser() {
    const laser = lasers.get(paddle.x, paddle.y - 20);
    if (laser) {
        laser.setActive(true);
        laser.setVisible(true);
        laser.setDisplaySize(5, 20).setTint(0xff0000);
        laser.body.velocity.y = -600;

        // Лазер исчезает, когда вылетает за экран
        laser.checkWorldBounds = true;
        laser.outOfBoundsKill = true;
    }
}

function updateScore(points) {
    gameState.score += points;
    updateUI();
}

function loseLife() {
    gameState.lives--;
    updateUI();
    if (gameState.lives === 0) { gameOver(); }
    else { resetPaddleAndBall(); }
}

function gameOver() {
    alert(`Игра окончена! Ваш итоговый счет: ${gameState.score}`);
    gameState.level = 1;
    gameState.score = 0;
    gameState.lives = 3;
    gameStarted = false;
    ballTrail.stop()
    gameScene.scene.restart();
}

function winLevel() {
    alert(`Уровень ${gameState.level} пройден!`);
    gameState.level++;
    gameState.lives = 3;
    gameStarted = false;
    ballTrail.stop();
    gameScene.scene.restart();
}

function hitPaddle(ball, paddle) {
    // --- ОТЛАДКА ---
    if (activeBonus) {
        console.log(`СТОЛКНОВЕНИЕ С ПЛАТФОРМОЙ: Мяч ударился о платформу. Активный бонус: "${activeBonus}"`);
    }

    if (activeBonus === 'C' && !ball.getData('isStuck')) {
        // --- ОТЛАДКА ---
        console.log(`%cЛОВУШКА: Сработал бонус 'Catch'. Приклеиваем мяч.`, 'background: #ffdd00; color: #000;');
        ball.setData('isStuck', true);
        ball.body.setBounce(0);
        return;
    }

    const diff = (ball.x - paddle.x) / (paddle.displayWidth / 2);
    const influence = diff * (gameScene.cameras.main.width * 0.4);
    const newVx = Phaser.Math.Clamp(ball.body.velocity.x + influence, -gameScene.cameras.main.width, gameScene.cameras.main.width);
    ball.body.setVelocityX(newVx);
}

function createStars() {
    // Создаем группу для хранения звезд
    stars = gameScene.add.group();
    const { width, height } = gameScene.cameras.main;

    // Создаем 200 звезд
    for (let i = 0; i < 200; i++) {
        // Создаем звезду в случайной точке экрана
        const x = Phaser.Math.Between(0, width);
        const y = Phaser.Math.Between(0, height);

        // Задаем случайный размер (от 1 до 3 пикселей)
        const size = Phaser.Math.Between(1, 3);
        // Задаем случайную прозрачность
        const alpha = Phaser.Math.FloatBetween(0.1, 0.6);

        const star = stars.create(x, y, 'pixel');
        star.setDisplaySize(size, size);
        star.setAlpha(alpha);

        // Сохраняем скорость для каждой звезды. Чем больше звезда, тем быстрее она движется (эффект параллакса)
        star.setData('speed', size * 10);
    }
}

function updateUI() {
    scoreText.setText(`Счет: ${gameState.score}`);
    levelText.setText(`Уровень: ${gameState.level}`);
    livesText.setText(`Жизни: ${gameState.lives}`);
}


// 3. Конфигурация игры
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1d212d',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// 4. Запуск игры (в самом конце!)
const game = new Phaser.Game(config);
