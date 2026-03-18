const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');

const { jwtSecret, port, tokenExpiration } = require('./config');
const { requireAuth } = require('./middleware/auth.middleware');
const {
  ensureDataFiles,
  readProjects,
  readUsers,
  writeProjects,
  writeUsers,
} = require('./store/data-store');
const { signToken } = require('./utils/jwt');

const app = express();

const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const allowedOrigins = String(process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const netlifyOrigins = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL]
  .map((origin) => String(origin ?? '').trim())
  .filter(Boolean);

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesAllowedOrigin(origin) {
  return [...allowedOrigins, ...netlifyOrigins].some((allowedOrigin) => {
    if (!allowedOrigin.includes('*')) {
      return allowedOrigin === origin;
    }

    const pattern = `^${escapeRegex(allowedOrigin).replace('\\*', '[^.]+')}$`;
    return new RegExp(pattern).test(origin);
  });
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || localOriginPattern.test(origin) || matchesAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origen no permitido por CORS.'));
    },
  })
);
app.use(express.json({ limit: '10mb' }));

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function buildToken(user) {
  return signToken(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    jwtSecret,
    tokenExpiration
  );
}

function normalizarUrl(url) {
  const nextUrl = String(url ?? '').trim();

  if (!nextUrl) {
    return '';
  }

  return /^https?:\/\//i.test(nextUrl) ? nextUrl : `https://${nextUrl}`;
}

function validateCredentials({ name, email, password }, res, requireName = false) {
  if ((requireName && !name) || !email || !password) {
    res.status(400).json({ message: 'Todos los campos obligatorios deben estar informados.' });
    return false;
  }

  if (requireName && String(name).trim().length < 3) {
    res.status(400).json({ message: 'El nombre debe tener al menos 3 caracteres.' });
    return false;
  }

  if (!String(email).includes('@')) {
    res.status(400).json({ message: 'El email no es válido.' });
    return false;
  }

  if (String(password).length < 4) {
    res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres.' });
    return false;
  }

  return true;
}

function validateUserUpdatePayload(payload, res) {
  const name = String(payload.name ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');

  if (!name || !email) {
    res.status(400).json({ message: 'Nombre y email son obligatorios.' });
    return null;
  }

  if (name.length < 3) {
    res.status(400).json({ message: 'El nombre debe tener al menos 3 caracteres.' });
    return null;
  }

  if (!email.includes('@')) {
    res.status(400).json({ message: 'El email no es válido.' });
    return null;
  }

  if (password && password.length < 4) {
    res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres.' });
    return null;
  }

  return {
    name,
    email,
    password,
  };
}

function validateProjectPayload(payload, res) {
  const nombre = String(payload.nombre ?? '').trim();
  const descripcion = String(payload.descripcion ?? '').trim();
  const url = normalizarUrl(payload.url);
  const imagen = String(payload.imagen ?? '').trim();

  if (!nombre) {
    res.status(400).json({ message: 'El nombre del proyecto es obligatorio.' });
    return null;
  }

  if (!url) {
    res.status(400).json({ message: 'La URL del proyecto es obligatoria.' });
    return null;
  }

  return {
    nombre,
    descripcion,
    url,
    imagen: imagen || '/images/noakr home.png',
  };
}

async function seedData() {
  await ensureDataFiles();

  const users = await readUsers();
  const projects = await readProjects();

  if (users.length === 0) {
    const passwordHash = await bcrypt.hash('2026', 10);
    await writeUsers([
      {
        id: 1,
        name: 'noha',
        email: 'noha@hub.local',
        passwordHash,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  if (projects.length === 0) {
    await writeProjects([
      {
        id: 1,
        nombre: 'Habita',
        descripcion: 'Portal principal',
        imagen: '/images/Habita.png',
        url: 'https://habitanakr.netlify.app/',
      },
    ]);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  if (!validateCredentials(req.body, res, true)) {
    return;
  }

  const users = await readUsers();
  const email = String(req.body.email).toLowerCase();
  const existingUser = users.find((user) => user.email.toLowerCase() === email);

  if (existingUser) {
    return res.status(409).json({ message: 'Ya existe una cuenta con ese email.' });
  }

  const passwordHash = await bcrypt.hash(String(req.body.password), 10);
  const newUser = {
    id: users.length ? Math.max(...users.map((user) => user.id)) + 1 : 1,
    name: String(req.body.name).trim(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);

  return res.status(201).json({
    token: buildToken(newUser),
    user: sanitizeUser(newUser),
  });
});

app.post('/api/auth/login', async (req, res) => {
  const identifier = String(req.body.identifier ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres.' });
  }

  const users = await readUsers();
  const user = users.find(
    (item) =>
      item.email.toLowerCase() === identifier || item.name.toLowerCase() === identifier
  );

  if (!user) {
    return res.status(401).json({ message: 'Credenciales incorrectas.' });
  }

  const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordIsValid) {
    return res.status(401).json({ message: 'Credenciales incorrectas.' });
  }

  return res.json({
    token: buildToken(user),
    user: sanitizeUser(user),
  });
});

app.get('/api/projects', requireAuth, async (_req, res) => {
  const projects = await readProjects();
  res.json(projects);
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const payload = validateProjectPayload(req.body, res);

  if (!payload) {
    return;
  }

  const projects = await readProjects();
  const newProject = {
    id: projects.length ? Math.max(...projects.map((project) => project.id)) + 1 : 1,
    ...payload,
  };

  projects.push(newProject);
  await writeProjects(projects);

  return res.status(201).json(newProject);
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const projectId = Number(req.params.id);
  const projects = await readProjects();
  const projectIndex = projects.findIndex((project) => project.id === projectId);

  if (projectIndex === -1) {
    return res.status(404).json({ message: 'El proyecto indicado no existe.' });
  }

  const payload = validateProjectPayload(
    {
      ...req.body,
      imagen: req.body.imagen ?? projects[projectIndex].imagen,
    },
    res
  );

  if (!payload) {
    return;
  }

  const updatedProject = {
    ...projects[projectIndex],
    nombre: payload.nombre,
    descripcion: payload.descripcion,
    url: payload.url,
    imagen: payload.imagen,
  };

  projects[projectIndex] = updatedProject;
  await writeProjects(projects);

  return res.json(updatedProject);
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const projectId = Number(req.params.id);
  const projects = await readProjects();
  const updatedProjects = projects.filter((project) => project.id !== projectId);

  if (updatedProjects.length === projects.length) {
    return res.status(404).json({ message: 'El proyecto indicado no existe.' });
  }

  await writeProjects(updatedProjects);
  return res.status(204).send();
});

app.get('/api/users', requireAuth, async (_req, res) => {
  const users = await readUsers();
  res.json(users.map(sanitizeUser));
});

app.post('/api/users', requireAuth, async (req, res) => {
  if (!validateCredentials(req.body, res, true)) {
    return;
  }

  const users = await readUsers();
  const email = String(req.body.email).toLowerCase();
  const existingUser = users.find((user) => user.email.toLowerCase() === email);

  if (existingUser) {
    return res.status(409).json({ message: 'Ya existe una cuenta con ese email.' });
  }

  const passwordHash = await bcrypt.hash(String(req.body.password), 10);
  const newUser = {
    id: users.length ? Math.max(...users.map((user) => user.id)) + 1 : 1,
    name: String(req.body.name).trim(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);

  return res.status(201).json(sanitizeUser(newUser));
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  const userId = Number(req.params.id);
  const payload = validateUserUpdatePayload(req.body, res);

  if (!payload) {
    return;
  }

  const users = await readUsers();
  const userIndex = users.findIndex((user) => user.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'La cuenta indicada no existe.' });
  }

  const emailTakenByAnotherUser = users.some(
    (user) => user.id !== userId && user.email.toLowerCase() === payload.email
  );

  if (emailTakenByAnotherUser) {
    return res.status(409).json({ message: 'Ya existe una cuenta con ese email.' });
  }

  const updatedUser = {
    ...users[userIndex],
    name: payload.name,
    email: payload.email,
  };

  if (payload.password) {
    updatedUser.passwordHash = await bcrypt.hash(payload.password, 10);
  }

  users[userIndex] = updatedUser;
  await writeUsers(users);

  const response = {
    user: sanitizeUser(updatedUser),
  };

  if (Number(req.user.sub) === userId) {
    response.token = buildToken(updatedUser);
  }

  return res.json(response);
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  const userId = Number(req.params.id);
  const users = await readUsers();

  if (Number(req.user.sub) === userId) {
    return res.status(400).json({ message: 'No puedes eliminar la cuenta con la sesión activa.' });
  }

  const updatedUsers = users.filter((user) => user.id !== userId);

  if (updatedUsers.length === users.length) {
    return res.status(404).json({ message: 'La cuenta indicada no existe.' });
  }

  await writeUsers(updatedUsers);
  return res.status(204).send();
});

async function startServer() {
  await seedData();

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`API del hub escuchando en http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('No se pudo iniciar el backend:', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  seedData,
  startServer,
};
