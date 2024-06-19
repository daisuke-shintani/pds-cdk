import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import {
  KinesisClient,
  DescribeStreamSummaryCommand,
  ListStreamsCommand,
  StreamMode,
  type StreamDescriptionSummary
} from '@aws-sdk/client-kinesis'

const region = process.env.AWS_DEFAULT_REGION

if (process.env.NAMESPACE === undefined) {
  throw new Error('namespace is not defined')
}
if (process.env.METRIC_NAME === undefined) {
  throw new Error('metric name is not defined')
}

// Kinesis クライアントを作成
const kinesisClient = new KinesisClient({ region })

/**
 * ハンドラー関数
 * @param event
 */
export const handler = async (event: unknown): Promise<any> => {
  // データストリームのリストを取得
  const dataStreamNames: string[] = await listStreams()

  for (const dataStreamName of dataStreamNames) {
    // ストリーム情報を取得
    const streamSummary: StreamDescriptionSummary = await getStreamSummary(dataStreamName)
    if (streamSummary.StreamModeDetails?.StreamMode === StreamMode.PROVISIONED) {
      // プロビジョンドモードは対象外
      continue
    }
    if (streamSummary.OpenShardCount === undefined) {
      continue
    }
    const shardCount: number = streamSummary.OpenShardCount

    try {
      // CloudWatch にメトリクスを送信
      await sendMetricToCloudWatch(dataStreamName, shardCount)
      console.log('successfully sent custom metrics to CloudWatch:', dataStreamName, shardCount)
    } catch (error) {
      console.error('failed to send custom metrics to CloudWatch', error)
    }
  }
}

/**
 * データストリーム名のリストを取得
 * @returns
 */
async function listStreams(): Promise<string[]> {
  const command = new ListStreamsCommand()
  const response = await kinesisClient.send(command)
  if (response.StreamNames === undefined) {
    throw new Error('failed to ListStreamsCommand')
  }

  return response.StreamNames
}

/**
 * データストリームの情報を取得
 * @returns
 */
async function getStreamSummary(dataStreamName: string): Promise<StreamDescriptionSummary> {
  // DescribeStreamSummary コマンドを作成して実行
  const command = new DescribeStreamSummaryCommand({ StreamName: dataStreamName })
  const response = await kinesisClient.send(command)
  if (response.StreamDescriptionSummary === undefined) {
    throw new Error('failed to DescribeStreamSummaryCommand')
  }

  return response.StreamDescriptionSummary
}

/**
 * メトリクスデータを送信する
 * @param metricValue
 */
async function sendMetricToCloudWatch(dataStreamName: string, metricValue: number): Promise<void> {
  const cloudwatchClient = new CloudWatchClient({ region })
  const command = new PutMetricDataCommand({
    Namespace: process.env.NAMESPACE,
    MetricData: [
      {
        MetricName: process.env.METRIC_NAME,
        Value: metricValue,
        Unit: 'Count',
        Dimensions: [{ Name: 'dataStreamName', Value: dataStreamName }]
      }
    ]
  })
  await cloudwatchClient.send(command)
}
