#!/usr/bin/env node
import { devConfig } from '../config'
import { DevStage } from '../lib/stage/devStage'
import { App, Aspects, Stack } from 'aws-cdk-lib'
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag'
import { nagSuppressions } from '../lib/nagSuppressions'

const app = new App()

new DevStage(app, 'dev', {
  env: devConfig.env
})

// cdk-nagによるセキュリティチェック
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))
for (const node of app.node.children) {
  if (Stack.isStack(node)) {
    NagSuppressions.addStackSuppressions(node, nagSuppressions)
  }
}
