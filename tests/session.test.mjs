import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSessionEngine } = require('../js/session.js');

function createScheduler() {
    let currentTime = 0;
    let nextId = 1;
    const timers = new Map();

    return {
        now: function () {
            return currentTime;
        },
        schedule: function (fn, ms) {
            const id = nextId++;
            timers.set(id, { fn: fn, at: currentTime + ms });
            return id;
        },
        cancel: function (id) {
            timers.delete(id);
        },
        advance: function (ms) {
            const target = currentTime + ms;
            while (true) {
                let due = null;
                let dueAt = Infinity;
                for (const [id, timer] of timers) {
                    if (timer.at <= target && timer.at < dueAt) {
                        due = { id: id, fn: timer.fn };
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
        pendingCount: function () {
            return timers.size;
        }
    };
}

test('idle session exposes safe getters', function () {
    const session = createSessionEngine(createScheduler());
    assert.equal(session.running, false);
    assert.equal(session.paused, false);
    assert.equal(session.elapsed, 0);
    assert.equal(session.remaining, null);
    assert.equal(session.stop(), false);
});

test('repeating mode ticks on its interval and runs until stop', function () {
    const scheduler = createScheduler();
    const session = createSessionEngine(scheduler);
    let ticks = 0;

    session.start({
        mode: 'repeating',
        intervalMs: 250,
        tick: function () {
            ticks++;
        }
    });

    assert.equal(session.running, true);
    scheduler.advance(249);
    assert.equal(ticks, 0);
    scheduler.advance(1);
    assert.equal(ticks, 1);
    scheduler.advance(500);
    assert.equal(ticks, 3);
    assert.equal(session.stop(), true);
    assert.equal(session.running, false);
    assert.equal(scheduler.pendingCount(), 0);
});

test('countdown mode ticks and completes at zero', function () {
    const scheduler = createScheduler();
    const session = createSessionEngine(scheduler);
    let ticks = 0;
    let completes = 0;

    session.start({
        mode: 'countdown',
        durationMs: 1000,
        tickIntervalMs: 250,
        tick: function () {
            ticks++;
        },
        onComplete: function () {
            completes++;
        }
    });

    assert.equal(session.remaining, 1000);
    scheduler.advance(250);
    assert.equal(ticks, 1);
    assert.equal(session.remaining, 750);
    scheduler.advance(750);
    assert.equal(ticks, 4);
    assert.equal(completes, 1);
    assert.equal(session.running, false);
    assert.equal(session.paused, false);
    assert.equal(session.remaining, 0);
});

test('countdown pause freezes elapsed and resume continues', function () {
    const scheduler = createScheduler();
    const session = createSessionEngine(scheduler);
    let ticks = 0;
    let completes = 0;

    session.start({
        mode: 'countdown',
        durationMs: 1000,
        tickIntervalMs: 100,
        tick: function () {
            ticks++;
        },
        onComplete: function () {
            completes++;
        }
    });

    scheduler.advance(200);
    assert.equal(ticks, 2);
    assert.equal(session.remaining, 800);
    assert.equal(session.pause(), true);
    scheduler.advance(500);
    assert.equal(ticks, 2);
    assert.equal(session.remaining, 800);
    assert.equal(session.paused, true);
    assert.equal(session.resume(), true);
    scheduler.advance(100);
    assert.equal(ticks, 3);
    assert.equal(session.remaining, 700);
    scheduler.advance(700);
    assert.equal(completes, 1);
    assert.equal(session.remaining, 0);
});

test('repeating pause and resume waits a full interval after resume', function () {
    const scheduler = createScheduler();
    const session = createSessionEngine(scheduler);
    let ticks = 0;

    session.start({
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            ticks++;
        }
    });

    scheduler.advance(100);
    assert.equal(ticks, 1);
    assert.equal(session.pause(), true);
    scheduler.advance(1000);
    assert.equal(ticks, 1);
    assert.equal(session.resume(), true);
    scheduler.advance(99);
    assert.equal(ticks, 1);
    scheduler.advance(1);
    assert.equal(ticks, 2);
});

test('manual mode advances only while running', function () {
    const scheduler = createScheduler();
    const session = createSessionEngine(scheduler);
    let starts = 0;
    let advances = 0;

    session.start({
        mode: 'manual',
        onStart: function () {
            starts++;
        },
        tick: function () {
            advances++;
        }
    });

    assert.equal(starts, 1);
    assert.equal(session.running, true);
    assert.equal(session.elapsed, 0);
    assert.equal(session.remaining, null);
    assert.equal(session.advance(), true);
    assert.equal(advances, 1);
    assert.equal(session.pause(), true);
    assert.equal(session.advance(), false);
    assert.equal(advances, 1);
    assert.equal(session.resume(), true);
    assert.equal(session.advance(), true);
    assert.equal(advances, 2);
});

test('starting a new session stops the previous one', function () {
    const scheduler = createScheduler();
    const session = createSessionEngine(scheduler);
    let firstTicks = 0;
    let secondTicks = 0;

    session.start({
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            firstTicks++;
        }
    });
    session.start({
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            secondTicks++;
        }
    });

    scheduler.advance(100);
    assert.equal(firstTicks, 0);
    assert.equal(secondTicks, 1);
});
