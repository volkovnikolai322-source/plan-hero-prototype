document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // --- Элементы UI ---
    const productListEl = document.getElementById('productList');
    const todaysOrdersListEl = document.getElementById('todaysOrdersList');
    // ... и все остальные selectors ...
    const progressTextEl = document.getElementById('progressText');
    const progressBarEl = document.getElementById('progressBar');
    const goalStatusEl = document.getElementById('goalStatus');
    const reservePointsEl = document.getElementById('reservePoints');
    const mainScreen = document.getElementById('mainScreen');
    const statsScreen = document.getElementById('statsScreen');
    const navMainBtn = document.getElementById('navMain');
    const navStatsBtn = document.getElementById('navStats');
    const streakCountEl = document.getElementById('streakCount');
    const monthYearEl = document.getElementById('monthYear');
    const calendarGridEl = document.getElementById('calendarGrid');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const weekProgressTextEl = document.getElementById('weekProgressText');
    const weekProgressBarEl = document.getElementById('weekProgressBar');
    const monthProgressTextEl = document.getElementById('monthProgressText');
    const monthProgressBarEl = document.getElementById('monthProgressBar');

    // --- Состояние приложения ---
    let state = {
        dailyGoal: 100,
        currentPoints: 0,
        reservePoints: 0,
        weekPoints: 0,
        weekGoal: 700,
        monthPoints: 0,
        monthGoal: 3000,
        todaysOrders: [], // Массив для хранения сегодняшних заказов
    };
    let currentMonthDate = new Date();
    
    // --- Настройка Firebase ---
    const ADMIN_USER_ID = 123456789; // <-- ЗАМЕНИТЕ НА ВАШ TELEGRAM ID
    const userId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : 'test-user-id';
    const userDocRef = db.collection('users').doc(userId);
    const dailyProgressCollectionRef = userDocRef.collection('daily_progress');
    const productsCollectionRef = db.collection('products');
    
    const todayId = new Date().toISOString().split('T')[0];
    const todaysOrdersCollectionRef = dailyProgressCollectionRef.doc(todayId).collection('orders');

    // --- Функции ---

    async function loadState() {
        try {
            const userDoc = await userDoc.get();
            if (userDoc.exists) {
                state.reservePoints = userDoc.data().reservePoints || 0;
            }

            // Загружаем список сегодняшних заказов
            const ordersSnapshot = await todaysOrdersCollectionRef.orderBy('timestamp').get();
            state.todaysOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            recalculateTotals(); // Пересчитываем все итоги на основе списка заказов
            renderTodaysOrders();

            // Загружаем данные для статистики недели/месяца
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 31);
            const monthAgoId = monthAgo.toISOString().split('T')[0];

            const snapshot = await dailyProgressCollectionRef.where(firebase.firestore.FieldPath.documentId(), ">=", monthAgoId).get();
            
            const firstDayOfWeek = new Date();
            firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay() + (firstDayOfWeek.getDay() === 0 ? -6 : 1));
            const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

            let weekPoints = 0;
            let monthPoints = 0;

            snapshot.forEach(doc => {
                const docDate = new Date(doc.id);
                if (docDate >= firstDayOfWeek) weekPoints += doc.data().points || 0;
                if (docDate >= firstDayOfMonth) monthPoints += doc.data().points || 0;
            });

            state.weekPoints = weekPoints;
            state.monthPoints = monthPoints;

        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            alert("Не удалось загрузить данные.");
        }
        updateUI();
    }

    // Пересчет итогов на основе списка state.todaysOrders
    function recalculateTotals() {
        state.currentPoints = state.todaysOrders.reduce((sum, order) => sum + order.points, 0);
    }
    
    // Отрисовка списка сегодняшних заказов
    function renderTodaysOrders() {
        todaysOrdersListEl.innerHTML = '';
        if (state.todaysOrders.length === 0) {
            todaysOrdersListEl.innerHTML = '<p>Пока нет заказов за сегодня.</p>';
            return;
        }
        state.todaysOrders.forEach(order => {
            const item = document.createElement('div');
            item.className = 'order-item';
            item.innerHTML = `
                <div>
                    <div class="product-info">${order.name}</div>
                    <div class="product-points">${order.points} очков</div>
                </div>
                <button class="delete-order-btn" data-id="${order.id}" data-points="${order.points}">❌</button>
            `;
            todaysOrdersListEl.appendChild(item);
        });
    }

    // Обработчик для удаления заказа (вешаем на родителя)
    todaysOrdersListEl.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-order-btn')) {
            const orderId = event.target.dataset.id;
            const pointsToSubtract = parseInt(event.target.dataset.points, 10);
            deleteOrder(orderId, pointsToSubtract);
        }
    });

    async function addProduct(product) {
        // ... (логика резервного фонда, как и раньше) ...
        const previousPoints = state.currentPoints;
        const newTotalPoints = state.currentPoints + product.points;
        let newReservePoints = state.reservePoints;
        if (previousPoints < state.dailyGoal && newTotalPoints >= state.dailyGoal) {
            const overflow = newTotalPoints - state.dailyGoal;
            newReservePoints += overflow;
            tg.HapticFeedback.notificationOccurred('success');
        } else if (newTotalPoints > state.dailyGoal) {
            newReservePoints += product.points;
        }
        
        // 1. Добавляем заказ в подколлекцию
        const newOrderRef = await todaysOrdersCollectionRef.add({
            name: product.name,
            points: product.points,
            timestamp: new Date()
        });

        // 2. Обновляем итоговые очки за день
        await dailyProgressCollectionRef.doc(todayId).set({ points: newTotalPoints, goal: state.dailyGoal }, { merge: true });
        
        // 3. Обновляем резервный фонд
        await userDocRef.set({ reservePoints: newReservePoints }, { merge: true });

        // 4. Обновляем локальное состояние и UI
        state.todaysOrders.push({ id: newOrderRef.id, ...product });
        await loadState(); // Перезагружаем все состояние для синхронизации
    }
    
    async function deleteOrder(orderId, pointsToSubtract) {
        if (!confirm("Вы уверены, что хотите удалить этот заказ?")) return;

        // ... (логика вычета из резервного фонда) ...
        const previousPoints = state.currentPoints;
        const newTotalPoints = state.currentPoints - pointsToSubtract;
        let newReservePoints = state.reservePoints;
        if (previousPoints >= state.dailyGoal && newTotalPoints < state.dailyGoal) {
            const overflow = previousPoints - state.dailyGoal;
            newReservePoints -= overflow;
        } else if (newTotalPoints >= state.dailyGoal) {
            newReservePoints -= pointsToSubtract;
        }
        newReservePoints = Math.max(0, newReservePoints); // Резерв не может быть отрицательным

        // 1. Удаляем заказ из подколлекции
        await todaysOrdersCollectionRef.doc(orderId).delete();

        // 2. Обновляем итоговые очки за день
        await dailyProgressCollectionRef.doc(todayId).set({ points: newTotalPoints }, { merge: true });
        
        // 3. Обновляем резервный фонд
        await userDocRef.set({ reservePoints: newReservePoints }, { merge: true });
        
        // 4. Обновляем локальное состояние и UI
        await loadState(); // Перезагружаем все состояние для синхронизации
    }

    // ... (весь остальной код без изменений: updateUI, renderProductList, навигация, статистика, календарь, инициализация) ...
    function updateUI() {
        progressTextEl.textContent = `${state.currentPoints} / ${state.dailyGoal}`;
        let progressPercent = Math.min(100, (state.currentPoints / state.dailyGoal) * 100);
        progressBarEl.style.width = `${progressPercent}%`;
        goalStatusEl.textContent = state.currentPoints >= state.dailyGoal ? '🔥 План выполнен!' : '';
        goalStatusEl.style.color = 'green';
        weekProgressTextEl.textContent = `${state.weekPoints} / ${state.weekGoal}`;
        progressPercent = Math.min(100, (state.weekPoints / state.weekGoal) * 100);
        weekProgressBarEl.style.width = `${progressPercent}%`;
        monthProgressTextEl.textContent = `${state.monthPoints} / ${state.monthGoal}`;
        progressPercent = Math.min(100, (state.monthPoints / state.monthGoal) * 100);
        monthProgressBarEl.style.width = `${progressPercent}%`;
        if(reservePointsEl) reservePointsEl.textContent = state.reservePoints;
    }
    async function renderProductList() {
        productListEl.innerHTML = '<p>Загрузка товаров...</p>';
        try {
            const snapshot = await productsCollectionRef.orderBy("name").get();
            productListEl.innerHTML = '';
            if (snapshot.empty) {
                productListEl.innerHTML = '<p>Товары не найдены. Добавьте их в админ-панели.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
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
        } catch (error) {
            console.error("Ошибка загрузки товаров: ", error);
            productListEl.innerHTML = '<p>Не удалось загрузить список товаров.</p>';
        }
    }
    navMainBtn.addEventListener('click', () => {
        mainScreen.classList.remove('hidden');
        statsScreen.classList.add('hidden');
        navMainBtn.classList.add('active');
        navStatsBtn.classList.remove('active');
    });
    navStatsBtn.addEventListener('click', () => {
        mainScreen.classList.add('hidden');
        statsScreen.classList.remove('hidden');
        navMainBtn.classList.remove('active');
        navStatsBtn.classList.add('active');
        loadStats();
    });
    prevMonthBtn.addEventListener('click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        loadStats();
    });
    nextMonthBtn.addEventListener('click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        loadStats();
    });
    async function loadStats() {
        try {
            const dailyDocs = await dailyProgressCollectionRef.get();
            const dailyData = {};
            dailyDocs.forEach(doc => {
                dailyData[doc.id] = doc.data();
            });
            calculateStreak(dailyData);
            renderCalendar(currentMonthDate, dailyData);
            if(reservePointsEl) reservePointsEl.textContent = state.reservePoints;
        } catch (error) {
            console.error("Ошибка загрузки статистики:", error);
        }
    }
    function calculateStreak(dailyData) {
        let streak = 0;
        let today = new Date();
        while (true) {
            const dateStr = today.toISOString().split('T')[0];
            if (dailyData[dateStr] && dailyData[dateStr].points >= (dailyData[dateStr].goal || state.dailyGoal)) {
                streak++;
                today.setDate(today.getDate() - 1);
            } else {
                break;
            }
        }
        streakCountEl.textContent = streak;
    }
    function renderCalendar(date, dailyData) {
        calendarGridEl.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        monthYearEl.textContent = date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayHeaders.forEach(header => {
            const dayEl = document.createElement('div');
            dayEl.className = 'day-header';
            dayEl.textContent = header;
            calendarGridEl.appendChild(dayEl);
        });
        let startDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
        for (let i = 0; i < startDay; i++) {
            calendarGridEl.appendChild(document.createElement('div'));
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = i;
            const dateStr = new Date(year, month, i).toISOString().split('T')[0];
            if (dailyData[dateStr] && dailyData[dateStr].points >= (dailyData[dateStr].goal || state.dailyGoal)) {
                dayEl.classList.add('day-goal-met');
            }
            calendarGridEl.appendChild(dayEl);
        }
    }
    if (userId === String(ADMIN_USER_ID)) {
        const nav = document.querySelector('.navigation');
        const adminButton = document.createElement('button');
        adminButton.id = 'navAdmin';
        adminButton.textContent = 'Админка ⚙️';
        adminButton.addEventListener('click', () => { window.location.href = 'admin.html'; });
        nav.appendChild(adminButton);
    }
    renderProductList();
    loadState();
});
