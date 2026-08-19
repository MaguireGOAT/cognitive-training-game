// session.test.mjs - regression tests for CognitiveActivity speed changes
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { create: createTimer } = require('../js/timer.js');

// session.js only exposes itself via window; emulate a minimal browser global
globalThis.window = globalThis;
require('../js/session.js');
const { create: createActivity } = globalThis.CognitiveActivity;

function createScheduler() {
    let currentTime = 0;
    let nextId = 1;
    const timers = new Map();
    return {
        now: () => currentTime,
        schedule(fn, ms) {
            const id = nextId++;
            timers.set(id, { fn, at: currentTime + ms });
            return id;
        },
        cancel(id) { timers.delete(id); },
        advance(ms) {
            const target = currentTime + ms;
            while (true) {
                let due = null;
                let dueAt = Infinity;
                for (const [id, timer] of timers) {
                    if (timer.at <= target && timer.at < dueAt) {
                        due = { id, fn: timer.fn };
                        dueAt = timer.at;
                    }
                }
                if (!due) break;
                currentTime = dueAt;
                timers.delete(due.id);
                due.fn();
            }
            currentTime = target;
        },
        pendingCount() { return timers.size; }
    };
}

function makeActivity() {
    const scheduler = createScheduler();
    globalThis.CognitiveActivityTimer = { create: () => createTimer({ scheduler }) };
    let ticks = 0;
    const activity = createActivity({
        minInterval: 500,
        maxInterval: 3000,
        speedSteps: 10,
        tick: () => { ticks++; }
    });
    return { scheduler, activity, count: () => ticks };
}

test('setSpeed then reset applies the new interval to a running activity', function () {
    const { scheduler, activity, count } = makeActivity();
    // speed 1 -> 3000ms interval
    activity.start(1);
    scheduler.advance(2000);
    assert.equal(count(), 0, 'no tick before the 3000ms interval elapses');

    // speed change while running must restart the countdown with the new interval (500ms at speed 10)
    activity.setSpeed(10);
    activity.reset();
    scheduler.advance(600);
    assert.equal(count(), 1, 'tick should fire at the new 500ms interval after reset');
});

test('setSpeed persists to the interval used by a later start', function () {
    const { scheduler, activity, count } = makeActivity();
    activity.start(1);
    activity.stop();
    activity.setSpeed(10);
    activity.start();
    scheduler.advance(600);
    assert.equal(count(), 1, 'restart should use the updated speed interval');
});
