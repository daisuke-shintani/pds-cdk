import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import type * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as logs from 'aws-cdk-lib/aws-logs'
import { type RestApi } from 'aws-cdk-lib/aws-apigateway'
import { type Stream } from 'aws-cdk-lib/aws-kinesis'

import type * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import type * as cw from 'aws-cdk-lib/aws-cloudwatch'
import { type commonConstruct } from '../interface/commonConstruct'

interface KdsPrivateApitGwProps extends commonConstruct {
  // アラーム設定
  serverErrorOps?: cw.CreateAlarmOptions
  latencyOps?: cw.CreateAlarmOptions
  // APIGWと統合するデータストリーム
  dataStream: Stream
  // VPCのエンドポイント
  vpcEndpoint: {
    dx: ec2.IInterfaceVpcEndpoint
  }
  // APIGWの設定
  apiGw: {
    /** リソースパス名 */
    // resourcePathName: string
    deployOption?: apigw.StageOptions
    awsIntegration?: apigw.AwsIntegration
    methodOptions?: apigw.MethodOptions
  }

  // SNSアクション
  snsAction: cw_actions.SnsAction
}

export class KdsPrivateApitGw extends Construct {
  public readonly restApi: RestApi
  private readonly endPoint: ec2.IInterfaceVpcEndpoint[] = []

  constructor(scope: Construct, id: string, props: KdsPrivateApitGwProps) {
    super(scope, id)

    // IAM
    // ----------------------------------

    // IAMロール作成
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonAPIGatewayPushToCloudWatchLogs'
        )
      ]
    })
    // KDSへの読み取り書き込みを許可するポリシーをロールに付与
    props.dataStream.grantReadWrite(role)

    // APIGW設定
    // ---------------------------

    // アクセスログ作成 TODO 追記
    const accessLogGroup = new logs.LogGroup(this, 'LogGroup')

    // デプロイオプション
    props.apiGw.deployOption ??= {
      stageName: props.prefix,
      dataTraceEnabled: true, // 実行ログ
      loggingLevel: apigw.MethodLoggingLevel.ERROR, // 実行ログ出力レベル
      accessLogDestination: new apigw.LogGroupLogDestination(accessLogGroup), // アクセスログ出力先
      accessLogFormat: apigw.AccessLogFormat.clf(), // アクセスログフォーマット
      metricsEnabled: true // 詳細
    }

    // メソッドリクエスト, レスポンス
    props.apiGw.methodOptions ??= {
      authorizationType: apigw.AuthorizationType.IAM,
      methodResponses: [
        {
          statusCode: '200'
        },
        {
          statusCode: '500'
        }
      ]
    }

    // 統合設定
    props.apiGw.awsIntegration ??= new apigw.AwsIntegration({
      service: 'kinesis',
      action: 'PutRecords',
      integrationHttpMethod: 'POST',
      options: {
        requestParameters: {
          'integration.request.header.Content-Type': "'x-amz-json-1.1'"
        },
        credentialsRole: role,
        passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_TEMPLATES,
        requestTemplates: {
          'application/json': `
{
  "StreamName": "${props.dataStream.streamName}",
  "Records": [
    #foreach($elem in $input.path('$.records'))
      {
        "Data": "$util.base64Encode($elem.Data)",
        "PartitionKey": "$elem.PartitionKey"
      }#if($foreach.hasNext),#end
      #end
  ]
}`
        },
        integrationResponses: [
          {
            statusCode: '200',
            selectionPattern: '200',
            responseTemplates: {
              'application/json': `{
"Code": "200",
"Message": "OK",
"FailedRecordCount": "$input.path('$.FailedRecordCount')"
}
#if($input.path('$.FailedRecordCount') != '0')
#set($context.responseOverride.status = 500)
#end`
            }
          },
          {
            statusCode: '500',
            selectionPattern: '5d{2}',
            responseTemplates: {
              // eslint-disable-next-line @typescript-eslint/quotes
              'application/json': `{
"Code": "500",
"Message": "OK",
"FailedRecordCount": "$input.path('$.FailedRecordCount')"
}`
            }
          }
        ]
      }
    })

    // エンドポイントの追加（dvpcエンドポイントは任意のため）
    this.endPoint.push(props.vpcEndpoint.dx)

    // this.endPoint.push(props.vpcEndpoint.dataStreamingVpcEndPoint)

    // RestAPI作成
    this.restApi = new apigw.RestApi(this, 'Resource', {
      restApiName: `${props.prefix}-api-${props.projectName}`,
      deployOptions: props.apiGw.deployOption,
      endpointConfiguration: {
        types: [apigw.EndpointType.PRIVATE],
        vpcEndpoints: this.endPoint
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*']
          })
        ]
      })
    })
    // エンドポイントの追加
    const streamResource = this.restApi.root.addResource('streams')
    streamResource.addMethod('PUT', props.apiGw.awsIntegration, props.apiGw.methodOptions)

    // メトリクスアラームカウント
    // デフォルト設定
    props.serverErrorOps ??= {
      alarmName: `${props.prefix}-cloudwatch-alarm-api-serverError-${props.projectName}-warn`,
      evaluationPeriods: 10,
      threshold: 45
    }
    const serverErrorMetric = this.restApi.metricServerError()
    serverErrorMetric
      .createAlarm(this, '5xxAlarm', props.serverErrorOps)
      .addAlarmAction(props.snsAction)

    // メトリクスアラームレイテンシー
    // デフォルト設定
    props.latencyOps ??= {
      alarmName: `${props.prefix}-cloudwatch-alarm-api-latency-${props.projectName}-warn`,
      evaluationPeriods: 10,
      threshold: 45
    }
    const latencyMetric = this.restApi.metricLatency()
    latencyMetric.createAlarm(this, 'latency', props.latencyOps).addAlarmAction(props.snsAction)
  }
}
