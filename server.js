const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

io.on('connection', (socket) => {
  console.log('a user connected');

  // Relay drawing and erasing (same structure)
  socket.on('draw', (data) => {
    socket.broadcast.emit('draw', data);
  });

  // Relay clear canvas
  socket.on('clear', () => {
    socket.broadcast.emit('clear');
  });

  // Relay inserted text
  socket.on('text', (data) => {
    socket.broadcast.emit('text', data);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
