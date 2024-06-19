import { type Template } from 'aws-cdk-lib/assertions'
import { App } from 'aws-cdk-lib'

import { devConfig } from '../../config'
import { DevStage } from '../../lib/stage/devStage'
import * as testHelper from '../testHelper'

const app = new App()
const stage = new DevStage(app, 'dev', {
  env: devConfig.env
})
const templates: Record<string, Template> = testHelper.createTemplates(stage.stacks)

testHelper.executeSecurityTests(templates)
