const createButton = (item) => {
  const button = document.createElement('button');
  button.className = `square-button ${item.color || ''}`.trim();
  button.textContent = item.label;
  return button;
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
  renderOrderItems(layout.orderItems);
  renderSummary(layout.summary);
};

document.addEventListener('DOMContentLoaded', () => {
  fetch('pos-layout.json')
    .then((response) => response.json())
    .then((layout) => populate(layout));
});
