import express from 'express';
import https from 'https';

const app = express();
app.use(express.json());

// CORS 헤더 추가 (모든 도메인 허용)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

const API_KEY = 'pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9';
const USER_ID = 'sangchyn11';
const SENDER = '01086046995';

console.log('SMS Server Configuration:');
console.log('- API Key:', API_KEY.substring(0, 10) + '...');
console.log('- User ID:', USER_ID);
console.log('- Sender:', SENDER);
console.log('- Fixed IP: 13.209.230.136');

app.post('/sms', async (req, res) => {
  console.log('SMS request received:', req.body);
  
  try {
    const { phone, message, action = 'send' } = req.body;
    
    // Balance check
    if (action === 'balance') {
      console.log('Checking SMS balance...');
      const result = await callAligoAPI('/remain/', {
        key: API_KEY,
        user_id: USER_ID
      });
      
      console.log('Balance result:', result);
      
      return res.json({
        success: result.result_code === '1',
        balance: parseInt(result.SMS_CNT || '0'),
        message: result.message
      });
    }
    
    // Send SMS
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }
    
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const normalizedSender = SENDER.replace(/[^0-9]/g, '');
    
    console.log('Sending SMS:', {
      from: normalizedSender,
      to: normalizedPhone,
      messageLength: message.length,
      type: message.length > 90 ? 'LMS' : 'SMS'
    });
    
    const result = await callAligoAPI('/send/', {
      key: API_KEY,
      user_id: USER_ID,
      sender: normalizedSender,
      receiver: normalizedPhone,
      msg: message,
      msg_type: message.length > 90 ? 'LMS' : 'SMS',
      title: message.length > 90 ? 'zbike notification' : ''
    });
    
    console.log('Aligo API response:', result);
    
    res.json({
      success: result.result_code === '1',
      message: result.message,
      code: result.result_code,
      messageId: result.msg_id
    });
    
  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 정비시스템 호환 엔드포인트 추가
app.post('/api/sms/send-direct', async (req, res) => {
  console.log('[send-direct] SMS request received:', req.body);
  
  try {
    const { receiver, message } = req.body;
    
    if (!receiver || !message) {
      return res.status(400).json({
        success: false,
        error: 'Receiver and message are required'
      });
    }
    
    const normalizedPhone = receiver.replace(/[^0-9]/g, '');
    const normalizedSender = SENDER.replace(/[^0-9]/g, '');
    
    console.log('[send-direct] Sending SMS:', {
      from: normalizedSender,
      to: normalizedPhone,
      messageLength: message.length,
      type: message.length > 90 ? 'LMS' : 'SMS'
    });
    
    const result = await callAligoAPI('/send/', {
      key: API_KEY,
      user_id: USER_ID,
      sender: normalizedSender,
      receiver: normalizedPhone,
      msg: message,
      msg_type: message.length > 90 ? 'LMS' : 'SMS',
      title: message.length > 90 ? 'Z-BIKE 알림' : ''
    });
    
    console.log('[send-direct] Aligo API response:', result);
    
    res.json({
      success: result.result_code === '1',
      data: {
        result_code: result.result_code,
        message: result.message,
        msg_id: result.msg_id
      }
    });
    
  } catch (error) {
    console.error('[send-direct] SMS error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
    
    // Send SMS
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }
    
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const normalizedSender = SENDER.replace(/[^0-9]/g, '');
    
    console.log('Sending SMS:', {
      from: normalizedSender,
      to: normalizedPhone,
      messageLength: message.length,
      type: message.length > 90 ? 'LMS' : 'SMS'
    });
    
    const result = await callAligoAPI('/send/', {
      key: API_KEY,
      user_id: USER_ID,
      sender: normalizedSender,
      receiver: normalizedPhone,
      msg: message,
      msg_type: message.length > 90 ? 'LMS' : 'SMS',
      title: message.length > 90 ? 'zbike notification' : ''
    });
    
    console.log('Aligo API response:', result);
    
    res.json({
      success: result.result_code === '1',
      message: result.message,
      code: result.result_code,
      messageId: result.msg_id
    });
    
  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function callAligoAPI(path, params) {
  return new Promise((resolve, reject) => {
    const formatParam = ([key, value]) => {
      if (key === 'msg' || key === 'title') {
        return key + '=' + encodeURI(value);
      }
      return key + '=' + value;
    };
    
    const postData = Object.entries(params).map(formatParam).join('&');
    
    const options = {
      hostname: 'apis.aligo.in',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse Aligo response: ' + data));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('SMS Server Started Successfully!');
  console.log('URL: http://13.209.230.136:' + PORT + '/sms');
  console.log('Fixed IP: 13.209.230.136');
  console.log('='.repeat(60));
});
