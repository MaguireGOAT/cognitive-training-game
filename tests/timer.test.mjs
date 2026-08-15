import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { create, createPauseCoordinator } = require('../js/timer.js');

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

test('idle timer exposes safe getters', function () {
    const scheduler = createScheduler();
    const timer = create({ scheduler: scheduler });

    assert.equal(timer.isActive(), false);
    assert.equal(timer.isRunning(), false);
    assert.equal(timer.isPaused(), false);
    assert.equal(timer.stop(), false);
    assert.equal(scheduler.pendingCount(), 0);
});

test('repeating timer ticks on its interval and stops cleanly', function () {
    const scheduler = createScheduler();
    const timer = create({
        scheduler: scheduler,
        mode: 'repeating',
        intervalMs: 250,
        tick: function () {
            ticks++;
        }
    });
    let ticks = 0;

    timer.start();
    assert.equal(timer.isRunning(), true);
    scheduler.advance(249);
    assert.equal(ticks, 0);
    scheduler.advance(1);
    assert.equal(ticks, 1);
    scheduler.advance(500);
    assert.equal(ticks, 3);
    assert.equal(timer.stop(), true);
    assert.equal(timer.isActive(), false);
    assert.equal(scheduler.pendingCount(), 0);
});

test('countdown timer ticks and completes at zero', function () {
    const scheduler = createScheduler();
    let ticks = 0;
    let completes = 0;
    const timer = create({
        scheduler: scheduler,
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

    timer.start();
    scheduler.advance(250);
    assert.equal(ticks, 1);
    scheduler.advance(500);
    assert.equal(ticks, 3);
    assert.equal(completes, 1);
    assert.equal(timer.isActive(), false);
    assert.equal(scheduler.pendingCount(), 0);
});

test('pause freezes a repeating timer and resume waits a full interval', function () {
    const scheduler = createScheduler();
    let ticks = 0;
    const timer = create({
        scheduler: scheduler,
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            ticks++;
        }
    });

    timer.start();
    scheduler.advance(100);
    assert.equal(ticks, 1);
    assert.equal(timer.pause(), true);
    scheduler.advance(1000);
    assert.equal(ticks, 1);
    assert.equal(timer.isPaused(), true);
    assert.equal(timer.resume(), true);
    scheduler.advance(99);
    assert.equal(ticks, 1);
    scheduler.advance(1);
    assert.equal(ticks, 2);
    timer.stop();
});

test('restart while paused applies the new interval on resume', function () {
    const scheduler = createScheduler();
    let ticks = 0;
    const timer = create({
        scheduler: scheduler,
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            ticks++;
        }
    });

    timer.start();
    scheduler.advance(100);
    assert.equal(ticks, 1);
    timer.pause();
    timer.restart(500);
    timer.resume();
    scheduler.advance(499);
    assert.equal(ticks, 1);
    scheduler.advance(1);
    assert.equal(ticks, 2);
    timer.stop();
});

test('starting a new timer stops the previous active timer', function () {
    const scheduler = createScheduler();
    let firstTicks = 0;
    let secondTicks = 0;
    const first = create({
        scheduler: scheduler,
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            firstTicks++;
        }
    });
    const second = create({
        scheduler: scheduler,
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            secondTicks++;
        }
    });

    first.start();
    second.start();
    scheduler.advance(100);
    assert.equal(firstTicks, 0);
    assert.equal(secondTicks, 1);
    assert.equal(first.isActive(), false);
    assert.equal(second.isActive(), true);
    second.stop();
});

test('pause coordinator captures and resumes the active timer', function () {
    const scheduler = createScheduler();
    let ticks = 0;
    const timer = create({
        scheduler: scheduler,
        mode: 'repeating',
        intervalMs: 100,
        tick: function () {
            ticks++;
        }
    });
    const coordinator = createPauseCoordinator();

    timer.start();
    scheduler.advance(100);
    assert.equal(ticks, 1);
    coordinator.pause();
    scheduler.advance(1000);
    assert.equal(ticks, 1);
    assert.equal(timer.isPaused(), true);
    coordinator.resume();
    scheduler.advance(99);
    assert.equal(ticks, 1);
    scheduler.advance(1);
    assert.equal(ticks, 2);
    timer.stop();
});
