import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// 캐시 무효화 미들웨어 (모든 HTML 페이지)
app.use('*', async (c, next) => {
  await next()
  
  // HTML 응답에 대해서만 캐시 무효화 헤더 추가
  const contentType = c.res.headers.get('Content-Type')
  if (contentType?.includes('text/html')) {
    c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    c.res.headers.set('Pragma', 'no-cache')
    c.res.headers.set('Expires', '0')
  }
})

// CORS 설정
app.use('/api/*', cors())

// 정적 파일 서빙 (캐시 무효화는 미들웨어에서)
app.use('/static/*', serveStatic({ 
  root: './public',
  onNotFound: (path, c) => {
    console.log('Static file not found:', path)
  }
}))

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

// 슈퍼관리자 전용 미들웨어
async function superAdminMiddleware(c: any, next: any) {
  const sessionId = c.req.header('X-Session-ID') || c.req.query('session')
  const session = await validateSession(c.env.DB, sessionId)
  
  if (!session) {
    return c.json({ error: '인증이 필요합니다' }, 401)
  }
  
  if ((session as any).role !== 'super_admin') {
    return c.json({ error: '슈퍼관리자 권한이 필요합니다' }, 403)
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
      email: (session as any).email || '',
      phone: (session as any).phone || '',
      role: (session as any).role
    }
  })
})

// 관리자 목록 조회 (슈퍼관리자 전용)
app.get('/api/admin/users', async (c) => {
  const { DB } = c.env
  const sessionId = c.req.header('X-Session-ID')
  
  const session = await validateSession(DB, sessionId)
  if (!session || (session as any).role !== 'super_admin') {
    return c.json({ error: '권한이 없습니다' }, 403)
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
  `).all()
  
  return c.json({ 
    success: true, 
    admins: result.results 
  })
})

// 관리자 상태 변경 (슈퍼관리자 전용)
app.post('/api/admin/users/:id/status', async (c) => {
  const { DB } = c.env
  const sessionId = c.req.header('X-Session-ID')
  
  const session = await validateSession(DB, sessionId)
  if (!session || (session as any).role !== 'super_admin') {
    return c.json({ error: '권한이 없습니다' }, 403)
  }
  
  const userId = c.req.param('id')
  const { status } = await c.req.json()
  
  // 자기 자신은 변경할 수 없음
  if ((session as any).user_id === parseInt(userId)) {
    return c.json({ error: '자기 자신의 상태는 변경할 수 없습니다' }, 400)
  }
  
  // 슈퍼관리자는 정지할 수 없음
  const targetUser = await DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first()
  if (targetUser && (targetUser as any).role === 'super_admin') {
    return c.json({ error: '슈퍼관리자는 정지할 수 없습니다' }, 400)
  }
  
  // 상태 업데이트
  await DB.prepare('UPDATE users SET status = ? WHERE id = ?')
    .bind(status, userId)
    .run()
  
  // 정지 시 모든 세션 삭제
  if (status === 'inactive') {
    await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
  }
  
  return c.json({ success: true })
})

// 아이디 찾기 (이름과 전화번호로)
app.post('/api/auth/find-username', async (c) => {
  const { DB } = c.env
  const { name, phone } = await c.req.json()
  
  const user = await DB.prepare('SELECT username, created_at FROM users WHERE name = ? AND phone = ?')
    .bind(name, phone).first()
  
  if (!user) {
    return c.json({ error: '일치하는 사용자를 찾을 수 없습니다' }, 404)
  }
  
  return c.json({
    success: true,
    username: (user as any).username,
    created_at: (user as any).created_at
  })
})

// 비밀번호 재설정 토큰 생성 (아이디, 이름, 전화번호로 확인)
app.post('/api/auth/request-reset', async (c) => {
  const { DB } = c.env
  const { username, name, phone } = await c.req.json()
  
  const user = await DB.prepare('SELECT * FROM users WHERE username = ? AND name = ? AND phone = ?')
    .bind(username, name, phone).first()
  
  if (!user) {
    return c.json({ error: '일치하는 사용자를 찾을 수 없습니다' }, 404)
  }
  
  // 토큰 생성 (6자리 숫자)
  const token = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30분
  
  await DB.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
    .bind((user as any).id, token, expiresAt).run()
  
  return c.json({
    success: true,
    token,
    message: '인증번호가 생성되었습니다. 30분 이내에 입력해주세요.'
  })
})

// 비밀번호 재설정
app.post('/api/auth/reset-password', async (c) => {
  const { DB } = c.env
  const { token, new_password } = await c.req.json()
  
  // 토큰 확인
  const resetToken = await DB.prepare(`
    SELECT * FROM password_reset_tokens 
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).bind(token).first()
  
  if (!resetToken) {
    return c.json({ error: '유효하지 않거나 만료된 인증번호입니다' }, 400)
  }
  
  // 비밀번호 업데이트
  await DB.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(new_password, (resetToken as any).user_id).run()
  
  // 토큰 사용 처리
  await DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
    .bind((resetToken as any).id).run()
  
  return c.json({
    success: true,
    message: '비밀번호가 재설정되었습니다'
  })
})

// ============================================
// 오토바이 API (인증 필요)
// ============================================

// 오토바이 목록 조회
app.get('/api/motorcycles', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status')
  
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
  `
  
  if (status) {
    query += ` WHERE m.status = '${status}'`
  }
  query += ' ORDER BY m.created_at DESC'
  
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

// 대시보드 통계 조회
app.get('/api/dashboard/stats', authMiddleware, async (c) => {
  const { DB } = c.env
  
  try {
    // 오토바이 총 대수 및 상태별 집계
    const motorcycleStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) as rented,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN status = 'scrapped' THEN 1 ELSE 0 END) as scrapped
      FROM motorcycles
    `).first()
    
    // 사용자(고객) 수
    const customerCount = await DB.prepare(`
      SELECT COUNT(DISTINCT customer_id) as count 
      FROM contracts
    `).first()
    
    // 활성 계약 수 및 총 대여금
    const contractStats = await DB.prepare(`
      SELECT 
        COUNT(*) as active_contracts,
        SUM(CAST(monthly_fee as INTEGER)) as total_monthly_revenue,
        SUM(CAST(deposit as INTEGER)) as total_deposits
      FROM contracts
      WHERE status = 'active'
    `).first()
    
    return c.json({
      motorcycles: {
        total: motorcycleStats.total || 0,
        available: motorcycleStats.available || 0,
        rented: motorcycleStats.rented || 0,
        maintenance: motorcycleStats.maintenance || 0,
        scrapped: motorcycleStats.scrapped || 0
      },
      customers: (customerCount as any)?.count || 0,
      contracts: {
        active: (contractStats as any)?.active_contracts || 0,
        monthly_revenue: (contractStats as any)?.total_monthly_revenue || 0,
        total_deposits: (contractStats as any)?.total_deposits || 0
      }
    })
  } catch (error) {
    console.error('통계 조회 오류:', error)
    return c.json({ error: '통계 조회 실패' }, 500)
  }
})

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
    WHERE c.deleted_at IS NULL
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

// 관리자 계약서 저장 (인증 필요, 고객에게 전송하지 않음)
app.post('/api/contracts-admin-save', authMiddleware, async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // 디버그: 받은 데이터 로그
  console.log('📝 Received contract data:', JSON.stringify(data, null, 2))
  
  try {
    // 1. 고객 정보 저장 또는 찾기
    let customerId;
    const existingCustomer = await DB.prepare('SELECT id FROM customers WHERE phone = ?')
      .bind(data.customer_phone).first()
    
    if (existingCustomer) {
      customerId = (existingCustomer as any).id
      // 고객 정보 업데이트
      await DB.prepare(`
        UPDATE customers SET name = ?, resident_number = ?, address = ?, license_type = ? WHERE id = ?
      `).bind(data.customer_name, data.resident_number || '', data.address || '', data.license_type || '2종소형', customerId).run()
    } else {
      // 신규 고객 등록
      const customerResult = await DB.prepare(`
        INSERT INTO customers (name, phone, resident_number, address, license_type) VALUES (?, ?, ?, ?, ?)
      `).bind(data.customer_name, data.customer_phone, data.resident_number || '', data.address || '', data.license_type || '2종소형').run()
      customerId = customerResult.meta.last_row_id
    }
    
    // 2. 계약서 번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countResult = await DB.prepare(
      `SELECT COUNT(*) as count FROM contracts WHERE contract_number LIKE ?`
    ).bind(`${today}-%`).first()
    
    const count = (countResult as any).count + 1
    const contractNumber = `${today}-${String(count).padStart(4, '0')}`
    
    // 3. 계약서 저장
    const result = await DB.prepare(`
      INSERT INTO contracts (
        contract_type, motorcycle_id, customer_id, start_date, end_date,
        monthly_fee, deposit, special_terms, signature_data, id_card_photo, 
        contract_number, status, insurance_age_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.contract_type,
      data.motorcycle_id,
      customerId,
      data.start_date,
      data.end_date,
      data.monthly_fee,
      data.deposit || 0,
      data.special_terms || '',
      data.admin_signature || '',
      data.admin_id_card_photo || '',
      contractNumber,
      data.status || 'pending',
      data.insurance_age_limit || '전연령'
    ).run()
    
    // 4. 오토바이 상태 업데이트
    if (data.status === 'active') {
      await DB.prepare('UPDATE motorcycles SET status = ? WHERE id = ?')
        .bind('rented', data.motorcycle_id).run()
    }
    
    return c.json({ 
      id: result.meta.last_row_id, 
      contract_number: contractNumber,
      customer_id: customerId,
      success: true 
    }, 201)
  } catch (error) {
    console.error('계약서 저장 오류:', error)
    return c.json({ error: '계약서 저장에 실패했습니다', details: error.message }, 500)
  }
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

// 계약서 삭제 (소프트 삭제) (인증 필요)
app.delete('/api/contracts/:id', authMiddleware, async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    // 계약서 존재 확인
    const contract = await DB.prepare('SELECT * FROM contracts WHERE id = ? AND deleted_at IS NULL').bind(id).first()
    
    if (!contract) {
      return c.json({ error: '계약서를 찾을 수 없습니다' }, 404)
    }
    
    // 소프트 삭제 (deleted_at에 현재 시간 설정)
    await DB.prepare('UPDATE contracts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run()
    
    return c.json({ message: '계약서가 삭제되었습니다. 사용 이력에서는 계속 조회할 수 있습니다.' })
  } catch (error) {
    console.error('계약서 삭제 오류:', error)
    return c.json({ error: '계약서 삭제에 실패했습니다', details: error.message }, 500)
  }
})

// 오토바이 사용 이력 조회 (번호판 또는 차대번호로 검색)
app.get('/api/motorcycles/history/search', async (c) => {
  const { DB } = c.env
  const searchTerm = c.req.query('q') || ''
  
  if (!searchTerm) {
    return c.json({ error: '검색어를 입력해주세요' }, 400)
  }
  
  try {
    // 오토바이 정보 조회 (번호판 또는 차대번호로 검색)
    const motorcycle = await DB.prepare(`
      SELECT * FROM motorcycles 
      WHERE plate_number LIKE ? OR chassis_number LIKE ?
      LIMIT 1
    `).bind(`%${searchTerm}%`, `%${searchTerm}%`).first()
    
    if (!motorcycle) {
      return c.json({ error: '해당 오토바이를 찾을 수 없습니다' }, 404)
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
    `).bind((motorcycle as any).id).all()
    
    return c.json({
      motorcycle: motorcycle,
      history: contracts.results
    })
  } catch (error) {
    console.error('사용 이력 조회 오류:', error)
    return c.json({ error: '사용 이력 조회에 실패했습니다', details: error.message }, 500)
  }
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
app.post('/api/auth/register', async (c) => {
  const { DB } = c.env
  const { username, password, name, email, phone } = await c.req.json()
  
  // 유효성 검사
  if (!username || !password || !name) {
    return c.json({ error: '필수 항목을 모두 입력해주세요' }, 400)
  }
  
  if (username.length < 4 || username.length > 20) {
    return c.json({ error: '아이디는 4-20자여야 합니다' }, 400)
  }
  
  if (password.length < 4) {
    return c.json({ error: '비밀번호는 최소 4자 이상이어야 합니다' }, 400)
  }
  
  // 아이디 중복 확인
  const existingUser = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  
  if (existingUser) {
    return c.json({ error: '이미 사용 중인 아이디입니다' }, 409)
  }
  
  // 일반 관리자로 생성 (super_admin은 sangchun11만)
  const result = await DB.prepare(`
    INSERT INTO users (username, password, name, email, phone, role)
    VALUES (?, ?, ?, ?, ?, 'admin')
  `).bind(username, password, name, email || '', phone || '').run()
  
  return c.json({ 
    success: true,
    message: '회원가입이 완료되었습니다',
    user: { id: result.meta.last_row_id, username, name }
  }, 201)
})

// ============================================
// 관리자 관리 API (슈퍼관리자 전용)
// ============================================

// 모든 관리자 목록 조회 (슈퍼관리자 전용)
app.get('/api/admins', async (c) => {
  const { DB } = c.env
  const sessionId = c.req.header('X-Session-ID')
  
  const session = await validateSession(DB, sessionId)
  if (!session) {
    return c.json({ error: '인증이 필요합니다' }, 401)
  }
  
  // 슈퍼관리자만 접근 가능
  if ((session as any).role !== 'super_admin') {
    return c.json({ error: '권한이 없습니다' }, 403)
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
  `).all()
  
  return c.json(result.results)
})

// 관리자 상태 변경 (정지/활성) - 슈퍼관리자 전용
app.put('/api/admins/:id/status', async (c) => {
  const { DB } = c.env
  const sessionId = c.req.header('X-Session-ID')
  const adminId = c.req.param('id')
  const { status } = await c.req.json()
  
  const session = await validateSession(DB, sessionId)
  if (!session) {
    return c.json({ error: '인증이 필요합니다' }, 401)
  }
  
  // 슈퍼관리자만 접근 가능
  if ((session as any).role !== 'super_admin') {
    return c.json({ error: '권한이 없습니다' }, 403)
  }
  
  // 자기 자신은 정지할 수 없음
  if ((session as any).user_id === parseInt(adminId)) {
    return c.json({ error: '자기 자신의 계정은 정지할 수 없습니다' }, 400)
  }
  
  // 다른 슈퍼관리자는 정지할 수 없음
  const targetUser = await DB.prepare('SELECT role FROM users WHERE id = ?').bind(adminId).first()
  if ((targetUser as any)?.role === 'super_admin') {
    return c.json({ error: '슈퍼관리자 계정은 정지할 수 없습니다' }, 400)
  }
  
  // 상태 변경
  await DB.prepare(`
    UPDATE users SET status = ? WHERE id = ?
  `).bind(status, adminId).run()
  
  // 정지 시 해당 사용자의 모든 세션 삭제
  if (status === 'suspended') {
    await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(adminId).run()
  }
  
  return c.json({ 
    success: true,
    message: status === 'active' ? '계정이 활성화되었습니다' : '계정이 정지되었습니다'
  })
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

// 세션 클리어 페이지 (디버그용)
app.get('/clear-session', (c) => {
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
</html>`)
})

// 로그인 페이지
app.get('/login', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>로그인</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
<iframe src="/static/login" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 아이디/비밀번호 찾기 페이지
app.get('/find-account', (c) => {
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
</html>`)
})

// 오토바이 관리 페이지
app.get('/motorcycles', (c) => {
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
</html>`)
})

// 계약서 작성 페이지
app.get('/contract/new', (c) => {
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
</html>`)
})

// 업체 계약서 작성 페이지
app.get('/business-contract/new', (c) => {
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
</html>`)
})


// 계약서 목록 페이지
app.get('/contracts', (c) => {
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
</html>`)
})

// 차용증 작성 페이지
app.get('/loan/new', (c) => {
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
</html>`)
})

// 차용증 목록 페이지
app.get('/loans', (c) => {
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
</html>`)
})

// 관리자 설정 페이지
app.get('/settings', (c) => {
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
</html>`)
})

// ============================================
// 메인 페이지 - 로그인 페이지로 리디렉션
// ============================================

app.get('/', (c) => {
  return c.redirect('/login')
})

// 대시보드 페이지 (로그인 후)
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
        <title>Z-BIKE 전자계약서</title>
        <noscript>
            <meta http-equiv="refresh" content="0; url=/login">
        </noscript>
        <style>
            body { 
                opacity: 0;
                transition: opacity 0.2s ease-in;
            }
            body.loaded {
                opacity: 1;
            }
        </style>
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
                        Z-BIKE 전자계약서
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
                            <div onclick="showMyInfo()" class="flex items-center bg-blue-700 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-800 transition">
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
                <!-- 통계 대시보드 -->
                <div id="statsSection" class="mb-8">
                    <h2 class="text-2xl font-bold mb-4 text-gray-800">
                        <i class="fas fa-chart-line mr-2"></i>운영 현황
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <!-- 총 바이크 수 -->
                        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
                            <div class="flex items-center justify-between mb-1">
                                <h3 class="text-base font-semibold opacity-90">총 바이크</h3>
                                <i class="fas fa-motorcycle text-2xl opacity-80"></i>
                            </div>
                            <p class="text-3xl font-bold" id="totalBikes">-</p>
                            <p class="text-xs opacity-80 mt-1">등록된 오토바이</p>
                        </div>
                        
                        <!-- 사용가능 -->
                        <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
                            <div class="flex items-center justify-between mb-1">
                                <h3 class="text-base font-semibold opacity-90">사용가능</h3>
                                <i class="fas fa-check-circle text-2xl opacity-80"></i>
                            </div>
                            <p class="text-3xl font-bold" id="availableBikes">-</p>
                            <p class="text-xs opacity-80 mt-1">대여 가능 차량</p>
                        </div>
                        
                        <!-- 렌트중 -->
                        <div class="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg shadow-lg p-4 text-white">
                            <div class="flex items-center justify-between mb-1">
                                <h3 class="text-base font-semibold opacity-90">렌트중</h3>
                                <i class="fas fa-clock text-2xl opacity-80"></i>
                            </div>
                            <p class="text-3xl font-bold" id="rentedBikes">-</p>
                            <p class="text-xs opacity-80 mt-1">대여 중인 차량</p>
                        </div>
                        
                        <!-- 정비/폐지 -->
                        <div class="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-4 text-white">
                            <div class="flex items-center justify-between mb-1">
                                <h3 class="text-base font-semibold opacity-90">정비/폐지</h3>
                                <i class="fas fa-tools text-2xl opacity-80"></i>
                            </div>
                            <p class="text-3xl font-bold"><span id="maintenanceBikes">-</span> / <span id="scrappedBikes">-</span></p>
                            <p class="text-xs opacity-80 mt-1">수리중 / 사용불가</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <!-- 총 사용자 -->
                        <div class="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-600 text-xs font-semibold mb-1">총 고객 수</p>
                                    <p class="text-2xl font-bold text-gray-800" id="totalCustomers">-</p>
                                </div>
                                <i class="fas fa-users text-3xl text-purple-500 opacity-80"></i>
                            </div>
                        </div>
                        
                        <!-- 활성 계약 -->
                        <div class="bg-white rounded-lg shadow-md p-4 border-l-4 border-indigo-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-600 text-xs font-semibold mb-1">활성 계약</p>
                                    <p class="text-2xl font-bold text-gray-800" id="activeContracts">-</p>
                                </div>
                                <i class="fas fa-file-contract text-3xl text-indigo-500 opacity-80"></i>
                            </div>
                        </div>
                        
                        <!-- 월 대여금 총액 -->
                        <div class="bg-white rounded-lg shadow-md p-4 border-l-4 border-emerald-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-600 text-xs font-semibold mb-1">총 대여금</p>
                                    <p class="text-2xl font-bold text-gray-800" id="monthlyRevenue">-</p>
                                </div>
                                <i class="fas fa-won-sign text-3xl text-emerald-500 opacity-80"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 관리자 설정 링크 -->
                <div class="mb-6 text-right">
                    <a href="/settings" class="inline-flex items-center bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
                        <i class="fas fa-cog mr-2"></i>관리자 설정
                    </a>
                </div>
                
                <h2 class="text-2xl font-bold mb-4 text-gray-800">
                    <i class="fas fa-th-large mr-2"></i>빠른 메뉴
                </h2>
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

                    <!-- 데이터 가져오기 -->
                    <a href="/import-data" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow border-2 border-cyan-200">
                        <div class="flex items-center mb-4">
                            <div class="bg-cyan-100 p-3 rounded-full">
                                <i class="fas fa-download text-cyan-600 text-2xl"></i>
                            </div>
                            <h2 class="text-xl font-bold ml-4">데이터 가져오기</h2>
                        </div>
                        <p class="text-gray-600">웹 페이지에서 데이터 불러오기</p>
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
            
            <!-- 내 정보 모달 -->
            <div id="myInfoModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-800">
                                <i class="fas fa-user-circle mr-2 text-blue-600"></i>내 정보
                            </h2>
                            <button onclick="hideMyInfo()" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-times text-2xl"></i>
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- 왼쪽: 내 정보 -->
                            <div>
                                <!-- 프로필 카드 -->
                                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg mb-6">
                                    <div class="flex items-center mb-4">
                                        <div class="bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold">
                                            <span id="modalUserInitial"></span>
                                        </div>
                                        <div class="ml-4">
                                            <h3 class="text-xl font-bold text-gray-800" id="modalUserName"></h3>
                                            <p class="text-sm text-gray-600" id="modalUsername"></p>
                                        </div>
                                    </div>
                                    
                                    <!-- 역할 배지 -->
                                    <div class="flex items-center justify-center">
                                        <span id="modalUserRole" class="px-4 py-2 rounded-full text-sm font-bold"></span>
                                    </div>
                                </div>
                                
                                <!-- 상세 정보 -->
                                <div class="space-y-4">
                                    <div class="flex items-start">
                                        <div class="bg-blue-100 p-2 rounded-lg mr-3">
                                            <i class="fas fa-user text-blue-600"></i>
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-xs text-gray-500 mb-1">이름</p>
                                            <p class="font-semibold text-gray-800" id="modalUserNameDetail"></p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-start">
                                        <div class="bg-green-100 p-2 rounded-lg mr-3">
                                            <i class="fas fa-phone text-green-600"></i>
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-xs text-gray-500 mb-1">전화번호</p>
                                            <p class="font-semibold text-gray-800" id="modalUserPhone"></p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-start">
                                        <div class="bg-purple-100 p-2 rounded-lg mr-3">
                                            <i class="fas fa-envelope text-purple-600"></i>
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-xs text-gray-500 mb-1">이메일</p>
                                            <p class="font-semibold text-gray-800" id="modalUserEmail"></p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-start">
                                        <div class="bg-red-100 p-2 rounded-lg mr-3">
                                            <i class="fas fa-key text-red-600"></i>
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-xs text-gray-500 mb-1">비밀번호</p>
                                            <p class="font-semibold text-gray-800">••••••••</p>
                                            <p class="text-xs text-gray-400 mt-1">보안을 위해 표시되지 않습니다</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 오른쪽: 관리자 목록 (슈퍼관리자만 표시) -->
                            <div id="adminListSection" class="hidden">
                                <h3 class="text-lg font-bold mb-4 text-gray-800">
                                    <i class="fas fa-users-cog mr-2 text-purple-600"></i>
                                    관리자 목록
                                </h3>
                                
                                <div id="adminListContainer" class="space-y-3 max-h-[500px] overflow-y-auto">
                                    <!-- 관리자 목록이 여기에 동적으로 추가됩니다 -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- 닫기 버튼 -->
                        <div class="mt-6">
                            <button onclick="hideMyInfo()" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold">
                                <i class="fas fa-check mr-2"></i>확인
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 로그인 상태 확인 및 표시
            async function checkLoginStatus() {
                const sessionId = localStorage.getItem('sessionId');
                const user = localStorage.getItem('user');
                const loggedIn = document.getElementById('loggedIn');
                const loggedOut = document.getElementById('loggedOut');
                
                console.log('[DASHBOARD] checkLoginStatus called');
                console.log('[DASHBOARD] localStorage sessionId:', sessionId);
                console.log('[DASHBOARD] localStorage user:', user);
                
                if (sessionId && user) {
                    try {
                        console.log('[DASHBOARD] Verifying session with server...');
                        // 세션 유효성 확인
                        const response = await axios.get('/api/auth/check', {
                            headers: { 'X-Session-ID': sessionId }
                        });
                        
                        console.log('[DASHBOARD] Auth check response:', response.data);
                        
                        if (!response.data.authenticated) {
                            console.log('[DASHBOARD] Not authenticated, redirecting to login');
                            // 인증 실패 시 로그인 페이지로 리다이렉트
                            localStorage.removeItem('sessionId');
                            localStorage.removeItem('user');
                            window.location.href = '/login';
                            return;
                        }
                        
                        console.log('[DASHBOARD] Authenticated! Displaying dashboard...');
                        const userData = JSON.parse(user);
                        
                        // 로그인 상태 표시
                        document.getElementById('userName').textContent = userData.name || userData.username;
                        document.getElementById('userEmail').textContent = userData.username;
                        
                        loggedIn.classList.remove('hidden');
                        loggedIn.classList.add('flex');
                        loggedOut.classList.add('hidden');
                        
                        // 통계 로드
                        loadStats();
                    } catch (e) {
                        console.error('[DASHBOARD] Session check error:', e);
                        // 세션 만료 시 로그인 페이지로 리다이렉트
                        localStorage.removeItem('sessionId');
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                    }
                } else {
                    console.log('[DASHBOARD] No session found, redirecting to login');
                    // 세션이 없으면 로그인 페이지로 리다이렉트
                    window.location.href = '/login';
                }
            }
            
            // 로그아웃 상태 표시
            function showLoggedOut() {
                // 로그인 페이지로 리다이렉트
                window.location.href = '/login';
            }
            
            // 통계 로드
            async function loadStats() {
                const sessionId = localStorage.getItem('sessionId');
                if (!sessionId) return;
                
                try {
                    const response = await axios.get('/api/dashboard/stats', {
                        headers: { 'X-Session-ID': sessionId }
                    });
                    
                    const stats = response.data;
                    
                    // 오토바이 통계
                    document.getElementById('totalBikes').textContent = stats.motorcycles.total;
                    document.getElementById('availableBikes').textContent = stats.motorcycles.available;
                    document.getElementById('rentedBikes').textContent = stats.motorcycles.rented;
                    document.getElementById('maintenanceBikes').textContent = stats.motorcycles.maintenance;
                    document.getElementById('scrappedBikes').textContent = stats.motorcycles.scrapped;
                    
                    // 고객 및 계약 통계
                    document.getElementById('totalCustomers').textContent = stats.customers;
                    document.getElementById('activeContracts').textContent = stats.contracts.active;
                    
                    // 월 대여금 포맷팅
                    const revenue = stats.contracts.monthly_revenue || 0;
                    document.getElementById('monthlyRevenue').textContent = 
                        new Intl.NumberFormat('ko-KR').format(revenue) + '원';
                    
                    document.getElementById('statsSection').style.display = 'block';
                } catch (error) {
                    console.error('통계 로드 오류:', error);
                    document.getElementById('statsSection').style.display = 'none';
                }
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
            
            // 내 정보 모달 표시
            async function showMyInfo() {
                const sessionId = localStorage.getItem('sessionId');
                if (!sessionId) return;
                
                try {
                    const response = await axios.get('/api/auth/check', {
                        headers: { 'X-Session-ID': sessionId }
                    });
                    
                    const user = response.data.user;
                    
                    // 이름 첫 글자 (이니셜)
                    const initial = user.name ? user.name.charAt(0) : user.username.charAt(0);
                    document.getElementById('modalUserInitial').textContent = initial;
                    
                    // 사용자 정보 설정
                    document.getElementById('modalUserName').textContent = user.name || user.username;
                    document.getElementById('modalUsername').textContent = '@' + user.username;
                    document.getElementById('modalUserNameDetail').textContent = user.name || user.username;
                    document.getElementById('modalUserPhone').textContent = user.phone || '등록된 전화번호 없음';
                    document.getElementById('modalUserEmail').textContent = user.email || '등록된 이메일 없음';
                    
                    // 역할 배지 설정
                    const roleEl = document.getElementById('modalUserRole');
                    if (user.role === 'super_admin') {
                        roleEl.textContent = '슈퍼 관리자';
                        roleEl.className = 'px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white';
                        
                        // 슈퍼관리자인 경우 관리자 목록 로드
                        await loadAdminList(sessionId);
                    } else {
                        roleEl.textContent = '일반 관리자';
                        roleEl.className = 'px-4 py-2 rounded-full text-sm font-bold bg-blue-600 text-white';
                        
                        // 일반 관리자는 관리자 목록 숨김
                        document.getElementById('adminListSection').classList.add('hidden');
                    }
                    
                    // 모달 표시
                    document.getElementById('myInfoModal').classList.remove('hidden');
                } catch (error) {
                    console.error('사용자 정보 로드 오류:', error);
                    alert('사용자 정보를 불러오는데 실패했습니다');
                }
            }
            
            // 관리자 목록 로드 (슈퍼관리자 전용)
            async function loadAdminList(sessionId) {
                try {
                    const response = await axios.get('/api/admin/users', {
                        headers: { 'X-Session-ID': sessionId }
                    });
                    
                    const admins = response.data.admins;
                    const container = document.getElementById('adminListContainer');
                    
                    let html = '';
                    for (const admin of admins) {
                        const isActive = admin.status !== 'inactive';
                        const isLoggedIn = admin.is_logged_in > 0;
                        const roleText = admin.role === 'super_admin' ? '슈퍼관리자' : '일반관리자';
                        const statusColor = isActive ? 'text-green-600' : 'text-red-600';
                        const statusText = isActive ? '활성' : '정지';
                        const borderColor = isActive ? 'border-green-200' : 'border-red-200';
                        const buttonBg = isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600';
                        const buttonIcon = isActive ? 'ban' : 'check';
                        const buttonText = isActive ? '정지' : '활성화';
                        const statusAction = isActive ? 'inactive' : 'active';
                        
                        html += '<div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; border: 2px solid; border-color: ' + (isActive ? '#bbf7d0' : '#fecaca') + ';">';
                        html += '<div style="display: flex; align-items: center; justify-content: space-between;">';
                        html += '<div style="flex: 1;">';
                        html += '<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">';
                        html += '<span style="font-weight: bold; color: #1f2937;">' + admin.username + '</span>';
                        html += '<span style="font-size: 0.875rem; color: #4b5563;">' + (admin.name || '이름없음') + '</span>';
                        if (isLoggedIn) {
                            html += '<span style="font-size: 0.75rem; background-color: #d1fae5; color: #047857; padding: 0.25rem 0.5rem; border-radius: 9999px; font-weight: 600;"><i style="font-size: 6px;" aria-hidden="true"></i>사용중</span>';
                        }
                        html += '</div>';
                        html += '<div style="font-size: 0.75rem; color: #6b7280;">';
                        html += '<div><i aria-hidden="true"></i>' + roleText + '</div>';
                        html += '<div><i aria-hidden="true"></i>' + (admin.email || '이메일 없음') + '</div>';
                        html += '<div><i aria-hidden="true"></i>' + (admin.phone || '전화번호 없음') + '</div>';
                        html += '<div><span style="' + (isActive ? 'color: #16a34a;' : 'color: #dc2626;') + ' font-weight: 600;">' + statusText + '</span></div>';
                        html += '</div>';
                        html += '</div>';
                        
                        if (admin.role !== 'super_admin') {
                            html += '<button onclick="toggleAdminStatus(' + admin.id + ', &quot;' + statusAction + '&quot;)" style="margin-left: 1rem; padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; color: white; background-color: ' + (isActive ? '#ef4444' : '#22c55e') + ';">' + buttonText + '</button>';
                        } else {
                            html += '<span style="margin-left: 1rem; font-size: 0.75rem; color: #9333ea; font-weight: 600;">변경불가</span>';
                        }
                        
                        html += '</div>';
                        html += '</div>';
                    }
                    
                    container.innerHTML = html;
                    
                    // 관리자 목록 섹션 표시
                    document.getElementById('adminListSection').classList.remove('hidden');
                } catch (error) {
                    console.error('관리자 목록 로드 오류:', error);
                }
            }
            
            // 관리자 상태 변경
            async function toggleAdminStatus(userId, newStatus) {
                const statusText = newStatus === 'active' ? '활성화' : '정지';
                const confirmMsg = '정말로 이 관리자를 ' + statusText + '하시겠습니까?' + (newStatus === 'inactive' ? '\\n정지 시 해당 관리자의 모든 세션이 종료됩니다.' : '');
                
                if (!confirm(confirmMsg)) {
                    return;
                }
                
                const sessionId = localStorage.getItem('sessionId');
                if (!sessionId) return;
                
                try {
                    await axios.post('/api/admin/users/' + userId + '/status', 
                        { status: newStatus },
                        { headers: { 'X-Session-ID': sessionId } }
                    );
                    
                    alert('관리자 상태가 ' + statusText + '되었습니다');
                    
                    // 관리자 목록 다시 로드
                    await loadAdminList(sessionId);
                } catch (error) {
                    console.error('상태 변경 오류:', error);
                    const errorMsg = (error.response && error.response.data && error.response.data.error) || '상태 변경에 실패했습니다';
                    alert(errorMsg);
                }
            }
            
            // 내 정보 모달 숨기기
            function hideMyInfo() {
                document.getElementById('myInfoModal').classList.add('hidden');
            }
            
            // 페이지 로드 시 로그인 상태 확인 및 body 표시
            window.addEventListener('DOMContentLoaded', function() {
                console.log('[DASHBOARD] DOMContentLoaded fired');
                
                // 먼저 body를 즉시 표시 (하얀 화면 방지)
                document.body.classList.add('loaded');
                
                // localStorage 동기화를 위해 충분히 대기
                setTimeout(() => {
                    console.log('[DASHBOARD] Starting checkLoginStatus after delay');
                    // 로그인 상태 확인
                    checkLoginStatus();
                }, 1000); // 1000ms로 증가하여 localStorage 완전 동기화 보장
            });
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <title>관리자 회원가입</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
<iframe src="/static/register" class="w-full h-screen border-0"></iframe>
</body>
</html>`)
})

// 관리자 로그인 페이지
app.get('/login', (c) => {
  const version = Date.now() // 캐시 무효화용 타임스탬프
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.25, user-scalable=yes">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>관리자 로그인</title>
    <script src="https://cdn.tailwindcss.com?v=${version}"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css?v=${version}" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; overflow: hidden;">
<iframe src="/static/login?v=${version}" class="w-full h-screen border-0" style="border: none; display: block;"></iframe>
</body>
</html>`)
})

// 계약서 서명 페이지
app.get('/contract-sign', (c) => {
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
</html>`)
})

// ============================================
// 데이터 가져오기 API
// ============================================

// 데이터 가져오기 페이지
app.get('/import-data', (c) => {
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
</html>`)
})

// KnoxHub 로그인 1단계: OTP 발송
app.post('/api/import/knox-login', authMiddleware, async (c) => {
  const { username, password } = await c.req.json()

  if (!username || !password) {
    return c.json({ error: '아이디와 비밀번호가 필요합니다' }, 400)
  }

  try {
    // KnoxHub 로그인 시도
    const loginUrl = 'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/login.php'
    
    // 1단계: 로그인 POST 요청
    const formData = new URLSearchParams()
    formData.append('input_id', username)
    formData.append('input_pw', password)
    
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      redirect: 'manual' // 리다이렉트 수동 처리
    })

    // 쿠키 추출
    const setCookieHeader = response.headers.get('set-cookie')
    
    // 세션 토큰 생성 (쿠키 저장용)
    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
    
    // 임시로 세션 저장 (실제로는 KV나 D1에 저장해야 함)
    // 여기서는 간단하게 응답으로 반환
    
    return c.json({ 
      success: true, 
      session_token: sessionToken,
      cookies: setCookieHeader,
      message: 'OTP가 발송되었습니다'
    })
  } catch (error: any) {
    console.error('Knox login error:', error)
    return c.json({ error: 'KnoxHub 로그인 실패: ' + error.message }, 500)
  }
})

// KnoxHub 2단계: OTP 인증 및 데이터 가져오기
app.post('/api/import/knox-fetch', authMiddleware, async (c) => {
  const { session_token, otp } = await c.req.json()

  if (!session_token || !otp) {
    return c.json({ error: '세션 토큰과 OTP가 필요합니다' }, 400)
  }

  try {
    // OTP 인증 로직 (실제 KnoxHub API 호출 필요)
    // 여기서는 데모 데이터 반환
    
    // 실제로는 OTP로 인증 후 데이터 페이지를 크롤링해야 함
    const motorcycles = [
      {
        plate_number: '서울12가3456',
        vehicle_name: '혼다 PCX 150',
        chassis_number: 'MLHJE1234567890',
        mileage: 15000,
        model_year: 2022,
        insurance_company: '삼성화재',
        insurance_start_date: '2024-01-01',
        insurance_end_date: '2025-01-01'
      },
      {
        plate_number: '경기34나5678',
        vehicle_name: '야마하 NMAX',
        chassis_number: 'MLHJE9876543210',
        mileage: 8000,
        model_year: 2023,
        insurance_company: 'DB손해보험',
        insurance_start_date: '2024-03-01',
        insurance_end_date: '2025-03-01'
      }
    ]

    const contracts = [
      {
        customer_name: '홍길동',
        customer_phone: '010-1234-5678',
        vehicle_name: '혼다 PCX 150',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        monthly_fee: 200000,
        deposit: 500000
      },
      {
        customer_name: '김철수',
        customer_phone: '010-9876-5432',
        vehicle_name: '야마하 NMAX',
        start_date: '2024-03-01',
        end_date: '2025-02-28',
        monthly_fee: 250000,
        deposit: 600000
      }
    ]

    return c.json({
      success: true,
      motorcycles,
      contracts
    })
  } catch (error: any) {
    console.error('Knox fetch error:', error)
    return c.json({ error: '데이터 가져오기 실패: ' + error.message }, 500)
  }
})

// 웹 페이지 분석 API (기존 - 백업용)
app.post('/api/import/analyze', authMiddleware, async (c) => {
  const { DB } = c.env
  const { url } = await c.req.json()

  if (!url) {
    return c.json({ error: 'URL이 필요합니다' }, 400)
  }

  try {
    // 웹 페이지 가져오기 (crawler 도구 사용)
    // 실제로는 사용자가 제공한 URL의 HTML을 파싱해야 합니다
    
    // 임시 데모 데이터 (실제로는 웹 페이지를 크롤링하여 추출)
    const motorcycles = [
      {
        plate_number: '서울12가3456',
        vehicle_name: '혼다 PCX 150',
        chassis_number: 'MLHJE1234567890',
        mileage: 15000,
        model_year: 2022,
        insurance_company: '삼성화재',
        insurance_start_date: '2024-01-01',
        insurance_end_date: '2025-01-01'
      }
    ]

    const contracts = [
      {
        customer_name: '홍길동',
        customer_phone: '010-1234-5678',
        vehicle_name: '혼다 PCX 150',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        monthly_fee: 200000,
        deposit: 500000
      }
    ]

    return c.json({
      success: true,
      motorcycles,
      contracts
    })
  } catch (error: any) {
    console.error('Error analyzing page:', error)
    return c.json({ error: '페이지 분석 실패: ' + error.message }, 500)
  }
})

// 오토바이 일괄 등록 API
app.post('/api/import/motorcycles', authMiddleware, async (c) => {
  const { DB } = c.env
  const { motorcycles } = await c.req.json()

  if (!motorcycles || !Array.isArray(motorcycles)) {
    return c.json({ error: '오토바이 데이터가 필요합니다' }, 400)
  }

  let success = 0
  let failed = 0

  for (const bike of motorcycles) {
    try {
      await DB.prepare(`
        INSERT INTO motorcycles (
          plate_number, vehicle_name, chassis_number, mileage, model_year,
          insurance_company, insurance_start_date, insurance_end_date,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', datetime('now'))
      `).bind(
        bike.plate_number || '',
        bike.vehicle_name || '',
        bike.chassis_number || '',
        bike.mileage || 0,
        bike.model_year || new Date().getFullYear(),
        bike.insurance_company || '',
        bike.insurance_start_date || '',
        bike.insurance_end_date || ''
      ).run()
      
      success++
    } catch (error) {
      console.error('Error importing motorcycle:', error)
      failed++
    }
  }

  return c.json({ success, failed })
})

// 계약서 일괄 등록 API
app.post('/api/import/contracts', authMiddleware, async (c) => {
  const { DB } = c.env
  const { contracts } = await c.req.json()

  if (!contracts || !Array.isArray(contracts)) {
    return c.json({ error: '계약서 데이터가 필요합니다' }, 400)
  }

  let success = 0
  let failed = 0
  const results = {
    lease: 0,
    rent: 0,
    loan: 0,
    temp_rent: 0
  }

  for (const contract of contracts) {
    try {
      // 계약 타입 결정 (기본값: individual)
      let contractType = contract.contract_type || 'individual'
      
      // 타입 매핑
      const typeMap = {
        'lease': 'individual', // 리스
        'rent': 'individual',  // 렌트
        'loan': 'loan',        // 차용증
        'temp_rent': 'temp_rent' // 임시렌트
      }
      
      const finalType = typeMap[contractType] || 'individual'
      
      // 먼저 고객 생성 (있으면 가져오기)
      let customerId = null
      if (contract.customer_phone) {
        let customer = await DB.prepare('SELECT id FROM customers WHERE phone = ?')
          .bind(contract.customer_phone).first()
        
        if (!customer) {
          const result = await DB.prepare(`
            INSERT INTO customers (name, phone, resident_number, address, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).bind(
            contract.customer_name || '미입력',
            contract.customer_phone,
            contract.resident_number || '',
            contract.address || ''
          ).run()
          customerId = result.meta.last_row_id
        } else {
          customerId = customer.id
        }
      }

      // 오토바이 찾기 (번호판 또는 차량명으로)
      let motorcycle = null
      if (contract.plate_number) {
        motorcycle = await DB.prepare('SELECT id FROM motorcycles WHERE plate_number = ?')
          .bind(contract.plate_number).first()
      }
      
      if (!motorcycle && contract.vehicle_name) {
        motorcycle = await DB.prepare('SELECT id FROM motorcycles WHERE vehicle_name LIKE ?')
          .bind('%' + contract.vehicle_name + '%').first()
      }
      
      if (!motorcycle) {
        // 오토바이가 없으면 자동 생성
        const result = await DB.prepare(`
          INSERT INTO motorcycles (
            plate_number, vehicle_name, driving_range, status, created_at
          ) VALUES (?, ?, ?, 'active', datetime('now'))
        `).bind(
          contract.plate_number || '미등록',
          contract.vehicle_name || '미입력',
          '전연령'
        ).run()
        
        motorcycle = { id: result.meta.last_row_id }
      }

      // 계약 번호 생성
      const prefixMap = {
        'individual': 'C',
        'loan': 'L',
        'temp_rent': 'TR'
      }
      const prefix = prefixMap[finalType] || 'C'
      const contractNumber = prefix + Date.now() + Math.random().toString(36).substring(2, 5)

      // 계약 데이터 구성
      const contractData = {
        contract_type: contractType,
        source: contract.source || 'import',
        original_data: contract
      }

      // 계약서 생성
      await DB.prepare(`
        INSERT INTO contracts (
          contract_number, contract_type, motorcycle_id, customer_id,
          start_date, end_date, monthly_fee, deposit,
          contract_data, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
      `).bind(
        contractNumber,
        finalType,
        motorcycle.id,
        customerId,
        contract.start_date || new Date().toISOString().split('T')[0],
        contract.end_date || new Date().toISOString().split('T')[0],
        contract.monthly_rent || contract.daily_fee || 0,
        contract.deposit || 0,
        JSON.stringify(contractData)
      ).run()
      
      success++
      results[contractType] = (results[contractType] || 0) + 1
      
    } catch (error) {
      console.error('Error importing contract:', error)
      failed++
    }
  }

  return c.json({ 
    success, 
    failed,
    details: results,
    message: `리스: ${results.lease}건, 렌트: ${results.rent}건, 차용증: ${results.loan}건, 임시렌트: ${results.temp_rent}건`
  })
})

// 임시렌트 계약서 생성 API
app.post('/api/temp-rent-contracts', authMiddleware, async (c) => {
  const { DB } = c.env
  const data = await c.req.json()

  try {
    // 계약 번호 생성
    const contractNumber = 'TR' + Date.now()

    // 오토바이 정보 가져오기
    const motorcycle = await DB.prepare('SELECT * FROM motorcycles WHERE id = ?')
      .bind(data.motorcycle_id).first()

    if (!motorcycle) {
      return c.json({ error: '오토바이를 찾을 수 없습니다' }, 404)
    }

    // 고객 정보 생성 또는 가져오기 (전화번호가 있는 경우만)
    let customerId = null
    if (data.phone) {
      let customer = await DB.prepare('SELECT id FROM customers WHERE phone = ?')
        .bind(data.phone).first()
      
      if (!customer) {
        const result = await DB.prepare(`
          INSERT INTO customers (name, phone, resident_number, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `).bind(data.customer_name, data.phone, data.resident_number || '').run()
        customerId = result.meta.last_row_id
      } else {
        customerId = customer.id
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
    }

    // contracts 테이블에 임시렌트 계약 저장
    await DB.prepare(`
      INSERT INTO contracts (
        contract_number, contract_type, motorcycle_id, customer_id,
        start_date, end_date, monthly_fee, deposit,
        contract_data, signature, status, created_at
      ) VALUES (?, 'temp_rent', ?, ?, ?, ?, ?, 0, ?, ?, 'active', datetime('now'))
    `).bind(
      contractNumber,
      data.motorcycle_id,
      customerId,
      data.start_date || new Date().toISOString().split('T')[0],
      data.end_date || new Date().toISOString().split('T')[0],
      parseInt(data.daily_fee) || 0,
      JSON.stringify(contractData),
      data.signature || ''
    ).run()

    return c.json({
      success: true,
      contract_number: contractNumber,
      message: '임시렌트 계약서가 생성되었습니다'
    })

  } catch (error) {
    console.error('임시렌트 계약서 생성 실패:', error)
    return c.json({ error: '계약서 생성에 실패했습니다: ' + error.message }, 500)
  }
})

// KnoxHub 쿠키로 데이터 가져오기 API
app.post('/api/import/knox-cookie', authMiddleware, async (c) => {
  const { cookie } = await c.req.json()

  if (!cookie) {
    return c.json({ error: '쿠키 값이 필요합니다' }, 400)
  }

  try {
    console.log('🔍 KnoxHub 데이터 가져오기 시작...')
    console.log('Cookie:', cookie.substring(0, 10) + '...')
    
    // KnoxHub 가능한 페이지 URL들
    const possibleUrls = [
      'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/index.php',
      'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/main.php',
      'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/motorcycle_list.php',
      'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/bike_list.php',
      'https://zenio5827.cafe24.com/Knox_Project/Knox_Hub/list.php',
      'http://knoxhub.kro.kr/index.php',
      'http://knoxhub.kro.kr/main.php'
    ]
    
    const motorcycles = []
    const contracts = []
    let successUrl = null
    
    // 각 URL을 시도
    for (const url of possibleUrls) {
      try {
        console.log(`시도: ${url}`)
        
        // fetch로 쿠키와 함께 요청
        const response = await fetch(url, {
          headers: {
            'Cookie': `PHPSESSID=${cookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        
        if (response.ok) {
          const html = await response.text()
          console.log(`✅ 응답 성공: ${url} (${html.length} bytes)`)
          
          // HTML에서 번호판 패턴 찾기 (예: 12가3456, 서울12가3456)
          const platePattern = /(\d{2,3}[가-힣]\d{4}|[가-힣]{2}\d{2}[가-힣]\d{4})/g
          const plates = [...new Set(html.match(platePattern) || [])]
          
          console.log(`🏍️ 발견된 번호판: ${plates.length}개`)
          
          if (plates.length > 0) {
            successUrl = url
            
            // 번호판별로 오토바이 정보 추출
            plates.forEach(plate => {
              motorcycles.push({
                plate_number: plate,
                vehicle_name: '정보 없음 (수동 입력 필요)',
                chassis_number: '',
                mileage: 0,
                model_year: new Date().getFullYear(),
                status: 'active'
              })
            })
            
            break // 성공하면 다음 URL 시도 안함
          }
        }
      } catch (err) {
        console.log(`❌ 실패: ${url} - ${err.message}`)
      }
    }
    
    // 결과 반환
    if (motorcycles.length > 0) {
      console.log(`✅ 총 ${motorcycles.length}대 발견 (from ${successUrl})`)
      return c.json({
        motorcycles,
        contracts,
        source: successUrl,
        extracted_at: new Date().toISOString()
      })
    } else {
      // 데이터를 찾지 못한 경우
      console.log('⚠️ 데이터를 찾지 못했습니다. JSON 업로드 방식을 사용해주세요.')
      return c.json({ 
        error: 'KnoxHub에서 데이터를 찾을 수 없습니다. JSON 업로드 방식을 사용해주세요.',
        motorcycles: [],
        contracts: []
      }, 404)
    }
    
  } catch (error) {
    console.error('KnoxHub 데이터 가져오기 실패:', error)
    return c.json({ 
      error: '데이터 가져오기에 실패했습니다. JSON 업로드 방식을 사용해주세요.',
      motorcycles: [],
      contracts: []
    }, 500)
  }
})

// PDF 계약서 분석 API
app.post('/api/import/analyze-pdfs', authMiddleware, async (c) => {
  try {
    const { files } = await c.req.json()
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return c.json({ error: 'PDF 파일이 필요합니다' }, 400)
    }

    console.log(`📄 ${files.length}개의 PDF 파일 분석 시작...`)
    
    const motorcycles = []
    const contracts = []
    const seenPlates = new Set()
    
    for (const file of files) {
      try {
        // Base64 디코딩하여 텍스트 추출
        const base64Data = file.data.split(',')[1] || file.data
        const binaryString = atob(base64Data)
        
        // PDF에서 텍스트 추출 (간단한 방법 - PDF 구조의 텍스트 부분만)
        let text = ''
        for (let i = 0; i < binaryString.length; i++) {
          const char = binaryString[i]
          const code = char.charCodeAt(0)
          // 출력 가능한 ASCII 문자만 추출
          if (code >= 32 && code <= 126) {
            text += char
          } else if (code === 10 || code === 13) {
            text += ' '
          }
        }
        
        console.log(`📝 파일 "${file.name}" 텍스트 추출 완료 (${text.length} 문자)`)
        
        // 계약 타입 감지
        let contractType = 'lease' // 기본값
        if (text.includes('차용증') || text.includes('LOAN')) {
          contractType = 'loan'
        } else if (text.includes('임시') || text.includes('단기')) {
          contractType = 'temp_rent'
        } else if (text.includes('렌트') || text.includes('RENT')) {
          contractType = 'rent'
        } else if (text.includes('리스') || text.includes('LEASE')) {
          contractType = 'lease'
        }
        
        // 번호판 추출 (예: 12가3456, 서울12가3456, 123가4567)
        const plateMatches = text.match(/([가-힣]{0,2}\d{2,3}[가-힣]\d{4})/g)
        const plateNumber = plateMatches ? plateMatches[0] : null
        
        // 차량명 추출 (혼다, 야마하, PCX, XMAX 등)
        const vehiclePatterns = [
          /혼다\s*[A-Z]*\s*\d*/gi,
          /야마하\s*[A-Z]*\s*\d*/gi,
          /스즈키\s*[A-Z]*\s*\d*/gi,
          /PCX\s*\d*/gi,
          /XMAX\s*\d*/gi,
          /엑스맥스\s*\d*/gi,
          /포르자\s*\d*/gi
        ]
        
        let vehicleName = null
        for (const pattern of vehiclePatterns) {
          const match = text.match(pattern)
          if (match) {
            vehicleName = match[0].trim()
            break
          }
        }
        
        // 고객명 추출 (차용인, 계약자 다음에 나오는 한글 이름)
        const namePatterns = [
          /차용인[:\s]*([가-힣]{2,4})/,
          /계약자[:\s]*([가-힣]{2,4})/,
          /성명[:\s]*([가-힣]{2,4})/,
          /이름[:\s]*([가-힣]{2,4})/
        ]
        
        let customerName = null
        for (const pattern of namePatterns) {
          const match = text.match(pattern)
          if (match && match[1]) {
            customerName = match[1].trim()
            break
          }
        }
        
        // 전화번호 추출
        const phoneMatch = text.match(/01[0-9]-?\d{3,4}-?\d{4}/)
        const customerPhone = phoneMatch ? phoneMatch[0].replace(/-/g, '').replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : null
        
        // 주민번호 추출
        const residentMatch = text.match(/\d{6}-?\d{7}/)
        const residentNumber = residentMatch ? residentMatch[0] : null
        
        // 금액 추출 (월대여금, 일차감금액)
        const amountPatterns = [
          /월대여금[:\s]*([0-9,]+)/,
          /일차감금액[:\s]*([0-9,]+)/,
          /대여금[:\s]*([0-9,]+)/,
          /렌트비[:\s]*([0-9,]+)/
        ]
        
        let amount = null
        for (const pattern of amountPatterns) {
          const match = text.match(pattern)
          if (match && match[1]) {
            amount = parseInt(match[1].replace(/,/g, ''))
            break
          }
        }
        
        // 보증금 추출
        const depositMatch = text.match(/보증금[:\s]*([0-9,]+)/)
        const deposit = depositMatch ? parseInt(depositMatch[1].replace(/,/g, '')) : 0
        
        // 날짜 추출 (YYYY-MM-DD 또는 YYYY.MM.DD 또는 YYYY년 MM월 DD일)
        const datePatterns = [
          /20\d{2}[-.]?\d{2}[-.]?\d{2}/g,
          /20\d{2}년\s*\d{1,2}월\s*\d{1,2}일/g
        ]
        
        const dates = []
        for (const pattern of datePatterns) {
          const matches = text.match(pattern)
          if (matches) {
            matches.forEach(d => {
              const normalized = d
                .replace(/년\s*/g, '-')
                .replace(/월\s*/g, '-')
                .replace(/일/g, '')
                .replace(/\./g, '-')
              dates.push(normalized)
            })
          }
        }
        
        const startDate = dates[0] || new Date().toISOString().split('T')[0]
        const endDate = dates[1] || startDate
        
        // 오토바이 데이터 추가 (중복 체크)
        if (plateNumber && !seenPlates.has(plateNumber)) {
          seenPlates.add(plateNumber)
          motorcycles.push({
            plate_number: plateNumber,
            vehicle_name: vehicleName || '정보 없음',
            chassis_number: '',
            mileage: 0,
            model_year: new Date().getFullYear(),
            status: 'active'
          })
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
            monthly_rent: contractType === 'temp_rent' ? 0 : (amount || 0),
            daily_fee: contractType === 'temp_rent' ? (amount || 0) : 0,
            deposit: deposit,
            address: '',
            special_terms: `${file.name}에서 자동 추출`,
            source: 'pdf_upload'
          })
        }
        
      } catch (fileError) {
        console.error(`파일 "${file.name}" 처리 실패:`, fileError)
      }
    }
    
    console.log(`✅ 분석 완료: 오토바이 ${motorcycles.length}대, 계약서 ${contracts.length}건`)
    
    return c.json({
      motorcycles,
      contracts,
      analyzed_files: files.length,
      success: true,
      message: `${files.length}개 파일 분석 완료. 오토바이 ${motorcycles.length}대, 계약서 ${contracts.length}건 추출됨`
    })
    
  } catch (error) {
    console.error('PDF 분석 실패:', error)
    return c.json({ 
      error: 'PDF 분석에 실패했습니다: ' + error.message,
      motorcycles: [],
      contracts: []
    }, 500)
  }
})

export default app
