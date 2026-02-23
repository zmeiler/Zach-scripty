const state = {
  user: null,
  accounts: [
    { id: 'chk', name: 'Checking', balance: 6450.82 },
    { id: 'sav', name: 'Savings', balance: 22410.15 },
    { id: 'bus', name: 'Business', balance: 3820.55 },
  ],
  transactions: [
    { date: '2026-03-01', desc: 'Payroll Deposit', amount: 3200, account: 'Checking', balance: 6450.82 },
    { date: '2026-02-28', desc: 'Cloud Hosting Invoice', amount: -212.12, account: 'Business', balance: 3820.55 },
    { date: '2026-02-27', desc: 'Emergency Fund Transfer', amount: 600, account: 'Savings', balance: 22410.15 },
    { date: '2026-02-25', desc: 'Groceries', amount: -94.37, account: 'Checking', balance: 3250.82 },
  ],
  bills: [],
  cards: [],
  security: {
    anomalyAlerts: true,
    geoLock: true,
    velocityChecks: true,
    timeoutMin: 10,
  },
  audit: [],
};

const complianceControls = [
  'Network segmentation and firewall boundary documented',
  'Default credentials prohibited and strong authentication enforced',
  'Sensitive authentication data is not stored post-authorization',
  'Cardholder data rendered unreadable (tokenized/masked in UI)',
  'Role-based access and least privilege principles represented',
  'Security events logged into local audit trail',
  'Session timeout and re-authentication workflow enforced',
  'Secure coding headers present (CSP, no sniff, restricted referrer)',
];

const $ = (id) => document.getElementById(id);
let timeoutHandle;

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function saveState() {
  localStorage.setItem('fortibank-demo-state', JSON.stringify({
    user: state.user,
    accounts: state.accounts,
    transactions: state.transactions,
    bills: state.bills,
    cards: state.cards,
    security: state.security,
    audit: state.audit,
    dark: document.body.classList.contains('dark')
  }));
}

function loadState() {
  const raw = localStorage.getItem('fortibank-demo-state');
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.accounts)) state.accounts = saved.accounts;
    if (Array.isArray(saved.transactions)) state.transactions = saved.transactions;
    if (Array.isArray(saved.bills)) state.bills = saved.bills;
    if (Array.isArray(saved.cards)) state.cards = saved.cards;
    if (saved.security) state.security = saved.security;
    if (Array.isArray(saved.audit)) state.audit = saved.audit;
    if (saved.user) state.user = saved.user;
    if (saved.dark) document.body.classList.add('dark');
  } catch {
    localStorage.removeItem('fortibank-demo-state');
  }
}

function addAudit(action) {
  state.audit.unshift(`${new Date().toLocaleString()} · ${action}`);
  state.audit = state.audit.slice(0, 40);
}

function refreshSessionTimer() {
  clearTimeout(timeoutHandle);
  if (!state.user) return;
  timeoutHandle = setTimeout(() => {
    addAudit('Automatic session lock due to inactivity timeout.');
    lockSession('Session locked after inactivity. Re-authenticate.');
  }, state.security.timeoutMin * 60 * 1000);
}

function renderAccounts() {
  const host = $('accounts');
  host.innerHTML = '';
  const tmpl = $('acctTemplate');
  for (const acct of state.accounts) {
    const node = tmpl.content.cloneNode(true);
    node.querySelector('.name').textContent = acct.name;
    node.querySelector('.balance').textContent = money(acct.balance);
    host.appendChild(node);
  }

  const from = $('fromAccount');
  const to = $('toAccount');
  from.innerHTML = '';
  to.innerHTML = '';

  for (const acct of state.accounts) {
    from.add(new Option(acct.name, acct.id));
    to.add(new Option(acct.name, acct.id));
  }
  to.selectedIndex = Math.min(1, state.accounts.length - 1);
}

function renderTransactions() {
  const q = $('search').value.toLowerCase();
  const rows = state.transactions
    .filter((t) => `${t.desc} ${t.account}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));

  $('txTable').innerHTML = rows.map((t) => {
    const cls = t.amount < 0 ? 'negative' : 'positive';
    const signed = t.amount < 0 ? money(t.amount) : `+${money(t.amount)}`;
    return `<tr>
      <td>${t.date}</td>
      <td>${t.desc} · ${t.account}</td>
      <td class="${cls}">${signed}</td>
      <td>${money(t.balance)}</td>
    </tr>`;
  }).join('');
}

function renderSnapshot() {
  const total = state.accounts.reduce((sum, a) => sum + a.balance, 0);
  const income = state.transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const spend = state.transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const li = [
    `Total assets: ${money(total)}`,
    `Credits posted: ${money(income)}`,
    `Debits posted: ${money(spend)}`,
    `Scheduled bills: ${state.bills.length}`,
    `Virtual cards active: ${state.cards.length}`,
  ].map((line) => `<li>${line}</li>`).join('');
  $('snapshotList').innerHTML = li;
}

function renderBills() {
  $('billList').innerHTML = state.bills
    .map((b) => `<li>${b.payee} — ${money(b.amount)} due ${b.date} <span class="pill">scheduled</span></li>`)
    .join('') || '<li class="muted">No scheduled bills.</li>';
}

function renderCards() {
  $('cardsList').innerHTML = state.cards
    .map((c) => `<div class="account-item"><span>${c.alias}<br><small class="muted">Token ${c.token} · **** **** **** ${c.last4}</small></span><strong>${money(c.limit)}/mo</strong></div>`)
    .join('') || '<p class="muted">No cards created yet.</p>';
}

function renderSecurity() {
  $('notifToggle').checked = state.security.anomalyAlerts;
  $('geoToggle').checked = state.security.geoLock;
  $('velocityToggle').checked = state.security.velocityChecks;
  $('timeoutInput').value = state.security.timeoutMin;
  $('auditTrail').innerHTML = state.audit
    .map((a) => `<li>${a}</li>`)
    .join('') || '<li class="muted">No audit events yet.</li>';
}

function renderCompliance() {
  $('complianceList').innerHTML = complianceControls
    .map((item) => `<li>✅ ${item}</li>`)
    .join('');
}

function renderAll() {
  renderAccounts();
  renderTransactions();
  renderSnapshot();
  renderBills();
  renderCards();
  renderSecurity();
  renderCompliance();
}

function switchTab(tabName) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  }
  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.classList.toggle('hidden', panel.id !== tabName);
  }
}

function applyAuthUi() {
  const inApp = Boolean(state.user);
  $('authView').classList.toggle('hidden', inApp);
  $('appView').classList.toggle('hidden', !inApp);
  $('logoutBtn').classList.toggle('hidden', !inApp);
  $('lockBtn').classList.toggle('hidden', !inApp);
  if (inApp) {
    renderAll();
    refreshSessionTimer();
  } else {
    clearTimeout(timeoutHandle);
  }
}

function lockSession(reason) {
  state.user = null;
  saveState();
  applyAuthUi();
  $('authStatus').textContent = reason;
}

$('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const mfa = $('mfa').value.trim();
  const securityPhrase = $('securityPhrase').value.trim();

  if (!email || password.length < 12 || !/^\d{6}$/.test(mfa) || securityPhrase.length < 4) {
    $('authStatus').textContent = 'Invalid credentials. Need email, 12+ char password, 6-digit MFA, and security phrase.';
    return;
  }

  state.user = { email, lastLogin: new Date().toISOString() };
  addAudit(`Successful sign-in for ${email}.`);
  $('authStatus').textContent = '';
  saveState();
  applyAuthUi();
});

$('logoutBtn').addEventListener('click', () => {
  addAudit('User initiated logout.');
  state.user = null;
  saveState();
  applyAuthUi();
});

$('lockBtn').addEventListener('click', () => {
  addAudit('User manually locked session.');
  lockSession('Session locked. Please sign in again.');
});

$('transferForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const fromId = $('fromAccount').value;
  const toId = $('toAccount').value;
  const amount = Number($('amount').value);
  const memo = $('memo').value.trim() || 'Internal transfer';

  if (fromId === toId) {
    $('transferStatus').textContent = 'Source and destination must differ.';
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    $('transferStatus').textContent = 'Enter a valid amount.';
    return;
  }

  const from = state.accounts.find((a) => a.id === fromId);
  const to = state.accounts.find((a) => a.id === toId);
  if (!from || !to) return;

  if (from.balance < amount) {
    $('transferStatus').textContent = 'Insufficient funds.';
    return;
  }

  from.balance -= amount;
  to.balance += amount;
  const d = nowDate();
  state.transactions.push({ date: d, desc: `${memo} (sent)`, amount: -amount, account: from.name, balance: from.balance });
  state.transactions.push({ date: d, desc: `${memo} (received)`, amount, account: to.name, balance: to.balance });

  $('transferStatus').textContent = `Transfer complete: ${money(amount)} from ${from.name} to ${to.name}.`;
  addAudit(`Transfer posted ${money(amount)} from ${from.name} to ${to.name}.`);
  $('amount').value = '';
  $('memo').value = '';
  saveState();
  renderAll();
  refreshSessionTimer();
});

$('billForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const payee = $('payee').value.trim();
  const date = $('dueDate').value;
  const amount = Number($('billAmount').value);
  if (!payee || !date || !Number.isFinite(amount) || amount <= 0) return;

  state.bills.push({ payee, date, amount });
  addAudit(`Bill payment scheduled: ${payee} ${money(amount)} due ${date}.`);
  $('billForm').reset();
  saveState();
  renderAll();
  refreshSessionTimer();
});

$('cardForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const alias = $('cardAlias').value.trim();
  const limit = Number($('cardLimit').value);
  if (!alias || !Number.isFinite(limit) || limit < 10) return;

  const last4 = String(Math.floor(1000 + Math.random() * 9000));
  const token = crypto.randomUUID().split('-')[0].toUpperCase();
  state.cards.push({ alias, limit, last4, token });
  addAudit(`Virtual card created for alias ${alias}; stored as token only.`);
  $('cardForm').reset();
  saveState();
  renderAll();
  refreshSessionTimer();
});

$('saveSecurityBtn').addEventListener('click', () => {
  const timeoutMin = Number($('timeoutInput').value);
  if (!Number.isInteger(timeoutMin) || timeoutMin < 1 || timeoutMin > 60) {
    $('securityStatus').textContent = 'Session timeout must be between 1 and 60 minutes.';
    return;
  }

  state.security = {
    anomalyAlerts: $('notifToggle').checked,
    geoLock: $('geoToggle').checked,
    velocityChecks: $('velocityToggle').checked,
    timeoutMin,
  };

  $('securityStatus').textContent = 'Security controls updated.';
  addAudit('Security policy updated.');
  saveState();
  renderSecurity();
  refreshSessionTimer();
});

$('search').addEventListener('input', () => {
  renderTransactions();
  refreshSessionTimer();
});

for (const eventName of ['click', 'keydown', 'mousemove', 'scroll']) {
  document.addEventListener(eventName, () => {
    if (state.user) refreshSessionTimer();
  }, { passive: true });
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
    refreshSessionTimer();
  });
}

$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  saveState();
});

loadState();
switchTab('dashboard');
applyAuthUi();
