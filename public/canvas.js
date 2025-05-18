const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io();

let drawing = false;
let prevPos = null;
let color = '#000000';
let brushSize = 3;
let currentTool = 'brush'; // 'brush' or 'eraser' or 'text'

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
const eraserBtn = document.getElementById('eraserBtn');
const textBtn = document.getElementById('textBtn');

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

eraserBtn.addEventListener('click', () => {
  currentTool = currentTool === 'eraser' ? 'brush' : 'eraser';
  eraserBtn.textContent = currentTool === 'eraser' ? 'Eraser (On)' : 'Eraser';
});

textBtn.addEventListener('click', () => {
  currentTool = 'text';
});

// Drawing handlers
canvas.addEventListener('mousedown', (e) => {
  if (currentTool === 'text') {
    const x = e.offsetX;
    const y = e.offsetY;
    const userText = prompt("Enter text:");
    if (userText) {
      ctx.fillStyle = color;
      ctx.font = `${brushSize * 5}px sans-serif`;
      ctx.fillText(userText, x, y);
      socket.emit('text', { x, y, text: userText, color, size: brushSize });
    }
    currentTool = 'brush'; // reset tool
    return;
  }

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
  if (!drawing || currentTool === 'text') return;

  const currentPos = { x: e.offsetX, y: e.offsetY };
  const strokeColor = currentTool === 'eraser' ? '#ffffff' : color;

  drawLine(prevPos, currentPos, strokeColor, brushSize);
  socket.emit('draw', { from: prevPos, to: currentPos, color: strokeColor, brushSize });

  prevPos = currentPos;
});

// Socket listeners for real-time drawing and history sync
socket.on('draw', (data) => {
  drawLine(data.from, data.to, data.color, data.brushSize);
});

socket.on('clear', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('text', (data) => {
  ctx.fillStyle = data.color;
  ctx.font = `${data.size * 5}px sans-serif`;
  ctx.fillText(data.text, data.x, data.y);
});

socket.on('init', (history) => {
  history.forEach((entry) => {
    if (entry.type === 'draw') {
      drawLine(entry.data.from, entry.data.to, entry.data.color, entry.data.brushSize);
    } else if (entry.type === 'text') {
      ctx.fillStyle = entry.data.color;
      ctx.font = `${entry.data.size * 5}px sans-serif`;
      ctx.fillText(entry.data.text, entry.data.x, entry.data.y);
    }
  });
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
