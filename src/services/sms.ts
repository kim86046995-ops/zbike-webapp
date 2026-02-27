/**
 * 알리고(Aligo) SMS 서비스 (AWS Lambda 경유)
 * 
 * 알리고는 고정 IP 화이트리스트를 사용하므로
 * AWS Lambda (NAT Gateway)를 통해 SMS를 전송합니다.
 * 
 * 아키텍처:
 * Cloudflare Workers → AWS Lambda → Aligo API
 * 
 * 특징:
 * - 완전히 독립적인 모듈 (기존 코드 영향 없음)
 * - SMS 전송 실패해도 계약서 저장에 영향 없음
 * - 환경변수로 활성화/비활성화 제어
 */

export interface SMSConfig {
  enabled: boolean
  awsLambdaUrl: string
  awsApiKey?: string
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

  constructor(config: SMSConfig) {
    this.config = config
  }

  /**
   * SMS 전송 (AWS Lambda 경유)
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

    // Lambda URL 미설정
    if (!this.config.awsLambdaUrl) {
      console.error('📱 [SMS] AWS Lambda URL이 설정되지 않았습니다')
      return {
        success: false,
        error: 'AWS Lambda URL이 설정되지 않았습니다'
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
      console.log('📱 [SMS] AWS Lambda 호출:', {
        to: phone,
        messageLength: message.length
      })

      // AWS Lambda 호출
      const response = await fetch(this.config.awsLambdaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.awsApiKey && { 'x-api-key': this.config.awsApiKey })
        },
        body: JSON.stringify({
          phone,
          message,
          action: 'send'
        })
      })

      if (!response.ok) {
        throw new Error(`Lambda 호출 실패: ${response.status} ${response.statusText}`)
      }

      const result = await response.json() as any

      if (result.success) {
        console.log('✅ [SMS] 전송 성공:', {
          to: phone,
          messageId: result.messageId
        })
        return {
          success: true,
          message: '전송 성공',
          code: result.code
        }
      } else {
        console.error('❌ [SMS] 전송 실패:', {
          to: phone,
          error: result.error || result.message
        })
        return {
          success: false,
          error: result.error || result.message || '알 수 없는 오류',
          code: result.code
        }
      }
    } catch (error: any) {
      console.error('❌ [SMS] Lambda 호출 예외:', {
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
   * 잔액 조회 (AWS Lambda 경유)
   */
  async getBalance(): Promise<{ success: boolean; balance?: number; error?: string }> {
    if (!this.config.enabled) {
      return { success: false, error: 'SMS 기능이 비활성화되어 있습니다' }
    }

    if (!this.config.awsLambdaUrl) {
      return { success: false, error: 'AWS Lambda URL이 설정되지 않았습니다' }
    }

    try {
      const response = await fetch(this.config.awsLambdaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.awsApiKey && { 'x-api-key': this.config.awsApiKey })
        },
        body: JSON.stringify({
          action: 'balance'
        })
      })

      if (!response.ok) {
        throw new Error(`Lambda 호출 실패: ${response.status}`)
      }

      const result = await response.json() as any

      if (result.success) {
        return {
          success: true,
          balance: result.balance
        }
      } else {
        return {
          success: false,
          error: result.error || result.message || '잔액 조회 실패'
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
    awsLambdaUrl: env.SMS_AWS_LAMBDA_URL || '',
    awsApiKey: env.SMS_AWS_API_KEY || '',
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
