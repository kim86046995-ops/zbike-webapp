import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';

// type Bindings = {
//   DB: D1Database;
// }

const app = new Hono();

// ============================================
// 전역 CORS 설정 (모든 브라우저 호환)
// ============================================
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  exposeHeaders: ['Content-Length', 'X-Session-ID'],
  credentials: false,
  maxAge: 600
}));

// ============================================
// 루트 경로 - 로그인으로 리다이렉트
// ============================================
// 루트 경로: 대시보드로 리다이렉트
app.get('/', c => {
  return c.redirect('/dashboard');
});

// 캐시 무효화 미들웨어 (모든 응답)
app.use('*', async (c, next) => {
  await next();

  // 모든 응답에 캐시 무효화 헤더 추가 (HTML, JS, CSS 포함)
  c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  c.res.headers.set('Pragma', 'no-cache');
  c.res.headers.set('Expires', '0');
});

// 정적 HTML 파일 직접 서빙
app.get('/static/:filename', serveStatic({
  root: './public'
}));

// 나머지 정적 파일
app.use('/static/*', serveStatic({
  root: './public'
}));

// ============================================
// 인증 헬퍼 함수
// ============================================

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 한국 시간(KST) 생성 헬퍼 함수
function getKSTDateTime() {
  const now = new Date();
  // UTC 시간에 9시간 추가 (한국 시간)
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // SQLite datetime 형식: YYYY-MM-DD HH:mm:ss
  return kstTime.toISOString().slice(0, 19).replace('T', ' ');
}

// ============================================
// 계약 이력 기록 헬퍼 함수
// ============================================

async function recordContractHistory(DB, contractId, motorcycleId, customerId, contractNumber, contractType, actionType, oldStatus, newStatus, startDate, endDate, monthlyFee, deposit, specialTerms, actionReason = '') {
  try {
    await DB.prepare(`
      INSERT INTO contract_history (
        contract_id, motorcycle_id, customer_id, contract_number, contract_type,
        action_type, old_status, new_status, start_date, end_date,
        monthly_fee, deposit, special_terms, action_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(contractId, motorcycleId, customerId, contractNumber, contractType, actionType, oldStatus, newStatus, startDate, endDate, monthlyFee, deposit, specialTerms, actionReason).run();
    console.log(`📝 Contract history recorded: ${contractNumber} - ${actionType}`);
  } catch (error) {
    console.error('❌ Failed to record contract history:', error);
  }
}
async function createSession(DB, userId) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24시간

  await DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(sessionId, userId, expiresAt).run();
  return sessionId;
}
async function validateSession(DB, sessionId) {
  if (!sessionId) return null;
  const session = await DB.prepare(`
    SELECT s.*, u.username, u.name, u.role 
    FROM sessions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionId).first();
  return session;
}

// ============================================
// 인증 미들웨어
// ============================================

async function authMiddleware(c, next) {
  const sessionId = c.req.header('X-Session-ID') || c.req.query('session');
  if (!sessionId) {
    return c.json({
      error: '인증이 필요합니다'
    }, 401);
  }

  // 세션 저장소에서 확인 (DB 없이도 작동)
  const session = sessionStore.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessionStore.delete(sessionId);
    return c.json({
      error: '세션이 만료되었습니다'
    }, 401);
  }
  c.set('user', session.user);
  await next();
}

// 슈퍼관리자 전용 미들웨어
async function superAdminMiddleware(c, next) {
  const sessionId = c.req.header('X-Session-ID') || c.req.query('session');
  const session = await validateSession(c.env.DB, sessionId);
  if (!session) {
    return c.json({
      error: '인증이 필요합니다'
    }, 401);
  }
  if (session.role !== 'super_admin') {
    return c.json({
      error: '슈퍼관리자 권한이 필요합니다'
    }, 403);
  }
  c.set('user', session);
  await next();
}

// ============================================
// 인증 API
// ============================================

// 임시 세션 저장소 (메모리에 저장, 서버 재시작 시 초기화)
const sessionStore = new Map();

// 로그인
app.post('/api/auth/login', async c => {
  const {
    username,
    password
  } = await c.req.json();

  // 임시: 하드코딩된 관리자 계정들 (데이터베이스 없이도 작동)
  const HARDCODED_USERS = [{
    id: 1,
    username: 'admin',
    password: 'admin123',
    name: '관리자',
    role: 'admin'
  }, {
    id: 2,
    username: 'sangchun11',
    password: 'a2636991',
    name: '관리자',
    role: 'super_admin' // ← 슈퍼관리자
  }, {
    id: 3,
    username: 'wjsqheo',
    password: 'a2636991',
    name: '김광현',
    role: 'admin' // ← 일반 관리자
  }];

  // 하드코딩된 계정 확인
  const hardcodedUser = HARDCODED_USERS.find(user => user.username === username && user.password === password);
  if (hardcodedUser) {
    // 세션 ID 생성 (데이터베이스 없이)
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // 세션 저장소에 저장 (24시간 유효)
    sessionStore.set(sessionId, {
      user: hardcodedUser,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    });
    return c.json({
      success: true,
      sessionId,
      user: {
        id: hardcodedUser.id,
        username: hardcodedUser.username,
        name: hardcodedUser.name,
        role: hardcodedUser.role
      }
    });
  }

  // 데이터베이스가 있으면 데이터베이스에서도 확인
  try {
    const {
      DB
    } = c.env;
    if (DB) {
      console.log('🔐 DB Login attempt:', username);
      
      // 비밀번호를 SHA-256으로 해시 (Web Crypto API 사용)
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log('🔑 Hashed password:', hashedPassword);
      
      const user = await DB.prepare('SELECT * FROM users WHERE username = ? AND password = ?').bind(username, hashedPassword).first();
      
      console.log('👤 User found:', user ? `Yes (${user.username})` : 'No');
      console.log('📊 User status:', user?.status);
      
      if (user && user.status === 'active') {
        const sessionId = await createSession(DB, user.id);
        return c.json({
          success: true,
          sessionId,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
          }
        });
      } else if (user) {
        console.log('⚠️ User inactive:', user.status);
        return c.json({
          error: '비활성화된 계정입니다'
        }, 401);
      }
    }
  } catch (error) {
    console.error('❌ DB login error:', error);
  }
  return c.json({
    error: '아이디 또는 비밀번호가 잘못되었습니다'
  }, 401);
});

// 로그아웃
app.post('/api/auth/logout', async c => {
  const sessionId = c.req.header('X-Session-ID');
  if (sessionId) {
    // 세션 저장소에서 제거
    sessionStore.delete(sessionId);
  }
  return c.json({
    success: true
  });
});

// 세션 확인
app.get('/api/auth/check', async c => {
  const sessionId = c.req.header('X-Session-ID') || c.req.query('session');
  if (!sessionId) {
    return c.json({
      authenticated: false
    });
  }

  // 세션 저장소에서 확인
  const session = sessionStore.get(sessionId);
  if (!session) {
    return c.json({
      authenticated: false
    });
  }

  // 세션 만료 확인
  if (session.expiresAt < Date.now()) {
    sessionStore.delete(sessionId);
    return c.json({
      authenticated: false
    });
  }
  return c.json({
    authenticated: true,
    user: {
      id: session.user.id,
      username: session.user.username,
      name: session.user.name,
      role: session.user.role
    }
  });
});

// 사용자 목록 조회 (관리자 전용)
app.get('/api/admin/users', async c => {
  const {
    DB
  } = c.env;
  const sessionId = c.req.header('X-Session-ID');
  const session = await validateSession(DB, sessionId);
  if (!session || session.role !== 'super_admin') {
    return c.json({
      error: '권한이 없습니다'
    }, 403);
  }

  // 모든 관리자 조회 (아이디 순)
  const result = await DB.prepare(`
    SELECT 
      u.id,
      u.username,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.status,
      u.created_at,
      (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as is_logged_in
    FROM users u
    ORDER BY u.username ASC
  `).all();
  return c.json({
    success: true,
    admins: result.results
  });
});

// 관리자 상태 변경 (슈퍼관리자 전용)
app.post('/api/admin/users/:id/status', async c => {
  const {
    DB
  } = c.env;
  const sessionId = c.req.header('X-Session-ID');
  const session = await validateSession(DB, sessionId);
  if (!session || session.role !== 'super_admin') {
    return c.json({
      error: '권한이 없습니다'
    }, 403);
  }
  const userId = c.req.param('id');
  const {
    status
  } = await c.req.json();

  // 자기 자신은 변경할 수 없음
  if (session.user_id === parseInt(userId)) {
    return c.json({
      error: '자기 자신의 상태는 변경할 수 없습니다'
    }, 400);
  }

  // 슈퍼관리자는 정지할 수 없음
  const targetUser = await DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
  if (targetUser && targetUser.role === 'super_admin') {
    return c.json({
      error: '슈퍼관리자는 정지할 수 없습니다'
    }, 400);
  }

  // 상태 업데이트
  await DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();

  // 정지 시 모든 세션 삭제
  if (status === 'inactive') {
    await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  }
  return c.json({
    success: true
  });
});

// 관리자 상태 변경 PATCH (username 기반, 슈퍼관리자 전용)
app.patch('/api/admin/users/:username/status', async c => {
  const {
    DB
  } = c.env;
  const sessionId = c.req.header('X-Session-ID');
  const session = await validateSession(DB, sessionId);
  if (!session || session.role !== 'super_admin') {
    return c.json({
      error: '권한이 없습니다'
    }, 403);
  }
  const username = c.req.param('username');
  const {
    status
  } = await c.req.json();

  // 유효한 상태값 체크
  if (!['active', 'inactive'].includes(status)) {
    return c.json({
      error: '유효하지 않은 상태값입니다'
    }, 400);
  }

  // 자기 자신은 변경할 수 없음
  if (session.username === username) {
    return c.json({
      error: '자기 자신의 상태는 변경할 수 없습니다'
    }, 400);
  }

  // 슈퍼관리자는 정지할 수 없음
  const targetUser = await DB.prepare('SELECT id, role FROM users WHERE username = ?').bind(username).first();
  if (!targetUser) {
    return c.json({
      error: '사용자를 찾을 수 없습니다'
    }, 404);
  }
  if (targetUser.role === 'super_admin') {
    return c.json({
      error: '슈퍼관리자는 정지할 수 없습니다'
    }, 400);
  }

  // 상태 업데이트
  await DB.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?').bind(status, username).run();

  // 비활성화 시 모든 세션 삭제
  if (status === 'inactive') {
    await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetUser.id).run();
  }
  return c.json({
    success: true,
    message: status === 'active' ? '사용자가 활성화되었습니다' : '사용자가 비활성화되었습니다'
  });
});

// 아이디 찾기 (이름과 전화번호로)
app.post('/api/auth/find-username', async c => {
  try {
    const {
      DB
    } = c.env;
    const {
      name,
      phone
    } = await c.req.json();
    console.log('🔍 아이디 찾기 요청:', {
      name,
      phone
    });
    const user = await DB.prepare('SELECT username, created_at FROM users WHERE name = ? AND phone = ?').bind(name, phone).first();
    console.log('🔍 조회 결과:', user);
    if (!user) {
      return c.json({
        error: '일치하는 사용자를 찾을 수 없습니다'
      }, 404);
    }
    return c.json({
      success: true,
      username: user.username,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('❌ 아이디 찾기 에러:', error);
    return c.json({
      error: '서버 오류가 발생했습니다: ' + error.message
    }, 500);
  }
});

// 비밀번호 재설정 토큰 생성 (아이디, 이름, 전화번호로 확인)
app.post('/api/auth/request-reset', async c => {
  try {
    const {
      DB
    } = c.env;
    const {
      username,
      name,
      phone
    } = await c.req.json();
    console.log('🔐 비밀번호 재설정 요청:', {
      username,
      name,
      phone
    });
    const user = await DB.prepare('SELECT * FROM users WHERE username = ? AND name = ? AND phone = ?').bind(username, name, phone).first();
    if (!user) {
      return c.json({
        error: '일치하는 사용자를 찾을 수 없습니다'
      }, 404);
    }
    console.log('✅ 사용자 확인:', {
      id: user.id,
      email: user.email
    });

    // 토큰 생성 (6자리 숫자)
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30분

    await DB.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').bind(user.id, token, expiresAt).run();

    // 이메일 발송
    const userEmail = user.email;
    if (userEmail) {
      try {
        console.log('📧 이메일 발송 시도:', userEmail);

        // 이메일 내용
        const emailContent = `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f7fafc; padding: 30px; border: 1px solid #e2e8f0; }
                .token { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
                .info { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; color: #718096; padding: 20px; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔐 비밀번호 재설정</h1>
                  <p>Z-BIKE 오토바이 리스/렌트 시스템</p>
                </div>
                <div class="content">
                  <p>안녕하세요, <strong>${user.name}</strong>님!</p>
                  <p>비밀번호 재설정을 위한 인증번호가 발급되었습니다.</p>
                  
                  <div class="token">${token}</div>
                  
                  <div class="info">
                    <p><strong>⏰ 유효시간: 30분</strong></p>
                    <p>인증번호는 30분 동안만 유효합니다. 시간 내에 입력해주세요.</p>
                  </div>
                  
                  <p>본인이 요청하지 않은 경우, 이 메일을 무시하셔도 됩니다.</p>
                </div>
                <div class="footer">
                  <p>© 2026 Z-BIKE. All rights reserved.</p>
                  <p>이 메일은 발신 전용입니다.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        // Resend API를 사용한 이메일 발송
        const RESEND_API_KEY = c.env.RESEND_API_KEY || '';
        if (RESEND_API_KEY) {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Z-BIKE <noreply@zbike.com>',
              to: [userEmail],
              subject: '[Z-BIKE] 비밀번호 재설정 인증번호',
              html: emailContent
            })
          });
          const emailResult = await emailResponse.json();
          console.log('📧 이메일 발송 결과:', emailResult);
          if (emailResponse.ok) {
            return c.json({
              success: true,
              message: `인증번호가 ${userEmail}로 발송되었습니다. 이메일을 확인해주세요.`,
              email: userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') // 이메일 마스킹
            });
          }
        }

        // 이메일 발송 실패 시 폴백: 화면에 직접 표시 (개발 모드)
        console.log('⚠️ 이메일 발송 실패 또는 API 키 없음. 토큰을 화면에 표시합니다.');
        return c.json({
          success: true,
          token,
          // 개발 모드에서만 토큰 반환
          message: '인증번호가 생성되었습니다. (이메일 발송 기능 미설정)',
          email: userEmail
        });
      } catch (emailError) {
        console.error('❌ 이메일 발송 에러:', emailError);
        // 이메일 발송 실패해도 토큰은 생성되었으므로 화면에 표시
        return c.json({
          success: true,
          token,
          // 폴백으로 토큰 반환
          message: '인증번호가 생성되었습니다. (이메일 발송 실패)',
          email: userEmail
        });
      }
    } else {
      // 이메일이 없는 경우 화면에 표시
      return c.json({
        success: true,
        token,
        message: '인증번호가 생성되었습니다. (이메일 미등록)'
      });
    }
  } catch (error) {
    console.error('❌ 비밀번호 재설정 요청 에러:', error);
    return c.json({
      error: '서버 오류가 발생했습니다: ' + error.message
    }, 500);
  }
});

// 비밀번호 재설정
app.post('/api/auth/reset-password', async c => {
  const {
    DB
  } = c.env;
  const {
    token,
    new_password
  } = await c.req.json();

  // 토큰 확인
  const resetToken = await DB.prepare(`
    SELECT * FROM password_reset_tokens 
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).bind(token).first();
  if (!resetToken) {
    return c.json({
      error: '유효하지 않거나 만료된 인증번호입니다'
    }, 400);
  }

  // 비밀번호 업데이트
  await DB.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(new_password, resetToken.user_id).run();

  // 토큰 사용 처리
  await DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').bind(resetToken.id).run();
  return c.json({
    success: true,
    message: '비밀번호가 재설정되었습니다'
  });
});

// ============================================
// 오토바이 API (인증 필요)
// ============================================

// 오토바이 목록 조회
// 오토바이 목록 조회 (인증 필요 - 민감한 정보 포함)
app.get('/api/motorcycles', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const status = c.req.query('status');
  let query = `
    SELECT 
      m.*,
      c.id as contract_id,
      c.contract_type,
      c.status as contract_status,
      cu.name as customer_name,
      c.start_date,
      c.end_date
    FROM motorcycles m
    LEFT JOIN contracts c ON m.id = c.motorcycle_id 
      AND c.status = 'active'
      AND date(c.end_date) >= date('now')
    LEFT JOIN customers cu ON c.customer_id = cu.id
  `;
  if (status) {
    query += ` WHERE m.status = '${status}'`;
  }
  query += ' ORDER BY m.created_at DESC';
  const result = await DB.prepare(query).all();
  return c.json(result.results);
});

// 공개 API: 고객 계약서 작성용 오토바이 목록 (인증 불필요)
app.get('/api/public/motorcycles', async c => {
  const {
    DB
  } = c.env;
  try {
    // 계약서 작성에 필요한 모든 정보 포함
    const result = await DB.prepare(`
      SELECT 
        id,
        plate_number,
        chassis_number,
        vehicle_name,
        status,
        insurance_company,
        driving_range,
        insurance_start_date,
        insurance_end_date
      FROM motorcycles
      ORDER BY plate_number
    `).all();

    // 페지되지 않은 것만 필터링
    const filtered = result.results?.filter(m => m.status !== 'scrapped') || [];
    return c.json(filtered);
  } catch (error) {
    console.error('Public motorcycles API error:', error);
    return c.json({
      error: 'Failed to load motorcycles',
      details: error.message
    }, 500);
  }
});

// 공개 API: 고객 계약서 작성용 고객 목록 (인증 불필요)
app.get('/api/public/customers', async c => {
  const {
    DB
  } = c.env;
  try {
    const result = await DB.prepare(`
      SELECT 
        id,
        name,
        resident_number,
        phone,
        postcode,
        address,
        detail_address
      FROM customers
      ORDER BY created_at DESC
    `).all();
    return c.json(result.results || []);
  } catch (error) {
    console.error('Public customers API error:', error);
    return c.json({
      error: 'Failed to load customers',
      details: error.message
    }, 500);
  }
});

// 고객 포털용 - 번호판으로 오토바이 검색 (민감한 정보 제외)
app.get('/api/public/motorcycles/search', async c => {
  const {
    DB
  } = c.env;
  const plateNumber = c.req.query('plate_number');
  if (!plateNumber) {
    return c.json({
      error: '번호판을 입력해주세요'
    }, 400);
  }

  // 민감한 정보 제외하고 기본 정보만 반환
  const result = await DB.prepare(`
    SELECT 
      id,
      plate_number,
      vehicle_name,
      model_year
    FROM motorcycles 
    WHERE plate_number = ? AND status = 'available' AND deleted_at IS NULL
  `).bind(plateNumber).first();
  if (!result) {
    return c.json({
      error: '해당 번호판의 오토바이를 찾을 수 없습니다'
    }, 404);
  }
  return c.json(result);
});

// 오토바이 상세 조회
// 오토바이 상세 조회 (인증 필요)
app.get('/api/motorcycles/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const result = await DB.prepare('SELECT * FROM motorcycles WHERE id = ?').bind(id).first();
  if (!result) {
    return c.json({
      error: '오토바이를 찾을 수 없습니다'
    }, 404);
  }
  return c.json(result);
});

// 오토바이 등록 (인증 필요)
app.post('/api/motorcycles', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  if (!DB) {
    return c.json({
      error: 'Database not available'
    }, 500);
  }
  try {
    const data = await c.req.json();
    const result = await DB.prepare(`
      INSERT INTO motorcycles (
        plate_number, vehicle_name, chassis_number, mileage, model_year,
        insurance_company, insurance_start_date, insurance_end_date,
        inspection_start_date, inspection_end_date,
        driving_range, owner_name, insurance_fee, vehicle_price, daily_rental_fee, usage_notes, status,
        certificate_photo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(data.plate_number, data.vehicle_name, data.chassis_number, data.mileage, data.model_year, data.insurance_company, data.insurance_start_date, data.insurance_end_date, data.inspection_start_date || null, data.inspection_end_date || null, data.driving_range, data.owner_name, data.insurance_fee, data.vehicle_price, data.daily_rental_fee || 0, data.usage_notes || '', data.status || 'available', data.certificate_photo || null).run();
    return c.json({
      id: result.meta.last_row_id,
      ...data
    }, 201);
  } catch (error) {
    console.error('오토바이 등록 오류:', error);
    return c.json({
      error: '오토바이 등록 실패',
      details: error.message
    }, 500);
  }
});

// 오토바이 수정 (인증 필요)
app.put('/api/motorcycles/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const data = await c.req.json();
  try {
    // 먼저 기존 데이터 조회
    const existing = await DB.prepare('SELECT * FROM motorcycles WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({
        error: '오토바이를 찾을 수 없습니다'
      }, 404);
    }

    // 기존 데이터와 새 데이터 병합 (새 데이터가 우선)
    const mergedData = {
      plate_number: data.plate_number !== undefined ? data.plate_number : existing.plate_number,
      vehicle_name: data.vehicle_name !== undefined ? data.vehicle_name : existing.vehicle_name,
      chassis_number: data.chassis_number !== undefined ? data.chassis_number : existing.chassis_number,
      mileage: data.mileage !== undefined ? data.mileage : existing.mileage,
      model_year: data.model_year !== undefined ? data.model_year : existing.model_year,
      insurance_company: data.insurance_company !== undefined ? data.insurance_company : existing.insurance_company,
      insurance_start_date: data.insurance_start_date !== undefined ? data.insurance_start_date : existing.insurance_start_date,
      insurance_end_date: data.insurance_end_date !== undefined ? data.insurance_end_date : existing.insurance_end_date,
      inspection_start_date: data.inspection_start_date !== undefined ? data.inspection_start_date : existing.inspection_start_date,
      inspection_end_date: data.inspection_end_date !== undefined ? data.inspection_end_date : existing.inspection_end_date,
      driving_range: data.driving_range !== undefined ? data.driving_range : existing.driving_range,
      owner_name: data.owner_name !== undefined ? data.owner_name : existing.owner_name,
      insurance_fee: data.insurance_fee !== undefined ? data.insurance_fee : existing.insurance_fee,
      vehicle_price: data.vehicle_price !== undefined ? data.vehicle_price : existing.vehicle_price,
      daily_rental_fee: data.daily_rental_fee !== undefined ? data.daily_rental_fee : existing.daily_rental_fee || 0,
      usage_notes: data.usage_notes !== undefined ? data.usage_notes : existing.usage_notes || '',
      status: data.status !== undefined ? data.status : existing.status,
      certificate_photo: data.certificate_photo !== undefined ? data.certificate_photo : existing.certificate_photo,
      monthly_fee: data.monthly_fee !== undefined ? data.monthly_fee : existing.monthly_fee || 0,
      contract_type_text: data.contract_type_text !== undefined ? data.contract_type_text : existing.contract_type_text || '',
      deposit: data.deposit !== undefined ? data.deposit : existing.deposit || 0,
      contract_start_date: data.contract_start_date !== undefined ? data.contract_start_date : existing.contract_start_date || '',
      contract_end_date: data.contract_end_date !== undefined ? data.contract_end_date : existing.contract_end_date || ''
    };
    await DB.prepare(`
      UPDATE motorcycles SET
        plate_number = ?, vehicle_name = ?, chassis_number = ?, mileage = ?,
        model_year = ?, insurance_company = ?, insurance_start_date = ?,
        insurance_end_date = ?, inspection_start_date = ?, inspection_end_date = ?,
        driving_range = ?, owner_name = ?,
        insurance_fee = ?, vehicle_price = ?, daily_rental_fee = ?, usage_notes = ?, status = ?,
        certificate_photo = ?,
        monthly_fee = ?, contract_type_text = ?, deposit = ?,
        contract_start_date = ?, contract_end_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(mergedData.plate_number, mergedData.vehicle_name, mergedData.chassis_number, mergedData.mileage, mergedData.model_year, mergedData.insurance_company, mergedData.insurance_start_date, mergedData.insurance_end_date, mergedData.inspection_start_date, mergedData.inspection_end_date, mergedData.driving_range, mergedData.owner_name, mergedData.insurance_fee, mergedData.vehicle_price, mergedData.daily_rental_fee, mergedData.usage_notes, mergedData.status, mergedData.certificate_photo, mergedData.monthly_fee, mergedData.contract_type_text, mergedData.deposit, mergedData.contract_start_date, mergedData.contract_end_date, id).run();
    return c.json({
      success: true,
      id,
      ...mergedData
    });
  } catch (error) {
    console.error('오토바이 수정 오류:', error);
    return c.json({
      error: '수정 중 오류가 발생했습니다: ' + error.message
    }, 500);
  }
});

// 오토바이 삭제 (인증 필요)
app.delete('/api/motorcycles/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  try {
    // 1. 관련 계약 이력 삭제 (contract_history)
    await DB.prepare('DELETE FROM contract_history WHERE motorcycle_id = ?').bind(id).run();

    // 2. 관련 개인 계약 삭제 (contracts)
    await DB.prepare('DELETE FROM contracts WHERE motorcycle_id = ?').bind(id).run();

    // 3. 관련 업체 계약 삭제 (business_contracts)
    await DB.prepare('DELETE FROM business_contracts WHERE motorcycle_id = ?').bind(id).run();

    // 4. 마지막으로 오토바이 삭제
    await DB.prepare('DELETE FROM motorcycles WHERE id = ?').bind(id).run();
    return c.json({
      message: '삭제되었습니다'
    });
  } catch (error) {
    console.error('오토바이 삭제 실패:', error);
    return c.json({
      error: '삭제에 실패했습니다: ' + error.message
    }, 500);
  }
});

// 오토바이 상태 변경 (해지/폐지)
app.patch('/api/motorcycles/:id/status', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const {
    status,
    usage_notes
  } = await c.req.json();

  // 상태 검증
  const validStatuses = ['available', 'rented', 'maintenance', 'scrapped'];
  if (!validStatuses.includes(status)) {
    return c.json({
      error: '유효하지 않은 상태입니다'
    }, 400);
  }

  // 상태 업데이트
  if (status === 'scrapped' && usage_notes) {
    // 폐지 처리: 상태와 폐지 사유 저장
    await DB.prepare(`
      UPDATE motorcycles 
      SET status = ?, usage_notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, usage_notes, id).run();
  } else if (status === 'available') {
    // 해지 처리: 기본정보와 보험정보는 유지, 계약정보만 초기화
    console.log(`🔄 Contract termination for motorcycle #${id} - clearing contract info only (keeping basic and insurance info)`);
    await DB.prepare(`
      UPDATE motorcycles 
      SET status = ?,
          monthly_fee = NULL,
          contract_type_text = NULL,
          deposit = NULL,
          contract_start_date = NULL,
          contract_end_date = NULL,
          owner_name = '',
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, id).run();
    console.log(`✅ Contract info cleared for motorcycle #${id} (basic info and insurance info preserved)`);
  } else {
    // 일반 상태 변경
    await DB.prepare(`
      UPDATE motorcycles 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(status, id).run();
  }
  return c.json({
    message: status === 'scrapped' ? '폐지 처리되었습니다' : '상태가 변경되었습니다',
    status
  });
});

// 오토바이 폐지 (정보 초기화, 이력 보존)
app.post('/api/motorcycles/:id/scrap', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const {
    usage_notes
  } = await c.req.json();
  console.log(`🗑️ Scrapping motorcycle #${id}`);

  // 1. 기존 오토바이 정보 조회 (차대번호, 연식, 차량명 보존용)
  const motorcycle = await DB.prepare('SELECT * FROM motorcycles WHERE id = ?').bind(id).first();
  if (!motorcycle) {
    return c.json({
      error: '오토바이를 찾을 수 없습니다'
    }, 404);
  }
  console.log(`📋 Original motorcycle: ${motorcycle.vehicle_name} (${motorcycle.chassis_number})`);

  // 2. 오토바이 정보 초기화 (차대번호, 연식, 차량명만 보존)
  await DB.prepare(`
    UPDATE motorcycles 
    SET 
      plate_number = '',
      mileage = 0,
      insurance_company = '',
      insurance_start_date = '',
      insurance_end_date = '',
      driving_range = '',
      owner_name = '',
      insurance_fee = 0,
      vehicle_price = 0,
      daily_rental_fee = 0,
      monthly_fee = NULL,
      contract_type_text = NULL,
      deposit = NULL,
      contract_start_date = NULL,
      contract_end_date = NULL,
      status = 'scrapped',
      usage_notes = ?,
      inspection_start_date = NULL,
      inspection_end_date = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(usage_notes, id).run();
  console.log(`✅ Motorcycle #${id} scrapped. Only vehicle_name, chassis_number, model_year preserved. All other data cleared.`);
  console.log(`📝 Scrap reason: ${usage_notes}`);

  // 3. 계약 이력은 그대로 유지 (아무 작업도 하지 않음)

  return c.json({
    message: '폐지 처리되었습니다. 계약 이력은 보존되었습니다.',
    preserved: {
      vehicle_name: motorcycle.vehicle_name,
      chassis_number: motorcycle.chassis_number,
      model_year: motorcycle.model_year
    }
  });
});

// 오토바이별 계약 이력 조회
// 오토바이별 계약 이력 조회 (인증 필요 - 민감한 고객 정보 포함)
app.get('/api/motorcycles/:id/contracts', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const result = await DB.prepare(`
    SELECT 
      c.*,
      cu.name as customer_name, cu.phone as customer_phone,
      cu.resident_number, cu.address, cu.license_type
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    WHERE c.motorcycle_id = ?
    ORDER BY c.created_at DESC
  `).bind(id).all();
  return c.json(result.results);
});

// ============================================
// 고객 API
// ============================================

// 고객 목록 조회
// 고객 목록 조회 (인증 필요 - 민감한 개인정보)
app.get('/api/customers', authMiddleware, async c => {
  const {
    DB
  } = c.env;

  // 계약자와 활성 계약 타입을 함께 조회
  const result = await DB.prepare(`
    SELECT 
      c.*,
      ct.contract_type as active_contract_type
    FROM customers c
    LEFT JOIN contracts ct ON c.id = ct.customer_id AND ct.status = 'active'
    ORDER BY c.created_at DESC
  `).all();
  return c.json(result.results);
});

// 주민번호로 계약자 조회 (공개 API - 차용증 작성용)
app.get('/api/customers/search', async c => {
  const {
    DB
  } = c.env;
  const residentNumber = c.req.query('resident_number');
  if (!residentNumber) {
    return c.json({
      error: '주민등록번호를 입력해주세요'
    }, 400);
  }
  const result = await DB.prepare('SELECT * FROM customers WHERE resident_number = ?').bind(residentNumber).all();
  return c.json(result.results);
});

// 고객 상세 조회
// 고객 상세 조회 (인증 필요)
app.get('/api/customers/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const result = await DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
  if (!result) {
    return c.json({
      error: '고객을 찾을 수 없습니다'
    }, 404);
  }
  return c.json(result);
});

// 고객 등록 (로그인 불필요 - 고객용 공개 API)
app.post('/api/customers', async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();
  const result = await DB.prepare(`
    INSERT INTO customers (name, resident_number, phone, postcode, address, detail_address, license_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(data.name, data.resident_number, data.phone, data.postcode || '', data.address, data.detail_address || '', data.license_type).run();
  return c.json({
    id: result.meta.last_row_id,
    ...data
  }, 201);
});

// 고객 수정
// 고객 정보 수정 (인증 필요)
app.put('/api/customers/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const data = await c.req.json();
  await DB.prepare(`
    UPDATE customers SET
      name = ?, resident_number = ?, phone = ?, postcode = ?, address = ?, detail_address = ?, license_type = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.name, data.resident_number, data.phone, data.postcode || '', data.address, data.detail_address || '', data.license_type, id).run();
  return c.json({
    id,
    ...data
  });
});

// 계약자 삭제
app.delete('/api/customers/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');

  // 슈퍼관리자 권한 체크
  const user = c.get('user');
  if (user.role !== 'super_admin') {
    return c.json({
      error: '슈퍼관리자만 계약자를 삭제할 수 있습니다'
    }, 403);
  }
  try {
    console.log('계약자 삭제 시작 (슈퍼관리자):', id);

    // 먼저 계약자 정보 조회 (주민번호 확인용)
    const customer = await DB.prepare('SELECT id, name, resident_number FROM customers WHERE id = ?').bind(id).first();
    if (!customer) {
      return c.json({
        error: '계약자를 찾을 수 없습니다'
      }, 404);
    }
    console.log('📋 삭제할 계약자:', customer.name, '/', customer.resident_number);

    // 삭제할 contracts 조회
    const contractsToDelete = await DB.prepare('SELECT id FROM contracts WHERE customer_id = ?').bind(id).all();
    const contractIds = contractsToDelete.results.map(c => c.id);
    console.log('📝 삭제할 계약서 ID:', contractIds);

    // D1 batch API를 사용하여 한 트랜잭션으로 실행
    console.log('🔄 Batch 삭제 시작...');
    const batchQueries = [
    // 1. 외래 키 제약 조건 비활성화
    DB.prepare('PRAGMA foreign_keys = OFF'),
    // 2. UPDATE 트리거 임시 삭제
    DB.prepare('DROP TRIGGER IF EXISTS prevent_history_update'),
    // 3. DELETE 트리거 임시 삭제  
    DB.prepare('DROP TRIGGER IF EXISTS prevent_history_delete')];

    // 4. contract_history의 contract_id를 NULL로 업데이트 (외래 키 참조 해제)
    if (contractIds.length > 0) {
      const contractIdsStr = contractIds.join(',');
      batchQueries.push(DB.prepare(`UPDATE contract_history SET contract_id = NULL WHERE contract_id IN (${contractIdsStr})`));
      console.log('📝 계약 이력의 참조를 해제합니다 (contract_id를 NULL로 설정)');
    }

    // 5. 차용 계약서 삭제 (주민번호로 연결)
    batchQueries.push(DB.prepare('DELETE FROM loan_contracts WHERE borrower_resident_number = ?').bind(customer.resident_number));

    // 6. 개인 계약서 삭제 (customer_id로 연결)
    batchQueries.push(DB.prepare('DELETE FROM contracts WHERE customer_id = ?').bind(id));

    // 7. 계약자 삭제
    batchQueries.push(DB.prepare('DELETE FROM customers WHERE id = ?').bind(id));

    // 8. 트리거 재생성 - UPDATE 방지
    batchQueries.push(DB.prepare(`CREATE TRIGGER prevent_history_update
BEFORE UPDATE ON contract_history
BEGIN
  SELECT RAISE(ABORT, '❌ 계약 이력은 수정할 수 없습니다. 이력은 영구적으로 보호됩니다.');
END`));

    // 9. 트리거 재생성 - DELETE 방지
    batchQueries.push(DB.prepare(`CREATE TRIGGER prevent_history_delete
BEFORE DELETE ON contract_history
BEGIN
  SELECT RAISE(ABORT, '❌ 계약 이력은 삭제할 수 없습니다. 이력은 영구적으로 보호됩니다.');
END`));

    // 10. 외래 키 제약 조건 활성화
    batchQueries.push(DB.prepare('PRAGMA foreign_keys = ON'));
    const results = await DB.batch(batchQueries);
    const historyUpdateIndex = contractIds.length > 0 ? 3 : -1;
    const loanDeleteIndex = historyUpdateIndex + 1;
    const contractsDeleteIndex = loanDeleteIndex + 1;
    const customerDeleteIndex = contractsDeleteIndex + 1;
    console.log('✅ Batch 삭제 완료');
    console.log('📊 삭제 결과:', {
      history_updated: historyUpdateIndex > 0 ? results[historyUpdateIndex]?.meta?.changes || 0 : 0,
      loan_contracts: results[loanDeleteIndex]?.meta?.changes || 0,
      contracts: results[contractsDeleteIndex]?.meta?.changes || 0,
      customer: results[customerDeleteIndex]?.meta?.changes || 0
    });
    return c.json({
      message: '삭제되었습니다. 계약 이력은 보존됩니다.',
      deleted: {
        contracts: results[contractsDeleteIndex]?.meta?.changes || 0,
        loan_contracts: results[loanDeleteIndex]?.meta?.changes || 0,
        customer: results[customerDeleteIndex]?.meta?.changes || 0
      },
      preserved: {
        contract_history: `이력 보호 정책에 따라 보존됨 (${historyUpdateIndex > 0 ? results[historyUpdateIndex]?.meta?.changes || 0 : 0}건의 이력 참조 해제)`
      }
    });
  } catch (error) {
    console.error('❌ 계약자 삭제 최종 실패:', error);
    console.error('❌ 에러 상세:', error.message);
    return c.json({
      error: '삭제에 실패했습니다: ' + error.message
    }, 500);
  }
});

// ============================================
// 업체 API
// ============================================

// 업체 목록 조회
app.get('/api/companies', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const result = await DB.prepare(`
    SELECT * FROM companies ORDER BY created_at DESC
  `).all();
  return c.json(result.results);
});

// 업체 상세 조회
app.get('/api/companies/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const company = await DB.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first();
  if (!company) {
    return c.json({
      error: '업체를 찾을 수 없습니다'
    }, 404);
  }
  return c.json(company);
});

// 업체 생성
app.post('/api/companies', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();
  const result = await DB.prepare(`
    INSERT INTO companies (name, business_number, representative, representative_resident_number, phone, postcode, address, detail_address, signature_data, id_card_photo, terms_agreed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(data.name, data.business_number, data.representative, data.representative_resident_number || '', data.phone, data.postcode || '', data.address, data.detail_address || '', data.signature_data || '', data.id_card_photo || '', data.terms_agreed ? 1 : 0).run();
  return c.json({
    id: result.meta.last_row_id,
    ...data
  }, 201);
});

// 업체 수정
app.put('/api/companies/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const data = await c.req.json();
  await DB.prepare(`
    UPDATE companies SET
      name = ?, business_number = ?, representative = ?, representative_resident_number = ?, phone = ?, postcode = ?, address = ?, detail_address = ?,
      signature_data = ?, id_card_photo = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.name, data.business_number, data.representative, data.representative_resident_number || '', data.phone, data.postcode || '', data.address, data.detail_address || '', data.signature_data || '', data.id_card_photo || '', id).run();
  return c.json({
    id,
    ...data
  });
});

// 업체 삭제 (슈퍼관리자 전용) - 관련 데이터 완전 삭제
app.delete('/api/companies/:id', superAdminMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');

  // 1. 업체 정보 조회 (삭제 전에 company_name과 business_number 가져오기)
  const company = await DB.prepare(`
    SELECT name, business_number FROM companies WHERE id = ?
  `).bind(id).first();
  if (!company) {
    return c.json({
      error: '업체를 찾을 수 없습니다'
    }, 404);
  }

  // 2. 관련 업체 계약서 삭제 (company_name과 business_number로 매칭)
  await DB.prepare(`
    DELETE FROM business_contracts 
    WHERE company_name = ? AND business_number = ?
  `).bind(company.name, company.business_number).run();

  // 3. 업체 정보 삭제
  await DB.prepare(`
    DELETE FROM companies WHERE id = ?
  `).bind(id).run();
  return c.json({
    message: '업체 및 관련 계약서가 완전히 삭제되었습니다',
    id,
    company_name: company.name
  });
});

// ============================================
// 계약서 API
// ============================================

// 대시보드 통계 조회
// 대시보드 통계 (인증 필요 - 민감한 사업 정보)
app.get('/api/dashboard/stats', authMiddleware, async c => {
  const {
    DB
  } = c.env;

  // DB가 없으면 빈 통계 반환 (개발 환경용)
  if (!DB) {
    return c.json({
      motorcycles: {
        total: 0,
        available: 0,
        rented: 0,
        maintenance: 0
      },
      customers: 0,
      contracts: {
        active: 0,
        monthly_revenue: 0,
        total_deposits: 0,
        active_business: 0,
        active_temp: 0,
        active_loans: 0,
        total_loan_amount: 0
      }
    });
  }
  try {
    // 오토바이 총 대수 및 상태별 집계
    const motorcycleStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN status = 'scrapped' THEN 1 ELSE 0 END) as scrapped
      FROM motorcycles
    `).first();

    // 사용자(고객) 수
    const customerCount = await DB.prepare(`
      SELECT COUNT(DISTINCT customer_id) as count 
      FROM contracts
    `).first();

    // 활성 계약 수 (진행중 상태만 카운트: 개인계약)
    const contractStats = await DB.prepare(`
      SELECT 
        COUNT(*) as active_contracts,
        SUM(CAST(monthly_fee as INTEGER)) as total_monthly_revenue,
        SUM(CAST(deposit as INTEGER)) as total_deposits
      FROM contracts
      WHERE status = 'active'
    `).first();

    // 활성 업체계약 수 (진행중 상태만)
    const businessContractStats = await DB.prepare(`
      SELECT COUNT(*) as active_business_contracts
      FROM business_contracts
      WHERE status = 'active'
    `).first();

    // 전체 활성 계약 수 = 개인계약 + 업체계약
    const totalActiveContracts = (contractStats?.active_contracts || 0) + (businessContractStats?.active_business_contracts || 0);

    // 활성 차용증 수 및 총대여금
    const loanStats = await DB.prepare(`
      SELECT 
        COUNT(*) as active_loans,
        SUM(CAST(loan_amount as INTEGER)) as total_loan_amount
      FROM loan_contracts
      WHERE status = 'active'
    `).first();

    // 임시계약 수 (contract_type = 'temp_rent')
    const tempContractStats = await DB.prepare(`
      SELECT COUNT(*) as active_temp_contracts
      FROM contracts
      WHERE status = 'active' AND contract_type = 'temp_rent'
    `).first();
    return c.json({
      motorcycles: {
        total: motorcycleStats.total || 0,
        available: motorcycleStats.available || 0,
        rented: totalActiveContracts,
        // 사용중 = 진행중 계약서 개수
        maintenance: (motorcycleStats.maintenance || 0) + (motorcycleStats.scrapped || 0) // 수리중/폐지 합계
      },
      customers: customerCount?.count || 0,
      contracts: {
        active: totalActiveContracts,
        // 개인계약 + 업체계약
        monthly_revenue: contractStats?.total_monthly_revenue || 0,
        total_deposits: contractStats?.total_deposits || 0,
        active_business: businessContractStats?.active_business_contracts || 0,
        active_temp: tempContractStats?.active_temp_contracts || 0,
        active_loans: loanStats?.active_loans || 0,
        total_loan_amount: loanStats?.total_loan_amount || 0
      }
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    return c.json({
      error: '통계 조회 실패'
    }, 500);
  }
});

// 계약서 목록 조회
app.get('/api/contracts', async c => {
  const {
    DB
  } = c.env;
  const residentNumber = c.req.query('resident_number');
  let query = `
    SELECT 
      c.*,
      m.plate_number, m.vehicle_name,
      cu.name as customer_name, cu.phone as customer_phone
    FROM contracts c
    JOIN motorcycles m ON c.motorcycle_id = m.id
    LEFT JOIN customers cu ON c.customer_id = cu.id
    WHERE c.deleted_at IS NULL
  `;
  const params = [];

  // 주민등록번호로 필터링 (고객 포털용)
  if (residentNumber) {
    query += ` AND cu.resident_number = ?`;
    params.push(residentNumber);
  }
  query += ` ORDER BY c.created_at DESC`;
  const stmt = DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// 오토바이별 계약 이력 조회
app.get('/api/motorcycles/:id/contracts', async c => {
  const {
    DB
  } = c.env;
  const motorcycleId = c.req.param('id');
  const result = await DB.prepare(`
    SELECT 
      c.*,
      cu.name as customer_name, cu.resident_number, cu.phone as customer_phone,
      cu.address as customer_address, cu.license_type
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    WHERE c.motorcycle_id = ?
    ORDER BY c.created_at DESC
  `).bind(motorcycleId).all();
  return c.json(result.results);
});

// 계약서 상세 조회
// 계약서 상세 조회 (인증 필요 - 민감한 계약 정보)
app.get('/api/contracts/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const result = await DB.prepare(`
    SELECT 
      c.*,
      m.vehicle_name, m.plate_number, m.chassis_number, m.model_year, 
      m.mileage, m.insurance_company, m.insurance_start_date, m.insurance_end_date,
      m.driving_range as motorcycle_driving_range,
      m.owner_name, m.insurance_fee, m.vehicle_price, m.daily_rental_fee,
      cu.name as customer_name, cu.resident_number, cu.phone as customer_phone,
      cu.address as customer_address, cu.license_type
    FROM contracts c
    JOIN motorcycles m ON c.motorcycle_id = m.id
    JOIN customers cu ON c.customer_id = cu.id
    WHERE c.id = ?
  `).bind(id).first();
  if (!result) {
    return c.json({
      error: '계약서를 찾을 수 없습니다'
    }, 404);
  }
  return c.json(result);
});

// 계약서 완료 처리
// 계약 완료 처리 (인증 필요)
app.put('/api/contracts/:id/complete', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');

  // 계약서 조회
  const contract = await DB.prepare(`
    SELECT motorcycle_id, status FROM contracts WHERE id = ?
  `).bind(id).first();
  if (!contract) {
    return c.json({
      error: '계약서를 찾을 수 없습니다'
    }, 404);
  }
  if (contract.status === 'completed') {
    return c.json({
      error: '이미 완료된 계약서입니다'
    }, 400);
  }

  // 계약서 상태를 완료로 변경
  await DB.prepare(`
    UPDATE contracts 
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(id).run();

  // 오토바이 상태를 '휴차중'으로 변경
  await DB.prepare(`
    UPDATE motorcycles 
    SET status = 'available', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(contract.motorcycle_id).run();
  return c.json({
    message: '계약이 완료 처리되었습니다'
  });
});

// 계약서 생성 (인증 필요)
// 계약서 생성 (공개 API - 고객 포털용)
app.post('/api/contracts', async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();

  // 고객 정보가 전달된 경우 업데이트 (우편번호/상세주소 보존)
  if (data.customer_id && data.customer_name) {
    console.log('📝 Updating customer info:', {
      id: data.customer_id,
      name: data.customer_name,
      postcode: data.postcode,
      address: data.address,
      detail_address: data.detail_address
    });
    await DB.prepare(`
      UPDATE customers SET 
        name = ?, 
        phone = ?,
        resident_number = ?, 
        postcode = ?,
        address = ?, 
        detail_address = ?,
        license_type = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(data.customer_name, data.customer_phone || '', data.resident_number || '', data.postcode || '', data.address || '', data.detail_address || '', data.license_type || '2종소형', data.customer_id).run();
    console.log('✅ Customer info updated successfully');
  }

  // 계약서 번호 생성 (YYYYMMDD-XXXX 형식)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countResult = await DB.prepare(`SELECT COUNT(*) as count FROM contracts WHERE contract_number LIKE ?`).bind(`${today}-%`).first();
  const count = countResult.count + 1;
  const contractNumber = `${today}-${String(count).padStart(4, '0')}`;

  // 같은 고객(customer_id)의 기존 개인 계약 자동 해지
  // 조건: 개인 계약(리스/렌트)만 해지, 임시렌트는 제외
  if (data.customer_id && data.contract_type !== 'temp_rent') {
    console.log('🔄 Checking for existing active contracts for customer:', data.customer_id);
    const existingCustomerContracts = await DB.prepare(`
      SELECT id, contract_number, contract_type, motorcycle_id FROM contracts 
      WHERE customer_id = ? AND status = 'active' AND contract_type != 'temp_rent'
    `).bind(data.customer_id).all();
    if (existingCustomerContracts.results.length > 0) {
      console.log(`📋 Found ${existingCustomerContracts.results.length} active personal contract(s) for this customer, cancelling them...`);
      for (const contract of existingCustomerContracts.results) {
        const contractData = contract;
        await DB.prepare(`
          UPDATE contracts 
          SET status = 'cancelled', 
              end_date = ?, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(today, contractData.id).run();

        // 기존 계약의 오토바이를 available로 변경
        await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?').bind('available', contractData.motorcycle_id).run();

        // 이력 기록
        await recordContractHistory(DB, contractData.id, contractData.motorcycle_id, data.customer_id, contractData.contract_number, contractData.contract_type, 'replaced', 'active', 'cancelled', '',
        // start_date는 알 수 없음
        today, 0,
        // monthly_fee
        0,
        // deposit
        '', `새 계약(${contractNumber})으로 인한 자동 해지 (같은 고객의 새 계약)`);
        console.log(`✅ Cancelled personal contract: ${contractData.contract_number} (type: ${contractData.contract_type})`);
      }
    }
  }

  // 같은 오토바이의 기존 활성 계약을 완료 처리
  console.log('🔄 Checking for existing active contracts for motorcycle:', data.motorcycle_id);

  // 1. 개인 계약 완료 처리 (덮어쓰기)
  const existingContracts = await DB.prepare(`
    SELECT * FROM contracts 
    WHERE motorcycle_id = ? AND status = 'active'
  `).bind(data.motorcycle_id).all();
  if (existingContracts.results.length > 0) {
    console.log(`📋 Found ${existingContracts.results.length} active personal contract(s), replacing them...`);
    for (const contract of existingContracts.results) {
      const oldContract = contract;

      // 기존 계약을 'cancelled' 상태로 변경하고 종료일을 오늘로 설정
      await DB.prepare(`
        UPDATE contracts 
        SET status = 'cancelled', end_date = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(today, oldContract.id).run();

      // 이력 기록: 새 계약에 의해 대체됨
      await recordContractHistory(DB, oldContract.id, oldContract.motorcycle_id, oldContract.customer_id, oldContract.contract_number, oldContract.contract_type, 'replaced', 'active', 'cancelled', oldContract.start_date, today, oldContract.monthly_fee, oldContract.deposit, oldContract.special_terms, `새 계약(${contractNumber})으로 인한 자동 해지`);
      console.log(`✅ Replaced personal contract: ${oldContract.contract_number}`);
    }
  }

  // 2. 업체 계약 완료 처리 (덮어쓰기)
  const existingBusinessContracts = await DB.prepare(`
    SELECT * FROM business_contracts 
    WHERE motorcycle_id = ? AND status = 'active'
  `).bind(data.motorcycle_id).all();
  if (existingBusinessContracts.results.length > 0) {
    console.log(`📋 Found ${existingBusinessContracts.results.length} active business contract(s), replacing them...`);
    for (const contract of existingBusinessContracts.results) {
      const oldContract = contract;
      await DB.prepare(`
        UPDATE business_contracts 
        SET status = 'cancelled', end_date = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(today, oldContract.id).run();
      console.log(`✅ Replaced business contract: ${oldContract.contract_number}`);
    }
  }
  const kstNow = getKSTDateTime();
  const result = await DB.prepare(`
    INSERT INTO contracts (
      contract_type, motorcycle_id, customer_id, start_date, end_date,
      monthly_fee, deposit, special_terms, signature_data, id_card_photo, contract_number, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(data.contract_type, data.motorcycle_id, data.customer_id, data.start_date, data.end_date, data.monthly_fee, data.deposit || 0, data.special_terms || '', data.signature_data || '', data.id_card_photo || '', contractNumber, 'active', kstNow, kstNow).run();
  const newContractId = result.meta.last_row_id;

  // 새 계약 이력 기록
  await recordContractHistory(DB, Number(newContractId), data.motorcycle_id, data.customer_id, contractNumber, data.contract_type, 'created', null, 'active', data.start_date, data.end_date, data.monthly_fee, data.deposit || 0, data.special_terms || '', '새 계약 생성');

  // 오토바이 상태 업데이트
  await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?').bind('rented', data.motorcycle_id).run();
  return c.json({
    id: result.meta.last_row_id,
    contract_number: contractNumber,
    ...data
  }, 201);
});

// 관리자 계약서 저장 (인증 필요, 고객에게 전송하지 않음)
// 공개 API: 고객 계약서 작성 저장 (인증 불필요)
app.post('/api/public/contracts', async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();
  console.log('📝 [Public] Received contract data from customer');
  try {
    // 1. 고객 정보 저장 또는 찾기
    let customerId;
    const existingCustomer = await DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(data.customer_phone).first();
    if (existingCustomer) {
      customerId = existingCustomer.id;
      // 고객 정보 업데이트 (전화번호 포함)
      await DB.prepare(`
        UPDATE customers 
        SET name = ?, phone = ?, resident_number = ?, postcode = ?, address = ?, detail_address = ?, license_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(data.customer_name, data.customer_phone || '', data.resident_number || '', data.postcode || '', data.address || '', data.detail_address || '', data.license_type || '2종소형', customerId).run();
    } else {
      // 신규 고객 등록
      const customerResult = await DB.prepare(`
        INSERT INTO customers (name, phone, resident_number, address, detail_address, postcode, license_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(data.customer_name, data.customer_phone, data.resident_number || '', data.address || '', data.detail_address || '', data.postcode || '', data.license_type || '2종소형').run();
      customerId = customerResult.meta.last_row_id;
    }

    // 2. 계약서 번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await DB.prepare(`SELECT COUNT(*) as count FROM contracts WHERE contract_number LIKE ?`).bind(`${today}-%`).first();
    const count = countResult.count + 1;
    const contractNumber = `${today}-${String(count).padStart(4, '0')}`;

    // 3. 같은 오토바이의 기존 활성 계약을 완료 처리
    const existingContracts = await DB.prepare(`
      SELECT id, contract_number FROM contracts 
      WHERE motorcycle_id = ? AND status = 'active'
    `).bind(data.motorcycle_id).all();
    if (existingContracts.results.length > 0) {
      console.log(`📋 [Public] Found ${existingContracts.results.length} active contract(s), completing them...`);
      for (const contract of existingContracts.results) {
        await DB.prepare(`
          UPDATE contracts 
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(contract.id).run();
      }
    }

    // 4. 계약서 저장 (한국 시간으로 저장)
    const kstNow = getKSTDateTime();
    const result = await DB.prepare(`
      INSERT INTO contracts (
        contract_type, motorcycle_id, customer_id, start_date, end_date,
        monthly_fee, deposit, special_terms, signature_data, id_card_photo, 
        contract_number, status, insurance_age_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(data.contract_type, data.motorcycle_id, customerId, data.start_date, data.end_date, data.monthly_fee, data.deposit || 0, data.special_terms || '', data.admin_signature || '', data.admin_id_card_photo || '', contractNumber, 'active',
    // 고객이 작성한 계약서는 즉시 활성화
    data.insurance_age_limit || '전연령', kstNow, kstNow).run();

    // 5. 오토바이 상태 업데이트
    await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?').bind('rented', data.motorcycle_id).run();
    console.log(`✅ [Public] Contract saved: ${contractNumber}`);
    return c.json({
      id: result.meta.last_row_id,
      contract_number: contractNumber,
      customer_id: customerId,
      success: true
    }, 201);
  } catch (error) {
    console.error('계약서 저장 오류:', error);
    return c.json({
      error: '계약서 저장에 실패했습니다',
      details: error.message
    }, 500);
  }
});
app.post('/api/contracts-admin-save', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();

  // 디버그: 받은 데이터 로그
  console.log('📝 Received contract data:', JSON.stringify(data, null, 2));
  try {
    // 1. 고객 정보 저장 또는 찾기
    let customerId;
    const existingCustomer = await DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(data.customer_phone).first();
    if (existingCustomer) {
      customerId = existingCustomer.id;
      // 고객 정보 업데이트 (우편번호, 상세주소 포함)
      await DB.prepare(`
        UPDATE customers SET 
          name = ?, 
          phone = ?,
          resident_number = ?, 
          postcode = ?,
          address = ?, 
          detail_address = ?,
          license_type = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(data.customer_name, data.customer_phone || '', data.resident_number || '', data.postcode || '', data.address || '', data.detail_address || '', data.license_type || '2종소형', customerId).run();
      console.log(`✅ [Admin] Customer updated (ID: ${customerId}):`, {
        name: data.customer_name,
        phone: data.customer_phone,
        postcode: data.postcode,
        address: data.address,
        detail_address: data.detail_address
      });
    } else {
      // 신규 고객 등록 (우편번호, 상세주소 포함)
      const customerResult = await DB.prepare(`
        INSERT INTO customers (name, phone, resident_number, postcode, address, detail_address, license_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(data.customer_name, data.customer_phone || '', data.resident_number || '', data.postcode || '', data.address || '', data.detail_address || '', data.license_type || '2종소형').run();
      customerId = customerResult.meta.last_row_id;
      console.log(`✅ [Admin] New customer created (ID: ${customerId}):`, {
        name: data.customer_name,
        phone: data.customer_phone,
        postcode: data.postcode,
        address: data.address,
        detail_address: data.detail_address
      });
    }

    // 2. 계약서 번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await DB.prepare(`SELECT COUNT(*) as count FROM contracts WHERE contract_number LIKE ?`).bind(`${today}-%`).first();
    const count = countResult.count + 1;
    const contractNumber = `${today}-${String(count).padStart(4, '0')}`;

    // 2.3. 같은 고객(customer_id)의 기존 개인 계약 자동 해지
    // 조건: 개인 계약(리스/렌트)만 해지, 임시렌트와 업체 계약은 제외
    if (data.contract_type !== 'temp_rent') {
      console.log('🔄 [Admin] Checking for existing active contracts for customer:', customerId);
      const existingCustomerContracts = await DB.prepare(`
        SELECT id, contract_number, contract_type, motorcycle_id FROM contracts 
        WHERE customer_id = ? AND status = 'active' AND contract_type != 'temp_rent'
      `).bind(customerId).all();
      if (existingCustomerContracts.results.length > 0) {
        console.log(`📋 [Admin] Found ${existingCustomerContracts.results.length} active personal contract(s) for this customer, cancelling them...`);
        for (const contract of existingCustomerContracts.results) {
          const contractData = contract;
          await DB.prepare(`
            UPDATE contracts 
            SET status = 'cancelled', 
                end_date = date('now'), 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).bind(contractData.id).run();

          // 기존 계약의 오토바이를 available로 변경
          await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?').bind('available', contractData.motorcycle_id).run();
          console.log(`✅ [Admin] Cancelled personal contract: ${contractData.contract_number} (type: ${contractData.contract_type})`);
        }
      }
    }

    // 2.5. 같은 오토바이의 기존 활성 계약을 완료 처리
    console.log('🔄 [Admin] Checking for existing active contracts for motorcycle:', data.motorcycle_id);

    // 1. 개인 계약 완료 처리
    const existingContracts = await DB.prepare(`
      SELECT id, contract_number, status FROM contracts 
      WHERE motorcycle_id = ? AND status = 'active'
    `).bind(data.motorcycle_id).all();
    if (existingContracts.results.length > 0) {
      console.log(`📋 [Admin] Found ${existingContracts.results.length} active personal contract(s), completing them...`);
      for (const contract of existingContracts.results) {
        await DB.prepare(`
          UPDATE contracts 
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(contract.id).run();
        console.log(`✅ [Admin] Completed personal contract: ${contract.contract_number}`);
      }
    }

    // 2. 업체 계약 완료 처리
    const existingBusinessContracts = await DB.prepare(`
      SELECT id, contract_number, status FROM business_contracts 
      WHERE motorcycle_id = ? AND status = 'active'
    `).bind(data.motorcycle_id).all();
    if (existingBusinessContracts.results.length > 0) {
      console.log(`📋 [Admin] Found ${existingBusinessContracts.results.length} active business contract(s), completing them...`);
      for (const contract of existingBusinessContracts.results) {
        await DB.prepare(`
          UPDATE business_contracts 
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(contract.id).run();
        console.log(`✅ [Admin] Completed business contract: ${contract.contract_number}`);
      }
    }

    // 3. 계약서 저장 (한국 시간으로 저장)
    const kstNow = getKSTDateTime();
    const result = await DB.prepare(`
      INSERT INTO contracts (
        contract_type, motorcycle_id, customer_id, start_date, end_date,
        monthly_fee, deposit, special_terms, signature_data, id_card_photo, 
        contract_number, status, insurance_age_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(data.contract_type, data.motorcycle_id, customerId, data.start_date, data.end_date, data.monthly_fee, data.deposit || 0, data.special_terms || '', data.admin_signature || '', data.admin_id_card_photo || '', contractNumber, data.status || 'pending', data.insurance_age_limit || '전연령', kstNow, kstNow).run();

    // 4. 오토바이 상태 업데이트
    if (data.status === 'active') {
      await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?').bind('rented', data.motorcycle_id).run();
    }
    return c.json({
      id: result.meta.last_row_id,
      contract_number: contractNumber,
      customer_id: customerId,
      success: true
    }, 201);
  } catch (error) {
    console.error('계약서 저장 오류:', error);
    return c.json({
      error: '계약서 저장에 실패했습니다',
      details: error.message
    }, 500);
  }
});

// 계약서 상태 변경 (인증 필요)
app.patch('/api/contracts/:id/status', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const {
    status
  } = await c.req.json();

  // 계약서 정보 조회
  const contract = await DB.prepare('SELECT * FROM contracts WHERE id = ?').bind(id).first();
  if (!contract) {
    return c.json({
      error: '계약서를 찾을 수 없습니다'
    }, 404);
  }
  const oldContract = contract;
  const oldStatus = oldContract.status;

  // 계약서 상태 업데이트 (기록은 보존)
  // 해지/완료 시 종료일을 오늘 날짜로 자동 설정
  const today = new Date().toISOString().split('T')[0];
  let endDate = oldContract.end_date;
  if (status === 'completed' || status === 'cancelled') {
    endDate = today;
    await DB.prepare('UPDATE contracts SET status = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, today, id).run();
    console.log(`📅 Contract #${id} ${status} - end_date set to ${today}`);

    // 이력 기록: 계약 해지/완료
    await recordContractHistory(DB, Number(id), oldContract.motorcycle_id, oldContract.customer_id, oldContract.contract_number, oldContract.contract_type, status, oldStatus, status, oldContract.start_date, endDate, oldContract.monthly_fee, oldContract.deposit, oldContract.special_terms, status === 'cancelled' ? '수동 해지' : '계약 완료');
  } else {
    await DB.prepare('UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, id).run();

    // 이력 기록: 상태 변경
    await recordContractHistory(DB, Number(id), oldContract.motorcycle_id, oldContract.customer_id, oldContract.contract_number, oldContract.contract_type, 'updated', oldStatus, status, oldContract.start_date, endDate, oldContract.monthly_fee, oldContract.deposit, oldContract.special_terms, `상태 변경: ${oldStatus} → ${status}`);
  }

  // 계약 해지/완료시 처리
  if (status === 'completed' || status === 'cancelled') {
    const motorcycleId = oldContract.motorcycle_id;

    // 1. 오토바이 상태를 '휴차중(available)'으로 변경
    await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?').bind('available', motorcycleId).run();

    // 2. 오토바이의 계약 정보만 초기화 (기본정보와 보험정보는 유지)
    await DB.prepare(`
      UPDATE motorcycles 
      SET monthly_fee = NULL,
          contract_type_text = NULL,
          deposit = NULL,
          contract_start_date = NULL,
          contract_end_date = NULL,
          owner_name = '',
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(motorcycleId).run();
    console.log(`✅ Contract ${status} - Motorcycle #${motorcycleId} reset to available with contract info cleared (basic and insurance info preserved)`);
  }
  return c.json({
    message: '상태가 변경되었습니다',
    status: status,
    contractId: id
  });
});

// ==========================================
// 진행 중인 계약서 보험 정보 업데이트 API
// ==========================================
// 주의: active 상태의 계약서만 보험 정보를 업데이트할 수 있습니다.
// completed 또는 cancelled 상태는 업데이트되지 않습니다.
// ==========================================
// 계약 보험 정보 수정 (인증 필요)
app.put('/api/contracts/:id/insurance', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const data = await c.req.json();
  try {
    // 계약서 조회 (active 상태만)
    const contract = await DB.prepare('SELECT * FROM contracts WHERE id = ? AND status = ? AND deleted_at IS NULL').bind(id, 'active').first();
    if (!contract) {
      console.log('⚠️  계약서가 없거나 active 상태가 아닙니다:', id);
      return c.json({
        error: '진행 중인 계약서만 보험 정보를 업데이트할 수 있습니다'
      }, 400);
    }

    // 보험 정보 업데이트
    await DB.prepare(`
      UPDATE contracts 
      SET insurance_company = ?,
          driving_range = ?,
          insurance_start_date = ?,
          insurance_end_date = ?,
          insurance_age_limit = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(data.insurance_company, data.driving_range, data.insurance_start_date, data.insurance_end_date, data.insurance_age_limit || data.driving_range, id).run();
    console.log('✅ [진행중 계약서] 보험 정보 업데이트 완료:', {
      contract_id: id,
      contract_number: contract.contract_number,
      insurance_company: data.insurance_company,
      driving_range: data.driving_range
    });
    return c.json({
      message: '보험 정보가 업데이트되었습니다',
      contract_id: id
    });
  } catch (error) {
    console.error('[진행중 계약서] 보험 정보 업데이트 실패:', error);
    return c.json({
      error: '보험 정보 업데이트에 실패했습니다',
      details: error.message
    }, 500);
  }
});

// 계약서 삭제 (소프트 삭제) (인증 필요)
app.delete('/api/contracts/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  try {
    // 계약서 존재 확인
    const contract = await DB.prepare('SELECT * FROM contracts WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!contract) {
      return c.json({
        error: '계약서를 찾을 수 없습니다'
      }, 404);
    }

    // 소프트 삭제 (deleted_at에 현재 시간 설정)
    await DB.prepare('UPDATE contracts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run();
    return c.json({
      message: '계약서가 삭제되었습니다. 사용 이력에서는 계속 조회할 수 있습니다.'
    });
  } catch (error) {
    console.error('계약서 삭제 오류:', error);
    return c.json({
      error: '계약서 삭제에 실패했습니다',
      details: error.message
    }, 500);
  }
});

// 계약 이력 조회 (특정 계약의 모든 이력)
// 계약 이력 조회 (인증 필요)
app.get('/api/contracts/:id/history', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  try {
    const history = await DB.prepare(`
      SELECT 
        ch.*,
        cu.name as customer_name,
        cu.phone as customer_phone,
        m.plate_number,
        m.vehicle_name
      FROM contract_history ch
      LEFT JOIN customers cu ON ch.customer_id = cu.id
      LEFT JOIN motorcycles m ON ch.motorcycle_id = m.id
      WHERE ch.contract_id = ?
      ORDER BY ch.created_at DESC
    `).bind(id).all();
    return c.json(history.results);
  } catch (error) {
    console.error('계약 이력 조회 오류:', error);
    return c.json({
      error: '계약 이력 조회에 실패했습니다',
      details: error.message
    }, 500);
  }
});

// 오토바이 계약 이력 조회 (특정 오토바이의 모든 계약 이력)
// 오토바이 사용 이력 조회 (인증 필요 - 민감한 고객 정보 포함)
app.get('/api/motorcycles/:id/history', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  try {
    const history = await DB.prepare(`
      SELECT 
        ch.*,
        cu.name as customer_name,
        cu.phone as customer_phone
      FROM contract_history ch
      LEFT JOIN customers cu ON ch.customer_id = cu.id
      WHERE ch.motorcycle_id = ?
      ORDER BY ch.created_at DESC
    `).bind(id).all();
    return c.json(history.results);
  } catch (error) {
    console.error('오토바이 이력 조회 오류:', error);
    return c.json({
      error: '오토바이 이력 조회에 실패했습니다',
      details: error.message
    }, 500);
  }
});

// 오토바이 사용 이력 조회 (번호판 또는 차대번호로 검색)
// 오토바이 이력 검색 (인증 필요 - 민감한 고객 정보 포함)
app.get('/api/motorcycles/history/search', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const searchTerm = c.req.query('q') || '';
  if (!searchTerm) {
    return c.json({
      error: '검색어를 입력해주세요'
    }, 400);
  }
  try {
    // 오토바이 정보 조회 (번호판 또는 차대번호로 검색)
    const motorcycle = await DB.prepare(`
      SELECT * FROM motorcycles 
      WHERE plate_number LIKE ? OR chassis_number LIKE ?
      LIMIT 1
    `).bind(`%${searchTerm}%`, `%${searchTerm}%`).first();
    if (!motorcycle) {
      return c.json({
        error: '해당 오토바이를 찾을 수 없습니다'
      }, 404);
    }

    // 모든 계약 이력 조회 (삭제된 것 포함)
    const contracts = await DB.prepare(`
      SELECT 
        c.id,
        c.contract_number,
        c.contract_type,
        c.start_date,
        c.end_date,
        c.monthly_fee,
        c.deposit,
        c.special_terms,
        c.status,
        c.created_at,
        c.deleted_at,
        cu.name as customer_name,
        cu.phone as customer_phone,
        cu.resident_number
      FROM contracts c
      JOIN customers cu ON c.customer_id = cu.id
      WHERE c.motorcycle_id = ?
      ORDER BY c.created_at DESC
    `).bind(motorcycle.id).all();
    return c.json({
      motorcycle: motorcycle,
      history: contracts.results
    });
  } catch (error) {
    console.error('사용 이력 조회 오류:', error);
    return c.json({
      error: '사용 이력 조회에 실패했습니다',
      details: error.message
    }, 500);
  }
});

// ============================================
// 사업자 정보 API
// ============================================

// 사업자 정보 조회
// 회사 설정 조회 (인증 필요)
app.get('/api/company-settings', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const result = await DB.prepare('SELECT * FROM company_settings ORDER BY id DESC LIMIT 1').first();
  if (!result) {
    return c.json({
      company_name: '배달대행 회사',
      business_number: '000-00-00000',
      representative_name: '대표자명'
    });
  }
  return c.json(result);
});

// 사업자 정보 수정
// 회사 설정 수정 (인증 필요)
app.put('/api/company-settings', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();

  // 기존 데이터 확인
  const existing = await DB.prepare('SELECT * FROM company_settings ORDER BY id DESC LIMIT 1').first();
  if (existing) {
    // 업데이트
    await DB.prepare(`
      UPDATE company_settings 
      SET company_name = ?, business_number = ?, representative_name = ?,
          phone = ?, manager_phone = ?, manager_phone2 = ?, address = ?, bank_name = ?, account_number = ?, account_holder = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(data.company_name, data.business_number, data.representative_name, data.phone || '', data.manager_phone || '', data.manager_phone2 || '', data.address || '', data.bank_name || '', data.account_number || '', data.account_holder || '', existing.id).run();
  } else {
    // 신규 삽입
    await DB.prepare(`
      INSERT INTO company_settings (company_name, business_number, representative_name, phone, manager_phone, manager_phone2, address, bank_name, account_number, account_holder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(data.company_name, data.business_number, data.representative_name, data.phone || '', data.manager_phone || '', data.manager_phone2 || '', data.address || '', data.bank_name || '', data.account_number || '', data.account_holder || '').run();
  }
  return c.json({
    message: '사업자 정보가 저장되었습니다'
  });
});

// ============================================
// 업체 계약서 API
// ============================================

// 업체 계약서 생성
// 업체 계약 생성 (인증 필요)
app.post('/api/business-contracts', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();

  // 오토바이 정보 조회 (driving_range를 가져오기 위함)
  const motorcycle = await DB.prepare(`SELECT driving_range FROM motorcycles WHERE id = ?`).bind(data.motorcycle_id).first();
  if (!motorcycle) {
    return c.json({
      error: '오토바이를 찾을 수 없습니다'
    }, 404);
  }

  // 계약서 번호 생성 (B-YYYYMMDD-XXXX 형식)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countResult = await DB.prepare(`SELECT COUNT(*) as count FROM business_contracts WHERE contract_number LIKE ?`).bind(`B-${today}-%`).first();
  const count = countResult.count + 1;
  const contractNumber = `B-${today}-${String(count).padStart(4, '0')}`;

  // 같은 오토바이의 기존 활성 계약을 완료 처리
  console.log('🔄 [Business] Checking for existing active contracts for motorcycle:', data.motorcycle_id);

  // 1. 개인 계약 완료 처리
  const existingContracts = await DB.prepare(`
    SELECT id, contract_number, status FROM contracts 
    WHERE motorcycle_id = ? AND status = 'active'
  `).bind(data.motorcycle_id).all();
  if (existingContracts.results.length > 0) {
    console.log(`📋 [Business] Found ${existingContracts.results.length} active personal contract(s), completing them...`);
    for (const contract of existingContracts.results) {
      await DB.prepare(`
        UPDATE contracts 
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(contract.id).run();
      console.log(`✅ [Business] Completed personal contract: ${contract.contract_number}`);
    }
  }

  // 2. 업체 계약 완료 처리
  const existingBusinessContracts = await DB.prepare(`
    SELECT id, contract_number, status FROM business_contracts 
    WHERE motorcycle_id = ? AND status = 'active'
  `).bind(data.motorcycle_id).all();
  if (existingBusinessContracts.results.length > 0) {
    console.log(`📋 [Business] Found ${existingBusinessContracts.results.length} active business contract(s), completing them...`);
    for (const contract of existingBusinessContracts.results) {
      await DB.prepare(`
        UPDATE business_contracts 
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(contract.id).run();
      console.log(`✅ [Business] Completed business contract: ${contract.contract_number}`);
    }
  }
  const result = await DB.prepare(`
    INSERT INTO business_contracts (
      motorcycle_id, contract_number,
      company_name, business_number, representative, business_type, business_category,
      business_phone, business_address,
      representative_resident_number, representative_phone, representative_address,
      contract_start_date, contract_end_date, insurance_start_date, insurance_end_date,
      license_type, driving_range, daily_amount, deposit, special_terms,
      signature_data, id_card_photo, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(data.motorcycle_id, contractNumber, data.company_name, data.business_number, data.representative, data.business_contract_type || 'rent',
  // 리스/렌트 타입 (기본값: rent)
  '배달대행',
  // business_category 기본값
  data.business_phone, data.business_address, data.representative_resident_number, data.representative_phone, data.representative_address, data.contract_start_date, data.contract_end_date, data.insurance_start_date, data.insurance_end_date, data.license_type || '2종 소형',
  // license_type 기본값 추가
  motorcycle.driving_range || '',
  // 오토바이 테이블에서 가져온 값 사용
  data.daily_amount, data.deposit || 0, data.special_terms || '', data.signature_data || '', data.id_card_photo || '', 'active').run();

  // 오토바이 상태를 'rented'로 변경
  await DB.prepare(`UPDATE motorcycles SET status = 'rented' WHERE id = ?`).bind(data.motorcycle_id).run();
  return c.json({
    id: result.meta.last_row_id,
    contract_number: contractNumber
  }, 201);
});

// 업체 계약서 목록 조회
app.get('/api/business-contracts', async c => {
  const {
    DB
  } = c.env;
  const residentNumber = c.req.query('resident_number');
  let query = `
    SELECT 
      bc.*,
      m.plate_number, m.vehicle_name, m.chassis_number
    FROM business_contracts bc
    JOIN motorcycles m ON bc.motorcycle_id = m.id
    WHERE 1=1
  `;
  const params = [];

  // 주민등록번호로 필터링 (고객 포털용 - 대표자 주민번호)
  if (residentNumber) {
    query += ` AND bc.representative_resident_number = ?`;
    params.push(residentNumber);
  }
  query += ` ORDER BY bc.created_at DESC`;
  const stmt = DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// 업체 계약서 상세 조회
// 업체 계약서 상세 조회 (인증 필요)
app.get('/api/business-contracts/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const result = await DB.prepare(`
    SELECT 
      bc.*,
      m.plate_number, m.vehicle_name, m.chassis_number, m.model_year, m.mileage,
      co.terms_agreed
    FROM business_contracts bc
    JOIN motorcycles m ON bc.motorcycle_id = m.id
    LEFT JOIN companies co ON bc.business_number = co.business_number
    WHERE bc.id = ?
  `).bind(id).first();
  if (!result) {
    return c.json({
      error: '업체 계약서를 찾을 수 없습니다'
    }, 404);
  }
  return c.json(result);
});

// 업체 계약서 완료 처리
// 업체 계약 완료 처리 (인증 필요)
app.put('/api/business-contracts/:id/complete', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');

  // 계약서 조회
  const contract = await DB.prepare(`
    SELECT motorcycle_id, status FROM business_contracts WHERE id = ?
  `).bind(id).first();
  if (!contract) {
    return c.json({
      error: '계약서를 찾을 수 없습니다'
    }, 404);
  }
  if (contract.status === 'completed') {
    return c.json({
      error: '이미 완료된 계약서입니다'
    }, 400);
  }

  // 계약서 상태를 완료로 변경
  await DB.prepare(`
    UPDATE business_contracts 
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(id).run();

  // 오토바이 상태를 '휴차중'으로 변경
  await DB.prepare(`
    UPDATE motorcycles 
    SET status = 'available', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(contract.motorcycle_id).run();
  return c.json({
    message: '계약이 완료 처리되었습니다'
  });
});

// 업체 계약서 삭제
// 업체 계약 삭제 (인증 필요)
app.delete('/api/business-contracts/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');

  // 계약서 조회
  const contract = await DB.prepare(`
    SELECT motorcycle_id FROM business_contracts WHERE id = ?
  `).bind(id).first();
  if (!contract) {
    return c.json({
      error: '계약서를 찾을 수 없습니다'
    }, 404);
  }

  // 계약서 삭제
  await DB.prepare(`
    DELETE FROM business_contracts WHERE id = ?
  `).bind(id).run();

  // 오토바이 상태를 '휴차중'으로 변경
  await DB.prepare(`
    UPDATE motorcycles 
    SET status = 'available', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(contract.motorcycle_id).run();
  return c.json({
    message: '계약서가 삭제되었습니다'
  });
});

// ============================================
// 차용증 API
// ============================================

// 차용증 목록 조회
// 차용증 목록 조회 (인증 필요)
app.get('/api/loan-contracts', async c => {
  const {
    DB
  } = c.env;
  const residentNumber = c.req.query('resident_number');
  let query = `SELECT * FROM loan_contracts WHERE 1=1`;
  const params = [];

  // 주민등록번호로 필터링 (고객 포털용)
  if (residentNumber) {
    query += ` AND borrower_resident_number = ?`;
    params.push(residentNumber);
  }
  query += ` ORDER BY created_at DESC`;
  const stmt = DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// ============================================
// 관리자 API
// ============================================

// 관리자 로그인
app.post('/api/admin/login', async c => {
  const {
    DB
  } = c.env;
  const {
    username,
    password
  } = await c.req.json();

  // DB에서 사용자 조회
  const user = await DB.prepare(`
    SELECT * FROM admin_users WHERE username = ?
  `).bind(username).first();
  if (!user) {
    return c.json({
      error: '아이디 또는 비밀번호가 올바르지 않습니다'
    }, 401);
  }

  // 비밀번호 확인 (간단한 비교, 실제로는 bcrypt 사용 권장)
  if (user.password !== password) {
    return c.json({
      error: '아이디 또는 비밀번호가 올바르지 않습니다'
    }, 401);
  }

  // 마지막 로그인 시간 업데이트
  const now = new Date().toISOString();
  await DB.prepare(`
    UPDATE admin_users SET last_login = ? WHERE username = ?
  `).bind(now, username).run();
  return c.json({
    success: true,
    message: '로그인 성공',
    user: {
      username,
      name: user.name,
      email: user.email
    }
  });
});

// 관리자 회원가입
app.post('/api/auth/register', async c => {
  const {
    DB
  } = c.env;
  const {
    username,
    password,
    name,
    email,
    phone
  } = await c.req.json();

  // 유효성 검사
  if (!username || !password || !name) {
    return c.json({
      error: '필수 항목을 모두 입력해주세요'
    }, 400);
  }
  if (username.length < 4 || username.length > 20) {
    return c.json({
      error: '아이디는 4-20자여야 합니다'
    }, 400);
  }
  if (password.length < 4) {
    return c.json({
      error: '비밀번호는 최소 4자 이상이어야 합니다'
    }, 400);
  }

  // 아이디 중복 확인
  const existingUser = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existingUser) {
    return c.json({
      error: '이미 사용 중인 아이디입니다'
    }, 409);
  }

  // 일반 관리자로 생성 (super_admin은 sangchun11만)
  const result = await DB.prepare(`
    INSERT INTO users (username, password, name, email, phone, role)
    VALUES (?, ?, ?, ?, ?, 'admin')
  `).bind(username, password, name, email || '', phone || '').run();
  return c.json({
    success: true,
    message: '회원가입이 완료되었습니다',
    user: {
      id: result.meta.last_row_id,
      username,
      name
    }
  }, 201);
});

// ============================================
// 관리자 관리 API (슈퍼관리자 전용)
// ============================================

// 모든 관리자 목록 조회 (슈퍼관리자 전용)
app.get('/api/admins', async c => {
  const {
    DB
  } = c.env;
  const sessionId = c.req.header('X-Session-ID');
  const session = await validateSession(DB, sessionId);
  if (!session) {
    return c.json({
      error: '인증이 필요합니다'
    }, 401);
  }

  // 슈퍼관리자만 접근 가능
  if (session.role !== 'super_admin') {
    return c.json({
      error: '권한이 없습니다'
    }, 403);
  }

  // 모든 관리자 조회 (비밀번호 제외)
  const result = await DB.prepare(`
    SELECT 
      u.id, u.username, u.name, u.email, u.phone, u.role, u.status, u.created_at,
      s.session_id, s.created_at as last_login
    FROM users u
    LEFT JOIN sessions s ON u.id = s.user_id
    ORDER BY 
      CASE WHEN u.role = 'super_admin' THEN 0 ELSE 1 END,
      u.created_at DESC
  `).all();
  return c.json(result.results);
});

// 관리자 상태 변경 (정지/활성) - 슈퍼관리자 전용
app.put('/api/admins/:id/status', async c => {
  const {
    DB
  } = c.env;
  const sessionId = c.req.header('X-Session-ID');
  const adminId = c.req.param('id');
  const {
    status
  } = await c.req.json();
  const session = await validateSession(DB, sessionId);
  if (!session) {
    return c.json({
      error: '인증이 필요합니다'
    }, 401);
  }

  // 슈퍼관리자만 접근 가능
  if (session.role !== 'super_admin') {
    return c.json({
      error: '권한이 없습니다'
    }, 403);
  }

  // 자기 자신은 정지할 수 없음
  if (session.user_id === parseInt(adminId)) {
    return c.json({
      error: '자기 자신의 계정은 정지할 수 없습니다'
    }, 400);
  }

  // 다른 슈퍼관리자는 정지할 수 없음
  const targetUser = await DB.prepare('SELECT role FROM users WHERE id = ?').bind(adminId).first();
  if (targetUser?.role === 'super_admin') {
    return c.json({
      error: '슈퍼관리자 계정은 정지할 수 없습니다'
    }, 400);
  }

  // 상태 변경
  await DB.prepare(`
    UPDATE users SET status = ? WHERE id = ?
  `).bind(status, adminId).run();

  // 정지 시 해당 사용자의 모든 세션 삭제
  if (status === 'suspended') {
    await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(adminId).run();
  }
  return c.json({
    success: true,
    message: status === 'active' ? '계정이 활성화되었습니다' : '계정이 정지되었습니다'
  });
});

// ============================================
// 계약서 공유 API (카카오톡 전송용)
// ============================================

// 계약서 공유 링크 생성
// 계약 공유 링크 생성 (인증 필요)
app.post('/api/contract-share/create', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();

  // 고유 토큰 생성 (UUID 대신 간단한 랜덤 문자열)
  const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  // 만료 시간: 72시간 후
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  const result = await DB.prepare(`
    INSERT INTO contract_shares (
      share_token, contract_type, contract_data, 
      customer_name, customer_phone, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(shareToken, data.contract_type, JSON.stringify(data.contract_data), data.customer_name, data.customer_phone, expiresAt.toISOString()).run();

  // 공유 URL 생성
  const shareUrl = `/contract-sign?token=${shareToken}`;
  return c.json({
    success: true,
    share_token: shareToken,
    share_url: shareUrl,
    expires_at: expiresAt
  }, 201);
});

// 계약서 공유 정보 조회
app.get('/api/contract-share/:token', async c => {
  const {
    DB
  } = c.env;
  const token = c.req.param('token');
  const result = await DB.prepare(`
    SELECT * FROM contract_shares WHERE share_token = ?
  `).bind(token).first();
  if (!result) {
    return c.json({
      error: '계약서를 찾을 수 없습니다'
    }, 404);
  }

  // 만료 확인
  const now = new Date();
  const expiresAt = new Date(result.expires_at);
  if (now > expiresAt) {
    await DB.prepare(`
      UPDATE contract_shares SET status = 'expired' WHERE share_token = ?
    `).bind(token).run();
    return c.json({
      ...result,
      status: 'expired'
    });
  }
  return c.json(result);
});

// 계약서 서명 제출
app.post('/api/contract-share/:token/sign', async c => {
  const {
    DB
  } = c.env;
  const token = c.req.param('token');
  const {
    signature_data,
    id_card_photo
  } = await c.req.json();
  const now = new Date().toISOString();

  // 공유 계약서 조회
  const shareData = await DB.prepare(`
    SELECT * FROM contract_shares WHERE share_token = ? AND status = 'pending'
  `).bind(token).first();
  if (!shareData) {
    return c.json({
      error: '유효하지 않은 계약서입니다'
    }, 404);
  }

  // 계약 데이터 파싱
  const contractInfo = JSON.parse(shareData.contract_data);
  try {
    // 1. 고객 정보 저장 (이미 있으면 조회)
    let customerId = null;
    const existingCustomer = await DB.prepare(`
      SELECT id FROM customers WHERE phone = ?
    `).bind(shareData.customer_phone).first();
    if (existingCustomer) {
      customerId = existingCustomer.id;
      // 고객 정보 업데이트 (전화번호, 우편번호, 상세주소 포함)
      await DB.prepare(`
        UPDATE customers 
        SET name = ?, phone = ?, resident_number = ?, postcode = ?, address = ?, detail_address = ?, license_type = ?, updated_at = ?
        WHERE id = ?
      `).bind(shareData.customer_name, shareData.customer_phone || '', contractInfo.resident_number || '', contractInfo.postcode || '', contractInfo.address || '', contractInfo.detail_address || '', contractInfo.license_type || '', now, customerId).run();
    } else {
      // 신규 고객 생성 (우편번호, 상세주소 포함)
      const customerResult = await DB.prepare(`
        INSERT INTO customers (name, phone, resident_number, postcode, address, detail_address, license_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(shareData.customer_name, shareData.customer_phone, contractInfo.resident_number || '', contractInfo.postcode || '', contractInfo.address || '', contractInfo.detail_address || '', contractInfo.license_type || '').run();
      customerId = customerResult.meta.last_row_id;
    }

    // 2. 계약 타입에 따라 실제 계약서 생성
    if (shareData.contract_type === 'individual') {
      // 개인 계약서 생성
      // 계약번호 생성
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const countResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM contracts 
        WHERE contract_number LIKE ?
      `).bind(`${today}-%`).first();
      const sequence = String((countResult?.count || 0) + 1).padStart(4, '0');
      const contractNumber = `${today}-${sequence}`;
      const kstNow = getKSTDateTime();
      await DB.prepare(`
        INSERT INTO contracts (
          contract_number, contract_type, motorcycle_id, customer_id,
          start_date, end_date, monthly_fee, deposit, special_terms,
          signature_data, id_card_photo, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).bind(contractNumber, contractInfo.contract_type || 'lease', contractInfo.motorcycle_id, customerId, contractInfo.start_date, contractInfo.end_date, contractInfo.monthly_fee || 0, contractInfo.deposit || 0, contractInfo.special_terms || '', signature_data, id_card_photo, kstNow, kstNow).run();

      // 오토바이 상태 업데이트
      await DB.prepare(`
        UPDATE motorcycles SET status = 'rented' WHERE id = ?
      `).bind(contractInfo.motorcycle_id).run();
    } else if (shareData.contract_type === 'business') {
      // 업체 계약서 생성
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const countResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM business_contracts 
        WHERE contract_number LIKE ?
      `).bind(`B-${today}-%`).first();
      const sequence = String((countResult?.count || 0) + 1).padStart(4, '0');
      const contractNumber = `B-${today}-${sequence}`;
      await DB.prepare(`
        INSERT INTO business_contracts (
          contract_number, motorcycle_id,
          company_name, business_number, representative,
          business_type, business_category, business_phone, business_address,
          representative_resident_number, representative_phone, representative_address,
          contract_start_date, contract_end_date,
          insurance_start_date, insurance_end_date,
          driving_range, daily_amount, deposit, special_terms,
          business_license_photo, id_card_photo, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).bind(contractNumber, contractInfo.motorcycle_id, contractInfo.company_name || '', contractInfo.business_number || '', contractInfo.representative || '', contractInfo.business_type || '', contractInfo.business_category || '', contractInfo.business_phone || '', contractInfo.business_address || '', contractInfo.representative_resident_number || '', contractInfo.representative_phone || '', contractInfo.representative_address || '', contractInfo.contract_start_date, contractInfo.contract_end_date, contractInfo.insurance_start_date, contractInfo.insurance_end_date, contractInfo.driving_range || '', contractInfo.daily_amount || 0, contractInfo.deposit || 0, contractInfo.special_terms || '', contractInfo.business_license_photo || '', id_card_photo).run();

      // 오토바이 상태 업데이트
      await DB.prepare(`
        UPDATE motorcycles SET status = 'rented' WHERE id = ?
      `).bind(contractInfo.motorcycle_id).run();
    } else if (shareData.contract_type === 'loan') {
      // 차용증 생성
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const countResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM loan_contracts 
        WHERE loan_number LIKE ?
      `).bind(`L-${today}-%`).first();
      const sequence = String((countResult?.count || 0) + 1).padStart(4, '0');
      const loanNumber = `L-${today}-${sequence}`;
      await DB.prepare(`
        INSERT INTO loan_contracts (
          loan_number, motorcycle_id, borrower_name, borrower_resident_number,
          borrower_phone, borrower_address,
          loan_amount, daily_deduction, loan_date, loan_period,
          repayment_date, borrower_signature, borrower_id_card, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).bind(loanNumber, contractInfo.motorcycle_id, shareData.customer_name, contractInfo.borrower_resident_number || '', shareData.customer_phone, contractInfo.borrower_address || '', contractInfo.loan_amount || 0, contractInfo.daily_deduction || 0, contractInfo.loan_date, contractInfo.loan_period || 0, contractInfo.repayment_date || '', signature_data, id_card_photo).run();
    }

    // 3. 공유 계약서 상태 업데이트
    await DB.prepare(`
      UPDATE contract_shares 
      SET signature_data = ?, id_card_photo = ?, status = 'signed', signed_at = ?, updated_at = ?
      WHERE share_token = ?
    `).bind(signature_data, id_card_photo, now, now, token).run();
    return c.json({
      success: true,
      message: '서명이 완료되었습니다. 계약서가 자동으로 등록되었습니다.'
    });
  } catch (error) {
    console.error('Contract creation error:', error);
    return c.json({
      error: '계약서 생성 중 오류가 발생했습니다'
    }, 500);
  }
});

// 계약서 공유 목록 조회 (관리자용)
// 계약 공유 목록 조회 (인증 필요)
app.get('/api/contract-shares', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const result = await DB.prepare(`
    SELECT * FROM contract_shares ORDER BY created_at DESC
  `).all();
  return c.json(result.results);
});

// SMS 전송 API (계약서 공유 링크 전송)
// SMS 전송 (인증 필요)
app.post('/api/send-sms', authMiddleware, async c => {
  const {
    phone,
    share_url,
    customer_name,
    contract_type
  } = await c.req.json();
  const message = `[오토바이 계약서]\n\n${customer_name}님, 계약서를 검토하시고 서명해주세요.\n\n링크: ${share_url}\n\n* 72시간 이내 서명 부탁드립니다.`;

  // CoolSMS API 연동 예시 (환경변수에 API 키가 있을 때만 실제 전송)
  if (c.env.COOLSMS_API_KEY && c.env.COOLSMS_API_SECRET && c.env.COOLSMS_SENDER) {
    try {
      // CoolSMS API v4 사용
      const apiKey = c.env.COOLSMS_API_KEY;
      const apiSecret = c.env.COOLSMS_API_SECRET;
      const sender = c.env.COOLSMS_SENDER;

      // 인증 토큰 생성 (HMAC)
      const timestamp = Date.now().toString();
      const salt = Math.random().toString(36).substring(2, 15);

      // CoolSMS API 호출
      const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
        method: 'POST',
        headers: {
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            to: phone.replace(/-/g, ''),
            // 하이픈 제거
            from: sender.replace(/-/g, ''),
            text: message
          }
        })
      });
      const result = await response.json();
      if (response.ok) {
        console.log('SMS 전송 성공:', result);
        return c.json({
          success: true,
          message: 'SMS가 전송되었습니다',
          phone,
          messageLength: message.length
        });
      } else {
        console.error('SMS 전송 실패:', result);
        return c.json({
          success: false,
          message: 'SMS 전송에 실패했습니다',
          error: result
        }, 500);
      }
    } catch (error) {
      console.error('SMS API 오류:', error);
      return c.json({
        success: false,
        message: 'SMS API 호출 중 오류가 발생했습니다'
      }, 500);
    }
  }

  // API 키가 없으면 시뮬레이션 모드
  console.log('=== SMS 전송 시뮬레이션 ===');
  console.log('수신번호:', phone);
  console.log('메시지:', message);
  console.log('=========================');
  console.log('실제 SMS를 보내려면 CoolSMS API 키를 환경변수에 설정하세요.');
  console.log('환경변수: COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER');
  return c.json({
    success: true,
    message: 'SMS가 전송되었습니다 (시뮬레이션)',
    simulation: true,
    phone,
    messageLength: message.length,
    note: '실제 SMS를 보내려면 CoolSMS API 키를 설정하세요'
  });
});

// 차용증 상세 조회
// 차용증 상세 조회 (인증 필요)
app.get('/api/loan-contracts/:id', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const result = await DB.prepare('SELECT * FROM loan_contracts WHERE id = ?').bind(id).first();
  if (!result) {
    return c.json({
      error: '차용증을 찾을 수 없습니다'
    }, 404);
  }
  return c.json(result);
});

// 차용증 생성
// 차용증 생성 (인증 필요)
app.post('/api/loan-contracts', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();
  try {
    // 1. 고객 정보 저장 또는 업데이트
    let customerId;
    const existingCustomer = await DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(data.borrower_phone).first();
    if (existingCustomer) {
      customerId = existingCustomer.id;
      // 고객 정보 업데이트 (우편번호, 상세주소 포함)
      await DB.prepare(`
        UPDATE customers SET 
          name = ?, 
          phone = ?,
          resident_number = ?, 
          postcode = ?,
          address = ?, 
          detail_address = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(data.borrower_name, data.borrower_phone || '', data.borrower_resident_number || '', data.postcode || '', data.address || '', data.detail_address || '', customerId).run();
      console.log(`✅ [Admin Loan] Customer updated (ID: ${customerId}):`, {
        name: data.borrower_name,
        phone: data.borrower_phone,
        postcode: data.postcode,
        address: data.address,
        detail_address: data.detail_address
      });
    } else {
      // 신규 고객 등록 (우편번호, 상세주소 포함)
      const customerResult = await DB.prepare(`
        INSERT INTO customers (name, phone, resident_number, postcode, address, detail_address, license_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(data.borrower_name, data.borrower_phone || '', data.borrower_resident_number || '', data.postcode || '', data.address || '', data.detail_address || '', '2종소형').run();
      customerId = customerResult.meta.last_row_id;
      console.log(`✅ [Admin Loan] New customer created (ID: ${customerId}):`, {
        name: data.borrower_name,
        phone: data.borrower_phone,
        postcode: data.postcode,
        address: data.address,
        detail_address: data.detail_address
      });
    }

    // 2. 차용증 번호 생성 (LOAN-YYYYMMDD-XXXX 형식)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await DB.prepare(`SELECT COUNT(*) as count FROM loan_contracts WHERE loan_number LIKE ?`).bind(`LOAN-${today}-%`).first();
    const count = countResult.count + 1;
    const loanNumber = `LOAN-${today}-${String(count).padStart(4, '0')}`;

    // 남은 차용금은 처음에 차용금액과 동일
    const remainingAmount = data.loan_amount;

    // borrower_address는 전체 주소 (우편번호 + 주소 + 상세주소)
    const fullAddress = data.postcode && data.address ? `(${data.postcode}) ${data.address} ${data.detail_address || ''}`.trim() : data.borrower_address || data.address || '';
    const result = await DB.prepare(`
      INSERT INTO loan_contracts (
        loan_number, borrower_name, borrower_resident_number, borrower_phone, borrower_address,
        loan_amount, loan_date, loan_period, repayment_date, interest_rate, daily_deduction,
        remaining_amount, total_deducted,
        account_number, special_terms, borrower_signature, lender_signature, borrower_id_card_photo, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(loanNumber, data.borrower_name, data.borrower_resident_number, data.borrower_phone, fullAddress, data.loan_amount, data.loan_date, data.loan_period, data.repayment_date, data.interest_rate || 0, data.daily_deduction, remainingAmount, 0,
    // total_deducted
    data.account_number || '', data.special_terms || '', data.borrower_signature || '', data.lender_signature || '', data.borrower_id_card_photo || '', 'active').run();
    return c.json({
      id: result.meta.last_row_id,
      loan_number: loanNumber,
      customer_id: customerId,
      ...data
    }, 201);
  } catch (error) {
    console.error('Loan contract creation error:', error);
    return c.json({
      error: '차용증 저장에 실패했습니다',
      details: error.message
    }, 500);
  }
});

// 고객용 공개 API - 차용증 생성 (로그인 불필요)
app.post('/api/loan-contracts/public', async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();

  // 차용증 번호 생성 (LOAN-YYYYMMDD-XXXX 형식)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countResult = await DB.prepare(`SELECT COUNT(*) as count FROM loan_contracts WHERE loan_number LIKE ?`).bind(`LOAN-${today}-%`).first();
  const count = countResult.count + 1;
  const loanNumber = `LOAN-${today}-${String(count).padStart(4, '0')}`;

  // 남은 차용금은 처음에 차용금액과 동일
  const remainingAmount = data.loan_amount;
  const result = await DB.prepare(`
    INSERT INTO loan_contracts (
      loan_number, borrower_name, borrower_resident_number, borrower_phone, borrower_address,
      loan_amount, loan_date, loan_period, repayment_date, interest_rate, daily_deduction,
      remaining_amount, total_deducted,
      account_number, special_terms, borrower_signature, lender_signature, borrower_id_card_photo, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(loanNumber, data.borrower_name, data.borrower_resident_number, data.borrower_phone, data.borrower_address, data.loan_amount, data.loan_date, data.loan_period, data.repayment_date, data.interest_rate || 0, data.daily_deduction, remainingAmount, 0,
  // total_deducted
  data.account_number || '', data.special_terms || '', data.borrower_signature || '', data.lender_signature || '', data.borrower_id_card_photo || '', 'active').run();
  return c.json({
    id: result.meta.last_row_id,
    loan_number: loanNumber,
    ...data
  }, 201);
});

// 차용증 상태 변경
app.patch('/api/loan-contracts/:id/status', async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const {
    status
  } = await c.req.json();
  await DB.prepare('UPDATE loan_contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, id).run();
  return c.json({
    message: '상태가 변경되었습니다'
  });
});

// 일차감 기록 추가
// 차용증 차감 기록 추가 (인증 필요)
app.post('/api/loan-contracts/:id/deduction', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const {
    work_amount,
    deduction_amount,
    notes
  } = await c.req.json();

  // 현재 차용증 정보 조회
  const loan = await DB.prepare('SELECT * FROM loan_contracts WHERE id = ?').bind(id).first();
  if (!loan) {
    return c.json({
      error: '차용증을 찾을 수 없습니다'
    }, 404);
  }

  // 남은 차용금 계산
  const newRemainingAmount = Math.max(0, loan.remaining_amount - deduction_amount);
  const newTotalDeducted = loan.total_deducted + deduction_amount;

  // 차감 기록 추가
  await DB.prepare(`
    INSERT INTO loan_deductions (loan_id, deduction_date, work_amount, deduction_amount, remaining_amount, notes)
    VALUES (?, DATE('now'), ?, ?, ?, ?)
  `).bind(id, work_amount, deduction_amount, newRemainingAmount, notes || '').run();

  // 차용증 상태 업데이트
  const newStatus = newRemainingAmount === 0 ? 'completed' : loan.status;
  await DB.prepare(`
    UPDATE loan_contracts 
    SET remaining_amount = ?, total_deducted = ?, last_deduction_date = DATE('now'), status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(newRemainingAmount, newTotalDeducted, newStatus, id).run();
  return c.json({
    message: '차감이 완료되었습니다',
    remaining_amount: newRemainingAmount,
    total_deducted: newTotalDeducted,
    status: newStatus
  });
});

// 차감 기록 조회
// 차용증 차감 내역 조회 (인증 필요)
app.get('/api/loan-contracts/:id/deductions', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const id = c.req.param('id');
  const result = await DB.prepare(`
    SELECT * FROM loan_deductions WHERE loan_id = ? ORDER BY deduction_date DESC
  `).bind(id).all();
  return c.json(result.results);
});

// ============================================
// 프론트엔드 페이지 라우트
// ============================================

// 세션 클리어 페이지 (디버그용)
app.get('/clear-session', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>세션 클리어</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
<iframe src="/static/clear-session" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 로그인 페이지
// 아이디/비밀번호 찾기 페이지
app.get('/find-account', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>아이디/비밀번호 찾기</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/find-account" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 오토바이 관리 페이지
app.get('/motorcycles', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>오토바이 관리</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/motorcycles" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 계약서 작성 페이지
app.get('/contract/new', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>계약서 작성</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/contract-new" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 업체 계약서 작성 페이지
app.get('/business-contract/new', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>업체 계약서 작성</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/business-contract-new" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 계약서 목록 페이지
app.get('/contracts', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>계약서 목록</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/contracts" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 차용증 작성 페이지
app.get('/loan/new', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>차용증 작성</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/loan-new" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 차용증 목록 페이지
app.get('/loans', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>차용증 목록</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/loans" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 계약자 목록 페이지
app.get('/customers', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>계약자 목록</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/customers-simple" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 관리자 설정 페이지
app.get('/settings', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>관리자 설정</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/settings" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// ============================================
// 메인 페이지 - 운영현황 대시보드
// ============================================

// 관리자 회원가입 페이지
app.get('/register', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>관리자 회원가입</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
<iframe src="/static/register" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// 관리자 로그인 페이지 - 정적 파일로 리다이렉트
app.get('/login', c => {
  return c.redirect('/static/login.html');
});

// 계약서 서명 페이지
app.get('/contract-sign', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>계약서 서명</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
<iframe src="/static/contract-sign${c.req.url.includes('?') ? c.req.url.substring(c.req.url.indexOf('?')) : ''}" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// ============================================
// 데이터 가져오기 API
// ============================================

// 데이터 가져오기 페이지
app.get('/import-data', c => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>데이터 가져오기</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
<iframe src="/static/import-data" class="w-full h-screen border-0"></iframe>
</body>
</html>`);
});

// KnoxHub 로그인 1단계: OTP 발송
app.post('/api/import/knox-login', authMiddleware, async c => {
  const {
    username,
    password
  } = await c.req.json();
  if (!username || !password) {
    return c.json({
      error: '아이디와 비밀번호가 필요합니다'
    }, 400);
  }
  try {
    // KnoxHub 로그인 시도
    const loginUrl = 'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/login.php';

    // 1단계: 로그인 POST 요청
    const formData = new URLSearchParams();
    formData.append('input_id', username);
    formData.append('input_pw', password);
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString(),
      redirect: 'manual' // 리다이렉트 수동 처리
    });

    // 쿠키 추출
    const setCookieHeader = response.headers.get('set-cookie');

    // 세션 토큰 생성 (쿠키 저장용)
    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // 임시로 세션 저장 (실제로는 KV나 D1에 저장해야 함)
    // 여기서는 간단하게 응답으로 반환

    return c.json({
      success: true,
      session_token: sessionToken,
      cookies: setCookieHeader,
      message: 'OTP가 발송되었습니다'
    });
  } catch (error) {
    console.error('Knox login error:', error);
    return c.json({
      error: 'KnoxHub 로그인 실패: ' + error.message
    }, 500);
  }
});

// KnoxHub 2단계: OTP 인증 및 데이터 가져오기
app.post('/api/import/knox-fetch', authMiddleware, async c => {
  const {
    session_token,
    otp
  } = await c.req.json();
  if (!session_token || !otp) {
    return c.json({
      error: '세션 토큰과 OTP가 필요합니다'
    }, 400);
  }
  try {
    // OTP 인증 로직 (실제 KnoxHub API 호출 필요)
    // 여기서는 데모 데이터 반환

    // 실제로는 OTP로 인증 후 데이터 페이지를 크롤링해야 함
    const motorcycles = [{
      plate_number: '서울12가3456',
      vehicle_name: '혼다 PCX 150',
      chassis_number: 'MLHJE1234567890',
      mileage: 15000,
      model_year: 2022,
      insurance_company: '삼성화재',
      insurance_start_date: '2024-01-01',
      insurance_end_date: '2025-01-01'
    }, {
      plate_number: '경기34나5678',
      vehicle_name: '야마하 NMAX',
      chassis_number: 'MLHJE9876543210',
      mileage: 8000,
      model_year: 2023,
      insurance_company: 'DB손해보험',
      insurance_start_date: '2024-03-01',
      insurance_end_date: '2025-03-01'
    }];
    const contracts = [{
      customer_name: '홍길동',
      customer_phone: '010-1234-5678',
      vehicle_name: '혼다 PCX 150',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      monthly_fee: 200000,
      deposit: 500000
    }, {
      customer_name: '김철수',
      customer_phone: '010-9876-5432',
      vehicle_name: '야마하 NMAX',
      start_date: '2024-03-01',
      end_date: '2025-02-28',
      monthly_fee: 250000,
      deposit: 600000
    }];
    return c.json({
      success: true,
      motorcycles,
      contracts
    });
  } catch (error) {
    console.error('Knox fetch error:', error);
    return c.json({
      error: '데이터 가져오기 실패: ' + error.message
    }, 500);
  }
});

// 웹 페이지 분석 API (기존 - 백업용)
app.post('/api/import/analyze', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const {
    url
  } = await c.req.json();
  if (!url) {
    return c.json({
      error: 'URL이 필요합니다'
    }, 400);
  }
  try {
    // 웹 페이지 가져오기 (crawler 도구 사용)
    // 실제로는 사용자가 제공한 URL의 HTML을 파싱해야 합니다

    // 임시 데모 데이터 (실제로는 웹 페이지를 크롤링하여 추출)
    const motorcycles = [{
      plate_number: '서울12가3456',
      vehicle_name: '혼다 PCX 150',
      chassis_number: 'MLHJE1234567890',
      mileage: 15000,
      model_year: 2022,
      insurance_company: '삼성화재',
      insurance_start_date: '2024-01-01',
      insurance_end_date: '2025-01-01'
    }];
    const contracts = [{
      customer_name: '홍길동',
      customer_phone: '010-1234-5678',
      vehicle_name: '혼다 PCX 150',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      monthly_fee: 200000,
      deposit: 500000
    }];
    return c.json({
      success: true,
      motorcycles,
      contracts
    });
  } catch (error) {
    console.error('Error analyzing page:', error);
    return c.json({
      error: '페이지 분석 실패: ' + error.message
    }, 500);
  }
});

// 오토바이 일괄 등록 API
app.post('/api/import/motorcycles', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const {
    motorcycles
  } = await c.req.json();
  if (!motorcycles || !Array.isArray(motorcycles)) {
    return c.json({
      error: '오토바이 데이터가 필요합니다'
    }, 400);
  }
  let success = 0;
  let failed = 0;
  for (const bike of motorcycles) {
    try {
      await DB.prepare(`
        INSERT INTO motorcycles (
          plate_number, vehicle_name, chassis_number, mileage, model_year,
          insurance_company, insurance_start_date, insurance_end_date,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', datetime('now'))
      `).bind(bike.plate_number || '', bike.vehicle_name || '', bike.chassis_number || '', bike.mileage || 0, bike.model_year || new Date().getFullYear(), bike.insurance_company || '', bike.insurance_start_date || '', bike.insurance_end_date || '').run();
      success++;
    } catch (error) {
      console.error('Error importing motorcycle:', error);
      failed++;
    }
  }
  return c.json({
    success,
    failed
  });
});

// 계약서 일괄 등록 API
app.post('/api/import/contracts', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const {
    contracts
  } = await c.req.json();
  if (!contracts || !Array.isArray(contracts)) {
    return c.json({
      error: '계약서 데이터가 필요합니다'
    }, 400);
  }
  let success = 0;
  let failed = 0;
  const results = {
    lease: 0,
    rent: 0,
    loan: 0,
    temp_rent: 0
  };
  for (const contract of contracts) {
    try {
      // 계약 타입 결정 (기본값: individual)
      let contractType = contract.contract_type || 'individual';

      // 타입 매핑
      const typeMap = {
        'lease': 'individual',
        // 리스
        'rent': 'individual',
        // 렌트
        'loan': 'loan',
        // 차용증
        'temp_rent': 'temp_rent' // 임시렌트
      };
      const finalType = typeMap[contractType] || 'individual';

      // 먼저 고객 생성 (있으면 가져오기)
      let customerId = null;
      if (contract.customer_phone) {
        let customer = await DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(contract.customer_phone).first();
        if (!customer) {
          const result = await DB.prepare(`
            INSERT INTO customers (name, phone, resident_number, address, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).bind(contract.customer_name || '미입력', contract.customer_phone, contract.resident_number || '', contract.address || '').run();
          customerId = result.meta.last_row_id;
        } else {
          customerId = customer.id;
        }
      }

      // 오토바이 찾기 (번호판 또는 차량명으로)
      let motorcycle = null;
      if (contract.plate_number) {
        motorcycle = await DB.prepare('SELECT id FROM motorcycles WHERE plate_number = ?').bind(contract.plate_number).first();
      }
      if (!motorcycle && contract.vehicle_name) {
        motorcycle = await DB.prepare('SELECT id FROM motorcycles WHERE vehicle_name LIKE ?').bind('%' + contract.vehicle_name + '%').first();
      }
      if (!motorcycle) {
        // 오토바이가 없으면 자동 생성
        const result = await DB.prepare(`
          INSERT INTO motorcycles (
            plate_number, vehicle_name, driving_range, status, created_at
          ) VALUES (?, ?, ?, 'active', datetime('now'))
        `).bind(contract.plate_number || '미등록', contract.vehicle_name || '미입력', '전연령').run();
        motorcycle = {
          id: result.meta.last_row_id
        };
      }

      // 계약 번호 생성
      const prefixMap = {
        'individual': 'C',
        'loan': 'L',
        'temp_rent': 'TR'
      };
      const prefix = prefixMap[finalType] || 'C';
      const contractNumber = prefix + Date.now() + Math.random().toString(36).substring(2, 5);

      // 계약 데이터 구성
      const contractData = {
        contract_type: contractType,
        source: contract.source || 'import',
        original_data: contract
      };

      // 계약서 생성
      await DB.prepare(`
        INSERT INTO contracts (
          contract_number, contract_type, motorcycle_id, customer_id,
          start_date, end_date, monthly_fee, deposit,
          contract_data, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
      `).bind(contractNumber, finalType, motorcycle.id, customerId, contract.start_date || new Date().toISOString().split('T')[0], contract.end_date || new Date().toISOString().split('T')[0], contract.monthly_rent || contract.daily_fee || 0, contract.deposit || 0, JSON.stringify(contractData)).run();
      success++;
      results[contractType] = (results[contractType] || 0) + 1;
    } catch (error) {
      console.error('Error importing contract:', error);
      failed++;
    }
  }
  return c.json({
    success,
    failed,
    details: results,
    message: `리스: ${results.lease}건, 렌트: ${results.rent}건, 차용증: ${results.loan}건, 임시렌트: ${results.temp_rent}건`
  });
});

// 임시렌트 계약서 생성 API
// 임시렌트 계약 조회 (주민등록번호로 필터링 가능)
app.get('/api/temp-rent-contracts', async c => {
  const {
    DB
  } = c.env;
  const residentNumber = c.req.query('resident_number');
  let query = `
    SELECT 
      c.*,
      m.plate_number, m.vehicle_name,
      cu.name as customer_name, cu.phone, cu.resident_number
    FROM contracts c
    JOIN motorcycles m ON c.motorcycle_id = m.id
    LEFT JOIN customers cu ON c.customer_id = cu.id
    WHERE c.contract_type = 'temp_rent' AND c.deleted_at IS NULL
  `;
  const params = [];

  // 주민등록번호로 필터링 (고객 포털용)
  if (residentNumber) {
    query += ` AND cu.resident_number = ?`;
    params.push(residentNumber);
  }
  query += ` ORDER BY c.created_at DESC`;
  const stmt = DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});
app.post('/api/temp-rent-contracts', authMiddleware, async c => {
  const {
    DB
  } = c.env;
  const data = await c.req.json();
  try {
    // 계약 번호 생성 (T-YYYYMMDD-XXXX 형식)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const todayContracts = await DB.prepare(`
      SELECT COUNT(*) as count FROM contracts 
      WHERE contract_number LIKE ?
    `).bind(`T-${today}-%`).first();
    const sequence = String((todayContracts?.count || 0) + 1).padStart(4, '0');
    const contractNumber = `T-${today}-${sequence}`;

    // 오토바이 정보 가져오기
    const motorcycle = await DB.prepare('SELECT * FROM motorcycles WHERE id = ?').bind(data.motorcycle_id).first();
    if (!motorcycle) {
      return c.json({
        error: '오토바이를 찾을 수 없습니다'
      }, 404);
    }

    // 고객 정보 생성 또는 가져오기 (전화번호가 있는 경우만)
    let customerId = null;
    if (data.phone) {
      let customer = await DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(data.phone).first();
      if (!customer) {
        const result = await DB.prepare(`
          INSERT INTO customers (name, phone, resident_number, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `).bind(data.customer_name, data.phone, data.resident_number || '').run();
        customerId = result.meta.last_row_id;
      } else {
        customerId = customer.id;
      }
    }

    // 계약서 데이터를 JSON으로 저장
    const contractData = {
      contract_type: 'temp_rent',
      contract_number: contractNumber,
      motorcycle: {
        id: motorcycle.id,
        plate_number: motorcycle.plate_number,
        vehicle_name: motorcycle.vehicle_name
      },
      customer: {
        name: data.customer_name,
        phone: data.phone,
        resident_number: data.resident_number
      },
      period: {
        start_date: data.start_date,
        end_date: data.end_date
      },
      fees: {
        daily_fee: parseInt(data.daily_fee) || 0
      },
      special_terms: data.special_terms,
      signature: data.signature,
      admin_id_card_photo: data.admin_id_card_photo,
      status: data.status || 'active',
      created_at: new Date().toISOString()
    };

    // contracts 테이블에 임시렌트 계약 저장하기 전에 기존 계약 완료 처리
    console.log('🔄 [TempRent] Checking for existing active contracts for motorcycle:', data.motorcycle_id);

    // 1. 개인 계약 완료 처리
    const existingContracts = await DB.prepare(`
      SELECT id, contract_number, status FROM contracts 
      WHERE motorcycle_id = ? AND status = 'active'
    `).bind(data.motorcycle_id).all();
    if (existingContracts.results.length > 0) {
      console.log(`📋 [TempRent] Found ${existingContracts.results.length} active personal contract(s), completing them...`);
      for (const contract of existingContracts.results) {
        await DB.prepare(`
          UPDATE contracts 
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(contract.id).run();
        console.log(`✅ [TempRent] Completed personal contract: ${contract.contract_number}`);
      }
    }

    // 2. 업체 계약 완료 처리
    const existingBusinessContracts = await DB.prepare(`
      SELECT id, contract_number, status FROM business_contracts 
      WHERE motorcycle_id = ? AND status = 'active'
    `).bind(data.motorcycle_id).all();
    if (existingBusinessContracts.results.length > 0) {
      console.log(`📋 [TempRent] Found ${existingBusinessContracts.results.length} active business contract(s), completing them...`);
      for (const contract of existingBusinessContracts.results) {
        await DB.prepare(`
          UPDATE business_contracts 
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(contract.id).run();
        console.log(`✅ [TempRent] Completed business contract: ${contract.contract_number}`);
      }
    }

    // contracts 테이블에 임시렌트 계약 저장
    await DB.prepare(`
      INSERT INTO contracts (
        contract_number, contract_type, motorcycle_id, customer_id,
        start_date, end_date, monthly_fee, deposit, special_terms,
        signature_data, id_card_photo, status, created_at
      ) VALUES (?, 'temp_rent', ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', datetime('now'))
    `).bind(contractNumber, data.motorcycle_id, customerId, data.start_date || new Date().toISOString().split('T')[0], data.end_date || new Date().toISOString().split('T')[0], parseInt(data.daily_fee) || 0, data.special_terms || '', data.signature || '', data.admin_id_card_photo || '').run();
    return c.json({
      success: true,
      contract_number: contractNumber,
      message: '임시렌트 계약서가 생성되었습니다'
    });
  } catch (error) {
    console.error('임시렌트 계약서 생성 실패:', error);
    return c.json({
      error: '계약서 생성에 실패했습니다: ' + error.message
    }, 500);
  }
});

// KnoxHub 쿠키로 데이터 가져오기 API
app.post('/api/import/knox-cookie', authMiddleware, async c => {
  const {
    cookie
  } = await c.req.json();
  if (!cookie) {
    return c.json({
      error: '쿠키 값이 필요합니다'
    }, 400);
  }
  try {
    console.log('🔍 KnoxHub 데이터 가져오기 시작...');
    console.log('Cookie:', cookie.substring(0, 10) + '...');

    // KnoxHub 가능한 페이지 URL들
    const possibleUrls = ['https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/index.php', 'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/main.php', 'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/motorcycle_list.php', 'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/bike_list.php', 'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/list.php', 'http://knoxhub.kro.kr/index.php', 'http://knoxhub.kro.kr/main.php'];
    const motorcycles = [];
    const contracts = [];
    let successUrl = null;

    // 각 URL을 시도
    for (const url of possibleUrls) {
      try {
        console.log(`시도: ${url}`);

        // fetch로 쿠키와 함께 요청
        const response = await fetch(url, {
          headers: {
            'Cookie': `PHPSESSID=${cookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        if (response.ok) {
          const html = await response.text();
          console.log(`✅ 응답 성공: ${url} (${html.length} bytes)`);

          // HTML에서 번호판 패턴 찾기 (예: 12가3456, 서울12가3456)
          const platePattern = /(\d{2,3}[가-힣]\d{4}|[가-힣]{2}\d{2}[가-힣]\d{4})/g;
          const plates = [...new Set(html.match(platePattern) || [])];
          console.log(`🏍️ 발견된 번호판: ${plates.length}개`);
          if (plates.length > 0) {
            successUrl = url;

            // 번호판별로 오토바이 정보 추출
            plates.forEach(plate => {
              motorcycles.push({
                plate_number: plate,
                vehicle_name: '정보 없음 (수동 입력 필요)',
                chassis_number: '',
                mileage: 0,
                model_year: new Date().getFullYear(),
                status: 'active'
              });
            });
            break; // 성공하면 다음 URL 시도 안함
          }
        }
      } catch (err) {
        console.log(`❌ 실패: ${url} - ${err.message}`);
      }
    }

    // 결과 반환
    if (motorcycles.length > 0) {
      console.log(`✅ 총 ${motorcycles.length}대 발견 (from ${successUrl})`);
      return c.json({
        motorcycles,
        contracts,
        source: successUrl,
        extracted_at: new Date().toISOString()
      });
    } else {
      // 데이터를 찾지 못한 경우
      console.log('⚠️ 데이터를 찾지 못했습니다. JSON 업로드 방식을 사용해주세요.');
      return c.json({
        error: 'KnoxHub에서 데이터를 찾을 수 없습니다. JSON 업로드 방식을 사용해주세요.',
        motorcycles: [],
        contracts: []
      }, 404);
    }
  } catch (error) {
    console.error('KnoxHub 데이터 가져오기 실패:', error);
    return c.json({
      error: '데이터 가져오기에 실패했습니다. JSON 업로드 방식을 사용해주세요.',
      motorcycles: [],
      contracts: []
    }, 500);
  }
});

// PDF 계약서 분석 API
app.post('/api/import/analyze-pdfs', authMiddleware, async c => {
  try {
    const {
      files
    } = await c.req.json();
    if (!files || !Array.isArray(files) || files.length === 0) {
      return c.json({
        error: 'PDF 파일이 필요합니다'
      }, 400);
    }
    console.log(`📄 ${files.length}개의 PDF 파일 분석 시작...`);
    const motorcycles = [];
    const contracts = [];
    const seenPlates = new Set();
    for (const file of files) {
      try {
        // Base64 디코딩하여 텍스트 추출
        const base64Data = file.data.split(',')[1] || file.data;
        const binaryString = atob(base64Data);

        // PDF에서 텍스트 추출 (간단한 방법 - PDF 구조의 텍스트 부분만)
        let text = '';
        for (let i = 0; i < binaryString.length; i++) {
          const char = binaryString[i];
          const code = char.charCodeAt(0);
          // 출력 가능한 ASCII 문자만 추출
          if (code >= 32 && code <= 126) {
            text += char;
          } else if (code === 10 || code === 13) {
            text += ' ';
          }
        }
        console.log(`📝 파일 "${file.name}" 텍스트 추출 완료 (${text.length} 문자)`);

        // 계약 타입 감지
        let contractType = 'lease'; // 기본값
        if (text.includes('차용증') || text.includes('LOAN')) {
          contractType = 'loan';
        } else if (text.includes('임시') || text.includes('단기')) {
          contractType = 'temp_rent';
        } else if (text.includes('렌트') || text.includes('RENT')) {
          contractType = 'rent';
        } else if (text.includes('리스') || text.includes('LEASE')) {
          contractType = 'lease';
        }

        // 번호판 추출 (예: 12가3456, 서울12가3456, 123가4567)
        const plateMatches = text.match(/([가-힣]{0,2}\d{2,3}[가-힣]\d{4})/g);
        const plateNumber = plateMatches ? plateMatches[0] : null;

        // 차량명 추출 (혼다, 야마하, PCX, XMAX 등)
        const vehiclePatterns = [/혼다\s*[A-Z]*\s*\d*/gi, /야마하\s*[A-Z]*\s*\d*/gi, /스즈키\s*[A-Z]*\s*\d*/gi, /PCX\s*\d*/gi, /XMAX\s*\d*/gi, /엑스맥스\s*\d*/gi, /포르자\s*\d*/gi];
        let vehicleName = null;
        for (const pattern of vehiclePatterns) {
          const match = text.match(pattern);
          if (match) {
            vehicleName = match[0].trim();
            break;
          }
        }

        // 고객명 추출 (차용인, 계약자 다음에 나오는 한글 이름)
        const namePatterns = [/차용인[:\s]*([가-힣]{2,4})/, /계약자[:\s]*([가-힣]{2,4})/, /성명[:\s]*([가-힣]{2,4})/, /이름[:\s]*([가-힣]{2,4})/];
        let customerName = null;
        for (const pattern of namePatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            customerName = match[1].trim();
            break;
          }
        }

        // 전화번호 추출
        const phoneMatch = text.match(/01[0-9]-?\d{3,4}-?\d{4}/);
        const customerPhone = phoneMatch ? phoneMatch[0].replace(/-/g, '').replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : null;

        // 주민번호 추출
        const residentMatch = text.match(/\d{6}-?\d{7}/);
        const residentNumber = residentMatch ? residentMatch[0] : null;

        // 금액 추출 (월대여금, 일차감금액)
        const amountPatterns = [/월대여금[:\s]*([0-9,]+)/, /일차감금액[:\s]*([0-9,]+)/, /대여금[:\s]*([0-9,]+)/, /렌트비[:\s]*([0-9,]+)/];
        let amount = null;
        for (const pattern of amountPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            amount = parseInt(match[1].replace(/,/g, ''));
            break;
          }
        }

        // 보증금 추출
        const depositMatch = text.match(/보증금[:\s]*([0-9,]+)/);
        const deposit = depositMatch ? parseInt(depositMatch[1].replace(/,/g, '')) : 0;

        // 날짜 추출 (YYYY-MM-DD 또는 YYYY.MM.DD 또는 YYYY년 MM월 DD일)
        const datePatterns = [/20\d{2}[-.]?\d{2}[-.]?\d{2}/g, /20\d{2}년\s*\d{1,2}월\s*\d{1,2}일/g];
        const dates = [];
        for (const pattern of datePatterns) {
          const matches = text.match(pattern);
          if (matches) {
            matches.forEach(d => {
              const normalized = d.replace(/년\s*/g, '-').replace(/월\s*/g, '-').replace(/일/g, '').replace(/\./g, '-');
              dates.push(normalized);
            });
          }
        }
        const startDate = dates[0] || new Date().toISOString().split('T')[0];
        const endDate = dates[1] || startDate;

        // 오토바이 데이터 추가 (중복 체크)
        if (plateNumber && !seenPlates.has(plateNumber)) {
          seenPlates.add(plateNumber);
          motorcycles.push({
            plate_number: plateNumber,
            vehicle_name: vehicleName || '정보 없음',
            chassis_number: '',
            mileage: 0,
            model_year: new Date().getFullYear(),
            status: 'active'
          });
        }

        // 계약서 데이터 추가
        if (plateNumber || customerName) {
          contracts.push({
            contract_type: contractType,
            customer_name: customerName || '미입력',
            customer_phone: customerPhone || '',
            resident_number: residentNumber || '',
            vehicle_name: vehicleName || '정보 없음',
            plate_number: plateNumber || '미등록',
            start_date: startDate,
            end_date: endDate,
            monthly_rent: contractType === 'temp_rent' ? 0 : amount || 0,
            daily_fee: contractType === 'temp_rent' ? amount || 0 : 0,
            deposit: deposit,
            address: '',
            special_terms: `${file.name}에서 자동 추출`,
            source: 'pdf_upload'
          });
        }
      } catch (fileError) {
        console.error(`파일 "${file.name}" 처리 실패:`, fileError);
      }
    }
    console.log(`✅ 분석 완료: 오토바이 ${motorcycles.length}대, 계약서 ${contracts.length}건`);
    return c.json({
      motorcycles,
      contracts,
      analyzed_files: files.length,
      success: true,
      message: `${files.length}개 파일 분석 완료. 오토바이 ${motorcycles.length}대, 계약서 ${contracts.length}건 추출됨`
    });
  } catch (error) {
    console.error('PDF 분석 실패:', error);
    return c.json({
      error: 'PDF 분석에 실패했습니다: ' + error.message,
      motorcycles: [],
      contracts: []
    }, 500);
  }
});

// 대시보드 (루트 경로) - 운영현황 페이지
app.get('/dashboard', c => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>대시보드 - 오토바이 렌탈 관리</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            body { font-family: 'Noto Sans KR', sans-serif; }
            .stat-card {
                transition: all 0.3s ease;
                cursor: pointer;
            }
            .stat-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            }
        </style>
    </head>
    <body class="bg-gray-100">
        <!-- 헤더 -->
        <div class="bg-white shadow-md">
            <div class="container mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <h1 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-tachometer-alt mr-2 text-blue-600"></i>
                        운영현황
                    </h1>
                    <div class="flex items-center space-x-4">
                        <a href="/static/settings.html" class="text-gray-600 hover:text-blue-600 font-medium">
                            <i class="fas fa-cog mr-1"></i>설정
                        </a>
                        <div class="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                            <i class="fas fa-user-shield text-blue-600"></i>
                            <span id="userRoleBadge" class="text-sm font-bold text-blue-700"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 메인 콘텐츠 -->
        <div class="container mx-auto px-4 py-8">
            <!-- 운영 통계 카드 4개 -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <!-- 총 바이크 -->
                <div class="stat-card bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg" 
                     onclick="filterByStatus('all')">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-4xl"><i class="fas fa-motorcycle"></i></div>
                        <div class="text-right">
                            <div class="text-sm opacity-90">총 바이크</div>
                            <div id="totalCount" class="text-3xl font-bold">0</div>
                        </div>
                    </div>
                </div>

                <!-- 사용중 -->
                <div class="stat-card bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg" 
                     onclick="filterByStatus('rented')">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-4xl"><i class="fas fa-check-circle"></i></div>
                        <div class="text-right">
                            <div class="text-sm opacity-90">사용중</div>
                            <div id="rentedCount" class="text-3xl font-bold">0</div>
                        </div>
                    </div>
                </div>

                <!-- 휴차중 -->
                <div class="stat-card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-xl shadow-lg" 
                     onclick="filterByStatus('available')">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-4xl"><i class="fas fa-pause-circle"></i></div>
                        <div class="text-right">
                            <div class="text-sm opacity-90">휴차중</div>
                            <div id="availableCount" class="text-3xl font-bold">0</div>
                        </div>
                    </div>
                </div>

                <!-- 수리중/폐지 -->
                <div class="stat-card bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg" 
                     onclick="filterByStatus('maintenance_scrapped')">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-4xl"><i class="fas fa-tools"></i></div>
                        <div class="text-right">
                            <div class="text-sm opacity-90">수리중/폐지</div>
                            <div id="maintenanceCount" class="text-3xl font-bold">0</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 추가 통계 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <!-- 오토바이 관리 -->
                <div class="bg-white p-6 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition" onclick="window.location.href='/static/motorcycles.html'">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">오토바이 관리</p>
                            <p class="text-lg font-bold text-blue-600">바로가기</p>
                        </div>
                        <div class="text-3xl text-blue-600"><i class="fas fa-motorcycle"></i></div>
                    </div>
                </div>

                <!-- 총 고객 수 -->
                <div class="bg-white p-6 rounded-xl shadow-md">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">총 고객</p>
                            <p id="totalCustomers" class="text-2xl font-bold text-gray-800">0</p>
                        </div>
                        <div class="text-3xl text-green-600"><i class="fas fa-users"></i></div>
                    </div>
                </div>

                <!-- 차용 대금 -->
                <div class="bg-white p-6 rounded-xl shadow-md">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">차용 대금</p>
                            <p id="totalLoanAmount" class="text-2xl font-bold text-gray-800">0원</p>
                        </div>
                        <div class="text-3xl text-orange-600"><i class="fas fa-file-invoice-dollar"></i></div>
                    </div>
                </div>
            </div>

            <!-- 빠른 액세스 -->
            <div class="bg-white p-6 rounded-xl shadow-md">
                <h2 class="text-xl font-bold mb-4 text-gray-800">
                    <i class="fas fa-bolt mr-2 text-yellow-500"></i>빠른 액세스
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <!-- Row 1 -->
                    <a href="/static/motorcycle-register.html" class="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-plus-circle text-3xl text-blue-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">오토바이 등록</p>
                    </a>
                    <a href="/static/customer-register.html" class="bg-cyan-50 hover:bg-cyan-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-user-plus text-3xl text-cyan-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">고객 등록</p>
                    </a>
                    <a href="/static/companies.html" class="bg-indigo-50 hover:bg-indigo-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-building text-3xl text-indigo-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">업체 등록</p>
                    </a>
                    <a href="/static/contract-new.html" class="bg-green-50 hover:bg-green-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-file-signature text-3xl text-green-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">개인계약서 작성</p>
                    </a>
                    <a href="/static/business-contract-new.html" class="bg-teal-50 hover:bg-teal-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-handshake text-3xl text-teal-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">업체계약서 작성</p>
                    </a>
                    
                    <!-- Row 2 -->
                    <a href="/static/loan-new.html" class="bg-yellow-50 hover:bg-yellow-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-file-invoice-dollar text-3xl text-yellow-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">차용증 작성</p>
                    </a>
                    <a href="/static/customers.html" class="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-users text-3xl text-blue-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">고객 목록</p>
                    </a>
                    <a href="/static/contracts.html" class="bg-orange-50 hover:bg-orange-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-folder-open text-3xl text-orange-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">계약서 목록</p>
                    </a>
                    <a href="/static/loans.html" class="bg-red-50 hover:bg-red-100 p-4 rounded-lg text-center transition">
                        <i class="fas fa-receipt text-3xl text-red-600 mb-2"></i>
                        <p class="text-sm font-medium text-gray-700">차용증 목록</p>
                    </a>
                </div>
            </div>
        </div>

        <!-- 관리자 관리 모달 (슈퍼관리자 전용) -->
        <div id="adminManagementModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
            <div class="bg-white rounded-xl shadow-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-users-cog mr-2 text-blue-600"></i>관리자 관리
                    </h2>
                    <button onclick="closeAdminManagement()" class="text-gray-500 hover:text-gray-700 text-2xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div id="adminList" class="space-y-4">
                    <!-- 관리자 목록이 여기에 동적으로 로드됩니다 -->
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // Axios 인터셉터 설정 - 세션 ID 자동 추가 (동적으로 읽기)
            axios.interceptors.request.use(config => {
                const sessionId = localStorage.getItem('sessionId');
                console.log('🔍 [Axios Interceptor] SessionID:', sessionId);
                console.log('🔍 [Axios Interceptor] Request URL:', config.url);
                if (sessionId) {
                    config.headers['X-Session-ID'] = sessionId;
                    console.log('✅ [Axios Interceptor] X-Session-ID 헤더 추가됨');
                } else {
                    console.log('❌ [Axios Interceptor] SessionID 없음 - 헤더 추가 안됨');
                }
                return config;
            });

            axios.interceptors.response.use(
                response => response,
                error => {
                    if (error.response?.status === 401) {
                        // 인증 실패 시 로그인 페이지로 이동
                        localStorage.removeItem('sessionId');
                        localStorage.removeItem('user');
                        window.location.href = '/static/login.html';
                    }
                    return Promise.reject(error);
                }
            );

            // 통계 로드
            async function loadStats() {
                try {
                    const response = await axios.get('/api/dashboard/stats');
                    const data = response.data;
                    
                    // 오토바이 통계
                    const total = data.motorcycles.total;
                    const rented = data.motorcycles.rented;  // 진행중 계약서 개수
                    const available = data.motorcycles.available;  // 휴차중
                    const maintenance = data.motorcycles.maintenance;  // 수리중/폐지 합계
                    
                    document.getElementById('totalCount').textContent = total;
                    document.getElementById('rentedCount').textContent = rented;
                    document.getElementById('availableCount').textContent = available;
                    document.getElementById('maintenanceCount').textContent = maintenance;
                    
                    // 고객 및 차용증 통계
                    document.getElementById('totalCustomers').textContent = data.customers;
                    document.getElementById('totalLoanAmount').textContent = 
                        (data.contracts.total_loan_amount || 0).toLocaleString() + '원';
                } catch (error) {
                    console.error('통계 로드 실패:', error);
                    if (error.response?.status === 401) {
                        alert('⚠️ 로그인이 필요합니다.');
                    }
                }
            }
            
            // 상태별 필터링 (오토바이 관리 페이지로 이동)
            function filterByStatus(status) {
                window.location.href = '/static/motorcycles.html?status=' + status;
            }
            
            // 페이지 로드 시 인증 확인 및 통계 로드
            (async function() {
                const sessionId = localStorage.getItem('sessionId');
                const userStr = localStorage.getItem('user');
                
                if (!sessionId) {
                    console.log('❌ 세션 없음 - 로그인 페이지로 이동');
                    window.location.href = '/login';
                    return;
                }
                
                // 사용자 역할 표시
                if (userStr) {
                    try {
                        const user = JSON.parse(userStr);
                        const roleBadge = document.getElementById('userRoleBadge');
                        if (roleBadge) {
                            const roleText = user.role === 'superadmin' ? '슈퍼관리자' : '관리자';
                            const userName = user.name || user.username;
                            roleBadge.textContent = \`\${userName} (\${roleText})\`;
                        }
                    } catch (e) {
                        console.error('사용자 정보 파싱 오류:', e);
                    }
                }
                
                console.log('✅ 세션 확인:', sessionId);
                await loadStats();
            })();
            
            // 5분마다 자동 새로고침
            setInterval(loadStats, 300000);

            // ========================================
            // 계약자 정보 관리 함수
            // ========================================

            // Daum 우편번호 검색
            function searchAddress() {
                new daum.Postcode({
                    oncomplete: function(data) {
                        // 우편번호와 주소 정보를 필드에 입력
                        document.getElementById('customerPostcode').value = data.zonecode;
                        
                        // 기본 주소 (도로명 또는 지번)
                        let fullAddress = '';
                        if (data.userSelectedType === 'R') { // 도로명 주소
                            fullAddress = data.roadAddress;
                        } else { // 지번 주소
                            fullAddress = data.jibunAddress;
                        }
                        
                        // 건물명 추가
                        if (data.buildingName !== '') {
                            fullAddress += ' (' + data.buildingName + ')';
                        }
                        
                        document.getElementById('customerAddress').value = fullAddress;
                        
                        // 상세주소 입력 필드에 포커스
                        document.getElementById('customerDetailAddress').focus();
                    }
                }).open();
            }

            // 주민등록번호 자동 하이픈 추가 (입력 및 붙여넣기 모두 처리)
            function formatResidentNumber(value) {
                let numbers = value.replace(/[^0-9]/g, '');
                numbers = numbers.substring(0, 13);
                if (numbers.length > 6) {
                    return numbers.substring(0, 6) + '-' + numbers.substring(6);
                }
                return numbers;
            }

            document.getElementById('customerResidentNumber').addEventListener('input', function(e) {
                e.target.value = formatResidentNumber(e.target.value);
            });

            document.getElementById('customerResidentNumber').addEventListener('paste', function(e) {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                e.target.value = formatResidentNumber(pastedText);
            });

            // 전화번호 자동 하이픈 추가 (입력 및 붙여넣기 모두 처리)
            function formatPhoneNumber(value) {
                let numbers = value.replace(/[^0-9]/g, '');
                numbers = numbers.substring(0, 11);
                if (numbers.length > 3 && numbers.length <= 7) {
                    return numbers.substring(0, 3) + '-' + numbers.substring(3);
                } else if (numbers.length > 7) {
                    return numbers.substring(0, 3) + '-' + numbers.substring(3, 7) + '-' + numbers.substring(7);
                }
                return numbers;
            }

            document.getElementById('customerPhone').addEventListener('input', function(e) {
                e.target.value = formatPhoneNumber(e.target.value);
            });

            document.getElementById('customerPhone').addEventListener('paste', function(e) {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                e.target.value = formatPhoneNumber(pastedText);
            });

            // 폼 초기화
            function clearCustomerForm() {
                document.getElementById('customerForm').reset();
            }

            // 계약자 폼 토글 (표시/숨김)
            function toggleCustomerForm() {
                const section = document.getElementById('customerFormSection');
                if (section.classList.contains('hidden')) {
                    section.classList.remove('hidden');
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        document.getElementById('customerName').focus();
                    }, 500);
                } else {
                    section.classList.add('hidden');
                }
            }

            // 폼 제출 처리
            document.getElementById('customerForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const sessionId = localStorage.getItem('sessionId');
                if (!sessionId) {
                    alert('⚠️ 로그인이 필요합니다.');
                    window.location.href = '/login';
                    return;
                }

                const customerData = {
                    name: document.getElementById('customerName').value.trim(),
                    resident_number: document.getElementById('customerResidentNumber').value.trim(),
                    phone: document.getElementById('customerPhone').value.trim(),
                    postcode: document.getElementById('customerPostcode').value.trim(),
                    address: document.getElementById('customerAddress').value.trim(),
                    detail_address: document.getElementById('customerDetailAddress').value.trim() || '',
                    license_type: '보통' // 기본값
                };

                // 유효성 검사
                if (!customerData.name) {
                    alert('이름을 입력하세요.');
                    return;
                }
                if (!customerData.resident_number || customerData.resident_number.length !== 14) {
                    alert('주민등록번호를 정확히 입력하세요. (123456-1234567)');
                    return;
                }
                if (!customerData.phone) {
                    alert('전화번호를 입력하세요.');
                    return;
                }
                if (!document.getElementById('customerPostcode').value) {
                    alert('우편번호를 검색하세요.');
                    return;
                }

                try {
                    const response = await fetch('/api/customers', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Session-ID': sessionId
                        },
                        body: JSON.stringify(customerData)
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || '저장 실패');
                    }

                    const result = await response.json();
                    alert('✅ 계약자 정보가 저장되었습니다.\\n\\n이름: ' + customerData.name + '\\n전화번호: ' + customerData.phone);
                    
                    // 폼 초기화
                    clearCustomerForm();
                    
                    // 폼 섹션 닫기
                    document.getElementById('customerFormSection').classList.add('hidden');
                } catch (error) {
                    console.error('Error:', error);
                    alert('❌ 저장 실패: ' + error.message);
                }
            });
        </script>
        <!-- Daum 우편번호 API -->
        <script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
    </body>
    </html>
  `);
});
export default app;
