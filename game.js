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
let isGameplayActive = false;
let destroyableBricksCount = 0;
let gameScene;
let stars;
let emitters = {};
let bonusEmitters = {};
let bonuses; // НОВАЯ переменная для группы бонусов
let activeBonus = null; // Хранит активный бонус (например, 'L')
let enemies;
let littleBalls;
let aimLine; // Линия прицеливания
let laserBeam; // Боевой лазер
let laserTimer; // Таймер для лазера

// 2. Все функции игры

function preload() {
    const graphicsRect = this.add.graphics();
    graphicsRect.fillStyle(0xffffff, 1.0);
    graphicsRect.fillRect(0, 0, 1, 1);
    graphicsRect.generateTexture('pixel', 1, 1);
    graphicsRect.destroy();

    const triangle = this.add.graphics();
    triangle.fillStyle(0xff0000); // Красный цвет
    triangle.lineStyle(2, 0xffffff, 1); // Белая обводка
    triangle.beginPath();
    triangle.moveTo(25, 0);  // Верхняя точка
    triangle.lineTo(50, 50); // Правая нижняя
    triangle.lineTo(0, 50);  // Левая нижняя
    triangle.closePath();
    triangle.fillPath();
    triangle.strokePath();
    triangle.generateTexture('enemy_triangle', 50, 50);
    triangle.destroy();

    const littleBallGraphics = this.add.graphics();
    littleBallGraphics.fillStyle(0xcccccc); // Светло-серый цвет
    littleBallGraphics.fillCircle(5, 5, 5); // Диаметр 10, радиус 5
    littleBallGraphics.generateTexture('littleBallTexture', 10, 10);
    littleBallGraphics.destroy();
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
    enemies = gameScene.physics.add.group();
    littleBalls = gameScene.physics.add.group();

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

    const bonusColors = {
        'E': 0x2ecc71, 'S': 0x3498db, 'C': 0xf1c40f,
        'L': 0xe74c3c, 'R': 0x9b59b6
    };

    for (const type in bonusColors) {
        const color = bonusColors[type];
        const particles = gameScene.add.particles(0, 0, 'pixel', {
            speed: 0,
            scale: { start: 1, end: 0 },
            alpha: { start: 0.4, end: 0 },
            lifespan: 200,
            blendMode: 'ADD',
            tint: color, // Сразу задаем цвет
            emitting: false
        });
        bonusEmitters[type] = particles; // Сохраняем менеджер частиц по ключу-букве
    }

    resetBonusEffects();
    loadLevel(gameState.level);

    gameScene.input.on('pointermove', pointer => {
        paddle.x = Phaser.Math.Clamp(pointer.x, paddle.displayWidth / 2, width - paddle.displayWidth / 2);
    });
    gameScene.input.on('pointerdown', () => {
        if (ball.getData('isStuck')) {
            ball.setData('isStuck', false);
            resetBonusEffects();
            ball.body.setBounce(1);
            ball.body.setVelocity(Phaser.Math.Between(-gameScene.cameras.main.width * 0.4, gameScene.cameras.main.width * 0.4), -gameScene.cameras.main.height * 0.8);
        }

        if (!isGameplayActive) {
            isGameplayActive = true;
            ball.body.setVelocity(Phaser.Math.Between(-gameScene.cameras.main.width * 0.4, gameScene.cameras.main.width * 0.4), -gameScene.cameras.main.height * 0.8);
        }
    });

    gameScene.physics.add.collider(ball, paddle, hitPaddle);
    gameScene.physics.add.collider(ball, bricks, hitBrick);
    gameScene.physics.add.overlap(paddle, bonuses, collectBonus);
    gameScene.physics.add.collider(littleBalls, bricks, hitBrickWithLittleBall);
    gameScene.physics.add.collider(littleBalls, paddle);

    gameScene.time.addEvent({
        delay: 15000,
        callback: spawnEnemy,
        callbackScope: gameScene,
        loop: true
    });

    gameScene.physics.add.overlap(ball, enemies, hitEnemy);
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

    // if (isGameplayActive && ball.body) {
    //     gameScene.add.particles(ball.body.center.x, ball.body.center.y, 'pixel', {
    //         // Конфигурация для ОДНОЙ частицы
    //         speed: 0,
    //         scale: { start: 20, end: 0 },
    //         alpha: { start: 1, end: 0 },
    //         lifespan: 500,
    //         blendMode: 'ADD',
    //         // Говорим выпустить только одну частицу и остановиться
    //         emitting: true,
    //         maxParticles: 1,
    //         alignment: 'center'
    //     });
    // }

    if (activeBonus === 'L' && aimLine && aimLine.visible) {
        aimLine.x = paddle.x;
    }

    if (isGameplayActive) {
        // Если мяч "приклеен" бонусом 'C'
        if (ball.getData('isStuck')) {
            ball.setPosition(paddle.x, paddle.y - (paddle.displayHeight / 2) - (ball.body.height / 2));
            ball.body.setVelocity(0,0);
        }

        // Проверка на проигры
        if (ball.y > gameScene.cameras.main.height) {
            loseLife();
        }

        // Проверка на победу
        if (destroyableBricksCount === 0) {
            winLevel();
        }
    } else {
        // Если геймплей не активен (например, до старта), мяч просто следует за платформой
        if (!ball.getData('isStuck')) { // Не двигаем, если он приклеен (на случай паузы во время Catch)
            ball.setPosition(paddle.x, paddle.y - (paddle.displayHeight / 2) - (ball.body.height / 2));
        }
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
    isGameplayActive = false;
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
    const isGiant = activeBonus === 'G';

    if (blockType === 1) {
        destroyBrick(brick, 1, willDropBonus);
    }
    else if (blockType === 2) {
        // Если мяч гигантский, ломаем сразу
        if (isGiant) {
            destroyBrick(brick, 5, willDropBonus);
        } else {
            let health = brick.getData('health') - 1;
            brick.setData('health', health);
            if (health > 0) {
                emitters.orange.emitParticleAt(brick.x, brick.y, 10);
                brick.setTint(0xffd700);
            } else {
                destroyBrick(brick, 5, willDropBonus);
            }
        }
    }
    else if (blockType === 3) { explodeBrick(brick, willDropBonus); }
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
    const bonusColors = {
        'E': 0x2ecc71, 'S': 0x3498db, 'C': 0xf1c40f,
        'L': 0xe74c3c, 'R': 0x9b59b6,
        'G': 0x1abc9c, // Бирюзовый (Giant)
        'D': 0xff7f50, // Коралловый (Disruption)
        'M': 0xbdc3c7, // Серебряный (Multi-ball)
        'P': 0x27ae60, // Насыщенный зеленый (Points)
    };
    const bonusTypes = ['E', 'S', 'C', 'L', 'R', 'G', 'D', 'M', 'P'];
    const type = Phaser.Utils.Array.GetRandom(bonusTypes);
    const color = bonusColors[type];

    const bonusContainer = gameScene.add.container(x, y);

    // --- Создание капсулы (остается без изменений) ---
    const capsuleGraphics = gameScene.make.graphics({x: -30, y: -15}); // Смещаем, чтобы центр был в (0,0)
    capsuleGraphics.fillStyle(color, 0.8);
    capsuleGraphics.fillRoundedRect(0, 0, 60, 30, 15);
    const textureName = `capsule_${type}`;
    // Проверяем, существует ли уже такая текстура, чтобы не создавать ее повторно
    if (!gameScene.textures.exists(textureName)) {
        capsuleGraphics.generateTexture(textureName, 60, 30);
    }
    capsuleGraphics.destroy();
    const capsule = gameScene.add.sprite(0, 0, textureName);

    // --- Создание буквы (остается без изменений) ---
    const letter = gameScene.add.text(0, 0, type, {
        fontSize: '22px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        shadow: { color: '#000000', fill: true, blur: 2, offsetY: 2 }
    }).setOrigin(0.5);

    bonusContainer.add([capsule, letter]);
    bonuses.add(bonusContainer);
    bonusContainer.body.velocity.y = 200;
    bonusContainer.setData('type', type);

    // --- Анимация пульсации (остается без изменений) ---
    gameScene.tweens.add({
        targets: letter,
        scale: 1.25,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // --- ИЗМЕНЕНИЕ: Логика шлейфа ---
    // 1. Выбираем нужный эмиттер из нашего объекта
    const emitter = bonusEmitters[type];

    if (emitter) {
        // 2. Привязываем его к контейнеру бонуса
        emitter.startFollow(bonusContainer);
        // 3. Включаем излучение
        emitter.start();

        // 4. Когда бонус уничтожается, выключаем эмиттер
        bonusContainer.on('destroy', () => {
            emitter.stop();
        });
    }
}

function collectBonus(paddle, bonus) {
    const type = bonus.getData('type');
    bonus.destroy();
    resetBonusEffects();
    activeBonus = type;

    switch (type) {
        // ... старые бонусы ...
        case 'L': activateLaserAim(); break;
        case 'C': break;
        case 'R': paddle.setDisplaySize(paddle.displayWidth * 0.75, paddle.displayHeight); break;

        // --- НОВЫЕ БОНУСЫ ---
        case 'G': // Giant Ball
            activateGiantBall(true);
            break;
        case 'D': // Disruption
            disruptBall();
            break;
        case 'M': // Multi-ball
            spawnLittleBalls();
            break;
        case 'P': // Points
            const points = Phaser.Math.Between(100, 400);
            updateScore(points);
            // Этот бонус не имеет "активного" состояния, поэтому сбрасываем
            activeBonus = null;
            break;
    }

    // Бонус "Гигантский мяч" тоже будет временным
    if (type === 'E' || type === 'S' || type === 'R' || type === 'G') {
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

    if (activeBonus === 'G') {
        activateGiantBall(false);
    }

    if (laserTimer) {
        laserTimer.remove(); // Отменяем запланированный выстрел
        laserTimer = null;
    }
    if (aimLine) {
        aimLine.setVisible(false); // Прячем линию прицеливания
    }

    laserBeam = null
    aimLine = null
    activeBonus = null;
}

function spawnEnemy() {
    const { width, height } = gameScene.cameras.main;

    // 1. Определяем начальную и конечную точки
    const sideStart = Phaser.Math.Between(0, 3); // 0-верх, 1-право, 2-низ, 3-лево
    let xStart, yStart, xEnd, yEnd;

    // Выбираем стартовую позицию за экраном
    if (sideStart === 0) { // Сверху
        xStart = Phaser.Math.Between(0, width); yStart = -50;
    } else if (sideStart === 1) { // Справа
        xStart = width + 50; yStart = Phaser.Math.Between(0, height);
    } else if (sideStart === 2) { // Снизу
        xStart = Phaser.Math.Between(0, width); yStart = height + 50;
    } else { // Слева
        xStart = -50; yStart = Phaser.Math.Between(0, height);
    }

    // Выбираем конечную позицию на противоположной стороне
    // Чтобы траектория была интереснее, она не всегда будет строго противоположной
    const sideEnd = (sideStart + Phaser.Math.Between(1, 3)) % 4;
    if (sideEnd === 0) {
        xEnd = Phaser.Math.Between(0, width); yEnd = -50;
    } else if (sideEnd === 1) {
        xEnd = width + 50; yEnd = Phaser.Math.Between(0, height);
    } else if (sideEnd === 2) {
        xEnd = Phaser.Math.Between(0, width); yEnd = height + 50;
    } else {
        xEnd = -50; yEnd = Phaser.Math.Between(0, height);
    }

    // 2. Создаем врага, но БЕЗ ФИЗИЧЕСКОЙ СКОРОСТИ
    const enemy = enemies.create(xStart, yStart, 'enemy_triangle');
    if (!enemy) return;

    enemy.body.allowGravity = false;
    // Задаем вращение, оно будет работать независимо от твина
    enemy.body.setAngularVelocity(Phaser.Math.Between(-200, 200));
    // Убираем отскок, т.к. твин будет управлять позицией
    enemy.setBounce(0);

    // 3. Создаем Твин для плавного движения
    gameScene.tweens.add({
        targets: enemy, // Цель анимации
        x: xEnd,        // Конечная координата X
        y: yEnd,        // Конечная координата Y
        duration: 10000, // Длительность анимации 10 секунд

        // --- КЛЮЧЕВАЯ ЧАСТЬ: ФУНКЦИЯ СГЛАЖИВАНИЯ ---
        // 'Power2' - это квадратичная функция (плавная)
        // 'easeInOut' - применяет ее в начале и в конце
        ease: 'Power2',

        // Функция, которая выполнится по завершении твина
        onComplete: () => {
            // Если враг долетел до конца и не был сбит, уничтожаем его
            if (enemy.active) {
                enemy.destroy();
            }
        }
    });
}

// Обработка столкновения мяча с врагом
function hitEnemy(ball, enemy) {
    // Проверяем, что оба объекта все еще активны, чтобы избежать двойного срабатывания
    if (!ball.active || !enemy.active) {
        return;
    }

    const points = Phaser.Math.Between(250, 500);
    updateScore(points);

    // Используем эффект взрыва от красного блока
    if (emitters.red) {
        emitters.red.emitParticleAt(enemy.x, enemy.y, 30);
    }

    // Уничтожаем врага
    enemy.destroy();

    // Важно: мы НЕ трогаем мяч. Он просто летит дальше.
}

function activateLaserAim() {
    const { height } = gameScene.cameras.main;

    // Если линии нет, создаем.
    if (!aimLine) {
        // Создаем с альфа 0.5 для полупрозрачности
        aimLine = gameScene.add.rectangle(0, 0, 12, height, 0xff0000, 0.5);
    }

    // "Оживляем" ее, как и лазер
    aimLine.setPosition(paddle.x, height / 2)
           .setAlpha(0.5) // Всегда возвращаем полупрозрачность
           .setVisible(true)
           .setActive(true);

    // Запускаем таймер
    laserTimer = gameScene.time.delayedCall(5000, fireMegaLaser);
}

// Фаза 2: Выстрел боевым лазером
function fireMegaLaser() {
    const { width, height } = gameScene.cameras.main;

    // 1. Прячем линию прицеливания, она свою задачу выполнила.
    if (aimLine) {
        aimLine.setVisible(false);
    }

    // 2. Запоминаем позицию, где должен появиться лазер.
    const laserX = aimLine.x;

    // 3. (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ) Если боевой лазер уже существует,
    // сначала принудительно убиваем все анимации (твины), которые на нем висят.
    // Это предотвращает конфликт со старой анимацией исчезновения.
    if (laserBeam) {
        gameScene.tweens.killTweensOf(laserBeam);
    }

    // 4. Если боевой лазер еще никогда не создавался, создаем его.
    if (!laserBeam) {
        laserBeam = gameScene.add.rectangle(laserX, height / 2, 20, height, 0xff0000, 1.0);
        laserBeam.setBlendMode('ADD'); // Режим смешивания для "неонового" свечения.
    }

    // 5. "Оживляем" лазер: устанавливаем все его свойства в начальное состояние.
    // Это гарантирует, что он будет работать каждый раз, а не только в первый.
    laserBeam.setPosition(laserX, height / 2) // Ставим в нужную позицию.
             .setAlpha(1)                   // Делаем полностью непрозрачным.
             .setVisible(true);             // Делаем видимым.

    // 6. Механика уничтожения объектов под лазером.
    // Создаем невидимую физическую зону по размеру лазера.
    const zone = gameScene.add.zone(laserX, height / 2, 20, height);
    gameScene.physics.world.enable(zone);
    zone.body.setAllowGravity(false);

    // Получаем массив всех физических тел, которые пересекаются с этой зоной.
    const overlappingObjects = gameScene.physics.overlapRect(laserX - 10, 0, 20, height, true, true);

    overlappingObjects.forEach(body => {
        const gameObject = body.gameObject;

        // Проверяем, что объект существует и активен.
        if (!gameObject || !gameObject.active) {
            return;
        }

        // Если это блок (включая неразрушимые).
        if (bricks.contains(gameObject)) {
            if (emitters.red) emitters.red.emitParticleAt(gameObject.x, gameObject.y, 15);
            // Если блок был разрушаемым, вычитаем его из счетчика.
            if (gameObject.getData('type') < 9) {
                destroyableBricksCount--;
            }
            gameObject.disableBody(true, true);
        }

        // Если это враг.
        if (enemies.contains(gameObject)) {
            hitEnemy(null, gameObject); // Используем существующую функцию для убийства врагов.
        }
    });

    zone.destroy(); // Удаляем временную зону после проверки.

    // 7. Фаза исчезновения: запускаем новую анимацию (твин).
    gameScene.tweens.add({
        targets: laserBeam,
        alpha: 0,           // Целевое значение прозрачности.
        duration: 500,      // Длительность анимации в мс.
        delay: 200,         // Задержка перед началом анимации (лазер виден 0.2 сек).
        onComplete: () => {
            // Когда анимация завершена, делаем лазер невидимым
            // и сбрасываем состояние бонуса.
            if (laserBeam) {
                laserBeam.setVisible(false);
            }
            resetBonusEffects();
        }
    });
}

function activateGiantBall(isActive) {
    const { height } = gameScene.cameras.main;

    if (isActive) {
        // --- 1. Рассчитываем новый диаметр ---
        const giantDiameter = height * BALL_DIAMETER_RATIO * 2;
        const textureName = 'giantBallTexture';

        // --- 2. Проверяем, существует ли уже текстура такого размера ---
        // Это оптимизация, чтобы не создавать текстуру каждый раз
        if (!gameScene.textures.exists(textureName)) {
            const ballGraphics = gameScene.add.graphics();
            // Рисуем новый, большой круг
            ballGraphics.fillStyle(0xffffff); // Рисуем белым, цвет зададим через tint
            ballGraphics.fillCircle(giantDiameter / 2, giantDiameter / 2, giantDiameter / 2);
            ballGraphics.generateTexture(textureName, giantDiameter, giantDiameter);
            ballGraphics.destroy();
        }

        // --- 3. Применяем новую текстуру и сбрасываем размер ---
        // setDisplaySize(giantDiameter, giantDiameter) больше не нужен,
        // так как текстура уже имеет правильный размер.
        ball.setTexture(textureName);
        ball.setCircle(giantDiameter / 2); // Физика теперь будет идеальной
        ball.setTint(0xadff2f); // Окрашиваем в зеленоватый

    } else {
        // --- Возвращаем старую текстуру ---
        const normalDiameter = height * BALL_DIAMETER_RATIO;
        // ballDynamicTexture была создана в create() и имеет правильный размер
        ball.setTexture('ballDynamicTexture');
        ball.setCircle(normalDiameter / 2);
        ball.setTint(0xffffff);
    }
}

// Создает два клона основного мяча
function disruptBall() {
    // Эта функция очень сложна для реализации с одним мячом.
    // Проще всего симулировать это, создав 2 маленьких шарика, как в M.
    // Для полноценного "Disruption" нужна была бы группа для основных мячей.
    // Пока сделаем так:
    spawnLittleBalls(2);
    console.warn("Бонус 'Disruption' симулирован как 'Multi-ball' с 2 шарами. Для полноценной реализации нужна группа основных мячей.");
}

// Создает 5 маленьких шариков
function spawnLittleBalls(count = 5) {
    for (let i = 0; i < count; i++) {
        // --- ИЗМЕНЕНИЕ: Используем новую текстуру ---
        const littleBall = littleBalls.create(paddle.x, paddle.y - 20, 'littleBallTexture');

        if (littleBall) {
            // --- ИЗМЕНЕНИЕ: setDisplaySize и setTint больше не нужны ---
            // Текстура уже имеет правильный размер и цвет.
            littleBall.setCircle(5); // Радиус физического тела = радиусу текстуры
            littleBall.setBounce(1).setCollideWorldBounds(true);
            littleBall.body.allowGravity = false;

            const angle = Phaser.Math.Between(-150, -30);
            gameScene.physics.velocityFromAngle(angle, 400, littleBall.body.velocity);

            littleBall.setData('hitsLeft', 3);
        }
    }
}

// Обработчик столкновения маленького шарика с блоком
function hitBrickWithLittleBall(littleBall, brick) {
    let hits = littleBall.getData('hitsLeft') - 1;
    littleBall.setData('hitsLeft', hits);

    // Уничтожаем обычный блок
    if (brick.getData('type') === 1) {
        destroyBrick(brick);
    }
    // Прочный блок тоже уничтожаем с 1 удара
    else if (brick.getData('type') === 2) {
        destroyBrick(brick, 5);
    }
    // Другие блоки (взрывные и т.д.) тоже активируем
    else {
        hitBrick(null, brick);
    }

    // Если у шарика кончились "удары", уничтожаем его
    if (hits <= 0) {
        littleBall.destroy();
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
    gameStarted = false;
    ball.body.stop()

    const onConfirm = () => {
        gameState.level = 1;
        gameState.score = 0;
        gameState.lives = 3;
        gameScene.scene.restart();
    };

    showModal('Игра окончена!', `Ваш итоговый счет: ${gameState.score}`, onConfirm);
}

function winLevel() {
    isGameplayActive = false;
    ball.body.stop();

    const onConfirm = () => {
        gameState.level++;
        gameState.lives = 3;
        gameScene.scene.restart();
    };

    showModal('Уровень пройден!', `Отлично! Готовы к уровню ${gameState.level + 1}?`, onConfirm);
}

function hitPaddle(ball, paddle) {
    if (activeBonus === 'C' && !ball.getData('isStuck')) {
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

/**
 * Показывает кастомное модальное окно.
 * @param {string} title - Заголовок окна.
 * @param {string} text - Основной текст сообщения.
 * @param {function} onConfirm - Функция, которая выполнится при нажатии на кнопку.
 */
function showModal(title, text, onConfirm) {
    // Находим HTML элементы
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalButton = document.getElementById('modal-button');

    // Заполняем текстом
    modalTitle.textContent = title;
    modalText.textContent = text;

    // Показываем окно
    modal.classList.add('visible');

    const confirmHandler = () => {
        modal.classList.remove('visible');

        // Выполняем переданное действие (например, перезапуск сцены)
        if (onConfirm) {
            onConfirm();
        }

        // Удаляем обработчик, чтобы он не сработал снова
        modalButton.removeEventListener('click', confirmHandler);
    };

    modalButton.addEventListener('click', confirmHandler);
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