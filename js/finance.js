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
    'paid': 'paid'
};

const DEFAULT_FINANCE_CATEGORIES = {
    'welfare': { name: 'สวัสดิการอาหารและเบรก', icon: 'fa-utensils', color: '#f97316', bgClass: 'bg-orange-100', textClass: 'text-orange-500', defaultBudget: 5400 },
    'supplies': { name: 'พัสดุและอุปกรณ์', icon: 'fa-box', color: '#a855f7', bgClass: 'bg-purple-100', textClass: 'text-purple-500', defaultBudget: 4000 },
    'activity': { name: 'กิจกรรมโครงการ', icon: 'fa-palette', color: '#ec4899', bgClass: 'bg-pink-100', textClass: 'text-pink-500', defaultBudget: 6000 },
    'travel': { name: 'การเดินทางและขนส่ง', icon: 'fa-car', color: '#0ea5e9', bgClass: 'bg-sky-100', textClass: 'text-sky-500', defaultBudget: 2600 },
    'other': { name: 'อื่น ๆ', icon: 'fa-ellipsis', color: '#94a3b8', bgClass: 'bg-gray-100', textClass: 'text-gray-500', defaultBudget: 2000 }
};

function getStoredTransactions() {
    try {
        const saved = localStorage.getItem(FINANCE_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    const initial = [
        { id: 'tx-1', title: 'ค่าอาหารกลางวันทีมสำรวจหน้างาน', category: 'welfare', amount: 1200, transaction_type: 'cash', status: 'จ่ายแล้ว', transaction_date: '2026-05-18', author: 'คุณ (Me)' },
        { id: 'tx-2', title: 'จัดซื้อสายไฟและอุปกรณ์ความปลอดภัย VAF', category: 'supplies', amount: 8450, transaction_type: 'credit', status: 'รออนุมัติ', transaction_date: '2026-05-16', author: 'วิชัย มั่นคง' },
        { id: 'tx-3', title: 'ค่าน้ำมันรถกระบะขนส่งวัสดุ', category: 'travel', amount: 1500, transaction_type: 'cash', status: 'จ่ายแล้ว', transaction_date: '2026-05-14', author: 'คุณ (Me)' }
    ];
    try { localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(initial)); } catch (e) {}
    return initial;
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
                title: tx.title,
                transaction_type: tx.transaction_type,
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
        const remoteTxs = await window.conworkSupabase.fetchFinanceTransactions(companyId);
        if (remoteTxs && remoteTxs.length > 0) {
            const mapped = remoteTxs.map(t => ({
                id: t.id,
                title: t.title,
                category: t.category_id || t.category || 'other',
                amount: parseFloat(t.amount) || 0,
                transaction_type: t.transaction_type || 'cash',
                status: STATUS_TO_THAI[t.status] || t.status || 'จ่ายแล้ว',
                transaction_date: t.transaction_date,
                author: t.responsible_user || 'ทีมงาน'
            }));
            localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(mapped));
            loadStoredTransactionsToTable();
        }
    } catch (err) {
        console.warn('Supabase finance sync warning:', err);
    }
}

function recalculateFinanceTotals() {
    const txs = getStoredTransactions();
    const initialCash = 10000;

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

    // 1. Calculate per-category metrics for Credit & Cash
    const catKeys = Object.keys(DEFAULT_FINANCE_CATEGORIES);
    let totalPlannedCredit = 0;
    const catData = {};

    catKeys.forEach(k => {
        const meta = DEFAULT_FINANCE_CATEGORIES[k];
        const catTxs = txs.filter(t => t.category === k || (k === 'other' && !DEFAULT_FINANCE_CATEGORIES[t.category]));
        const creditTxs = catTxs.filter(t => t.transaction_type === 'credit');
        const cashTxs = catTxs.filter(t => t.transaction_type === 'cash');

        const creditSum = creditTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const cashSum = cashTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const planned = Math.max(meta.defaultBudget, creditSum);

        totalPlannedCredit += planned;
        catData[k] = {
            key: k,
            name: meta.name,
            icon: meta.icon,
            color: meta.color,
            bgClass: meta.bgClass,
            textClass: meta.textClass,
            planned: planned,
            creditSum: creditSum,
            cashSum: cashSum,
            remaining: Math.max(0, planned - cashSum),
            usedPct: planned > 0 ? Math.min(100, Math.round((cashSum / planned) * 100)) : 0,
            txs: catTxs
        };
    });

    // 2. Summary Cards (5 Cards)
    const cards = document.querySelectorAll('#view-accounting .grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5 > div');
    if (cards.length >= 5) {
        const c1Val = cards[0].querySelector('.text-2xl');
        if (c1Val) c1Val.textContent = '฿' + totalPlannedCredit.toLocaleString();

        const c2Val = cards[1].querySelector('.text-2xl');
        if (c2Val) c2Val.textContent = '฿' + cashUsed.toLocaleString();

        const c3Val = cards[2].querySelector('.text-2xl');
        if (c3Val) c3Val.textContent = '฿' + cashRemaining.toLocaleString();

        const c4Val = cards[3].querySelector('.text-2xl');
        if (c4Val) c4Val.textContent = '฿' + pendingAmount.toLocaleString();

        const c5Val = cards[4].querySelector('.text-2xl');
        if (c5Val) c5Val.textContent = '฿' + approvedAmount.toLocaleString();
    }

    // 3. Comparison Progress Bar
    const remainingCreditBudget = Math.max(0, totalPlannedCredit - cashUsed);
    const creditUsedPct = totalPlannedCredit > 0 ? Math.min(100, Math.round((cashUsed / totalPlannedCredit) * 100)) : 0;
    const creditRemainingPct = 100 - creditUsedPct;

    const progressRemainText = document.getElementById('finance-progress-remaining-text');
    if (progressRemainText) {
        progressRemainText.textContent = '฿' + remainingCreditBudget.toLocaleString();
    }
    const spentBar = document.getElementById('finance-progress-spent-bar');
    if (spentBar) {
        spentBar.style.width = `${creditUsedPct}%`;
        spentBar.textContent = `ใช้จริง ${creditUsedPct}% (฿${cashUsed.toLocaleString()})`;
    }
    const remainingBar = document.getElementById('finance-progress-remaining-bar');
    if (remainingBar) {
        remainingBar.style.width = `${creditRemainingPct}%`;
        remainingBar.textContent = `คงเหลือ ${creditRemainingPct}% (฿${remainingCreditBudget.toLocaleString()})`;
    }

    // 4. Col 1: Credit Donut Chart & Legends
    let currentPct = 0;
    const gradientSlices = [];
    const creditLegendItems = [];

    catKeys.forEach(k => {
        const d = catData[k];
        const pct = totalPlannedCredit > 0 ? (d.planned / totalPlannedCredit) * 100 : 0;
        const start = currentPct;
        currentPct += pct;
        gradientSlices.push(`${d.color} ${start.toFixed(1)}% ${currentPct.toFixed(1)}%`);

        creditLegendItems.push(`
            <div class="flex items-center justify-between text-xs hover:bg-gray-50 p-1 -mx-1 rounded transition-colors cursor-pointer" onclick="filterTransactionsByCategory('${k}')" title="คลิกเพื่อกรองรายการ">
                <div class="flex items-center gap-2.5">
                    <div class="w-3 h-3 rounded-full shrink-0" style="background-color: ${d.color};"></div>
                    <span class="text-gray-700 truncate max-w-[140px]">${d.name}</span>
                </div>
                <span class="font-medium text-gray-800">฿${d.planned.toLocaleString()} <span class="text-gray-400 font-normal ml-1 w-8 inline-block text-right">(${pct.toFixed(0)}%)</span></span>
            </div>
        `);
    });

    const creditChartEl = document.getElementById('finance-credit-donut-chart');
    if (creditChartEl) {
        creditChartEl.style.background = `conic-gradient(${gradientSlices.join(', ')})`;
    }
    const creditTotalEl = document.getElementById('finance-credit-donut-total');
    if (creditTotalEl) {
        creditTotalEl.textContent = '฿' + totalPlannedCredit.toLocaleString();
    }
    const creditLegendEl = document.getElementById('finance-credit-donut-legend');
    if (creditLegendEl) {
        creditLegendEl.innerHTML = creditLegendItems.join('');
    }

    // 5. Col 2: Cash Donut Chart & Legend
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

    // 6. Col 3: Category Breakdown List
    const breakdownListEl = document.getElementById('finance-category-breakdown-list');
    if (breakdownListEl) {
        const breakdownHTML = catKeys.map((k, idx) => {
            const d = catData[k];
            const collapseId = `cat-breakdown-details-${idx}`;
            const hasTxs = d.txs && d.txs.length > 0;
            
            const subItemsHTML = hasTxs ? d.txs.map(tx => {
                const isCash = tx.transaction_type === 'cash';
                return `
                    <div class="flex justify-between text-[10px] text-gray-600 py-1 hover:bg-white px-2 rounded transition-colors">
                        <span class="truncate max-w-[150px] font-medium">${tx.title}</span>
                        <div class="flex gap-3 shrink-0 text-right">
                            <span class="${isCash ? 'text-gray-300' : 'text-blue-600 font-semibold'} w-14">${isCash ? '-' : '฿' + (parseFloat(tx.amount)||0).toLocaleString()}</span>
                            <span class="${isCash ? 'text-green-600 font-semibold' : 'text-gray-300'} w-14">${isCash ? '฿' + (parseFloat(tx.amount)||0).toLocaleString() : '-'}</span>
                            <span class="text-gray-400 w-12">${tx.status || 'เสร็จสิ้น'}</span>
                        </div>
                    </div>
                `;
            }).join('') : `<div class="text-[10px] text-gray-400 py-1 pl-2 italic">ยังไม่มีรายการย่อยในหมวดนี้</div>`;

            return `
                <div>
                    <div class="flex items-center justify-between text-[11px] mb-2 cursor-pointer group hover:bg-gray-50 p-1 -mx-1 rounded transition-colors" onclick="document.getElementById('${collapseId}').classList.toggle('hidden');">
                        <div class="w-2/5 flex items-center gap-2.5 font-medium text-gray-700">
                            <div class="w-6 h-6 rounded ${d.bgClass} flex items-center justify-center shrink-0">
                                <i class="fa-solid ${d.icon} ${d.textClass} text-[10px]"></i>
                            </div>
                            <span class="truncate">${d.name}</span>
                            <i class="fa-solid fa-angle-down text-gray-300 ml-auto text-[10px] group-hover:text-gray-500 transition-transform"></i>
                        </div>
                        <div class="w-1/5 text-right text-gray-500">฿${d.planned.toLocaleString()}</div>
                        <div class="w-1/5 text-right text-gray-500">฿${d.cashSum.toLocaleString()}</div>
                        <div class="w-1/5 text-right font-bold text-gray-800">฿${d.remaining.toLocaleString()}</div>
                    </div>
                    <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
                        <div class="bg-green-500 h-full transition-all duration-500" style="width: ${d.usedPct}%;"></div>
                        <div class="bg-blue-400 h-full opacity-30 transition-all duration-500" style="width: ${100 - d.usedPct}%;"></div>
                    </div>
                    <div class="text-[9px] text-gray-400 text-right mt-1">ใช้ไปแล้ว ${d.usedPct}%</div>
                    
                    <!-- Expandable Details -->
                    <div id="${collapseId}" class="hidden mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1">
                        <div class="flex justify-between text-[9px] font-bold text-gray-400 border-b border-gray-200/60 pb-1 mb-1 px-2">
                            <span>รายการ</span>
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
    }
}

function filterTransactionsByCategory(catKey) {
    const tableRows = document.querySelectorAll('#view-accounting tbody tr');
    const tabs = document.querySelectorAll('#view-accounting .border-b .px-6');
    if (tabs.length > 0) tabs[0].click();

    const meta = DEFAULT_FINANCE_CATEGORIES[catKey];
    tableRows.forEach(row => {
        const catCell = row.querySelector('td:nth-child(3)');
        if (!catCell) return;
        if (!meta || catKey === 'all') {
            row.style.display = '';
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
    txs.forEach(tx => {
        insertTransactionRow(tx, false);
    });
    recalculateFinanceTotals();
}

document.addEventListener('DOMContentLoaded', () => {
    // Wait a brief moment to ensure all elements are rendered
    setTimeout(() => {
        initFinanceDashboard();
    }, 500);
});

function initFinanceDashboard() {
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
                        const typeCell = row.querySelector('td:nth-child(4)').innerText;
                        row.style.display = typeCell.includes('Credit') ? '' : 'none';
                    } else if (filterType === 2) {
                        // Cash
                        const typeCell = row.querySelector('td:nth-child(4)').innerText;
                        row.style.display = typeCell.includes('Cash') ? '' : 'none';
                    } else if (filterType === 3) {
                        // Pending
                        const statusCell = row.querySelector('td:nth-child(6)').innerText;
                        row.style.display = statusCell.includes('รออนุมัติ') ? '' : 'none';
                    }
                });
            });
        });
        
        // Ensure first tab has correct border
        tabs[0].style.borderBottomWidth = '2px';
    }

    // 2. Summary Cards Click -> Filter Tabs
    const summaryCards = document.querySelectorAll('#view-accounting .grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5 > div');
    if (summaryCards.length === 5) {
        // Card 1: Credit -> Click triggers Tab 1 (Credit)
        summaryCards[0].addEventListener('click', () => {
            tabs[1].click();
            scrollToTable();
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
            const initialCash = 10000;
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
            const totalBudget = 20000;
            const pct = ((cashSpent / totalBudget) * 100).toFixed(1);
            showFinanceDetailModal('อัตราการใช้งบประมาณ (Budget Utilization)', 'fa-solid fa-chart-pie text-blue-600', [
                { label: 'งบประมาณรวมที่จัดสรร (Credit Budget)', value: '฿' + totalBudget.toLocaleString() },
                { label: 'ยอดเงินสดที่ใช้จริง (Cash Spent)', value: '฿' + cashSpent.toLocaleString(), highlight: 'text-amber-600' },
                { label: 'อัตราการใช้เงินรวม (Utilization Rate)', value: pct + '%', highlight: 'text-blue-600 font-extrabold text-base' }
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

    // Category
    const catEl = document.getElementById('panel-category');
    if (catEl) {
        if (tx.categoryHTML) {
            catEl.innerHTML = tx.categoryHTML;
        } else {
            const meta = DEFAULT_FINANCE_CATEGORIES[tx.category] || DEFAULT_FINANCE_CATEGORIES['other'];
            catEl.innerHTML = `<i class="fa-solid ${meta.icon} ${meta.textClass}"></i> ${meta.name}`;
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

    panel.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('translate-x-full');
    }, 10);
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
    const categorySelect = modal.querySelector('select')?.value;
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
            category: categorySelect,
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
    
    // Map categories for UI
    const catMap = {
        'welfare': { name: 'สวัสดิการ', icon: 'fa-utensils', color: 'orange' },
        'supplies': { name: 'พัสดุ', icon: 'fa-box', color: 'purple' },
        'activity': { name: 'กิจกรรม', icon: 'fa-palette', color: 'pink' },
        'travel': { name: 'เดินทาง', icon: 'fa-car', color: 'sky' },
        'other': { name: 'อื่นๆ', icon: 'fa-ellipsis', color: 'gray' }
    };
    
    const cat = catMap[data.category] || catMap['other'];
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
    
    const tr = document.createElement('tr');
    tr.className = `hover:bg-gray-50 transition-colors ${isNew ? 'animate-fade-in-up bg-yellow-50' : ''}`;
    
    tr.innerHTML = `
        <td class="px-6 py-4 text-xs text-gray-500">${formattedDate}</td>
        <td class="px-6 py-4 font-medium text-gray-800">${data.title}</td>
        <td class="px-6 py-4">
            <div class="flex items-center gap-2">
                <i class="fa-solid ${cat.icon} text-${cat.color}-400 w-4 text-center"></i> <span class="text-xs">${cat.name}</span>
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
        <td class="px-6 py-4 text-center"><button class="text-gray-400 hover:text-blue-500 transition-colors" onclick="this.closest('tr').click()"><i class="fa-regular fa-comment-dots"></i></button></td>
    `;
    
    // Add click event for the row to open Side panel
    tr.addEventListener('click', () => {
        openFinancePanel(data.title, formattedAmount, typeBadge, statusBadge, tr.querySelector('td:nth-child(3)').innerHTML, formattedDate, tr.querySelector('td:nth-child(7)').innerHTML);
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

// Category Submission
async function submitFinanceCategory() {
    const modal = document.getElementById('finance-add-category-modal');
    
    // Gather Data
    const nameInput = document.getElementById('add-category-name').value.trim();
    const iconInput = document.getElementById('add-category-icon').value.trim() || 'fa-box';
    const colorInput = document.querySelector('input[name="category_color"]:checked').value;
    
    if (!nameInput) {
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('กรุณากรอกชื่อหมวดหมู่', 'warning');
        } else {
            alert('กรุณากรอกชื่อหมวดหมู่');
        }
        return;
    }
    
    try {
        const submitBtn = document.getElementById('btn-submit-category');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        submitBtn.disabled = true;
        
        const data = {
            name: nameInput,
            icon: iconInput,
            color: colorInput
        };
        
        const result = await ApiService.createFinanceCategory(data);
        
        // Update Select dropdowns in Modals
        const valueSlug = 'cat_' + Date.now();
        const selects = document.querySelectorAll('#finance-add-modal select, #finance-request-modal select');
        
        selects.forEach(select => {
            // Find if it's the category select (usually the one with options welfare, supplies, etc.)
            const isCategorySelect = Array.from(select.options).some(opt => opt.value === 'welfare' || opt.value === 'supplies');
            if (isCategorySelect) {
                const newOption = new Option(result.name, valueSlug);
                select.add(newOption);
            }
        });
        
        // Add to Breakdown list
        insertCategoryBreakdown(result);
        
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Reset form
        document.getElementById('add-category-name').value = '';
        
        closeFinanceModal('finance-add-category-modal');
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('เพิ่มหมวดหมู่สำเร็จ!', 'success');
        }
        
    } catch (error) {
        console.error(error);
        if (window.App && typeof App._showToast === 'function') {
            App._showToast('เกิดข้อผิดพลาดในการบันทึกหมวดหมู่', 'error');
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึกหมวดหมู่');
        }
    }
}

function insertCategoryBreakdown(data) {
    // Find the breakdown container
    const breakdownContainers = document.querySelectorAll('#view-accounting .space-y-5.overflow-y-auto.flex-1.pr-1.custom-scrollbar');
    if (breakdownContainers.length === 0) return;
    
    const container = breakdownContainers[0];
    
    // Build new category HTML
    const bgColors = {
        'red': 'bg-red-100', 'orange': 'bg-orange-100', 'yellow': 'bg-yellow-100',
        'green': 'bg-green-100', 'blue': 'bg-blue-100', 'indigo': 'bg-indigo-100',
        'purple': 'bg-purple-100', 'pink': 'bg-pink-100', 'gray': 'bg-gray-100'
    };
    
    const textColors = {
        'red': 'text-red-500', 'orange': 'text-orange-500', 'yellow': 'text-yellow-600',
        'green': 'text-green-500', 'blue': 'text-blue-500', 'indigo': 'text-indigo-500',
        'purple': 'text-purple-500', 'pink': 'text-pink-500', 'gray': 'text-gray-500'
    };
    
    const bgColorClass = bgColors[data.color] || 'bg-gray-100';
    const textColorClass = textColors[data.color] || 'text-gray-500';
    
    const newDiv = document.createElement('div');
    newDiv.className = 'animate-fade-in-up';
    newDiv.innerHTML = `
        <div class="flex items-center justify-between text-[11px] mb-2 cursor-pointer group hover:bg-gray-50 p-1 -mx-1 rounded transition-colors bg-yellow-50" onclick="if(this.nextElementSibling.nextElementSibling.nextElementSibling) this.nextElementSibling.nextElementSibling.nextElementSibling.classList.toggle('hidden');">
            <div class="w-2/5 flex items-center gap-2.5 font-medium text-gray-700">
                <div class="w-6 h-6 rounded ${bgColorClass} flex items-center justify-center shrink-0"><i class="fa-solid ${data.icon} ${textColorClass} text-[10px]"></i></div>
                <span class="truncate">${data.name}</span>
            </div>
            <div class="w-1/5 text-right text-gray-500">฿0</div>
            <div class="w-1/5 text-right text-gray-500">฿0</div>
            <div class="w-1/5 text-right font-bold text-gray-800">฿0</div>
        </div>
        <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
            <div class="bg-gray-200 h-full" style="width: 100%;"></div>
        </div>
        <div class="text-[9px] text-gray-400 text-right mt-1">ยังไม่มีการใช้งาน</div>
    `;
    
    // Add to top of list
    container.insertBefore(newDiv, container.firstChild);
    
    // Remove highlight
    setTimeout(() => {
        const header = newDiv.querySelector('.bg-yellow-50');
        if (header) header.classList.remove('bg-yellow-50');
    }, 3000);
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
