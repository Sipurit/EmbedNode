const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public'))); // put index.html here

const server = app.listen(3000, '0.0.0.0', () => {
  console.log('Server: http://localhost:3000');
});

const wss = new WebSocketServer({ server, path: '/ws' });

let esp32 = null;
let browser = null;

wss.on('connection', (ws, req) => {
  const isBrowser = (req.headers['user-agent'] || '').includes('Mozilla');

  if (!isBrowser) {
    esp32 = ws;
    console.log('ESP32 connected');

    ws.on('message', (msg) => {
      // Forward sensor data → browser
      if (browser?.readyState === 1) browser.send(msg.toString());
    });

    ws.on('close', () => { esp32 = null; console.log('ESP32 disconnected'); });

  } else {
    browser = ws;
    console.log('Browser connected');

    ws.on('message', (msg) => {
      // Forward commands → ESP32
      console.log('Command:', msg.toString());
      if (esp32?.readyState === 1) esp32.send(msg.toString());
    });

    ws.on('close', () => { browser = null; });
  }
});