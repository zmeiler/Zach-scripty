const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, '..', 'pos-layout.json');
const raw = fs.readFileSync(layoutPath, 'utf8');
const layout = JSON.parse(raw);

const requiredArrays = [
  'quickActions',
  'keypad',
  'summary',
  'orderItems',
  'categoryTabs',
  'menuButtons',
  'tenderButtons',
  'pinpadModes',
  'ebtOptions',
  'leftSideButtons',
  'rightSideButtons'
];

const missing = requiredArrays.filter((key) => !Array.isArray(layout[key]));

if (missing.length > 0) {
  console.error(`Missing required arrays: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Layout JSON looks good.');
