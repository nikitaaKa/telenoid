// --- КОНФИГУРАЦИЯ ИГРЫ ---
const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;

// 1. Глобальные переменные
const gameState = {
    score: 0,
    level: 1,
    lives: 3,
};

let paddle, ball, bricks;
let scoreText, levelText, livesText;
let gameStarted = false;
let destroyableBricksCount = 0;
let gameScene;

// 2. Все функции игры

function preload() {
    // Создаем программные текстуры для объектов
    const graphicsRect = this.add.graphics();
    graphicsRect.fillStyle(0xffffff, 1.0);
    graphicsRect.fillRect(0, 0, 1, 1);
    graphicsRect.generateTexture('pixel', 1, 1);
    graphicsRect.destroy();

    const graphicsCircle = this.add.graphics();
    graphicsCircle.fillStyle(0xffffff);
    graphicsCircle.fillCircle(10, 10, 10);
    graphicsCircle.generateTexture('ballTexture', 20, 20);
    graphicsCircle.destroy();
}

function create() {
    gameScene = this;

    gameScene.physics.world.setBoundsCollision(true, true, true, false);

    // UI Элементы
    scoreText = gameScene.add.text(16, 16, `Счет: 0`, { fontSize: '24px', fill: '#fff', fontFamily: 'Arial' });
    levelText = gameScene.add.text(GAME_WIDTH, 16, `Уровень: 1`, { fontSize: '24px', fill: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0);
    livesText = gameScene.add.text(gameScene.cameras.main.centerX, 16, `Жизни: 3`, { fontSize: '24px', fill: '#fff', fontFamily: 'Arial' }).setOrigin(0.5, 0);

    // Игровые объекты
    bricks = gameScene.physics.add.staticGroup();

    paddle = gameScene.physics.add.sprite(gameScene.cameras.main.centerX, GAME_HEIGHT - 90, 'pixel')
        .setDisplaySize(100, 20).setTint(0xffffff).setImmovable(true);
    paddle.setCollideWorldBounds(true);

    ball = gameScene.physics.add.sprite(gameScene.cameras.main.centerX, paddle.y - 20, 'ballTexture');
    ball.setCircle(10).setCollideWorldBounds(true).setBounce(1);
    ball.body.setMaxVelocity(600, 600);

    // Загрузка уровня
    loadLevel(gameState.level);

    // Управление
    gameScene.input.on('pointermove', pointer => {
        paddle.x = Phaser.Math.Clamp(pointer.worldX, paddle.displayWidth / 2, GAME_WIDTH - paddle.displayWidth / 2);
    });
    gameScene.input.on('pointerdown', () => {
        if (!gameStarted) {
            ball.body.setVelocity(Phaser.Math.Between(-200, 200), -450);
            gameStarted = true;
        }
    });

    // Физика
    gameScene.physics.add.collider(ball, paddle, hitPaddle);
    gameScene.physics.add.collider(ball, bricks, hitBrick);
}

function update() {
    // Привязка мяча к платформе до старта
    if (!gameStarted) {
        ball.setPosition(paddle.x, paddle.y - (paddle.displayHeight / 2) - (ball.body.height / 2));
    }

    // Условие проигрыша жизни
    if (ball.y > GAME_HEIGHT) {
        loseLife();
    }

    // Условие победы на уровне
    if (destroyableBricksCount === 0 && gameStarted) {
        winLevel();
    }
}

// Генератор уровней
function generateLevel(level) {
    const layout = [];
    // Количество рядов растет с уровнем
    const rows = 5 + Math.floor(level / 3);
    const cols = 10;
    let hasDestroyableBrick = false;

    for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
            const random = Math.random();
            let blockType = 0; // 0 = пустое место

            // Общий шанс появления блока на клетке. Растет с уровнем.
            if (random < 0.7 + level * 0.02) {
                // Чем выше уровень, тем больше шанс наткнуться на особый блок.
                // Проверяем от редких к частым.
                if (level > 6 && random < 0.05) {
                    blockType = 5; // 5 = Регенерирующий (5% шанс)
                } else if (level > 5 && random < 0.10) {
                    blockType = 4; // 4 = Ускоритель (5% шанс)
                } else if (level > 4 && random < 0.15) {
                    blockType = 3; // 3 = Взрывающийся (5% шанс)
                } else if (level > 3 && random < 0.20) {
                    blockType = 9; // 9 = Неразрушимый (5% шанс)
                } else if (level > 1 && random < 0.40) {
                    blockType = 2; // 2 = Прочный (20% шанс)
                } else {
                    blockType = 1; // 1 = Обычный
                }
            }

            // Проверяем, создали ли мы хоть один блок, который можно уничтожить.
            // Это нужно для условия победы.
            if (blockType >= 1 && blockType <= 5) {
                hasDestroyableBrick = true;
            }
            row.push(blockType)

        }
        layout.push(row);
    }

    // Гарантия: если после генерации на карте нет ни одного разрушаемого блока
    // (например, случайно создались только неразрушимые или вообще ничего),
    // то мы принудительно создаем один обычный блок в случайном месте.
    // Это предотвращает баг с мгновенным прохождением уровня.
    if (!hasDestroyableBrick) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);
        layout[randomRow][randomCol] = 1; // Ставим один обычный блок
    }

    return layout;
}

// Функция загрузки и отрисовки уровня
function loadLevel(level) {
    destroyableBricksCount = 0;
    const levelLayout = generateLevel(level);

    const brickWidth = 44, brickHeight = 22, brickMargin = 2;
    const totalBricksWidth = (10 * (brickWidth + brickMargin)) - brickMargin;
    const offsetX = (GAME_WIDTH - totalBricksWidth) / 2;

    levelLayout.forEach((row, rowIndex) => {
        row.forEach((blockType, colIndex) => {
            if (blockType > 0) {
                const x = offsetX + colIndex * (brickWidth + brickMargin) + brickWidth / 2;
                const y = 100 + rowIndex * (brickHeight + brickMargin) + brickHeight / 2;
                const block = bricks.create(x, y, 'pixel');

                block.setDisplaySize(brickWidth, brickHeight)
                     .setData('type', blockType)
                     .setData('row', rowIndex) // Сохраняем позицию в сетке для взрывов
                     .setData('col', colIndex);

                if (blockType === 1) { // Обычный
                    block.setTint(0x00aaff);
                    destroyableBricksCount++;
                } else if (blockType === 2) { // Прочный
                    block.setData('health', 2).setTint(0xff8c00);
                    destroyableBricksCount++;
                } else if (blockType === 3) { // Взрывающийся
                    block.setTint(0xff4500); // Огненно-красный
                    destroyableBricksCount++;
                } else if (blockType === 4) { // Ускоритель
                    block.setTint(0x9400d3); // Фиолетовый
                    destroyableBricksCount++;
                } else if (blockType === 5) { // Регенерирующий
                    block.setTint(0x32cd32); // Зеленый
                } else if (blockType === 9) { // Неразрушимый
                    block.setTint(0x808080);
                }
                block.refreshBody();
            }
        });
    });

    updateUI();
}

function hitBrick(ball, brick) {
    // Больше не используем "this". Используем глобальную переменную gameScene.
    const blockType = brick.getData('type');

    if (blockType === 1) { // Обычный
        destroyBrick(brick);
    }
    else if (blockType === 2) { // Прочный
        let health = brick.getData('health') - 1;
        brick.setData('health', health);
        if (health > 0) {
            brick.setTint(0xffd700);
        } else {
            destroyBrick(brick, 5);
        }
    }
    else if (blockType === 3) { // Взрывающийся
        explodeBrick(brick);
    }
    else if (blockType === 4) { // Ускоритель
        if (ball && ball.body) {
            ball.body.velocity.scale(1.25);
        }
        destroyBrick(brick);
    }
    else if (blockType === 5) { // Регенерирующий
        const brickData = {
            x: brick.x,
            y: brick.y,
            tint: brick.tintTopLeft,
            row: brick.getData('row'),
            col: brick.getData('col'),
            type: 5,
        };
        destroyBrick(brick);
        gameScene.time.delayedCall(5000, () => regenerateBrick(brickData));
    }
}

// Вспомогательная функция для уничтожения блока и начисления очков
function destroyBrick(brick, points = 1) {
    const blockType = brick.getData('type');

    brick.disableBody(true, true);
    updateScore(points);

    if (blockType !== 5) {
        destroyableBricksCount--;
    }
}

// Вспомогательная функция для взрыва блока
function explodeBrick(centerBrick) {
    const centerRow = centerBrick.getData('row');
    const centerCol = centerBrick.getData('col');

    destroyBrick(centerBrick, 3);

    const childrenArray = bricks.children.entries;
    for (const child of childrenArray) {
        if (child && child.active) {
            const row = child.getData('row');
            const col = child.getData('col');

            if (Math.abs(row - centerRow) <= 1 && Math.abs(col - centerCol) <= 1) {
                const type = child.getData('type');

                if (type !== 9 && child !== centerBrick) {
                    // Используем глобальную gameScene.
                    gameScene.time.delayedCall(50, () => {
                        if (child.active) {
                            // И вызываем hitBrick напрямую.
                            hitBrick(null, child);
                        }
                    });
                }
            }
        }
    }
}

// Вспомогательная функция для восстановления блока
function regenerateBrick(data) {
    let isOccupied = false;
    bricks.children.iterate(child => {
        if (child.active && child.getData('row') === data.row && child.getData('col') === data.col) {
            isOccupied = true;
        }
    });

    if (!isOccupied) {
        const brick = bricks.create(data.x, data.y, 'pixel');
        const brickWidth = 44, brickHeight = 22;
        brick.setDisplaySize(brickWidth, brickHeight)
             .setTint(data.tint)
             .setData('type', data.type)
             .setData('row', data.row)
             .setData('col', data.col);

        brick.refreshBody();
    }
}

function hitPaddle(ball, paddle) {
    const diff = (ball.x - paddle.x) / (paddle.displayWidth / 2);
    const influence = diff * 200;
    const newVx = Phaser.Math.Clamp(ball.body.velocity.x + influence, -450, 450);
    ball.body.setVelocityX(newVx);
}

// Логика игрового цикла
function updateScore(points) {
    gameState.score += points;
    updateUI();
}

function loseLife() {
    gameState.lives--;
    updateUI();

    if (gameState.lives === 0) {
        gameOver();
    } else {
        resetPaddleAndBall();
    }
}

function gameOver() {
    alert(`Игра окончена! Ваш итоговый счет: ${gameState.score}`);
    gameState.level = 1;
    gameState.score = 0;
    gameState.lives = 3;
    gameStarted = false;
    gameScene.scene.restart();
}

function winLevel() {
    alert(`Уровень ${gameState.level} пройден!`);
    gameState.level++;
    gameState.lives = 3;
    gameStarted = false;
    gameScene.scene.restart();
}

function resetPaddleAndBall() {
    gameStarted = false;
    paddle.setPosition(gameScene.cameras.main.centerX, GAME_HEIGHT - 90);
    ball.body.setVelocity(0, 0);
}

function updateUI() {
    scoreText.setText(`Счет: ${gameState.score}`);
    levelText.setText(`Уровень: ${gameState.level}`);
    livesText.setText(`Жизни: ${gameState.lives}`);
}

// 3. Конфигурация игры
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1d212d',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container' // <-- Вот он, наш ключ к успеху
    },
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

// 4. Запуск игры
const game = new Phaser.Game(config);