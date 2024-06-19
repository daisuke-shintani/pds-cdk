import { Stack, type StackProps, Tags } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { KdsPrivateApitGw } from '../construct/kdsPrivateApiGw'
import { KdsDataStream } from '../construct/kdsDataStream'
import { KdsDashboard } from '../construct/kdsDashboard'
import { type commonConstruct } from '../interface/commonConstruct'
import { type ritsurikakuConstruct } from '../interface/ritsurikakuConstruct'
import * as kds from 'aws-cdk-lib/aws-kinesis'

interface RiyokakuninApiGwKdsStackProps extends StackProps, commonConstruct, ritsurikakuConstruct {}

// API GW - Lambda構成
export class RiyokakuninApiGwKdsStack extends Stack {
  constructor(scope: Construct, id: string, props: RiyokakuninApiGwKdsStackProps) {
    super(scope, id, props)
    Tags.of(this).add('projectName', 'riyokakunin')

    // DataStreams-----------------------------------------------------------------------
    const kdsStream = new KdsDataStream(this, 'riyokakuninDataStream', {
      prefix: props.prefix,
      projectName: props.projectName,
      snsAction: props.snsAction,
      streamMode: kds.StreamMode.PROVISIONED
    })

    // 外部エンドポイント取得----------------------------------------------------------------------
    // DX基盤アカウントエンドポイント
    const dxEndpoint = ec2.InterfaceVpcEndpoint.fromInterfaceVpcEndpointAttributes(
      this,
      'dxEndPoint',
      {
        port: 443,
        vpcEndpointId: props.vpcEndpointId.dx
      }
    )
    // データストリーミング基盤アカウントエンドポイント
    // const dataStreamingEndpoint = ec2.InterfaceVpcEndpoint.fromInterfaceVpcEndpointAttributes(
    //   this,
    //   'dataStreamingEndPoint',
    //   {
    //     port: 443,
    //     vpcEndpointId: props.vpcEndpointId.dataStreamingVpcEndPointId
    //   }
    // )

    // PrivateApiGw----------------------------------------------------------------------
    const privateApi = new KdsPrivateApitGw(this, 'riyokakuninApiGW', {
      // APIGWと統合するデータストリーム
      dataStream: kdsStream.dataStream,
      // VPCのエンドポイント
      vpcEndpoint: {
        dx: dxEndpoint
      },
      // APIGWの設定
      apiGw: {
        /** リソースパス名 */
      },
      // 環境識別子
      prefix: props.prefix,
      // プロジェクト名
      projectName: props.projectName,
      // SNSアクション
      snsAction: props.snsAction
    })

    // Dashboard----------------------------------------------------------------------------
    new KdsDashboard(this, 'riyokakuninDashboard', {
      //  restAPI
      restApi: privateApi.restApi,
      // kds
      dataStream: kdsStream.dataStream,
      // 環境識別子
      prefix: props.prefix,
      projectName: props.projectName
    })
  }
}
