/**
 * Character creation: six appearance dials with a live preview drawn by the
 * same sprite code that renders the player in the world.
 */

import {
  APPEARANCE_FIELDS,
  HAIR_COLOURS,
  HAIR_STYLES,
  LEG_COLOURS,
  SHIRT_COLOURS,
  SKIN_TONES,
  BUILDS,
  defaultAppearance,
  randomAppearance
} from '../../../shared/appearance.js';
import { playerSprite } from '../sprites.js';

let appearance = defaultAppearance();
let onChange = null;

export function initCreation(handler) {
  onChange = handler;
  const container = document.getElementById('appearanceControls');
  container.querySelectorAll('.swatch-row, .chip-row').forEach((el) => el.remove());

  container.append(
    swatchRow('Skin tone', 'skin', SKIN_TONES),
    swatchRow('Hair colour', 'hairColour', HAIR_COLOURS),
    chipRow('Hair style', 'hair', HAIR_STYLES),
    swatchRow('Top', 'shirt', SHIRT_COLOURS),
    swatchRow('Trousers', 'legs', LEG_COLOURS),
    chipRow('Build', 'build', BUILDS)
  );

  document.getElementById('btnRandomise').addEventListener('click', () => {
    setAppearance(randomAppearance());
  });

  drawPreview();
}

export function getAppearance() {
  return { ...appearance };
}

export function setAppearance(next) {
  appearance = { ...defaultAppearance(), ...next };
  refreshSelection();
  drawPreview();
  onChange?.(getAppearance());
}

function refreshSelection() {
  for (const field of Object.keys(APPEARANCE_FIELDS)) {
    for (const button of document.querySelectorAll(`[data-field="${field}"]`)) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.value) === appearance[field]));
    }
  }
}

function swatchRow(label, field, colours) {
  const row = document.createElement('div');
  row.className = 'swatch-row';
  const caption = document.createElement('span');
  caption.className = 'label';
  caption.id = `label-${field}`;
  caption.textContent = label;
  const group = document.createElement('div');
  group.className = 'swatches';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', caption.id);
  colours.forEach((colour, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.style.background = colour;
    button.dataset.field = field;
    button.dataset.value = String(index);
    button.setAttribute('aria-label', `${label} option ${index + 1}`);
    button.setAttribute('aria-pressed', String(appearance[field] === index));
    button.addEventListener('click', () => {
      appearance[field] = index;
      refreshSelection();
      drawPreview();
      onChange?.(getAppearance());
    });
    group.append(button);
  });
  row.append(caption, group);
  return row;
}

function chipRow(label, field, values) {
  const row = document.createElement('div');
  row.className = 'swatch-row';
  const caption = document.createElement('span');
  caption.className = 'label';
  caption.id = `label-${field}`;
  caption.textContent = label;
  const group = document.createElement('div');
  group.className = 'chip-row';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', caption.id);
  values.forEach((value, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = value;
    button.dataset.field = field;
    button.dataset.value = String(index);
    button.setAttribute('aria-pressed', String(appearance[field] === index));
    button.addEventListener('click', () => {
      appearance[field] = index;
      refreshSelection();
      drawPreview();
      onChange?.(getAppearance());
    });
    group.append(button);
  });
  row.append(caption, group);
  return row;
}

function drawPreview() {
  const canvas = document.getElementById('charPreview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ground shadow so the character does not float.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height - 26, 42, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  const sprite = playerSprite(appearance, null, 0, 96);
  ctx.drawImage(sprite, canvas.width / 2 - 48, canvas.height - 168, 96, 144);

  ctx.fillStyle = '#9fb0c3';
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(HAIR_STYLES[appearance.hair], canvas.width / 2, canvas.height - 8);
}
