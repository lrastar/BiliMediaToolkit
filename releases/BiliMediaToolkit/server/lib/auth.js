import { API_BASE } from './constants.js';
import { getCookie, updateConfig } from './config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PASSPORT_BASE = 'https://passport.bilibili.com';

function getHeaders(cookie) {
  const headers = {
    'User-Agent': UA,
    'Referer': 'https://www.bilibili.com'
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  return headers;
}

export async function generateQRCode() {
  const res = await fetch(`${PASSPORT_BASE}/x/passport-login/web/qrcode/generate?source=main-fe-header`, {
    headers: getHeaders()
  });
  const data = await res.json();

  if (data.code !== 0 || !data.data?.url || !data.data?.qrcode_key) {
    throw new Error(data.message || `B站二维码生成失败 (code: ${data.code})`);
  }

  return {
    url: data.data.url,
    qrcode_key: data.data.qrcode_key
  };
}

export async function pollQRCode(qrcode_key) {
  const res = await fetch(`${PASSPORT_BASE}/x/passport-login/web/qrcode/poll?qrcode_key=${qrcode_key}`, {
    headers: getHeaders()
  });
  const data = await res.json();

  if (!data.data) {
    return { status: 'waiting' };
  }

  const code = data.data.code;

  if (code === 86101) {
    return { status: 'waiting' };
  }
  if (code === 86090) {
    return { status: 'scanned' };
  }
  if (code === 86038) {
    return { status: 'expired' };
  }
  if (code === 0) {
    const responseUrl = data.data.url;
    if (!responseUrl) {
      return { status: 'waiting' };
    }
    const params = new URL(responseUrl).searchParams;
    const cookieParts = [
      `DedeUserID=${params.get('DedeUserID')}`,
      `DedeUserID__ckMd5=${params.get('DedeUserID__ckMd5')}`,
      `SESSDATA=${params.get('SESSDATA')}`,
      `bili_jct=${params.get('bili_jct')}`
    ];
    const cookie = cookieParts.join('; ');
    updateConfig({ cookie });
    return { status: 'success', cookie };
  }

  return { status: 'waiting' };
}

export async function setCookieManually(cookieString) {
  const res = await fetch(`${API_BASE}/x/web-interface/nav`, {
    headers: getHeaders(cookieString)
  });
  const data = await res.json();

  if (data.code === 0 && data.data?.isLogin) {
    updateConfig({ cookie: cookieString });
    return {
      success: true,
      userInfo: {
        mid: data.data.mid,
        uname: data.data.uname,
        face: data.data.face
      }
    };
  }

  return { success: false };
}

export async function checkLoginStatus() {
  const cookie = getCookie();
  if (!cookie) {
    return { isLogin: false };
  }

  const res = await fetch(`${API_BASE}/x/web-interface/nav`, {
    headers: getHeaders(cookie)
  });
  const data = await res.json();

  if (data.code === 0 && data.data?.isLogin) {
    return {
      isLogin: true,
      userInfo: {
        mid: data.data.mid,
        uname: data.data.uname,
        face: data.data.face,
        vipStatus: data.data.vipStatus
      }
    };
  }

  return { isLogin: false };
}

export function logout() {
  updateConfig({ cookie: '' });
  return { success: true };
}
