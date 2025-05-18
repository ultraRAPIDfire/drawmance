const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io();

let drawing = false;
let prevPos = null;
let color = '#000000';
let brushSize = 3;
let mode = 'brush'; // brush | eraser | text

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
const brushBtn = document.getElementById('brushBtn');
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

brushBtn.addEventListener('click', () => {
  mode = 'brush';
});

eraserBtn.addEventListener('click', () => {
  mode = 'eraser';
});

textBtn.addEventListener('click', () => {
  mode = 'text';
});

// Drawing and Text Insert Handlers
canvas.addEventListener('mousedown', (e) => {
  if (mode === 'text') {
    const text = prompt('Enter text:');
    if (text) {
      const x = e.offsetX;
      const y = e.offsetY;
      ctx.fillStyle = color;
      ctx.font = `${brushSize * 5}px sans-serif`;
      ctx.fillText(text, x, y);
      socket.emit('text', { text, x, y, color, size: brushSize });
    }
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
  if (!drawing || mode === 'text') return;

  const currentPos = { x: e.offsetX, y: e.offsetY };

  const strokeColor = mode === 'eraser' ? '#ffffff' : color;
  drawLine(prevPos, currentPos, strokeColor, brushSize);
  socket.emit('draw', {
    from: prevPos,
    to: currentPos,
    color: strokeColor,
    brushSize
  });

  prevPos = currentPos;
});

// Socket listeners
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
