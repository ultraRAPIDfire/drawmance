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

// Generate Room (only generate and show, no transition)
generateCodeBtn.addEventListener('click', async () => {
  const res = await fetch('/api/generateRoom', { method: 'POST' });
  const data = await res.json();
  currentRoom = data.roomCode;

  roomCodeBox.textContent = currentRoom;
  generatedCodeDisplay.style.display = 'block';
  generateCodeBtn.textContent = currentRoom;
});

// Copy to clipboard
copyCodeBtn.addEventListener('click', () => {
  if (!currentRoom) return;
  navigator.clipboard.writeText(currentRoom);
  copyCodeBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyCodeBtn.textContent = 'Copy Code';
  }, 2000);
});

// Quick Play (create room and join)
quickPlayBtn.addEventListener('click', async () => {
  const res = await fetch('/api/quickplay');
  const data = await res.json();
  currentRoom = data.roomCode;

  updateURL(currentRoom);
  transitionToDrawing(currentRoom);
});

// Join Room (with validation)
joinRoomBtn.addEventListener('click', async () => {
  const code = joinRoomCode.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    alert('Please enter a valid 6-character room code.');
    return;
  }

  const res = await fetch(`/api/roomExists/${code}`);
  const data = await res.json();

  if (data.exists) {
    currentRoom = code;
    updateURL(currentRoom);
    transitionToDrawing(code);
  } else {
    alert('Room code not found. Please try again.');
  }
});

// Transitions UI and initializes canvasApp
function transitionToDrawing(code) {
  localStorage.setItem('roomCode', code);
  landingScreen.style.display = 'none';
  drawingUI.style.display = 'flex';

  if (window.resizeCanvas) {
    window.resizeCanvas();
  }

  const trySetRoom = () => {
    if (window.canvasApp && typeof window.canvasApp.setRoom === 'function') {
      window.canvasApp.setRoom(code);
    } else {
      setTimeout(trySetRoom, 50);
    }
  };

  trySetRoom();
}

// Push room code to URL bar
function updateURL(code) {
  window.history.pushState({}, '', `/${code}`);
}

// Auto-join from URL if path contains valid room code
window.addEventListener('DOMContentLoaded', () => {
  const match = window.location.pathname.match(/^\/([A-Z0-9]{6})$/i);
  if (match) {
    const code = match[1].toUpperCase();
    joinRoomCode.value = code; // Optional: show in input
    joinRoomBtn.click(); // Simulate join
  }
});
