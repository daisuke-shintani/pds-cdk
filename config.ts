import { type Environment } from 'aws-cdk-lib'
// 共通設定
interface commonConfig {
  projectName: Record<string, string>
  snsNotificationEmail: string
}

// config設定
export interface Config extends commonConfig {
  env: Environment
  prefix: string
  vpcEndpointId: {
    dx: string
  }
  crossAccountId: Record<string, string[]>
}

export const devConfig: Config = {
  env: {
    account: '739770618285',
    region: 'us-east-2'
  },
  prefix: 'pds-dev',
  vpcEndpointId: {
    dx: 'vpce-022a36476191c3aaf'
  },
  projectName: {
    riyotsuchi: 'riyotsuchi',
    riyokakunin: 'riyokakunin'
  },
  // crossAccountId: {
  //   riyotsuchi: ['456435170547'],
  //   riyokakunin: ['456435170547']
  // },
  crossAccountId: {
    cep: ['456435170547']
  },
  snsNotificationEmail: 'd-shintani@toyotasystems.com'
}
