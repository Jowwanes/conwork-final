/**
 * Project Finance Management Controller
 * Handles interactions for the Finance Dashboard
 */

const FINANCE_STORAGE_KEY = 'conwork_finance_transactions';

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
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            window.conworkSupabase.client.from('finance_transactions').insert([tx]).then();
        } catch (e) {}
    }
}

function recalculateFinanceTotals() {
    const txs = getStoredTransactions();
    const initialCredit = 20000;
    const initialCash = 10000;

    let cashUsed = 0;
    let pendingAmount = 0;
    let approvedAmount = 0;

    txs.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.transaction_type === 'cash') {
            cashUsed += amt;
        }

        if (t.status === 'รออนุมัติ') {
            pendingAmount += amt;
        } else if (t.status === 'จ่ายแล้ว' || t.status === 'อนุมัติแล้ว') {
            approvedAmount += amt;
        }
    });

    const cashRemaining = Math.max(0, initialCash - cashUsed);

    const cards = document.querySelectorAll('#view-accounting .grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5 > div');
    if (cards.length >= 5) {
        const c1Val = cards[0].querySelector('.text-2xl');
        if (c1Val) c1Val.textContent = '฿' + initialCredit.toLocaleString();

        const c2Val = cards[1].querySelector('.text-2xl');
        if (c2Val) c2Val.textContent = '฿' + cashUsed.toLocaleString();

        const c3Val = cards[2].querySelector('.text-2xl');
        if (c3Val) c3Val.textContent = '฿' + cashRemaining.toLocaleString();

        const c4Val = cards[3].querySelector('.text-2xl');
        if (c4Val) c4Val.textContent = '฿' + pendingAmount.toLocaleString();

        const c5Val = cards[4].querySelector('.text-2xl');
        if (c5Val) c5Val.textContent = '฿' + approvedAmount.toLocaleString();
    }
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

// Side Panel Functions
function openFinancePanel(title, amount, type, status, categoryHTML, date, userHTML) {
    const panel = document.getElementById('finance-detail-panel');
    const content = document.getElementById('finance-detail-content');
    
    if (panel && content) {
        // Update data
        document.getElementById('panel-title').innerText = title || 'รายละเอียดรายการ';
        document.getElementById('panel-amount').innerText = amount || '฿0.00';
        
        // Update badges
        const badgesContainer = document.getElementById('panel-badges');
        badgesContainer.innerHTML = '';
        
        if (type && type.includes('Credit')) {
            badgesContainer.innerHTML += `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">Credit</span>`;
            document.getElementById('panel-icon').innerHTML = '<i class="fa-solid fa-wallet"></i>';
            document.getElementById('panel-icon').className = 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3 text-xl';
        } else if (type && type.includes('Cash')) {
            badgesContainer.innerHTML += `<span class="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg text-xs font-bold">Cash</span>`;
            document.getElementById('panel-icon').innerHTML = '<i class="fa-solid fa-hand-holding-dollar"></i>';
            document.getElementById('panel-icon').className = 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 mb-3 text-xl';
        }

        const approvalActions = document.getElementById('panel-approval-actions');
        if (status && status.includes('รออนุมัติ')) {
            badgesContainer.innerHTML += `<span class="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1 rounded-lg text-xs font-bold">รออนุมัติ</span>`;
            approvalActions.classList.remove('hidden');
        } else if (status && status.includes('อนุมัติแล้ว')) {
            badgesContainer.innerHTML += `<span class="bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-xs font-bold">อนุมัติแล้ว</span>`;
            approvalActions.classList.add('hidden');
        } else if (status && status.includes('จ่ายแล้ว')) {
            badgesContainer.innerHTML += `<span class="bg-green-100 text-green-700 border border-green-200 px-3 py-1 rounded-lg text-xs font-bold">จ่ายแล้ว</span>`;
            approvalActions.classList.add('hidden');
        } else {
            approvalActions.classList.add('hidden');
        }
        
        // Category, Date, User
        if (categoryHTML) document.getElementById('panel-category').innerHTML = categoryHTML;
        if (date) document.getElementById('panel-date').innerText = date;
        if (userHTML) document.getElementById('panel-user').innerHTML = userHTML;

        // Show panel
        panel.classList.remove('hidden');
        // Slight delay to allow display:block to apply before animating transform
        setTimeout(() => {
            content.classList.remove('translate-x-full');
        }, 10);
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
        
        // 2. Prepare Transaction Data
        const newTx = {
            id: 'tx-' + Date.now(),
            title: titleInput,
            category: categorySelect,
            amount: parseFloat(amountInput) || 0,
            transaction_type: type,
            status: type === 'credit' ? 'รออนุมัติ' : 'จ่ายแล้ว',
            transaction_date: dateInput,
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
        
        // Reset file input
        const fileInput = document.getElementById('finance-attachment-add');
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
            App._showToast('บันทึกรายการการเงินสำเร็จ!', 'success');
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
function handleFinanceAttachmentChange(input) {
    const uiContainer = document.getElementById('finance-attachment-add-ui');
    if (!uiContainer) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileSize = (file.size / 1024 / 1024).toFixed(2); // in MB
        
        // Determine icon based on type
        let iconClass = 'fa-file-lines';
        let iconColor = 'text-gray-500';
        
        if (file.type.includes('image')) {
            iconClass = 'fa-file-image';
            iconColor = 'text-blue-500';
        } else if (file.type.includes('pdf')) {
            iconClass = 'fa-file-pdf';
            iconColor = 'text-red-500';
        }
        
        uiContainer.innerHTML = `
            <div class="flex items-center justify-center gap-3">
                <i class="fa-solid ${iconClass} text-3xl ${iconColor}"></i>
                <div class="text-left">
                    <p class="text-sm font-bold text-gray-800 truncate max-w-[200px]">${file.name}</p>
                    <p class="text-xs text-gray-500">${fileSize} MB</p>
                </div>
            </div>
            <p class="text-[10px] text-blue-600 mt-3 font-medium hover:underline">คลิกเพื่อเปลี่ยนไฟล์</p>
        `;
    } else {
        // Reset UI if no file
        uiContainer.innerHTML = `
            <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2 group-hover:text-blue-500 transition-colors"></i>
            <p class="text-sm text-blue-600 font-medium">คลิกเพื่ออัปโหลดไฟล์</p>
            <p class="text-xs text-gray-400 mt-1">หรือลากไฟล์มาวางที่นี่</p>
        `;
    }
}
