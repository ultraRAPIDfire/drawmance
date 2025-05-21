const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Serve index.html from root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const activeRooms = new Set();
const roomData = new Map(); // Store drawing history per room

// Generate random 6-character uppercase room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create a new room code that is guaranteed to be unique
function createUniqueRoomCode() {
  let code;
  do {
    code = generateRoomCode();
  } while (activeRooms.has(code));
  activeRooms.add(code);
  roomData.set(code, []); // Initialize empty history for new room
  return code;
}

// API: Generate a new room code
app.post('/api/generateRoom', (req, res) => {
  const code = createUniqueRoomCode();
  res.json({ roomCode: code });
});

// API: Quick play (create a new room)
app.get('/api/quickplay', (req, res) => {
  const code = createUniqueRoomCode();
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
    room = room.toUpperCase();

    if (!activeRooms.has(room)) {
      console.log(`Room ${room} does not exist. Rejecting join.`);
      socket.emit('errorMessage', `Room ${room} does not exist.`);
      return;
    }

    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);

    // Send drawing history to newly joined user
    const history = roomData.get(room) || [];
    socket.emit('drawingHistory', history);
  });

  function addDataToRoom(room, data) {
    if (!roomData.has(room)) {
      roomData.set(room, []);
    }
    roomData.get(room).push(data);
  }

  socket.on('draw', (data) => {
    const { room } = data;
    addDataToRoom(room, data);
    socket.to(room).emit('draw', data);
  });

  socket.on('text', (data) => {
    const { room } = data;
    addDataToRoom(room, data);
    socket.to(room).emit('text', data);
  });

  socket.on('clear', (room) => {
    roomData.set(room, []);
    io.to(room).emit('clear');
  });

  socket.on('requestHistory', (room) => {
    const history = roomData.get(room) || [];
    socket.emit('drawingHistory', history);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Optional: Could implement room cleanup here if rooms are empty
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
