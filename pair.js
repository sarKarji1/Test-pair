import { startnigg } from '../utils/startnigg.js';

export async function handlePairing(req, res) {
  let phone = req.query.phone;

  if (!phone) return res.json({ error: 'Please Provide Phone Number' });

  try {
    const { qrCodeDataURL, pastebinLink, sessionFolder } = await startnigg(phone);
    
    // Send QR code URL to user
    res.json({
      message: 'Scan the QR code to pair your WhatsApp',
      qrCode: qrCodeDataURL,
      pastebinLink: pastebinLink,
      sessionFolder: sessionFolder
    });
  } catch (error) {
    console.error('Error in WhatsApp authentication:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
