import { type Stack, type StageProps, Tags } from 'aws-cdk-lib'
import { type Construct } from 'constructs'

import { devConfig } from '../../config'
import { StageBase } from './stageBase'

export class DevStage extends StageBase {
  public readonly stacks: Record<string, Stack>
  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props)
    this.stacks = this.createStacks()

    // tag
    Tags.of(this).add('ManagedBy', 'pds')
    Tags.of(this).add('Project', 'Riyotsuchikakunin')
  }

  createStacks(): Record<string, Stack> {
    return {
      ...super.createStacks(this, devConfig)
    }
  }
}
