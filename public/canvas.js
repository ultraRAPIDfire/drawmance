const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io();

let drawing = false;
let prevPos = null;
let color = '#000000';
let brushSize = 3;

let currentTool = 'brush';

// Text tool related:
const toolSelect = document.getElementById('toolSelect');
const fontSizeInput = document.getElementById('fontSize');
const boldCheckbox = document.getElementById('boldCheckbox');
const italicCheckbox = document.getElementById('italicCheckbox');

toolSelect.addEventListener('change', () => {
  currentTool = toolSelect.value;
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - document.querySelector('.toolbar').offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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
  if (currentTool === 'brush') {
    drawing = true;
    prevPos = { x: e.offsetX, y: e.offsetY };
  } else if (currentTool === 'text') {
    openTextInput(e.offsetX, e.offsetY);
  }
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
  if (currentTool !== 'brush' || !drawing) return;

  const currentPos = { x: e.offsetX, y: e.offsetY };
  drawLine(prevPos, currentPos, color, brushSize);
  socket.emit('draw', { from: prevPos, to: currentPos, color, brushSize });

  prevPos = currentPos;
});

socket.on('draw', (data) => {
  drawLine(data.from, data.to, data.color, data.brushSize);
});

socket.on('clear', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('text', (data) => {
  drawText(data.text, data.x, data.y, data.color, data.fontSize, data.bold, data.italic);
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

// Text input element
let textInputElem = null;

function openTextInput(x, y) {
  if (textInputElem) return; // only one at a time

  textInputElem = document.createElement('textarea');
  textInputElem.id = 'textInput';
  textInputElem.style.left = x + 'px';
  textInputElem.style.top = y + 'px';
  textInputElem.rows = 1;
  textInputElem.placeholder = 'Enter text...';

  document.body.appendChild(textInputElem);
  textInputElem.focus();

  // On enter or blur, draw the text
  function finishText() {
    const text = textInputElem.value.trim();
    if (text) {
      const fontSize = parseInt(fontSizeInput.value, 10) || 20;
      const bold = boldCheckbox.checked;
      const italic = italicCheckbox.checked;
      drawText(text, x, y, color, fontSize, bold, italic);
      socket.emit('text', { text, x, y, color, fontSize, bold, italic });
    }
    textInputElem.remove();
    textInputElem = null;
  }

  textInputElem.addEventListener('blur', finishText);
  textInputElem.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finishText();
    }
  });
}

function drawText(text, x, y, color, fontSize, bold, italic) {
  ctx.fillStyle = color;
  let fontStr = '';
  if (italic) fontStr += 'italic ';
  if (bold) fontStr += 'bold ';
  fontStr += `${fontSize}px sans-serif`;
  ctx.font = fontStr;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}
