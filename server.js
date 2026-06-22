import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

/*
   BASE DE DATOS EN MEMORIA
*/

const blueprints = new Map();

const initialData = {
  'juan/plano-1': {
    author: 'juan',
    name: 'plano-1',
    points: [
      { x: 10, y: 10 },
      { x: 40, y: 50 },
      { x: 80, y: 30 }
    ]
  },
  'juan/plano-2': {
    author: 'juan',
    name: 'plano-2',
    points: [
      { x: 20, y: 20 },
      { x: 60, y: 40 }
    ]
  }
};

Object.entries(initialData).forEach(([key, value]) => {
  blueprints.set(key, value);
});

/* 
   RUTAS REST
*/

// Obtener todos los planos de un autor
app.get('/api/blueprints', (req, res) => {
  const author = req.query.author;

  if (!author) {
    return res.status(400).json({
      error: 'Author parameter required'
    });
  }

  const result = [];

  for (const [key, blueprint] of blueprints.entries()) {
    if (key.startsWith(`${author}/`)) {
      result.push(blueprint);
    }
  }

  res.json(result);
});

// Obtener un plano específico
app.get('/api/blueprints/:author/:name', (req, res) => {
  const key = `${req.params.author}/${req.params.name}`;

  if (!blueprints.has(key)) {
    return res.status(404).json({
      error: 'Blueprint not found'
    });
  }

  res.json(blueprints.get(key));
});

// Crear un nuevo plano
app.post('/api/blueprints', (req, res) => {
  const { author, name, points = [] } = req.body;

  if (!author || !name) {
    return res.status(400).json({
      error: 'Author and name are required'
    });
  }

  const key = `${author}/${name}`;

  if (blueprints.has(key)) {
    return res.status(409).json({
      error: 'Blueprint already exists'
    });
  }

  const blueprint = {
    author,
    name,
    points
  };

  blueprints.set(key, blueprint);

  res.status(201).json(blueprint);
});

// Actualizar un plano existente
app.put('/api/blueprints/:author/:name', (req, res) => {
  const key = `${req.params.author}/${req.params.name}`;

  if (!blueprints.has(key)) {
    return res.status(404).json({
      error: 'Blueprint not found'
    });
  }

  const current = blueprints.get(key);

  const updated = {
    ...current,
    ...req.body
  };

  blueprints.set(key, updated);

  res.json(updated);
});

// Eliminar un plano
app.delete('/api/blueprints/:author/:name', (req, res) => {
  const key = `${req.params.author}/${req.params.name}`;

  if (!blueprints.has(key)) {
    return res.status(404).json({
      error: 'Blueprint not found'
    });
  }

  blueprints.delete(key);

  res.json({
    success: true,
    message: 'Blueprint deleted'
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    blueprints: blueprints.size,
    connections: io.engine.clientsCount
  });
});

/* 
   SOCKET.IO
*/

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {

  console.log(`Client connected: ${socket.id}`);

  // Igual al original
  socket.on('join-room', (room) => {
    socket.join(room);
  });

  // Igual al original + persistencia
  socket.on('draw-event', ({ room, point, author, name }) => {

    const key = `${author}/${name}`;

    if (blueprints.has(key)) {
      blueprints.get(key).points.push(point);
    } else {
      blueprints.set(key, {
        author,
        name,
        points: [point]
      });
    }

    socket.to(room).emit('blueprint-update', {
      author,
      name,
      points: [point]
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

});

/* 
   INICIO DEL SERVIDOR
*/

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Socket.IO up on :${PORT}`);
  console.log(`Blueprints loaded: ${blueprints.size}`);
});