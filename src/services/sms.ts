/**
 * 알리고(Aligo) SMS 서비스
 * 
 * 특징:
 * - 완전히 독립적인 모듈 (기존 코드 영향 없음)
 * - SMS 전송 실패해도 계약서 저장에 영향 없음
 * - 환경변수로 활성화/비활성화 제어
 * - 발신번호 교체 가능 (환경변수만 변경)
 */

export interface SMSConfig {
  enabled: boolean
  apiKey: string
  userId: string
  senderPhone: string
  testMode?: boolean
}

export interface SMSResult {
  success: boolean
  message?: string
  error?: string
  code?: number
}

export class AligoSMSService {
  private config: SMSConfig
  private baseUrl = 'https://apis.aligo.in/send/'

  constructor(config: SMSConfig) {
    this.config = config
  }

  /**
   * SMS 전송
   * @param phone 수신 전화번호 (하이픈 포함 가능)
   * @param message 메시지 내용 (최대 2000자)
   * @returns 전송 결과
   */
  async send(phone: string, message: string): Promise<SMSResult> {
    // SMS 비활성화 상태
    if (!this.config.enabled) {
      console.log('📱 [SMS] 비활성화 상태 - 전송 건너뜀')
      return {
        success: false,
        message: 'SMS 기능이 비활성화되어 있습니다'
      }
    }

    // 테스트 모드
    if (this.config.testMode) {
      console.log('📱 [SMS 테스트 모드]')
      console.log(`  수신: ${phone}`)
      console.log(`  내용: ${message}`)
      return {
        success: true,
        message: '테스트 모드 - 실제 전송 안 함'
      }
    }

    try {
      // 전화번호 정규화 (하이픈 제거)
      const normalizedPhone = phone.replace(/[^0-9]/g, '')

      // 알리고 API 요청
      const formData = new URLSearchParams({
        key: this.config.apiKey,
        user_id: this.config.userId,
        sender: this.config.senderPhone.replace(/[^0-9]/g, ''),
        receiver: normalizedPhone,
        msg: message,
        msg_type: 'SMS', // SMS (단문), LMS (장문), MMS (이미지)
        title: '' // LMS/MMS 제목 (SMS는 불필요)
      })

      console.log('📱 [SMS] 전송 시도:', {
        to: phone,
        messageLength: message.length
      })

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      })

      const result = await response.json() as any

      // 알리고 응답 코드
      // 1: 성공
      // -1: 전송 실패
      if (result.result_code === '1') {
        console.log('✅ [SMS] 전송 성공:', {
          to: phone,
          messageId: result.msg_id
        })
        return {
          success: true,
          message: '전송 성공',
          code: parseInt(result.result_code)
        }
      } else {
        console.error('❌ [SMS] 전송 실패:', {
          to: phone,
          code: result.result_code,
          message: result.message
        })
        return {
          success: false,
          error: result.message || '알 수 없는 오류',
          code: parseInt(result.result_code)
        }
      }
    } catch (error: any) {
      console.error('❌ [SMS] 전송 예외:', {
        to: phone,
        error: error.message
      })
      return {
        success: false,
        error: error.message || '네트워크 오류'
      }
    }
  }

  /**
   * 여러 번호로 동시 전송 (그룹 발송)
   */
  async sendMultiple(phones: string[], message: string): Promise<SMSResult[]> {
    const results = await Promise.allSettled(
      phones.map(phone => this.send(phone, message))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          success: false,
          error: `전송 실패: ${phones[index]}`
        }
      }
    })
  }

  /**
   * 잔액 조회
   */
  async getBalance(): Promise<{ success: boolean; balance?: number; error?: string }> {
    if (!this.config.enabled) {
      return { success: false, error: 'SMS 기능이 비활성화되어 있습니다' }
    }

    try {
      const formData = new URLSearchParams({
        key: this.config.apiKey,
        user_id: this.config.userId
      })

      const response = await fetch('https://apis.aligo.in/remain/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      })

      const result = await response.json() as any

      if (result.result_code === '1') {
        return {
          success: true,
          balance: parseInt(result.SMS_CNT || '0')
        }
      } else {
        return {
          success: false,
          error: result.message || '잔액 조회 실패'
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '네트워크 오류'
      }
    }
  }
}

/**
 * SMS 서비스 초기화 헬퍼 함수
 */
export function createSMSService(env: any): AligoSMSService {
  const config: SMSConfig = {
    enabled: env.SMS_ENABLED === 'true',
    apiKey: env.SMS_API_KEY || '',
    userId: env.SMS_USER_ID || '',
    senderPhone: env.SMS_SENDER_PHONE || '',
    testMode: env.SMS_TEST_MODE === 'true'
  }

  return new AligoSMSService(config)
}

/**
 * SMS 메시지 템플릿
 */
export const SMSTemplates = {
  // 계약 완료
  contractCreated: (customerName: string, contractNumber: string, plateNumber: string) =>
    `[지바이크] ${customerName}님, 계약이 완료되었습니다.\n계약번호: ${contractNumber}\n차량: ${plateNumber}\n감사합니다.`,

  // 계약 해지
  contractCancelled: (customerName: string, plateNumber: string) =>
    `[지바이크] ${customerName}님, 계약이 해지되었습니다.\n차량: ${plateNumber}\n이용해 주셔서 감사합니다.`,

  // 보험 만료 임박
  insuranceExpiring: (plateNumber: string, daysLeft: number) =>
    `[지바이크] 차량 ${plateNumber}의 보험이 ${daysLeft}일 후 만료됩니다. 갱신이 필요합니다.`,

  // 검사 만료 임박
  inspectionExpiring: (plateNumber: string, daysLeft: number) =>
    `[지바이크] 차량 ${plateNumber}의 검사가 ${daysLeft}일 후 만료됩니다. 검사가 필요합니다.`,

  // 관리자 알림 - 신규 계약
  adminContractCreated: (customerName: string, plateNumber: string, contractType: string) =>
    `[지바이크 관리자] 신규 계약\n고객: ${customerName}\n차량: ${plateNumber}\n유형: ${contractType}`,

  // 관리자 알림 - 계약 해지
  adminContractCancelled: (customerName: string, plateNumber: string) =>
    `[지바이크 관리자] 계약 해지\n고객: ${customerName}\n차량: ${plateNumber}`
}
