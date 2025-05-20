const landingScreen = document.getElementById('landingScreen');
const drawingScreen = document.getElementById('drawingScreen');

const quickPlayBtn = document.getElementById('quickPlayBtn');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomCodeInput = document.getElementById('joinRoomCode');

let socket;

function enterRoom(roomCode) {
  landingScreen.style.display = 'none';
  drawingScreen.style.display = 'block';

  // Initialize socket connection with room info
  socket = io();

  // Tell server to join room
  socket.emit('joinRoom', roomCode);

  // Pass socket to your existing canvas.js code (adjust canvas.js to accept external socket)
  window.startDrawingApp(socket, roomCode);
}

// Quick play: ask server to assign you to a random available room or create one
quickPlayBtn.addEventListener('click', () => {
  fetch('/api/quickplay')
    .then(res => res.json())
    .then(data => {
      enterRoom(data.roomCode);
    });
});

// Generate code: create a private room code on the server
generateCodeBtn.addEventListener('click', () => {
  fetch('/api/generateRoom')
    .then(res => res.json())
    .then(data => {
      alert(`Your private room code is: ${data.roomCode}`);
      enterRoom(data.roomCode);
    });
});

// Join room by code
joinRoomBtn.addEventListener('click', () => {
  const roomCode = joinRoomCodeInput.value.trim();
  if (!roomCode) {
    alert('Please enter a room code.');
    return;
  }
  enterRoom(roomCode);
});
