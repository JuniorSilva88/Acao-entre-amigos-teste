const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('js/pix-donation.js', 'utf8'), context);

function readFields(payload) {
  const fields = {};
  for (let offset = 0; offset < payload.length;) {
    const id = payload.slice(offset, offset + 2);
    const length = Number(payload.slice(offset + 2, offset + 4));
    const value = payload.slice(offset + 4, offset + 4 + length);
    assert.equal(value.length, length, `Invalid length for Pix field ${id}`);
    fields[id] = value;
    offset += 4 + length;
  }
  return fields;
}

function calculateCrc(payload) {
  let crc = 0xffff;
  for (const character of payload) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const buildPayload = context.window.PixDonation.buildPayload;
const key = '+5541995756812';

for (const amount of [5, 10, 20, 50, 37.25]) {
  const payload = buildPayload(amount, key, 'ALECIO CAMARGO', 'CURITIBA-PR');
  assert.equal(payload.slice(-8, -4), '6304');
  assert.equal(payload.slice(-4), calculateCrc(payload.slice(0, -4)));

  const fields = readFields(payload.slice(0, -8));
  assert.equal(fields['00'], '01');
  assert.equal(fields['01'], '12');
  assert.equal(fields['26'], `0014br.gov.bcb.pix01${String(key.length).padStart(2, '0')}${key}`);
  assert.equal(fields['54'], amount.toFixed(2));
  assert.equal(fields['59'], 'ALECIO CAMARGO');
  assert.equal(fields['60'], 'CURITIBA-PR');
  assert.equal(fields['62'], '0503***');
}

assert.throws(() => buildPayload(0, key, 'ALECIO CAMARGO', 'CURITIBA-PR'), /valor válido/);
assert.throws(() => buildPayload(5, '41995756812', 'ALECIO CAMARGO', 'CURITIBA-PR'), /chave Pix/);

vm.runInNewContext(fs.readFileSync('js/vendor/qrcode-generator.js', 'utf8'), context);
const qr = context.qrcode(0, 'M');
qr.addData(buildPayload(5, key, 'ALECIO CAMARGO', 'CURITIBA-PR'), 'Byte');
qr.make();
assert.ok(qr.getModuleCount() >= 21);
assert.ok(qr.createASCII().length > 0);
assert.match(qr.createDataURL(6, 4), /^data:image\/gif;base64,/);

class FakeElement {
  constructor(value = '') {
    this.value = value;
    this.textContent = '';
    this.hidden = false;
    this.checked = false;
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.classes = new Set();
    this.classList = {
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
    };
  }

  addEventListener(type, listener) {
    (this.listeners[type] ||= []).push(listener);
  }

  async dispatch(type, event = {}) {
    return Promise.all((this.listeners[type] || []).map(listener => listener({
      preventDefault() {},
      target: this,
      ...event
    })));
  }

  querySelectorAll() {
    return this.amountInputs || [];
  }

  closest() {
    return this.parent;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  focus() {}

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  get valueAsNumber() {
    return this.value === '' ? Number.NaN : Number(this.value);
  }
}

async function testDonationDialog() {
  let ready;
  let generatedPayload;
  const elements = new Map();
  const ids = [
    'pix-value', 'btn-copy', 'copy-feedback', 'toast', 'donation-dialog',
    'pix-donation-options', 'pix-donation-result', 'choose-pix-method',
    'custom-donation-amount', 'generate-pix-qr', 'donation-feedback',
    'pix-qr-code', 'pix-payment-code', 'donation-dialog-close',
    'toy-donation-link', 'doe', 'pix-result-amount', 'copy-pix-payment-code',
    'change-donation-amount'
  ];
  ids.forEach(id => elements.set(id, new FakeElement()));
  elements.get('pix-value').textContent = '41995756812';
  elements.get('doe').dataset = { pixRecipient: 'ALECIO CAMARGO', pixCity: 'CURITIBA-PR' };

  const amountValues = ['5', '10', '20', '50', 'other'];
  const amountInputs = amountValues.map(value => {
    const option = new FakeElement();
    const input = new FakeElement(value);
    input.parent = option;
    return input;
  });
  elements.get('donation-dialog').amountInputs = amountInputs;
  const openButton = new FakeElement();
  const script = new FakeElement();
  const document = {
    addEventListener(type, listener) {
      if (type === 'DOMContentLoaded') ready = listener;
    },
    getElementById(id) {
      return elements.get(id);
    },
    querySelectorAll(selector) {
      return selector === '[data-open-donation]' ? [openButton] : [];
    },
    createElement() {
      return script;
    },
    head: {
      append() {
        context.window.qrcode = () => ({
          addData(payload) { generatedPayload = payload; },
          make() {},
          createDataURL() { return 'data:image/gif;base64,R0lGODlh'; }
        });
        script.onload();
      }
    }
  };
  context.document = document;
  context.navigator = {};
  context.window.isSecureContext = false;
  context.window.clearTimeout = clearTimeout;
  context.window.setTimeout = setTimeout;
  vm.runInNewContext(fs.readFileSync('js/main.js', 'utf8'), context);
  ready();

  await openButton.dispatch('click');
  assert.equal(elements.get('donation-dialog').open, true);
  await elements.get('choose-pix-method').dispatch('click');
  amountInputs[0].checked = true;
  await amountInputs[0].dispatch('change');
  assert.equal(elements.get('generate-pix-qr').hidden, false);
  await elements.get('generate-pix-qr').dispatch('click');
  assert.equal(elements.get('pix-donation-result').hidden, false);
  assert.ok(elements.get('pix-qr-code').src.startsWith('data:image/gif'));
  assert.equal(readFields(generatedPayload.slice(0, -8))['54'], '5.00');

  amountInputs[0].checked = false;
  amountInputs[4].checked = true;
  await amountInputs[4].dispatch('change');
  elements.get('custom-donation-amount').value = '37.25';
  await elements.get('custom-donation-amount').dispatch('input');
  await elements.get('generate-pix-qr').dispatch('click');
  assert.equal(readFields(generatedPayload.slice(0, -8))['54'], '37.25');

  await elements.get('donation-dialog-close').dispatch('click');
  await openButton.dispatch('click');
  assert.equal(elements.get('pix-donation-options').hidden, true);
  assert.equal(amountInputs.some(input => input.checked), false);
  assert.equal(amountInputs.some(input => input.parent.classes.has('is-selected')), false);
  assert.equal(elements.get('custom-donation-amount').value, '');
}

testDonationDialog().then(() => {
  console.log('Donation dialog tests passed: modal flow, preset/custom selection, and QR output.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

console.log('Pix payload tests passed: preset/custom amounts, BR Code fields, CRC, and QR generation.');
