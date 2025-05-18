const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

const rooms = {}; // To store drawing history per room

io.on("connection", (socket) => {
  let currentRoom = null;

  socket.on("joinRoom", (room) => {
    if (currentRoom) {
      socket.leave(currentRoom);
    }

    currentRoom = room;
    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = [];
    }

    // Send existing history to newly joined user
    socket.emit("init", rooms[room]);

    console.log(`User joined room: ${room}`);
  });

  socket.on("draw", (data) => {
    if (!data.room) return;
    rooms[data.room].push({ type: "draw", data });
    socket.to(data.room).emit("draw", data);
  });

  socket.on("clear", (room) => {
    if (!room) return;
    rooms[room] = [];
    socket.to(room).emit("clear");
  });

  socket.on("text", (data) => {
    if (!data.room) return;
    rooms[data.room].push({ type: "text", data });
    socket.to(data.room).emit("text", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
