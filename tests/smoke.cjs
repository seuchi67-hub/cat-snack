// Dependency-free smoke checks using browser stand-ins, not a real browser.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '..', 'game.js'), 'utf8');

function boot({ blocked = false, saved = null } = {}) {
  const elements = new Map();
  const drawing = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}), set: (target,key,value) => (target[key] = value, true) });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, textContent: '', handlers: {},
      addEventListener(type, fn) { this.handlers[type] = fn; },
      getContext() { return drawing; },
      getBoundingClientRect() { return { left: 0, width: 420 }; },
      setPointerCapture() {},
    });
    return elements.get(id);
  }
  let nextFrame, now = 0, random = 0.5;
  const values = new Map(saved === null ? [] : [['cat-snack.best.v1', saved]]);
  const win = { devicePixelRatio: 2, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
  const doc = { hidden: false, handlers: {}, getElementById: element, addEventListener(type, fn) { this.handlers[type] = fn; } };
  const sandbox = {
    document: doc, window: win,
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); values.set(key, value); },
    },
    Math: Object.assign(Object.create(Math), { random: () => random }),
    requestAnimationFrame(fn) { nextFrame = fn; },
  };
  vm.runInNewContext(source, sandbox, { filename: 'game.js' });
  function frames(count) { for (let i = 0; i < count; i++) { now += 1000 / 60; nextFrame(now); } }
  function click(id) { element(id).handlers.click(); }
  function key(type, value) { win.handlers[type]({ key: value, preventDefault() {} }); }
  function drag(x) { element('game').handlers.pointerdown({ pointerId:1, clientX:x, preventDefault() {} }); element('game').handlers.pointerup({ pointerId:1 }); }
  return { element, click, frames, key, drag, win, doc, values,
    skip(ms) { now += ms; nextFrame(now); },
    setRandom(value) { random = value; } };
}

const game = boot();
assert.equal(game.element('start-screen').hidden, false);
assert.equal(game.element('game').width, 840, 'high-DPI backing canvas');
game.click('start-button');
assert.equal(Number(game.element('time').textContent), 60);
game.frames(300);
assert.ok(Number(game.element('score').textContent) > 0, 'centered falling cookies are caught');
const beforePause = game.element('time').textContent;
game.click('pause-button'); game.frames(120);
assert.equal(game.element('time').textContent, beforePause, 'pause freezes time');
game.click('resume-button');
game.key('keydown','ArrowRight'); game.frames(120); game.key('keyup','ArrowRight');
const awayScore = game.element('score').textContent;
game.frames(120);
assert.equal(game.element('score').textContent, awayScore, 'keyboard moves cat out of cookie path');
game.drag(210); game.frames(120);
assert.ok(Number(game.element('score').textContent) > Number(awayScore), 'pointer returns cat to cookie path');
game.win.handlers.blur();
assert.equal(game.element('pause-screen').hidden, false, 'focus loss pauses');
game.click('resume-button'); game.doc.hidden = true; game.doc.handlers.visibilitychange();
assert.equal(game.element('pause-screen').hidden, false, 'background pauses');
game.doc.hidden = false; game.click('resume-button');
game.frames(3600);
assert.equal(game.element('result-screen').hidden, false, 'round ends after active 60 seconds');
assert.equal(Number(game.element('time').textContent), 0);
const finalScore = game.element('final-score').textContent;
assert.equal(game.values.get('cat-snack.best.v1'), String(finalScore));
game.frames(120);
assert.equal(game.element('final-score').textContent, finalScore, 'result remains stable');
game.click('restart-button');
assert.equal(Number(game.element('score').textContent), 0);
assert.equal(Number(game.element('time').textContent), 60);
game.frames(120);
assert.equal(game.element('result-screen').hidden, true);

const hazards = boot(); hazards.click('start-button'); hazards.frames(360);
const beforeHazard = Number(hazards.element('score').textContent);
hazards.setRandom(0.1); hazards.drag(59.6); hazards.frames(240);
assert.ok(Number(hazards.element('score').textContent) < beforeHazard, 'obstacles deduct points');
hazards.frames(600);
assert.equal(Number(hazards.element('score').textContent), 0, 'score cannot go below zero');

const blocked = boot({ blocked: true });
blocked.click('start-button'); blocked.frames(3700);
assert.equal(blocked.element('result-screen').hidden, false, 'storage failures do not stop round');
assert.ok(Number(blocked.element('result-best').textContent) > 0);
blocked.click('home-button');
assert.equal(blocked.element('start-screen').hidden, false);
assert.ok(Number(blocked.element('start-best').textContent) > 0, 'in-memory best survives storage failure');
for (const saved of ['bad', '-7', 'Infinity', '1.2']) {
  assert.equal(Number(boot({ saved }).element('start-best').textContent), 0, 'invalid storage is ignored');
}
assert.equal(Number(boot({ saved: '9999' }).element('start-best').textContent), 9999);
const slow = boot(); slow.click('start-button'); slow.frames(1); slow.skip(61000);
assert.equal(slow.element('result-screen').hidden, false, 'slow rendering does not extend round duration');
console.log('PASS: screens, cookie/obstacle collisions, score floor, keyboard/pointer input, pause, 60-second round, restart, best score and storage failures.');
