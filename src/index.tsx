import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './public' }))

// ============================================
// 인증 헬퍼 함수
// ============================================

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

async function createSession(DB: D1Database, userId: number) {
  const sessionId = generateSessionId()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24시간
  
  await DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt).run()
  
  return sessionId
}

async function validateSession(DB: D1Database, sessionId: string | undefined) {
  if (!sessionId) return null
  
  const session = await DB.prepare(`
    SELECT s.*, u.username, u.name, u.role 
    FROM sessions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionId).first()
  
  return session
}

// ============================================
// 인증 미들웨어
// ============================================

async function authMiddleware(c: any, next: any) {
  const sessionId = c.req.header('X-Session-ID') || c.req.query('session')
  const session = await validateSession(c.env.DB, sessionId)
  
  if (!session) {
    return c.json({ error: '인증이 필요합니다' }, 401)
  }
  
  c.set('user', session)
  await next()
}

// ============================================
// 인증 API
// ============================================

// 로그인
app.post('/api/auth/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()
  
  const user = await DB.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    .bind(username, password).first()
  
  if (!user) {
    return c.json({ error: '아이디 또는 비밀번호가 잘못되었습니다' }, 401)
  }
  
  const sessionId = await createSession(DB, (user as any).id)
  
  return c.json({
    success: true,
    sessionId,
    user: {
      id: (user as any).id,
      username: (user as any).username,
      name: (user as any).name,
      role: (user as any).role
    }
  })
})

// 로그아웃
app.post('/api/auth/logout', async (c) => {
  const { DB } = c.env
  const sessionId = c.req.header('X-Session-ID')
  
  if (sessionId) {
    await DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }
  
  return c.json({ success: true })
})

// 세션 확인
app.get('/api/auth/check', async (c) => {
  const { DB } = c.env
  const sessionId = c.req.header('X-Session-ID') || c.req.query('session')
  
  const session = await validateSession(DB, sessionId)
  
  if (!session) {
    return c.json({ authenticated: false }, 401)
  }
  
  return c.json({
    authenticated: true,
    user: {
      id: (session as any).user_id,
      username: (session as any).username,
      name: (session as any).name,
      role: (session as any).role
    }
  })
})

// ============================================
// 오토바이 API (인증 필요)
// ============================================

// 오토바이 목록 조회
app.get('/api/motorcycles', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status')
  
  let query = 'SELECT * FROM motorcycles'
  if (status) {
    query += ` WHERE status = '${status}'`
  }
  query += ' ORDER BY created_at DESC'
  
  const result = await DB.prepare(query).all()
  return c.json(result.results)
})

// 오토바이 상세 조회
app.get('/api/motorcycles/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare('SELECT * FROM motorcycles WHERE id = ?').bind(id).first()
  
  if (!result) {
    return c.json({ error: '오토바이를 찾을 수 없습니다' }, 404)
  }
  
  return c.json(result)
})

// 오토바이 등록 (인증 필요)
app.post('/api/motorcycles', authMiddleware, async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO motorcycles (
      plate_number, vehicle_name, chassis_number, mileage, model_year,
      insurance_company, insurance_start_date, insurance_end_date,
      inspection_start_date, inspection_end_date,
      driving_range, owner_name, insurance_fee, vehicle_price, daily_rental_fee, usage_notes, status,
      certificate_photo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.plate_number,
    data.vehicle_name,
    data.chassis_number,
    data.mileage,
    data.model_year,
    data.insurance_company,
    data.insurance_start_date,
    data.insurance_end_date,
    data.inspection_start_date || null,
    data.inspection_end_date || null,
    data.driving_range,
    data.owner_name,
    data.insurance_fee,
    data.vehicle_price,
    data.daily_rental_fee || 0,
    data.usage_notes || '',
    data.status || 'available',
    data.certificate_photo || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id, ...data }, 201)
})

// 오토바이 수정 (인증 필요)
app.put('/api/motorcycles/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE motorcycles SET
      plate_number = ?, vehicle_name = ?, chassis_number = ?, mileage = ?,
      model_year = ?, insurance_company = ?, insurance_start_date = ?,
      insurance_end_date = ?, inspection_start_date = ?, inspection_end_date = ?,
      driving_range = ?, owner_name = ?,
      insurance_fee = ?, vehicle_price = ?, daily_rental_fee = ?, usage_notes = ?, status = ?,
      certificate_photo = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.plate_number,
    data.vehicle_name,
    data.chassis_number,
    data.mileage,
    data.model_year,
    data.insurance_company,
    data.insurance_start_date,
    data.insurance_end_date,
    data.inspection_start_date || null,
    data.inspection_end_date || null,
    data.driving_range,
    data.owner_name,
    data.insurance_fee,
    data.vehicle_price,
    data.daily_rental_fee || 0,
    data.usage_notes || '',
    data.status,
    data.certificate_photo || null,
    id
  ).run()
  
  return c.json({ id, ...data })
})

// 오토바이 삭제 (인증 필요)
app.delete('/api/motorcycles/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare('DELETE FROM motorcycles WHERE id = ?').bind(id).run()
  
  return c.json({ message: '삭제되었습니다' })
})

// 오토바이별 계약 이력 조회
app.get('/api/motorcycles/:id/contracts', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT 
      c.*,
      cu.name as customer_name, cu.phone as customer_phone,
      cu.resident_number, cu.address, cu.license_type
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    WHERE c.motorcycle_id = ?
    ORDER BY c.created_at DESC
  `).bind(id).all()
  
  return c.json(result.results)
})

// ============================================
// 고객 API
// ============================================

// 고객 목록 조회
app.get('/api/customers', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare('SELECT * FROM customers ORDER BY created_at DESC').all()
  return c.json(result.results)
})

// 고객 상세 조회
app.get('/api/customers/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()
  
  if (!result) {
    return c.json({ error: '고객을 찾을 수 없습니다' }, 404)
  }
  
  return c.json(result)
})

// 고객 등록
app.post('/api/customers', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO customers (name, resident_number, phone, address, license_type)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    data.name,
    data.resident_number,
    data.phone,
    data.address,
    data.license_type
  ).run()
  
  return c.json({ id: result.meta.last_row_id, ...data }, 201)
})

// 고객 수정
app.put('/api/customers/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE customers SET
      name = ?, resident_number = ?, phone = ?, address = ?, license_type = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.name,
    data.resident_number,
    data.phone,
    data.address,
    data.license_type,
    id
  ).run()
  
  return c.json({ id, ...data })
})

// ============================================
// 계약서 API
// ============================================

// 계약서 목록 조회
app.get('/api/contracts', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT 
      c.*,
      m.plate_number, m.vehicle_name,
      cu.name as customer_name, cu.phone as customer_phone
    FROM contracts c
    JOIN motorcycles m ON c.motorcycle_id = m.id
    JOIN customers cu ON c.customer_id = cu.id
    ORDER BY c.created_at DESC
  `).all()
  
  return c.json(result.results)
})

// 오토바이별 계약 이력 조회
app.get('/api/motorcycles/:id/contracts', async (c) => {
  const { DB } = c.env
  const motorcycleId = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT 
      c.*,
      cu.name as customer_name, cu.resident_number, cu.phone as customer_phone,
      cu.address as customer_address, cu.license_type
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    WHERE c.motorcycle_id = ?
    ORDER BY c.created_at DESC
  `).bind(motorcycleId).all()
  
  return c.json(result.results)
})

// 계약서 상세 조회
app.get('/api/contracts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT 
      c.*,
      m.*,
      cu.name as customer_name, cu.resident_number, cu.phone as customer_phone,
      cu.address as customer_address, cu.license_type
    FROM contracts c
    JOIN motorcycles m ON c.motorcycle_id = m.id
    JOIN customers cu ON c.customer_id = cu.id
    WHERE c.id = ?
  `).bind(id).first()
  
  if (!result) {
    return c.json({ error: '계약서를 찾을 수 없습니다' }, 404)
  }
  
  return c.json(result)
})

// 계약서 생성 (인증 필요)
app.post('/api/contracts', authMiddleware, async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // 계약서 번호 생성 (YYYYMMDD-XXXX 형식)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const countResult = await DB.prepare(
    `SELECT COUNT(*) as count FROM contracts WHERE contract_number LIKE ?`
  ).bind(`${today}-%`).first()
  
  const count = (countResult as any).count + 1
  const contractNumber = `${today}-${String(count).padStart(4, '0')}`
  
  const result = await DB.prepare(`
    INSERT INTO contracts (
      contract_type, motorcycle_id, customer_id, start_date, end_date,
      monthly_fee, deposit, special_terms, signature_data, id_card_photo, contract_number, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.contract_type,
    data.motorcycle_id,
    data.customer_id,
    data.start_date,
    data.end_date,
    data.monthly_fee,
    data.deposit || 0,
    data.special_terms || '',
    data.signature_data || '',
    data.id_card_photo || '',
    contractNumber,
    'active'
  ).run()
  
  // 오토바이 상태 업데이트
  await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?')
    .bind('rented', data.motorcycle_id).run()
  
  return c.json({ id: result.meta.last_row_id, contract_number: contractNumber, ...data }, 201)
})

// 계약서 상태 변경 (인증 필요)
app.patch('/api/contracts/:id/status', authMiddleware, async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  // 계약서 정보 조회
  const contract = await DB.prepare('SELECT * FROM contracts WHERE id = ?').bind(id).first()
  
  if (!contract) {
    return c.json({ error: '계약서를 찾을 수 없습니다' }, 404)
  }
  
  // 계약서 상태 업데이트
  await DB.prepare('UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, id).run()
  
  // 계약 종료시 오토바이 상태 변경
  if (status === 'completed' || status === 'cancelled') {
    await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?')
      .bind('available', (contract as any).motorcycle_id).run()
  }
  
  return c.json({ message: '상태가 변경되었습니다' })
})

// ============================================
// 사업자 정보 API
// ============================================

// 사업자 정보 조회
app.get('/api/company-settings', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare('SELECT * FROM company_settings ORDER BY id DESC LIMIT 1').first()
  
  if (!result) {
    return c.json({ 
      company_name: '배달대행 회사', 
      business_number: '000-00-00000', 
      representative_name: '대표자명' 
    })
  }
  
  return c.json(result)
})

// 사업자 정보 수정
app.put('/api/company-settings', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // 기존 데이터 확인
  const existing = await DB.prepare('SELECT * FROM company_settings ORDER BY id DESC LIMIT 1').first()
  
  if (existing) {
    // 업데이트
    await DB.prepare(`
      UPDATE company_settings 
      SET company_name = ?, business_number = ?, representative_name = ?,
          phone = ?, address = ?, bank_name = ?, account_number = ?, account_holder = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.company_name,
      data.business_number,
      data.representative_name,
      data.phone || '',
      data.address || '',
      data.bank_name || '',
      data.account_number || '',
      data.account_holder || '',
      (existing as any).id
    ).run()
  } else {
    // 신규 삽입
    await DB.prepare(`
      INSERT INTO company_settings (company_name, business_number, representative_name, phone, address, bank_name, account_number, account_holder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.company_name,
      data.business_number,
      data.representative_name,
      data.phone || '',
      data.address || '',
      data.bank_name || '',
      data.account_number || '',
      data.account_holder || ''
    ).run()
  }
  
  return c.json({ message: '사업자 정보가 저장되었습니다' })
})

// ============================================
// 업체 계약서 API
// ============================================

// 업체 계약서 생성
app.post('/api/business-contracts', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // 계약서 번호 생성 (B-YYYYMMDD-XXXX 형식)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const countResult = await DB.prepare(
    `SELECT COUNT(*) as count FROM business_contracts WHERE contract_number LIKE ?`
  ).bind(`B-${today}-%`).first()
  
  const count = (countResult as any).count + 1
  const contractNumber = `B-${today}-${String(count).padStart(4, '0')}`
  
  const result = await DB.prepare(`
    INSERT INTO business_contracts (
      motorcycle_id, contract_number,
      company_name, business_number, representative, business_type, business_category,
      business_phone, business_address,
      representative_resident_number, representative_phone, representative_address,
      contract_start_date, contract_end_date, insurance_start_date, insurance_end_date,
      driving_range, daily_amount, deposit, special_terms,
      business_license_photo, id_card_photo, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.motorcycle_id,
    contractNumber,
    data.company_name,
    data.business_number,
    data.representative,
    data.business_type,
    data.business_category,
    data.business_phone,
    data.business_address,
    data.representative_resident_number,
    data.representative_phone,
    data.representative_address,
    data.contract_start_date,
    data.contract_end_date,
    data.insurance_start_date,
    data.insurance_end_date,
    data.driving_range,
    data.daily_amount,
    data.deposit || 0,
    data.special_terms || '',
    data.business_license_photo || '',
    data.id_card_photo || '',
    'active'
  ).run()
  
  // 오토바이 상태를 'rented'로 변경
  await DB.prepare(
    `UPDATE motorcycles SET status = 'rented' WHERE id = ?`
  ).bind(data.motorcycle_id).run()
  
  return c.json({ id: result.meta.last_row_id, contract_number: contractNumber }, 201)
})

// 업체 계약서 목록 조회
app.get('/api/business-contracts', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT 
      bc.*,
      m.plate_number, m.vehicle_name, m.chassis_number
    FROM business_contracts bc
    JOIN motorcycles m ON bc.motorcycle_id = m.id
    ORDER BY bc.created_at DESC
  `).all()
  
  return c.json(result.results)
})

// 업체 계약서 상세 조회
app.get('/api/business-contracts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT 
      bc.*,
      m.plate_number, m.vehicle_name, m.chassis_number, m.model_year, m.mileage
    FROM business_contracts bc
    JOIN motorcycles m ON bc.motorcycle_id = m.id
    WHERE bc.id = ?
  `).bind(id).first()
  
  if (!result) {
    return c.json({ error: '업체 계약서를 찾을 수 없습니다' }, 404)
  }
  
  return c.json(result)
})

// ============================================
// 차용증 API
// ============================================

// 차용증 목록 조회
app.get('/api/loan-contracts', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM loan_contracts ORDER BY created_at DESC
  `).all()
  
  return c.json(result.results)
})

// ============================================
// 관리자 API
// ============================================

// 관리자 로그인
app.post('/api/admin/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()
  
  // DB에서 사용자 조회
  const user = await DB.prepare(`
    SELECT * FROM admin_users WHERE username = ?
  `).bind(username).first() as any
  
  if (!user) {
    return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, 401)
  }
  
  // 비밀번호 확인 (간단한 비교, 실제로는 bcrypt 사용 권장)
  if (user.password !== password) {
    return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, 401)
  }
  
  // 마지막 로그인 시간 업데이트
  const now = new Date().toISOString()
  await DB.prepare(`
    UPDATE admin_users SET last_login = ? WHERE username = ?
  `).bind(now, username).run()
  
  return c.json({ 
    success: true, 
    message: '로그인 성공',
    user: { username, name: user.name, email: user.email }
  })
})

// 관리자 회원가입
app.post('/api/admin/register', async (c) => {
  const { DB } = c.env
  const { username, password, name, email } = await c.req.json()
  
  // 유효성 검사
  if (!username || !password || !name) {
    return c.json({ error: '필수 항목을 모두 입력해주세요' }, 400)
  }
  
  if (username.length < 4 || username.length > 20) {
    return c.json({ error: '아이디는 4-20자여야 합니다' }, 400)
  }
  
  if (password.length < 8) {
    return c.json({ error: '비밀번호는 최소 8자 이상이어야 합니다' }, 400)
  }
  
  // 아이디 중복 확인
  const existingUser = await DB.prepare(`
    SELECT id FROM admin_users WHERE username = ?
  `).bind(username).first()
  
  if (existingUser) {
    return c.json({ error: '이미 사용 중인 아이디입니다' }, 409)
  }
  
  // 사용자 생성 (비밀번호는 평문 저장, 실제로는 bcrypt 해싱 권장)
  const result = await DB.prepare(`
    INSERT INTO admin_users (username, password, name, email, role)
    VALUES (?, ?, ?, ?, 'admin')
  `).bind(username, password, name, email || '').run()
  
  return c.json({ 
    success: true,
    message: '회원가입이 완료되었습니다',
    user: { id: result.meta.last_row_id, username, name }
  }, 201)
})

// ============================================
// 계약서 공유 API (카카오톡 전송용)
// ============================================

// 계약서 공유 링크 생성
app.post('/api/contract-share/create', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // 고유 토큰 생성 (UUID 대신 간단한 랜덤 문자열)
  const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  
  // 만료 시간: 72시간 후
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 72)
  
  const result = await DB.prepare(`
    INSERT INTO contract_shares (
      share_token, contract_type, contract_data, 
      customer_name, customer_phone, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    shareToken,
    data.contract_type,
    JSON.stringify(data.contract_data),
    data.customer_name,
    data.customer_phone,
    expiresAt.toISOString()
  ).run()
  
  // 공유 URL 생성
  const shareUrl = `/contract-sign?token=${shareToken}`
  
  return c.json({ 
    success: true,
    share_token: shareToken,
    share_url: shareUrl,
    expires_at: expiresAt
  }, 201)
})

// 계약서 공유 정보 조회
app.get('/api/contract-share/:token', async (c) => {
  const { DB } = c.env
  const token = c.req.param('token')
  
  const result = await DB.prepare(`
    SELECT * FROM contract_shares WHERE share_token = ?
  `).bind(token).first()
  
  if (!result) {
    return c.json({ error: '계약서를 찾을 수 없습니다' }, 404)
  }
  
  // 만료 확인
  const now = new Date()
  const expiresAt = new Date(result.expires_at as string)
  
  if (now > expiresAt) {
    await DB.prepare(`
      UPDATE contract_shares SET status = 'expired' WHERE share_token = ?
    `).bind(token).run()
    
    return c.json({ ...result, status: 'expired' })
  }
  
  return c.json(result)
})

// 계약서 서명 제출
app.post('/api/contract-share/:token/sign', async (c) => {
  const { DB } = c.env
  const token = c.req.param('token')
  const { signature_data, id_card_photo } = await c.req.json()
  
  const now = new Date().toISOString()
  
  // 공유 계약서 조회
  const shareData = await DB.prepare(`
    SELECT * FROM contract_shares WHERE share_token = ? AND status = 'pending'
  `).bind(token).first() as any
  
  if (!shareData) {
    return c.json({ error: '유효하지 않은 계약서입니다' }, 404)
  }
  
  // 계약 데이터 파싱
  const contractInfo = JSON.parse(shareData.contract_data)
  
  try {
    // 1. 고객 정보 저장 (이미 있으면 조회)
    let customerId = null
    const existingCustomer = await DB.prepare(`
      SELECT id FROM customers WHERE phone = ?
    `).bind(shareData.customer_phone).first() as any
    
    if (existingCustomer) {
      customerId = existingCustomer.id
      // 고객 정보 업데이트
      await DB.prepare(`
        UPDATE customers 
        SET name = ?, resident_number = ?, address = ?, license_type = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        shareData.customer_name,
        contractInfo.resident_number || '',
        contractInfo.address || '',
        contractInfo.license_type || '',
        now,
        customerId
      ).run()
    } else {
      // 신규 고객 생성
      const customerResult = await DB.prepare(`
        INSERT INTO customers (name, resident_number, phone, address, license_type)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        shareData.customer_name,
        contractInfo.resident_number || '',
        shareData.customer_phone,
        contractInfo.address || '',
        contractInfo.license_type || ''
      ).run()
      customerId = customerResult.meta.last_row_id
    }
    
    // 2. 계약 타입에 따라 실제 계약서 생성
    if (shareData.contract_type === 'individual') {
      // 개인 계약서 생성
      // 계약번호 생성
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const countResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM contracts 
        WHERE contract_number LIKE ?
      `).bind(`${today}-%`).first() as any
      const sequence = String((countResult?.count || 0) + 1).padStart(4, '0')
      const contractNumber = `${today}-${sequence}`
      
      await DB.prepare(`
        INSERT INTO contracts (
          contract_number, contract_type, motorcycle_id, customer_id,
          start_date, end_date, monthly_fee, deposit, special_terms,
          signature_data, id_card_photo, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).bind(
        contractNumber,
        contractInfo.contract_type || 'lease',
        contractInfo.motorcycle_id,
        customerId,
        contractInfo.start_date,
        contractInfo.end_date,
        contractInfo.monthly_fee || 0,
        contractInfo.deposit || 0,
        contractInfo.special_terms || '',
        signature_data,
        id_card_photo
      ).run()
      
      // 오토바이 상태 업데이트
      await DB.prepare(`
        UPDATE motorcycles SET status = 'rented' WHERE id = ?
      `).bind(contractInfo.motorcycle_id).run()
      
    } else if (shareData.contract_type === 'business') {
      // 업체 계약서 생성
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const countResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM business_contracts 
        WHERE contract_number LIKE ?
      `).bind(`B-${today}-%`).first() as any
      const sequence = String((countResult?.count || 0) + 1).padStart(4, '0')
      const contractNumber = `B-${today}-${sequence}`
      
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
      `).bind(
        contractNumber,
        contractInfo.motorcycle_id,
        contractInfo.company_name || '',
        contractInfo.business_number || '',
        contractInfo.representative || '',
        contractInfo.business_type || '',
        contractInfo.business_category || '',
        contractInfo.business_phone || '',
        contractInfo.business_address || '',
        contractInfo.representative_resident_number || '',
        contractInfo.representative_phone || '',
        contractInfo.representative_address || '',
        contractInfo.contract_start_date,
        contractInfo.contract_end_date,
        contractInfo.insurance_start_date,
        contractInfo.insurance_end_date,
        contractInfo.driving_range || '',
        contractInfo.daily_amount || 0,
        contractInfo.deposit || 0,
        contractInfo.special_terms || '',
        contractInfo.business_license_photo || '',
        id_card_photo
      ).run()
      
      // 오토바이 상태 업데이트
      await DB.prepare(`
        UPDATE motorcycles SET status = 'rented' WHERE id = ?
      `).bind(contractInfo.motorcycle_id).run()
      
    } else if (shareData.contract_type === 'loan') {
      // 차용증 생성
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const countResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM loan_contracts 
        WHERE loan_number LIKE ?
      `).bind(`L-${today}-%`).first() as any
      const sequence = String((countResult?.count || 0) + 1).padStart(4, '0')
      const loanNumber = `L-${today}-${sequence}`
      
      await DB.prepare(`
        INSERT INTO loan_contracts (
          loan_number, motorcycle_id, borrower_name, borrower_resident_number,
          borrower_phone, borrower_address,
          loan_amount, daily_deduction, loan_date, loan_period,
          repayment_date, borrower_signature, borrower_id_card, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).bind(
        loanNumber,
        contractInfo.motorcycle_id,
        shareData.customer_name,
        contractInfo.borrower_resident_number || '',
        shareData.customer_phone,
        contractInfo.borrower_address || '',
        contractInfo.loan_amount || 0,
        contractInfo.daily_deduction || 0,
        contractInfo.loan_date,
        contractInfo.loan_period || 0,
        contractInfo.repayment_date || '',
        signature_data,
        id_card_photo
      ).run()
    }
    
    // 3. 공유 계약서 상태 업데이트
    await DB.prepare(`
      UPDATE contract_shares 
      SET signature_data = ?, id_card_photo = ?, status = 'signed', signed_at = ?, updated_at = ?
      WHERE share_token = ?
    `).bind(signature_data, id_card_photo, now, now, token).run()
    
    return c.json({ 
      success: true, 
      message: '서명이 완료되었습니다. 계약서가 자동으로 등록되었습니다.' 
    })
    
  } catch (error) {
    console.error('Contract creation error:', error)
    return c.json({ error: '계약서 생성 중 오류가 발생했습니다' }, 500)
  }
})

// 계약서 공유 목록 조회 (관리자용)
app.get('/api/contract-shares', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM contract_shares ORDER BY created_at DESC
  `).all()
  
  return c.json(result.results)
})

// SMS 전송 API (계약서 공유 링크 전송)
app.post('/api/send-sms', async (c) => {
  const { phone, share_url, customer_name, contract_type } = await c.req.json()
  
  const message = `[오토바이 계약서]\n\n${customer_name}님, 계약서를 검토하시고 서명해주세요.\n\n링크: ${share_url}\n\n* 72시간 이내 서명 부탁드립니다.`
  
  // CoolSMS API 연동 예시 (환경변수에 API 키가 있을 때만 실제 전송)
  if (c.env.COOLSMS_API_KEY && c.env.COOLSMS_API_SECRET && c.env.COOLSMS_SENDER) {
    try {
      // CoolSMS API v4 사용
      const apiKey = c.env.COOLSMS_API_KEY
      const apiSecret = c.env.COOLSMS_API_SECRET
      const sender = c.env.COOLSMS_SENDER
      
      // 인증 토큰 생성 (HMAC)
      const timestamp = Date.now().toString()
      const salt = Math.random().toString(36).substring(2, 15)
      
      // CoolSMS API 호출
      const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
        method: 'POST',
        headers: {
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            to: phone.replace(/-/g, ''), // 하이픈 제거
            from: sender.replace(/-/g, ''),
            text: message
          }
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        console.log('SMS 전송 성공:', result)
        return c.json({ 
          success: true, 
          message: 'SMS가 전송되었습니다',
          phone,
          messageLength: message.length
        })
      } else {
        console.error('SMS 전송 실패:', result)
        return c.json({ 
          success: false, 
          message: 'SMS 전송에 실패했습니다',
          error: result
        }, 500)
      }
    } catch (error) {
      console.error('SMS API 오류:', error)
      return c.json({ 
        success: false, 
        message: 'SMS API 호출 중 오류가 발생했습니다'
      }, 500)
    }
  }
  
  // API 키가 없으면 시뮬레이션 모드
  console.log('=== SMS 전송 시뮬레이션 ===')
  console.log('수신번호:', phone)
  console.log('메시지:', message)
  console.log('=========================')
  console.log('실제 SMS를 보내려면 CoolSMS API 키를 환경변수에 설정하세요.')
  console.log('환경변수: COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER')
  
  return c.json({ 
    success: true, 
    message: 'SMS가 전송되었습니다 (시뮬레이션)',
    simulation: true,
    phone,
    messageLength: message.length,
    note: '실제 SMS를 보내려면 CoolSMS API 키를 설정하세요'
  })
})

// 차용증 상세 조회
app.get('/api/loan-contracts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare('SELECT * FROM loan_contracts WHERE id = ?').bind(id).first()
  
  if (!result) {
    return c.json({ error: '차용증을 찾을 수 없습니다' }, 404)
  }
  
  return c.json(result)
})

// 차용증 생성
app.post('/api/loan-contracts', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // 차용증 번호 생성 (LOAN-YYYYMMDD-XXXX 형식)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const countResult = await DB.prepare(
    `SELECT COUNT(*) as count FROM loan_contracts WHERE loan_number LIKE ?`
  ).bind(`LOAN-${today}-%`).first()
  
  const count = (countResult as any).count + 1
  const loanNumber = `LOAN-${today}-${String(count).padStart(4, '0')}`
  
  // 남은 차용금은 처음에 차용금액과 동일
  const remainingAmount = data.loan_amount
  
  const result = await DB.prepare(`
    INSERT INTO loan_contracts (
      loan_number, borrower_name, borrower_resident_number, borrower_phone, borrower_address,
      loan_amount, loan_date, loan_period, repayment_date, interest_rate, daily_deduction,
      remaining_amount, total_deducted,
      account_number, special_terms, borrower_signature, lender_signature, borrower_id_card_photo, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    loanNumber,
    data.borrower_name,
    data.borrower_resident_number,
    data.borrower_phone,
    data.borrower_address,
    data.loan_amount,
    data.loan_date,
    data.loan_period,
    data.repayment_date,
    data.interest_rate || 0,
    data.daily_deduction,
    remainingAmount,
    0, // total_deducted
    data.account_number || '',
    data.special_terms || '',
    data.borrower_signature || '',
    data.lender_signature || '',
    data.borrower_id_card_photo || '',
    'active'
  ).run()
  
  return c.json({ id: result.meta.last_row_id, loan_number: loanNumber, ...data }, 201)
})

// 차용증 상태 변경
app.patch('/api/loan-contracts/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  await DB.prepare('UPDATE loan_contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, id).run()
  
  return c.json({ message: '상태가 변경되었습니다' })
})

// 일차감 기록 추가
app.post('/api/loan-contracts/:id/deduction', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { work_amount, deduction_amount, notes } = await c.req.json()
  
  // 현재 차용증 정보 조회
  const loan = await DB.prepare('SELECT * FROM loan_contracts WHERE id = ?').bind(id).first() as any
  
  if (!loan) {
    return c.json({ error: '차용증을 찾을 수 없습니다' }, 404)
  }
  
  // 남은 차용금 계산
  const newRemainingAmount = Math.max(0, loan.remaining_amount - deduction_amount)
  const newTotalDeducted = loan.total_deducted + deduction_amount
  
  // 차감 기록 추가
  await DB.prepare(`
    INSERT INTO loan_deductions (loan_id, deduction_date, work_amount, deduction_amount, remaining_amount, notes)
    VALUES (?, DATE('now'), ?, ?, ?, ?)
  `).bind(id, work_amount, deduction_amount, newRemainingAmount, notes || '').run()
  
  // 차용증 상태 업데이트
  const newStatus = newRemainingAmount === 0 ? 'completed' : loan.status
  await DB.prepare(`
    UPDATE loan_contracts 
    SET remaining_amount = ?, total_deducted = ?, last_deduction_date = DATE('now'), status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(newRemainingAmount, newTotalDeducted, newStatus, id).run()
  
  return c.json({ 
    message: '차감이 완료되었습니다',
    remaining_amount: newRemainingAmount,
    total_deducted: newTotalDeducted,
    status: newStatus
  })
})

// 차감 기록 조회
app.get('/api/loan-contracts/:id/deductions', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM loan_deductions WHERE loan_id = ? ORDER BY deduction_date DESC
  `).bind(id).all()
  
  return c.json(result.results)
})

// ============================================
// 프론트엔드 페이지 라우트
// ============================================

// 로그인 페이지
app.get('/login', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>로그인</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/login.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 오토바이 관리 페이지
app.get('/motorcycles', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>오토바이 관리</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/motorcycles.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 계약서 작성 페이지
app.get('/contract/new', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>계약서 작성</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/contract-new.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 업체 계약서 작성 페이지
app.get('/business-contract/new', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>업체 계약서 작성</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/business-contract-new.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})


// 계약서 목록 페이지
app.get('/contracts', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>계약서 목록</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/contracts.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 차용증 작성 페이지
app.get('/loan/new', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>차용증 작성</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/loan-new.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 차용증 목록 페이지
app.get('/loans', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>차용증 목록</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/loans.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 관리자 설정 페이지
app.get('/settings', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>관리자 설정</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/settings.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// ============================================
// 메인 페이지
// ============================================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>오토바이 리스/렌트 전자계약 시스템</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- 헤더 -->
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-6 flex items-center justify-between">
                    <h1 class="text-3xl font-bold">
                        <i class="fas fa-motorcycle mr-3"></i>
                        오토바이 리스/렌트 전자계약 시스템
                    </h1>
                    
                    <!-- 로그인 상태 표시 -->
                    <div id="loginStatus" class="flex items-center gap-4">
                        <!-- 로그아웃 상태 -->
                        <div id="loggedOut" class="flex gap-2">
                            <a href="/login" class="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition font-semibold">
                                <i class="fas fa-sign-in-alt mr-2"></i>로그인
                            </a>
                            <a href="/register" class="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition font-semibold">
                                <i class="fas fa-user-plus mr-2"></i>회원가입
                            </a>
                        </div>
                        
                        <!-- 로그인 상태 -->
                        <div id="loggedIn" class="hidden flex items-center gap-4">
                            <div class="flex items-center bg-blue-700 px-4 py-2 rounded-lg">
                                <i class="fas fa-user-circle text-2xl mr-2"></i>
                                <div>
                                    <p class="text-sm font-semibold" id="userName"></p>
                                    <p class="text-xs opacity-80" id="userEmail"></p>
                                </div>
                            </div>
                            <button onclick="logout()" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold">
                                <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- 메인 컨텐츠 -->
            <main class="container mx-auto px-4 py-8">
                <!-- 관리자 설정 링크 -->
                <div class="mb-6 text-right">
                    <a href="/settings" class="inline-flex items-center bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
                        <i class="fas fa-cog mr-2"></i>관리자 설정
                    </a>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- 오토바이 관리 -->
                    <a href="/motorcycles" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                        <div class="flex items-center mb-4">
                            <div class="bg-blue-100 p-3 rounded-full">
                                <i class="fas fa-motorcycle text-blue-600 text-2xl"></i>
                            </div>
                            <h2 class="text-xl font-bold ml-4">오토바이 관리</h2>
                        </div>
                        <p class="text-gray-600">오토바이 등록 및 관리</p>
                    </a>

                    <!-- 개인 계약서 작성 -->
                    <a href="/contract/new" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                        <div class="flex items-center mb-4">
                            <div class="bg-green-100 p-3 rounded-full">
                                <i class="fas fa-file-signature text-green-600 text-2xl"></i>
                            </div>
                            <h2 class="text-xl font-bold ml-4">개인 계약서</h2>
                        </div>
                        <p class="text-gray-600">개인 리스/렌트 계약서</p>
                    </a>

                    <!-- 업체 계약서 작성 -->
                    <a href="/business-contract/new" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                        <div class="flex items-center mb-4">
                            <div class="bg-purple-100 p-3 rounded-full">
                                <i class="fas fa-building text-purple-600 text-2xl"></i>
                            </div>
                            <h2 class="text-xl font-bold ml-4">업체 계약서</h2>
                        </div>
                        <p class="text-gray-600">업체 리스/렌트 계약서</p>
                    </a>

                    <!-- 계약서 목록 -->
                    <a href="/contracts" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                        <div class="flex items-center mb-4">
                            <div class="bg-indigo-100 p-3 rounded-full">
                                <i class="fas fa-list text-indigo-600 text-2xl"></i>
                            </div>
                            <h2 class="text-xl font-bold ml-4">계약서 목록</h2>
                        </div>
                        <p class="text-gray-600">계약 내역 조회 및 관리</p>
                    </a>

                    <!-- 차용증 관리 -->
                    <a href="/loans" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                        <div class="flex items-center mb-4">
                            <div class="bg-orange-100 p-3 rounded-full">
                                <i class="fas fa-money-bill-wave text-orange-600 text-2xl"></i>
                            </div>
                            <h2 class="text-xl font-bold ml-4">차용증 관리</h2>
                        </div>
                        <p class="text-gray-600">차용증 작성 및 조회</p>
                    </a>
                </div>

                <!-- 시스템 안내 -->
                <div class="mt-8 bg-white rounded-lg shadow-md p-6">
                    <h3 class="text-lg font-bold mb-4">
                        <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                        시스템 안내
                    </h3>
                    <ul class="space-y-2 text-gray-700">
                        <li><i class="fas fa-check text-green-600 mr-2"></i>오토바이 정보를 등록하고 관리할 수 있습니다</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>리스/렌트 계약서를 전자로 작성할 수 있습니다</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>전자서명을 통해 계약을 체결할 수 있습니다</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>계약 내역을 조회하고 관리할 수 있습니다</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>차용증을 작성하고 관리할 수 있습니다</li>
                    </ul>
                </div>
            </main>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 로그인 상태 확인 및 표시
            async function checkLoginStatus() {
                const sessionId = localStorage.getItem('sessionId');
                const user = localStorage.getItem('user');
                const loggedIn = document.getElementById('loggedIn');
                const loggedOut = document.getElementById('loggedOut');
                
                if (sessionId && user) {
                    try {
                        // 세션 유효성 확인
                        await axios.get('/api/auth/check', {
                            headers: { 'X-Session-ID': sessionId }
                        });
                        
                        const userData = JSON.parse(user);
                        
                        // 로그인 상태 표시
                        document.getElementById('userName').textContent = userData.name || userData.username;
                        document.getElementById('userEmail').textContent = userData.username;
                        
                        loggedIn.classList.remove('hidden');
                        loggedIn.classList.add('flex');
                        loggedOut.classList.add('hidden');
                    } catch (e) {
                        // 세션 만료 시 로그아웃 처리
                        localStorage.removeItem('sessionId');
                        localStorage.removeItem('user');
                        showLoggedOut();
                    }
                } else {
                    showLoggedOut();
                }
            }
            
            // 로그아웃 상태 표시
            function showLoggedOut() {
                const loggedIn = document.getElementById('loggedIn');
                const loggedOut = document.getElementById('loggedOut');
                
                loggedIn.classList.add('hidden');
                loggedIn.classList.remove('flex');
                loggedOut.classList.remove('hidden');
                loggedOut.classList.add('flex');
            }
            
            // 로그아웃
            async function logout() {
                if (confirm('로그아웃 하시겠습니까?')) {
                    const sessionId = localStorage.getItem('sessionId');
                    
                    if (sessionId) {
                        try {
                            await axios.post('/api/auth/logout', {}, {
                                headers: { 'X-Session-ID': sessionId }
                            });
                        } catch (e) {
                            console.error('Logout error:', e);
                        }
                    }
                    
                    localStorage.removeItem('sessionId');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                }
            }
            
            // 페이지 로드 시 로그인 상태 확인
            window.addEventListener('DOMContentLoaded', checkLoginStatus);
        </script>
    </body>
    </html>
  `)
})

// 관리자 회원가입 페이지
app.get('/register', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>관리자 회원가입</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
<iframe src="/static/register.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 관리자 로그인 페이지
app.get('/login', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>관리자 로그인</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
<iframe src="/static/login.html" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 계약서 서명 페이지
app.get('/contract-sign', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>계약서 서명</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
<iframe src="/static/contract-sign.html${c.req.url.includes('?') ? c.req.url.substring(c.req.url.indexOf('?')) : ''}" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

export default app
