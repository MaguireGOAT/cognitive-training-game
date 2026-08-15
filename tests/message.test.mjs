import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMessageController } = require('../js/food/message.js');

function createFakeElement(tag) {
    return {
        tag,
        className: '',
        textContent: '',
        innerHTML: '',
        children: [],
        listeners: {},
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener(name, handler) {
            if (!this.listeners[name]) this.listeners[name] = [];
            this.listeners[name].push(handler);
        }
    };
}

function createFixture() {
    const overlay = createFakeElement('overlay');
    const msgIcon = createFakeElement('span');
    const msgText = createFakeElement('div');
    const msgSub = createFakeElement('div');
    const msgButtons = createFakeElement('div');
    let pauses = 0;
    let resumes = 0;
    const pauseCoordinator = {
        pause: () => {
            pauses++;
        },
        resume: () => {
            resumes++;
        }
    };

    const controller = createMessageController({
        overlay,
        getMsgIcon: () => msgIcon,
        getMsgText: () => msgText,
        getMsgSub: () => msgSub,
        getMsgButtons: () => msgButtons,
        createElement: createFakeElement,
        pauseCoordinator,
        attachBackdrop: false
    });

    return {
        controller,
        overlay,
        msgText,
        msgSub,
        msgButtons,
        getPauses: () => pauses,
        getResumes: () => resumes,
        clickButton(index) {
            const group = msgButtons.children[0];
            const button = group.children[index];
            button.listeners.click[0]();
        }
    };
}

test('dismiss closes the flow and calls onDismiss once', function () {
    const fixture = createFixture();
    let dismisses = 0;

    fixture.controller.show({
        title: '看看圖片',
        onDismiss: () => {
            dismisses++;
        },
        pauseTimer: true
    });

    assert.equal(fixture.controller.isActive(), true);
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.msgText.textContent, '看看圖片');

    fixture.controller.dismiss();
    assert.equal(dismisses, 1);
    assert.equal(fixture.getResumes(), 1);
    assert.equal(fixture.controller.isActive(), false);

    fixture.controller.dismiss();
    assert.equal(dismisses, 1);
});

test('button action runs and suppresses onDismiss', function () {
    const fixture = createFixture();
    let actions = 0;
    let dismisses = 0;

    fixture.controller.show({
        title: '下一題',
        buttons: [{
            text: '下一題 ➜',
            className: 'btn-next',
            action: () => {
                actions++;
            }
        }],
        onDismiss: () => {
            dismisses++;
        }
    });

    fixture.clickButton(0);

    assert.equal(actions, 1);
    assert.equal(dismisses, 0);
    assert.equal(fixture.controller.isActive(), false);
});

test('replacing a message discards the old continuation', function () {
    const fixture = createFixture();
    let firstDismisses = 0;
    let secondDismisses = 0;

    fixture.controller.show({
        title: '第一次提示',
        onDismiss: () => {
            firstDismisses++;
        }
    });
    fixture.controller.show({
        title: '第二次提示',
        onDismiss: () => {
            secondDismisses++;
        }
    });

    fixture.controller.dismiss();

    assert.equal(firstDismisses, 0);
    assert.equal(secondDismisses, 1);
    assert.equal(fixture.msgText.textContent, '第二次提示');
});

test('pause and resume adapters follow the message lifecycle', function () {
    const fixture = createFixture();

    fixture.controller.show({
        title: '暫停計時',
        pauseTimer: true
    });
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.getResumes(), 0);

    fixture.controller.close();
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.getResumes(), 1);

    fixture.controller.show({
        title: '不暫停計時',
        pauseTimer: false
    });
    fixture.controller.dismiss();
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.getResumes(), 1);
});

test('creation requires a pause coordinator', function () {
    assert.throws(
        () => createMessageController({
            overlay: createFakeElement('overlay'),
            attachBackdrop: false
        }),
        /pauseCoordinator/
    );
});
