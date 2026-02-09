const actionStatus = () => document.getElementById('action-status');

const updateStatus = (message) => {
  const status = actionStatus();
  if (status) {
    status.textContent = message;
  }
};

const handleAction = (item) => {
  const message = item.action
    ? `Action triggered: ${item.label}`
    : `Selected ${item.label}`;
  updateStatus(message);
  console.log(message);
};

const createButton = (item) => {
  const button = document.createElement('button');
  button.className = `square-button ${item.color || ''}`.trim();
  button.textContent = item.label;
  button.addEventListener('click', () => handleAction(item));
  return button;
};

const wireActionButtons = () => {
  document.querySelectorAll('.action').forEach((button) => {
    button.addEventListener('click', () => {
      const label = button.textContent?.trim() || 'Action';
      updateStatus(`Action triggered: ${label}`);
      console.log(`Action triggered: ${label}`);
    });
  });
};

const renderButtons = (containerId, items) => {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach((item) => {
    container.appendChild(createButton(item));
  });
};

const renderOrderItems = (items) => {
  const container = document.getElementById('order-items');
  container.innerHTML = '';

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'ticket-row';

    const description = document.createElement('div');
    description.className = 'ticket-item';

    const name = document.createElement('strong');
    name.textContent = item.name;

    const modifier = document.createElement('span');
    modifier.textContent = item.modifier;

    description.appendChild(name);
    description.appendChild(modifier);

    const qty = document.createElement('div');
    qty.textContent = String(item.quantity);

    const price = document.createElement('div');
    price.textContent = item.price;

    row.appendChild(description);
    row.appendChild(qty);
    row.appendChild(price);

    container.appendChild(row);
  });
};

const renderSummary = (items) => {
  const container = document.getElementById('summary');
  container.innerHTML = '';

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = `summary-row${item.emphasis ? ' emphasis' : ''}`;

    const label = document.createElement('span');
    label.textContent = item.label;

    const value = document.createElement('span');
    value.textContent = item.value;

    row.appendChild(label);
    row.appendChild(value);

    container.appendChild(row);
  });
};

const populate = (layout) => {
  renderButtons('quick-actions', layout.quickActions);
  renderButtons('keypad', layout.keypad);
  renderButtons('categories', layout.categoryTabs);
  renderButtons('menu', layout.menuButtons);
  renderButtons('tender', layout.tenderButtons);
  renderButtons('pinpad-modes', layout.pinpadModes);
  renderButtons('ebt-options', layout.ebtOptions);
  renderButtons('left-ops', layout.leftSideButtons);
  renderButtons('right-ops', layout.rightSideButtons);
  renderOrderItems(layout.orderItems);
  renderSummary(layout.summary);
  updateStatus('Ready for next order.');
  wireActionButtons();
};

document.addEventListener('DOMContentLoaded', () => {
  fetch('pos-layout.json')
    .then((response) => response.json())
    .then((layout) => populate(layout));
});
