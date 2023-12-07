# Starter AWS CDK template for MediaWiki

This is a starter template for deploying MediaWiki with CDK to AWS. The intent of this it to provide a secure and scalable way to get started without having
to go through the pains manually setting up these resources.

## Getting started

1. Ensure you have your AWS CLI credentials setup (`aws configure`)
1. Create the Route53 Zone and ACM certificate through the console (or other means). 
1. Copy `.env.example` to `.env` and set the parameters. 
1. Install dependencies: `npm install`
1. Configure non-secret parameters in `bin/mediawiki.ts`
1. Deploy to AWS: `npx cdk deploy MediaWikiDev`

## Roadmap

- [ ] Shared EFS between containers for images
- [ ] Images on S3

## Development 

### Useful commands

* `npm run build`   compile typescript to js
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
