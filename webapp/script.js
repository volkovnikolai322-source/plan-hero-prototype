document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand(); // Растягиваем приложение на весь экран

    // --- Элементы UI ---
    const progressTextEl = document.getElementById('progressText');
    const progressBarEl = document.getElementById('progressBar');
    const goalStatusEl = document.getElementById('goalStatus');
    const reservePointsEl = document.getElementById('reservePoints');
    const productListEl = document.getElementById('productList');

    // --- Каталог товаров ---
    const products = [
        { id: 1, name: 'Батарея Dyson', points: 5 },
        { id: 2, name: 'Main Body Dyson', points: 10 },
        { id: 3, name: 'Наушники Shokz', points: 10 },
        { id: 4, name: 'Аппарат Cefaly', points: 45 },
        { id: 5, name: 'Фильтр Dyson', points: 3 },
        { id: 6, name: 'Стайлер Dyson', points: 20 },
    ];

    // --- Состояние приложения ---
    let state = {
        dailyGoal: 100,
        currentPoints: 0,
        reservePoints: 0,
        lastUpdate: new Date().toDateString() // Для сброса прогресса на следующий день
    };

    // --- Функции ---

    // Загрузка состояния из localStorage
    function loadState() {
        const savedState = JSON.parse(localStorage.getItem('planHeroState'));
        if (savedState) {
            // Если наступил новый день - сбрасываем дневной прогресс
            if (new Date().toDateString() !== savedState.lastUpdate) {
                // Автоматически используем резерв для закрытия вчерашнего дня, если нужно
                const neededPoints = Math.max(0, state.dailyGoal - savedState.currentPoints);
                if (savedState.reservePoints >= neededPoints) {
                    savedState.reservePoints -= neededPoints;
                }
                // Сбрасываем только дневные очки
                savedState.currentPoints = 0;
                savedState.lastUpdate = new Date().toDateString();
            }
            state = savedState;
        }
        saveState(); // Сохраняем (на случай, если был сброс)
    }

    // Сохранение состояния в localStorage
    function saveState() {
        localStorage.setItem('planHeroState', JSON.stringify(state));
    }

    // Обновление всех элементов UI
    function updateUI() {
        progressTextEl.textContent = `${state.currentPoints} / ${state.dailyGoal}`;
        reservePointsEl.textContent = state.reservePoints;

        const progressPercent = Math.min(100, (state.currentPoints / state.dailyGoal) * 100);
        progressBarEl.style.width = `${progressPercent}%`;

        if (state.currentPoints >= state.dailyGoal) {
            goalStatusEl.textContent = '🔥 План выполнен!';
            goalStatusEl.style.color = 'green';
        } else {
            goalStatusEl.textContent = '';
        }
    }

    // Рендеринг списка товаров
    function renderProductList() {
        productListEl.innerHTML = '';
        products.forEach(product => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                <div>
                    <div class="product-info">${product.name}</div>
                    <div class="product-points">+${product.points} очков</div>
                </div>
                <div class="add-button">+</div>
            `;
            item.addEventListener('click', () => addProduct(product));
            productListEl.appendChild(item);
        });
    }

    // Логика добавления продукта
    function addProduct(product) {
        const previousPoints = state.currentPoints;
        state.currentPoints += product.points;

        // Логика перевыполнения и пополнения резерва
        if (previousPoints < state.dailyGoal && state.currentPoints >= state.dailyGoal) {
            const overflow = state.currentPoints - state.dailyGoal;
            state.reservePoints += overflow;
            tg.HapticFeedback.notificationOccurred('success'); // Виброотклик
        } else if (state.currentPoints > state.dailyGoal) {
            state.reservePoints += product.points;
        }

        saveState();
        updateUI();

        // Отправляем данные боту для подтверждения
        tg.sendData(JSON.stringify({ name: product.name, points: product.points }));
    }


    // --- Инициализация приложения ---
    loadState();
    renderProductList();
    updateUI();
});