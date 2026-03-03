import https from 'https';
import querystring from 'querystring';

/**
 * 알리고 SMS 전송 AWS Lambda 함수
 * 
 * 환경변수:
 * - ALIGO_API_KEY: pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9
 * - ALIGO_USER_ID: pe2pyx6zg5aqszgwr4mcwa59vrcbyrx9
 * - ALIGO_SENDER: 0624006991 (지바이크 대표번호)
 * 
 * 고정 IP: 13.209.230.136 (NAT Gateway)
 */

export const handler = async (event) => {
  console.log('📱 SMS 전송 요청:', JSON.stringify(event, null, 2));
  
  try {
    // 요청 파싱
    let body;
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else {
      body = event;
    }
    
    const { phone, message, action = 'send' } = body;
    
    // 환경변수 확인
    const API_KEY = process.env.ALIGO_API_KEY;
    const USER_ID = process.env.ALIGO_USER_ID;
    const SENDER = process.env.ALIGO_SENDER;
    
    if (!API_KEY || !USER_ID || !SENDER) {
      throw new Error('알리고 환경변수가 설정되지 않았습니다');
    }
    
    console.log('📱 환경변수 확인:', { 
      hasApiKey: !!API_KEY, 
      hasUserId: !!USER_ID, 
      sender: SENDER 
    });
    
    // 잔액 조회
    if (action === 'balance') {
      const balanceResult = await callAligoAPI('/remain/', {
        key: API_KEY,
        user_id: USER_ID
      });
      
      console.log('💰 잔액 조회 결과:', balanceResult);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: balanceResult.result_code === '1',
          balance: parseInt(balanceResult.SMS_CNT || '0'),
          message: balanceResult.message
        })
      };
    }
    
    // SMS 전송
    if (!phone || !message) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: '전화번호와 메시지를 입력하세요'
        })
      };
    }
    
    // 전화번호 정규화 (하이픈 제거)
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const normalizedSender = SENDER.replace(/[^0-9]/g, '');
    
    console.log('📱 SMS 전송 준비:', {
      sender: normalizedSender,
      receiver: normalizedPhone,
      messageLength: message.length
    });
    
    // 알리고 API 호출 (한글 메시지는 인코딩 필요)
    const result = await callAligoAPI('/send/', {
      key: API_KEY,
      user_id: USER_ID,
      sender: normalizedSender,
      receiver: normalizedPhone,
      msg: message, // callAligoAPI 함수에서 자동으로 인코딩됨
      msg_type: message.length > 90 ? 'LMS' : 'SMS',
      title: message.length > 90 ? '지바이크 알림' : ''
    });
    
    console.log('📱 알리고 응답:', result);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: result.result_code === '1',
        message: result.message,
        code: result.result_code,
        messageId: result.msg_id
      })
    };
    
  } catch (error) {
    console.error('❌ SMS 전송 오류:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

/**
 * 알리고 API 호출 함수
 * 한글 메시지는 자동으로 URL 인코딩됩니다.
 */
function callAligoAPI(path, params) {
  return new Promise((resolve, reject) => {
    // 한글 메시지 처리: msg 필드만 encodeURI로 인코딩
    const formatParam = ([key, value]) => {
      if (key === 'msg' || key === 'title') {
        return `${key}=${encodeURI(value)}`;
      }
      return `${key}=${value}`;
    };
    
    const postData = Object.entries(params)
      .map(formatParam)
      .join('&');
    
    console.log('📡 알리고 API 요청:', { path, params: { ...params, key: '***' } });
    
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
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📡 알리고 API 응답 (raw):', data);
        
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('알리고 응답 파싱 실패: ' + data));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('📡 알리고 API 요청 오류:', error);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}
