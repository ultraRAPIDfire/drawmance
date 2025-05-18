const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

// Store all drawing and text actions
const drawingHistory = [];

io.on('connection', (socket) => {
  console.log('a user connected');

  // Send existing history to new client
  socket.emit('init', drawingHistory);

  // Drawing/erasing
  socket.on('draw', (data) => {
    drawingHistory.push({ type: 'draw', data });
    socket.broadcast.emit('draw', data);
  });

  // Text insert
  socket.on('text', (data) => {
    drawingHistory.push({ type: 'text', data });
    socket.broadcast.emit('text', data);
  });

  // Clear canvas
  socket.on('clear', () => {
    drawingHistory.length = 0; // Clear history
    socket.broadcast.emit('clear');
    socket.emit('clear');
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
