#!/usr/bin/env node

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MediaWikiStack } from '../lib/mediawiki-stack';

const environmentVariables = [
  'CDK_DEFAULT_ACCOUNT',
  'CDK_DEFAULT_REGION',
  'HOSTED_ZONE_ID',
  'ZONE_NAME',
  'ACM_CERTIFICATE_ARN',
  'MEDIAWIKI_SECRET_STRING',
  'MEDIAWIKI_UPGRADE_KEY',
];

// Check if environment variables are set
const missingVariables = environmentVariables.filter((variable) => !process.env[variable]);
if (missingVariables.length > 0) {
  throw new Error(`Missing environment variables: ${missingVariables.join(', ')}`);
}

const app = new cdk.App();
new MediaWikiStack(app, 'MediaWikiDev', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  hostedZoneId: process.env.HOSTED_ZONE_ID || '',
  zoneName: process.env.ZONE_NAME || '',
  acmCertificateArn: process.env.ACM_CERTIFICATE_ARN || '',
  mediawiki: {
    secretString: process.env.MEDIAWIKI_SECRET_STRING || '',
    upgradeKey: process.env.MEDIAWIKI_UPGRADE_KEY || '',
  }
});