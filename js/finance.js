/**
 * Project Finance Management Controller
 * Handles interactions for the Finance Dashboard
 */

const FINANCE_STORAGE_KEY = 'conwork_finance_transactions';

const STATUS_TO_THAI = {
    'pending': 'รออนุมัติ',
    'approved': 'อนุมัติแล้ว',
    'paid': 'จ่ายแล้ว',
    'rejected': 'ปฏิเสธ',
    'canceled': 'ยกเลิก',
    'รออนุมัติ': 'รออนุมัติ',
    'อนุมัติแล้ว': 'อนุมัติแล้ว',
    'จ่ายแล้ว': 'จ่ายแล้ว'
};

const STATUS_TO_DB = {
    'รออนุมัติ': 'pending',
    'อนุมัติแล้ว': 'approved',
    'จ่ายแล้ว': 'paid',
    'ปฏิเสธ': 'rejected',
    'pending': 'pending',
    'approved': 'approved',
};

const FINANCE_MASTER_BUDGET_KEY = 'conwork_master_budget';

const DEFAULT_MASTER_BUDGET = {
    totalBudget: 0,
    initialCash: 0,
    categoryAllocations: {}
};

function getMasterBudget() {
    try {
        const saved = localStorage.getItem(FINANCE_MASTER_BUDGET_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                // If saved data still contains old mock defaults (200000 / 50000 with no allocations), reset to 0
                if (parsed.totalBudget === 200000 && parsed.initialCash === 50000 && (!parsed.categoryAllocations || Object.keys(parsed.categoryAllocations).length === 0) && (!parsed.projectAllocations || Object.keys(parsed.projectAllocations).length === 0)) {
                    saveMasterBudget(DEFAULT_MASTER_BUDGET);
                    return { ...DEFAULT_MASTER_BUDGET, categoryAllocations: {}, projectAllocations: {} };
                }
                const catAlloc = (parsed.categoryAllocations && typeof parsed.categoryAllocations === 'object')
                    ? parsed.categoryAllocations
                    : ((parsed.projectAllocations && typeof parsed.projectAllocations === 'object') ? parsed.projectAllocations : {});
                return {
                    totalBudget: typeof parsed.totalBudget === 'number' ? parsed.totalBudget : (parseFloat(parsed.totalBudget) || 0),
                    initialCash: typeof parsed.initialCash === 'number' ? parsed.initialCash : (parseFloat(parsed.initialCash) || 0),
                    categoryAllocations: catAlloc,
                    projectAllocations: catAlloc
                };
            }
        }
    } catch (e) {}
    return { ...DEFAULT_MASTER_BUDGET, categoryAllocations: {}, projectAllocations: {} };
}

function saveMasterBudget(budgetData) {
    try {
        localStorage.setItem(FINANCE_MASTER_BUDGET_KEY, JSON.stringify(budgetData));
    } catch (e) {}

    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            if (typeof window.conworkSupabase.saveFinanceSettings === 'function') {
                window.conworkSupabase.saveFinanceSettings(budgetData).catch(e => console.warn('Supabase save master budget warning:', e));
            }
        } catch (e) {
            console.warn('Supabase master budget sync error:', e);
        }
    }
}

function getFinanceProjects() {
    let projs = [];
    if (typeof mockProjects !== 'undefined' && Array.isArray(mockProjects) && mockProjects.length > 0) {
        projs = mockProjects.filter(p => p.status !== 'deleted' && p.status !== 'hidden');
    } else if (window.App && App.state && Array.isArray(App.state.projects) && App.state.projects.length > 0) {
        projs = App.state.projects.filter(p => p.status !== 'deleted' && p.status !== 'hidden');
    }
    return projs;
}

function renderFinanceProjectSelects(selectedProjectId = null) {
    const projects = getFinanceProjects();
    const selects = [
        document.getElementById('finance-add-project-select'),
        document.getElementById('finance-request-project-select')
    ];

    selects.forEach(sel => {
        if (!sel) return;
        const prev = selectedProjectId || sel.value;
        sel.innerHTML = '<option value="">-- ส่วนกลาง / ไม่ระบุโครงการ --</option>';
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            if (prev && String(prev) === String(p.id)) opt.selected = true;
            sel.appendChild(opt);
        });
    });
}

const FINANCE_CATEGORIES_STORAGE_KEY = 'conwork_finance_categories';

const FINANCE_COLOR_PRESETS = {
    'orange': { color: '#f97316', bgClass: 'bg-orange-100', textClass: 'text-orange-500' },
    'purple': { color: '#a855f7', bgClass: 'bg-purple-100', textClass: 'text-purple-500' },
    'pink': { color: '#ec4899', bgClass: 'bg-pink-100', textClass: 'text-pink-500' },
    'sky': { color: '#0ea5e9', bgClass: 'bg-sky-100', textClass: 'text-sky-500' },
    'blue': { color: '#3b82f6', bgClass: 'bg-blue-100', textClass: 'text-blue-500' },
    'green': { color: '#10b981', bgClass: 'bg-emerald-100', textClass: 'text-emerald-500' },
    'red': { color: '#ef4444', bgClass: 'bg-red-100', textClass: 'text-red-500' },
    'yellow': { color: '#f59e0b', bgClass: 'bg-amber-100', textClass: 'text-amber-500' },
    'indigo': { color: '#6366f1', bgClass: 'bg-indigo-100', textClass: 'text-indigo-500' },
    'gray': { color: '#94a3b8', bgClass: 'bg-gray-100', textClass: 'text-gray-500' }
};

const DEFAULT_FINANCE_CATEGORIES = {
    'welfare': { id: 'welfare', name: 'สวัสดิการอาหารและเบรก', icon: 'fa-utensils', color: '#f97316', bgClass: 'bg-orange-100', textClass: 'text-orange-500', defaultBudget: 0 },
    'supplies': { id: 'supplies', name: 'พัสดุและอุปกรณ์', icon: 'fa-box', color: '#a855f7', bgClass: 'bg-purple-100', textClass: 'text-purple-500', defaultBudget: 0 },
    'activity': { id: 'activity', name: 'กิจกรรมโครงการ', icon: 'fa-palette', color: '#ec4899', bgClass: 'bg-pink-100', textClass: 'text-pink-500', defaultBudget: 0 },
    'travel': { id: 'travel', name: 'การเดินทางและขนส่ง', icon: 'fa-car', color: '#0ea5e9', bgClass: 'bg-sky-100', textClass: 'text-sky-500', defaultBudget: 0 },
    'other': { id: 'other', name: 'อื่น ๆ', icon: 'fa-ellipsis', color: '#94a3b8', bgClass: 'bg-gray-100', textClass: 'text-gray-500', defaultBudget: 0 }
};

function getFinanceCategories() {
    try {
        const saved = localStorage.getItem(FINANCE_CATEGORIES_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                // Clear old mock default budgets (5400, 4000, 6000, 2600, 2000)
                let hasMockBudget = false;
                if (parsed.welfare && parsed.welfare.defaultBudget === 5400) { parsed.welfare.defaultBudget = 0; hasMockBudget = true; }
                if (parsed.supplies && parsed.supplies.defaultBudget === 4000) { parsed.supplies.defaultBudget = 0; hasMockBudget = true; }
                if (parsed.activity && parsed.activity.defaultBudget === 6000) { parsed.activity.defaultBudget = 0; hasMockBudget = true; }
                if (parsed.travel && parsed.travel.defaultBudget === 2600) { parsed.travel.defaultBudget = 0; hasMockBudget = true; }
                if (parsed.other && parsed.other.defaultBudget === 2000) { parsed.other.defaultBudget = 0; hasMockBudget = true; }
                if (hasMockBudget) {
                    try { localStorage.setItem(FINANCE_CATEGORIES_STORAGE_KEY, JSON.stringify(parsed)); } catch (e) {}
                }
                Object.keys(parsed).forEach(k => {
                    if (!Array.isArray(parsed[k].subcategories)) {
                        parsed[k].subcategories = [];
                    }
                });
                return parsed;
            }
        }
    } catch (e) {}
    try {
        const defaults = { ...DEFAULT_FINANCE_CATEGORIES };
        Object.keys(defaults).forEach(k => {
            if (!Array.isArray(defaults[k].subcategories)) {
                defaults[k].subcategories = [];
            }
        });
        localStorage.setItem(FINANCE_CATEGORIES_STORAGE_KEY, JSON.stringify(defaults));
    } catch (e) {}
    return { ...DEFAULT_FINANCE_CATEGORIES };
}

function saveFinanceCategories(categories) {
    try {
        localStorage.setItem(FINANCE_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (e) {}
}

function renderFinanceCategorySelects(selectedKey = null) {
    const categories = getFinanceCategories();
    const selects = [
        document.getElementById('finance-add-category-select'),
        document.getElementById('finance-request-category-select')
    ];

    selects.forEach(select => {
        if (!select) return;
        const previousVal = selectedKey || select.value;
        select.innerHTML = '<option value="">เลือกหมวดหมู่...</option>';
        Object.entries(categories).forEach(([key, cat]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = cat.name;
            if (previousVal === key) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
        if (selectedKey && categories[selectedKey]) {
            select.value = selectedKey;
        }
    });

    onFinanceCategorySelectChanged('add');
    onFinanceCategorySelectChanged('request');
}

function onFinanceCategorySelectChanged(formType) {
    const catSelectId = formType === 'request' ? 'finance-request-category-select' : 'finance-add-category-select';
    const subSelectId = formType === 'request' ? 'finance-request-subcategory-select' : 'finance-add-subcategory-select';
    const catSelect = document.getElementById(catSelectId);
    const subSelect = document.getElementById(subSelectId);
    if (!subSelect) return;

    const selectedCatKey = catSelect ? catSelect.value : '';
    const categories = getFinanceCategories();
    const currentCat = categories[selectedCatKey];

    subSelect.innerHTML = '';

    if (currentCat && Array.isArray(currentCat.subcategories) && currentCat.subcategories.length > 0) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- เลือกหมวดหมู่ย่อย (ไม่ระบุก็ได้) --';
        subSelect.appendChild(defaultOpt);

        currentCat.subcategories.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.id || sub.name;
            opt.setAttribute('data-name', sub.name);
            opt.textContent = `${sub.name} (งบ: ฿${(parseFloat(sub.budget) || 0).toLocaleString()})`;
            subSelect.appendChild(opt);
        });
        subSelect.disabled = false;
    } else {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- ไม่มีหมวดหมู่ย่อยในหมวดนี้ --';
        subSelect.appendChild(defaultOpt);
        subSelect.disabled = false;
    }
}

function renderCategoryManagementList() {
    const container = document.getElementById('finance-category-manager-items');
    const countBadge = document.getElementById('cat-count-badge');
    if (!container) return;

    const categories = getFinanceCategories();
    const txs = getStoredTransactions();
    const keys = Object.keys(categories);

    if (countBadge) countBadge.textContent = keys.length;

    if (keys.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400 text-xs">
                <i class="fa-solid fa-folder-open text-2xl mb-2 text-gray-300"></i>
                <p>ยังไม่มีหมวดหมู่ กรุณาเพิ่มหมวดหมู่ใหม่</p>
            </div>
        `;
        return;
    }

    container.innerHTML = keys.map(k => {
        const cat = categories[k];
        const txCount = txs.filter(t => t.category === k).length;
        const color = cat.color || '#64748b';
        const icon = cat.icon || 'fa-box';
        const bgClass = cat.bgClass || 'bg-gray-100';
        const textClass = cat.textClass || 'text-gray-500';
        const budget = cat.defaultBudget ? '฿' + Number(cat.defaultBudget).toLocaleString() : 'ไม่ได้กำหนด';

        return `
            <div class="flex items-center justify-between p-3 rounded-2xl bg-gray-50/80 hover:bg-gray-100/80 border border-gray-100 transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl ${bgClass} flex items-center justify-center shrink-0 shadow-sm" style="${!bgClass ? 'background-color:' + color + '20;' : ''}">
                        <i class="fa-solid ${icon} ${textClass} text-sm" style="${!textClass ? 'color:' + color + ';' : ''}"></i>
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-xs">${cat.name}</div>
                        <div class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                            <span>งบ: <strong class="text-gray-600">${budget}</strong></span>
                            <span>•</span>
                            <span>ใช้ใน <strong>${txCount}</strong> รายการ</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="deleteFinanceCategory('${k}')" class="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-all" title="ลบหมวดหมู่นี้">
                        <i class="fa-regular fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openFinanceCategoryManager(tab = 'list') {
    openFinanceModal('finance-add-category-modal');
    switchCategoryManagerTab(tab);
    renderCategoryManagementList();
}

function switchCategoryManagerTab(tab) {
    const listTab = document.getElementById('category-mgr-tab-list');
    const addTab = document.getElementById('category-mgr-tab-add');
    const btnList = document.getElementById('cat-tab-btn-list');
    const btnAdd = document.getElementById('cat-tab-btn-add');
    const submitBtn = document.getElementById('btn-submit-category');

    if (tab === 'add') {
        if (listTab) listTab.classList.add('hidden');
        if (addTab) addTab.classList.remove('hidden');
        if (btnList) {
            btnList.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            btnList.classList.add('text-gray-500');
        }
        if (btnAdd) {
            btnAdd.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            btnAdd.classList.remove('text-gray-500');
        }
        if (submitBtn) submitBtn.classList.remove('hidden');
        const nameInput = document.getElementById('add-category-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
    } else {
        if (listTab) listTab.classList.remove('hidden');
        if (addTab) addTab.classList.add('hidden');
        if (btnList) {
            btnList.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            btnList.classList.remove('text-gray-500');
        }
        if (btnAdd) {
            btnAdd.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            btnAdd.classList.add('text-gray-500');
        }
        if (submitBtn) submitBtn.classList.add('hidden');
        renderCategoryManagementList();
    }
}

function selectQuickIcon(iconClass) {
    const iconInput = document.getElementById('add-category-icon');
    const preview = document.getElementById('add-category-icon-preview');
    if (iconInput) iconInput.value = iconClass;
    if (preview) preview.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
}

function deleteFinanceCategory(catKey) {
    const categories = getFinanceCategories();
    const cat = categories[catKey];
    if (!cat) return;

    const keys = Object.keys(categories);
    if (keys.length <= 1) {
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('ต้องมีหมวดหมู่อย่างน้อย 1 หมวดหมู่ ไม่สามารถลบทั้งหมดได้', 'warning');
        } else {
            alert('ต้องมีหมวดหมู่อย่างน้อย 1 หมวดหมู่ ไม่สามารถลบทั้งหมดได้');
        }
        return;
    }

    const txs = getStoredTransactions();
    const usedCount = txs.filter(t => t.category === catKey).length;
    const confirmMsg = usedCount > 0 
        ? `คุณต้องการลบหมวดหมู่ "${cat.name}" ใช่หรือไม่?\n\n* มีรายการที่ใช้หมวดหมู่นี้อยู่ ${usedCount} รายการ รายการเหล่านี้จะถูกย้ายไปยังหมวดหมู่อื่น`
        : `คุณต้องการลบหมวดหมู่ "${cat.name}" ใช่หรือไม่?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    delete categories[catKey];
    saveFinanceCategories(categories);

    // Migrate any orphaned transactions to a remaining category
    const remainingKeys = Object.keys(categories);
    const fallbackKey = categories['other'] ? 'other' : remainingKeys[0];
    let updatedTxs = false;
    txs.forEach(t => {
        if (t.category === catKey) {
            t.category = fallbackKey;
            updatedTxs = true;
        }
    });
    if (updatedTxs) {
        localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(txs));
    }

    // Sync category deletion to Supabase if available
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            window.conworkSupabase.deleteFinanceCategory(catKey).catch(e => console.warn('Supabase delete category warning:', e));
        } catch (e) {}
    }

    renderCategoryManagementList();
    renderFinanceCategorySelects();
    loadStoredTransactionsToTable();
    recalculateFinanceTotals();

    if (window.App && typeof App._showToast === 'function') {
        App._showToast(`ลบหมวดหมู่ "${cat.name}" เรียบร้อยแล้ว`, 'success');
    }
}

function getStoredTransactions() {
    try {
        const saved = localStorage.getItem(FINANCE_STORAGE_KEY);
        if (saved) {
            const list = JSON.parse(saved);
            if (Array.isArray(list)) {
                // Filter out any leftover mock transactions (tx-1, tx-2, tx-3, or mock titles)
                const mockIds = ['tx-1', 'tx-2', 'tx-3'];
                const filtered = list.filter(t => !mockIds.includes(t.id) && !['ค่าอาหารกลางวันทีมสำรวจหน้างาน', 'จัดซื้อสายไฟและอุปกรณ์ความปลอดภัย VAF', 'ค่าน้ำมันรถกระบะขนส่งวัสดุ'].includes(t.title));
                if (filtered.length !== list.length) {
                    try { localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(filtered)); } catch (e) {}
                }
                return filtered;
            }
        }
    } catch (e) {}
    return [];
}

function saveTransactionToStorage(tx) {
    const list = getStoredTransactions();
    list.unshift(tx);
    try { localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(list)); } catch (e) {}

    // Sync to Supabase if available
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            const companyId = (window.App && App.state && App.state.workspaces && App.state.workspaces[0]) ? App.state.workspaces[0].id : null;
            const dbStatus = STATUS_TO_DB[tx.status] || (tx.transaction_type === 'credit' ? 'pending' : 'paid');
            const dbTx = {
                id: tx.id,
                title: tx.title,
                transaction_type: tx.transaction_type,
                category_id: tx.category || 'other',
                subcategory_id: tx.subcategory_id || null,
                subcategory_name: tx.subcategory_name || null,
                amount: parseFloat(tx.amount) || 0,
                status: dbStatus,
                transaction_date: tx.transaction_date,
                responsible_user: tx.author,
                company_id: companyId
            };
            window.conworkSupabase.createFinanceTransaction(dbTx).then(res => {
                if (res) console.log('Transaction synced to Supabase successfully:', res.id);
            }).catch(e => console.warn('Supabase save error:', e));
        } catch (e) {
            console.warn('Supabase save error:', e);
        }
    }
}

async function syncFinanceWithSupabase() {
    if (!window.conworkSupabase || !window.conworkSupabase.isAvailable()) return;
    try {
        const companyId = (window.App && App.state && App.state.workspaces && App.state.workspaces[0]) ? App.state.workspaces[0].id : null;
        
        // 0. Sync Master Budget & Settings from Supabase
        try {
            if (typeof window.conworkSupabase.fetchFinanceSettings === 'function') {
                const settings = await window.conworkSupabase.fetchFinanceSettings();
                if (settings && (settings.total_budget || settings.category_allocations)) {
                    const mb = {
                        totalBudget: parseFloat(settings.total_budget) || 0,
                        initialCash: parseFloat(settings.initial_cash) || 0,
                        categoryAllocations: settings.category_allocations || {}
                    };
                    localStorage.setItem(FINANCE_MASTER_BUDGET_KEY, JSON.stringify(mb));
                }
            }
        } catch (mbErr) {
            console.warn('Supabase fetch settings warning:', mbErr);
        }

        // 1. Sync Categories from Supabase
        try {
            const remoteCats = await window.conworkSupabase.fetchFinanceCategories();
            if (remoteCats && remoteCats.length > 0) {
                const localCats = getFinanceCategories();
                remoteCats.forEach(rc => {
                    const preset = FINANCE_COLOR_PRESETS[rc.color] || { color: rc.color || '#3b82f6', bgClass: 'bg-blue-100', textClass: 'text-blue-500' };
                    const existingCat = localCats[rc.id] || {};
                    const remoteSubcats = Array.isArray(rc.subcategories) ? rc.subcategories : (existingCat.subcategories || []);
                    localCats[rc.id] = {
                        id: rc.id,
                        name: rc.name,
                        color: preset.color,
                        icon: rc.icon || 'fa-box',
                        bgClass: preset.bgClass,
                        textClass: preset.textClass,
                        defaultBudget: parseFloat(rc.default_budget) || existingCat.defaultBudget || 0,
                        subcategories: remoteSubcats
                    };
                });
                saveFinanceCategories(localCats);
                renderFinanceCategorySelects();
                renderCategoryManagementList();
            }
        } catch (catErr) {
            console.warn('Supabase fetch categories warning:', catErr);
        }

        // 2. Sync Transactions from Supabase
        const remoteTxs = await window.conworkSupabase.fetchFinanceTransactions(companyId);
        if (remoteTxs && remoteTxs.length > 0) {
            const mapped = remoteTxs.map(t => ({
                id: t.id,
                title: t.title,
                category: t.category_id || t.category || 'other',
                subcategory_id: t.subcategory_id || null,
                subcategory_name: t.subcategory_name || null,
                amount: parseFloat(t.amount) || 0,
                transaction_type: t.transaction_type || 'cash',
                status: STATUS_TO_THAI[t.status] || t.status || 'จ่ายแล้ว',
                transaction_date: t.transaction_date,
                author: t.responsible_user || 'ทีมงาน'
            }));
            localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(mapped));
            loadStoredTransactionsToTable();
        }

        recalculateFinanceTotals();
    } catch (err) {
        console.warn('Supabase finance sync warning:', err);
    }
}

function recalculateFinanceTotals() {
    const txs = getStoredTransactions();
    const masterBudget = getMasterBudget();
    const totalMasterBudget = typeof masterBudget.totalBudget === 'number' ? masterBudget.totalBudget : (parseFloat(masterBudget.totalBudget) || 0);
    const initialCash = typeof masterBudget.initialCash === 'number' ? masterBudget.initialCash : (parseFloat(masterBudget.initialCash) || 0);

    let cashUsed = 0;
    let pendingAmount = 0;
    let approvedAmount = 0;
    let cashInflow = 0;

    txs.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.transaction_type === 'cash') {
            if (t.is_inflow) {
                cashInflow += amt;
            } else {
                cashUsed += amt;
            }
        }

        if (t.status === 'รออนุมัติ' || t.status === 'pending') {
            pendingAmount += amt;
        } else if (t.status === 'จ่ายแล้ว' || t.status === 'อนุมัติแล้ว' || t.status === 'paid' || t.status === 'approved') {
            approvedAmount += amt;
        }
    });

    const cashRemaining = Math.max(0, initialCash + cashInflow - cashUsed);

    // --- 1. Category-Based Budget Computations ---
    const categories = getFinanceCategories();
    const catKeys = Object.keys(categories);
    const allocations = masterBudget.categoryAllocations || masterBudget.projectAllocations || {};
    let sumAllocated = 0;
    const catData = {};

    catKeys.forEach(k => {
        const meta = categories[k];
        const catTxs = txs.filter(t => t.category === k);
        const creditTxs = catTxs.filter(t => t.transaction_type === 'credit');
        const cashTxs = catTxs.filter(t => t.transaction_type === 'cash');

        const creditSum = creditTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const cashSum = cashTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
        // Allocated budget for category: priority from masterBudget.categoryAllocations[k], fallback to meta.defaultBudget
        const allocated = (typeof allocations[k] !== 'undefined' && allocations[k] !== null)
            ? (parseFloat(allocations[k]) || 0)
            : (parseFloat(meta.defaultBudget) || 0);

        sumAllocated += allocated;
        const planned = Math.max(allocated, creditSum);

        const rawSubcategories = Array.isArray(meta.subcategories) ? meta.subcategories : [];
        const computedSubcategories = rawSubcategories.map(sub => {
            const subId = String(sub.id || '');
            const subName = String(sub.name || '').trim();
            const subAllocated = parseFloat(sub.budget) || 0;
            const subTxs = catTxs.filter(t => (t.subcategory_id && String(t.subcategory_id) === subId) || (t.subcategory_name && String(t.subcategory_name).trim() === subName));
            const subCreditTxs = subTxs.filter(t => t.transaction_type === 'credit');
            const subCashTxs = subTxs.filter(t => t.transaction_type === 'cash');
            const subSpent = subCashTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
            const subCredit = subCreditTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
            const subRemaining = Math.max(0, subAllocated - subSpent);
            const subUsedPct = subAllocated > 0 ? Math.min(100, Math.round((subSpent / subAllocated) * 100)) : 0;
            return {
                id: sub.id,
                name: sub.name,
                budget: subAllocated,
                allocated: subAllocated,
                spent: subSpent,
                credit: subCredit,
                remaining: subRemaining,
                usedPct: subUsedPct,
                txs: subTxs
            };
        });

        catData[k] = {
            key: k,
            id: k,
            name: meta.name,
            icon: meta.icon || 'fa-box',
            color: meta.color || '#64748b',
            bgClass: meta.bgClass || 'bg-gray-100',
            textClass: meta.textClass || 'text-gray-500',
            allocated: allocated,
            planned: planned,
            creditSum: creditSum,
            cashSum: cashSum,
            spent: cashSum,
            remaining: Math.max(0, (allocated > 0 ? allocated : planned) - cashSum),
            usedPct: (allocated > 0 ? allocated : planned) > 0 ? Math.min(100, Math.round((cashSum / (allocated > 0 ? allocated : planned)) * 100)) : 0,
            subcategories: computedSubcategories,
            txs: catTxs
        };
    });

    // Group any orphaned transactions under other or first category
    const orphanedTxs = txs.filter(t => !categories[t.category]);
    if (orphanedTxs.length > 0 && catKeys.length > 0) {
        const fallbackKey = categories['other'] ? 'other' : catKeys[0];
        if (catData[fallbackKey]) {
            orphanedTxs.forEach(t => {
                const amt = parseFloat(t.amount) || 0;
                if (t.transaction_type === 'credit') {
                    catData[fallbackKey].creditSum += amt;
                } else {
                    catData[fallbackKey].cashSum += amt;
                    catData[fallbackKey].spent += amt;
                }
                catData[fallbackKey].txs.push(t);
            });
            const alloc = catData[fallbackKey].allocated;
            catData[fallbackKey].planned = Math.max(alloc, catData[fallbackKey].creditSum);
            catData[fallbackKey].remaining = Math.max(0, (alloc > 0 ? alloc : catData[fallbackKey].planned) - catData[fallbackKey].cashSum);
            catData[fallbackKey].usedPct = (alloc > 0 ? alloc : catData[fallbackKey].planned) > 0 ? Math.min(100, Math.round((catData[fallbackKey].cashSum / (alloc > 0 ? alloc : catData[fallbackKey].planned)) * 100)) : 0;
        }
    }

    const effectiveTotalBudget = totalMasterBudget > 0 ? totalMasterBudget : sumAllocated;
    const unallocatedReserve = Math.max(0, effectiveTotalBudget - sumAllocated);

    // Keep projectData calculation available for project references
    const projects = getFinanceProjects();
    const projectData = projects.map(p => {
        const projTxs = txs.filter(t => t.project_id && String(t.project_id) === String(p.id));
        const projSpent = projTxs.filter(t => t.transaction_type === 'cash' && !t.is_inflow)
                                .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        return {
            id: p.id,
            name: p.name,
            spent: projSpent,
            txs: projTxs
        };
    });

    // --- 2. Summary Cards (5 Cards) ---
    const c1El = document.getElementById('finance-card-total-budget');
    if (c1El) c1El.textContent = '฿' + effectiveTotalBudget.toLocaleString();
    const c1Sub = document.getElementById('finance-card-budget-subtext');
    if (c1Sub) c1Sub.textContent = `จัดสรรให้หมวดหมู่แล้ว ฿${sumAllocated.toLocaleString()} (คงเหลือยังไม่จัดสรร ฿${unallocatedReserve.toLocaleString()})`;

    const c2El = document.getElementById('finance-card-cash-used');
    if (c2El) c2El.textContent = '฿' + cashUsed.toLocaleString();

    const c3El = document.getElementById('finance-card-cash-remaining');
    if (c3El) c3El.textContent = '฿' + cashRemaining.toLocaleString();

    const c4El = document.getElementById('finance-card-pending');
    if (c4El) c4El.textContent = '฿' + pendingAmount.toLocaleString();

    const c5El = document.getElementById('finance-card-approved');
    if (c5El) c5El.textContent = '฿' + approvedAmount.toLocaleString();

    // Update pending tab count badge
    const pendingTabBadge = document.getElementById('finance-tab-pending-count');
    if (pendingTabBadge) {
        const pendingCount = txs.filter(t => t.status === 'รออนุมัติ' || t.status === 'pending').length;
        pendingTabBadge.textContent = pendingCount;
    }

    // Fallback for card queries
    const cards = document.querySelectorAll('#view-accounting .grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5 > div');
    if (cards.length >= 5) {
        if (!c1El) {
            const v = cards[0].querySelector('.text-2xl');
            if (v) v.textContent = '฿' + effectiveTotalBudget.toLocaleString();
        }
        if (!c2El) {
            const v = cards[1].querySelector('.text-2xl');
            if (v) v.textContent = '฿' + cashUsed.toLocaleString();
        }
        if (!c3El) {
            const v = cards[2].querySelector('.text-2xl');
            if (v) v.textContent = '฿' + cashRemaining.toLocaleString();
        }
        if (!c4El) {
            const v = cards[3].querySelector('.text-2xl');
            if (v) v.textContent = '฿' + pendingAmount.toLocaleString();
        }
        if (!c5El) {
            const v = cards[4].querySelector('.text-2xl');
            if (v) v.textContent = '฿' + approvedAmount.toLocaleString();
        }
    }

    // --- 3. Comparison Progress Bar ---
    const pAllocText = document.getElementById('finance-progress-allocated-text');
    if (pAllocText) pAllocText.textContent = '฿' + sumAllocated.toLocaleString();

    const pRemainText = document.getElementById('finance-progress-remaining-text');
    if (pRemainText) pRemainText.textContent = '฿' + unallocatedReserve.toLocaleString();

    const spentPct = effectiveTotalBudget > 0 ? Math.min(100, Math.round((cashUsed / effectiveTotalBudget) * 100)) : 0;
    const allocPct = effectiveTotalBudget > 0 ? Math.min(100, Math.round((sumAllocated / effectiveTotalBudget) * 100)) : 0;
    const unallocPct = Math.max(0, 100 - allocPct);

    const spentBar = document.getElementById('finance-progress-spent-bar');
    if (spentBar) {
        spentBar.style.width = `${spentPct}%`;
        spentBar.textContent = `ใช้จริง ${spentPct}% (฿${cashUsed.toLocaleString()})`;
    }
    const allocBar = document.getElementById('finance-progress-allocated-bar');
    if (allocBar) {
        const extraAllocWidth = Math.max(0, allocPct - spentPct);
        allocBar.style.width = `${extraAllocWidth}%`;
        allocBar.textContent = extraAllocWidth > 12 ? `จัดสรรให้หมวดหมู่ ${allocPct}%` : '';
    }
    const remainingBar = document.getElementById('finance-progress-remaining-bar');
    if (remainingBar) {
        remainingBar.style.width = `${unallocPct}%`;
        remainingBar.textContent = `คงเหลือยังไม่จัดสรร ${unallocPct}% (฿${unallocatedReserve.toLocaleString()})`;
    }

    // --- 4. Col 1: Credit Donut Chart & Legends (Master Budget & Category Allocations) ---
    let currentPct = 0;
    const gradientSlices = [];
    const creditLegendItems = [];

    catKeys.forEach(k => {
        const d = catData[k];
        const color = d.color || '#6366f1';
        const pct = effectiveTotalBudget > 0 ? (d.allocated / effectiveTotalBudget) * 100 : 0;
        if (pct > 0) {
            const start = currentPct;
            currentPct += pct;
            gradientSlices.push(`${color} ${start.toFixed(1)}% ${currentPct.toFixed(1)}%`);
        }

        creditLegendItems.push(`
            <div class="flex items-center justify-between text-xs hover:bg-gray-50 p-1 -mx-1 rounded transition-colors cursor-pointer" onclick="filterTransactionsByCategory('${k}')" title="คลิกเพื่อกรองรายการของหมวดนี้">
                <div class="flex items-center gap-2.5 truncate max-w-[150px]">
                    <div class="w-3 h-3 rounded-full shrink-0" style="background-color: ${color};"></div>
                    <span class="text-gray-700 truncate font-medium">${d.name}</span>
                </div>
                <span class="font-medium text-gray-800 text-right">฿${(d.allocated || 0).toLocaleString()} <span class="text-gray-400 font-normal ml-1 w-8 inline-block text-right">(${pct.toFixed(0)}%)</span></span>
            </div>
        `);
    });

    if (unallocatedReserve > 0) {
        const unallocPctFloat = effectiveTotalBudget > 0 ? (unallocatedReserve / effectiveTotalBudget) * 100 : 0;
        gradientSlices.push(`#e2e8f0 ${currentPct.toFixed(1)}% 100%`);
        creditLegendItems.push(`
            <div class="flex items-center justify-between text-xs hover:bg-gray-50 p-1 -mx-1 rounded transition-colors cursor-pointer border-t border-dashed border-gray-100 pt-2 mt-1" onclick="openAllocateBudgetModal()" title="คลิกเพื่อจัดสรรงบที่เหลือ">
                <div class="flex items-center gap-2.5">
                    <div class="w-3 h-3 rounded-full shrink-0 bg-slate-300"></div>
                    <span class="text-gray-500 font-medium">ยังไม่จัดสรร</span>
                </div>
                <span class="font-semibold text-emerald-600">฿${unallocatedReserve.toLocaleString()} <span class="text-gray-400 font-normal ml-1 w-8 inline-block text-right">(${unallocPctFloat.toFixed(0)}%)</span></span>
            </div>
        `);
    }

    if (gradientSlices.length === 0) gradientSlices.push('#cbd5e1 0% 100%');

    const creditChartEl = document.getElementById('finance-credit-donut-chart');
    if (creditChartEl) {
        creditChartEl.style.background = `conic-gradient(${gradientSlices.join(', ')})`;
    }
    const creditTotalEl = document.getElementById('finance-credit-donut-total');
    if (creditTotalEl) {
        creditTotalEl.textContent = '฿' + effectiveTotalBudget.toLocaleString();
    }
    const creditLegendEl = document.getElementById('finance-credit-donut-legend');
    if (creditLegendEl) {
        creditLegendEl.innerHTML = creditLegendItems.join('');
    }

    // --- 5. Col 2: Cash Donut Chart & Legend ---
    const totalCashPool = initialCash + cashInflow;
    const cashRemainingPct = totalCashPool > 0 ? Math.max(0, Math.min(100, Math.round((cashRemaining / totalCashPool) * 100))) : 0;

    const cashChartEl = document.getElementById('finance-cash-donut-chart');
    if (cashChartEl) {
        cashChartEl.style.background = `conic-gradient(#22c55e 0% ${cashRemainingPct}%, #e2e8f0 ${cashRemainingPct}% 100%)`;
    }
    const cashTotalEl = document.getElementById('finance-cash-donut-total');
    if (cashTotalEl) {
        cashTotalEl.textContent = '฿' + cashRemaining.toLocaleString();
    }
    const cashLegendEl = document.getElementById('finance-cash-donut-legend');
    if (cashLegendEl) {
        cashLegendEl.innerHTML = `
            <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2.5"><div class="w-3 h-3 rounded-full bg-[#22c55e]"></div><span class="text-gray-700">เงินสดตั้งต้น (Opening)</span></div>
                <span class="font-medium text-gray-800">฿${initialCash.toLocaleString()}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2.5"><div class="w-3 h-3 rounded-full bg-[#10b981]"></div><span class="text-gray-700">รับเข้า (Inflow)</span></div>
                <span class="font-medium text-gray-800">฿${cashInflow.toLocaleString()}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2.5"><div class="w-3 h-3 rounded-full bg-[#f43f5e]"></div><span class="text-gray-700">จ่ายออก (Actual Expenses)</span></div>
                <span class="font-medium text-red-600">- ฿${cashUsed.toLocaleString()}</span>
            </div>
            <div class="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold">
                <span class="text-gray-800">เงินสดคงเหลือปัจจุบัน</span>
                <span class="text-green-600">฿${cashRemaining.toLocaleString()}</span>
            </div>
        `;
    }

    // --- 6. Col 3: Render Breakdown View ---
    renderCategoryBreakdown(catKeys, catData, sumAllocated, cashUsed);
}

function renderProjectBudgetBreakdown(projectData, totalMasterBudget, sumAllocated, totalCashUsed) {
    const listEl = document.getElementById('finance-project-breakdown-list');
    if (!listEl) return;

    if (!projectData || projectData.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-6 text-gray-400 text-xs">
                <i class="fa-solid fa-folder-open text-2xl mb-2 text-gray-300"></i>
                <p>ยังไม่มีข้อมูลโครงการ</p>
                <button type="button" onclick="openAllocateBudgetModal()" class="mt-2 text-indigo-600 font-bold hover:underline">คลิกเพื่อจัดสรรงบ</button>
            </div>
        `;
        return;
    }

    const html = projectData.map((p, idx) => {
        const collapseId = `proj-breakdown-details-${idx}`;
        const hasTxs = p.txs && p.txs.length > 0;
        const subItemsHTML = hasTxs ? p.txs.map(tx => {
            const isCash = tx.transaction_type === 'cash';
            return `
                <div class="flex justify-between text-[10px] text-gray-600 py-1 hover:bg-white px-2 rounded transition-colors">
                    <span class="truncate max-w-[140px] font-medium">${tx.title}</span>
                    <div class="flex gap-2.5 shrink-0 text-right">
                        <span class="${isCash ? 'text-gray-300' : 'text-blue-600 font-semibold'} w-14">${isCash ? '-' : '฿' + (parseFloat(tx.amount)||0).toLocaleString()}</span>
                        <span class="${isCash ? 'text-green-600 font-semibold' : 'text-gray-300'} w-14">${isCash ? '฿' + (parseFloat(tx.amount)||0).toLocaleString() : '-'}</span>
                        <span class="text-gray-400 w-12">${tx.status || 'เสร็จสิ้น'}</span>
                    </div>
                </div>
            `;
        }).join('') : `<div class="text-[10px] text-gray-400 py-1 pl-2 italic">ยังไม่มีรายการค่าใช้จ่ายในโครงการนี้</div>`;

        return `
            <div>
                <div class="flex items-center justify-between text-[11px] mb-2 cursor-pointer group hover:bg-gray-50 p-1 -mx-1 rounded transition-colors" onclick="document.getElementById('${collapseId}').classList.toggle('hidden');">
                    <div class="w-2/5 flex items-center gap-2 font-medium text-gray-700 truncate pr-1">
                        <div class="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-diagram-project text-[10px]"></i>
                        </div>
                        <span class="truncate font-semibold">${p.name}</span>
                        <i class="fa-solid fa-angle-down text-gray-300 ml-auto text-[10px] group-hover:text-gray-500 transition-transform"></i>
                    </div>
                    <div class="w-1/5 text-right font-medium text-indigo-700">฿${p.allocated.toLocaleString()}</div>
                    <div class="w-1/5 text-right font-medium text-gray-600">฿${p.spent.toLocaleString()}</div>
                    <div class="w-1/5 text-right font-bold ${p.remaining > 0 ? 'text-gray-800' : 'text-red-500'}">฿${p.remaining.toLocaleString()}</div>
                </div>
                <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
                    <div class="bg-indigo-500 h-full transition-all duration-500" style="width: ${p.usedPct}%;"></div>
                    <div class="bg-blue-300 h-full opacity-40 transition-all duration-500" style="width: ${100 - p.usedPct}%;"></div>
                </div>
                <div class="flex items-center justify-between text-[9px] text-gray-400 mt-1 px-0.5">
                    <span>${p.txs ? p.txs.length : 0} รายการ</span>
                    <span>ใช้งบไปแล้ว ${p.usedPct}%</span>
                </div>

                <div id="${collapseId}" class="hidden mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1">
                    <div class="flex justify-between text-[9px] font-bold text-gray-400 border-b border-gray-200/60 pb-1 mb-1 px-2">
                        <span>รายการของโครงการ</span>
                        <div class="flex gap-2.5 text-right">
                            <span class="w-14">Credit</span>
                            <span class="w-14">Cash</span>
                            <span class="w-12">สถานะ</span>
                        </div>
                    </div>
                    ${subItemsHTML}
                </div>
            </div>
        `;
    }).join('');

    listEl.innerHTML = html;

    const sumAllocEl = document.getElementById('finance-project-sum-allocated');
    if (sumAllocEl) sumAllocEl.textContent = '฿' + sumAllocated.toLocaleString();

    const sumSpentEl = document.getElementById('finance-project-sum-spent');
    if (sumSpentEl) sumSpentEl.textContent = '฿' + totalCashUsed.toLocaleString();

    const sumRemEl = document.getElementById('finance-project-sum-remaining');
    if (sumRemEl) sumRemEl.textContent = '฿' + Math.max(0, sumAllocated - totalCashUsed).toLocaleString();
}

function renderCategoryBreakdown(catKeys, catData, totalAllocated, totalCashUsed) {
    const breakdownListEl = document.getElementById('finance-category-breakdown-list');
    if (!breakdownListEl) return;

    let totalCatCash = 0;
    let totalCatAllocated = 0;
    const breakdownHTML = catKeys.map((k, idx) => {
        const d = catData[k];
        const allocated = parseFloat(d.allocated) || 0;
        totalCatCash += (d.cashSum || 0);
        totalCatAllocated += allocated;
        const collapseId = `cat-breakdown-details-${idx}`;
        const hasTxs = d.txs && d.txs.length > 0;
        
        const subcategoriesList = Array.isArray(d.subcategories) ? d.subcategories : [];
        let subcatSectionHTML = '';
        if (subcategoriesList.length > 0) {
            subcatSectionHTML = `
                <div class="mb-2 pb-2 border-b border-gray-200/60">
                    <div class="flex items-center justify-between text-[10px] font-bold text-indigo-800 mb-1.5 px-1">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-sitemap text-[9px]"></i> หมวดหมู่ย่อย (${subcategoriesList.length})</span>
                        <span class="text-[9px] text-gray-400 font-normal">งบจัดสรร / ใช้จริง / เหลือ</span>
                    </div>
                    <div class="space-y-1.5">
                        ${subcategoriesList.map(sub => `
                            <div class="bg-white p-1.5 rounded-lg border border-gray-100">
                                <div class="flex items-center justify-between text-[10px] font-medium text-gray-700 mb-0.5">
                                    <span class="truncate max-w-[130px] font-semibold text-gray-800">${sub.name}</span>
                                    <div class="flex gap-2 text-right text-[10px]">
                                        <span class="text-indigo-600 font-semibold w-14">฿${sub.budget.toLocaleString()}</span>
                                        <span class="text-gray-600 w-14">฿${sub.spent.toLocaleString()}</span>
                                        <span class="${sub.remaining > 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'} w-14">฿${sub.remaining.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div class="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                                    <div class="bg-indigo-500 h-full transition-all duration-300" style="width: ${sub.usedPct}%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const subItemsHTML = hasTxs ? d.txs.map(tx => {
            const isCash = tx.transaction_type === 'cash';
            const subBadge = tx.subcategory_name ? `<span class="inline-flex items-center text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1 py-0.2 mr-1"><i class="fa-solid fa-sitemap text-[7px] mr-0.5"></i>${tx.subcategory_name}</span>` : '';
            return `
                <div class="flex justify-between text-[10px] text-gray-600 py-1 hover:bg-white px-2 rounded transition-colors">
                    <span class="truncate max-w-[150px] font-medium flex items-center">${subBadge}<span class="truncate">${tx.title}</span></span>
                    <div class="flex gap-3 shrink-0 text-right">
                        <span class="${isCash ? 'text-gray-300' : 'text-blue-600 font-semibold'} w-14">${isCash ? '-' : '฿' + (parseFloat(tx.amount)||0).toLocaleString()}</span>
                        <span class="${isCash ? 'text-green-600 font-semibold' : 'text-gray-300'} w-14">${isCash ? '฿' + (parseFloat(tx.amount)||0).toLocaleString() : '-'}</span>
                        <span class="text-gray-400 w-12">${tx.status || 'เสร็จสิ้น'}</span>
                    </div>
                </div>
            `;
        }).join('') : `<div class="text-[10px] text-gray-400 py-1 pl-2 italic">ยังไม่มีรายการบันทึกในหมวดนี้</div>`;

        return `
            <div>
                <div class="flex items-center justify-between text-[11px] mb-2 cursor-pointer group hover:bg-gray-50 p-1 -mx-1 rounded transition-colors" onclick="document.getElementById('${collapseId}').classList.toggle('hidden');">
                    <div class="w-2/5 flex items-center gap-2.5 font-medium text-gray-700">
                        <div class="w-6 h-6 rounded ${d.bgClass} flex items-center justify-center shrink-0">
                            <i class="fa-solid ${d.icon} ${d.textClass} text-[10px]"></i>
                        </div>
                        <div class="truncate">
                            <span class="truncate font-semibold block">${d.name}</span>
                            ${subcategoriesList.length > 0 ? `<span class="text-[9px] text-indigo-600 font-normal">มี ${subcategoriesList.length} หมวดหมู่ย่อย</span>` : ''}
                        </div>
                        <i class="fa-solid fa-angle-down text-gray-300 ml-auto text-[10px] group-hover:text-gray-500 transition-transform"></i>
                    </div>
                    <div class="w-1/5 text-right font-medium text-indigo-700">฿${allocated.toLocaleString()}</div>
                    <div class="w-1/5 text-right font-medium text-gray-600">฿${d.cashSum.toLocaleString()}</div>
                    <div class="w-1/5 text-right font-bold ${d.remaining > 0 ? 'text-gray-800' : 'text-red-500'}">฿${d.remaining.toLocaleString()}</div>
                </div>
                <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
                    <div class="bg-indigo-500 h-full transition-all duration-500" style="width: ${d.usedPct}%;"></div>
                    <div class="bg-blue-300 h-full opacity-30 transition-all duration-500" style="width: ${100 - d.usedPct}%;"></div>
                </div>
                <div class="flex items-center justify-between text-[9px] text-gray-400 mt-1 px-0.5">
                    <span>${d.txs ? d.txs.length : 0} รายการ</span>
                    <span>ใช้ไปแล้ว ${d.usedPct}%</span>
                </div>
                
                <div id="${collapseId}" class="hidden mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1">
                    ${subcatSectionHTML}
                    <div class="flex justify-between text-[9px] font-bold text-gray-400 border-b border-gray-200/60 pb-1 mb-1 px-2">
                        <span>ประวัติรายการ</span>
                        <div class="flex gap-3 text-right">
                            <span class="w-14">Credit</span>
                            <span class="w-14">Cash</span>
                            <span class="w-12">สถานะ</span>
                        </div>
                    </div>
                    ${subItemsHTML}
                </div>
            </div>
        `;
    }).join('');

    breakdownListEl.innerHTML = breakdownHTML;

    const plannedEl = document.getElementById('finance-cat-sum-planned');
    if (plannedEl) plannedEl.textContent = '฿' + totalCatAllocated.toLocaleString();

    const cashEl = document.getElementById('finance-cat-sum-cash');
    if (cashEl) cashEl.textContent = '฿' + totalCatCash.toLocaleString();

    const remEl = document.getElementById('finance-cat-sum-remaining');
    if (remEl) remEl.textContent = '฿' + Math.max(0, totalCatAllocated - totalCatCash).toLocaleString();
}

function switchBreakdownView(mode) {
    const projTabBtn = document.getElementById('btn-breakdown-tab-project');
    const catTabBtn = document.getElementById('btn-breakdown-tab-category');
    const projView = document.getElementById('finance-project-breakdown-view');
    const catView = document.getElementById('finance-category-breakdown-view');
    const allocActionBtn = document.getElementById('btn-col3-action-alloc');
    const catActionBtn = document.getElementById('btn-col3-action-cat');

    if (mode === 'category') {
        if (projTabBtn) {
            projTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 transition-all flex items-center gap-1.5';
        }
        if (catTabBtn) {
            catTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-600 shadow-xs flex items-center gap-1.5';
        }
        if (projView) projView.classList.add('hidden');
        if (catView) catView.classList.remove('hidden');
        if (allocActionBtn) allocActionBtn.classList.add('hidden');
        if (catActionBtn) catActionBtn.classList.remove('hidden');
    } else {
        if (projTabBtn) {
            projTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-indigo-700 shadow-xs flex items-center gap-1.5';
        }
        if (catTabBtn) {
            catTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 transition-all flex items-center gap-1.5';
        }
        if (projView) projView.classList.remove('hidden');
        if (catView) catView.classList.add('hidden');
        if (allocActionBtn) allocActionBtn.classList.remove('hidden');
        if (catActionBtn) catActionBtn.classList.add('hidden');
    }
}

// Master Budget Adjust Modal Handlers
function openAdjustBudgetModal() {
    const mb = getMasterBudget();
    const inputBudget = document.getElementById('input-adjust-master-budget');
    const inputCash = document.getElementById('input-adjust-initial-cash');

    if (inputBudget) inputBudget.value = mb.totalBudget || 0;
    if (inputCash) inputCash.value = mb.initialCash || 0;

    calculateAdjustModalPreview();
    openFinanceModal('finance-adjust-budget-modal');
}

function calculateAdjustModalPreview() {
    const inputBudget = document.getElementById('input-adjust-master-budget');
    const totalVal = parseFloat(inputBudget ? inputBudget.value : 0) || 0;

    const mb = getMasterBudget();
    const allocations = mb.categoryAllocations || mb.projectAllocations || {};
    let sumAllocated = 0;
    Object.values(allocations).forEach(v => {
        sumAllocated += (parseFloat(v) || 0);
    });

    const unallocated = totalVal - sumAllocated;

    const totalDisp = document.getElementById('adjust-modal-total-display');
    if (totalDisp) totalDisp.textContent = '฿' + totalVal.toLocaleString();

    const allocDisp = document.getElementById('adjust-modal-allocated-display');
    if (allocDisp) allocDisp.textContent = '฿' + sumAllocated.toLocaleString();

    const unallocDisp = document.getElementById('adjust-modal-unallocated-display');
    if (unallocDisp) {
        if (unallocated >= 0) {
            unallocDisp.textContent = '฿' + unallocated.toLocaleString();
            unallocDisp.className = 'text-lg font-black text-emerald-600';
        } else {
            unallocDisp.textContent = '-฿' + Math.abs(unallocated).toLocaleString();
            unallocDisp.className = 'text-lg font-black text-red-600';
        }
    }
}

function quickAddMasterBudget(amount) {
    const inputBudget = document.getElementById('input-adjust-master-budget');
    if (!inputBudget) return;
    const current = parseFloat(inputBudget.value) || 0;
    inputBudget.value = current + amount;
    calculateAdjustModalPreview();
}

function submitAdjustBudget() {
    const inputBudget = document.getElementById('input-adjust-master-budget');
    const inputCash = document.getElementById('input-adjust-initial-cash');

    const totalBudget = parseFloat(inputBudget ? inputBudget.value : 0) || 0;
    const initialCash = parseFloat(inputCash ? inputCash.value : 0) || 0;

    if (totalBudget <= 0) {
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('กรุณาระบุงบประมาณรวมทั้งหมดที่มากกว่า 0', 'warning');
        } else {
            alert('กรุณาระบุงบประมาณรวมทั้งหมดที่มากกว่า 0');
        }
        return;
    }

    const mb = getMasterBudget();
    mb.totalBudget = totalBudget;
    mb.initialCash = initialCash;
    mb.updatedAt = new Date().toISOString();

    saveMasterBudget(mb);
    closeFinanceModal('finance-adjust-budget-modal');
    recalculateFinanceTotals();

    if (window.App && typeof App._showToast === 'function') {
        App._showToast('บันทึกการปรับยอดงบประมาณรวมสำเร็จ!', 'success');
    }
}

// Category Allocation Modal Handlers
function openAllocateBudgetModal() {
    renderCategoryAllocationList();
    openFinanceModal('finance-allocate-budget-modal');
}

function renderCategoryAllocationList() {
    const container = document.getElementById('category-allocation-list-container') || document.getElementById('project-allocation-list-container');
    if (!container) return;

    const categories = getFinanceCategories();
    const catKeys = Object.keys(categories);
    const mb = getMasterBudget();
    const allocations = mb.categoryAllocations || mb.projectAllocations || {};
    const txs = getStoredTransactions();

    const totalMasterBudget = parseFloat(mb.totalBudget) || 0;
    const totalEl = document.getElementById('alloc-modal-total-budget');
    if (totalEl) totalEl.textContent = '฿' + totalMasterBudget.toLocaleString();

    if (catKeys.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fa-solid fa-layer-group text-3xl mb-2 text-gray-300"></i>
                <p class="text-sm">ไม่พบหมวดหมู่ในระบบ</p>
                <p class="text-xs text-gray-400 mt-1">กรุณาสร้างหมวดหมู่ก่อนจัดสรรงบประมาณ</p>
            </div>
        `;
        return;
    }

    const html = catKeys.map(k => {
        const cat = categories[k];
        const allocated = (typeof allocations[k] !== 'undefined' && allocations[k] !== null)
            ? (parseFloat(allocations[k]) || 0)
            : (parseFloat(cat.defaultBudget) || 0);

        const subcategories = Array.isArray(cat.subcategories) ? cat.subcategories : [];
        const subCount = subcategories.length;
        const subBudgetSum = subcategories.reduce((s, sub) => s + (parseFloat(sub.budget) || 0), 0);

        const catTxs = txs.filter(t => t.category === k);
        const catSpent = catTxs.filter(t => t.transaction_type === 'cash' && !t.is_inflow)
                               .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const remaining = Math.max(0, allocated - catSpent);
        const usedPct = allocated > 0 ? Math.min(100, Math.round((catSpent / allocated) * 100)) : 0;

        return `
            <div class="p-3.5 bg-white border border-gray-200 rounded-2xl shadow-2xs hover:border-indigo-300 transition-all">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="w-full sm:w-2/5 flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl ${cat.bgClass || 'bg-indigo-50'} ${cat.textClass || 'text-indigo-600'} flex items-center justify-center shrink-0 font-bold text-sm" style="${cat.color ? `background-color: ${cat.color}18; color: ${cat.color};` : ''}">
                            <i class="fa-solid ${cat.icon || 'fa-box'}"></i>
                        </div>
                        <div class="truncate">
                            <h4 class="text-sm font-bold text-gray-800 truncate">${cat.name}</h4>
                            <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span class="text-[10px] text-gray-400 font-medium">รหัส: ${cat.id || k}</span>
                                ${subCount > 0 ? `
                                    <span class="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.2 font-medium">
                                        <i class="fa-solid fa-sitemap text-[8px]"></i> ย่อย ${subCount} รายการ (฿${subBudgetSum.toLocaleString()})
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="w-full sm:w-1/4 text-left sm:text-center">
                        <span class="text-xs font-semibold text-gray-600">ใช้ไป ฿${catSpent.toLocaleString()}</span>
                        <span class="text-[10px] text-gray-400 block">คงเหลือ ฿${remaining.toLocaleString()} (${100 - usedPct}%)</span>
                    </div>

                    <div class="w-full sm:w-1/3 flex items-center gap-2 justify-end">
                        <button type="button" onclick="openSubcategoryAllocationModal('${k}')" class="px-2.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0" title="คลิกเพื่อจัดการและแบ่งงบย่อยในหมวดหมู่นี้">
                            <i class="fa-solid fa-sitemap text-[11px]"></i>
                            <span>ย่อย (${subCount})</span>
                        </button>
                        <div class="relative w-full max-w-[170px]">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">฿</span>
                            <input type="number" step="any" min="0" 
                                class="category-alloc-input project-alloc-input w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-right" 
                                data-cat-id="${k}" 
                                data-proj-id="${k}"
                                value="${allocated > 0 ? allocated : ''}" 
                                placeholder="0.00" 
                                oninput="calculateAllocationPreview()">
                        </div>
                    </div>
                </div>

                <div class="w-full bg-gray-100 h-1 rounded-full overflow-hidden mt-2.5">
                    <div class="bg-indigo-500 h-full transition-all duration-300" style="width: ${usedPct}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    calculateAllocationPreview();
}

function calculateAllocationPreview() {
    const inputs = document.querySelectorAll('.category-alloc-input, .project-alloc-input');
    const mb = getMasterBudget();
    const totalMaster = parseFloat(mb.totalBudget) || 0;

    let sumAllocated = 0;
    inputs.forEach(inp => {
        sumAllocated += (parseFloat(inp.value) || 0);
    });

    const remaining = totalMaster - sumAllocated;

    const sumAllocEl = document.getElementById('alloc-modal-sum-allocated');
    if (sumAllocEl) sumAllocEl.textContent = '฿' + sumAllocated.toLocaleString();

    const remEl = document.getElementById('alloc-modal-remaining');
    if (remEl) {
        if (remaining >= 0) {
            remEl.textContent = '฿' + remaining.toLocaleString();
            remEl.className = 'text-base sm:text-lg font-black text-emerald-600';
        } else {
            remEl.textContent = '-฿' + Math.abs(remaining).toLocaleString() + ' (เกินงบรวม)';
            remEl.className = 'text-base sm:text-lg font-black text-red-600';
        }
    }
}

function distributeBudgetEqually() {
    const inputs = document.querySelectorAll('.category-alloc-input, .project-alloc-input');
    if (inputs.length === 0) return;

    const mb = getMasterBudget();
    const totalMaster = parseFloat(mb.totalBudget) || 0;
    const share = Math.floor(totalMaster / inputs.length);

    inputs.forEach(inp => {
        inp.value = share;
    });

    calculateAllocationPreview();
}

function clearAllCategoryAllocations() {
    const inputs = document.querySelectorAll('.category-alloc-input, .project-alloc-input');
    inputs.forEach(inp => {
        inp.value = '';
    });
    calculateAllocationPreview();
}
const clearAllProjectAllocations = clearAllCategoryAllocations;

async function submitCategoryAllocation() {
    const inputs = document.querySelectorAll('.category-alloc-input, .project-alloc-input');
    const mb = getMasterBudget();
    const newAllocations = {};
    const categories = getFinanceCategories();

    let sumAllocated = 0;
    inputs.forEach(inp => {
        const catId = inp.getAttribute('data-cat-id') || inp.getAttribute('data-proj-id');
        const val = parseFloat(inp.value) || 0;
        if (catId) {
            newAllocations[catId] = val;
            sumAllocated += val;
            if (categories[catId]) {
                categories[catId].defaultBudget = val;
            }
        }
    });

    mb.categoryAllocations = newAllocations;
    mb.projectAllocations = newAllocations; // for backwards compatibility
    mb.updatedAt = new Date().toISOString();

    saveMasterBudget(mb);
    saveFinanceCategories(categories);

    // Sync categories with defaultBudget to Supabase if client is available
    try {
        if (window.conworkSupabase && typeof window.conworkSupabase.saveFinanceCategory === 'function') {
            for (const catId of Object.keys(newAllocations)) {
                if (categories[catId]) {
                    window.conworkSupabase.saveFinanceCategory({
                        id: catId,
                        name: categories[catId].name,
                        icon: categories[catId].icon,
                        color: categories[catId].color,
                        default_budget: newAllocations[catId]
                    }).catch(e => console.warn('Sync category budget error:', e));
                }
            }
        }
    } catch (e) {
        console.warn('Supabase category budget sync failed:', e);
    }

    closeFinanceModal('finance-allocate-budget-modal');
    recalculateFinanceTotals();

    if (window.App && typeof App._showToast === 'function') {
        App._showToast(`บันทึกการจัดสรรงบประมาณ ${inputs.length} หมวดหมู่ เรียบร้อยแล้ว!`, 'success');
    }
}
const submitProjectAllocation = submitCategoryAllocation;
const renderProjectAllocationList = renderCategoryAllocationList;

// ==========================================
// Subcategory Budget Allocation Modal Handlers
// ==========================================
let currentSuballocCategoryKey = null;

function openSubcategoryAllocationModal(catKey) {
    const categories = getFinanceCategories();
    const cat = categories[catKey];
    if (!cat) {
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('ไม่พบข้อมูลหมวดหมู่นี้', 'error');
        }
        return;
    }

    currentSuballocCategoryKey = catKey;

    const nameEl = document.getElementById('suballoc-modal-cat-name') || document.getElementById('suballoc-category-name');
    if (nameEl) nameEl.textContent = cat.name;

    const iconEl = document.getElementById('suballoc-modal-cat-icon');
    if (iconEl && cat.icon) iconEl.className = `fa-solid ${cat.icon}`;

    const iconContainer = document.getElementById('suballoc-modal-cat-icon-container');
    if (iconContainer && cat.color) {
        iconContainer.style.backgroundColor = cat.color;
    }

    const hiddenCatKey = document.getElementById('suballoc-modal-current-cat-key');
    if (hiddenCatKey) hiddenCatKey.value = catKey;

    // Get current budget allocated to this category
    const mb = getMasterBudget();
    const allocations = mb.categoryAllocations || mb.projectAllocations || {};
    const catBudget = (typeof allocations[catKey] !== 'undefined' && allocations[catKey] !== null)
        ? (parseFloat(allocations[catKey]) || 0)
        : (parseFloat(cat.defaultBudget) || 0);

    const parentBudgetEl = document.getElementById('suballoc-modal-cat-budget') || document.getElementById('suballoc-parent-budget');
    if (parentBudgetEl) {
        parentBudgetEl.textContent = '฿' + catBudget.toLocaleString();
        parentBudgetEl.setAttribute('data-parent-budget', catBudget);
    }

    renderSubcategoryAllocationList(cat);
    openFinanceModal('finance-subcategory-budget-modal');
}

function renderSubcategoryAllocationList(cat) {
    const container = document.getElementById('subcategory-allocation-list-container');
    if (!container) return;

    const subcategories = Array.isArray(cat.subcategories) ? cat.subcategories : [];
    if (subcategories.length === 0) {
        container.innerHTML = createSubcategoryRowHTML({ id: 'sub_' + Date.now(), name: '', budget: 0 }, 0);
    } else {
        container.innerHTML = subcategories.map((sub, idx) => createSubcategoryRowHTML(sub, idx)).join('');
    }

    calculateSuballocationPreview();
}

function createSubcategoryRowHTML(sub = {}, idx = 0) {
    const subId = sub.id || ('sub_' + (Date.now() + Math.floor(Math.random() * 1000)));
    const name = sub.name ? escapeHtml(sub.name) : '';
    const budgetVal = (typeof sub.budget !== 'undefined' && sub.budget !== null && sub.budget > 0) ? sub.budget : '';

    return `
        <div class="subcategory-alloc-row flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50/80 hover:bg-gray-100/70 border border-gray-200 rounded-xl transition-all" data-sub-id="${subId}">
            <div class="text-gray-400 font-medium text-xs w-6 text-center shrink-0">
                <i class="fa-solid fa-folder-tree text-indigo-400"></i>
            </div>
            <div class="flex-1 min-w-[140px]">
                <input type="text" 
                    class="subcat-name-input w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white transition-all" 
                    value="${name}" 
                    placeholder="ชื่อหมวดหมู่ย่อย (เช่น ค่าอาหาร, อุปกรณ์)...">
            </div>
            <div class="relative w-28 sm:w-36 shrink-0">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">฿</span>
                <input type="number" step="any" min="0" 
                    class="subcat-budget-input w-full border border-gray-300 rounded-lg pl-6 pr-2 py-1.5 text-xs sm:text-sm font-bold text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white transition-all text-right" 
                    value="${budgetVal}" 
                    placeholder="0.00" 
                    oninput="calculateSuballocationPreview()">
            </div>
            <button type="button" onclick="removeSubcategoryRow(this)" class="w-8 h-8 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center shrink-0" title="ลบรายการย่อยนี้">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        </div>
    `;
}

function addSubcategoryRow() {
    const container = document.getElementById('subcategory-allocation-list-container');
    if (!container) return;

    const rowId = 'sub_' + Date.now();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createSubcategoryRowHTML({ id: rowId, name: '', budget: 0 });
    container.appendChild(tempDiv.firstElementChild);

    calculateSuballocationPreview();
}

function removeSubcategoryRow(btn) {
    const row = btn.closest('.subcategory-alloc-row');
    if (!row) return;

    const container = document.getElementById('subcategory-allocation-list-container');
    const rows = container.querySelectorAll('.subcategory-alloc-row');
    if (rows.length <= 1) {
        const nameInput = row.querySelector('.subcat-name-input');
        const budgetInput = row.querySelector('.subcat-budget-input');
        if (nameInput) nameInput.value = '';
        if (budgetInput) budgetInput.value = '';
    } else {
        row.remove();
    }

    calculateSuballocationPreview();
}

function calculateSuballocationPreview() {
    const parentBudgetEl = document.getElementById('suballoc-modal-cat-budget') || document.getElementById('suballoc-parent-budget');
    const parentBudget = parentBudgetEl ? (parseFloat(parentBudgetEl.getAttribute('data-parent-budget')) || 0) : 0;

    const rows = document.querySelectorAll('.subcategory-alloc-row');
    let sumAllocated = 0;
    rows.forEach(r => {
        const bInput = r.querySelector('.subcat-budget-input');
        const val = parseFloat(bInput ? bInput.value : 0) || 0;
        sumAllocated += val;
    });

    const remaining = parentBudget - sumAllocated;

    const sumEl = document.getElementById('suballoc-modal-sum-allocated') || document.getElementById('suballoc-sum-allocated');
    if (sumEl) sumEl.textContent = '฿' + sumAllocated.toLocaleString();

    const remEl = document.getElementById('suballoc-modal-remaining') || document.getElementById('suballoc-remaining');
    if (remEl) {
        if (remaining >= 0) {
            remEl.textContent = '฿' + remaining.toLocaleString();
            remEl.className = 'text-base sm:text-lg font-black text-emerald-600';
        } else {
            remEl.textContent = '-฿' + Math.abs(remaining).toLocaleString() + ' (เกินงบหมวด)';
            remEl.className = 'text-base sm:text-lg font-black text-red-600';
        }
    }
}

function distributeSubcategoryBudgetEqually() {
    const rows = document.querySelectorAll('.subcategory-alloc-row');
    if (rows.length === 0) return;

    const parentBudgetEl = document.getElementById('suballoc-modal-cat-budget') || document.getElementById('suballoc-parent-budget');
    const parentBudget = parentBudgetEl ? (parseFloat(parentBudgetEl.getAttribute('data-parent-budget')) || 0) : 0;
    const share = Math.floor(parentBudget / rows.length);

    rows.forEach(r => {
        const bInput = r.querySelector('.subcat-budget-input');
        if (bInput) bInput.value = share;
    });

    calculateSuballocationPreview();
}

function clearAllSubcategoryAllocations() {
    const rows = document.querySelectorAll('.subcategory-alloc-row');
    rows.forEach(r => {
        const bInput = r.querySelector('.subcat-budget-input');
        if (bInput) bInput.value = '';
    });
    calculateSuballocationPreview();
}

function fitCategoryBudgetToSubcategories() {
    const rows = document.querySelectorAll('.subcategory-alloc-row');
    let sumAllocated = 0;
    rows.forEach(r => {
        const bInput = r.querySelector('.subcat-budget-input');
        sumAllocated += (parseFloat(bInput ? bInput.value : 0) || 0);
    });

    const parentBudgetEl = document.getElementById('suballoc-modal-cat-budget') || document.getElementById('suballoc-parent-budget');
    if (parentBudgetEl) {
        parentBudgetEl.textContent = '฿' + sumAllocated.toLocaleString();
        parentBudgetEl.setAttribute('data-parent-budget', sumAllocated);
    }

    if (currentSuballocCategoryKey) {
        const catInput = document.querySelector(`.category-alloc-input[data-cat-id="${currentSuballocCategoryKey}"]`);
        if (catInput) {
            catInput.value = sumAllocated;
            calculateAllocationPreview();
        }
    }

    calculateSuballocationPreview();
    if (window.App && typeof App._showToast === 'function') {
        App._showToast(`ปรับงบประมาณหมวดหลักเป็น ฿${sumAllocated.toLocaleString()} เรียบร้อยแล้ว`, 'info');
    }
}

async function submitSubcategoryAllocation() {
    if (!currentSuballocCategoryKey) return;

    const categories = getFinanceCategories();
    const cat = categories[currentSuballocCategoryKey];
    if (!cat) return;

    const rows = document.querySelectorAll('.subcategory-alloc-row');
    const subcategories = [];
    let sumSubBudget = 0;

    rows.forEach((r, index) => {
        const subId = r.getAttribute('data-sub-id') || ('sub_' + Date.now() + '_' + index);
        const nameInput = r.querySelector('.subcat-name-input');
        const budgetInput = r.querySelector('.subcat-budget-input');

        const name = nameInput ? nameInput.value.trim() : '';
        const budget = budgetInput ? (parseFloat(budgetInput.value) || 0) : 0;

        if (name) {
            subcategories.push({
                id: subId,
                name: name,
                budget: budget
            });
            sumSubBudget += budget;
        }
    });

    cat.subcategories = subcategories;

    const parentBudgetEl = document.getElementById('suballoc-modal-cat-budget') || document.getElementById('suballoc-parent-budget');
    const parentBudget = parentBudgetEl ? (parseFloat(parentBudgetEl.getAttribute('data-parent-budget')) || 0) : 0;
    if (sumSubBudget > parentBudget) {
        cat.defaultBudget = sumSubBudget;
        const mb = getMasterBudget();
        if (!mb.categoryAllocations) mb.categoryAllocations = {};
        mb.categoryAllocations[currentSuballocCategoryKey] = sumSubBudget;
        saveMasterBudget(mb);
    }

    saveFinanceCategories(categories);

    try {
        if (window.conworkSupabase && typeof window.conworkSupabase.saveFinanceCategory === 'function') {
            await window.conworkSupabase.saveFinanceCategory({
                id: currentSuballocCategoryKey,
                name: cat.name,
                icon: cat.icon,
                color: cat.color,
                default_budget: cat.defaultBudget,
                subcategories: subcategories
            });
        }
    } catch (e) {
        console.warn('Sync subcategories to Supabase failed:', e);
    }

    closeFinanceModal('finance-subcategory-budget-modal');

    renderCategoryAllocationList();
    renderFinanceCategorySelects();
    recalculateFinanceTotals();

    if (window.App && typeof App._showToast === 'function') {
        App._showToast(`บันทึกการแบ่งงบหมวดหมู่ย่อย ${subcategories.length} รายการ เรียบร้อยแล้ว!`, 'success');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function filterTransactionsByProject(projectId) {
    const tableRows = document.querySelectorAll('#view-accounting tbody tr');
    const tabs = document.querySelectorAll('#view-accounting .border-b .px-6');
    if (tabs.length > 0) tabs[0].click();

    tableRows.forEach(row => {
        if (!projectId || projectId === 'all') {
            row.style.display = '';
        } else if (row._txData) {
            row.style.display = (String(row._txData.project_id) === String(projectId)) ? '' : 'none';
        } else {
            row.style.display = '';
        }
    });

    scrollToTable();
}

function filterTransactionsByCategory(catKey) {
    const tableRows = document.querySelectorAll('#view-accounting tbody tr');
    const tabs = document.querySelectorAll('#view-accounting .border-b .px-6');
    if (tabs.length > 0) tabs[0].click();

    const categories = getFinanceCategories();
    const meta = categories[catKey];
    tableRows.forEach(row => {
        const catCell = row.querySelector('td:nth-child(3)');
        if (!catCell) return;
        if (!meta || catKey === 'all') {
            row.style.display = '';
        } else if (row._txData) {
            row.style.display = (row._txData.category === catKey) ? '' : 'none';
        } else {
            const matches = catCell.textContent.includes(meta.name) || (catKey === 'welfare' && catCell.textContent.includes('สวัสดิการ'));
            row.style.display = matches ? '' : 'none';
        }
    });

    scrollToTable();
}

function showFinanceDetailModal(title, iconClass, items) {
    let modal = document.getElementById('finance-summary-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'finance-summary-detail-modal';
        modal.className = 'fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
                <div class="flex items-center justify-between pb-4 border-b border-gray-100">
                    <h3 id="finance-detail-modal-title" class="text-lg font-bold text-gray-800 flex items-center gap-2"></h3>
                    <button onclick="document.getElementById('finance-summary-detail-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600 p-1"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div id="finance-detail-modal-body" class="py-4 space-y-3 text-sm text-gray-600"></div>
                <div class="pt-4 border-t border-gray-100 flex justify-end">
                    <button onclick="document.getElementById('finance-summary-detail-modal').classList.add('hidden')" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm">ปิด</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titleEl = document.getElementById('finance-detail-modal-title');
    const bodyEl = document.getElementById('finance-detail-modal-body');
    if (titleEl) titleEl.innerHTML = `<i class="${iconClass}"></i> ${title}`;
    if (bodyEl) {
        bodyEl.innerHTML = items.map(item => `
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span class="font-medium text-gray-700">${item.label}</span>
                <span class="font-bold ${item.highlight || 'text-gray-900'}">${item.value}</span>
            </div>
        `).join('');
    }
    modal.classList.remove('hidden');
}

function loadStoredTransactionsToTable() {
    const tbody = document.querySelector('#view-accounting tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const txs = getStoredTransactions();
    if (txs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-12 text-gray-400">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i class="fa-solid fa-receipt text-3xl text-gray-300 mb-1"></i>
                        <p class="text-sm font-medium text-gray-500">ยังไม่มีรายการบันทึกทางการเงิน</p>
                        <p class="text-xs text-gray-400">กดปุ่ม "+ เพิ่มรายการ" หรือ "+ ขอใช้งบ" เพื่อเริ่มต้นบันทึกข้อมูล</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        txs.forEach(tx => {
            insertTransactionRow(tx, false);
        });
    }
    recalculateFinanceTotals();
}

document.addEventListener('DOMContentLoaded', () => {
    // Wait a brief moment to ensure all elements are rendered
    setTimeout(() => {
        initFinanceDashboard();
    }, 500);
});

function initFinanceDashboard() {
    renderFinanceCategorySelects();
    renderCategoryManagementList();
    renderFinanceProjectSelects();
    loadStoredTransactionsToTable();
    syncFinanceWithSupabase();

    // 1. Transaction Tabs Filtering
    const tabs = document.querySelectorAll('#view-accounting .border-b .px-6');
    const tableRows = document.querySelectorAll('#view-accounting tbody tr');

    if (tabs.length > 0) {
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                // Reset all tabs
                tabs.forEach(t => {
                    t.classList.remove('text-blue-600', 'border-blue-600');
                    t.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
                    t.style.borderBottomWidth = '0px';
                });

                // Set active tab
                tab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
                tab.classList.add('text-blue-600', 'border-blue-600');
                tab.style.borderBottomWidth = '2px';

                // Filter table rows
                const filterType = index; // 0: All, 1: Credit, 2: Cash, 3: Pending
                
                tableRows.forEach(row => {
                    if (filterType === 0) {
                        row.style.display = ''; // Show all
                    } else if (filterType === 1) {
                        // Credit
                        const typeCell = row.querySelector('td:nth-child(4)')?.innerText || '';
                        row.style.display = typeCell.includes('Credit') ? '' : 'none';
                    } else if (filterType === 2) {
                        // Cash
                        const typeCell = row.querySelector('td:nth-child(4)')?.innerText || '';
                        row.style.display = typeCell.includes('Cash') ? '' : 'none';
                    } else if (filterType === 3) {
                        // Pending
                        const statusCell = row.querySelector('td:nth-child(6)')?.innerText || '';
                        row.style.display = statusCell.includes('รออนุมัติ') ? '' : 'none';
                    }
                });
            });
        });
        
        // Ensure first tab has correct border
        tabs[0].style.borderBottomWidth = '2px';
    }

    // 2. Summary Cards Click
    const summaryCards = document.querySelectorAll('#view-accounting .grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5 > div');
    if (summaryCards.length === 5) {
        // Card 1: Master Budget -> Open Adjust Modal directly
        summaryCards[0].addEventListener('click', () => {
            openAdjustBudgetModal();
        });
        
        // Card 2: Cash Used -> Click triggers Tab 2 (Cash)
        summaryCards[1].addEventListener('click', () => {
            tabs[2].click();
            scrollToTable();
        });

        // Card 3: Cash Remaining -> Sleek detail modal
        summaryCards[2].addEventListener('click', () => {
            const txs = getStoredTransactions();
            const cashSpent = txs.filter(t => t.transaction_type === 'cash').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const master = getMasterBudget();
            const initialCash = master.initial_cash || 10000;
            const remaining = Math.max(0, initialCash - cashSpent);
            showFinanceDetailModal('รายละเอียดเงินสดคงเหลือ', 'fa-solid fa-money-bill-wave text-green-600', [
                { label: 'เงินสดตั้งต้น (Initial Balance)', value: '฿' + initialCash.toLocaleString() },
                { label: 'ยอดเงินเข้า (Cash Inflow)', value: '฿0', highlight: 'text-green-600' },
                { label: 'ยอดเงินออก / จ่ายจริง (Cash Used)', value: '-฿' + cashSpent.toLocaleString(), highlight: 'text-red-500' },
                { label: 'เงินสดคงเหลือสุทธิ (Remaining Cash)', value: '฿' + remaining.toLocaleString(), highlight: 'text-emerald-600 font-extrabold text-base' }
            ]);
        });

        // Card 4: Pending -> Click triggers Tab 3 (Pending)
        summaryCards[3].addEventListener('click', () => {
            tabs[3].click();
            scrollToTable();
        });

        // Card 5: Approved -> Sleek detail modal
        summaryCards[4].addEventListener('click', () => {
            const txs = getStoredTransactions();
            const approvedTxs = txs.filter(t => t.status === 'จ่ายแล้ว' || t.status === 'อนุมัติแล้ว');
            const totalApproved = approvedTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            showFinanceDetailModal('รายละเอียดงบประมาณที่อนุมัติแล้ว', 'fa-solid fa-circle-check text-blue-600', [
                { label: 'จำนวนรายการที่อนุมัติ', value: `${approvedTxs.length} รายการ` },
                { label: 'ยอดรวมที่อนุมัติแล้วทั้งหมด', value: '฿' + totalApproved.toLocaleString(), highlight: 'text-blue-600 font-extrabold text-base' },
                { label: 'สถานะการดำเนินงาน', value: 'พร้อมสำหรับการเบิกจ่ายเรียบร้อย', highlight: 'text-emerald-600' }
            ]);
        });
        
        // Make cards look clickable
        summaryCards.forEach(card => {
            card.classList.add('cursor-pointer');
        });
    }

    // 3. Header Buttons
    const headerButtons = document.querySelectorAll('#view-accounting .flex.items-center.gap-3 > button');
    if (headerButtons.length >= 3) {
        // Add Transaction
        headerButtons[0].addEventListener('click', () => {
            openFinanceModal('finance-add-modal');
        });
        
        // Request Budget
        headerButtons[1].addEventListener('click', () => {
            openFinanceModal('finance-request-modal');
        });
        
        // Export Report
        headerButtons[2].addEventListener('click', () => {
            openFinanceModal('finance-export-modal');
        });
    }

    // 4. "ดูรายละเอียดทั้งหมด" links
    const viewAllLinks = document.querySelectorAll('#view-accounting button.text-blue-600, #view-accounting button.text-green-600');
    viewAllLinks.forEach(link => {
        if (link.innerText.includes('ดูรายละเอียดทั้งหมด')) {
            link.addEventListener('click', (e) => {
                if (link.classList.contains('text-blue-600')) {
                    // Credit Donut view all
                    tabs[1].click();
                    scrollToTable();
                } else if (link.classList.contains('text-green-600')) {
                    // Cash Donut view all
                    tabs[2].click();
                    scrollToTable();
                }
            });
        }
    });

    // 5. Tooltip interaction for Progress bar
    const progressBarContainer = document.querySelector('#view-accounting .h-8.rounded-lg.overflow-hidden');
    if (progressBarContainer) {
        progressBarContainer.addEventListener('click', () => {
            const txs = getStoredTransactions();
            const cashSpent = txs.filter(t => t.transaction_type === 'cash').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const master = getMasterBudget();
            const totalBudget = master.total_budget || 20000;
            const pct = totalBudget > 0 ? ((cashSpent / totalBudget) * 100).toFixed(1) : '0.0';
            const allocated = Object.values(master.project_allocations || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            const unallocated = Math.max(0, totalBudget - allocated);
            showFinanceDetailModal('อัตราการใช้งบประมาณ (Budget Utilization)', 'fa-solid fa-chart-pie text-blue-600', [
                { label: 'งบประมาณรวมทั้งหมด (Master Budget)', value: '฿' + totalBudget.toLocaleString(), highlight: 'text-blue-600 font-extrabold text-base' },
                { label: 'งบที่จัดสรรให้โครงการแล้ว (Allocated)', value: '฿' + allocated.toLocaleString() },
                { label: 'งบคงเหลือส่วนกลางสำรอง (Unallocated)', value: '฿' + unallocated.toLocaleString(), highlight: 'text-emerald-600' },
                { label: 'ยอดเงินสดที่ใช้จ่ายจริง (Cash Spent)', value: '฿' + cashSpent.toLocaleString(), highlight: 'text-amber-600' },
                { label: 'อัตราการใช้เงินรวม (Utilization Rate)', value: pct + '%' }
            ]);
        });
        progressBarContainer.classList.add('cursor-pointer');
    }

    // 6. Transaction Detail Side Panel
    const detailButtons = document.querySelectorAll('#view-accounting tbody button');
    detailButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                const title = row.querySelector('td:nth-child(2)').innerText;
                const amount = row.querySelector('td:nth-child(5)').innerText;
                const typeCell = row.querySelector('td:nth-child(4)').innerText;
                const statusCell = row.querySelector('td:nth-child(6)').innerText;
                const categoryCell = row.querySelector('td:nth-child(3)').innerHTML;
                const dateCell = row.querySelector('td:nth-child(1)').innerText;
                const userCell = row.querySelector('td:nth-child(7)').innerHTML;
                
                openFinancePanel(title, amount, typeCell, statusCell, categoryCell, dateCell, userCell);
            }
        });
    });
}

function scrollToTable() {
    const tableContainer = document.querySelector('#view-accounting .bg-white.rounded-2xl.border.border-gray-100.overflow-hidden.flex.flex-col.flex-1');
    if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Modal Functions
function openFinanceModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (modalId === 'finance-add-modal' || modalId === 'finance-request-modal') {
            renderFinanceCategorySelects();
            renderFinanceProjectSelects();
        }
        modal.classList.remove('hidden');
    }
}

function closeFinanceModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function toggleFinanceAddType() {
    const type = document.querySelector('input[name="finance_add_type"]:checked').value;
    const creditField = document.getElementById('field-credit-owner');
    const cashField = document.getElementById('field-cash-payer');
    const dateLabel = document.getElementById('label-date-add');
    
    if (type === 'credit') {
        creditField.classList.remove('hidden');
        cashField.classList.add('hidden');
        dateLabel.innerHTML = 'วันที่วางแผน/ขออนุมัติ <span class="text-red-500">*</span>';
    } else {
        creditField.classList.add('hidden');
        cashField.classList.remove('hidden');
        dateLabel.innerHTML = 'วันที่เกิดรายการจริง <span class="text-red-500">*</span>';
    }
}

// Helper to resize/compress images for fast storage & previews
function resizeImageIfNeeded(file, maxDimension = 1280, quality = 0.82) {
    return new Promise((resolve) => {
        if (!file.type.includes('image')) {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ dataUrl: e.target.result, size: (file.size / 1024 / 1024).toFixed(2) + ' MB' });
            reader.readAsDataURL(file);
            return;
        }

        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                const approxKb = Math.round((compressedDataUrl.length * 0.75) / 1024);
                const approxSize = approxKb > 1024 ? (approxKb / 1024).toFixed(2) + ' MB' : approxKb + ' KB';
                resolve({ dataUrl: compressedDataUrl, size: approxSize });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Side Panel Functions
function openFinancePanel(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
    const panel = document.getElementById('finance-detail-panel');
    const content = document.getElementById('finance-detail-content');
    if (!panel || !content) return;

    let tx;
    if (typeof arg1 === 'object' && arg1 !== null) {
        tx = arg1;
    } else {
        tx = arg8 || {
            title: arg1,
            amount: arg2,
            transaction_type: (arg3 && arg3.includes('Credit')) ? 'credit' : 'cash',
            status: arg4,
            categoryHTML: arg5,
            transaction_date: arg6,
            userHTML: arg7
        };
    }

    const title = tx.title || 'รายละเอียดรายการ';
    const amountVal = typeof tx.amount === 'number' 
        ? '฿' + tx.amount.toLocaleString(undefined, { minimumFractionDigits: 0 }) 
        : (tx.amount ? (String(tx.amount).startsWith('฿') ? tx.amount : '฿' + tx.amount) : '฿0');
    
    const isCredit = tx.transaction_type === 'credit' || (tx.type && String(tx.type).includes('Credit'));
    const statusText = tx.status || (isCredit ? 'รออนุมัติ' : 'จ่ายแล้ว');

    // Title & Amount
    const titleEl = document.getElementById('panel-title');
    if (titleEl) titleEl.innerText = title;

    const amountEl = document.getElementById('panel-amount');
    if (amountEl) amountEl.innerText = amountVal;

    // Badges & Icon
    const badgesContainer = document.getElementById('panel-badges');
    const panelIcon = document.getElementById('panel-icon');
    if (badgesContainer) {
        badgesContainer.innerHTML = '';
        if (isCredit) {
            badgesContainer.innerHTML += `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">Credit</span>`;
            if (panelIcon) {
                panelIcon.innerHTML = '<i class="fa-solid fa-wallet"></i>';
                panelIcon.className = 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3 text-xl';
            }
        } else {
            badgesContainer.innerHTML += `<span class="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg text-xs font-bold">Cash</span>`;
            if (panelIcon) {
                panelIcon.innerHTML = '<i class="fa-solid fa-hand-holding-dollar"></i>';
                panelIcon.className = 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 mb-3 text-xl';
            }
        }

        if (statusText.includes('รออนุมัติ') || statusText === 'pending') {
            badgesContainer.innerHTML += `<span class="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1 rounded-lg text-xs font-bold">รออนุมัติ</span>`;
        } else if (statusText.includes('อนุมัติแล้ว') || statusText === 'approved') {
            badgesContainer.innerHTML += `<span class="bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">อนุมัติแล้ว</span>`;
        } else {
            badgesContainer.innerHTML += `<span class="bg-green-100 text-green-700 border border-green-200 px-3 py-1 rounded-lg text-xs font-bold">จ่ายแล้ว</span>`;
        }
    }

    const approvalActions = document.getElementById('panel-approval-actions');
    if (approvalActions) {
        if (statusText.includes('รออนุมัติ') || statusText === 'pending') {
            approvalActions.classList.remove('hidden');
        } else {
            approvalActions.classList.add('hidden');
        }
    }

    // Project
    const projectEl = document.getElementById('panel-project');
    if (projectEl) {
        if (tx.project_id) {
            const pObj = getFinanceProjects().find(p => String(p.id) === String(tx.project_id));
            projectEl.innerHTML = `<i class="fa-solid fa-folder-open text-xs text-indigo-500"></i> ${pObj ? pObj.name : 'โครงการ #' + tx.project_id}`;
        } else {
            projectEl.innerHTML = `<span class="text-gray-400 font-normal">ส่วนกลาง / ไม่ระบุโครงการ</span>`;
        }
    }

    // Category
    const catEl = document.getElementById('panel-category');
    if (catEl) {
        if (tx.categoryHTML) {
            catEl.innerHTML = tx.categoryHTML;
        } else {
            const categories = getFinanceCategories();
            const meta = categories[tx.category] || categories['other'] || { name: tx.category || 'อื่นๆ', icon: 'fa-box', textClass: 'text-gray-500' };
            const subBadge = tx.subcategory_name ? `<span class="ml-1.5 text-[10px] font-normal text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5"><i class="fa-solid fa-sitemap text-[8px] mr-1"></i>${tx.subcategory_name}</span>` : '';
            catEl.innerHTML = `<i class="fa-solid ${meta.icon || 'fa-box'} ${meta.textClass || ''}" style="${!meta.textClass && meta.color ? 'color: ' + meta.color : ''}"></i> ${meta.name} ${subBadge}`;
        }
    }

    // Date
    const dateEl = document.getElementById('panel-date');
    if (dateEl) {
        if (tx.date) {
            dateEl.innerText = tx.date;
        } else if (tx.transaction_date) {
            dateEl.innerText = new Date(tx.transaction_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } else {
            dateEl.innerText = '-';
        }
    }

    // User
    const userEl = document.getElementById('panel-user');
    if (userEl) {
        if (tx.userHTML) {
            userEl.innerHTML = tx.userHTML;
        } else {
            const author = tx.author || 'คุณ (Me)';
            userEl.innerText = author;
        }
    }

    // Description
    const descEl = document.getElementById('panel-description');
    if (descEl) {
        descEl.innerText = tx.description || 'ไม่มีรายละเอียดเพิ่มเติม';
    }

    // Attachment / Image Preview
    const attachContainer = document.getElementById('panel-attachment-container');
    if (attachContainer) {
        const att = tx.attachment;
        if (att && (att.dataUrl || att.url || att.name)) {
            const fileUrl = att.dataUrl || att.url || '#';
            const isImage = (att.type && att.type.includes('image')) || 
                            (att.dataUrl && att.dataUrl.startsWith('data:image')) || 
                            (att.name && /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name));
            
            if (isImage) {
                attachContainer.innerHTML = `
                    <div class="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all">
                        <div class="relative group cursor-pointer overflow-hidden bg-gray-100 max-h-64 flex items-center justify-center p-1" onclick="window.open('${fileUrl}', '_blank')">
                            <img src="${fileUrl}" alt="${att.name || 'รูปภาพหลักฐาน'}" class="w-full h-auto object-contain max-h-60 rounded-xl group-hover:scale-[1.02] transition-transform duration-300">
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold rounded-xl backdrop-blur-[2px]">
                                <i class="fa-solid fa-magnifying-glass-plus text-base"></i> คลิกเพื่อดูรูปขนาดเต็ม
                            </div>
                        </div>
                        <div class="p-3 flex items-center justify-between bg-white border-t border-gray-100">
                            <div class="flex items-center gap-2.5 truncate">
                                <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <i class="fa-solid fa-file-image"></i>
                                </div>
                                <div class="truncate">
                                    <p class="text-xs font-bold text-gray-800 truncate max-w-[190px]">${att.name || 'รูปภาพหลักฐาน'}</p>
                                    <p class="text-[10px] text-gray-400">${att.size || 'รูปภาพแนบ'}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <label class="cursor-pointer text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors relative" title="เปลี่ยนรูปภาพ">
                                    <i class="fa-solid fa-arrow-rotate-right"></i>
                                    <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" onchange="handleSidePanelAttachmentUpload(this, '${tx.id}')">
                                </label>
                                <a href="${fileUrl}" download="${att.name || 'image.png'}" target="_blank" class="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="ดาวน์โหลด">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                attachContainer.innerHTML = `
                    <div class="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden p-3.5 hover:border-blue-200 transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 text-xl">
                                <i class="fa-solid fa-file-pdf"></i>
                            </div>
                            <div class="flex-1 truncate">
                                <p class="text-xs font-bold text-gray-800 hover:text-blue-700 truncate cursor-pointer" onclick="window.open('${fileUrl}', '_blank')">${att.name || 'เอกสารแนบ.pdf'}</p>
                                <p class="text-[10px] text-gray-400 mt-0.5">${att.size || 'เอกสารแนบ'}</p>
                            </div>
                            <div class="flex items-center gap-1">
                                <label class="cursor-pointer text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="เปลี่ยนไฟล์">
                                    <i class="fa-solid fa-arrow-rotate-right"></i>
                                    <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" onchange="handleSidePanelAttachmentUpload(this, '${tx.id}')">
                                </label>
                                <a href="${fileUrl}" download="${att.name || 'document.pdf'}" target="_blank" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="ดาวน์โหลด">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            attachContainer.innerHTML = `
                <div class="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-300 text-center hover:bg-blue-50/50 hover:border-blue-300 transition-colors relative group cursor-pointer">
                    <input type="file" class="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" onchange="handleSidePanelAttachmentUpload(this, '${tx.id}')">
                    <div class="flex items-center justify-center gap-2 text-blue-600 text-xs font-semibold group-hover:scale-105 transition-transform">
                        <i class="fa-solid fa-cloud-arrow-up text-base"></i>
                        <span>คลิกเพื่อแนบรูปภาพ / เอกสารหลักฐาน</span>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1">รองรับรูปภาพ (JPG, PNG) และไฟล์ PDF</p>
                </div>
            `;
        }
    }

    const deleteBtn = document.getElementById('panel-btn-delete');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            confirmDeleteFinanceTransaction(tx.id, tx.title);
        };
    }

    panel.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('translate-x-full');
    }, 10);
}

function confirmDeleteFinanceTransaction(txId, txTitle) {
    let confirmModal = document.getElementById('finance-delete-confirm-modal');
    if (!confirmModal) {
        confirmModal = document.createElement('div');
        confirmModal.id = 'finance-delete-confirm-modal';
        confirmModal.className = 'fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4 animate-fade-in';
        confirmModal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center">
                <div class="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-3 text-xl">
                    <i class="fa-solid fa-trash-can"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-800 mb-1">ยืนยันการลบรายการ</h3>
                <p class="text-xs text-gray-500 mb-5 leading-relaxed" id="finance-delete-confirm-text">คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?</p>
                <div class="flex gap-3 justify-center">
                    <button id="finance-delete-btn-cancel" class="flex-1 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200">ยกเลิก</button>
                    <button id="finance-delete-btn-confirm" class="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm">ลบรายการ</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
    }

    const confirmText = document.getElementById('finance-delete-confirm-text');
    if (confirmText) {
        confirmText.textContent = `คุณแน่ใจหรือไม่ว่าต้องการลบรายการ "${txTitle || 'ที่เลือก'}" ? เมื่อลบแล้วจะไม่สามารถกู้คืนได้`;
    }

    const cancelBtn = document.getElementById('finance-delete-btn-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            confirmModal.classList.add('hidden');
        };
    }

    const confirmBtn = document.getElementById('finance-delete-btn-confirm');
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            confirmModal.classList.add('hidden');
            await executeDeleteFinanceTransaction(txId);
        };
    }

    confirmModal.classList.remove('hidden');
}

async function executeDeleteFinanceTransaction(txId) {
    try {
        // 1. Delete from local storage
        let txs = getStoredTransactions();
        txs = txs.filter(t => String(t.id) !== String(txId));
        localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(txs));

        // 2. Delete from Supabase if connected
        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            try {
                await window.conworkSupabase.deleteFinanceTransaction(txId);
            } catch (err) {
                console.warn('Supabase delete error:', err);
            }
        }

        // 3. Close panel if open
        closeFinancePanel();

        // 4. Reload table & recalculate all totals and charts
        loadStoredTransactionsToTable();
        recalculateFinanceTotals();

        // 5. Show toast
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('ลบรายการการเงินสำเร็จ!', 'success');
        }
    } catch (e) {
        console.error('Delete transaction error:', e);
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('เกิดข้อผิดพลาดในการลบรายการ', 'error');
        }
    }
}

async function handleSidePanelAttachmentUpload(input, txId) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    try {
        const { dataUrl, size } = await resizeImageIfNeeded(file);
        const attachmentData = {
            name: file.name,
            type: file.type,
            size: size,
            dataUrl: dataUrl
        };

        const txs = getStoredTransactions();
        const target = txs.find(t => t.id === txId);
        if (target) {
            target.attachment = attachmentData;
            localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(txs));
            loadStoredTransactionsToTable();
            openFinancePanel(target);
            if (window.App && typeof App._showToast === 'function') {
                App._showToast('อัปเดตรูปภาพหลักฐานเรียบร้อยแล้ว!', 'success');
            }
        }
    } catch (err) {
        console.error('Attachment upload error:', err);
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ', 'error');
        }
    }
}

function closeFinancePanel() {
    const panel = document.getElementById('finance-detail-panel');
    const content = document.getElementById('finance-detail-content');
    
    if (panel && content) {
        content.classList.add('translate-x-full');
        setTimeout(() => {
            panel.classList.add('hidden');
        }, 300); // Wait for transition
    }
}

// Form Submission Handling
document.addEventListener('DOMContentLoaded', () => {
    // Wait for the modal elements to be in DOM
    setTimeout(() => {
        const addBtn = document.querySelector('#finance-add-modal button.bg-blue-600');
        if (addBtn) {
            addBtn.addEventListener('click', submitFinanceTransaction);
        }
        
        const addCategoryBtn = document.getElementById('btn-submit-category');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', submitFinanceCategory);
        }
    }, 1000);
});

async function submitFinanceTransaction() {
    const modal = document.getElementById('finance-add-modal');
    
    // 1. Gather Data
    const type = document.querySelector('input[name="finance_add_type"]:checked')?.value || 'cash';
    const titleInput = modal.querySelectorAll('input[type="text"]')[0]?.value?.trim();
    const projectId = document.getElementById('finance-add-project-select')?.value || null;
    const categorySelect = document.getElementById('finance-add-category-select')?.value || modal.querySelector('select')?.value;
    const subcategorySelect = document.getElementById('finance-add-subcategory-select');
    const subcategoryId = subcategorySelect ? subcategorySelect.value : null;
    let subcategoryName = null;
    if (subcategoryId && subcategorySelect && subcategorySelect.selectedOptions && subcategorySelect.selectedOptions[0]) {
        subcategoryName = subcategorySelect.selectedOptions[0].getAttribute('data-name') || subcategorySelect.selectedOptions[0].textContent.split(' (')[0].trim();
    }
    const amountInput = modal.querySelector('input[type="number"]')?.value;
    const dateInput = modal.querySelector('input[type="date"]')?.value;
    const descInput = modal.querySelector('textarea')?.value?.trim() || '';
    
    // Basic Validation
    if (!titleInput || !categorySelect || !amountInput || !dateInput) {
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน', 'warning');
        } else {
            alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        }
        return;
    }
    
    try {
        // Change button state
        const submitBtn = modal.querySelector('button.bg-blue-600');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        submitBtn.disabled = true;

        // Process file attachment if selected
        let attachmentObj = null;
        const fileInput = document.getElementById('finance-attachment-add');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const processed = await resizeImageIfNeeded(file);
            attachmentObj = {
                name: file.name,
                type: file.type,
                size: processed.size,
                dataUrl: processed.dataUrl
            };
        }
        
        // 2. Prepare Transaction Data
        const newTx = {
            id: 'tx-' + Date.now(),
            title: titleInput,
            project_id: projectId || null,
            category: categorySelect,
            subcategory_id: subcategoryId || null,
            subcategory_name: subcategoryName || null,
            amount: parseFloat(amountInput) || 0,
            transaction_type: type,
            status: type === 'credit' ? 'รออนุมัติ' : 'จ่ายแล้ว',
            transaction_date: dateInput,
            description: descInput,
            attachment: attachmentObj,
            author: (window.App && App.state && App.state.currentUser) ? App.state.currentUser.name : 'คุณ (Me)'
        };
        
        // Save to persistent storage and update table
        saveTransactionToStorage(newTx);
        insertTransactionRow(newTx, true);
        recalculateFinanceTotals();
        
        // 3. Reset & Close
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Reset inputs
        modal.querySelectorAll('input[type="text"]')[0].value = '';
        modal.querySelector('input[type="number"]').value = '';
        if (modal.querySelector('textarea')) modal.querySelector('textarea').value = '';
        const projSel = document.getElementById('finance-add-project-select');
        if (projSel) projSel.value = '';
        if (subcategorySelect) subcategorySelect.value = '';
        
        // Reset file input
        if (fileInput) fileInput.value = '';
        const fileUI = document.getElementById('finance-attachment-add-ui');
        if (fileUI) {
            fileUI.innerHTML = `
                <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2 group-hover:text-blue-500 transition-colors"></i>
                <p class="text-sm text-blue-600 font-medium">คลิกเพื่ออัปโหลดไฟล์</p>
                <p class="text-xs text-gray-400 mt-1">หรือลากไฟล์มาวางที่นี่</p>
            `;
        }
        
        closeFinanceModal('finance-add-modal');
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('บันทึกรายการการเงินพร้อมรูปภาพสำเร็จ!', 'success');
        }
        
    } catch (error) {
        console.error(error);
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    }
}

function insertTransactionRow(data, isNew = false) {
    const tbody = document.querySelector('#view-accounting tbody');
    if (!tbody) return;
    
    // Remove empty state placeholder if present
    const emptyRow = tbody.querySelector('td[colspan="8"]')?.closest('tr');
    if (emptyRow) emptyRow.remove();
    
    // Dynamic category resolution from stored categories
    const categories = getFinanceCategories();
    const cat = categories[data.category] || {
        name: data.category || 'อื่นๆ',
        icon: 'fa-box',
        color: '#94a3b8',
        bgClass: 'bg-gray-100',
        textClass: 'text-gray-500'
    };
    
    const formattedDate = new Date(data.transaction_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedAmount = '฿' + (parseFloat(data.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 });
    
    let typeBadge, statusBadge;
    if (data.transaction_type === 'credit') {
        typeBadge = `<span class="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded text-[10px] font-bold tracking-wide">Credit</span>`;
        statusBadge = `<span class="bg-orange-50 text-orange-600 px-2.5 py-1 rounded-md text-[10px] font-bold border border-orange-100">${data.status || 'รออนุมัติ'}</span>`;
    } else {
        typeBadge = `<span class="bg-green-50 text-green-600 border border-green-100 px-2 py-1 rounded text-[10px] font-bold tracking-wide">Cash</span>`;
        statusBadge = `<span class="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-[10px] font-bold border border-green-200">${data.status || 'จ่ายแล้ว'}</span>`;
    }
    
    const projectObj = data.project_id ? getFinanceProjects().find(p => String(p.id) === String(data.project_id)) : null;
    const projectBadge = projectObj ? `<div class="mt-1"><span class="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 font-medium"><i class="fa-solid fa-folder-open text-[9px]"></i> ${projectObj.name}</span></div>` : '';

    const tr = document.createElement('tr');
    tr.className = `hover:bg-gray-50 transition-colors ${isNew ? 'animate-fade-in-up bg-yellow-50' : ''}`;
    
    tr.innerHTML = `
        <td class="px-6 py-4 text-xs text-gray-500">${formattedDate}</td>
        <td class="px-6 py-4 font-medium text-gray-800">
            <div>${data.title}</div>
            ${projectBadge}
        </td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-2">
                <i class="fa-solid ${cat.icon || 'fa-box'} ${cat.textClass || 'text-gray-500'} w-4 text-center shrink-0" style="${!cat.textClass && cat.color ? 'color: ' + cat.color : ''}"></i>
                <div>
                    <span class="text-xs font-medium text-gray-700">${cat.name}</span>
                    ${data.subcategory_name ? `<div class="text-[10px] text-indigo-600 font-normal"><i class="fa-solid fa-turn-up fa-rotate-90 text-[8px] mr-1"></i>${data.subcategory_name}</div>` : ''}
                </div>
            </div>
        </td>
        <td class="px-6 py-4 text-center">${typeBadge}</td>
        <td class="px-6 py-4 text-right font-bold text-gray-800">${formattedAmount}</td>
        <td class="px-6 py-4 text-center">${statusBadge}</td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-2">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(data.author || 'User')}&background=random" class="w-6 h-6 rounded-full border border-gray-200">
                <span class="text-xs text-gray-600">${data.author || 'คุณ (Me)'}</span>
            </div>
        </td>
        <td class="px-6 py-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
                <button class="text-gray-400 hover:text-blue-600 hover:bg-blue-50 w-7 h-7 rounded-lg transition-colors flex items-center justify-center" title="ดูรายละเอียด" onclick="event.stopPropagation(); openFinancePanel(this.closest('tr')._txData)"><i class="fa-regular fa-comment-dots text-sm"></i></button>
                <button class="text-gray-400 hover:text-red-600 hover:bg-red-50 w-7 h-7 rounded-lg transition-colors flex items-center justify-center" title="ลบรายการ" onclick="event.stopPropagation(); confirmDeleteFinanceTransaction('${data.id}', '${(data.title || '').replace(/'/g, "\\'")}')"><i class="fa-regular fa-trash-can text-sm"></i></button>
            </div>
        </td>
    `;
    
    tr._txData = data;
    // Add click event for the row to open Side panel
    tr.addEventListener('click', () => {
        openFinancePanel(data);
    });
    
    if (isNew) {
        tbody.insertBefore(tr, tbody.firstChild);
        setTimeout(() => {
            tr.classList.remove('bg-yellow-50');
        }, 3000);
    } else {
        tbody.appendChild(tr);
    }
}

// Category Submission & Management
async function submitFinanceCategory() {
    const nameInput = document.getElementById('add-category-name');
    const name = nameInput ? nameInput.value.trim() : '';
    const iconInput = document.getElementById('add-category-icon')?.value.trim() || 'fa-box';
    const budgetInput = parseFloat(document.getElementById('add-category-budget')?.value) || 0;
    const colorRadio = document.querySelector('input[name="category_color"]:checked');
    const colorPresetKey = colorRadio ? colorRadio.value : 'blue';

    if (!name) {
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('กรุณากรอกชื่อหมวดหมู่', 'warning');
        } else {
            alert('กรุณากรอกชื่อหมวดหมู่');
        }
        return;
    }

    const submitBtn = document.getElementById('btn-submit-category');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        submitBtn.disabled = true;
    }

    try {
        const preset = FINANCE_COLOR_PRESETS[colorPresetKey] || FINANCE_COLOR_PRESETS['blue'];
        const newId = 'cat_' + Date.now();

        const newCategory = {
            id: newId,
            name: name,
            icon: iconInput,
            color: preset.color,
            bgClass: preset.bgClass,
            textClass: preset.textClass,
            defaultBudget: budgetInput
        };

        const categories = getFinanceCategories();
        categories[newId] = newCategory;
        saveFinanceCategories(categories);

        // Sync category to Supabase if available
        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            try {
                window.conworkSupabase.saveFinanceCategory({
                    id: newId,
                    name: name,
                    icon: iconInput,
                    color: preset.color,
                    default_budget: budgetInput,
                    subcategories: []
                }).catch(e => console.warn('Supabase create category warning:', e));
            } catch (e) {}
        }

        // Reset inputs
        if (nameInput) nameInput.value = '';
        const budgetEl = document.getElementById('add-category-budget');
        if (budgetEl) budgetEl.value = '';

        // Update selects across modals and pre-select the newly added category
        renderFinanceCategorySelects(newId);
        recalculateFinanceTotals();
        renderCategoryManagementList();

        // Switch back to list tab
        switchCategoryManagerTab('list');

        if (window.App && typeof App._showToast === 'function') {
            App._showToast(`เพิ่มหมวดหมู่ "${name}" สำเร็จ!`, 'success');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('เกิดข้อผิดพลาดในการบันทึกหมวดหมู่', 'error');
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึกหมวดหมู่');
        }
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

function insertCategoryBreakdown(data) {
    recalculateFinanceTotals();
}

async function submitFinanceRequest() {
    const modal = document.getElementById('finance-request-modal');
    if (!modal) return;

    const title = modal.querySelector('input[type="text"]')?.value?.trim();
    const projectId = document.getElementById('finance-request-project-select')?.value || null;
    const category = document.getElementById('finance-request-category-select')?.value;
    const subcategorySelect = document.getElementById('finance-request-subcategory-select');
    const subcategoryId = subcategorySelect ? subcategorySelect.value : null;
    let subcategoryName = null;
    if (subcategoryId && subcategorySelect && subcategorySelect.selectedOptions && subcategorySelect.selectedOptions[0]) {
        subcategoryName = subcategorySelect.selectedOptions[0].getAttribute('data-name') || subcategorySelect.selectedOptions[0].textContent.split(' (')[0].trim();
    }
    const amount = parseFloat(modal.querySelector('input[type="number"]')?.value) || 0;
    const date = modal.querySelector('input[type="date"]')?.value;
    const reason = modal.querySelector('textarea')?.value?.trim();

    if (!title || !category || !amount || !date) {
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('กรุณากรอกข้อมูลขอใช้งบประมาณให้ครบถ้วน (*)', 'warning');
        } else {
            alert('กรุณากรอกข้อมูลขอใช้งบประมาณให้ครบถ้วน (*)');
        }
        return;
    }

    try {
        const newTx = {
            id: 'tx-' + Date.now(),
            title: title,
            project_id: projectId || null,
            category: category,
            subcategory_id: subcategoryId || null,
            subcategory_name: subcategoryName || null,
            amount: amount,
            transaction_type: 'credit',
            status: 'รออนุมัติ',
            transaction_date: date,
            description: reason || '',
            author: (window.App && App.state && App.state.currentUser) ? App.state.currentUser.name : 'คุณ (Me)'
        };

        saveTransactionToStorage(newTx);
        insertTransactionRow(newTx, true);
        recalculateFinanceTotals();

        // Reset inputs
        modal.querySelectorAll('input').forEach(i => i.value = '');
        if (modal.querySelector('textarea')) modal.querySelector('textarea').value = '';
        const reqProjSelect = document.getElementById('finance-request-project-select');
        if (reqProjSelect) reqProjSelect.value = '';
        if (subcategorySelect) subcategorySelect.value = '';

        closeFinanceModal('finance-request-modal');
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('ส่งคำขออนุมัติงบประมาณสำเร็จ!', 'success');
        }
    } catch (e) {
        console.error('Error submitting finance request:', e);
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('เกิดข้อผิดพลาดในการส่งคำขออนุมัติ', 'error');
        }
    }
}

// File Attachment Handler
async function handleFinanceAttachmentChange(input) {
    const uiContainer = document.getElementById('finance-attachment-add-ui');
    if (!uiContainer) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.type.includes('image')) {
            const processed = await resizeImageIfNeeded(file);
            uiContainer.innerHTML = `
                <div class="flex items-center justify-center gap-3">
                    <img src="${processed.dataUrl}" class="w-14 h-14 object-cover rounded-xl border border-gray-200 shadow-sm">
                    <div class="text-left">
                        <p class="text-sm font-bold text-gray-800 truncate max-w-[200px]">${file.name}</p>
                        <p class="text-xs text-green-600 font-semibold">${processed.size} (พร้อมแสดงรูป)</p>
                    </div>
                </div>
                <p class="text-[10px] text-blue-600 mt-2.5 font-medium hover:underline">คลิกเพื่อเปลี่ยนรูปภาพ</p>
            `;
        } else {
            const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';
            const iconClass = file.type.includes('pdf') ? 'fa-file-pdf text-red-500' : 'fa-file-lines text-gray-500';
            uiContainer.innerHTML = `
                <div class="flex items-center justify-center gap-3">
                    <i class="fa-solid ${iconClass} text-3xl"></i>
                    <div class="text-left">
                        <p class="text-sm font-bold text-gray-800 truncate max-w-[200px]">${file.name}</p>
                        <p class="text-xs text-gray-500">${fileSize}</p>
                    </div>
                </div>
                <p class="text-[10px] text-blue-600 mt-2.5 font-medium hover:underline">คลิกเพื่อเปลี่ยนไฟล์</p>
            `;
        }
    } else {
        // Reset UI if no file
        uiContainer.innerHTML = `
            <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2 group-hover:text-blue-500 transition-colors"></i>
            <p class="text-sm text-blue-600 font-medium">คลิกเพื่ออัปโหลดไฟล์</p>
            <p class="text-xs text-gray-400 mt-1">หรือลากไฟล์มาวางที่นี่</p>
        `;
    }
}

/**
 * Returns summary of budget, expenses, and remaining funds for Dashboard
 */
function getFinanceBudgetSummary() {
    const txs = getStoredTransactions();
    let totalExpense = 0;
    let totalIncome = 0;
    let plannedBudget = 0;

    const categories = getFinanceCategories();
    const catKeys = Object.keys(categories);
    catKeys.forEach(k => {
        const meta = categories[k];
        const catTxs = txs.filter(t => t.category === k);
        const creditTxs = catTxs.filter(t => t.transaction_type === 'credit');
        const creditSum = creditTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        plannedBudget += Math.max(meta.defaultBudget || 0, creditSum);
    });

    txs.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income' || t.is_inflow) {
            totalIncome += amt;
        } else {
            totalExpense += amt;
        }
    });

    const effectiveBudget = totalIncome > 0 ? totalIncome : (plannedBudget || 20000);
    const remaining = effectiveBudget - totalExpense;
    const usedPct = effectiveBudget > 0 ? Math.round((totalExpense / effectiveBudget) * 100) : 0;
    const remainingPct = Math.max(0, 100 - usedPct);

    return {
        totalBudget: effectiveBudget,
        totalExpense,
        totalIncome,
        remaining,
        usedPct,
        remainingPct
    };
}

window.DEFAULT_FINANCE_CATEGORIES = DEFAULT_FINANCE_CATEGORIES;
window.getFinanceCategories = getFinanceCategories;
window.saveFinanceCategories = saveFinanceCategories;
window.renderFinanceCategorySelects = renderFinanceCategorySelects;
window.renderCategoryManagementList = renderCategoryManagementList;
window.openFinanceCategoryManager = openFinanceCategoryManager;
window.switchCategoryManagerTab = switchCategoryManagerTab;
window.selectQuickIcon = selectQuickIcon;
window.deleteFinanceCategory = deleteFinanceCategory;
window.submitFinanceCategory = submitFinanceCategory;
window.submitFinanceRequest = submitFinanceRequest;
window.getFinanceBudgetSummary = getFinanceBudgetSummary;
window.openAllocateBudgetModal = openAllocateBudgetModal;
window.renderCategoryAllocationList = renderCategoryAllocationList;
window.calculateAllocationPreview = calculateAllocationPreview;
window.distributeBudgetEqually = distributeBudgetEqually;
window.clearAllCategoryAllocations = clearAllCategoryAllocations;
window.submitCategoryAllocation = submitCategoryAllocation;
window.clearAllProjectAllocations = clearAllProjectAllocations;
window.submitProjectAllocation = submitProjectAllocation;
window.renderProjectAllocationList = renderProjectAllocationList;
window.filterTransactionsByCategory = filterTransactionsByCategory;
window.filterTransactionsByProject = filterTransactionsByProject;
window.onFinanceCategorySelectChanged = onFinanceCategorySelectChanged;
window.openSubcategoryAllocationModal = openSubcategoryAllocationModal;
window.renderSubcategoryAllocationList = renderSubcategoryAllocationList;
window.addSubcategoryRow = addSubcategoryRow;
window.removeSubcategoryRow = removeSubcategoryRow;
window.calculateSuballocationPreview = calculateSuballocationPreview;
window.distributeSubcategoryBudgetEqually = distributeSubcategoryBudgetEqually;
window.clearAllSubcategoryAllocations = clearAllSubcategoryAllocations;
window.fitCategoryBudgetToSubcategories = fitCategoryBudgetToSubcategories;
window.submitSubcategoryAllocation = submitSubcategoryAllocation;
