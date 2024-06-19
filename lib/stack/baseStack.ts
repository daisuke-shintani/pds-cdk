import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as kms from 'aws-cdk-lib/aws-kms'

interface BaseStackProps extends StackProps {
  /** プレフィックス */
  prefix: string
  // メールアドレス
  snsNotificationEmail: string
}

/**
 * ステートフルなリソースを構築する
 */
export class BaseStack extends Stack {
  public readonly snsTopic: sns.Topic
  public readonly snsSubscription: sns.Subscription
  public readonly snsAction: cw_actions.SnsAction
  public readonly pdsEndpoint: ec2.InterfaceVpcEndpoint
  public readonly riyotsuchikeys: kms.Key
  public readonly riyokakuninkeys: kms.Key

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props)

    /*
    * SNSトピック
    -------------------------------------------------------------------------- */
    this.snsTopic = new sns.Topic(this, 'snsTopic', {
      topicName: `${props.prefix}-sns-notification`
    })

    /*
    * SNSサブスクリプション
    -------------------------------------------------------------------------- */
    this.snsSubscription = new sns.Subscription(this, 'snsSubscription', {
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: this.snsTopic,
      endpoint: props.snsNotificationEmail
    })

    // Snsアクション
    this.snsAction = new cw_actions.SnsAction(this.snsTopic)

    // データストリーミング基盤のVPCエンドポイントを作成
    // ----------------------------------------------------------------------------
    const pdsVPC = ec2.Vpc.fromVpcAttributes(this, 'pdsVpc', {
      availabilityZones: ['us-east-2a', 'us-east-2b'],
      vpcId: 'vpc-0fab1df1fc8a14e86',
      vpcCidrBlock: '10.0.0.0/16',
      publicSubnetIds: ['subnet-02fe6d1605c236b7a', 'subnet-04119df26f6d916ce'],
      privateSubnetIds: ['subnet-028e0406568d47e8b', 'subnet-0922cd74861737b45']
    })

    this.pdsEndpoint = pdsVPC.addInterfaceEndpoint('pdsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY
    })

    // 利用通知用KMSの作成
    // customerキーの作成
    this.riyotsuchikeys = new kms.Key(this, 'CustomerKey', {
      // admins: [new iam.AccountPrincipal(props.crossAccountId)],
      alias: `${props.prefix}-kms-riyotsuchi`,
      rotationPeriod: Duration.days(365),
      pendingWindow: Duration.days(7),
      removalPolicy: RemovalPolicy.DESTROY,
      description: 'for riyotsuchi kds encryption'
    })
  }
}
