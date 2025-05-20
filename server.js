const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const activeRooms = new Set();

// Generate random 6-character uppercase room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// API: Generate a new room code
app.post('/api/generateRoom', (req, res) => {
  let code;
  do {
    code = generateRoomCode();
  } while (activeRooms.has(code));
  activeRooms.add(code);
  res.json({ roomCode: code });
});

// API: Quick play (create a new room)
app.get('/api/quickplay', (req, res) => {
  let code;
  do {
    code = generateRoomCode();
  } while (activeRooms.has(code));
  activeRooms.add(code);
  res.json({ roomCode: code });
});

// API: Check if room exists
app.get('/api/roomExists/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  res.json({ exists: activeRooms.has(code) });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', (room) => {
    if (!activeRooms.has(room)) {
      console.log(`Room ${room} does not exist. Rejecting join.`);
      // Optionally, emit an error to client here
      return;
    }
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('draw', (data) => {
    // Broadcast to everyone else in the room except sender
    socket.to(data.room).emit('draw', data);
  });

  socket.on('clear', (room) => {
    socket.to(room).emit('clear');
  });

  socket.on('text', (data) => {
    socket.to(data.room).emit('text', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Optionally handle removing empty rooms here
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
