const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let socket = null;
let room = '';
let drawing = false;
let prevPos = null;
let color = '#000000';
let brushSize = 3;
let currentTool = 'brush';
let canClear = true;
const clearCooldown = 30;

let drawingHistory = [];  // Store all drawing actions for replay on resize
let historySynced = false; // Prevent drawing before sync is complete

// Resize canvas and redraw history
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - document.querySelector('.toolbar').offsetHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (drawingHistory.length) {
    drawingHistory.forEach(item => {
      if (item.text) {
        ctx.fillStyle = item.color;
        ctx.font = `${item.size * 5}px sans-serif`;
        ctx.fillText(item.text, item.x, item.y);
      } else if (item.from && item.to) {
        drawLine(item.from, item.to, item.color, item.brushSize);
      }
    });
  }
}

window.addEventListener('resize', resizeCanvas);

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
  drawingHistory = [];
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
  if (currentTool === 'eraser') {
    currentTool = 'brush';
    eraserBtn.textContent = 'Eraser';
  } else {
    currentTool = 'eraser';
    eraserBtn.textContent = 'Eraser (On)';
  }
});

textBtn.addEventListener('click', () => {
  currentTool = 'text';
});

brushBtn.addEventListener('click', () => {
  currentTool = 'brush';
  eraserBtn.textContent = 'Eraser';
});

// Drawing logic
canvas.addEventListener('mousedown', (e) => {
  if (!room || !socket || !historySynced) return;

  if (currentTool === 'text') {
    const x = e.offsetX;
    const y = e.offsetY;
    const userText = prompt("Enter text:");
    if (userText) {
      ctx.fillStyle = color;
      ctx.font = `${brushSize * 5}px sans-serif`;
      ctx.fillText(userText, x, y);
      const textData = { room, x, y, text: userText, color, size: brushSize };
      drawingHistory.push(textData);
      socket.emit('text', textData);
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
  if (!drawing || currentTool === 'text' || !room || !socket || !historySynced) return;

  const currentPos = { x: e.offsetX, y: e.offsetY };
  const strokeColor = currentTool === 'eraser' ? '#ffffff' : color;

  drawLine(prevPos, currentPos, strokeColor, brushSize);

  const drawData = { room, from: prevPos, to: currentPos, color: strokeColor, brushSize };
  drawingHistory.push(drawData);
  socket.emit('draw', drawData);

  prevPos = currentPos;
});

function drawLine(from, to, strokeColor, size) {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

let listenersInitialized = false;

function initSocket() {
  if (socket) return;

  socket = io();

  socket.on('connect', () => {
    if (room) {
      socket.emit('joinRoom', room);
      socket.emit('requestHistory', room);
    }
  });

  if (!listenersInitialized) {
    listenersInitialized = true;

    socket.on('draw', (data) => {
      drawLine(data.from, data.to, data.color, data.brushSize);
      drawingHistory.push(data);
    });

    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawingHistory = [];
    });

    socket.on('text', (data) => {
      ctx.fillStyle = data.color;
      ctx.font = `${data.size * 5}px sans-serif`;
      ctx.fillText(data.text, data.x, data.y);
      drawingHistory.push(data);
    });

    socket.on('drawingHistory', (history) => {
      drawingHistory = history;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawingHistory.forEach((item) => {
        if (item.text) {
          ctx.fillStyle = item.color;
          ctx.font = `${item.size * 5}px sans-serif`;
          ctx.fillText(item.text, item.x, item.y);
        } else if (item.from && item.to) {
          drawLine(item.from, item.to, item.color, item.brushSize);
        }
      });

      historySynced = true;
    });
  }
}

function setRoom(roomCode) {
  room = roomCode;
  historySynced = false;
  if (!socket) {
    initSocket();
  } else {
    socket.emit('joinRoom', room);
    socket.emit('requestHistory', room);
  }
}

window.canvasApp = {
  setRoom,
};

window.resizeCanvas = resizeCanvas;
