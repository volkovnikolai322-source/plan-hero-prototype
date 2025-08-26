document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // --- Элементы UI ---
    const progressTextEl = document.getElementById('progressText');
    const progressBarEl = document.getElementById('progressBar');
    const goalStatusEl = document.getElementById('goalStatus');
    const reservePointsEl = document.getElementById('reservePoints');
    const productListEl = document.getElementById('productList');
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
    const todaysOrdersListEl = document.getElementById('todaysOrdersList');

    // --- Состояние приложения ---
    let state = {
        dailyGoal: 100,
        currentPoints: 0,
        reservePoints: 0,
        weekPoints: 0,
        weekGoal: 700,
        monthPoints: 0,
        monthGoal: 3000,
        todaysOrders: [],
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
            // 1. Загружаем основные данные (резерв)
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                state.reservePoints = userDoc.data().reservePoints || 0;
            }

            // 2. Загружаем сегодняшние заказы
            const ordersSnapshot = await todaysOrdersCollectionRef.orderBy('timestamp', 'desc').get();
            state.todaysOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // 3. Загружаем данные за последний месяц для статистики
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 31);
            const monthAgoId = monthAgo.toISOString().split('T')[0];
            const snapshot = await dailyProgressCollectionRef.where(firebase.firestore.FieldPath.documentId(), ">=", monthAgoId).get();
            
            recalculateAllStats(snapshot);

        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            alert("Не удалось загрузить данные. Проверьте соединение.");
        }
        renderTodaysOrders();
        updateUI();
    }
    
    function recalculateAllStats(snapshot) {
        // Пересчет сегодняшнего дня
        state.currentPoints = state.todaysOrders.reduce((sum, order) => sum + order.points, 0);

        // Пересчет недели и месяца
        const today = new Date();
        const firstDayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        let weekPoints = 0;
        let monthPoints = 0;

        snapshot.forEach(doc => {
            const docDate = new Date(doc.id);
            if (docDate >= firstDayOfWeek) weekPoints += doc.data().points || 0;
            if (docDate >= firstDayOfMonth) monthPoints += doc.data().points || 0;
        });
        state.weekPoints = weekPoints;
        state.monthPoints = monthPoints;
    }

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
            item.querySelector('.delete-order-btn').addEventListener('click', () => deleteOrder(order.id, order.points));
            todaysOrdersListEl.appendChild(item);
        });
    }

    async function addProduct(product) {
        const previousPoints = state.currentPoints;
        const newTotalPoints = state.currentPoints + product.points;
        let newReservePoints = state.reservePoints;

        if (previousPoints < state.dailyGoal && newTotalPoints >= state.dailyGoal) {
            newReservePoints += (newTotalPoints - state.dailyGoal);
        } else if (newTotalPoints > state.dailyGoal) {
            newReservePoints += product.points;
        }
        
        try {
            const newOrder = { name: product.name, points: product.points, timestamp: new Date() };
            const newOrderRef = await todaysOrdersCollectionRef.add(newOrder);
            
            state.todaysOrders.unshift({ id: newOrderRef.id, ...newOrder });
            state.currentPoints = newTotalPoints;
            state.weekPoints += product.points;
            state.monthPoints += product.points;
            state.reservePoints = newReservePoints;

            renderTodaysOrders();
            updateUI();
            
            await dailyProgressCollectionRef.doc(todayId).set({ points: newTotalPoints, goal: state.dailyGoal }, { merge: true });
            await userDocRef.set({ reservePoints: newReservePoints }, { merge: true });
            tg.sendData(JSON.stringify({ name: product.name, points: product.points }));
        } catch (error) {
            console.error("Ошибка добавления заказа:", error);
            alert("Не удалось добавить заказ.");
        }
    }

    async function deleteOrder(orderId, pointsToSubtract) {
        if (!confirm("Вы уверены, что хотите удалить этот заказ?")) return;

        const previousPoints = state.currentPoints;
        const newTotalPoints = state.currentPoints - pointsToSubtract;
        let newReservePoints = state.reservePoints;

        if (previousPoints >= state.dailyGoal && newTotalPoints < state.dailyGoal) {
            newReservePoints -= (previousPoints - state.dailyGoal);
        } else if (newTotalPoints >= state.dailyGoal) {
            newReservePoints -= pointsToSubtract;
        }
        newReservePoints = Math.max(0, newReservePoints);

        try {
            await todaysOrdersCollectionRef.doc(orderId).delete();

            state.todaysOrders = state.todaysOrders.filter(order => order.id !== orderId);
            state.currentPoints = newTotalPoints;
            state.weekPoints -= pointsToSubtract;
            state.monthPoints -= pointsToSubtract;
            state.reservePoints = newReservePoints;
            
            renderTodaysOrders();
            updateUI();

            await dailyProgressCollectionRef.doc(todayId).set({ points: newTotalPoints }, { merge: true });
            await userDocRef.set({ reservePoints: newReservePoints }, { merge: true });

        } catch (error) {
            console.error("Ошибка удаления заказа:", error);
            alert("Не удалось удалить заказ.");
        }
    }
    
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
            dailyDocs.forEach(doc => { dailyData[doc.id] = doc.data(); });
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
            } else { break; }
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
    
    // --- Инициализация ---
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
