const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const activeRooms = new Set();
const roomData = new Map(); // Stores drawing history per room

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
      return;
    }

    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);

    // Send drawing history to the newly joined user
    if (roomData.has(room)) {
      const history = roomData.get(room);
      socket.emit('drawingHistory', history);
    } else {
      roomData.set(room, []);
    }
  });

  socket.on('draw', (data) => {
    const { room } = data;

    if (!roomData.has(room)) {
      roomData.set(room, []);
    }
    roomData.get(room).push(data);

    socket.to(room).emit('draw', data);
  });

  socket.on('text', (data) => {
    const { room } = data;

    if (!roomData.has(room)) {
      roomData.set(room, []);
    }
    roomData.get(room).push(data);

    socket.to(room).emit('text', data);
  });

  socket.on('clear', (room) => {
    // Clear room history
    roomData.set(room, []);

    // Emit to everyone INCLUDING sender so all clear
    io.to(room).emit('clear');
  });

  // ✅ Handle request for drawing history (re-sync after reconnect or inactivity)
  socket.on('requestHistory', (room) => {
    if (roomData.has(room)) {
      const history = roomData.get(room);
      socket.emit('drawingHistory', history);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
