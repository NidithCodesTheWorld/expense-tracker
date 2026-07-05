// --- Decoupled Infrastructure Routing ---
// Switches base API URI automatically depending on local or production context
const LOCAL_API_URL = "http://127.0.0.1:8000";
const PRODUCTION_API_URL = "https://your-backend-app-name.onrender.com"; // <-- REPLACE WITH YOUR LIVE RENDER/RAILWAY DEPLOYED BACKEND URL

const API_URL = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") 
    ? LOCAL_API_URL 
    : PRODUCTION_API_URL;

// State
let token = localStorage.getItem('token') || null;
let username = null;
let expenses = [];
let categories = [];
let activeTimeframe = 'all';

// [Keep all other downstream UI logic, functions, and listeners exactly the same as your current file]
// Category Visual styles (Icons and Colors)
const categoryStyles = {
    'movies': { icon: 'fa-film', color: '#f5576c' },
    'travel': { icon: 'fa-plane', color: '#00f2fe' },
    'grocery': { icon: 'fa-basket-shopping', color: '#43e97b' },
    'phone': { icon: 'fa-mobile-screen-button', color: '#fa709a' },
    'miscellaneous': { icon: 'fa-asterisk', color: '#a78bfa' }
};

const getCategoryStyle = (name) => {
    const key = name.toLowerCase().trim();
    if (categoryStyles[key]) return categoryStyles[key];
    
    // Procedural color for custom categories
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    return { icon: 'fa-tag', color: color };
};

// Elements
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authErrorMsg = document.getElementById('auth-error-msg');
const goToRegister = document.getElementById('go-to-register');
const goToLogin = document.getElementById('go-to-login');
const btnLogout = document.getElementById('btn-logout');
const userGreeting = document.getElementById('user-greeting');

const totalSpentVal = document.getElementById('total-spent-val');
const quickCategoryGrid = document.getElementById('quick-category-buttons');
const expenseCategorySelect = document.getElementById('expense-category');
const expenseForm = document.getElementById('expense-form');
const categoryForm = document.getElementById('category-form');
const categoryError = document.getElementById('category-error');

const categoryBreakdownList = document.getElementById('category-breakdown-list');
const expenseHistoryList = document.getElementById('expense-history-list');
const historyCount = document.getElementById('history-count');

const jarvisTriggerBtn = document.getElementById('jarvis-trigger-btn');
const jarvisChatPanel = document.getElementById('jarvis-chat-panel');
const btnCloseChat = document.getElementById('btn-close-chat');
const jarvisChatMessages = document.getElementById('jarvis-chat-messages');
const jarvisChatForm = document.getElementById('jarvis-chat-form');
const jarvisChatInput = document.getElementById('jarvis-chat-input');
const jarvisTyping = document.getElementById('jarvis-typing');

// Init application
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to now in input
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('expense-date').value = now.toISOString().slice(0, 16);

    checkAuth();
    setupEventListeners();
});

// Setup auth checks
const checkAuth = async () => {
    if (token) {
        try {
            // Verify token with me endpoint
            const res = await fetch(`${API_URL}/api/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                username = user.username;
                userGreeting.innerText = `Welcome, ${username}`;
                
                authView.classList.add('hidden');
                dashboardView.classList.remove('hidden');
                
                // Load data
                await loadDashboardData();
                setupJarvisGreeting();
            } else {
                logout();
            }
        } catch (err) {
            console.error("Auth verification failed:", err);
            logout();
        }
    } else {
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
    }
};

const logout = () => {
    token = null;
    username = null;
    localStorage.removeItem('token');
    authView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    jarvisChatMessages.innerHTML = '';
};

// Event Listeners
const setupEventListeners = () => {
    // View switching
    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authErrorMsg.classList.add('hidden');
    });

    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authErrorMsg.classList.add('hidden');
    });

    // Auth forms
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    btnLogout.addEventListener('click', logout);

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeTimeframe = e.target.dataset.timeframe;
            updateDashboardUI();
        });
    });

    // Forms
    expenseForm.addEventListener('submit', handleExpenseSave);
    categoryForm.addEventListener('submit', handleCategoryCreate);
    // Inline add‑category button next to dropdown
    const btnAddCategory = document.getElementById('btn-add-category');
    if (btnAddCategory) {
        btnAddCategory.addEventListener('click', handleAddCategoryInline);
    }

    // Chatbot widget toggles
    jarvisTriggerBtn.addEventListener('click', () => {
        jarvisChatPanel.classList.toggle('chat-panel-hidden');
        if (!jarvisChatPanel.classList.contains('chat-panel-hidden')) {
            jarvisChatInput.focus();
            scrollToBottom();
        }
    });

    btnCloseChat.addEventListener('click', () => {
        jarvisChatPanel.classList.add('chat-panel-hidden');
    });

    jarvisChatForm.addEventListener('submit', handleChatSubmit);
};

// API auth handlers
async function handleLogin(e) {
    e.preventDefault();
    const userVal = document.getElementById('login-username').value;
    const passVal = document.getElementById('login-password').value;
    authErrorMsg.classList.add('hidden');

    try {
        const formData = new URLSearchParams();
        formData.append('username', userVal);
        formData.append('password', passVal);

        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            token = data.access_token;
            localStorage.setItem('token', token);
            await checkAuth();
        } else {
            const err = await res.json();
            authErrorMsg.innerText = err.detail || 'Authorization failed.';
            authErrorMsg.classList.remove('hidden');
        }
    } catch (err) {
        authErrorMsg.innerText = 'Unable to connect to server.';
        authErrorMsg.classList.remove('hidden');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const userVal = document.getElementById('register-username').value;
    const passVal = document.getElementById('register-password').value;
    authErrorMsg.classList.add('hidden');

    try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal, password: passVal })
        });

        if (res.ok) {
            // Auto login after registering
            document.getElementById('login-username').value = userVal;
            document.getElementById('login-password').value = passVal;
            await handleLogin(e);
        } else {
            const err = await res.json();
            authErrorMsg.innerText = err.detail || 'Registration failed.';
            authErrorMsg.classList.remove('hidden');
        }
    } catch (err) {
        authErrorMsg.innerText = 'Unable to connect to server.';
        authErrorMsg.classList.remove('hidden');
    }
}

// Fetch dashboard info
const loadDashboardData = async () => {
    try {
        await Promise.all([fetchCategories(), fetchExpenses()]);
    } catch (err) {
        console.error("Error loading dashboard data:", err);
    }
};

const fetchCategories = async () => {
    const res = await fetch(`${API_URL}/api/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        categories = await res.json();
        renderCategoryControls();
    }
};

const fetchExpenses = async () => {
    const res = await fetch(`${API_URL}/api/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        expenses = await res.json();
        updateDashboardUI();
    }
};

// Render Control Elements
const renderCategoryControls = () => {
    // Dropdown
    expenseCategorySelect.innerHTML = '';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.innerText = cat.name;
        expenseCategorySelect.appendChild(opt);
    });

    // Quick Buttons
    quickCategoryGrid.innerHTML = '';
    categories.forEach(cat => {
        const style = getCategoryStyle(cat.name);
        
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        btn.dataset.id = cat.id;
        btn.innerHTML = `<i class="fa-solid ${style.icon}" style="color: ${style.color}"></i> ${cat.name}`;
        
        btn.addEventListener('click', () => {
            expenseCategorySelect.value = cat.id;
            // focus the amount input for convenience
            document.getElementById('expense-amount').focus();
            
            // Subtle click glow effect
            btn.style.boxShadow = `0 0 12px ${style.color}`;
            setTimeout(() => {
                btn.style.boxShadow = '';
            }, 300);
        });
        
        quickCategoryGrid.appendChild(btn);
    });
};

// Expense Actions
async function handleExpenseSave(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const category_id = parseInt(expenseCategorySelect.value);
    const description = document.getElementById('expense-desc').value.trim() || null;
    const dateInput = document.getElementById('expense-date').value;
    
    const date = dateInput ? new Date(dateInput).toISOString() : null;

    try {
        const res = await fetch(`${API_URL}/api/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount, category_id, description, date })
        });

        if (res.ok) {
            // Reset inputs
            document.getElementById('expense-amount').value = '';
            document.getElementById('expense-desc').value = '';
            // Reset date to current time
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('expense-date').value = now.toISOString().slice(0, 16);
            
            await fetchExpenses();
        } else {
            alert('Failed to save expense');
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleCategoryCreate(e) {
    e.preventDefault();
    categoryError.classList.add('hidden');
    const name = document.getElementById('new-category-name').value.trim();

    if (!name) return;

    try {
        const res = await fetch(`${API_URL}/api/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        if (res.ok) {
            document.getElementById('new-category-name').value = '';
            await fetchCategories();
        } else {
            const err = await res.json();
            categoryError.innerText = err.detail || 'Failed to create category.';
            categoryError.classList.remove('hidden');
        }
    } catch (err) {
        categoryError.innerText = 'Server error.';
        categoryError.classList.remove('hidden');
    }
}

// Inline “+” handler for quick category addition
async function handleAddCategoryInline() {
    const newName = window.prompt('Enter new category name:');
    if (!newName) return; // cancelled or empty
    const name = newName.trim();
    if (!name) return;
    try {
        const res = await fetch(`${API_URL}/api/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            // Refresh dropdown and quick buttons
            await fetchCategories();
            // Optionally select the new category automatically
            const newly = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
            if (newly) expenseCategorySelect.value = newly.id;
        } else {
            const err = await res.json();
            alert(err.detail || 'Failed to create category');
        }
    } catch (err) {
        console.error(err);
        alert('Server error while creating category');
    }
}

async function deleteExpense(id) {
    try {
        const res = await fetch(`${API_URL}/api/expenses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            await fetchExpenses();
        }
    } catch (err) {
        console.error(err);
    }
}

// Calculate and Update Dashboard Calculations
const updateDashboardUI = () => {
    const filtered = filterExpensesByTimeframe(expenses, activeTimeframe);
    
    // Total spent
    const total = filtered.reduce((sum, item) => sum + item.amount, 0);
    animateCounter('total-spent-val', total);
    
    // Category Breakdown Calculation
    const categoryTotals = {};
    categories.forEach(cat => {
        categoryTotals[cat.name] = 0;
    });
    
    filtered.forEach(exp => {
        if (!categoryTotals[exp.category_name]) {
            categoryTotals[exp.category_name] = 0;
        }
        categoryTotals[exp.category_name] += exp.amount;
    });

    // Render Breakdown
    categoryBreakdownList.innerHTML = '';
    const maxVal = Math.max(...Object.values(categoryTotals), 0);
    
    // Sort categories by expenditure descending
    const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    
    sortedCats.forEach(([catName, amt]) => {
        if (amt === 0 && filtered.length > 0) return; // Hide empty ones only if there are items
        
        const pct = total > 0 ? (amt / total) * 100 : 0;
        const style = getCategoryStyle(catName);
        
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <div class="breakdown-info">
                <span class="breakdown-cat-name">${catName}</span>
                <span class="breakdown-cat-amount">$${amt.toFixed(2)} (${pct.toFixed(1)}%)</span>
            </div>
            <div class="breakdown-bar-bg">
                <div class="breakdown-bar-fill" style="width: ${pct}%; background-color: ${style.color}; color: ${style.color}"></div>
            </div>
        `;
        categoryBreakdownList.appendChild(item);
    });
    
    if (filtered.length === 0) {
        categoryBreakdownList.innerHTML = `<div class="section-desc">No transactions recorded in this timeframe.</div>`;
    }

    // Render History list
    expenseHistoryList.innerHTML = '';
    historyCount.innerText = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
    
    filtered.forEach(exp => {
        const style = getCategoryStyle(exp.category_name);
        const expDate = new Date(exp.date);
        const dateStr = expDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const li = document.createElement('li');
        li.className = 'expense-item';
        li.innerHTML = `
            <div class="expense-item-left">
                <div class="expense-icon-badge" style="background-color: ${style.color}20; border: 1px solid ${style.color}">
                    <i class="fa-solid ${style.icon}" style="color: ${style.color}"></i>
                </div>
                <div class="expense-meta">
                    <span class="expense-item-desc">${exp.description || exp.category_name}</span>
                    <span class="expense-item-sub">${exp.category_name} &bull; ${dateStr}</span>
                </div>
            </div>
            <div class="expense-item-right">
                <span class="expense-item-amount">$${exp.amount.toFixed(2)}</span>
                <button class="btn-delete-expense" onclick="deleteExpense(${exp.id})" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        `;
        expenseHistoryList.appendChild(li);
    });
};

// Date Filters Helper
const filterExpensesByTimeframe = (list, timeframe) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Start of week (Monday)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0,0,0,0);
    const weekStartTime = weekStart.getTime();
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

    return list.filter(exp => {
        const t = new Date(exp.date).getTime();
        switch (timeframe) {
            case 'today':
                return t >= todayStart;
            case 'week':
                return t >= weekStartTime;
            case 'month':
                return t >= monthStart;
            case 'year':
                return t >= yearStart;
            case 'all':
            default:
                return true;
        }
    });
};

// Count Animation
const animateCounter = (id, target) => {
    const el = document.getElementById(id);
    const startVal = parseFloat(el.innerText.replace(/,/g, '')) || 0;
    const duration = 800; // ms
    const startTime = performance.now();

    const update = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (out-cubic)
        const ease = 1 - Math.pow(1 - progress, 3);
        const val = startVal + (target - startVal) * ease;
        
        el.innerText = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.innerText = target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    };
    requestAnimationFrame(update);
};

// ================= JARVIS CHATBOT INTEGRATION =================

const setupJarvisGreeting = () => {
    if (jarvisChatMessages.children.length === 0) {
        addJarvisMessage(`Good day, ${username}. I am J.A.R.V.I.S., your autonomous financial controller. I have securely linked your account. 

How may I assist you with your ledger today? You can report a transaction (e.g. *'spent $150'*) or inquire about your spending (e.g. *'What did I spend this week?'*).`);
    }
};

const addJarvisMessage = (text, isUser = false) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isUser ? 'chat-msg-sent' : 'chat-msg-received'}`;
    
    // Parse formatting (simple markdown mapping: **bold** and *italic* and \n to br)
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>') // Map single asterisks to stronger weight
        .replace(/\n/g, '<br>');

    const now = new Date();
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    msgDiv.innerHTML = `
        <div class="msg-bubble">
            ${formattedText}
        </div>
        <span class="msg-meta">${isUser ? 'You' : 'JARVIS'} &bull; ${timeStr}</span>
    `;
    
    jarvisChatMessages.appendChild(msgDiv);
    scrollToBottom();
};

const scrollToBottom = () => {
    jarvisChatMessages.scrollTop = jarvisChatMessages.scrollHeight;
};

async function handleChatSubmit(e) {
    e.preventDefault();
    const message = jarvisChatInput.value.trim();
    if (!message) return;

    // Append user message
    addJarvisMessage(message, true);
    jarvisChatInput.value = '';
    
    // Show typing
    jarvisTyping.classList.remove('hidden');
    scrollToBottom();

    try {
        const res = await fetch(`${API_URL}/api/chatbot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
        });

        // Hide typing
        jarvisTyping.classList.add('hidden');

        if (res.ok) {
            const data = await res.json();
            addJarvisMessage(data.response);
            
            // If Jarvis states that an expense was logged, refresh the ledger
            if (data.updated_expenses) {
                await fetchExpenses();
            }
            
            // Adjust input style if Jarvis needs category
            if (data.action_required === 'needs_category') {
                jarvisChatInput.placeholder = 'Type a category (e.g. Movies, Grocery)...';
                jarvisChatInput.style.borderColor = '#fa709a';
            } else {
                jarvisChatInput.placeholder = "Type a message or 'spent $200'...";
                jarvisChatInput.style.borderColor = '';
            }
        } else {
            addJarvisMessage("I apologize, sir. I encountered an error communicating with my database mainframe.");
        }
    } catch (err) {
        jarvisTyping.classList.add('hidden');
        addJarvisMessage("I apologize, sir. Connection to my server systems has been interrupted.");
    }
}
