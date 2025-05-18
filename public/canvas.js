const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io();

let drawing = false;
let prevPos = null;

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  prevPos = { x: e.offsetX, y: e.offsetY };
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
  prevPos = null;
});

canvas.addEventListener('mouseout', () => {
  drawing = false;
  prevPos = null;
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;

  const currentPos = { x: e.offsetX, y: e.offsetY };

  drawLine(prevPos, currentPos);
  socket.emit('draw', { from: prevPos, to: currentPos });

  prevPos = currentPos;
});

// Listen for drawing from others
socket.on('draw', (data) => {
  drawLine(data.from, data.to);
});

function drawLine(from, to) {
  ctx.strokeStyle = 'black';  // you can customize color
  ctx.lineWidth = 2;           // thickness of the line
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
