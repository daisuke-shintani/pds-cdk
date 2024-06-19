import { Construct } from 'constructs'
import { type Stream } from 'aws-cdk-lib/aws-kinesis'
import { type RestApi } from 'aws-cdk-lib/aws-apigateway'
import * as cw from 'aws-cdk-lib/aws-cloudwatch'
import { Duration } from 'aws-cdk-lib'
import { type Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { type commonConstruct } from '../interface/commonConstruct'

// Dashboardの各セクション共通widget
interface CommonWidgets {
  titleWid: cw.TextWidget
}

// API GWセクションで利用可能なwidget
interface ApiGwSectionWidgets extends CommonWidgets {
  countWid: cw.GraphWidget
  errorCountWid: cw.GraphWidget
  latencyWid: cw.GraphWidget
}

// KDSセクションで利用可能なwidget
interface KdsSectionWidgets extends CommonWidgets {
  putRecordsFailedRecordsWid: cw.GraphWidget
  putRecordsThrottledRecordWid: cw.GraphWidget
  shardCountWid: cw.GraphWidget
  writeProvisionedThroughputExceededBytesWid: cw.GraphWidget
  writeProvisionedThroughputExceededRecordsWid: cw.GraphWidget
  readProvisionedThroughputExceededWid: cw.GraphWidget
  iteratorAgeMillisecondsWid: cw.GraphWidget
}

/** Lambdaセクションで利用可能なWidget */
interface LambdaSectionWidgets extends CommonWidgets {
  invocationsWid: cw.GraphWidget
  durationWid: cw.GraphWidget
  concurrentExecutionWid: cw.GraphWidget
  memoryUtilizationWid: cw.GraphWidget
  errorsWid: cw.GraphWidget
  throttlesWid: cw.GraphWidget
  batchSizeWid: cw.GraphWidget
}

/** ログセクションで利用可能なWidget */
interface LogsSectionWidgets extends CommonWidgets {
  producerTitleWid: cw.TextWidget
  consumerTitleWid: cw.TextWidget
  clientScriptLogTableWid: cw.LogQueryWidget
  clientScriptLogWid: cw.LogQueryWidget
  lambdaFunctionLogTableWid: cw.LogQueryWidget
  lambdaFunctionLogWid: cw.LogQueryWidget
}

// カスタムメトリクスのキー項目
interface CustomMetricsKeys {
  namespace: string
  metricName: string
}

interface KdsDashboardProps extends commonConstruct {
  //  restAPI
  restApi?: RestApi
  // kds
  dataStream?: Stream
  /** Lambda Function */
  lambdaFunction?: LambdaFunction
  // /** Data Firehose */(alpa版のlibraryがインストールできなかったため保留)
  // deliveryStream?: DeliveryStream
}

export class KdsDashboard extends Construct {
  private readonly defaultHeight: number = 8
  private readonly defaultWidth: number = 12
  private readonly restApi: RestApi
  private readonly dataStream: Stream
  private readonly lambdaFunction: LambdaFunction
  private readonly apiGwWidgets: ApiGwSectionWidgets
  private readonly kdsWidgets: KdsSectionWidgets
  private readonly lambdaWidgets: LambdaSectionWidgets
  private readonly logsWidgets: LogsSectionWidgets
  private readonly shardCountMetricsKeys: CustomMetricsKeys
  private readonly batchSizeMetricsKeys: CustomMetricsKeys

  constructor(scope: Construct, id: string, props: KdsDashboardProps) {
    super(scope, id)

    this.shardCountMetricsKeys = {
      namespace: 'Custom/KinesisMetrics',
      metricName: 'OpenShardCount'
    }
    this.batchSizeMetricsKeys = {
      namespace: 'Custom/LambdaMetrics',
      metricName: 'LambdaBatchSize'
    }

    // CloudWatchダッシュボード
    const dashboard = new cw.Dashboard(this, 'Resource', {
      dashboardName: `${props.prefix}-cloudwatch-dashboard-${props.projectName}`,
      defaultInterval: Duration.hours(1)
    })

    // APIGWセクション
    if (props.restApi !== undefined) {
      this.restApi = props.restApi
      this.apiGwWidgets = this.createApiGwWidgets()
      dashboard.addWidgets(this.apiGwWidgets.titleWid)
      dashboard.addWidgets(this.apiGwWidgets.errorCountWid, this.apiGwWidgets.latencyWid)
    }
    // KDSセクション
    if (props.dataStream !== undefined) {
      this.dataStream = props.dataStream
      this.kdsWidgets = this.createKdsWidgets()
      dashboard.addWidgets(this.kdsWidgets.titleWid)
      dashboard.addWidgets(
        this.kdsWidgets.putRecordsFailedRecordsWid,
        this.kdsWidgets.putRecordsThrottledRecordWid
      )
      dashboard.addWidgets(
        this.kdsWidgets.writeProvisionedThroughputExceededRecordsWid,
        this.kdsWidgets.writeProvisionedThroughputExceededBytesWid
      )
      dashboard.addWidgets(
        this.kdsWidgets.readProvisionedThroughputExceededWid,
        this.kdsWidgets.iteratorAgeMillisecondsWid
      )
      dashboard.addWidgets(this.kdsWidgets.shardCountWid)
    }

    // Lambda
    if (props.lambdaFunction !== undefined) {
      this.lambdaFunction = props.lambdaFunction
      this.lambdaWidgets = this.createLambdaWidgets()
      dashboard.addWidgets(this.lambdaWidgets.titleWid)
      dashboard.addWidgets(this.lambdaWidgets.invocationsWid, this.lambdaWidgets.durationWid)
      dashboard.addWidgets(
        this.lambdaWidgets.concurrentExecutionWid,
        this.lambdaWidgets.memoryUtilizationWid
      )
      dashboard.addWidgets(this.lambdaWidgets.throttlesWid, this.lambdaWidgets.errorsWid)
      dashboard.addWidgets(this.lambdaWidgets.batchSizeWid)
    }

    // Logs
    if (props.restApi !== undefined && props.lambdaFunction !== undefined) {
      this.logsWidgets = this.createLogsWidgets()
      dashboard.addWidgets(this.logsWidgets.titleWid)
      dashboard.addWidgets(this.logsWidgets.producerTitleWid, this.logsWidgets.consumerTitleWid)
      dashboard.addWidgets(
        this.logsWidgets.clientScriptLogTableWid,
        this.logsWidgets.lambdaFunctionLogTableWid
      )
      dashboard.addWidgets(
        this.logsWidgets.clientScriptLogWid,
        this.logsWidgets.lambdaFunctionLogWid
      )
    }
  }

  // API GWウィジェット作成メソッド
  createApiGwWidgets(): ApiGwSectionWidgets {
    const titleWid = new cw.TextWidget({
      markdown: `# API Gateway Metrics
## 5××エラーの例
- 504 INTEGRATIONN_FAILURE, INTEGRATION_TIMEOUT
  - バックエンドとの統合失敗

## 4××エラーの例
- 400 Kinesis WriteProvisionedThroughputExceeded
  - kinesisの書き込みスループット超過エラー
- 403 EXPIRED_TOKEN, INVALID_API_KEY, INVALID_SIGNATUREなど
  - API KeyやAWS署名などの認証関連エラー
`,
      height: 4,
      width: 24
    })
    const countWid = new cw.GraphWidget({
      title: 'リクエスト数(Sum)',
      left: [this.restApi.metricCount()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })
    const latencyWid = new cw.GraphWidget({
      title: 'レイテンシー(Max, p99, Avg, Min)',
      left: [
        this.restApi.metricLatency({ statistic: cw.Stats.MAXIMUM }),
        this.restApi.metricLatency({ statistic: cw.Stats.percentile(99) }),
        this.restApi.metricLatency({ statistic: cw.Stats.AVERAGE }),
        this.restApi.metricLatency({ statistic: cw.Stats.MINIMUM })
      ],
      width: this.defaultWidth,
      height: this.defaultHeight,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const errorCountWid = new cw.GraphWidget({
      title: 'エラー発生数 4×× 5××(Sum)',
      left: [this.restApi.metricClientError()],
      right: [this.restApi.metricServerError()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    return {
      titleWid,
      countWid,
      latencyWid,
      errorCountWid
    }
  }

  // KDSウィジェット作成メソッド
  createKdsWidgets(): KdsSectionWidgets {
    const titleWid = new cw.TextWidget({
      markdown: '# KDS Metrics',
      height: 2,
      width: 24
    })

    const putRecordsFailedRecordsWid = new cw.GraphWidget({
      title: 'KDS内部エラー発生数(Sum)',
      left: [this.dataStream.metricPutRecordsFailedRecords()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const putRecordsThrottledRecordWid = new cw.GraphWidget({
      title: 'KDSスロットリングエラー数(Sum)',
      left: [this.dataStream.metricPutRecordsThrottledRecords()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM
    })

    const incommingBytesPerMinMetrics = new cw.MathExpression({
      label: 'incommingBytes',
      expression: 'e1/60',
      usingMetrics: {
        e1: this.dataStream.metricIncomingBytes({
          statistic: cw.Stats.SUM,
          period: Duration.minutes(1)
        })
      }
    })
    const incommingRecordsPerMinMetrics = new cw.MathExpression({
      label: 'incommingRecords',
      expression: 'e1/60',
      usingMetrics: {
        e1: this.dataStream.metricIncomingRecords({
          statistic: cw.Stats.SUM,
          period: Duration.minutes(1)
        })
      }
    })

    const shardCountWid = new cw.GraphWidget({
      title: 'シャード数(Max)と送信レコード数(Sum)',
      left: [
        new cw.Metric({
          namespace: this.shardCountMetricsKeys.namespace,
          metricName: this.shardCountMetricsKeys.metricName,
          dimensionsMap: {
            dataStreamName: this.dataStream.streamName
          }
        })
      ],
      right: [incommingRecordsPerMinMetrics],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.MAXIMUM,
      leftYAxis: { min: 0 },
      rightYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const writeProvisionedThroughputExceededBytesWid = new cw.GraphWidget({
      title: '書き込み制限エラー数(Sum)と分あたり送信レコードByte(Sum)',
      left: [
        this.dataStream.metricPutRecordsThrottledRecords({
          statistic: cw.Stats.SUM,
          period: Duration.minutes(1)
        })
      ],
      right: [incommingBytesPerMinMetrics],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      rightYAxis: { min: 0 },
      period: Duration.minutes(1)
    })
    const writeProvisionedThroughputExceededRecordsWid = new cw.GraphWidget({
      title: '書き込み制限エラー数(Sum)と分あたり送信レコード数(Sum)',
      left: [
        this.dataStream.metricPutRecordsThrottledRecords({
          statistic: cw.Stats.SUM,
          period: Duration.minutes(1)
        })
      ],
      right: [incommingRecordsPerMinMetrics],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      rightYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const readProvisionedThroughputExceededWid = new cw.GraphWidget({
      title: '読み込み制限エラー数(Sum)',
      left: [this.dataStream.metricReadProvisionedThroughputExceeded()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const iteratorAgeMillisecondsWid = new cw.GraphWidget({
      title: 'データストリーム内での待機時間(Max, p99, Avg, Min)',
      left: [
        this.dataStream.metricGetRecordsIteratorAgeMilliseconds({ statistic: cw.Stats.MAXIMUM }),
        this.dataStream.metricGetRecordsIteratorAgeMilliseconds({
          statistic: cw.Stats.percentile(99)
        }),
        this.dataStream.metricGetRecordsIteratorAgeMilliseconds({ statistic: cw.Stats.AVERAGE }),
        this.dataStream.metricGetRecordsIteratorAgeMilliseconds({ statistic: cw.Stats.MINIMUM })
      ],
      width: this.defaultWidth,
      height: this.defaultHeight,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })
    return {
      titleWid,
      putRecordsFailedRecordsWid,
      putRecordsThrottledRecordWid,
      writeProvisionedThroughputExceededBytesWid,
      writeProvisionedThroughputExceededRecordsWid,
      readProvisionedThroughputExceededWid,
      iteratorAgeMillisecondsWid,
      shardCountWid
    }
  }

  /**
   * LambdaのWidgetsを作成する
   * @returns
   */
  createLambdaWidgets(): LambdaSectionWidgets {
    // Title
    const titleWid = new cw.TextWidget({
      markdown: '# Lambda Metrics',
      height: 2,
      width: 24
    })

    const invocationsWid = new cw.GraphWidget({
      title: '関数起動数(Sum)',
      left: [this.lambdaFunction.metricInvocations()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const durationWid = new cw.GraphWidget({
      title: '関数実行時間(Max, p99, Avg, Min)',
      left: [
        this.lambdaFunction.metricDuration({ statistic: cw.Stats.MAXIMUM }),
        this.lambdaFunction.metricDuration({ statistic: cw.Stats.percentile(99) }),
        this.lambdaFunction.metricDuration({ statistic: cw.Stats.AVERAGE }),
        this.lambdaFunction.metricDuration({ statistic: cw.Stats.MINIMUM })
      ],
      width: this.defaultWidth,
      height: this.defaultHeight,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const concurrentExecutionWid = new cw.GraphWidget({
      title: '関数同時実行数(Max)',
      left: [
        new cw.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'ConcurrentExecutions',
          dimensionsMap: {
            FunctionName: this.lambdaFunction.functionName
          }
        })
      ],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.MAXIMUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const memoryUtilizationWid = new cw.GraphWidget({
      title: 'メモリ使用率(Max)',
      left: [
        new cw.Metric({
          namespace: 'LambdaInsights',
          metricName: 'memory_utilization',
          dimensionsMap: {
            function_name: this.lambdaFunction.functionName
          },
          statistic: cw.Stats.MAXIMUM
        })
      ],
      width: this.defaultWidth,
      height: this.defaultHeight,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const errorsWid = new cw.GraphWidget({
      title: 'エラー数(Sum)',
      left: [this.lambdaFunction.metricErrors()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const throttlesWid = new cw.GraphWidget({
      title: 'スロットリング発生数(Sum)',
      left: [this.lambdaFunction.metricErrors()],
      width: this.defaultWidth,
      height: this.defaultHeight,
      statistic: cw.Stats.SUM,
      leftYAxis: { min: 0 },
      period: Duration.minutes(1)
    })

    const createCustomMetrics = (statistic: string): cw.Metric => {
      return new cw.Metric({
        namespace: this.batchSizeMetricsKeys.namespace,
        metricName: this.batchSizeMetricsKeys.metricName,
        dimensionsMap: {
          functionName: this.lambdaFunction.functionName
        },
        statistic
      })
    }
    const batchSizeWid = new cw.GraphWidget({
      title: 'バッチサイズ：関数あたりの処理レコード数(Max, Avg, Min)',
      left: [
        createCustomMetrics(cw.Stats.MAXIMUM),
        createCustomMetrics(cw.Stats.AVERAGE),
        createCustomMetrics(cw.Stats.MINIMUM)
      ],
      width: this.defaultWidth,
      height: this.defaultHeight,
      leftYAxis: { min: 0 },
      rightYAxis: { min: 0 }
    })

    return {
      titleWid,
      invocationsWid,
      durationWid,
      concurrentExecutionWid,
      memoryUtilizationWid,
      errorsWid,
      throttlesWid,
      batchSizeWid
    }
  }

  /**
   * Producer, Consumerのコード実行時に出力されたログのWidgetsを作成する
   * @returns
   */
  createLogsWidgets(): LogsSectionWidgets {
    // Title
    const titleWid = new cw.TextWidget({
      markdown: '# Logs',
      height: 1,
      width: 24
    })

    const producerTitleWid = new cw.TextWidget({
      markdown: `# Producer
API GWに対してリクエストを送信するクライアントスクリプトのログ情報
- Success_Requests: 送信成功したリクエスト数, 「Success_Requests * レコード数(/request) = Success_Records」なら欠損レコードなし
- Retried_Requests: リトライしたリクエスト数
- Failed_Requests: 送信できなかったリクエスト数、1つでもあれば欠損あり
`,
      height: 4,
      width: 12
    })
    const consumerTitleWid = new cw.TextWidget({
      markdown: `# Consumer
Lambda関数から出力されるログの情報
- Success_Records: 処理が正常に完了したレコード数
- Duplicated_Records: DynamoDBのPK重複エラー数
- Failed_Records: レコード重複以外のエラー数(Dynamoのスロットリングなど)、リトライの対象
`,
      height: 4,
      width: 12
    })

    // Client Script Logs
    const clientScriptLogTableWid = new cw.LogQueryWidget({
      title: 'Producer側スクリプトログサマリ(Sum)',
      logGroupNames: ['/apigw/client/putRecords'],
      view: cw.LogQueryVisualizationType.TABLE,
      queryLines: [
        'fields @message',
        'parse @message "SUCCESS:" as @Success',
        'parse @message "RETRY:" as @Retry',
        'parse @message "FAILED" as @Failed',
        'stats count(@Success) as Success_Requests, count(@Retry) as Retried_Requests, count(@Failed) as Failed_Requests'
      ],
      width: this.defaultWidth,
      height: 3
    })

    // スロットリングエラー以外のログ詳細を表示
    const clientScriptLogWid = new cw.LogQueryWidget({
      title: 'Producer側スクリプトエラーログ詳細: スロットリングエラーを除く',
      logGroupNames: ['/apigw/client/putRecords'],
      view: cw.LogQueryVisualizationType.TABLE,
      queryLines: [
        'fields @message',
        'filter @message like "Request failed with status code"',
        'filter @message not like "Request failed with status code 400"'
      ],
      width: this.defaultWidth,
      height: 15
    })

    // Lambda Function Logs
    const lambdaFunctionLogTableWid = new cw.LogQueryWidget({
      title: 'Consumer側スクリプトログサマリ(Sum)',
      logGroupNames: [`/aws/lambda/${this.lambdaFunction.functionName}`],
      view: cw.LogQueryVisualizationType.TABLE,
      queryLines: [
        'fields @message',
        'parse @message "SUCCESS:" as @Success',
        'parse @message "DUPLICATED:" as @Duplicated',
        'parse @message "FAILED" as @Failed',
        'stats count(@Success) as Success_Records, count(@Duplicated) as Duplicated_Records, count(@Failed) as Failed_Records'
      ],
      width: this.defaultWidth,
      height: 3
    })

    // Lambda処理失敗時のログ詳細を表示
    const lambdaFunctionLogWid = new cw.LogQueryWidget({
      title: 'Consumer側スクリプトエラーログ詳細',
      logGroupNames: [`/aws/lambda/${this.lambdaFunction.functionName}`],
      view: cw.LogQueryVisualizationType.TABLE,
      queryLines: ['fields @message', 'filter @message like "FAILED:"'],
      width: this.defaultWidth,
      height: 15
    })

    return {
      titleWid,
      producerTitleWid,
      consumerTitleWid,
      clientScriptLogTableWid,
      clientScriptLogWid,
      lambdaFunctionLogTableWid,
      lambdaFunctionLogWid
    }
  }
}
