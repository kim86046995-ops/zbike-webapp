// 공통 인증 체크 스크립트

(function() {
    'use strict';

    // 현재 페이지가 인증이 필요한 페이지인지 확인
    const requiresAuth = !window.location.pathname.includes('customer-') && 
                        !window.location.pathname.includes('login.html') &&
                        !window.location.pathname.includes('register.html') &&
                        !window.location.pathname.includes('find-account.html');

    if (!requiresAuth) return;

    // 자동 로그인 체크 (페이지 로드 시 한 번만 실행)
    async function checkAuth() {
        const sessionId = localStorage.getItem('sessionId');
        const user = localStorage.getItem('user');

        if (!sessionId || !user) {
            console.log('⚠️ 세션 없음 - 로그인 페이지로 리다이렉트');
            window.location.href = '/static/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }

        try {
            const response = await fetch('/api/auth/validate', {
                method: 'GET',
                headers: {
                    'X-Session-ID': sessionId
                }
            });

            if (!response.ok) {
                console.log('⚠️ 세션 만료 - 현재 페이지 새로고침');
                // 세션이 만료되었지만 localStorage는 그대로 유지
                // 현재 페이지를 새로고침하여 다시 시도
                window.location.reload();
                return false;
            }

            console.log('✅ 세션 유효 - 페이지 접근 허용');
            return true;
        } catch (error) {
            console.error('❌ 세션 검증 실패 (네트워크 오류 가능성) - 계속 진행:', error);
            // 네트워크 오류 시 페이지 접근 허용 (오프라인 대응)
            return true;
        }
    }

    // 초기화
    checkAuth();
})();
