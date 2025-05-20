const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let socket;
let room = '';
let drawing = false;
let prevPos = null;
let color = '#000000';
let brushSize = 3;
let currentTool = 'brush';
let canClear = true;
let clearCooldown = 30;

// Resize canvas to fit window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - document.querySelector('.toolbar').offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Toolbar elements
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');
const eraserBtn = document.getElementById('eraserBtn');
const textBtn = document.getElementById('textBtn');
const brushBtn = document.getElementById('brushBtn');

colorPicker.addEventListener('input', (e) => {
  color = e.target.value;
});

brushSizeInput.addEventListener('input', (e) => {
  brushSize = e.target.value;
});

clearBtn.addEventListener('click', () => {
  if (!canClear || !room) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('clear', room);
  canClear = false;
  startClearCooldown();
});

function startClearCooldown() {
  let timeLeft = clearCooldown;
  clearBtn.disabled = true;
  const originalText = clearBtn.textContent;
  const interval = setInterval(() => {
    clearBtn.textContent = `Clear (${timeLeft}s)`;
    timeLeft--;
    if (timeLeft < 0) {
      clearBtn.textContent = originalText;
      clearBtn.disabled = false;
      canClear = true;
      clearInterval(interval);
    }
  }, 1000);
}

eraserBtn.addEventListener('click', () => {
  currentTool = currentTool === 'eraser' ? 'brush' : 'eraser';
  eraserBtn.textContent = currentTool === 'eraser' ? 'Eraser (On)' : 'Eraser';
});

textBtn.addEventListener('click', () => {
  currentTool = 'text';
});

brushBtn.addEventListener('click', () => {
  currentTool = 'brush';
  eraserBtn.textContent = 'Eraser';
});

canvas.addEventListener('mousedown', (e) => {
  if (!room) return;

  if (currentTool === 'text') {
    const x = e.offsetX;
    const y = e.offsetY;
    const userText = prompt("Enter text:");
    if (userText) {
      ctx.fillStyle = color;
      ctx.font = `${brushSize * 5}px sans-serif`;
      ctx.fillText(userText, x, y);
      socket.emit('text', { room, x, y, text: userText, color, size: brushSize });
    }
    currentTool = 'brush';
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
  if (!drawing || currentTool === 'text' || !room) return;

  const currentPos = { x: e.offsetX, y: e.offsetY };
  const strokeColor = currentTool === 'eraser' ? '#ffffff' : color;

  drawLine(prevPos, currentPos, strokeColor, brushSize);
  socket.emit('draw', { room, from: prevPos, to: currentPos, color: strokeColor, brushSize });

  prevPos = currentPos;
});

// Function to initialize socket connection and join room
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('joinRoom', room);
  });

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
}

function drawLine(from, to, strokeColor, size) {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

// Expose initSocket and room to global scope for access from landing.js
window.canvasApp = {
  setRoom: (roomCode) => {
    room = roomCode;
    initSocket();
  }
};

function drawFromData(data) {
  drawLine(data.from, data.to, data.color, data.brushSize);
}

function drawText(data) {
  ctx.fillStyle = data.color;
  ctx.font = `${data.size * 5}px sans-serif`;
  ctx.fillText(data.text, data.x, data.y);
}

socket.on('drawingHistory', (history) => {
  history.forEach((item) => {
    if (item.text !== undefined) {
      drawText(item);
    } else {
      drawFromData(item);
    }
  });
});
