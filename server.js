const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const activeRooms = new Set();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// API to generate private room code
app.post('/api/generateRoom', (req, res) => {
  let code;
  do {
    code = generateRoomCode();
  } while (activeRooms.has(code));
  activeRooms.add(code);
  res.json({ roomCode: code });
});

// Quick play: find or create room with only 1 user
app.get('/api/quickplay', (req, res) => {
  // Find a room with 1 user
  // For demo simplicity, just create new room each time
  let code;
  do {
    code = generateRoomCode();
  } while (activeRooms.has(code));
  activeRooms.add(code);
  res.json({ roomCode: code });
});

io.on('connection', (socket) => {
  socket.on('joinRoom', (roomCode) => {
    socket.join(roomCode);
    console.log(`User joined room: ${roomCode}`);

    // Notify others in room
    socket.to(roomCode).emit('userJoined', socket.id);

    // Add listeners for drawing, clear, text, etc., scoped to room
    socket.on('draw', (data) => {
      socket.to(roomCode).emit('draw', data);
    });

    socket.on('clear', () => {
      socket.to(roomCode).emit('clear');
    });

    socket.on('text', (data) => {
      socket.to(roomCode).emit('text', data);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from room ${roomCode}`);
    });
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
