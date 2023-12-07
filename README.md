# Starter AWS CDK template for Mediawiki

## Getting started

Create the Route53 Zone and ACM certificate through the console (or other means). Copy `.env.example` to `.env` and put in the appropriate values. 

## Development 

### Useful commands

* `npm run build`   compile typescript to js
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
