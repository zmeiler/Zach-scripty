const API_BASE = window.API_BASE || "http://localhost:8000";

const statusEl = document.getElementById("status");
const tickerBody = document.getElementById("ticker-body");
const reviewList = document.getElementById("review-list");
const directoryBody = document.getElementById("pa-directory-body");
const tickerTape = document.getElementById("ticker-tape");

const tickerRows = new Map();

function addTapeItem(text) {
  const item = document.createElement("span");
  item.className = "tape-item";
  item.textContent = text;
  tickerTape.prepend(item);
  while (tickerTape.children.length > 40) {
    tickerTape.removeChild(tickerTape.lastChild);
  }
}

function upsertTickerRow(product, price) {
  let row = tickerRows.get(product.id);
  if (!row) {
    row = document.createElement("tr");
    row.innerHTML = `
      <td class="product"></td>
      <td class="price"></td>
      <td class="stock"></td>
      <td class="updated"></td>
    `;
    tickerRows.set(product.id, row);
    tickerBody.prepend(row);
  }

  row.querySelector(".product").textContent = `${product.name} (${product.source_id})`;
  row.querySelector(".price").textContent = `${price.currency} ${Number(price.amount).toFixed(2)}`;
  row.querySelector(".stock").textContent = product.in_stock ? "Yes" : "No";
  row.querySelector(".updated").textContent = new Date(price.observed_at).toLocaleTimeString();

  addTapeItem(`${product.name} ${price.currency}${Number(price.amount).toFixed(2)} ${product.in_stock ? "▲" : "▼"}`);
}

function prependReview(product, review) {
  const item = document.createElement("li");
  item.textContent = `${product.name}: ${review.rating}/5 - ${review.body}`;
  reviewList.prepend(item);
  while (reviewList.children.length > 10) {
    reviewList.removeChild(reviewList.lastChild);
  }
}

function handlePayload(payload) {
  if (payload.type === "price_update") {
    upsertTickerRow(payload.product, payload.price);
    prependReview(payload.product, payload.review);
  }
  if (payload.type === "heartbeat") {
    addTapeItem(`${payload.source_id} waiting for API data...`);
  }
}

async function bootstrapRecentEvents() {
  const response = await fetch(`${API_BASE}/events?limit=50`);
  if (!response.ok) return;
  const events = await response.json();
  events.forEach((event) => {
    upsertTickerRow(event.product, event.price);
    prependReview(event.product, event.review);
  });
}

async function loadPaDirectory() {
  const response = await fetch(`${API_BASE}/pa-dispensaries`);
  if (!response.ok) {
    throw new Error("Failed to load Pennsylvania dispensary directory");
  }
  const dispensaries = await response.json();
  directoryBody.innerHTML = "";
  dispensaries.forEach((dispensary) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${dispensary.permittee}</td>
      <td>${dispensary.location_name}, ${dispensary.city}</td>
      <td>${dispensary.address}, ${dispensary.city}, ${dispensary.state} ${dispensary.zip}</td>
      <td><a href="${dispensary.website}" target="_blank" rel="noopener noreferrer">${dispensary.website}</a></td>
    `;
    directoryBody.appendChild(row);
  });
}

function connect() {
  const source = new EventSource(`${API_BASE}/stream`);

  source.onopen = () => {
    statusEl.textContent = "Live feed connected";
  };

  source.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    handlePayload(payload);
  };

  source.onerror = () => {
    statusEl.textContent = "Feed disconnected, retrying...";
    source.close();
    setTimeout(connect, 1500);
  };
}

Promise.all([loadPaDirectory(), bootstrapRecentEvents()]).catch((error) => {
  statusEl.textContent = `${error.message}. Live feed will still retry.`;
});
connect();
