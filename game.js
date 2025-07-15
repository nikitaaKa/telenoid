// =========================================================
// ИЗМЕНЕНИЕ: Задаем наше базовое ("идеальное") разрешение
// =========================================================
const GAME_WIDTH = 480;
const GAME_HEIGHT = 854; // Соотношение сторон 9:16, как у многих телефонов

// --- КОНФИГУРАЦИЯ ИГРЫ ---
const config = {
    type: Phaser.AUTO,
    // ИЗМЕНЕНИЕ: Указываем наше базовое разрешение
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1d212d',

    // ИЗМЕНЕНИЕ: Добавляем настройки масштабирования
    scale: {
        mode: Phaser.Scale.FIT, // Вписывает игру в экран, сохраняя пропорции
        autoCenter: Phaser.Scale.CENTER_BOTH, // Центрирует игру на экране
        parent: 'game-container' // ID div-элемента, куда будет вставлена игра
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

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let paddle;
let ball;
let bricks;
let lives = 3;
let livesText;
let gameStarted = false;

// --- СОЗДАНИЕ ИГРЫ ---
const game = new Phaser.Game(config);

function preload() {
    // ... (код preload остается без изменений) ...
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
    this.physics.world.setBoundsCollision(true, true, true, false);

    // --- ИЗМЕНЕНИЕ: Позиционируем блоки относительно GAME_WIDTH ---
    const brickWidth = 44;
    const brickHeight = 22;
    const bricksPerRow = 10;
    const brickMargin = 2;
    const totalBricksWidth = (bricksPerRow * (brickWidth + brickMargin)) - brickMargin;
    const offsetX = (GAME_WIDTH - totalBricksWidth) / 2;

    bricks = this.physics.add.staticGroup({
        key: 'pixel',
        frameQuantity: 50,
        gridAlign: {
            width: bricksPerRow,
            height: 5,
            cellWidth: brickWidth + brickMargin,
            cellHeight: brickHeight + brickMargin,
            x: offsetX + (brickWidth / 2),
            y: 100 // Отступ сверху
        }
    });

    bricks.children.iterate(function (child) {
        child.setDisplaySize(brickWidth, brickHeight);
        child.setTint(0x00aaff);
        child.refreshBody();
    });

    // --- ИЗМЕНЕНИЕ: Позиционируем платформу относительно GAME_WIDTH и GAME_HEIGHT ---
    // this.cameras.main.centerX - это всегда центр нашего игрового мира
    paddle = this.physics.add.sprite(this.cameras.main.centerX, GAME_HEIGHT - 60, 'pixel')
        .setDisplaySize(100, 20)
        .setTint(0xffffff)
        .setImmovable(true);
    paddle.setCollideWorldBounds(true);

    // --- ИЗМЕНЕНИЕ: Позиционируем мяч ---
    ball = this.physics.add.sprite(this.cameras.main.centerX, paddle.y - 20, 'ballTexture');
    ball.setCircle(10);
    ball.setCollideWorldBounds(true);
    ball.setBounce(1);
    ball.body.setMaxVelocity(600, 600);

    // --- ИЗМЕНЕНИЕ: В управлении используем pointer.worldX ---
    this.input.on('pointermove', function (pointer) {
        // pointer.x - это координата на реальном HTML-экране.
        // pointer.worldX - это координата внутри нашего игрового мира 480x854.
        // Это то, что нам нужно!
        paddle.x = Phaser.Math.Clamp(pointer.worldX, paddle.displayWidth / 2, GAME_WIDTH - paddle.displayWidth / 2);
    });

    this.input.on('pointerdown', function () {
        if (!gameStarted) {
            ball.body.setVelocity(Phaser.Math.Between(-200, 200), -450);
            gameStarted = true;
        }
    });

    this.physics.add.collider(ball, paddle, hitPaddle, null, this);
    this.physics.add.collider(ball, bricks, hitBrick, null, this);

    livesText = this.add.text(16, 16, 'Жизни: ' + lives, { fontSize: '24px', fill: '#fff', fontFamily: 'Arial' });
}

function update() {
    if (!gameStarted) {
        ball.setPosition(paddle.x, paddle.y - (paddle.displayHeight / 2) - (ball.body.height / 2));
    }

    // --- ИЗМЕНЕНИЕ: Проверяем проигрыш относительно GAME_HEIGHT ---
    if (ball.y > GAME_HEIGHT) {
        loseLife();
    }

    if (bricks.countActive(true) === 0) {
        winLevel();
    }
}

function hitBrick(ball, brick) {
    brick.disableBody(true, true);
}

function hitPaddle(ball, paddle) {
    const diff = (ball.x - paddle.x) / (paddle.displayWidth / 2);
    const currentVelocity = ball.body.velocity.clone();
    const influence = diff * 200;
    const newVx = Phaser.Math.Clamp(currentVelocity.x + influence, -450, 450);
    ball.body.setVelocityX(newVx);
}

function loseLife() {
    lives--;
    livesText.setText('Жизни: ' + lives);

    if (lives === 0) {
        alert('Игра окончена!');
        location.reload();
    } else {
        resetLevel();
    }
}

function resetLevel() {
    gameStarted = false;
    paddle.setPosition(this.cameras.main.centerX, GAME_HEIGHT - 60);
    ball.body.setVelocity(0, 0);
}

function winLevel() {
    alert('Уровень пройден!');
    location.reload();
}