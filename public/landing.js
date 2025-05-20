const socket = io();

const landingScreen = document.getElementById('landingScreen');
const drawingUI = document.getElementById('drawingUI');
const quickPlayBtn = document.getElementById('quickPlayBtn');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomCode = document.getElementById('joinRoomCode');
const roomCodeBox = document.getElementById('roomCodeBox');
const generatedCodeDisplay = document.getElementById('generatedCodeDisplay');
const copyCodeBtn = document.getElementById('copyCodeBtn');

let currentRoom = '';

// Generate Room
generateCodeBtn.addEventListener('click', async () => {
  const res = await fetch('/api/generateRoom', { method: 'POST' });
  const data = await res.json();
  currentRoom = data.roomCode;

  roomCodeBox.textContent = currentRoom;
  generatedCodeDisplay.style.display = 'block';

  socket.emit('joinRoom', currentRoom);
  transitionToDrawing(currentRoom);
});

// Copy to clipboard
copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(currentRoom);
  copyCodeBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyCodeBtn.textContent = 'Copy Code';
  }, 2000);
});

// Quick Play
quickPlayBtn.addEventListener('click', async () => {
  const res = await fetch('/api/quickplay');
  const data = await res.json();
  currentRoom = data.roomCode;

  socket.emit('joinRoom', currentRoom);
  transitionToDrawing(currentRoom);
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
  const code = joinRoomCode.value.trim().toUpperCase();
  if (code && /^[A-Z0-9]{6}$/.test(code)) {
    currentRoom = code;
    socket.emit('joinRoom', code);
    transitionToDrawing(code);
  } else {
    alert('Please enter a valid 6-character room code.');
  }
});

function transitionToDrawing(code) {
  landingScreen.style.display = 'none';
  drawingUI.style.display = 'flex';
  console.log('Joined room:', code);
}
