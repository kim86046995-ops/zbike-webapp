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
// 오토바이 API
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

// 오토바이 등록
app.post('/api/motorcycles', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO motorcycles (
      plate_number, vehicle_name, chassis_number, mileage, model_year,
      insurance_company, insurance_start_date, insurance_end_date,
      driving_range, owner_name, insurance_fee, vehicle_price, daily_rental_fee, usage_notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.plate_number,
    data.vehicle_name,
    data.chassis_number,
    data.mileage,
    data.model_year,
    data.insurance_company,
    data.insurance_start_date,
    data.insurance_end_date,
    data.driving_range,
    data.owner_name,
    data.insurance_fee,
    data.vehicle_price,
    data.daily_rental_fee || 0,
    data.usage_notes || '',
    data.status || 'available'
  ).run()
  
  return c.json({ id: result.meta.last_row_id, ...data }, 201)
})

// 오토바이 수정
app.put('/api/motorcycles/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE motorcycles SET
      plate_number = ?, vehicle_name = ?, chassis_number = ?, mileage = ?,
      model_year = ?, insurance_company = ?, insurance_start_date = ?,
      insurance_end_date = ?, driving_range = ?, owner_name = ?,
      insurance_fee = ?, vehicle_price = ?, daily_rental_fee = ?, usage_notes = ?, status = ?,
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
    data.driving_range,
    data.owner_name,
    data.insurance_fee,
    data.vehicle_price,
    data.daily_rental_fee || 0,
    data.usage_notes || '',
    data.status,
    id
  ).run()
  
  return c.json({ id, ...data })
})

// 오토바이 삭제
app.delete('/api/motorcycles/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare('DELETE FROM motorcycles WHERE id = ?').bind(id).run()
  
  return c.json({ message: '삭제되었습니다' })
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

// 계약서 생성
app.post('/api/contracts', async (c) => {
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

// 계약서 상태 변경
app.patch('/api/contracts/:id/status', async (c) => {
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
      collateral, special_terms, borrower_signature, lender_signature, borrower_id_card_photo, status
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
    data.collateral || '',
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
                <div class="container mx-auto px-4 py-6">
                    <h1 class="text-3xl font-bold">
                        <i class="fas fa-motorcycle mr-3"></i>
                        오토바이 리스/렌트 전자계약 시스템
                    </h1>
                </div>
            </header>

            <!-- 메인 컨텐츠 -->
            <main class="container mx-auto px-4 py-8">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                    <!-- 계약서 작성 -->
                    <a href="/contract/new" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                        <div class="flex items-center mb-4">
                            <div class="bg-green-100 p-3 rounded-full">
                                <i class="fas fa-file-signature text-green-600 text-2xl"></i>
                            </div>
                            <h2 class="text-xl font-bold ml-4">계약서 작성</h2>
                        </div>
                        <p class="text-gray-600">리스/렌트 계약서 작성</p>
                    </a>

                    <!-- 계약서 목록 -->
                    <a href="/contracts" class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
                        <div class="flex items-center mb-4">
                            <div class="bg-purple-100 p-3 rounded-full">
                                <i class="fas fa-list text-purple-600 text-2xl"></i>
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
    </body>
    </html>
  `)
})

export default app
