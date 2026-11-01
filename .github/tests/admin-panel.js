const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('admin/admin.js', 'utf8');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.listeners = {};
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.hidden = false;
  }

  addEventListener(type, listener) {
    (this.listeners[type] ||= []).push(listener);
  }

  async dispatch(type, event = {}) {
    const results = [];
    for (const listener of this.listeners[type] || []) {
      results.push(listener({
        preventDefault() {},
        target: event.target || this,
        ...event
      }));
    }
    return Promise.all(results);
  }

  replaceChildren(...children) {
    this.children = [];
    if (this.tagName === 'select') this.value = '';
    this.append(...children);
  }

  append(...children) {
    for (const child of children) {
      this.children.push(child);
      if (this.tagName === 'select' && !this.value && child.value) {
        this.value = child.value;
      }
    }
  }

  querySelectorAll() {
    return [];
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createIndexedDb(initialRecords = {}) {
  const records = new Map(Object.entries(initialRecords).map(([key, value]) => [key, clone(value)]));
  let created = Object.keys(initialRecords).length > 0;
  const database = {
    createObjectStore() {
      created = true;
      return {};
    },
    transaction() {
      const transaction = {
        objectStore() {
          return {
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = records.get(key);
                request.onsuccess?.();
              });
              return request;
            },
            put(value, key) {
              records.set(key, clone(value));
            }
          };
        }
      };
      queueMicrotask(() => queueMicrotask(() => transaction.oncomplete?.()));
      return transaction;
    }
  };
  return {
    records,
    open() {
      const request = { result: database };
      queueMicrotask(() => {
        if (!created) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}

async function createPanel({ published, revision, saved, fetch }) {
  const elements = new Map();
  const ids = [
    'admin-status',
    'gallery-editor',
    'gallery-select',
    'edit-gallery-title',
    'image-list',
    'image-files',
    'gallery-create-form',
    'gallery-rename-form',
    'image-upload-form',
    'export-galleries',
    'publish-galleries',
    'restore-galleries',
    'delete-gallery',
    'new-gallery-title'
  ];
  for (const id of ids) {
    elements.set(id, new FakeElement(id === 'gallery-select' ? 'select' : 'div'));
  }
  elements.get('image-files').files = [];

  let ready;
  const document = {
    addEventListener(type, listener) {
      if (type === 'DOMContentLoaded') ready = listener;
    },
    getElementById(id) {
      return elements.get(id);
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    }
  };
  const indexedDB = createIndexedDb(saved);
  const window = {
    indexedDB,
    confirm: () => true
  };
  const context = {
    document,
    window,
    indexedDB,
    fetch,
    console: { error() {} },
    Blob,
    FormData,
    Uint8Array,
    atob,
    URL,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Math,
    Date,
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'admin/admin.js' });
  ready();

  for (let attempt = 0; attempt < 50; attempt++) {
    if (elements.get('gallery-select').children.length) break;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.ok(elements.get('gallery-select').children.length, 'The admin panel did not load the galleries.');

  return { elements, indexedDB };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

async function testUploadAndPublish() {
  const revision = 'a'.repeat(64);
  const published = [{
    id: 'galeria-teste',
    title: 'Galeria de teste',
    images: [{
      src: 'assets/img1-800.webp',
      fullSrc: 'assets/img1-1200.webp',
      alt: 'Imagem existente'
    }]
  }];
  const draft = clone(published);
  draft[0].images.push({
    src: 'data:image/webp;base64,AAAA',
    fullSrc: 'data:image/webp;base64,AAAA',
    alt: 'Nova imagem'
  });
  const uploadId = 'b'.repeat(32);
  const nextRevision = 'c'.repeat(64);
  const calls = [];

  const panel = await createPanel({
    published,
    revision,
    saved: { galleries: draft, 'galleries-revision': revision },
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (!options.method) return response({ galleries: published, revision });
      if (options.body instanceof FormData) {
        assert.equal(options.body.get('action'), 'upload');
        assert.equal(options.body.get('image').type, 'image/webp');
        return response({ uploadId }, 201);
      }
      const body = JSON.parse(options.body);
      assert.equal(body.action, 'publish');
      assert.equal(body.revision, revision);
      assert.equal(body.galleries[0].images[1].uploadId, uploadId);
      const resultGalleries = clone(published);
      resultGalleries[0].images.push({
        src: 'assets/gallery/gallery-' + 'd'.repeat(32) + '.webp',
        fullSrc: 'assets/gallery/gallery-' + 'd'.repeat(32) + '.webp',
        alt: 'Nova imagem'
      });
      return response({ galleries: resultGalleries, revision: nextRevision, warnings: [] });
    }
  });

  await panel.elements.get('publish-galleries').dispatch('click');
  assert.deepEqual(calls.map(call => call.options.method || 'GET'), ['GET', 'POST', 'POST']);
  assert.equal(panel.elements.get('admin-status').textContent, 'Galerias e imagens publicadas no site.');
  assert.equal(panel.indexedDB.records.get('galleries-revision'), nextRevision);
  assert.equal(panel.elements.get('publish-galleries').disabled, false);
}

async function testRevisionConflictAndRestore() {
  const firstRevision = 'e'.repeat(64);
  const latestRevision = 'f'.repeat(64);
  const published = [{ id: 'galeria-teste', title: 'Versão atual', images: [] }];
  let getCount = 0;

  const panel = await createPanel({
    published,
    revision: firstRevision,
    fetch: async (_url, options = {}) => {
      if (!options.method) {
        getCount++;
        const revision = getCount === 1 ? firstRevision : latestRevision;
        const galleries = getCount === 1
          ? published
          : [{ id: 'galeria-teste', title: 'Publicada por outra sessão', images: [] }];
        return response({ galleries, revision });
      }
      return response({ error: 'As galerias mudaram.' }, 409);
    }
  });

  await panel.elements.get('publish-galleries').dispatch('click');
  assert.equal(panel.elements.get('publish-galleries').disabled, true);
  assert.equal(panel.elements.get('admin-status').dataset.state, 'error');

  await panel.elements.get('restore-galleries').dispatch('click');
  assert.equal(panel.elements.get('publish-galleries').disabled, false);
  assert.equal(panel.elements.get('edit-gallery-title').value, 'Publicada por outra sessão');
  assert.equal(panel.indexedDB.records.get('galleries-revision'), latestRevision);
}

(async () => {
  await testUploadAndPublish();
  await testRevisionConflictAndRestore();
  console.log('Admin panel tests passed: WebP upload, publish request, success state, revision conflict, and restore.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
