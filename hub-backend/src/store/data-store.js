const fs = require('node:fs/promises');
const path = require('node:path');

const dataDirectory = path.join(__dirname, '..', '..', 'data');
const usersPath = path.join(dataDirectory, 'users.json');
const projectsPath = path.join(dataDirectory, 'projects.json');
const blobsStoreName = 'hub-data';
const memoryState = {
  users: null,
  projects: null,
};

let blobsStorePromise = null;
let blobsStoreUnavailable = false;

function isNetlifyRuntime() {
  return process.env.NETLIFY === 'true' || Boolean(process.env.CONTEXT);
}

async function getBlobsStore() {
  if (blobsStoreUnavailable) {
    return null;
  }

  if (!blobsStorePromise) {
    blobsStorePromise = import('@netlify/blobs')
      .then(({ getStore }) =>
        getStore({
          name: blobsStoreName,
        })
      )
      .catch(() => {
        blobsStoreUnavailable = true;
        return null;
      });
  }

  return blobsStorePromise;
}

async function ensureDataFiles() {
  if (isNetlifyRuntime()) {
    const store = await getBlobsStore();

    if (store) {
      await ensureBlob(store, 'users.json', []);
      await ensureBlob(store, 'projects.json', []);
      return;
    }

    await ensureMemoryData();
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

async function ensureMemoryData() {
  if (memoryState.users === null) {
    memoryState.users = await readJson(usersPath, []);
  }

  if (memoryState.projects === null) {
    memoryState.projects = await readJson(projectsPath, []);
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

  if (!store) {
    return fallbackValue;
  }

  const content = await store.get(key, { type: 'json', consistency: 'strong' });
  return content ?? fallbackValue;
}

async function writeBlob(key, data) {
  const store = await getBlobsStore();

  if (!store) {
    return false;
  }

  await store.setJSON(key, data);
  return true;
}

async function readUsers() {
  if (isNetlifyRuntime()) {
    const users = await readBlob('users.json', null);

    if (users !== null) {
      return users;
    }

    await ensureMemoryData();
    return [...memoryState.users];
  }

  return readJson(usersPath, []);
}

async function writeUsers(users) {
  if (isNetlifyRuntime()) {
    const saved = await writeBlob('users.json', users);

    if (!saved) {
      memoryState.users = [...users];
    }

    return;
  }

  await writeJson(usersPath, users);
}

async function readProjects() {
  if (isNetlifyRuntime()) {
    const projects = await readBlob('projects.json', null);

    if (projects !== null) {
      return projects;
    }

    await ensureMemoryData();
    return [...memoryState.projects];
  }

  return readJson(projectsPath, []);
}

async function writeProjects(projects) {
  if (isNetlifyRuntime()) {
    const saved = await writeBlob('projects.json', projects);

    if (!saved) {
      memoryState.projects = [...projects];
    }

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
