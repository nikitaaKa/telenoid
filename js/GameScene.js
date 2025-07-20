class GameScene extends Phaser.Scene {
    constructor() {
        super({key: 'GameScene'});
        this.PADDLE_ASPECT_RATIO = 5.0;
        this.BRICK_ASPECT_RATIO = 2.0;
        this.PADDLE_HEIGHT_RATIO = 0.025;
        this.PADDLE_Y_OFFSET_RATIO = 0.5;
        this.BALL_DIAMETER_RATIO = 0.03;
        this.BRICK_ROWS = 5;
        this.BRICKS_PER_ROW = 10;
        this.BRICK_AREA_HEIGHT_RATIO = 0.4;
        this.stars;
        this.emitters = {};
        this.bonusEmitters = {};
        this.bonuses; // НОВАЯ переменная для группы бонусов
        this.activeBonus = null; // Хранит активный бонус (например, 'L')
        this.enemies;
        this.littleBalls;
        this.aimLine; // Линия прицеливания
        this.laserBeam; // Боевой лазер
        this.laserTimer; // Таймер для лазера
    }

    // Инициализация переменных сцены
    init(data) {
        if (data && data.hasOwnProperty('score')) {
            this.gameState = data;
        } else {
            this.gameState = { score: 0, level: 1, lives: 3 };
        }
        this.isGameplayActive = false;
        this.activeBonus = null;
        this.destroyableBricksCount = 0;
    }

    preload() {
        // --- Текстуры создаются один раз при предзагрузке сцены ---
        const createPixelTexture = (key, color) => {
            if (this.textures.exists(key)) return;
            const graphics = this.make.graphics();
            graphics.fillStyle(color);
            graphics.fillRect(0, 0, 1, 1);
            graphics.generateTexture(key, 1, 1);
            graphics.destroy();
        };

        createPixelTexture('pixel', 0xffffff);

        // Текстура для маленьких шариков
        if (!this.textures.exists('littleBallTexture')) {
            const littleBallGraphics = this.make.graphics();
            littleBallGraphics.fillStyle(0xcccccc);
            littleBallGraphics.fillCircle(5, 5, 5);
            littleBallGraphics.generateTexture('littleBallTexture', 10, 10);
            littleBallGraphics.destroy();
        }

        // Текстура для врага
        if (!this.textures.exists('enemy_triangle')) {
            const triangle = this.make.graphics();
            triangle.fillStyle(0xff0000);
            triangle.lineStyle(2, 0xffffff, 1);
            triangle.beginPath();
            triangle.moveTo(25, 0);
            triangle.lineTo(50, 50);
            triangle.lineTo(0, 50);
            triangle.closePath();
            triangle.fillPath();
            triangle.strokePath();
            triangle.generateTexture('enemy_triangle', 50, 50);
            triangle.destroy();
        }
    }

    create() {
        const {width, height} = this.cameras.main;

        // --- Установка мира и UI ---
        this.physics.world.setBoundsCollision(true, true, true, false);
        this.input.setDefaultCursor('none');
        this.createUI();

        // --- Создание игровых объектов и групп ---
        this.bricks = this.physics.add.staticGroup();
        this.bonuses = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.littleBalls = this.physics.add.group();
        this.mainBalls = this.add.group(); // Обычная группа для мячей

        this.createPaddle();
        const firstBall = this.createMainBall(this.paddle.x, this.paddle.y - this.paddle.displayHeight);
        this.mainBalls.add(firstBall);

        this.createParticles(firstBall);

        this.loadLevel(this.gameState.level);

        // --- Настройка управления и столкновений ---
        this.createInputHandlers();
        this.createColliders();

        // Таймер спауна врагов
        this.time.addEvent({
            delay: 15000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
    }

    update() {
        this.updateStars();
        if (this.activeBonus === 'L' && this.aimLine && this.aimLine.visible) {
            this.updateAimLine();
        }

        if (this.isGameplayActive && this.mainBalls.countActive(true) === 0) {
            this.loseLife();
            return;
        }

        this.mainBalls.getChildren().forEach(ball => {
            // Если игра не запущена, все мячи "сидят" на платформе
            if (!this.isGameplayActive) {
                ball.body.setVelocity(0, 0);
                ball.setPosition(
                    this.paddle.x,
                    this.paddle.y - (this.paddle.displayHeight / 2) - (ball.displayHeight / 2)
                );
            }
            // Если игра идет
            else {
                // --- ВОТ ОБРАБОТКА isStuck ---
                // Если у конкретного мяча есть флаг 'isStuck'
                if (ball.getData('isStuck')) {
                    // Мы жестко привязываем его к платформе
                    ball.body.setVelocity(0, 0);
                    ball.setPosition(
                        this.paddle.x,
                        this.paddle.y - (this.paddle.displayHeight / 2) - (ball.displayHeight / 2)
                    );
                }

                // Проверяем, не улетел ли мяч за нижнюю границу
                if (ball.y > this.cameras.main.height + ball.displayHeight) {
                    ball.destroy(); // Уничтожаем только этот конкретный мяч
                }
            }
        });

        if (this.isGameplayActive && this.destroyableBricksCount === 0) {
            this.winLevel();
        }
    }

    // --- МЕТОДЫ-ПОМОЩНИКИ ДЛЯ CREATE ---
    createUI() {
        const {width, height} = this.cameras.main;
        const fontSize = Math.min(width * 0.04, height * 0.03);
        this.scoreText = this.add.text(16, 16, `Счет: 0`, {fontSize: `${fontSize}px`, fill: '#fff'});
        this.levelText = this.add.text(width - 16, 16, `Уровень: 1`, {
            fontSize: `${fontSize}px`,
            fill: '#fff'
        }).setOrigin(1, 0);
        this.livesText = this.add.text(width / 2, 16, `Жизни: 3`, {
            fontSize: `${fontSize}px`,
            fill: '#fff'
        }).setOrigin(0.5, 0);
    }

    createPaddle() {
        const {width, height} = this.cameras.main;
        const paddleHeight = height * this.PADDLE_HEIGHT_RATIO;
        const paddleWidth = paddleHeight * this.PADDLE_ASPECT_RATIO;
        this.paddle = this.physics.add.sprite(width / 2, height - (height * this.PADDLE_Y_OFFSET_RATIO), 'pixel')
            .setDisplaySize(paddleWidth, paddleHeight).setImmovable(true);
        this.paddle.setCollideWorldBounds(true);
    }

    createParticles(firstBall) {
        this.createStars();
        this.createBrickEmitters();
        this.createBonusEmitters();
    }

    createStars() {
        // Создаем группу для хранения звезд
        this.stars = this.add.group();
        const { width, height } = this.cameras.main;

        // Создаем 200 звезд
        for (let i = 0; i < 200; i++) {
            // Создаем звезду в случайной точке экрана
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);

            // Задаем случайный размер (от 1 до 3 пикселей)
            const size = Phaser.Math.Between(1, 3);
            // Задаем случайную прозрачность
            const alpha = Phaser.Math.FloatBetween(0.1, 0.6);

            const star = this.stars.create(x, y, 'pixel');
            star.setDisplaySize(size, size);
            star.setAlpha(alpha);

            // Сохраняем скорость для каждой звезды. Чем больше звезда, тем быстрее она движется (эффект параллакса)
            star.setData('speed', size * 10);
        }
    }

    createBrickEmitters() {
        // Определяем цвета наших блоков, чтобы создать эмиттер для каждого
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

            // Создаем менеджер частиц.
            // add.particles возвращает менеджер, который может содержать один или несколько эмиттеров.
            const particles = this.add.particles(0, 0, 'pixel', {
                // Общие свойства для всех частиц, выпускаемых этим менеджером
                speed: { min: -200, max: 200 },
                angle: { min: 0, max: 360 },
                scale: { start: 2, end: 0 }, // Используем увеличенный размер
                alpha: { start: 1, end: 0 },
                lifespan: 600, // Используем увеличенное время жизни
                gravityY: 0,
                tint: color, // Сразу задаем цвет для этого менеджера

                // ВАЖНО: говорим ему не запускаться автоматически
                emitting: false
            });

            // Сохраняем менеджер в нашем объекте `emitters` по имени цвета.
            // Теперь мы можем вызвать, например, this.emitters.red.emitParticleAt(...)
            this.emitters[colorName] = particles;
        }
    }

    createBonusEmitters() {
        // Используем палитру цветов, определенную для бонусов
        const bonusColors = {
            'E': 0x2ecc71, 'S': 0x3498db, 'C': 0xf1c40f,
            'L': 0xe74c3c, 'R': 0x9b59b6, 'G': 0x1abc9c,
            'D': 0xff7f50, 'M': 0xbdc3c7, 'P': 0x27ae60
        };

        // Создаем по одному менеджеру частиц (который будет работать как эмиттер) для каждого типа бонуса
        for (const type in bonusColors) {
            const color = bonusColors[type];

            const particles = this.add.particles(0, 0, 'pixel', {
                speed: 0,
                scale: { start: 1, end: 0 },
                alpha: { start: 0.4, end: 0 },
                lifespan: 200,
                blendMode: 'ADD',
                tint: color, // Сразу задаем цвет для этого типа бонуса
                emitting: false
            });

            // Сохраняем менеджер в объекте `bonusEmitters` по ключу-букве
            // Теперь мы можем вызвать, например, this.bonusEmitters['L'].startFollow(...)
            this.bonusEmitters[type] = particles;
        }
    }

    createInputHandlers() {
        const {width, height} = this.cameras.main;
        this.input.on('pointermove', pointer => {
            this.paddle.x = Phaser.Math.Clamp(pointer.x, this.paddle.displayWidth / 2, width - this.paddle.displayWidth / 2);
        });

        this.input.on('pointerdown', () => {
            // --- НОВАЯ ЛОГИКА КЛИКА ---

            // 1. Ищем прилипшие мячи
            const stuckBalls = this.mainBalls.getChildren().filter(ball => ball.getData('isStuck'));

            // 2. Если нашли хотя бы один
            if (stuckBalls.length > 0) {
                stuckBalls.forEach(ball => {
                    // "Отклеиваем"
                    ball.setData('isStuck', false);
                    ball.body.setBounce(1); // Возвращаем ему отскок
                    // Запускаем в полет
                    ball.body.setVelocity(
                        Phaser.Math.Between(-width * 0.4, width * 0.4),
                        -height * 0.8
                    );
                    this.resetBonusEffects()
                });
                // Если шлейф был выключен, включаем
                if(this.ballTrail && !this.ballTrail.on) this.ballTrail.start();
                return; // Выходим, чтобы не выполнять другую логику
            }

            // 3. Если прилипших мячей нет, и игра еще не началась
            if (!this.isGameplayActive) {
                this.isGameplayActive = true;
                // Запускаем все мячи, которые "сидят" на платформе
                this.mainBalls.getChildren().forEach(ball => {
                    ball.body.setVelocity(
                        Phaser.Math.Between(-width * 0.4, width * 0.4),
                        -height * 0.8
                    );
                });
                if (this.ballTrail) this.ballTrail.start();
            }
        });
    }

    createColliders() {
        this.physics.add.collider(this.mainBalls, this.paddle, this.hitPaddle, null, this);
        this.physics.add.collider(this.mainBalls, this.bricks, this.hitBrick, null, this);
        this.physics.add.overlap(this.mainBalls, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.littleBalls, this.enemies, this.hitEnemy, null, this);
        this.physics.add.collider(this.littleBalls, this.bricks, this.hitBrickWithLittleBall, null, this);
        this.physics.add.collider(this.littleBalls, this.paddle);
        this.physics.add.overlap(this.paddle, this.bonuses, this.collectBonus, null, this);
    }

    updateStars() {
        // Проверяем, существует ли группа звезд, чтобы избежать ошибок
        if (!this.stars) {
            return;
        }

        // Получаем высоту экрана для проверки границ
        const { height } = this.cameras.main;

        // Перебираем всех "детей" группы this.stars
        for (const star of this.stars.getChildren()) {
            // Двигаем звезду вниз с ее индивидуальной скоростью.
            // Деление на 60 (или использование дельты времени) делает движение
            // плавным и независимым от частоты кадров (FPS).
            star.y += star.getData('speed') * (1 / 60);

            // Если звезда ушла за нижнюю границу экрана
            if (star.y > height) {
                // Перемещаем ее наверх (за пределы экрана, чтобы появление было плавным)
                star.y = -5; // -5 вместо 0, чтобы не было "скачка"
                // Задаем ей новую случайную горизонтальную позицию
                star.x = Phaser.Math.Between(0, this.cameras.main.width);
            }
        }
    }


    // --- ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ ПРЕВРАЩАЮТСЯ В МЕТОДЫ КЛАССА ---

    gameOver() {
        this.isGameplayActive = false;
        if (this.mainBalls.getFirstAlive()) this.mainBalls.getFirstAlive().body.stop();

        // --- ОТПРАВКА СЧЕТА В SUPABASE ---
        if (tg.initDataUnsafe.user) {
            this.saveScore(tg.initDataUnsafe.user.id, tg.initDataUnsafe.user.first_name, this.gameState.score);
        } else {
            this.saveScore(12345, 'Anonim', this.gameState.score);
        }

        const onConfirm = () => {
            this.scene.start('MainMenuScene'); // Возвращаемся в главное меню
            this.input.setDefaultCursor('none');
        };
        this.showModal('Игра окончена!', `Ваш итоговый счет: ${this.gameState.score}`, onConfirm);
    }

    async saveScore(userId, username, score) {
        try {
            const {error} = await supabaseClient
                .from('leaderboards')
                .insert([{user_id: userId, username: username, score: score}]);
            if (error) throw error;
            console.log('Score saved!');
        } catch (error) {
            console.error('Error saving score:', error);
        }
    }

    createMainBall(x, y) {
        const {width, height} = this.cameras.main;
        const ballDiameter = height * this.BALL_DIAMETER_RATIO;

        const textureName = 'ballDynamicTexture';
        if (!this.textures.exists(textureName)) {
            const ballGraphics = this.add.graphics();
            ballGraphics.fillStyle(0xffffff);
            ballGraphics.fillCircle(ballDiameter / 2, ballDiameter / 2, ballDiameter / 2);
            ballGraphics.generateTexture(textureName, ballDiameter, ballDiameter);
            ballGraphics.destroy();
        }

        // --- ИЗМЕНЕНИЕ: Создаем ФИЗИЧЕСКИЙ спрайт ---
        const newBall = this.physics.add.sprite(x, y, textureName);

        // --- Настройки, которые мы уже пробовали, но теперь они должны сработать ---
        newBall.setCircle(ballDiameter / 2);
        newBall.setBounce(1);
        newBall.setCollideWorldBounds(true);
        // Это свойство не нужно, так как setCollideWorldBounds(true) для физических спрайтов
        // уже подразумевает отскок от границ. Но оставим для надежности.
        newBall.body.onWorldBounds = true;
        newBall.body.setMaxVelocity(width * 1.5, height * 1.5);

        newBall.setData('isGiant', false);

        return newBall;
    }

    loadLevel(level) {
        this.destroyableBricksCount = 0;
        const levelLayout = this.generateLevel(level);
        const {width, height} = this.cameras.main;

        // --- КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ ЗДЕСЬ ---

        // 1. Определяем общую ширину для всей сетки блоков (например, 95% от ширины экрана)
        const gridAreaWidth = width * 0.95;

        // 2. Рассчитываем ширину одного блока внутри этой области.
        // У нас 10 блоков (this.BRICKS_PER_ROW) и 9 отступов между ними.
        // Пусть отступ будет 5% от ширины блока. Итого 10 блоков + 9*0.05 = 10.45 "эквивалентных" ширин.
        const brickWidth = gridAreaWidth / (this.BRICKS_PER_ROW + (this.BRICKS_PER_ROW - 1) * 0.05);
        const brickMarginX = brickWidth * 0.05; // Горизонтальный отступ

        // 3. Рассчитываем высоту блока, исходя из его ширины и аспекта.
        const brickHeight = brickWidth / this.BRICK_ASPECT_RATIO;
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
                    const block = this.bricks.create(x, y, 'pixel');

                    block.setDisplaySize(brickWidth, brickHeight)
                        .setData('type', blockType)
                        .setData('row', rowIndex)
                        .setData('col', colIndex);

                    if (blockType === 1) {
                        block.setTint(0x00aaff);
                        this.destroyableBricksCount++;
                    } else if (blockType === 2) {
                        block.setData('health', 2).setTint(0xff8c00);
                        this.destroyableBricksCount++;
                    } else if (blockType === 3) {
                        block.setTint(0xff4500);
                        this.destroyableBricksCount++;
                    } else if (blockType === 4) {
                        block.setTint(0x9400d3);
                        this.destroyableBricksCount++;
                    } else if (blockType === 5) {
                        block.setTint(0x32cd32);
                    } else if (blockType === 9) {
                        block.setTint(0x808080);
                    }
                    block.refreshBody();
                }
            });
        });

        this.updateUI();
    }

    resetPaddleAndBall() {
        this.isGameplayActive = false;

        // Сбрасываем позицию платформы
        const {width, height} = this.cameras.main;
        this.paddle.setPosition(width / 2, height - (height * this.PADDLE_Y_OFFSET_RATIO));

        // Находим единственный мяч в группе и ставим его на платформу.
        // getFirstAlive() - хороший способ найти активный мяч.
        const ball = this.mainBalls.getFirstAlive();
        if (ball) {
            ball.body.setVelocity(0, 0);
            ball.setPosition(this.paddle.x, this.paddle.y - (this.paddle.displayHeight / 2) - (ball.displayHeight / 2));
        }
    }

    generateLevel(level) {
        const layout = [];
        const rows = this.BRICK_ROWS + Math.floor(level / 3);
        const cols = this.BRICKS_PER_ROW;
        let hasDestroyableBrick = false;

        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) {
                const random = Math.random();
                let blockType = 0;

                if (random < 0.7 + level * 0.02) {
                    if (level > 6 && random < 0.05) {
                        blockType = 5;
                    } else if (level > 5 && random < 0.10) {
                        blockType = 4;
                    } else if (level > 4 && random < 0.15) {
                        blockType = 3;
                    } else if (level > 3 && random < 0.20) {
                        blockType = 9;
                    } else if (level > 1 && random < 0.40) {
                        blockType = 2;
                    } else {
                        blockType = 1;
                    }
                }

                if (blockType >= 1 && blockType <= 5) {
                    hasDestroyableBrick = true;
                }
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

    hitBrick(ball, brick) {
        const willDropBonus = Math.random() < 0.2;
        const blockType = brick.getData('type');
        const isGiant = this.activeBonus === 'G';

        if (blockType === 1) {
            this.destroyBrick(brick, 1, willDropBonus, ball);
        } else if (blockType === 2) {
            // Если мяч гигантский, ломаем сразу
            if (isGiant) {
                this.destroyBrick(brick, 5, willDropBonus, ball);
            } else {
                let health = brick.getData('health') - 1;
                brick.setData('health', health);
                if (health > 0) {
                    this.emitters.orange.emitParticleAt(brick.x, brick.y, 10);
                    brick.setTint(0xffd700);
                } else {
                    this.destroyBrick(brick, 5, willDropBonus, ball);
                }
            }
        } else if (blockType === 3) {
            this.explodeBrick(brick, willDropBonus);
        } else if (blockType === 4) {
            if (ball && ball.body) {
                ball.body.velocity.scale(1.25);
            }
            this.destroyBrick(brick, 1, willDropBonus, ball);
        } else if (blockType === 5) {
            const brickData = {
                x: brick.x,
                y: brick.y,
                tint: brick.tintTopLeft,
                row: brick.getData('row'),
                col: brick.getData('col'),
                type: 5
            };
            this.destroyBrick(brick, 1, false, ball);
            this.time.delayedCall(5000, () => this.regenerateBrick(brickData));
        }
    }

    destroyBrick(brick, points = 1, dropBonus = false, ballObject = null) {
        const blockType = brick.getData('type');

        const explosionX = ballObject ? ballObject.x : brick.x;
        const explosionY = ballObject ? ballObject.y : brick.y;

        // Определяем, какой эмиттер использовать
        let emitterToUse;
        if (blockType === 1) emitterToUse = this.emitters.blue;
        if (blockType === 2 && brick.getData('health') > 0) emitterToUse = this.emitters.orange;
        if (blockType === 2 && brick.getData('health') === 0) emitterToUse = this.emitters.gold; // Используем цвет "раненого" блока
        if (blockType === 3) emitterToUse = this.emitters.red;
        if (blockType === 4) emitterToUse = this.emitters.purple;
        if (blockType === 5) emitterToUse = this.emitters.green;

        // Запускаем нужный эмиттер
        if (emitterToUse) {
            emitterToUse.emitParticleAt(explosionX, explosionY, 30);
        }

        if (blockType !== 5) {
            this.destroyableBricksCount--;
        }

        brick.disableBody(true, true);
        this.updateScore(points);

        if (dropBonus) {
            this.spawnBonus(explosionX, explosionY);
        }
    }

    explodeBrick(centerBrick, willDropBonus) {
        const centerRow = centerBrick.getData('row');
        const centerCol = centerBrick.getData('col');
        this.destroyBrick(centerBrick, 3, willDropBonus);
        const childrenArray = this.bricks.children.entries;
        for (const child of childrenArray) {
            if (child && child.active) {
                const row = child.getData('row');
                const col = child.getData('col');
                if (Math.abs(row - centerRow) <= 1 && Math.abs(col - centerCol) <= 1) {
                    const type = child.getData('type');
                    if (type !== 9 && child !== centerBrick) {
                        this.time.delayedCall(50, () => {
                            if (child.active) {
                                hitBrick(null, child);
                            }
                        });
                    }
                }
            }
        }
    }

    regenerateBrick(data) {
        let isOccupied = false;
        const childrenArray = this.bricks.children.entries;
        for (const child of childrenArray) {
            if (child.active && child.getData('row') === data.row && child.getData('col') === data.col) {
                isOccupied = true;
                break;
            }
        }
        if (!isOccupied) {
            const {width, height} = this.cameras.main;
            const brickMarginX = width * 0.005;
            const totalMarginWidth = (this.BRICKS_PER_ROW + 1) * brickMarginX;
            const brickWidth = (width - totalMarginWidth) / this.BRICKS_PER_ROW;
            const brickMarginY = height * 0.005;
            const brickAreaHeight = height * this.BRICK_AREA_HEIGHT_RATIO;
            const numRows = generateLevel(this.gameState.level).length;
            const totalMarginHeight = (numRows + 1) * brickMarginY;
            const brickHeight = (brickAreaHeight - totalMarginHeight) / numRows;

            const block = this.bricks.create(data.x, data.y, 'pixel');
            block.setDisplaySize(brickWidth, brickHeight)
                .setTint(data.tint).setData('type', data.type)
                .setData('row', data.row).setData('col', data.col);
            block.refreshBody();
        }
    }

    spawnBonus(x, y) {
        const bonusColors = {
            'E': 0x2ecc71, 'S': 0x3498db, 'C': 0xf1c40f,
            'L': 0xe74c3c, 'R': 0x9b59b6,
            'G': 0x1abc9c, // Бирюзовый (Giant)
            'D': 0xff7f50, // Коралловый (Disruption)
            'M': 0xbdc3c7, // Серебряный (Multi-ball)
            'P': 0x27ae60, // Насыщенный зеленый (Points)
        };
        const bonusTypes = ['E', 'S', 'C', 'R', 'G', 'D', 'M', 'P']; // 'L' убрал патамушта лень
        const type = Phaser.Utils.Array.GetRandom(bonusTypes);
        const color = bonusColors[type];

        const bonusContainer = this.add.container(x, y);

        // --- Создание капсулы (остается без изменений) ---
        const capsuleGraphics = this.make.graphics({x: -30, y: -15}); // Смещаем, чтобы центр был в (0,0)
        capsuleGraphics.fillStyle(color, 0.8);
        capsuleGraphics.fillRoundedRect(0, 0, 60, 30, 15);
        const textureName = `capsule_${type}`;
        // Проверяем, существует ли уже такая текстура, чтобы не создавать ее повторно
        if (!this.textures.exists(textureName)) {
            capsuleGraphics.generateTexture(textureName, 60, 30);
        }
        capsuleGraphics.destroy();
        const capsule = this.add.sprite(0, 0, textureName);

        // --- Создание буквы (остается без изменений) ---
        const letter = this.add.text(0, 0, type, {
            fontSize: '22px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
            shadow: {color: '#000000', fill: true, blur: 2, offsetY: 2}
        }).setOrigin(0.5);

        bonusContainer.add([capsule, letter]);
        this.bonuses.add(bonusContainer);
        bonusContainer.body.velocity.y = 200;
        bonusContainer.setData('type', type);

        // --- Анимация пульсации (остается без изменений) ---
        this.tweens.add({
            targets: letter,
            scale: 1.25,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // --- ИЗМЕНЕНИЕ: Логика шлейфа ---
        // 1. Выбираем нужный эмиттер из нашего объекта
        const emitter = this.bonusEmitters[type];

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

    collectBonus(paddle, bonus) {
        const type = bonus.getData('type');
        bonus.destroy();
        this.resetBonusEffects();
        this.activeBonus = type;

        switch (type) {
            // ... старые бонусы ...
            case 'L':
                this.activateLaserAim();
                break;
            case 'C':
                break;
            case 'R':
                this.paddle.setDisplaySize(paddle.displayWidth * 0.75, paddle.displayHeight);
                break;

            // --- НОВЫЕ БОНУСЫ ---
            case 'G': // Giant Ball
                this.activateGiantBall(true);
                break;
            case 'D': // Disruption
                this.disruptBall();
                break;
            case 'M': // Multi-ball
                this.spawnLittleBalls();
                break;
            case 'P': // Points
                this.points = Phaser.Math.Between(100, 400);
                this.updateScore(this.points);
                // Этот бонус не имеет "активного" состояния, поэтому сбрасываем
                this.activeBonus = null;
                break;
        }

        // Бонус "Гигантский мяч" тоже будет временным
        if (type === 'E' || type === 'S' || type === 'R' || type === 'G') {
            this.time.delayedCall(10000, this.resetBonusEffects, [], this);
        }
    }

    resetBonusEffects() {
        const {width, height} = this.cameras.main;
        const paddleHeight = height * this.PADDLE_HEIGHT_RATIO;
        const paddleWidth = paddleHeight * this.PADDLE_ASPECT_RATIO;
        this.paddle.setDisplaySize(paddleWidth, paddleHeight);

        // Если мяч был приклеен, когда бонус закончился, отпускаем его
        this.mainBalls.getChildren().forEach(ball => {
            if (ball.getData('isStuck')) {
                ball.setData('isStuck', false);
                ball.body.setBounce(1); // Возвращаем отскок
                ball.body.setVelocity(Phaser.Math.Between(-width * 0.4, width * 0.4), -height * 0.8);
            }
        });

        if (this.activeBonus === 'G') {
            this.activateGiantBall(false);
        }

        if (this.laserTimer) {
            this.laserTimer.remove(); // Отменяем запланированный выстрел
            this.laserTimer = null;
        }
        if (this.aimLine) {
            this.aimLine.setVisible(false); // Прячем линию прицеливания
        }

        this.laserBeam = null
        this.aimLine = null
        this.activeBonus = null;
    }

    spawnEnemy() {
        const {width, height} = this.cameras.main;

        // 1. Определяем начальную и конечную точки
        const sideStart = Phaser.Math.Between(0, 3); // 0-верх, 1-право, 2-низ, 3-лево
        let xStart, yStart, xEnd, yEnd;

        // Выбираем стартовую позицию за экраном
        if (sideStart === 0) { // Сверху
            xStart = Phaser.Math.Between(0, width);
            yStart = -50;
        } else if (sideStart === 1) { // Справа
            xStart = width + 50;
            yStart = Phaser.Math.Between(0, height);
        } else if (sideStart === 2) { // Снизу
            xStart = Phaser.Math.Between(0, width);
            yStart = height + 50;
        } else { // Слева
            xStart = -50;
            yStart = Phaser.Math.Between(0, height);
        }

        // Выбираем конечную позицию на противоположной стороне
        // Чтобы траектория была интереснее, она не всегда будет строго противоположной
        const sideEnd = (sideStart + Phaser.Math.Between(1, 3)) % 4;
        if (sideEnd === 0) {
            xEnd = Phaser.Math.Between(0, width);
            yEnd = -50;
        } else if (sideEnd === 1) {
            xEnd = width + 50;
            yEnd = Phaser.Math.Between(0, height);
        } else if (sideEnd === 2) {
            xEnd = Phaser.Math.Between(0, width);
            yEnd = height + 50;
        } else {
            xEnd = -50;
            yEnd = Phaser.Math.Between(0, height);
        }

        // 2. Создаем врага, но БЕЗ ФИЗИЧЕСКОЙ СКОРОСТИ
        const enemy = this.enemies.create(xStart, yStart, 'enemy_triangle');
        if (!enemy) return;

        enemy.body.allowGravity = false;
        // Задаем вращение, оно будет работать независимо от твина
        enemy.body.setAngularVelocity(Phaser.Math.Between(-200, 200));
        // Убираем отскок, т.к. твин будет управлять позицией
        enemy.setBounce(0);

        // 3. Создаем Твин для плавного движения
        this.tweens.add({
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
    hitEnemy(ball, enemy) {
        // Проверяем, что оба объекта все еще активны, чтобы избежать двойного срабатывания
        if (!ball.active || !enemy.active) {
            return;
        }

        const points = Phaser.Math.Between(250, 500);
        this.updateScore(points);

        // Используем эффект взрыва от красного блока
        if (this.emitters.red) {
            this.emitters.red.emitParticleAt(enemy.x, enemy.y, 30);
        }

        // Уничтожаем врага
        enemy.destroy();

        // Важно: мы НЕ трогаем мяч. Он просто летит дальше.
    }

    activateLaserAim() {
        const {height} = this.cameras.main;
        const paddleTopY = paddle.y - (paddle.displayHeight / 2);

        // Если линии нет, создаем.
        if (!this.aimLine) {
            // Создаем с альфа 0.5 для полупрозрачности
            this.aimLine = this.add.rectangle(0, 0, 12, paddleTopY, 0xff0000, 0.5);
        }

        // "Оживляем" ее, как и лазер
        this.aimLine.setPosition(paddle.x, height / 2)
            .setAlpha(0.5) // Всегда возвращаем полупрозрачность
            .setVisible(true)
            .setActive(true);

        // Запускаем таймер
        this.laserTimer = this.time.delayedCall(5000, fireMegaLaser);
    }

    // Фаза 2: Выстрел боевым лазером
    fireMegaLaser() {
        const {width, height} = this.cameras.main;

        // 1. Прячем линию прицеливания, она свою задачу выполнила.
        if (this.aimLine) {
            this.aimLine.setVisible(false);
        }

        // 2. Запоминаем позицию, где должен появиться лазер.
        const laserX = this.aimLine.x;
        const paddleTopY = paddle.y - (paddle.displayHeight / 2);

        // 3. (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ) Если боевой лазер уже существует,
        // сначала принудительно убиваем все анимации (твины), которые на нем висят.
        // Это предотвращает конфликт со старой анимацией исчезновения.
        if (this.laserBeam) {
            this.tweens.killTweensOf(this.laserBeam);
        }

        // 4. Если боевой лазер еще никогда не создавался, создаем его.
        if (!this.laserBeam) {
            this.laserBeam = this.add.rectangle(laserX, paddleTopY / 2, 20, paddleTopY, 0xff0000, 1.0);
            this.laserBeam.setBlendMode('ADD');
        }

        // 5. "Оживляем" лазер: устанавливаем все его свойства в начальное состояние.
        // Это гарантирует, что он будет работать каждый раз, а не только в первый.
        this.laserBeam.setPosition(laserX, height / 2) // Ставим в нужную позицию.
            .setAlpha(1)                   // Делаем полностью непрозрачным.
            .setVisible(true);             // Делаем видимым.

        // 6. Механика уничтожения объектов под лазером.
        // Создаем невидимую физическую зону по размеру лазера.
        const zone = this.add.zone(laserX, height / 2, 20, height);
        this.physics.world.enable(zone);
        zone.body.setAllowGravity(false);

        // Получаем массив всех физических тел, которые пересекаются с этой зоной.
        const overlappingObjects = this.physics.overlapRect(laserX - 10, 0, 20, height, true, true);

        overlappingObjects.forEach(body => {
            const gameObject = body.gameObject;

            // Проверяем, что объект существует и активен.
            if (!gameObject || !gameObject.active) {
                return;
            }

            // Если это блок (включая неразрушимые).
            if (bricks.contains(gameObject)) {
                if (this.emitters.red) this.emitters.red.emitParticleAt(gameObject.x, gameObject.y, 15);
                // Если блок был разрушаемым, вычитаем его из счетчика.
                if (gameObject.getData('type') < 9) {
                    this.destroyableBricksCount--;
                }
                gameObject.disableBody(true, true);
            }

            // Если это враг.
            if (this.enemies.contains(gameObject)) {
                hitEnemy(null, gameObject); // Используем существующую функцию для убийства врагов.
            }
        });

        zone.destroy(); // Удаляем временную зону после проверки.

        // 7. Фаза исчезновения: запускаем новую анимацию (твин).
        this.tweens.add({
            targets: this.laserBeam,
            alpha: 0,           // Целевое значение прозрачности.
            duration: 500,      // Длительность анимации в мс.
            delay: 200,         // Задержка перед началом анимации (лазер виден 0.2 сек).
            onComplete: () => {
                // Когда анимация завершена, делаем лазер невидимым
                // и сбрасываем состояние бонуса.
                if (this.laserBeam) {
                    this.laserBeam.setVisible(false);
                }
                this.resetBonusEffects();
            }
        });
    }

    activateGiantBall(isActive) {
        const {height} = this.cameras.main;

        if (isActive) {
            // --- 1. Рассчитываем новый диаметр ---
            const giantDiameter = height * this.BALL_DIAMETER_RATIO * 2;
            const textureName = 'giantBallTexture';

            // --- 2. Проверяем, существует ли уже текстура такого размера ---
            // Это оптимизация, чтобы не создавать текстуру каждый раз
            if (!this.textures.exists(textureName)) {
                const ballGraphics = this.add.graphics();
                // Рисуем новый, большой круг
                ballGraphics.fillStyle(0xffffff); // Рисуем белым, цвет зададим через tint
                ballGraphics.fillCircle(giantDiameter / 2, giantDiameter / 2, giantDiameter / 2);
                ballGraphics.generateTexture(textureName, giantDiameter, giantDiameter);
                ballGraphics.destroy();
            }

            // --- 3. Применяем новую текстуру и сбрасываем размер ---
            // setDisplaySize(giantDiameter, giantDiameter) больше не нужен,
            // так как текстура уже имеет правильный размер.
            this.mainBalls.getChildren().forEach(ball => {
                ball.setTexture(textureName);
                ball.setCircle(giantDiameter / 2); // Физика теперь будет идеальной
            });

        } else {
            // --- Возвращаем старую текстуру ---
            const normalDiameter = height * this.BALL_DIAMETER_RATIO;
            // ballDynamicTexture была создана в create() и имеет правильный размер
            this.mainBalls.getChildren().forEach(ball => {
                ball.setTexture('ballDynamicTexture');
                ball.setCircle(normalDiameter / 2);
            });
        }
    }

    // Создает два клона основного мяча
    disruptBall() {
        this.mainBalls.getChildren().forEach(originalBall => {
            for (let i = 0; i < 2; i++) {
                const newBall = this.createMainBall(originalBall.x, originalBall.y);
                this.mainBalls.add(newBall);

                // Копируем скорость оригинального мяча
                const velocity = new Phaser.Math.Vector2(originalBall.body.velocity.x, originalBall.body.velocity.y);

                // Немного поворачиваем вектор скорости, чтобы они разлетелись
                velocity.rotate(Phaser.Math.DegToRad(i === 0 ? -15 : 15));

                newBall.body.setVelocity(velocity.x, velocity.y);

                // Если оригинальный мяч был гигантским, новые тоже будут такими
                if (originalBall.getData('isGiant')) {
                    const {height} = this.cameras.main;
                    const giantDiameter = height * this.BALL_DIAMETER_RATIO * 2;
                    newBall.setTexture('giantBallTexture');
                    newBall.setCircle(giantDiameter / 2);
                    newBall.setData('isGiant', true);
                }
            }
        });
    }

    // Создает 5 маленьких шариков
    spawnLittleBalls(count = 999) {
        for (let i = 0; i < count; i++) {
            // --- ИЗМЕНЕНИЕ: Используем новую текстуру ---
            const littleBall = this.littleBalls.create(this.paddle.x, this.paddle.y - 20, 'littleBallTexture');

            if (littleBall) {
                // --- ИЗМЕНЕНИЕ: setDisplaySize и setTint больше не нужны ---
                // Текстура уже имеет правильный размер и цвет.
                littleBall.setCircle(5); // Радиус физического тела = радиусу текстуры
                littleBall.setBounce(1).setCollideWorldBounds(true);
                littleBall.body.allowGravity = false;

                const angle = Phaser.Math.Between(-150, -30);
                this.physics.velocityFromAngle(angle, 400, littleBall.body.velocity);

                littleBall.setData('hitsLeft', 3);
            }
        }
    }

    // Обработчик столкновения маленького шарика с блоком
    hitBrickWithLittleBall(littleBall, brick) {
        let hits = littleBall.getData('hitsLeft') - 1;
        littleBall.setData('hitsLeft', hits);

        // Уничтожаем обычный блок
        if (brick.getData('type') === 1) {
            this.destroyBrick(brick);
        }
        // Прочный блок тоже уничтожаем с 1 удара
        else if (brick.getData('type') === 2) {
            this.destroyBrick(brick, 5);
        }
        // Другие блоки (взрывные и т.д.) тоже активируем
        else {
            this.hitBrick(null, brick);
        }

        // Если у шарика кончились "удары", уничтожаем его
        if (hits <= 0) {
            littleBall.destroy();
        }
    }

    updateScore(points) {
        this.gameState.score += points;
        this.updateUI();
    }

    loseLife() {
        this.gameState.lives--;
        this.updateUI();

        if (this.gameState.lives === 0) {
            // Если жизней не осталось, игра окончена.
            this.gameOver();
        } else {
            // Если жизни еще есть:
            // 1. Убедимся, что все старые мячи удалены (на всякий случай).
            this.mainBalls.clear(true, true);

            // 2. Создаем ОДИН новый мяч для следующей попытки.
            const {width, height} = this.cameras.main;
            const newBall = this.createMainBall(
                this.paddle.x, // Появляется над текущей позицией платформы
                this.paddle.y - (this.paddle.displayHeight / 2) - (height * this.BALL_DIAMETER_RATIO / 2)
            );
            this.mainBalls.add(newBall); // Добавляем его в нашу группу

            // 4. Сбрасываем позицию платформы и этого нового мяча.
            this.resetPaddleAndBall();
        }
    }
    winLevel() {
        // 1. Останавливаем активный игровой процесс
        this.isGameplayActive = false;

        // 2. Останавливаем все эффекты, связанные с мячами
        if (this.ballTrail) {
            this.ballTrail.stop();
        }

        // 3. Останавливаем движение всех мячей на экране
        this.mainBalls.getChildren().forEach(ball => {
            ball.body.stop();
        });

        // 4. Определяем действие, которое выполнится после закрытия окна
        const onConfirmAction = () => {
            // Увеличиваем номер уровня
            this.gameState.level++;
            // Восстанавливаем жизни до 3 на новом уровне
            this.gameState.lives = 3;
            // Перезапускаем текущую сцену.
            // Метод init() сбросит все переменные, а gameState сохранит новый уровень.
            this.scene.restart(this.gameState);
        };

        // 5. Показываем модальное окно
        this.showModal(
            'Уровень пройден!', // Заголовок
            `Отлично! Готовы к уровню ${this.gameState.level + 1}?`, // Текст
            onConfirmAction // Действие для кнопки "ОК"
        );
    }

    hitPaddle(ball, paddle) {
        if (this.activeBonus === 'C' && !ball.getData('isStuck')) {
            ball.setData('isStuck', true);
            // ball.body.setBounce(0);
            return;
        }

        const diff = (ball.x - paddle.x) / (paddle.displayWidth / 2);
        const influence = diff * (this.cameras.main.width * 0.4);
        const newVx = Phaser.Math.Clamp(ball.body.velocity.x + influence, -this.cameras.main.width, this.cameras.main.width);
        ball.body.setVelocityX(newVx);
    }

    updateUI() {
        this.scoreText.setText(`Счет: ${this.gameState.score}`);
        this.levelText.setText(`Уровень: ${this.gameState.level}`);
        this.livesText.setText(`Жизни: ${this.gameState.lives}`);
    }

    /**
     * Показывает кастомное модальное окно.
     * @param {string} title - Заголовок окна.
     * @param {string} text - Основной текст сообщения.
     * @param {function} onConfirm - Функция, которая выполнится при нажатии на кнопку.
     */
    showModal(title, text, onConfirm) {
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
}
