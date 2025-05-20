const socket = io();

// DOM elements
const landingScreen = document.getElementById('landingScreen');
const drawingUI = document.getElementById('drawingUI');
const quickPlayBtn = document.getElementById('quickPlayBtn');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomCode = document.getElementById('joinRoomCode');

let currentRoom = '';

// When user clicks Generate Code
generateCodeBtn.addEventListener('click', () => {
  const generatedCode = generateRoomCode();
  currentRoom = generatedCode;
  socket.emit('joinRoom', generatedCode);
  transitionToDrawing(generatedCode);
});

// When user clicks Join Room
joinRoomBtn.addEventListener('click', () => {
  const code = joinRoomCode.value.trim();
  if (code !== '') {
    currentRoom = code;
    socket.emit('joinRoom', code);
    transitionToDrawing(code);
  }
});

// When user clicks Quick Play
quickPlayBtn.addEventListener('click', () => {
  // In a real system, you'd implement a matchmaker. Here we'll generate a shared room name.
  const quickRoom = 'quick-' + Math.floor(Math.random() * 100000);
  currentRoom = quickRoom;
  socket.emit('joinRoom', quickRoom);
  transitionToDrawing(quickRoom);
});

function transitionToDrawing(code) {
  landingScreen.style.display = 'none';
  drawingUI.style.display = 'flex';
  console.log('Joined room:', code);
}

// Utility: Generate random 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
