const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io();

let drawing = false;
let prevPos = null;
let color = '#000000';
let brushSize = 3;

// Resize canvas to fill window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - document.querySelector('.toolbar').offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Toolbar controls
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');

colorPicker.addEventListener('input', (e) => {
  color = e.target.value;
});

brushSizeInput.addEventListener('input', (e) => {
  brushSize = e.target.value;
});

clearBtn.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('clear');
});

// Drawing handlers
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
  drawLine(prevPos, currentPos, color, brushSize);
  socket.emit('draw', { from: prevPos, to: currentPos, color, brushSize });

  prevPos = currentPos;
});

// Socket listeners for real-time drawing
socket.on('draw', (data) => {
  drawLine(data.from, data.to, data.color, data.brushSize);
});

socket.on('clear', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Drawing function
function drawLine(from, to, strokeColor, size) {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
