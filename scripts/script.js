 
const defaultSettings = {
    workTime: 25,
    breakTime: 5,
    longBreakTime: 15,
    autoStart: false,
    longBreakInterval: 4,
    dailyGoal: 120, 
    weeklyGoal: 10,  
    theme: 'default'
};

const state = {
    timeLeft: 1500,
    timerId: null,
    isRunning: false,
    mode: 'work',
    pomodorosInCycle: 0,
    settings: { ...defaultSettings },
    tasks: [],
    activeTaskId: null,
    stats: {
        todayPomodoros: 0,
        todayMinutes: 0,
        streak: 0,
        lastLoginDate: null,
        history: []
    }
};

// --- 2. انتخابگرها ---
const elements = {
    display: document.getElementById('timerDisplay'),
    modeText: document.getElementById('modeIndicator'),
    pomodoroCount: document.getElementById('pomodoroCount'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    skipBtn: document.getElementById('skipBtn'),
    inputs: {
        work: document.getElementById('workTime'),
        break: document.getElementById('breakTime'),
        longBreak: document.getElementById('longBreakTime'),
        autoStart: document.getElementById('autoStart'),
        interval: document.getElementById('pomodorosUntilLongBreak'),
        theme: document.getElementById('themeSelect')
    },
    goals: {
        dailyInput: document.getElementById('dailyGoalInput'),
        weeklyInput: document.getElementById('weeklyGoalInput'),
        dailyBtn: document.getElementById('setDailyGoalBtn'),
        weeklyBtn: document.getElementById('setWeeklyGoalBtn'),
        dailyFill: document.getElementById('dailyProgressFill'),
        dailyCurrent: document.getElementById('dailyCurrent'),
        dailyGoalText: document.getElementById('dailyGoal'),
        weeklyFill: document.getElementById('weeklyProgressFill'),
        weeklyCurrent: document.getElementById('weeklyCurrent'),
        weeklyGoalText: document.getElementById('weeklyGoal')
    },
    stats: {
        date: document.getElementById('currentDate'),
        pomodoros: document.getElementById('todayPomodoros'),
        studyTime: document.getElementById('todayStudyTime'),
        streak: document.getElementById('streakCount')
    },
    tasks: {
        input: document.getElementById('newTaskInput'),
        targetInput: document.getElementById('newTaskTarget'),  
        addBtn: document.getElementById('addTaskBtn'),
        list: document.getElementById('tasksList'),
        activeLabel: document.getElementById('activeTaskLabel'),
        activeName: document.getElementById('activeTaskName')
    },
    monthlyStatsContainer: document.getElementById('monthlyStats'),
    overlay: document.getElementById('alertOverlay'),
    alertTitle: document.getElementById('alertTitle'),
    alertMessage: document.getElementById('alertMessage'),
    alertStartNext: document.getElementById('alertStartNextBtn'),
    alertClose: document.getElementById('alertCloseBtn'),
    notification: document.getElementById('notification'),
    historyContainer: document.getElementById('historyContainer'),
    weeklyChart: document.getElementById('weeklyChart'),
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content')
};


let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function init() {
    loadData();
    setupEventListeners();
    setupShortcuts();
    switchMode('work', true);
    updateDateDisplay();
    renderHistory();
    renderChart();
    renderMonthlyStats();
    updateGoalsUI();
    updatePomodoroTargetDisplay();
    renderTasks();
    updateGamification();

    const unlockAudio = () => { initAudio(); };
    document.body.addEventListener('click', unlockAudio, { once: true });
    document.body.addEventListener('touchstart', unlockAudio, { once: true });
}

function loadData() {
    const saved = localStorage.getItem('myPomodoroData');
    const today = new Date().toLocaleDateString('en-CA'); // فرمت استاندارد YYYY-MM-DD

    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.settings) state.settings = { ...defaultSettings, ...data.settings };
            if (data.tasks) state.tasks = data.tasks;
            if (data.activeTaskId) state.activeTaskId = data.activeTaskId;

            if (data.stats) {
                state.stats = { ...state.stats, ...data.stats };
                
                // بازیابی آمار امروز
                const todayRecord = state.stats.history.find(h => h.date === today);
                if (todayRecord) {
                    state.stats.todayPomodoros = todayRecord.pomodoros;
                    state.stats.todayMinutes = todayRecord.minutes;
                } else {
                    state.stats.todayPomodoros = 0;
                    state.stats.todayMinutes = 0;
                }

                // *** منطق جدید چک کردن رکورد (فقط ریست کردن) ***
                // محاسبه تاریخ دیروز
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toLocaleDateString('en-CA');

                // اگر آخرین بازدید امروز نیست و دیروز هم نبوده (یعنی غیبت داشتیم)
                if (state.stats.lastLoginDate && 
                    state.stats.lastLoginDate !== today && 
                    state.stats.lastLoginDate !== yesterdayStr) {
                    state.stats.streak = 0; // رکورد سوخت :(
                }
                
                // نکته مهم: اینجا تاریخ را آپدیت نمی‌کنیم! 
                // تاریخ فقط وقتی آپدیت می‌شود که یک پومودورو تمام کنید.
            }
            state.pomodorosInCycle = data.pomodorosInCycle || 0;
        } catch (e) { console.error(e); }
    } else {
        state.stats.streak = 0;
    }

    // آپدیت UI
    elements.inputs.work.value = state.settings.workTime;
    elements.inputs.break.value = state.settings.breakTime;
    elements.inputs.longBreak.value = state.settings.longBreakTime;
    elements.inputs.autoStart.value = state.settings.autoStart;
    elements.inputs.interval.value = state.settings.longBreakInterval;
    elements.goals.dailyInput.value = state.settings.dailyGoal;
    elements.goals.weeklyInput.value = state.settings.weeklyGoal;

    if (state.settings.theme) {
        elements.inputs.theme.value = state.settings.theme;
        applyTheme(state.settings.theme);
    }
    
    updateStatsUI();
}

function saveData() {
    const data = {
        settings: state.settings,
        stats: state.stats,
        pomodorosInCycle: state.pomodorosInCycle,
        tasks: state.tasks,
        activeTaskId: state.activeTaskId
    };
    localStorage.setItem('myPomodoroData', JSON.stringify(data));
}

 

function addTask() {
    const title = elements.tasks.input.value.trim();
    const target = parseInt(elements.tasks.targetInput.value) || 1; 
    
    if (!title) return;

    const newTask = {
        id: Date.now(),
        title: title,
        pomodoros: 0,
        target: target, 
        completed: false
    };

    state.tasks.push(newTask);
    if (state.tasks.length === 1) state.activeTaskId = newTask.id;

    elements.tasks.input.value = '';
    elements.tasks.targetInput.value = '1'; 
    saveData();
    renderTasks();
}

function toggleTaskComplete(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveData();
        renderTasks();
    }
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    if (state.activeTaskId === id) state.activeTaskId = null;
    saveData();
    renderTasks();
}

function setActiveTask(id) {
    state.activeTaskId = id;
    saveData();
    renderTasks();
}

function renderTasks() {
    elements.tasks.list.innerHTML = '';
    
    if (state.activeTaskId) {
        const activeTask = state.tasks.find(t => t.id === state.activeTaskId);
        if (activeTask) {
            elements.tasks.activeLabel.style.display = 'block';
            elements.tasks.activeName.textContent = activeTask.title;
        } else {
            elements.tasks.activeLabel.style.display = 'none';
        }
    } else {
        elements.tasks.activeLabel.style.display = 'none';
    }

    state.tasks.forEach(task => {
        const div = document.createElement('div');
        const isActive = task.id === state.activeTaskId;
        div.className = `task-item ${task.completed ? 'completed' : ''} ${isActive ? 'active' : ''}`;
        
        const progressColor = (task.pomodoros >= task.target) ? '#10b981' : '#f59e0b';
        
        div.innerHTML = `
            <div class="task-left">
                <div class="check-circle" onclick="window.taskActions.toggle(${task.id}, event)"></div>
                <span>${task.title}</span>
            </div>
            <div class="task-right">
                <div class="pomodoro-progress" style="color: ${progressColor}">
                    ${task.pomodoros} / ${task.target} 🍅
                </div>
                <button class="btn-delete" onclick="window.taskActions.del(${task.id}, event)">🗑️</button>
            </div>
        `;
        
        div.onclick = (e) => {
            if (!e.target.classList.contains('check-circle') && !e.target.classList.contains('btn-delete')) {
                setActiveTask(task.id);
            }
        };

        elements.tasks.list.appendChild(div);
    });
}

window.taskActions = {
    toggle: (id, e) => { e.stopPropagation(); toggleTaskComplete(id); },
    del: (id, e) => { e.stopPropagation(); deleteTask(id); }
};

 

function updatePomodoroTargetDisplay() {
    let targetCount = Math.round(state.settings.dailyGoal / state.settings.workTime);
    if (targetCount < 1) targetCount = 1;
    elements.pomodoroCount.innerHTML = `<span></span> پومودورو: ${state.stats.todayPomodoros}/${targetCount}`;
}

function renderMonthlyStats() {
    if (!elements.monthlyStatsContainer) return;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyData = state.stats.history.filter(h => {
        const d = new Date(h.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalMinutes = monthlyData.reduce((sum, item) => sum + item.minutes, 0);
    const totalPomodoros = monthlyData.reduce((sum, item) => sum + item.pomodoros, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const activeDays = monthlyData.length;
    const averageMinutes = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
    const dayFrequency = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    monthlyData.forEach(item => { dayFrequency[new Date(item.date).getDay()] += item.minutes; });
    let bestDayIndex = -1; let maxMinutes = -1;
    for (let i=0; i<=6; i++) { if (dayFrequency[i] > maxMinutes) { maxMinutes = dayFrequency[i]; bestDayIndex = i; } }
    const daysFa = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    const bestDayName = (activeDays > 0 && maxMinutes > 0) ? daysFa[bestDayIndex] : '---';

    elements.monthlyStatsContainer.innerHTML = `
        <div class="goals-container" style="margin-bottom: 0;">
            <div class="goal-card" style="border-top-color: #10b981;">
                <h3>⏱️ مجموع ماه</h3><div style="font-size: 2rem; font-weight: bold; color: white; margin: 10px 0;">${totalHours} <span style="font-size: 1rem; color: #a7f3d0;">ساعت</span></div>
            </div>
            <div class="goal-card" style="border-top-color: #f59e0b;">
                <h3>📅 میانگین روزانه</h3><div style="font-size: 2rem; font-weight: bold; color: white; margin: 10px 0;">${averageMinutes} <span style="font-size: 1rem; color: #fde68a;">دقیقه</span></div>
            </div>
            <div class="goal-card" style="border-top-color: #3b82f6;">
                <h3>🍅 کل پومودورو</h3><div style="font-size: 2rem; font-weight: bold; color: white; margin: 10px 0;">${totalPomodoros} <span style="font-size: 1rem; color: #93c5fd;">عدد</span></div>
            </div>
            <div class="goal-card" style="border-top-color: #ec4899;">
                <h3>🏆 بهترین روز</h3><div style="font-size: 1.8rem; font-weight: bold; color: white; margin: 10px 0;">${bestDayName}</div>
            </div>
        </div>`;
}

function switchMode(mode, autoUpdateTimer = true) {
    state.mode = mode;
    elements.modeText.className = 'timer-mode';
    let duration = 0; let label = ''; let colorClass = ''; let primaryColor = '';

    if (mode === 'work') {
        duration = state.settings.workTime; label = '⏳ زمان کار'; colorClass = 'mode-work'; primaryColor = '#10b981';
    } else if (mode === 'shortBreak') {
        duration = state.settings.breakTime; label = '☕ استراحت کوتاه'; colorClass = 'mode-break'; primaryColor = '#0d9488';
    } else {
        duration = state.settings.longBreakTime; label = '🛌 استراحت طولانی'; colorClass = 'mode-long-break'; primaryColor = '#0891b2';
    }

    elements.modeText.textContent = label;
    elements.modeText.classList.add(colorClass);
    document.body.style.setProperty('--primary', primaryColor);
    updatePomodoroTargetDisplay();

    if (autoUpdateTimer) {
        state.timeLeft = duration * 60;
        updateDisplay();
    }
}

function updateDisplay() {
    const m = Math.floor(state.timeLeft / 60);
    const s = state.timeLeft % 60;
    elements.display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (state.isRunning) document.title = `(${elements.display.textContent}) My Pomodoro`;
}

function setupEventListeners() {
    elements.inputs.work.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if(val > 0) { state.settings.workTime = val; saveData(); updatePomodoroTargetDisplay(); if (state.mode === 'work' && !state.isRunning) { state.timeLeft = val * 60; updateDisplay(); } }
    });
    
    elements.inputs.break.addEventListener('change', (e) => { const val = parseInt(e.target.value); if(val > 0) { state.settings.breakTime = val; saveData(); if (state.mode === 'shortBreak' && !state.isRunning) { state.timeLeft = val * 60; updateDisplay(); } } });
    elements.inputs.longBreak.addEventListener('change', (e) => { const val = parseInt(e.target.value); if(val > 0) { state.settings.longBreakTime = val; saveData(); if (state.mode === 'longBreak' && !state.isRunning) { state.timeLeft = val * 60; updateDisplay(); } } });
    elements.inputs.autoStart.addEventListener('change', (e) => { state.settings.autoStart = e.target.value === 'true'; saveData(); });
    elements.inputs.interval.addEventListener('change', (e) => { state.settings.longBreakInterval = parseInt(e.target.value); saveData(); });


    if (sidebarElements.btn) sidebarElements.btn.addEventListener('click', toggleSidebar);
    if (sidebarElements.closeBtn) sidebarElements.closeBtn.addEventListener('click', toggleSidebar);
    if (sidebarElements.overlay) sidebarElements.overlay.addEventListener('click', toggleSidebar);

    
    elements.inputs.theme.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        state.settings.theme = newTheme;
        applyTheme(newTheme);
        saveData();
    });

    elements.startBtn.addEventListener('click', () => { initAudio(); startTimer(); });
    elements.pauseBtn.addEventListener('click', pauseTimer);
    elements.resetBtn.addEventListener('click', resetTimer);
    elements.skipBtn.addEventListener('click', skipTimer);
    elements.alertClose.addEventListener('click', () => elements.overlay.style.display = 'none');
    
    elements.goals.dailyBtn.addEventListener('click', () => { const val = parseInt(elements.goals.dailyInput.value); if(val > 0) { state.settings.dailyGoal = val; saveData(); updateGoalsUI(); updatePomodoroTargetDisplay(); showNotification("هدف", "هدف روزانه ذخیره شد"); } });
    elements.goals.weeklyBtn.addEventListener('click', () => { const val = parseInt(elements.goals.weeklyInput.value); if(val > 0) { state.settings.weeklyGoal = val; saveData(); updateGoalsUI(); showNotification("هدف", "هدف هفتگی ذخیره شد"); } });

    elements.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabs.forEach(b => b.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            if (tabId === 'history') document.getElementById('historyTab').classList.add('active');
            if (tabId === 'weekly') document.getElementById('weeklyTab').classList.add('active');
            if (tabId === 'monthly') { document.getElementById('monthlyTab').classList.add('active'); renderMonthlyStats(); }
            
        });
    });

    if(elements.tasks.addBtn && elements.tasks.input) {
        elements.tasks.addBtn.addEventListener('click', addTask);
        elements.tasks.input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });
 
        elements.tasks.targetInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });
    }

    setupBackupSystem();
    setupAmbientSound();
}

function startTimer() {
    requestNotificationPermission();
    if (state.isRunning) return;
    
    state.isRunning = true;
    updateControls();

    const endTime = Date.now() + (state.timeLeft * 1000);

    state.timerId = setInterval(() => {

        const now = Date.now();
        const distance = endTime - now;
        
        const secondsLeft = Math.ceil(distance / 1000);

        if (secondsLeft >= 0) {
            state.timeLeft = secondsLeft;
            updateDisplay();
        }

        // 4. پایان تایمر
        if (state.timeLeft <= 0) {
            state.timeLeft = 0;
            updateDisplay();
            completeTimer(false);
        }
    }, 1000);
}

function pauseTimer() {
    if (!state.isRunning) return;
    clearInterval(state.timerId);
    state.isRunning = false;
    updateControls();
    document.title = "My Pomodoro";
}

function resetTimer() {
    clearInterval(state.timerId);
    state.isRunning = false;
    if (state.mode === 'work') state.timeLeft = state.settings.workTime * 60;
    else if (state.mode === 'shortBreak') state.timeLeft = state.settings.breakTime * 60;
    else state.timeLeft = state.settings.longBreakTime * 60;
    updateDisplay();
    updateControls();
    document.title = "My Pomodoro";
}

function skipTimer() { completeTimer(true); }
 
function completeTimer(skipped = false) {
    clearInterval(state.timerId);
    state.isRunning = false;
    updateControls();
    document.title = "My Pomodoro";
 
    let nextMode = 'work';
    let title = '';
    let msg = '';

    if (state.mode === 'work') {
        saveStatsAfterWork();
        state.pomodorosInCycle++;
        if (skipped) showNotification("ثبت شد", "زمان ذخیره و رد شد.");

        if (state.pomodorosInCycle >= state.settings.longBreakInterval) {
            nextMode = 'longBreak';
            title = '🎉 استراحت طولانی';
            msg = 'تبریک! یک دور کامل تمام شد.';
        } else {
            nextMode = 'shortBreak';
            title = '☕ استراحت کوتاه';
            msg = 'خسته نباشید، کمی استراحت کنید.';
        }
    } else {
        nextMode = 'work';
        title = '🚀 آماده کار؟';
        msg = 'وقت تمرکز مجدد است!';
        if (state.mode === 'longBreak') state.pomodorosInCycle = 0;
    }

 
    if (!skipped){
        playSound();
        sendSystemNotification(title, msg);  
    } 
    
  
    switchMode(nextMode, true);

 
    if (skipped) {
        if (state.settings.autoStart) startTimer();
    } else {
        elements.alertTitle.textContent = title;
        elements.alertMessage.textContent = msg;
        elements.overlay.style.display = 'flex';
        elements.alertStartNext.onclick = () => {
            elements.overlay.style.display = 'none';
            startTimer();
        };
    }
}

function saveStatsAfterWork() {
    const today = new Date().toLocaleDateString('en-CA');
    
    if (state.stats.lastLoginDate !== today) {
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    
        if (state.stats.lastLoginDate === yesterdayStr) {
            state.stats.streak++;
        } else {
            state.stats.streak = 1;
        }
        
 
        state.stats.lastLoginDate = today;
    }

    state.stats.todayPomodoros++;
    state.stats.todayMinutes += state.settings.workTime;

    let dayRecord = state.stats.history.find(h => h.date === today);
    if (dayRecord) { 
        dayRecord.pomodoros = state.stats.todayPomodoros; 
        dayRecord.minutes = state.stats.todayMinutes; 
    } else { 
        state.stats.history.push({ 
            date: today, 
            pomodoros: state.stats.todayPomodoros, 
            minutes: state.stats.todayMinutes 
        }); 
    }

    // مدیریت تسک‌ها
    if (state.activeTaskId) {
        const activeTask = state.tasks.find(t => t.id === state.activeTaskId);
        if (activeTask && !activeTask.completed) {
            activeTask.pomodoros = (activeTask.pomodoros || 0) + 1;
            if (activeTask.pomodoros >= activeTask.target) {
                activeTask.completed = true;
                showNotification("🎉 تبریک!", `تسک "${activeTask.title}" کامل شد!`);
                playSound(); 
            }
        }
    }
    
    saveData();
    updateStatsUI();
    updatePomodoroTargetDisplay();
    renderHistory();
    renderChart();
    renderMonthlyStats();
    renderTasks();
    updateGamification();
}

function updateControls() {
    elements.startBtn.disabled = state.isRunning; elements.pauseBtn.disabled = !state.isRunning;
    elements.startBtn.style.opacity = state.isRunning ? '0.5' : '1'; elements.startBtn.style.cursor = state.isRunning ? 'not-allowed' : 'pointer';
    elements.pauseBtn.style.opacity = !state.isRunning ? '0.5' : '1'; elements.pauseBtn.style.cursor = !state.isRunning ? 'not-allowed' : 'pointer';
}

function updateStatsUI() {
    elements.stats.pomodoros.textContent = state.stats.todayPomodoros;
    elements.stats.studyTime.textContent = `${state.stats.todayMinutes} دقیقه`;
    elements.stats.streak.textContent = `${state.stats.streak} روز`;
    updateGoalsUI();
}

function updateGoalsUI() {
    const dPercent = Math.min(100, (state.stats.todayMinutes / state.settings.dailyGoal) * 100);
    elements.goals.dailyFill.style.width = `${dPercent}%`; elements.goals.dailyCurrent.textContent = `${state.stats.todayMinutes} دقیقه`; elements.goals.dailyGoalText.textContent = `هدف: ${state.settings.dailyGoal} دقیقه`;
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    let wMinutes = 0; state.stats.history.forEach(h => { if (new Date(h.date) >= oneWeekAgo) wMinutes += h.minutes; });
    const wHours = (wMinutes / 60).toFixed(1); const wPercent = Math.min(100, (wMinutes / (state.settings.weeklyGoal * 60)) * 100);
    elements.goals.weeklyFill.style.width = `${wPercent}%`; elements.goals.weeklyCurrent.textContent = `${wHours} ساعت`; elements.goals.weeklyGoalText.textContent = `هدف: ${state.settings.weeklyGoal} ساعت`;
}

function renderHistory() {
    elements.historyContainer.innerHTML = '';
    const sorted = [...state.stats.history].sort((a,b) => new Date(b.date) - new Date(a.date));
    if(sorted.length === 0) elements.historyContainer.innerHTML = '<p style="text-align:center; padding:20px">تاریخچه‌ای موجود نیست</p>';
    sorted.forEach(item => {
        const d = new Date(item.date).toLocaleDateString('fa-IR', {month:'long', day:'numeric'});
        const div = document.createElement('div'); div.className = 'history-day';
        div.innerHTML = `<div class="history-date">${d}</div><div class="history-stats"><span class="stat-badge"> 🍅 ${item.pomodoros}</span><span class="stat-badge">⏱️ ${item.minutes}دقیقه  </span></div>`;
        elements.historyContainer.appendChild(div);
    });
}

function renderChart() {
    elements.weeklyChart.innerHTML = '';
    for(let i=6; i>=0; i--){
        const d = new Date(); d.setDate(d.getDate() - i); const dateStr = d.toLocaleDateString('en-CA'); const dayName = d.toLocaleDateString('fa-IR', {weekday:'short'});
        const rec = state.stats.history.find(h => h.date === dateStr); const mins = rec ? rec.minutes : 0; const hPercent = Math.min(100, (mins/300)*100);
        const col = document.createElement('div'); col.className = 'chart-column'; col.style.height = `${Math.max(5, hPercent)}%`;
        col.innerHTML = `<span class="chart-value">${mins}</span><span class="chart-label">${dayName}</span>`; elements.weeklyChart.appendChild(col);
    }
}

function updateDateDisplay() { elements.stats.date.textContent = new Date().toLocaleDateString('fa-IR', {weekday:'long', month:'long', day:'numeric'}); }

function playSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const playSingleBeep = (startTime, frequency, duration) => {
            const oscillator = audioCtx.createOscillator(); const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode); gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = frequency; oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.5, startTime); gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            oscillator.start(startTime); oscillator.stop(startTime + duration);
        };
        const now = audioCtx.currentTime; playSingleBeep(now, 800, 0.3); playSingleBeep(now + 0.4, 600, 0.3); playSingleBeep(now + 0.8, 1000, 0.5);
    } catch (e) { console.error('خطا در پخش صدا:', e); }
}

function showNotification(title, msg) {
    elements.notification.style.display = 'flex'; document.getElementById('notificationTitle').textContent = title; document.getElementById('notificationMessage').textContent = msg;
    setTimeout(() => elements.notification.style.display = 'none', 3000);
}
 
function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
        
        if (e.code === 'Escape') {
            if (sidebarElements.sidebar.classList.contains('open')) {
                toggleSidebar();
            }
            if (elements.overlay.style.display === 'flex') {
                elements.overlay.style.display = 'none';
            }
            return; 
        }

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.code) {
            case 'Space':
                e.preventDefault(); 
                initAudio(); 
                if (state.isRunning) pauseTimer();
                else startTimer();
                break;
            
            case 'KeyR':
                resetTimer();
                break;
            
            case 'KeyS':
                skipTimer();
                break;
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered!', reg))
        .catch(err => console.log('Service Worker failed:', err));
    });
  }
document.addEventListener('DOMContentLoaded', init);


function applyTheme(themeName) {
    
    if (themeName === 'default') {
        document.documentElement.removeAttribute('data-theme');
    } else {
     
        document.documentElement.setAttribute('data-theme', themeName);
    }
    
   
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        let color = '#10b981';  
        
        switch(themeName) {
            case 'purple': color = '#8b5cf6'; break;
            case 'coffee': color = '#d97706'; break;
            case 'ocean':  color = '#06b6d4'; break;
            case 'dark':   color = '#000000'; break;
        }
        
        metaThemeColor.setAttribute('content', color);
    }
}

const sidebarElements = {
    btn: document.getElementById('menuBtn'),
    sidebar: document.getElementById('sidebar'),
    closeBtn: document.getElementById('closeSidebarBtn'),
    overlay: document.getElementById('sidebarOverlay')
};

function toggleSidebar() {
    sidebarElements.sidebar.classList.toggle('open');
    sidebarElements.overlay.classList.toggle('active');
}

 

function requestNotificationPermission() {
    if (!("Notification" in window)) return; 
    
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification("My Pomodoro", {
                    body: "نوتیفیکیشن‌ها فعال شدند! 🎉",
                    icon: "/icons/favicon.ico.ico"
                });
            }
        });
    }
}

function sendSystemNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: body,
                icon: "/icons/favicon.ico.ico",
                vibrate: [200, 100, 200], 
                tag: "pomodoro-timer" 
            });
        });
    } else {
        new Notification(title, {
            body: body,
            icon: "/icons/favicon.ico.ico"
        });
    }
}

function setupBackupSystem() {
    const backupBtn = document.getElementById('backupBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const fileInput = document.getElementById('fileInput');

    // دانلود بکاپ
    if (backupBtn) {
        backupBtn.addEventListener('click', () => {
            const data = JSON.stringify(state); 
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pomodoro_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification("پشتیبان‌گیری", "فایل بکاپ دانلود شد.");
        });
    }

 
    if (restoreBtn) {
        restoreBtn.addEventListener('click', () => fileInput.click());
    }
 
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                
                    if (data.settings && data.stats) {
                        localStorage.setItem('myPomodoroData', JSON.stringify(data));
                        showNotification("بازیابی", "اطلاعات بازیابی شد. صفحه رفرش می‌شود...");
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        alert('فایل انتخاب شده معتبر نیست.');
                    }
                } catch (err) {
                    console.error(err);
                    alert('خطا در خواندن فایل.');
                }
            };
            reader.readAsText(file);
        });
    }
}

function setupAmbientSound() {
    const soundSelect = document.getElementById('soundSelect');
    const volumeSlider = document.getElementById('volumeSlider');
    const player = document.getElementById('ambientPlayer');

 
    const sounds = {
        rain: './sounds/rain.mp3',
        cafe: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg'
    };

    if (soundSelect && player) {
        soundSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type === 'none') {
                player.pause();
                player.currentTime = 0;
            } else if (sounds[type]) {
                player.src = sounds[type];
                player.play().catch(err => console.log('خطا در پخش:', err));
            }
        });
    }

    if (volumeSlider && player) {
    
        player.volume = volumeSlider.value / 100;
        
        volumeSlider.addEventListener('input', (e) => {
            player.volume = e.target.value / 100;
        });
    }
}

 
const rankLevels = [
    { min: 0, name: 'سرباز چوبی', id: 'newbie', img: '../images/rank-1.jpg' },
    { min: 300, name: 'گارد سنگی', id: 'bronze', img: '../images/rank-2.jpg' },
    { min: 900, name: 'شوالیه برنزی', id: 'silver', img: '../images/rank-3.jpg' },
    { min: 2400, name: 'فرمانده نقره‌ای', id: 'gold', img: '../images/rank-4.jpg' },
    { min: 4000, name: 'سلطان طلایی', id: 'legend', img: '../images/rank-5.jpg' },
    { min: 60000, name: 'افسانه جاودان', id: 'mythic', img: '../images/rank-6.jpg' }
];

function updateGamification() {
    const badge = document.getElementById('rankBadge');
    const imgEl = document.getElementById('rankImage');  
    const titleEl = document.getElementById('rankTitle');
    
    if (!badge) return;

 
    let totalMinutes = state.stats.todayMinutes;
    
    if (state.stats.history && state.stats.history.length > 0) {
        state.stats.history.forEach(day => {
  
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (day.date !== todayStr) {
                totalMinutes += day.minutes;
            }
        });
    }

 
    let currentRank = rankLevels[0];
    for (let i = rankLevels.length - 1; i >= 0; i--) {
        if (totalMinutes >= rankLevels[i].min) {
            currentRank = rankLevels[i];
            break;
        }
    }
 
    badge.style.display = 'flex';
    titleEl.textContent = currentRank.name;

    const currentSrc = imgEl.getAttribute('src');
    if (currentSrc !== currentRank.img) {
        imgEl.src = currentRank.img;
        
 
        imgEl.style.transform = 'scale(1.2) rotate(10deg)';
        setTimeout(() => imgEl.style.transform = 'scale(1) rotate(0deg)', 300);
    }
    
 
    badge.setAttribute('data-tier', currentRank.id);
 
    const nextRankIndex = rankLevels.indexOf(currentRank) + 1;
    if (nextRankIndex < rankLevels.length) {
        const nextRank = rankLevels[nextRankIndex];
        const remaining = nextRank.min - totalMinutes;
        badge.title = `مجموع: ${Math.round(totalMinutes/60)} ساعت | ${remaining} دقیقه تا "${nextRank.name}"`;
    } else {
        badge.title = `مجموع: ${Math.round(totalMinutes/60)} ساعت | شما در بالاترین سطح هستید!`;
    }
}