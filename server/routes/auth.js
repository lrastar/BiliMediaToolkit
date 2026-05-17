import { Router } from 'express';
import { generateQRCode, pollQRCode, setCookieManually, checkLoginStatus, logout } from '../lib/auth.js';

const router = Router();

router.post('/qr/generate', async (req, res) => {
  try {
    const result = await generateQRCode();
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: -1, message: e.message });
  }
});

router.get('/qr/poll', async (req, res) => {
  try {
    const { qrcode_key } = req.query;
    if (!qrcode_key) {
      return res.status(400).json({ code: -1, message: 'qrcode_key is required' });
    }
    const result = await pollQRCode(qrcode_key);
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: -1, message: e.message });
  }
});

router.post('/cookie', async (req, res) => {
  try {
    const { cookie } = req.body;
    if (!cookie) {
      return res.status(400).json({ code: -1, message: 'cookie is required' });
    }
    const result = await setCookieManually(cookie);
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: -1, message: e.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const result = await checkLoginStatus();
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: -1, message: e.message });
  }
});

router.delete('/logout', (req, res) => {
  try {
    const result = logout();
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: -1, message: e.message });
  }
});

export default router;
