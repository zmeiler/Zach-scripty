/**
 * Every outbound command in one place, so the UI never builds protocol
 * messages by hand and the transport can be swapped underneath it.
 */

let transport = null;

export function setTransport(next) {
  transport = next;
}

export function send(msg) {
  transport?.send(msg);
}

export const actions = {
  walkTo(x, y) {
    send({ t: 'move', x, y });
  },
  interact(kind, id, action) {
    send({ t: 'interact', kind, id, action });
  },
  item(op, slot, extra = {}) {
    send({ t: 'item', op, slot, ...extra });
  },
  unequip(slot) {
    send({ t: 'unequip', slot });
  },
  chat(text) {
    send({ t: 'chat', text });
  },
  emote(id) {
    send({ t: 'emote', id });
  },
  style(style) {
    send({ t: 'style', style });
  },
  toggleRun(on) {
    send({ t: 'run', on });
  },
  dialogueChoose(option) {
    send({ t: 'dialogue', option });
  },
  dialogueClose() {
    send({ t: 'dialogue', close: true });
  },
  shop(op, payload = {}) {
    send({ t: 'shop', op, ...payload });
  },
  bank(op, payload = {}) {
    send({ t: 'bank', op, ...payload });
  },
  craft(recipe, count) {
    send({ t: 'craft', recipe, count });
  },
  trade(op, payload = {}) {
    send({ t: 'trade', op, ...payload });
  },
  closeWindow() {
    send({ t: 'closeUI' });
  },
  report(target, reason, note) {
    send({ t: 'report', target, reason, note });
  },
  appearance(appearance) {
    send({ t: 'appearance', appearance });
  },
  logout() {
    send({ t: 'logout' });
  }
};
