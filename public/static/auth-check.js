// 공통 인증 체크 스크립트 (빠른 버전)

(function() {
    'use strict';

    // 현재 페이지가 인증이 필요한 페이지인지 확인
    const requiresAuth = !window.location.pathname.includes('customer-') && 
                        !window.location.pathname.includes('login.html') &&
                        !window.location.pathname.includes('register.html') &&
                        !window.location.pathname.includes('find-account.html');

    if (!requiresAuth) return;

    // 빠른 인증 체크 (API 호출 없이 localStorage만 확인)
    function checkAuth() {
        const sessionId = localStorage.getItem('sessionId');
        const user = localStorage.getItem('user');

        if (!sessionId || !user) {
            console.log('⚠️ 세션 없음 - 로그인 페이지로 리다이렉트');
            window.location.href = '/static/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }

        console.log('✅ 세션 확인 완료 - 페이지 접근 허용');
        return true;
    }

    // 초기화
    checkAuth();
})();
