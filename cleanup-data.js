import axios from 'axios';

const BASE_URL = 'https://zbike-webapp.pages.dev';
const SESSION_ID = process.env.SESSION_ID;

async function cleanupAllData() {
    console.log('🧹 테스트 데이터 삭제 시작...\n');
    
    if (!SESSION_ID) {
        console.error('❌ SESSION_ID 환경변수가 필요합니다.');
        console.log('사용법: SESSION_ID=your-session-id node cleanup-data.js');
        process.exit(1);
    }
    
    const headers = { 'X-Session-ID': SESSION_ID };
    
    try {
        // 1. 차용증 삭제
        console.log('1️⃣ 차용증 삭제 중...');
        const loans = await axios.get(`${BASE_URL}/api/loan-contracts`, { headers });
        console.log(`   차용증 ${loans.data.length}개 발견`);
        for (const loan of loans.data) {
            await axios.delete(`${BASE_URL}/api/loan-contracts/${loan.id}`, { headers });
            console.log(`   ✅ 차용증 ID ${loan.id} 삭제 완료`);
        }
        
        // 2. 업체 계약서 삭제
        console.log('\n2️⃣ 업체 계약서 삭제 중...');
        const businessContracts = await axios.get(`${BASE_URL}/api/business-contracts`, { headers });
        console.log(`   업체 계약서 ${businessContracts.data.length}개 발견`);
        for (const contract of businessContracts.data) {
            await axios.delete(`${BASE_URL}/api/business-contracts/${contract.id}`, { headers });
            console.log(`   ✅ 업체 계약서 ID ${contract.id} 삭제 완료`);
        }
        
        // 3. 개인 계약서 삭제
        console.log('\n3️⃣ 개인 계약서 삭제 중...');
        const contracts = await axios.get(`${BASE_URL}/api/contracts`, { headers });
        console.log(`   개인 계약서 ${contracts.data.length}개 발견`);
        for (const contract of contracts.data) {
            await axios.delete(`${BASE_URL}/api/contracts/${contract.id}`, { headers });
            console.log(`   ✅ 개인 계약서 ID ${contract.id} 삭제 완료`);
        }
        
        // 4. 오토바이 삭제
        console.log('\n4️⃣ 오토바이 삭제 중...');
        const motorcycles = await axios.get(`${BASE_URL}/api/motorcycles`, { headers });
        console.log(`   오토바이 ${motorcycles.data.length}개 발견`);
        for (const motorcycle of motorcycles.data) {
            await axios.delete(`${BASE_URL}/api/motorcycles/${motorcycle.id}`, { headers });
            console.log(`   ✅ 오토바이 ID ${motorcycle.id} (${motorcycle.plate_number}) 삭제 완료`);
        }
        
        // 5. 고객 삭제
        console.log('\n5️⃣ 고객 삭제 중...');
        const customers = await axios.get(`${BASE_URL}/api/customers`, { headers });
        console.log(`   고객 ${customers.data.length}명 발견`);
        for (const customer of customers.data) {
            await axios.delete(`${BASE_URL}/api/customers/${customer.id}`, { headers });
            console.log(`   ✅ 고객 ID ${customer.id} (${customer.name}) 삭제 완료`);
        }
        
        console.log('\n✨ 모든 테스트 데이터 삭제 완료!');
        console.log('이제 실제 데이터를 입력할 수 있습니다.');
        
    } catch (error) {
        console.error('\n❌ 오류 발생:', error.response?.data || error.message);
        process.exit(1);
    }
}

cleanupAllData();
