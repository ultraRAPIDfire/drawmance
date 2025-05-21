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

// For shape drawing
let shapeStartPos = null;
let isDrawingShape = false;

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
      } else if (item.shape) {
        drawShape(item, false);
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
const shapeButtons = document.querySelectorAll('#shapes-group .tool-button');

colorPicker.addEventListener('input', (e) => {
  color = e.target.value;
});

brushSizeInput.addEventListener('input', (e) => {
  brushSize = parseInt(e.target.value, 10);
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

// Tool button handlers
eraserBtn.addEventListener('click', () => {
  if (currentTool === 'eraser') {
    currentTool = 'brush';
    eraserBtn.textContent = 'Eraser';
  } else {
    currentTool = 'eraser';
    eraserBtn.textContent = 'Eraser (On)';
  }
  // Reset shape tool UI
  deactivateShapeButtons();
});

textBtn.addEventListener('click', () => {
  currentTool = 'text';
  eraserBtn.textContent = 'Eraser';
  deactivateShapeButtons();
});

brushBtn.addEventListener('click', () => {
  currentTool = 'brush';
  eraserBtn.textContent = 'Eraser';
  deactivateShapeButtons();
});

// Shape buttons event listeners
shapeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentTool === btn.dataset.tool) {
      // Toggle off shape tool if clicked again
      currentTool = 'brush';
      deactivateShapeButtons();
    } else {
      currentTool = btn.dataset.tool;
      activateShapeButton(btn);
    }
    eraserBtn.textContent = 'Eraser';
  });
});

function activateShapeButton(activeBtn) {
  shapeButtons.forEach(btn => {
    btn.classList.toggle('active', btn === activeBtn);
  });
}

function deactivateShapeButtons() {
  shapeButtons.forEach(btn => btn.classList.remove('active'));
}

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
    currentTool = 'brush'; // Reset to brush after text input
    return;
  }

  if (isShapeTool(currentTool)) {
    shapeStartPos = { x: e.offsetX, y: e.offsetY };
    isDrawingShape = true;
    return;
  }

  drawing = true;
  prevPos = { x: e.offsetX, y: e.offsetY };
});

canvas.addEventListener('mouseup', (e) => {
  if (!room || !socket || !historySynced) return;

  if (isDrawingShape && shapeStartPos) {
    const shapeData = createShapeData(currentTool, shapeStartPos, { x: e.offsetX, y: e.offsetY });
    if (shapeData) {
      drawingHistory.push(shapeData);
      drawShape(shapeData, false);
      socket.emit('shape', shapeData);
    }
    isDrawingShape = false;
    shapeStartPos = null;
    currentTool = 'brush';  // Reset tool after shape drawn
    deactivateShapeButtons();
    return;
  }

  drawing = false;
  prevPos = null;
});

canvas.addEventListener('mouseout', () => {
  drawing = false;
  prevPos = null;
  isDrawingShape = false;
  shapeStartPos = null;
});

canvas.addEventListener('mousemove', (e) => {
  if (!room || !socket || !historySynced) return;

  if (drawing && !isShapeTool(currentTool)) {
    const currentPos = { x: e.offsetX, y: e.offsetY };
    const strokeColor = currentTool === 'eraser' ? '#ffffff' : color;

    drawLine(prevPos, currentPos, strokeColor, brushSize);

    const drawData = { room, from: prevPos, to: currentPos, color: strokeColor, brushSize };
    drawingHistory.push(drawData);
    socket.emit('draw', drawData);

    prevPos = currentPos;
  }

  // Optional: implement shape preview during drawing here if desired
});

// Helper to check if tool is shape tool
function isShapeTool(tool) {
  return ['line', 'rect', 'circle', 'arrow', 'star', 'heart', 'polygon'].includes(tool);
}

function createShapeData(tool, start, end) {
  const shapeBase = {
    room,
    shape: tool,
    color,
    brushSize,
  };

  switch (tool) {
    case 'line':
      return {
        ...shapeBase,
        from: start,
        to: end
      };

    case 'rect':
      return {
        ...shapeBase,
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
      };

    case 'circle': {
      const radius = Math.hypot(end.x - start.x, end.y - start.y);
      return {
        ...shapeBase,
        x: start.x,
        y: start.y,
        radius
      };
    }

    // For arrow, star, heart, polygon you can add minimal implementations or placeholders for now
    case 'arrow':
      return {
        ...shapeBase,
        from: start,
        to: end
      };

    case 'star':
    case 'heart':
    case 'polygon':
      return {
        ...shapeBase,
        x: start.x,
        y: start.y,
        endX: end.x,
        endY: end.y
      };

    default:
      return null;
  }
}

function drawLine(from, to, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawShape(shapeData, emit = true) {
  ctx.strokeStyle = shapeData.color;
  ctx.lineWidth = shapeData.brushSize;
  ctx.fillStyle = shapeData.color;

  switch (shapeData.shape) {
    case 'line':
      drawLine(shapeData.from, shapeData.to, shapeData.color, shapeData.brushSize);
      break;

    case 'rect':
      ctx.strokeRect(shapeData.x, shapeData.y, shapeData.width, shapeData.height);
      break;

    case 'circle':
      ctx.beginPath();
      ctx.arc(shapeData.x, shapeData.y, shapeData.radius, 0, 2 * Math.PI);
      ctx.stroke();
      break;

    case 'arrow':
      drawArrow(shapeData.from, shapeData.to, shapeData.color, shapeData.brushSize);
      break;

    case 'star':
      drawStar(shapeData.x, shapeData.y, shapeData.endX, shapeData.endY, shapeData.color, shapeData.brushSize);
      break;

    case 'heart':
      drawHeart(shapeData.x, shapeData.y, shapeData.endX, shapeData.endY, shapeData.color, shapeData.brushSize);
      break;

    case 'polygon':
      drawPolygon(shapeData.x, shapeData.y, shapeData.endX, shapeData.endY, shapeData.color, shapeData.brushSize);
      break;
  }
}

function drawArrow(from, to, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;

  const headLength = 10;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(to.x, to.y);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawStar(x1, y1, x2, y2, color, size) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const spikes = 5;
  const outerRadius = Math.abs(x2 - x1) / 2;
  const innerRadius = outerRadius / 2.5;

  let rot = Math.PI / 2 * 3;
  let step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerRadius;
    let y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.stroke();
}

function drawHeart(x1, y1, x2, y2, color, size) {
  const x = (x1 + x2) / 2;
  const y = (y1 + y2) / 2;
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  ctx.beginPath();
  ctx.moveTo(x, y + height / 4);
  ctx.bezierCurveTo(x, y, x - width / 2, y, x - width / 2, y + height / 4);
  ctx.bezierCurveTo(x - width / 2, y + height / 2, x, y + height / 1.5, x, y + height);
  ctx.bezierCurveTo(x, y + height / 1.5, x + width / 2, y + height / 2, x + width / 2, y + height / 4);
  ctx.bezierCurveTo(x + width / 2, y, x, y, x, y + height / 4);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.stroke();
}

function drawPolygon(x1, y1, x2, y2, color, size) {
  const sides = 6;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const radius = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;

  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const angle = i * 2 * Math.PI / sides - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.stroke();
}

// Socket.io connection and event handlers
function connectSocket(roomName) {
  if (socket) socket.disconnect();

  socket = io();

  socket.on('connect', () => {
    room = roomName;
    socket.emit('joinRoom', room);

    socket.on('drawingHistory', (history) => {
      drawingHistory = history || [];
      historySynced = true;
      resizeCanvas();
    });

    socket.on('draw', (data) => {
      drawingHistory.push(data);
      drawLine(data.from, data.to, data.color, data.brushSize);
    });

    socket.on('text', (data) => {
      drawingHistory.push(data);
      ctx.fillStyle = data.color;
      ctx.font = `${data.size * 5}px sans-serif`;
      ctx.fillText(data.text, data.x, data.y);
    });

    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawingHistory = [];
    });

    socket.on('shape', (data) => {
      drawingHistory.push(data);
      drawShape(data, false);
    });
  });
}

// Example usage (replace with your actual room join logic)
connectSocket('testroom');

resizeCanvas();