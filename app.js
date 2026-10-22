// ============================================================
// POC Test Tracker — Firebase Cloud Version
// ============================================================

// =============================================
// 🔥 FIREBASE CONFIG — PASTE YOUR CONFIG HERE
// =============================================
const firebaseConfig = {
    apiKey: "AIzaSyBYhQsnq3fLPlLjYNNHuftuZDd3BUAwOYg",
    authDomain: "poc-tracker-46580.firebaseapp.com",
    projectId: "poc-tracker-46580",
    storageBucket: "poc-tracker-46580.firebasestorage.app",
    messagingSenderId: "568469845077",
    appId: "1:568469845077:web:f80225c4a1bd6e640a10dc",
    measurementId: "G-HM82QL40RG"
};

// ---------- Firebase Init ----------
firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
const DB_DOC = firestore.collection('pocTracker').doc('mainData');

// ---------- State ----------
let db = { customers: [] };
let currentCustomerId = null;
let currentPocId = null;
let modalCallback = null;
let isLoading = true;

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
    showLoadingState();
    loadDataFromCloud();
});

function showLoadingState() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="welcome">
            <i class="fas fa-spinner fa-spin welcome-icon" style="font-size:48px;color:var(--primary)"></i>
            <h2>Connecting to database...</h2>
            <p>Loading your test cases from the cloud</p>
        </div>`;
}

// ============================================================
// DATA PERSISTENCE (Firebase Firestore)
// ============================================================
function loadDataFromCloud() {
    // Real-time listener: auto-syncs when anyone makes changes
    DB_DOC.onSnapshot((doc) => {
        if (doc.exists) {
            db = doc.data();
            if (!db.customers) db.customers = [];
        } else {
            db = { customers: [] };
            // Create the document if it doesn't exist
            DB_DOC.set(db);
        }
        isLoading = false;
        refreshCurrentView();
    }, (error) => {
        console.error('Firebase error:', error);
        toast('Cloud connection failed. Using local backup.', 'error');
        // Fallback to localStorage
        const stored = localStorage.getItem('pocTestTracker');
        if (stored) {
            try { db = JSON.parse(stored); } catch (e) { db = { customers: [] }; }
        }
        isLoading = false;
        refreshCurrentView();
    });
}

function saveData() {
    // Save to cloud
    DB_DOC.set(JSON.parse(JSON.stringify(db))).catch(err => {
        console.error('Save error:', err);
        toast('Error saving to cloud!', 'error');
    });
    // Also backup locally
    localStorage.setItem('pocTestTracker', JSON.stringify(db));
}

function refreshCurrentView() {
    // Restore the main content structure if it was replaced by loading
    const main = document.getElementById('mainContent');
    if (!main.querySelector('#dashboardView')) {
        main.innerHTML = `
            <!-- Dashboard (default view) -->
            <div id="dashboardView" class="view active">
                <div class="welcome">
                    <i class="fas fa-chart-line welcome-icon"></i>
                    <h2>Welcome to POC Test Tracker</h2>
                    <p>Select a customer from the sidebar or add a new one to get started.</p>
                    <div class="stats-grid" id="dashboardStats"></div>
                </div>
            </div>
            <!-- Customer View -->
            <div id="customerView" class="view">
                <div class="view-header">
                    <div>
                        <button class="btn btn-ghost btn-sm" onclick="showDashboard()">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <h2 id="customerTitle" class="inline-title"></h2>
                    </div>
                    <div class="view-actions">
                        <label class="btn btn-success">
                            <i class="fas fa-file-excel"></i> Upload Excel
                            <input type="file" accept=".xlsx,.xls,.csv" onchange="handleCustomerExcelUpload(event)" hidden>
                        </label>
                        <button class="btn btn-primary" onclick="showAddPocModal()">
                            <i class="fas fa-plus"></i> Add POC
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCurrentCustomer()">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="poc-grid" id="pocGrid"></div>
            </div>
            <!-- POC / Test Cases View -->
            <div id="pocView" class="view">
                <div class="view-header">
                    <div>
                        <button class="btn btn-ghost btn-sm" onclick="showCustomer(currentCustomerId)">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <h2 id="pocTitle" class="inline-title"></h2>
                        <span class="badge" id="pocBadge"></span>
                    </div>
                    <div class="view-actions">
                        <label class="btn btn-success">
                            <i class="fas fa-file-excel"></i> Upload Excel
                            <input type="file" accept=".xlsx,.xls,.csv" onchange="handleExcelUpload(event)" hidden>
                        </label>
                        <button class="btn btn-outline" onclick="exportPocToExcel()">
                            <i class="fas fa-download"></i> Export Excel
                        </button>
                        <button class="btn btn-primary" onclick="showAddTestCaseModal()">
                            <i class="fas fa-plus"></i> Add Test Case
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCurrentPoc()">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="filters-bar">
                    <div class="filter-group">
                        <label>Filter by Status:</label>
                        <select id="statusFilter" onchange="renderTestCases()">
                            <option value="all">All</option>
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                            <option value="Blocked">Blocked</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Not Executed">Not Executed</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Filter by Module:</label>
                        <select id="moduleFilter" onchange="renderTestCases()">
                            <option value="all">All</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <input type="text" id="searchInput" placeholder="Search test cases..." oninput="renderTestCases()">
                    </div>
                    <div class="stats-mini" id="pocStats"></div>
                </div>
                <div class="table-container">
                    <table class="test-table" id="testCaseTable">
                        <thead>
                            <tr>
                                <th class="col-no">#</th>
                                <th class="col-module">Module</th>
                                <th class="col-scenario">Scenario</th>
                                <th class="col-step">Execution Step</th>
                                <th class="col-expected">Expected Behavior</th>
                                <th class="col-actual">Actual Behavior</th>
                                <th class="col-comment">Comment</th>
                                <th class="col-status">Status</th>
                                <th class="col-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="testCaseBody"></tbody>
                    </table>
                    <div class="empty-state" id="emptyTestCases" style="display:none;">
                        <i class="fas fa-clipboard-list"></i>
                        <p>No test cases yet. Add manually or upload an Excel file.</p>
                    </div>
                </div>
            </div>`;
    }

    renderSidebar();
    // Re-render the current view
    if (currentPocId && currentCustomerId) {
        const poc = getPoc(currentCustomerId, currentPocId);
        if (poc) {
            showPoc(currentCustomerId, currentPocId);
        } else {
            showCustomer(currentCustomerId);
        }
    } else if (currentCustomerId) {
        const customer = getCustomer(currentCustomerId);
        if (customer) {
            showCustomer(currentCustomerId);
        } else {
            showDashboard();
        }
    } else {
        showDashboard();
    }
}

// ============================================================
// NAVIGATION
// ============================================================
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(viewId);
    if (el) el.classList.add('active');
}

function showDashboard() {
    currentCustomerId = null;
    currentPocId = null;
    showView('dashboardView');
    renderDashboard();
    highlightActiveCustomer();
}

function showCustomer(customerId) {
    currentCustomerId = customerId;
    currentPocId = null;
    const customer = getCustomer(customerId);
    if (!customer) return;
    document.getElementById('customerTitle').textContent = customer.name;
    showView('customerView');
    renderPocGrid();
    highlightActiveCustomer();
}

function showPoc(customerId, pocId) {
    currentCustomerId = customerId;
    currentPocId = pocId;
    const customer = getCustomer(customerId);
    const poc = getPoc(customerId, pocId);
    if (!customer || !poc) return;
    document.getElementById('pocTitle').textContent = `${customer.name} → ${poc.name}`;
    showView('pocView');
    populateModuleFilter();
    renderTestCases();
    highlightActiveCustomer();
}

function highlightActiveCustomer() {
    document.querySelectorAll('.customer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.id === currentCustomerId);
    });
}

// ============================================================
// HELPERS
// ============================================================
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function getCustomer(id) { return db.customers.find(c => c.id === id); }

function getPoc(customerId, pocId) {
    const c = getCustomer(customerId);
    return c ? c.pocs.find(p => p.id === pocId) : null;
}

function getTestCaseStats(testCases) {
    const stats = { total: testCases.length, Pass: 0, Fail: 0, Blocked: 0, 'In Progress': 0, 'Not Executed': 0 };
    testCases.forEach(tc => { if (stats[tc.status] !== undefined) stats[tc.status]++; });
    return stats;
}

// ============================================================
// RENDER: SIDEBAR
// ============================================================
function renderSidebar() {
    const list = document.getElementById('customerList');
    if (db.customers.length === 0) {
        list.innerHTML = '<p style="padding:16px;color:var(--gray-400);font-size:13px;text-align:center;">No customers yet</p>';
        return;
    }
    list.innerHTML = db.customers.map(c => `
        <div class="customer-item">
            <button class="customer-btn ${c.id === currentCustomerId ? 'active' : ''}" 
                    data-id="${c.id}" onclick="showCustomer('${c.id}')">
                <i class="fas fa-building"></i>
                ${escHtml(c.name)}
                <span class="count">${c.pocs.length} POC${c.pocs.length !== 1 ? 's' : ''}</span>
            </button>
        </div>
    `).join('');
}

// ============================================================
// RENDER: DASHBOARD
// ============================================================
function renderDashboard() {
    let totalCustomers = db.customers.length;
    let totalPocs = 0, totalTCs = 0, totalPass = 0, totalFail = 0;
    db.customers.forEach(c => {
        totalPocs += c.pocs.length;
        c.pocs.forEach(p => {
            totalTCs += p.testCases.length;
            p.testCases.forEach(tc => {
                if (tc.status === 'Pass') totalPass++;
                if (tc.status === 'Fail') totalFail++;
            });
        });
    });
    const statsEl = document.getElementById('dashboardStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card"><div class="stat-number">${totalCustomers}</div><div class="stat-label">Customers</div></div>
            <div class="stat-card"><div class="stat-number">${totalPocs}</div><div class="stat-label">POCs</div></div>
            <div class="stat-card"><div class="stat-number">${totalTCs}</div><div class="stat-label">Test Cases</div></div>
            <div class="stat-card"><div class="stat-number" style="color:var(--success)">${totalPass}</div><div class="stat-label">Passed</div></div>
            <div class="stat-card"><div class="stat-number" style="color:var(--danger)">${totalFail}</div><div class="stat-label">Failed</div></div>
        `;
    }
}

// ============================================================
// RENDER: POC GRID
// ============================================================
function renderPocGrid() {
    const customer = getCustomer(currentCustomerId);
    const grid = document.getElementById('pocGrid');
    if (!customer || customer.pocs.length === 0) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>No POCs yet. Click "Add POC" or "Upload Excel" to create one.</p></div>`;
        return;
    }
    grid.innerHTML = customer.pocs.map(poc => {
        const stats = getTestCaseStats(poc.testCases);
        const passRate = stats.total > 0 ? Math.round((stats.Pass / stats.total) * 100) : 0;
        const progressClass = passRate >= 70 ? 'good' : passRate >= 40 ? 'medium' : 'bad';
        return `
        <div class="poc-card" onclick="showPoc('${customer.id}', '${poc.id}')">
            <h3><i class="fas fa-flask" style="color:var(--primary);margin-right:6px;"></i>${escHtml(poc.name)}</h3>
            <div class="poc-meta">
                <span><i class="fas fa-list-check"></i> ${stats.total} test cases</span>
                <span><i class="fas fa-chart-pie"></i> ${passRate}% pass rate</span>
            </div>
            <div class="progress-bar"><div class="progress-fill ${progressClass}" style="width:${passRate}%"></div></div>
            <div class="poc-stats-row">
                <span class="poc-stat-badge badge-pass">${stats.Pass} Pass</span>
                <span class="poc-stat-badge badge-fail">${stats.Fail} Fail</span>
                <span class="poc-stat-badge badge-blocked" style="background:var(--blocked-bg);color:var(--blocked)">${stats.Blocked} Blocked</span>
                <span class="poc-stat-badge badge-gray">${stats['Not Executed']} Pending</span>
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// RENDER: TEST CASES TABLE
// ============================================================
function renderTestCases() {
    const poc = getPoc(currentCustomerId, currentPocId);
    if (!poc) return;

    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const moduleFilter = document.getElementById('moduleFilter')?.value || 'all';
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();

    let filtered = poc.testCases.filter(tc => {
        if (statusFilter !== 'all' && tc.status !== statusFilter) return false;
        if (moduleFilter !== 'all' && tc.module !== moduleFilter) return false;
        if (search) {
            const text = [tc.module, tc.scenario, tc.execStep, tc.expectedBehavior, tc.actualBehavior, tc.comment].join(' ').toLowerCase();
            if (!text.includes(search)) return false;
        }
        return true;
    });

    const tbody = document.getElementById('testCaseBody');
    const emptyMsg = document.getElementById('emptyTestCases');
    const table = document.querySelector('.test-table');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        table.style.display = 'none';
    } else {
        emptyMsg.style.display = 'none';
        table.style.display = 'table';
        tbody.innerHTML = filtered.map((tc) => {
            const statusClass = 'status-' + tc.status.toLowerCase().replace(/\s+/g, '-');
            return `
            <tr data-id="${tc.id}">
                <td class="col-no" style="text-align:center;font-weight:600;color:var(--gray-400)">${tc.testNo}</td>
                <td><div class="editable-cell" contenteditable="true" data-field="module" data-id="${tc.id}" onblur="onCellEdit(this)">${escHtml(tc.module)}</div></td>
                <td><div class="editable-cell" contenteditable="true" data-field="scenario" data-id="${tc.id}" onblur="onCellEdit(this)">${escHtml(tc.scenario)}</div></td>
                <td><div class="editable-cell" contenteditable="true" data-field="execStep" data-id="${tc.id}" onblur="onCellEdit(this)">${escHtml(tc.execStep)}</div></td>
                <td><div class="editable-cell" contenteditable="true" data-field="expectedBehavior" data-id="${tc.id}" onblur="onCellEdit(this)">${escHtml(tc.expectedBehavior)}</div></td>
                <td><div class="editable-cell" contenteditable="true" data-field="actualBehavior" data-id="${tc.id}" onblur="onCellEdit(this)">${escHtml(tc.actualBehavior)}</div></td>
                <td><div class="editable-cell" contenteditable="true" data-field="comment" data-id="${tc.id}" onblur="onCellEdit(this)">${escHtml(tc.comment)}</div></td>
                <td>
                    <select class="status-select ${statusClass}" data-id="${tc.id}" onchange="onStatusChange(this)">
                        <option value="Not Executed" ${tc.status === 'Not Executed' ? 'selected' : ''}>Not Executed</option>
                        <option value="In Progress" ${tc.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Pass" ${tc.status === 'Pass' ? 'selected' : ''}>Pass</option>
                        <option value="Fail" ${tc.status === 'Fail' ? 'selected' : ''}>Fail</option>
                        <option value="Blocked" ${tc.status === 'Blocked' ? 'selected' : ''}>Blocked</option>
                    </select>
                </td>
                <td class="col-actions">
                    <div class="row-actions">
                        <button title="Delete" onclick="deleteTestCase('${tc.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // Update stats
    const allStats = getTestCaseStats(poc.testCases);
    const pocStatsEl = document.getElementById('pocStats');
    if (pocStatsEl) {
        pocStatsEl.innerHTML = `
            <span class="badge badge-pass">${allStats.Pass} Pass</span>
            <span class="badge badge-fail">${allStats.Fail} Fail</span>
            <span class="badge" style="background:var(--blocked-bg);color:var(--blocked)">${allStats.Blocked} Blocked</span>
            <span class="badge badge-info">${allStats['In Progress']} In Prog</span>
            <span class="badge badge-gray">${allStats['Not Executed']} Pending</span>
        `;
    }
    const pocBadge = document.getElementById('pocBadge');
    if (pocBadge) {
        pocBadge.textContent = `${allStats.total} test cases`;
        pocBadge.className = 'badge badge-info';
    }
}

function populateModuleFilter() {
    const poc = getPoc(currentCustomerId, currentPocId);
    const select = document.getElementById('moduleFilter');
    if (!select) return;
    const modules = [...new Set((poc?.testCases || []).map(tc => tc.module).filter(Boolean))];
    select.innerHTML = '<option value="all">All</option>' + modules.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
}

// ============================================================
// INLINE EDITING
// ============================================================
function onCellEdit(el) {
    const tcId = el.dataset.id;
    const field = el.dataset.field;
    const value = el.innerText.trim();
    const poc = getPoc(currentCustomerId, currentPocId);
    if (!poc) return;
    const tc = poc.testCases.find(t => t.id === tcId);
    if (tc && tc[field] !== value) {
        tc[field] = value;
        saveData();
    }
}

function onStatusChange(el) {
    const tcId = el.dataset.id;
    const value = el.value;
    const poc = getPoc(currentCustomerId, currentPocId);
    if (!poc) return;
    const tc = poc.testCases.find(t => t.id === tcId);
    if (tc) {
        tc.status = value;
        saveData();
        renderTestCases();
    }
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

// --- Customer ---
function showAddCustomerModal() {
    openModal('Add Customer', `
        <div class="form-group">
            <label>Customer Name</label>
            <input type="text" id="modalInput1" placeholder="e.g. Acme Corp" autofocus>
        </div>
    `, () => {
        const name = document.getElementById('modalInput1').value.trim();
        if (!name) { toast('Please enter a name', 'error'); return false; }
        db.customers.push({ id: genId(), name, pocs: [] });
        saveData();
        renderSidebar();
        renderDashboard();
        toast(`Customer "${name}" added!`, 'success');
    });
}

function deleteCurrentCustomer() {
    if (!currentCustomerId) return;
    const c = getCustomer(currentCustomerId);
    if (!confirm(`Delete customer "${c.name}" and ALL its POCs & test cases?`)) return;
    db.customers = db.customers.filter(c => c.id !== currentCustomerId);
    saveData();
    renderSidebar();
    showDashboard();
    toast('Customer deleted', 'info');
}

// --- POC ---
function showAddPocModal() {
    openModal('Add POC', `
        <div class="form-group">
            <label>POC Name</label>
            <input type="text" id="modalInput1" placeholder="e.g. SSO Integration POC" autofocus>
        </div>
    `, () => {
        const name = document.getElementById('modalInput1').value.trim();
        if (!name) { toast('Please enter a name', 'error'); return false; }
        const customer = getCustomer(currentCustomerId);
        customer.pocs.push({ id: genId(), name, testCases: [] });
        saveData();
        renderPocGrid();
        renderSidebar();
        toast(`POC "${name}" added!`, 'success');
    });
}

function deleteCurrentPoc() {
    if (!currentPocId) return;
    const poc = getPoc(currentCustomerId, currentPocId);
    if (!confirm(`Delete POC "${poc.name}" and all its test cases?`)) return;
    const customer = getCustomer(currentCustomerId);
    customer.pocs = customer.pocs.filter(p => p.id !== currentPocId);
    saveData();
    showCustomer(currentCustomerId);
    renderSidebar();
    toast('POC deleted', 'info');
}

// --- Test Case ---
function showAddTestCaseModal() {
    const poc = getPoc(currentCustomerId, currentPocId);
    const nextNo = poc ? poc.testCases.length + 1 : 1;
    openModal('Add Test Case', `
        <div class="form-group"><label>Test No.</label><input type="number" id="tcNo" value="${nextNo}"></div>
        <div class="form-group"><label>Module</label><input type="text" id="tcModule" placeholder="e.g. Authentication"></div>
        <div class="form-group"><label>Scenario</label><textarea id="tcScenario" placeholder="e.g. Login with valid credentials"></textarea></div>
        <div class="form-group"><label>Execution Step</label><textarea id="tcStep" placeholder="e.g. 1. Open app  2. Enter credentials  3. Click Login"></textarea></div>
        <div class="form-group"><label>Expected Behavior</label><textarea id="tcExpected" placeholder="e.g. User is redirected to dashboard"></textarea></div>
        <div class="form-group"><label>Status</label>
            <select id="tcStatus">
                <option value="Not Executed">Not Executed</option>
                <option value="In Progress">In Progress</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
                <option value="Blocked">Blocked</option>
            </select>
        </div>
    `, () => {
        const poc = getPoc(currentCustomerId, currentPocId);
        poc.testCases.push({
            id: genId(),
            testNo: parseInt(document.getElementById('tcNo').value) || poc.testCases.length + 1,
            module: document.getElementById('tcModule').value.trim(),
            scenario: document.getElementById('tcScenario').value.trim(),
            execStep: document.getElementById('tcStep').value.trim(),
            expectedBehavior: document.getElementById('tcExpected').value.trim(),
            actualBehavior: '',
            comment: '',
            status: document.getElementById('tcStatus').value
        });
        saveData();
        renderTestCases();
        populateModuleFilter();
        toast('Test case added!', 'success');
    });
}

function deleteTestCase(tcId) {
    const poc = getPoc(currentCustomerId, currentPocId);
    if (!poc) return;
    poc.testCases = poc.testCases.filter(t => t.id !== tcId);
    poc.testCases.forEach((tc, i) => tc.testNo = i + 1);
    saveData();
    renderTestCases();
    toast('Test case deleted', 'info');
}

// ============================================================
// EXCEL UPLOAD & CONVERSION
// ============================================================

// --- Upload at CUSTOMER level: creates POCs from sheets or POC column ---
function handleCustomerExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            const customer = getCustomer(currentCustomerId);
            if (!customer) return;

            let totalAdded = 0;
            let pocsCreated = 0;

            if (workbook.SheetNames.length > 1) {
                // Multi-sheet: each sheet is a POC
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    if (rows.length === 0) return;

                    const poc = createOrGetPoc(customer, sheetName.trim());
                    const colMap = detectColumns(Object.keys(rows[0]));
                    rows.forEach(row => {
                        poc.testCases.push(rowToTestCase(row, colMap, poc.testCases.length + 1));
                        totalAdded++;
                    });
                    pocsCreated++;
                });
            } else {
                // Single sheet: check for POC column
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                if (rows.length === 0) { toast('Excel file is empty!', 'error'); return; }

                const headers = Object.keys(rows[0]);
                const colMap = detectColumns(headers);
                const pocCol = detectPocColumn(headers);

                if (pocCol) {
                    const groups = {};
                    rows.forEach(row => {
                        const pocName = String(row[pocCol] || 'Default POC').trim();
                        if (!groups[pocName]) groups[pocName] = [];
                        groups[pocName].push(row);
                    });
                    Object.entries(groups).forEach(([pocName, groupRows]) => {
                        const poc = createOrGetPoc(customer, pocName);
                        groupRows.forEach(row => {
                            poc.testCases.push(rowToTestCase(row, colMap, poc.testCases.length + 1));
                            totalAdded++;
                        });
                        pocsCreated++;
                    });
                } else {
                    const pocName = file.name.replace(/\.(xlsx|xls|csv)$/i, '').trim() || 'Imported POC';
                    const poc = createOrGetPoc(customer, pocName);
                    rows.forEach(row => {
                        poc.testCases.push(rowToTestCase(row, colMap, poc.testCases.length + 1));
                        totalAdded++;
                    });
                    pocsCreated = 1;
                }
            }

            saveData();
            renderPocGrid();
            renderSidebar();
            renderDashboard();
            toast(`Imported ${totalAdded} test cases into ${pocsCreated} POC(s)!`, 'success');
        } catch (err) {
            console.error(err);
            toast('Error reading Excel file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// --- Upload at POC level: adds test cases to current POC ---
function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (rows.length === 0) { toast('Excel file is empty!', 'error'); return; }

            const poc = getPoc(currentCustomerId, currentPocId);
            if (!poc) return;

            const colMap = detectColumns(Object.keys(rows[0]));
            let added = 0;
            rows.forEach(row => {
                poc.testCases.push(rowToTestCase(row, colMap, poc.testCases.length + 1));
                added++;
            });

            saveData();
            renderTestCases();
            populateModuleFilter();
            renderSidebar();
            toast(`Imported ${added} test cases from Excel!`, 'success');
        } catch (err) {
            console.error(err);
            toast('Error reading Excel file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// --- Helpers for Excel import ---
function rowToTestCase(row, colMap, testNo) {
    return {
        id: genId(),
        testNo: testNo,
        module: String(row[colMap.module] || '').trim(),
        scenario: String(row[colMap.scenario] || '').trim(),
        execStep: String(row[colMap.execStep] || '').trim(),
        expectedBehavior: String(row[colMap.expected] || '').trim(),
        actualBehavior: String(row[colMap.actual] || '').trim(),
        comment: String(row[colMap.comment] || '').trim(),
        status: normalizeStatus(String(row[colMap.status] || 'Not Executed').trim())
    };
}

function createOrGetPoc(customer, pocName) {
    let poc = customer.pocs.find(p => p.name.toLowerCase() === pocName.toLowerCase());
    if (!poc) {
        poc = { id: genId(), name: pocName, testCases: [] };
        customer.pocs.push(poc);
    }
    return poc;
}

function detectPocColumn(headers) {
    const lower = headers.map(h => h.toLowerCase());
    const keywords = ['poc', 'proof of concept', 'project', 'poc name', 'poc_name'];
    for (const kw of keywords) {
        const idx = lower.findIndex(h => h.includes(kw));
        if (idx !== -1) return headers[idx];
    }
    return null;
}

function detectColumns(headers) {
    const lower = headers.map(h => h.toLowerCase());
    function find(keywords) {
        for (const kw of keywords) {
            const idx = lower.findIndex(h => h.includes(kw));
            if (idx !== -1) return headers[idx];
        }
        return null;
    }
    return {
        module:   find(['module', 'component', 'feature', 'area']) || headers[1] || '',
        scenario: find(['scenario', 'test case', 'testcase', 'description', 'title', 'name']) || headers[2] || '',
        execStep: find(['exec', 'step', 'procedure', 'action', 'steps']) || headers[3] || '',
        expected: find(['expected', 'expect']) || headers[4] || '',
        actual:   find(['actual', 'result', 'observed']) || headers[5] || '',
        comment:  find(['comment', 'note', 'remark', 'observation']) || headers[6] || '',
        status:   find(['status', 'verdict', 'outcome', 'pass', 'result']) || headers[7] || ''
    };
}

function normalizeStatus(s) {
    const l = s.toLowerCase();
    if (l.includes('pass') || l === 'p' || l === 'yes' || l === 'ok') return 'Pass';
    if (l.includes('fail') || l === 'f' || l === 'no' || l === 'nok') return 'Fail';
    if (l.includes('block')) return 'Blocked';
    if (l.includes('progress') || l.includes('wip')) return 'In Progress';
    return 'Not Executed';
}

// ============================================================
// EXCEL EXPORT
// ============================================================
function exportPocToExcel() {
    const poc = getPoc(currentCustomerId, currentPocId);
    const customer = getCustomer(currentCustomerId);
    if (!poc || poc.testCases.length === 0) { toast('No test cases to export', 'error'); return; }

    const data = poc.testCases.map(tc => ({
        'Test No.': tc.testNo,
        'Module': tc.module,
        'Scenario': tc.scenario,
        'Execution Step': tc.execStep,
        'Expected Behavior': tc.expectedBehavior,
        'Actual Behavior': tc.actualBehavior,
        'Comment': tc.comment,
        'Status': tc.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
        { wch: 8 }, { wch: 15 }, { wch: 30 }, { wch: 35 },
        { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 14 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, poc.name.slice(0, 31));
    XLSX.writeFile(wb, `${customer.name}_${poc.name}_TestCases.xlsx`);
    toast('Excel exported!', 'success');
}

// ============================================================
// FULL DATA BACKUP / RESTORE (JSON)
// ============================================================
function exportAllDataJSON() {
    const json = JSON.stringify(db, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poc-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded!', 'success');
}

function importAllDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.customers || !Array.isArray(imported.customers)) {
                toast('Invalid backup file', 'error');
                return;
            }
            if (!confirm(`This will REPLACE all current data with the backup (${imported.customers.length} customers). Continue?`)) return;
            db = imported;
            saveData();
            renderSidebar();
            showDashboard();
            toast('Data restored from backup!', 'success');
        } catch (err) {
            toast('Error reading backup: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(title, bodyHtml, onSave) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('active');
    modalCallback = onSave;
    setTimeout(() => {
        const firstInput = document.querySelector('#modalBody input, #modalBody textarea');
        if (firstInput) firstInput.focus();
    }, 100);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    modalCallback = null;
}

function modalSave() {
    if (modalCallback) {
        const result = modalCallback();
        if (result !== false) closeModal();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && document.getElementById('modalOverlay').classList.contains('active')) {
        const active = document.activeElement;
        if (active && active.tagName !== 'TEXTAREA') {
            e.preventDefault();
            modalSave();
        }
    }
    if (e.key === 'Escape') closeModal();
});

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${escHtml(message)}`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ============================================================
// UTILS
// ============================================================
function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
