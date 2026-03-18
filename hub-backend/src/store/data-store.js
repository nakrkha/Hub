const fs = require('node:fs/promises');
const path = require('node:path');

const dataDirectory = path.join(__dirname, '..', '..', 'data');
const usersPath = path.join(dataDirectory, 'users.json');
const projectsPath = path.join(dataDirectory, 'projects.json');
const blobsStoreName = 'hub-data';

let blobsStorePromise = null;

function isNetlifyRuntime() {
  return process.env.NETLIFY === 'true' || process.env.CONTEXT;
}

async function getBlobsStore() {
  if (!blobsStorePromise) {
    blobsStorePromise = import('@netlify/blobs').then(({ getStore }) =>
      getStore({
        name: blobsStoreName,
      })
    );
  }

  return blobsStorePromise;
}

async function ensureDataFiles() {
  if (isNetlifyRuntime()) {
    const store = await getBlobsStore();
    await ensureBlob(store, 'users.json', []);
    await ensureBlob(store, 'projects.json', []);
    return;
  }

  await fs.mkdir(dataDirectory, { recursive: true });
  await ensureFile(usersPath, []);
  await ensureFile(projectsPath, []);
}

async function ensureFile(filePath, fallbackValue) {
  try {
    await fs.access(filePath);
  } catch {
    await writeJson(filePath, fallbackValue);
  }
}

async function ensureBlob(store, key, fallbackValue) {
  const content = await store.get(key, { type: 'json', consistency: 'strong' });

  if (content === null) {
    await store.setJSON(key, fallbackValue);
  }
}

async function readJson(filePath, fallbackValue) {
  try {
    const rawContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(rawContent);
  } catch {
    return fallbackValue;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function readBlob(key, fallbackValue) {
  const store = await getBlobsStore();
  const content = await store.get(key, { type: 'json', consistency: 'strong' });
  return content ?? fallbackValue;
}

async function writeBlob(key, data) {
  const store = await getBlobsStore();
  await store.setJSON(key, data);
}

async function readUsers() {
  if (isNetlifyRuntime()) {
    return readBlob('users.json', []);
  }

  return readJson(usersPath, []);
}

async function writeUsers(users) {
  if (isNetlifyRuntime()) {
    await writeBlob('users.json', users);
    return;
  }

  await writeJson(usersPath, users);
}

async function readProjects() {
  if (isNetlifyRuntime()) {
    return readBlob('projects.json', []);
  }

  return readJson(projectsPath, []);
}

async function writeProjects(projects) {
  if (isNetlifyRuntime()) {
    await writeBlob('projects.json', projects);
    return;
  }

  await writeJson(projectsPath, projects);
}

module.exports = {
  ensureDataFiles,
  readUsers,
  writeUsers,
  readProjects,
  writeProjects,
};
