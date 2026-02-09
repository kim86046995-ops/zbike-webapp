let allCustomers = [];
let filteredCustomers = [];
let isSuperAdmin = false;

function checkAuth() {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        alert('로그인이 필요합니다.');
        window.location.href = '/static/login.html';
        return false;
    }
    return true;
}

async function loadData() {
    if (!checkAuth()) return;

    const sid = localStorage.getItem('sessionId');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    isSuperAdmin = user.role === 'super_admin' || user.role === 'superadmin';

    console.log('[Session ID]', sid);

    try {
        const res = await axios.get('/api/customers', {
            headers: { 'X-Session-ID': sid }
        });
        
        console.log('[Load Success]', res.data);
        allCustomers = res.data;
        applyFilters();
    } catch (err) {
        console.log('[Load Failed]', err.message);
        document.getElementById('loading').innerHTML = '<div class="text-center py-8"><i class="fas fa-exclamation-triangle text-4xl text-red-500"></i><p class="mt-4 text-red-600">데이터 로드 실패: ' + err.message + '</p><button onclick="loadData()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded">다시 시도</button></div>';
    }
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const contractType = document.getElementById('contractTypeFilter').value;

    filteredCustomers = allCustomers.filter(c => {
        const matchSearch = !search || 
            (c.name && c.name.toLowerCase().includes(search)) ||
            (c.phone && c.phone.includes(search)) ||
            (c.address && c.address.toLowerCase().includes(search));

        const matchType = !contractType || 
            (contractType === 'lease' && c.active_contract_type === 'individual') ||
            (contractType === 'rent' && c.active_contract_type === 'rent') ||
            (contractType === 'business' && c.active_contract_type === 'business');

        return matchSearch && matchType;
    });

    showData();
}

function showData() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');

    let html = '<table class="w-full"><thead><tr class="bg-gray-100">';
    html += '<th class="px-4 py-2">번호</th><th class="px-4 py-2">이름</th><th class="px-4 py-2">전화번호</th>';
    html += '<th class="px-4 py-2">주민등록번호</th><th class="px-4 py-2">우편번호</th><th class="px-4 py-2">주소</th>';
    html += '<th class="px-4 py-2">등록일</th><th class="px-4 py-2">관리</th></tr></thead><tbody>';

    filteredCustomers.forEach((c, i) => {
        const rn = isSuperAdmin ? (c.resident_number || '-') : (c.resident_number ? c.resident_number.replace(/(\d{6})-(\d{7})/, '$1-*******') : '-');
        const fullAddr = (c.address || '') + ' ' + (c.detail_address || '');
        
        html += '<tr onclick="showDetail(' + c.id + ')" class="hover:bg-gray-50 cursor-pointer border-b">';
        html += '<td class="px-4 py-2 text-center">' + (i+1) + '</td>';
        html += '<td class="px-4 py-2">' + (c.name || '-') + '</td>';
        html += '<td class="px-4 py-2">' + (c.phone || '-') + '</td>';
        html += '<td class="px-4 py-2">' + rn + '</td>';
        html += '<td class="px-4 py-2 text-center">' + (c.postcode || '-') + '</td>';
        html += '<td class="px-4 py-2">' + (fullAddr || '-') + '</td>';
        html += '<td class="px-4 py-2 text-center">' + (c.created_at ? c.created_at.substring(0, 10) : '-') + '</td>';
        html += '<td class="px-4 py-2 text-center">';
        if (isSuperAdmin) {
            html += '<button onclick="event.stopPropagation(); deleteCustomer(' + c.id + ', \'' + (c.name || '') + '\')" class="text-red-500 hover:text-red-700">';
            html += '<i class="fas fa-trash"></i></button>';
        }
        html += '</td></tr>';
    });

    html += '</tbody></table>';
    document.getElementById('customerList').innerHTML = html;
}

async function showDetail(id) {
    const sid = localStorage.getItem('sessionId');

    try {
        const res = await axios.get('/api/customers/' + id, {
            headers: { 'X-Session-ID': sid }
        });

        const c = res.data;
        const rn = isSuperAdmin ? (c.resident_number || '-') : (c.resident_number ? c.resident_number.replace(/(\d{6})-(\d{7})/, '$1-*******') : '-');

        let html = '<div class="space-y-4">';
        html += '<div><strong>이름:</strong> ' + (c.name || '-') + '</div>';
        html += '<div><strong>주민등록번호:</strong> ' + rn + '</div>';
        html += '<div><strong>전화번호:</strong> ' + (c.phone || '-') + '</div>';
        html += '<div><strong>우편번호:</strong> ' + (c.postcode || '-') + '</div>';
        html += '<div><strong>주소:</strong> ' + (c.address || '-') + '</div>';
        html += '<div><strong>상세주소:</strong> ' + (c.detail_address || '-') + '</div>';
        html += '<div><strong>등록일:</strong> ' + (c.created_at || '-') + '</div>';
        html += '</div>';

        document.getElementById('detailContent').innerHTML = html;
        document.getElementById('detailModal').classList.remove('hidden');
    } catch (err) {
        alert('상세 정보 조회 실패: ' + err.message);
    }
}

function closeModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

async function deleteCustomer(id, name) {
    if (!confirm(name + ' 계약자를 삭제하시겠습니까?')) return;

    const sid = localStorage.getItem('sessionId');

    if (!sid) {
        alert('로그인이 필요합니다.');
        window.location.href = '/static/login.html';
        return;
    }

    try {
        await axios.delete('/api/customers/' + id, {
            headers: { 'X-Session-ID': sid }
        });

        alert('삭제되었습니다.');
        await loadData();
    } catch (err) {
        alert('삭제 실패: ' + (err.response?.data?.error || err.message));
    }
}

function printList() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'superadmin' || user.role === 'super_admin';

    const pw = window.open('', '', 'width=800,height=600');
    let html = '<html><head><title>계약자 목록</title><style>';
    html += 'body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}';
    html += 'th,td{border:1px solid black;padding:8px;text-align:left}th{background:#f0f0f0}';
    html += '</style></head><body>';
    html += '<h2>계약자 목록</h2>';
    html += '<p>출력일시: ' + new Date().toLocaleString() + '</p>';
    html += '<p>출력자: ' + (user.name || user.username || '-') + '</p>';
    html += '<p>총 ' + filteredCustomers.length + '명</p>';
    html += '<table><thead><tr><th>번호</th><th>이름</th><th>전화번호</th><th>주민등록번호</th><th>주소</th><th>등록일</th></tr></thead><tbody>';

    filteredCustomers.forEach((c, i) => {
        const rn = isAdmin ? (c.resident_number || '-') : (c.resident_number ? c.resident_number.replace(/(\d{6})-(\d{7})/, '$1-*******') : '-');
        html += '<tr><td>' + (i+1) + '</td><td>' + c.name + '</td><td>' + (c.phone||'-') + '</td>';
        html += '<td>' + rn + '</td><td>' + (c.address||'-') + '</td><td>' + (c.created_at?c.created_at.substring(0,10):'-') + '</td></tr>';
    });
    
    html += '</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>';
    pw.document.write(html);
    pw.document.close();
}

window.addEventListener('DOMContentLoaded', loadData);
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('contractTypeFilter').addEventListener('change', applyFilters);
