# Starter AWS CDK template for MediaWiki

This is a starter template for deploying MediaWiki with CDK to AWS. The intent of this it to provide a secure and scalable way to get started without having
to go through the pains manually setting up these resources.

## Getting started

1. [Fork](https://github.com/themcaffee/mediawiki-aws/fork) this project or use it as a template (`Use this template` button above)
1. Ensure you have your AWS CLI credentials setup (`aws configure`)
1. Create the Route53 Zone and ACM certificate through the console (or other means). 
1. Copy `.env.example` to `.env` and set the parameters. 
1. Install dependencies: `npm install`
1. Configure non-secret parameters in `bin/mediawiki.ts`
1. Deploy to AWS: `npx cdk deploy MediaWikiDev`
1. Visit your site to go through the [setup](https://www.mediawiki.org/wiki/Manual:Config_script). This will create the necessary database tables and only need to happen the first deployment.
1. Do not use the downloaded `LocalSettings.php` file in place of your original one. The `LocalSettings.php` downloaded will contain plain text
   credentials that should not be commited to git.

## Roadmap

- [ ] Shared EFS between containers for images
- [ ] Images on S3
- [ ] Optimize Cloudfront caching

## Development 

### Useful commands

* `npm run build`   compile typescript to js
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

### Relevant documentation

* [Installing MediaWiki](https://www.mediawiki.org/wiki/Manual:Installing_MediaWiki)
* [How to debug](https://www.mediawiki.org/wiki/Manual:How_to_debug)
* [LocalSettings.php Manual](https://www.mediawiki.org/wiki/Manual:LocalSettings.php/tcy)
* [mediawiki-docker](https://www.mediawiki.org/wiki/MediaWiki-Docker)
* [CDK V2 Docs](https://docs.aws.amazon.com/cdk/api/v2/)