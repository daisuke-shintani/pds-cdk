import { Stack, type StackProps, RemovalPolicy } from 'aws-cdk-lib'
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs'
import { type Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'

interface ShardCountMetricStackProps extends StackProps {
  /** プレフィックス */
  prefix: string
  /** cronスケジュール */
  schedulle: events.CronOptions
}

/**
 * シャード数カウントスタック
 */
export class ShardCountMetricStack extends Stack {
  constructor(scope: Construct, id: string, props: ShardCountMetricStackProps) {
    super(scope, id, props)
    // CloudWatch Custom Metorics定義
    const nameSpace = 'Custom/KinesisMetrics'
    const metricName = 'OpenShardCount'

    // Lambda作成
    const lambdaFunc = new nodejsLambda.NodejsFunction(this, 'LambdaFunc', {
      functionName: `${props.prefix}-lambda-shardCount`,
      entry: './resources/lambda/kdsShardCount/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            'cloudwatch:PutMetricStream',
            'cloudwatch:PutMetricData',
            'kinesis:DescribeStreamSummary',
            'kinesis:ListStreams'
          ],
          resources: ['*']
        })
      ],
      environment: {
        NAMESPACE: nameSpace,
        METRIC_NAME: metricName
      }
    })

    // CloudWatch Logs: LogGroup
    new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/${lambdaFunc.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY
    })
    // イベントブリッジ
    new events.Rule(this, 'scheduler', {
      ruleName: `${props.prefix}-eventBridge-shardCount`,
      schedule: events.Schedule.cron(props.schedulle),
      targets: [
        new targets.LambdaFunction(lambdaFunc, {
          retryAttempts: 3
        })
      ]
    })
  }
}
