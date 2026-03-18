const fs = require('node:fs/promises');
const path = require('node:path');

const dataDirectory = path.join(__dirname, '..', '..', 'data');
const usersPath = path.join(dataDirectory, 'users.json');
const projectsPath = path.join(dataDirectory, 'projects.json');

async function ensureDataFiles() {
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

async function readUsers() {
  return readJson(usersPath, []);
}

async function writeUsers(users) {
  await writeJson(usersPath, users);
}

async function readProjects() {
  return readJson(projectsPath, []);
}

async function writeProjects(projects) {
  await writeJson(projectsPath, projects);
}

module.exports = {
  ensureDataFiles,
  readUsers,
  writeUsers,
  readProjects,
  writeProjects,
};
