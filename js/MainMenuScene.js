class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Название игры
        this.add.text(width / 2, height * 0.3, 'ARKANOID', {
            fontSize: `${width * 0.1}px`,
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Кнопка "Играть"
        const playButton = this.add.text(width / 2, height * 0.5, 'Играть', {
            fontSize: `${width * 0.07}px`,
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        playButton.on('pointerdown', () => {
            this.scene.start('GameScene'); // Запускаем игровую сцену
        });

        // Кнопка "Лидеры"
        const leaderboardButton = this.add.text(width / 2, height * 0.65, 'Таблица лидеров', {
            fontSize: `${width * 0.05}px`,
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#2ecc71',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        leaderboardButton.on('pointerdown', () => {
            this.scene.start('LeaderboardScene'); // Запускаем сцену лидеров
        });
    }
}