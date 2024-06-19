import { Construct } from 'constructs'
import * as kds from 'aws-cdk-lib/aws-kinesis'
import { RemovalPolicy } from 'aws-cdk-lib'
import { type Stream } from 'aws-cdk-lib/aws-kinesis'
import * as cw from 'aws-cdk-lib/aws-cloudwatch'
import type * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import { type commonConstruct } from '../interface/commonConstruct'

interface KdsDataStreamProps extends commonConstruct {
  // SNSアクション
  snsAction: cwActions.SnsAction
  // ストリームモード
  streamMode?: kds.StreamMode
  // アラーム設定（任意）
  writeProvisionedOps?: cw.CreateAlarmOptions
  readProvisionedOps?: cw.CreateAlarmOptions
  iteratorAgeOps?: cw.CreateAlarmOptions
  customShardCountOps?: cw.CreateAlarmOptions
}

export class KdsDataStream extends Construct {
  public readonly dataStream: Stream
  private readonly writeProvisionedOps: cw.CreateAlarmOptions
  private readonly readProvisionedOps: cw.CreateAlarmOptions
  private readonly iteratorAgeOps: cw.CreateAlarmOptions

  constructor(scope: Construct, id: string, props: KdsDataStreamProps) {
    super(scope, id)

    // CloudWatch Custom Metorics定義
    const namespace = 'Custom/KinesisMetrics'
    const metricName = 'OpenShardCount'

    // // customerキーの作成
    // const customerKey = new kms.Key(this, 'CustomerKey', {
    //   admins: [new iam.AccountPrincipal(props.crossAccountId)],
    //   alias: `${props.prefix}-kms-${props.projectName}`,
    //   rotationPeriod: Duration.days(365),
    //   pendingWindow: Duration.days(7),
    //   removalPolicy: RemovalPolicy.DESTROY,
    //   description: 'for kds encryption'
    // })

    // Kinesis Data Streams
    props.streamMode ??= kds.StreamMode.ON_DEMAND
    this.dataStream = new kds.Stream(this, 'Resource', {
      streamName: `${props.prefix}-kds-${props.projectName}`,
      streamMode: props.streamMode,
      encryption: kds.StreamEncryption.KMS,
      // encryptionKey: customerKey,
      removalPolicy: RemovalPolicy.DESTROY
    })

    // CloudWatchAlarm設定---------------------------------------------------------------------------------------

    // 書き込み制限エラーアラーム
    // デフォルト設定
    props.writeProvisionedOps ??= {
      alarmName: `${props.prefix}-cloudwatch-alarm-kds-writeProvisioned-${props.projectName}-warn`,
      evaluationPeriods: 10,
      threshold: 45
    }

    const writeProvisioned = this.dataStream.metricWriteProvisionedThroughputExceeded()
    writeProvisioned
      .createAlarm(this, 'writeProvisioned', props.writeProvisionedOps)
      .addAlarmAction(props.snsAction)

    // 読み込み制限エラーアラーム
    // デフォルト設定
    props.readProvisionedOps ??= {
      alarmName: `${props.prefix}-cloudwatch-alarm-kds-readProvisioned-${props.projectName}-warn`,
      evaluationPeriods: 10,
      threshold: 45
    }

    const readProvisioned = this.dataStream.metricReadProvisionedThroughputExceeded()
    readProvisioned
      .createAlarm(this, 'readProvisioned', props.readProvisionedOps)
      .addAlarmAction(props.snsAction)

    // 滞留時間アラーム
    // デフォルト設定
    props.iteratorAgeOps ??= {
      alarmName: `${props.prefix}-cloudwatch-alarm-kds-iteratorAge-${props.projectName}-warn`,
      evaluationPeriods: 10,
      threshold: 45
    }
    const IteratorAge = this.dataStream.metricGetRecordsIteratorAgeMilliseconds()
    IteratorAge.createAlarm(this, 'IteratorAge', props.iteratorAgeOps).addAlarmAction(
      props.snsAction
    )

    // カスタムメトリクスアラーム
    // デフォルト設定
    if (props.streamMode === kds.StreamMode.ON_DEMAND) {
      props.customShardCountOps ??= {
        alarmName: `${props.prefix}-cloudwatch-alarm-kds-customShardCount-${props.projectName}-warn`,
        evaluationPeriods: 10,
        threshold: 8
      }
      const customMetric = new cw.Metric({
        namespace,
        metricName,
        dimensionsMap: {
          dataStreamName: this.dataStream.streamName
        }
      })
      customMetric
        .createAlarm(this, 'customMetric', props.customShardCountOps)
        .addAlarmAction(props.snsAction)
    }
  }
}
