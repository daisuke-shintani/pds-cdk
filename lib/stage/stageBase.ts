import { type Stack, Stage } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import { type Config } from '../../config'
import { RiyotsuchiApiGwKdsStack } from '../stack/riyotsuchiApiGwKdsStack'
import { RiyokakuninApiGwKdsStack } from '../stack/riyoKakuninApiGwKdsStack'
import { ShardCountMetricStack } from '../stack/shardCountMetricStack'
import { BaseStack } from '../stack/baseStack'

export abstract class StageBase extends Stage {
  createStacks(scope: Construct, config: Config): Record<string, Stack> {
    const env = config.env
    const prefix = config.prefix
    // const vpcEndpointId = config.vpcEndPointId
    // const crossAccountId = config.crossAccountId
    const snsNotificationEmail = config.snsNotificationEmail

    /*
    * Baseスタック
    -------------------------------------------------------------------------- */
    const baseStack = new BaseStack(scope, 'base-stack', {
      env,
      prefix,
      snsNotificationEmail
    })

    /*
    * カスタムメトリクス監視スタック
    -------------------------------------------------------------------------- */
    const shardCount = new ShardCountMetricStack(scope, 'pds-lambda-shardCount-metric-stack', {
      env,
      prefix,
      schedulle: { minute: '0/30', hour: '*', day: '*' }
    })

    /*
    * 利用通知用スタック: APIGW - KDS
    -------------------------------------------------------------------------- */
    const riyotsuchiApiGwKdsStack = new RiyotsuchiApiGwKdsStack(
      scope,
      'pds-kds-apigw-riyotsuchi-stack',
      {
        env,
        prefix,
        snsAction: baseStack.snsAction,
        vpcEndpointId: config.vpcEndpointId,
        projectName: config.projectName.riyotsuchi
      }
    )

    /*
    * 利用確認用スタック: APIGW - KDS
    -------------------------------------------------------------------------- */
    const riyoKakuninApiGwKdsStack = new RiyokakuninApiGwKdsStack(
      scope,
      'pds-kds-apigw-riyokakunin-stack',
      {
        env,
        prefix,
        snsAction: baseStack.snsAction,
        vpcEndpointId: config.vpcEndpointId,
        projectName: config.projectName.riyokakunin
      }
    )

    return {
      shardCount,
      riyotsuchiApiGwKdsStack,
      riyoKakuninApiGwKdsStack
    }
  }
}
