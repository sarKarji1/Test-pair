import qrcode from 'qrcode';
import { pastebinCreatePaste } from './pastebin.js';
import { sessionManager, createRandomId } from './sessionManager.js';
import { Baileys } from '@whiskeysockets/baileys';
import fs from 'fs';
import pino from 'pino';

export async function startnigg(phone) {
  return new Promise(async (resolve, reject) => {
    const sessionFolder = `./auth/${createRandomId()}`;
    sessionManager(sessionFolder);

    const { state, saveCreds } = await Baileys.useMultiFileAuthState(sessionFolder);
    const negga = Baileys.makeWASocket({
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      auth: state,
    });

    if (!negga.authState.creds.registered) {
      let phoneNumber = phone ? phone.replace(/[^0-9]/g, '') : '';
      if (phoneNumber.length < 11) {
        return reject(new Error('Please Enter Your Number With Country Code !!'));
      }

      try {
        // Request pairing code
        let code = await negga.requestPairingCode(phoneNumber);

        // Generate QR Code and send to the user
        qrcode.toDataURL(code, async (err, qrCodeDataURL) => {
          if (err) {
            console.error('Error generating QR code:', err);
            reject(new Error('Error generating QR code'));
          }

          // Upload the session to Pastebin
          const pastebinLink = await pastebinCreatePaste(sessionFolder);

          console.log(`Your QR Code: ${qrCodeDataURL}`);
          console.log(`Your Session Link: ${pastebinLink}`);

          resolve({
            qrCodeDataURL: qrCodeDataURL,
            pastebinLink: pastebinLink,
            sessionFolder: sessionFolder
          });
        });
      } catch (error) {
        console.error('Error requesting pairing code from WhatsApp', error);
        reject(new Error('Error requesting pairing code from WhatsApp'));
      }
    }

    negga.ev.on('creds.update', saveCreds);

    negga.ev.on('connection.update', async update => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        // Handle successful connection, optionally paste the session link
        await pastebinCreatePaste(sessionFolder);
      }
    });

    negga.ev.on('messages.upsert', () => {});
  });
      }
