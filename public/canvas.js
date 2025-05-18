const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const socket = io(); // connects to server

let drawing = false;

canvas.addEventListener("mousedown", () => drawing = true);
canvas.addEventListener("mouseup", () => drawing = false);
canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const x = e.clientX;
  const y = e.clientY;
  draw(x, y);
  socket.emit("draw", { x, y });
});

function draw(x, y) {
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Listen for other users' drawing
socket.on("draw", ({ x, y }) => {
  draw(x, y);
});
