const state = {
  user: null,
  accounts: [
    { id: 'chk', name: 'Checking', balance: 4250.36 },
    { id: 'sav', name: 'Savings', balance: 12840.11 },
    { id: 'trv', name: 'Travel', balance: 650.0 },
  ],
  transactions: [
    { date: '2026-02-20', desc: 'Payroll Deposit', amount: 2600, account: 'Checking', balance: 4250.36 },
    { date: '2026-02-18', desc: 'Groceries', amount: -84.27, account: 'Checking', balance: 1650.36 },
    { date: '2026-02-16', desc: 'Coffee', amount: -5.75, account: 'Checking', balance: 1734.63 },
    { date: '2026-02-14', desc: 'Savings Transfer', amount: 300, account: 'Savings', balance: 12840.11 },
  ]
};

const $ = (id) => document.getElementById(id);

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function persist() {
  localStorage.setItem('vaultwave-state', JSON.stringify({
    user: state.user,
    accounts: state.accounts,
    transactions: state.transactions,
    dark: document.body.classList.contains('dark')
  }));
}

function hydrate() {
  const raw = localStorage.getItem('vaultwave-state');
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved.accounts && saved.transactions) {
      state.accounts = saved.accounts;
      state.transactions = saved.transactions;
    }
    if (saved.user) state.user = saved.user;
    if (saved.dark) document.body.classList.add('dark');
  } catch {}
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
    const opt1 = new Option(acct.name, acct.id);
    const opt2 = new Option(acct.name, acct.id);
    from.add(opt1); to.add(opt2);
  }
  to.selectedIndex = Math.min(1, state.accounts.length - 1);
}

function renderTransactions() {
  const q = $('search').value.toLowerCase();
  const rows = state.transactions
    .filter(t => `${t.desc} ${t.account}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));

  $('txTable').innerHTML = rows.map(t => {
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

function applyAuthUi() {
  const inApp = Boolean(state.user);
  $('authView').classList.toggle('hidden', inApp);
  $('appView').classList.toggle('hidden', !inApp);
  $('logoutBtn').classList.toggle('hidden', !inApp);
  if (inApp) {
    renderAccounts();
    renderTransactions();
  }
}

$('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const mfa = $('mfa').value.trim();

  if (!email || password.length < 8 || !/^\d{6}$/.test(mfa)) {
    alert('Please provide valid credentials and a 6-digit MFA code.');
    return;
  }

  state.user = { email, lastLogin: new Date().toISOString() };
  persist();
  applyAuthUi();
});

$('logoutBtn').addEventListener('click', () => {
  state.user = null;
  persist();
  applyAuthUi();
});

$('transferForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const fromId = $('fromAccount').value;
  const toId = $('toAccount').value;
  const amount = Number($('amount').value);
  const memo = $('memo').value.trim() || 'Transfer';

  if (fromId === toId) {
    $('transferStatus').textContent = 'Source and destination must differ.';
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    $('transferStatus').textContent = 'Enter a valid amount.';
    return;
  }

  const from = state.accounts.find(a => a.id === fromId);
  const to = state.accounts.find(a => a.id === toId);
  if (!from || !to) return;

  if (from.balance < amount) {
    $('transferStatus').textContent = 'Insufficient funds.';
    return;
  }

  from.balance -= amount;
  to.balance += amount;
  const d = new Date().toISOString().slice(0, 10);
  state.transactions.push({ date: d, desc: `${memo} (sent)`, amount: -amount, account: from.name, balance: from.balance });
  state.transactions.push({ date: d, desc: `${memo} (received)`, amount, account: to.name, balance: to.balance });

  $('transferStatus').textContent = `Transfer complete: ${money(amount)} from ${from.name} to ${to.name}.`;
  $('amount').value = '';
  $('memo').value = '';
  persist();
  renderAccounts();
  renderTransactions();
});

$('search').addEventListener('input', renderTransactions);
$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  persist();
});

hydrate();
applyAuthUi();
