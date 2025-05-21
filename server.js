const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// API endpoints for generating rooms, checking room existence, etc.
const rooms = new Set();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/generateRoom - generate and return a unique room code
app.post('/api/generateRoom', (req, res) => {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));
  rooms.add(code);
  res.json({ roomCode: code });
});

// POST /api/quickplay - similar to generateRoom for quick play
app.post('/api/quickplay', (req, res) => {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));
  rooms.add(code);
  res.json({ roomCode: code });
});

// GET /api/roomExists/:code - check if a room exists
app.get('/api/roomExists/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  res.json({ exists: rooms.has(code) });
});

// Serve index.html for the root and for any valid room code route to handle client-side routing
app.get(['/', '/:roomCode'], (req, res) => {
  const roomCode = req.params.roomCode;

  // Optionally verify room code format before serving index.html
  if (!roomCode || /^[A-Z0-9]{6}$/i.test(roomCode)) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // For invalid routes, you can send a 404 or redirect to '/'
    res.status(404).send('Page not found');
  }
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', (room) => {
    if (!rooms.has(room)) {
      // Optionally auto-create room on join
      rooms.add(room);
    }
    socket.join(room);
    console.log(`${socket.id} joined room ${room}`);
  });

  socket.on('draw', (data) => {
    socket.to(data.room).emit('draw', data);
  });

  socket.on('clear', (room) => {
    socket.to(room).emit('clear');
  });

  socket.on('text', (data) => {
    socket.to(data.room).emit('text', data);
  });

  socket.on('requestHistory', (room) => {
    // You should implement a way to store and retrieve history for each room.
    // For now, just emit empty array.
    socket.emit('drawingHistory', []);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
