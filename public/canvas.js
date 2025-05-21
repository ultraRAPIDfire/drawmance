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

    case 'arrow':
      return {
        ...shapeBase,
        from: start,
        to: end
      };

    case 'star': {
      const points = 5;
      const outer = Math.hypot(end.x - start.x, end.y - start.y);
      const inner = outer / 2;
      return {
        ...shapeBase,
        x: start.x,
        y: start.y,
        points,
        outer,
        inner
      };
    }

    case 'heart': {
      // Draw heart centered between start and end, size approx distance
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const size = Math.hypot(end.x - start.x, end.y - start.y);
      return {
        ...shapeBase,
        x: centerX,
        y: centerY,
        size
      };
    }

    case 'polygon': {
      const sides = 6;  // default hexagon, could extend UI later for user choice
      const radius = Math.hypot(end.x - start.x, end.y - start.y);
      return {
        ...shapeBase,
        x: start.x,
        y: start.y,
        sides,
        radius
      };
    }

    default:
      return null;
  }
}

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

// Draw shape based on shape data
function drawShape(shapeData, fromHistory = true) {
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
      ctx.arc(shapeData.x, shapeData.y, shapeData.radius, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'arrow':
      drawArrow(shapeData.from, shapeData.to, shapeData.color, shapeData.brushSize);
      break;

    case 'star':
      drawStar(shapeData.x, shapeData.y, shapeData.points, shapeData.outer, shapeData.inner, shapeData.color, shapeData.brushSize);
      break;

    case 'heart':
      drawHeart(shapeData.x, shapeData.y, shapeData.size, shapeData.color, shapeData.brushSize);
      break;

    case 'polygon':
      drawPolygon(shapeData.x, shapeData.y, shapeData.sides, shapeData.radius, shapeData.color, shapeData.brushSize);
      break;
  }
}

// Draw arrow function
function drawArrow(from, to, color, size) {
  const headLength = 10 + size * 2; // length of head in pixels
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);

  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.fillStyle = color;
  ctx.fill();
}

// Draw star shape
function drawStar(cx, cy, points, outerRadius, innerRadius, color, size) {
  const step = Math.PI / points;
  ctx.beginPath();
  ctx.moveTo(cx + outerRadius * Math.cos(0), cy + outerRadius * Math.sin(0));

  for (let i = 1; i < 2 * points; i++) {
    const r = (i % 2) === 0 ? outerRadius : innerRadius;
    const angle = i * step;
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();

  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.stroke();
}

// Draw heart shape
function drawHeart(cx, cy, size, color, lineWidth) {
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(cx, cy + topCurveHeight);
  // Left side
  ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + topCurveHeight);
  // Bottom left
  ctx.bezierCurveTo(cx - size / 2, cy + (size + topCurveHeight) / 2, cx, cy + (size + topCurveHeight) / 1.5, cx, cy + size);
  // Bottom right
  ctx.bezierCurveTo(cx, cy + (size + topCurveHeight) / 1.5, cx + size / 2, cy + (size + topCurveHeight) / 2, cx + size / 2, cy + topCurveHeight);
  // Right side
  ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + topCurveHeight);
  ctx.closePath();

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// Draw regular polygon (e.g., hexagon)
function drawPolygon(cx, cy, sides, radius, color, lineWidth) {
  if (sides < 3) return;

  const angle = (2 * Math.PI) / sides;
  ctx.beginPath();
  ctx.moveTo(cx + radius * Math.cos(0), cy + radius * Math.sin(0));

  for (let i = 1; i <= sides; i++) {
    ctx.lineTo(cx + radius * Math.cos(i * angle), cy + radius * Math.sin(i * angle));
  }
  ctx.closePath();

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// Socket.io event handlers (assuming socket is initialized elsewhere)

function initializeSocket(s) {
  socket = s;

  socket.on('clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory = [];
  });

  socket.on('draw', (data) => {
    drawLine(data.from, data.to, data.color, data.brushSize);
    drawingHistory.push(data);
  });

  socket.on('text', (data) => {
    ctx.fillStyle = data.color;
    ctx.font = `${data.size * 5}px sans-serif`;
    ctx.fillText(data.text, data.x, data.y);
    drawingHistory.push(data);
  });

  socket.on('shape', (data) => {
    drawShape(data);
    drawingHistory.push(data);
  });

  socket.on('drawingHistory', (history) => {
    drawingHistory = history || [];
    resizeCanvas();
    historySynced = true;
  });
}

// Call resizeCanvas initially
resizeCanvas();

// Expose initializeSocket so you can call it from outside after socket connects
window.initializeSocket = initializeSocket;