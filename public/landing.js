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

  // Update display
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

// Quick Play (still auto-transitions)
quickPlayBtn.addEventListener('click', async () => {
  const res = await fetch('/api/quickplay');
  const data = await res.json();
  currentRoom = data.roomCode;

  transitionToDrawing(currentRoom);
});

// Join Room (with validation if room exists)
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
    transitionToDrawing(code);
  } else {
    alert('Room code not found. Please try again.');
  }
});

function transitionToDrawing(code) {
    localStorage.setItem('roomCode', code);
    landingScreen.style.display = 'none';
    drawingUI.style.display = 'flex';
    console.log('Joined room:', code);
  
    // ✅ Resize canvas immediately
    if (window.resizeCanvas) {
      window.resizeCanvas(); 
    }
  
    // Wait for canvasApp to be available and set the room
    const trySetRoom = () => {
      if (window.canvasApp && typeof window.canvasApp.setRoom === 'function') {
        window.canvasApp.setRoom(code);
      } else {
        setTimeout(trySetRoom, 50);
      }
    };
  
    trySetRoom();
  }