import { type Stack } from 'aws-cdk-lib'
import { Template, Match } from 'aws-cdk-lib/assertions'

/**
 * スタックのセットからテスト用のテンプレートセットを生成する
 * @param stacks
 * @returns
 */
export function createTemplates(stacks: Record<string, Stack>): Record<string, Template> {
  const templates: Record<string, Template> = {}
  for (const key in stacks) {
    if (Object.prototype.hasOwnProperty.call(stacks, key)) {
      templates[key] = Template.fromStack(stacks[key])
    }
  }
  return templates
}

/**
 * セキュリティテストを実行する
 * @param templates
 */
export function executeSecurityTests(templates: Record<string, Template>): void {
  describe('利用通知利用確認スタック', () => {
    test('API Gatewayの設定がPrivateでアクセスが2つのVPCエンドポイントからのみに制限されていること', () => {
      const endpointConfiguration = {
        EndpointConfiguration: {
          Types: ['PRIVATE'],
          VpcEndpointIds: [Match.anyValue(), Match.anyValue()]
        }
      }
      templates.riyotsuchiStack.hasResourceProperties(
        'AWS::ApiGateway::RestApi',
        endpointConfiguration
      )
      templates.riyokakuninStack.hasResourceProperties(
        'AWS::ApiGateway::RestApi',
        endpointConfiguration
      )
    })
  })
}
