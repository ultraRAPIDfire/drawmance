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

shapeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentTool === btn.dataset.tool) {
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
    currentTool = 'brush';
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
    currentTool = 'brush';
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
});

// Draw a line segment
function drawLine(from, to, strokeColor, size) {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

// Draw shapes based on type
function drawShape(shapeData, isPreview) {
  ctx.strokeStyle = shapeData.color;
  ctx.fillStyle = shapeData.color;
  ctx.lineWidth = shapeData.brushSize;
  ctx.lineCap = 'round';

  switch (shapeData.shape) {
    case 'line':
      ctx.beginPath();
      ctx.moveTo(shapeData.from.x, shapeData.from.y);
      ctx.lineTo(shapeData.to.x, shapeData.to.y);
      ctx.stroke();
      break;

    case 'rect':
      ctx.beginPath();
      ctx.strokeRect(shapeData.x, shapeData.y, shapeData.width, shapeData.height);
      break;

    case 'circle': {
      const radius = Math.hypot(shapeData.x2 - shapeData.x, shapeData.y2 - shapeData.y);
      ctx.beginPath();
      ctx.arc(shapeData.x, shapeData.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'arrow':
      drawArrow(shapeData.from, shapeData.to, shapeData.color, shapeData.brushSize);
      break;

    case 'star':
      drawStar(shapeData.x, shapeData.y, shapeData.radius, shapeData.color, shapeData.brushSize);
      break;

    case 'heart':
      drawHeart(shapeData.x, shapeData.y, shapeData.size, shapeData.color, shapeData.brushSize);
      break;

    case 'polygon':
      drawPolygon(shapeData.x, shapeData.y, shapeData.radius, shapeData.sides || 5, shapeData.color, shapeData.brushSize);
      break;

    default:
      break;
  }
}

// Helpers for drawing shapes
function drawArrow(from, to, color, size) {
  const headlen = 15;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);

  ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6),
             to.y - headlen * Math.sin(angle - Math.PI / 6));

  ctx.moveTo(to.x, to.y);

  ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6),
             to.y - headlen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawStar(cx, cy, outerRadius, color, size) {
  const spikes = 5;
  const innerRadius = outerRadius / 2;

  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.stroke();
}

function drawHeart(x, y, size, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  // left top curve
  ctx.bezierCurveTo(
    x, y,
    x - size / 2, y,
    x - size / 2, y + topCurveHeight
  );
  // left bottom curve
  ctx.bezierCurveTo(
    x - size / 2, y + (size + topCurveHeight) / 2,
    x, y + (size + topCurveHeight) / 2,
    x, y + size
  );
  // right bottom curve
  ctx.bezierCurveTo(
    x, y + (size + topCurveHeight) / 2,
    x + size / 2, y + (size + topCurveHeight) / 2,
    x + size / 2, y + topCurveHeight
  );
  // right top curve
  ctx.bezierCurveTo(
    x + size / 2, y,
    x, y,
    x, y + topCurveHeight
  );
  ctx.closePath();
  ctx.stroke();
}

function drawPolygon(cx, cy, radius, sides, color, lineWidth) {
  if (sides < 3) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const step = (2 * Math.PI) / sides;
  let angle = -Math.PI / 2;

  ctx.beginPath();
  ctx.moveTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));

  for (let i = 1; i < sides; i++) {
    angle += step;
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  ctx.closePath();
  ctx.stroke();
}

// Shape data creator helper
function createShapeData(tool, start, end) {
  switch (tool) {
    case 'line':
      return { room, shape: 'line', from: start, to: end, color, brushSize };
    case 'rect':
      return {
        room,
        shape: 'rect',
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        color,
        brushSize
      };
    case 'circle':
      return {
        room,
        shape: 'circle',
        x: start.x,
        y: start.y,
        x2: end.x,
        y2: end.y,
        color,
        brushSize
      };
    case 'arrow':
      return { room, shape: 'arrow', from: start, to: end, color, brushSize };
    case 'star':
      const radiusStar = Math.hypot(end.x - start.x, end.y - start.y);
      return { room, shape: 'star', x: start.x, y: start.y, radius: radiusStar, color, brushSize };
    case 'heart':
      const sizeHeart = Math.abs(end.x - start.x);
      return { room, shape: 'heart', x: start.x, y: start.y, size: sizeHeart, color, brushSize };
    case 'polygon':
      const radiusPoly = Math.hypot(end.x - start.x, end.y - start.y);
      const sides = 6; // fixed 6-sided polygon, can be customized
      return { room, shape: 'polygon', x: start.x, y: start.y, radius: radiusPoly, sides, color, brushSize };
    default:
      return null;
  }
}

function isShapeTool(tool) {
  return ['line', 'rect', 'circle', 'arrow', 'star', 'heart', 'polygon'].includes(tool);
}

// --- Socket.io setup and handlers ---

function connectSocket(roomCode) {
  socket = io();

  room = roomCode.toUpperCase();

  socket.emit('joinRoom', room);

  socket.on('drawingHistory', (history) => {
    drawingHistory = history || [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    historySynced = true;
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

  socket.on('shape', (data) => {
    drawingHistory.push(data);
    drawShape(data, false);
  });

  socket.on('clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory = [];
  });
}

// Example to call after user enters/generates room code:
// connectSocket('ROOMCODE123');

resizeCanvas();
