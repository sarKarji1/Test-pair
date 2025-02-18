import express from 'express';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode';
import PastebinAPI from 'pastebin-js';
import { useMultiFileAuthState, makeWASocket, delay, DisconnectReason } from '@whiskeysockets/baileys';

const app = express();
const pastebin = new PastebinAPI('your-pastebin-api-key'); // Replace with your Pastebin API key
const PORT = process.env.PORT || 8000;

// Middleware to handle JSON requests
app.use(express.json());

// Utility to create random session folder names
function createRandomId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
}

// Route to pair user with WhatsApp
app.get('/pair', async (req, res) => {
  const phone = req.query.phone;

  if (!phone) {
    return res.json({ error: 'Please provide a phone number' });
  }

  try {
    const qrCodeData = await startPairing(phone);
    res.json(qrCodeData);
  } catch (error) {
    console.error('Error in pairing:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Function to handle pairing and QR code generation
async function startPairing(phone) {
  return new Promise(async (resolve, reject) => {
    const sessionFolder = `./auth/${createRandomId()}`;

    // Ensure the session folder is created
    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    // Initialize WhatsApp socket
    const socket = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      logger: { level: 'silent' },
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    // Handle connection updates
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        console.log('WhatsApp connected');
        const qrCode = await generateQRCode(socket);
        const pastebinLink = await uploadSessionToPastebin(sessionFolder);

        // Returning the QR code and Pastebin link
        resolve({ qrCode, pastebinLink });
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          fs.rmdirSync(sessionFolder, { recursive: true });
          console.log('Logged out, session folder deleted');
        }
      }
    });
  });
}

// Generate a QR code for WhatsApp authentication
async function generateQRCode(socket) {
  return new Promise((resolve, reject) => {
    socket.generateQr().then((qr) => {
      qrcode.toDataURL(qr, (err, url) => {
        if (err) return reject(err);
        resolve(url); // QR Code as a data URL
      });
    }).catch((error) => reject(error));
  });
}

// Upload session details to Pastebin
async function uploadSessionToPastebin(sessionFolder) {
  try {
    const pasteUrl = await pastebin.createPasteFromFile(
      `${sessionFolder}/creds.json`,
      'WhatsApp Session',
      null,
      1,
      'N'
    );
    return pasteUrl;
  } catch (error) {
    console.error('Error uploading session to Pastebin:', error);
    throw new Error('Pastebin upload failed');
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
