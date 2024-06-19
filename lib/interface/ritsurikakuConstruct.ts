import type * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions'

export interface ritsurikakuConstruct {
  // SNSアクション
  snsAction: cw_actions.SnsAction
  // VPCエンドポイント
  vpcEndpointId: {
    dx: string
  }
}
