const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let socket = io();  // <-- Moved socket initialization here (once per tab)
let room = '';
let drawing = false;
let prevPos = null;
let color = '#000000';
let brushSize = 3;
let currentTool = 'brush';
let canClear = true;
let clearCooldown = 30;
let listenersInitialized = false;  // <-- To prevent duplicate listeners

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
  socket.emit('clear', room);  // emit clear to server (server will broadcast)
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

// Function to initialize socket listeners and join room
function initSocket() {
  if (!room) return;

  socket.emit('joinRoom', room);

  if (listenersInitialized) return; // prevent duplicate listeners
  listenersInitialized = true;

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

  socket.on('drawingHistory', (history) => {
    resizeCanvas(); // Ensure canvas is properly sized before replaying

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history.forEach((item) => {
      if (item.text) {
        ctx.fillStyle = item.color;
        ctx.font = `${item.size * 5}px sans-serif`;
        ctx.fillText(item.text, item.x, item.y);
      } else if (item.from && item.to) {
        drawLine(item.from, item.to, item.color, item.brushSize);
      }
    });
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

// Expose initSocket and room setter to global scope
window.canvasApp = {
  setRoom: (roomCode) => {
    room = roomCode;
    initSocket();
  }
};
