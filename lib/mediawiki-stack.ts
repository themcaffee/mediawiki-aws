import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Credentials } from 'aws-cdk-lib/aws-rds';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

interface MediaWikiStackProps extends cdk.StackProps {
  // Route53 Hosted Zone ID
  hostedZoneId: string;
  // Domain name
  zoneName: string;
  // ACM Certificate ARN
  acmCertificateArn: string;
  mediawiki: {
    secretString: string;
    upgradeKey: string;
  };
  // Stage. Default to dev
  stage?: string;
  // Subdomain. Default to stage
  subdomain?: string;
  database?: {
    // Database name. Default to mediawiki
    dbName?: string;
    // Database username. Default to mediawiki
    username?: string;
  },
  scaling?: {
    // Min capacity of instances. Default to 1
    minCapacity?: number;
    // Max capacity of instances. Default to 1
    maxCapacity?: number;
    // CPU. Default to 256
    cpu?: number;
    // Memory limit in MiB. Default to 512
    memoryLimitMiB?: number;
  };
}

export class MediaWikiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MediaWikiStackProps) {
    super(scope, id, props);

    // Set default stage to dev
    props.stage = props.stage || 'dev';
    const isProduction = props.stage === 'prod';

    // Set default subdomain to stage
    props.subdomain = props.subdomain || props.stage;
    props.database = props.database || {};
    props.database.dbName = props.database.dbName || 'mediawiki';
    // VPC
    const vpc = new ec2.Vpc(this, 'MediaWikiVPC', {
      maxAzs: 2 // Use 2 Availability Zones for high availability
    });

    const dbSecret = new rds.DatabaseSecret(this, 'MediaWikiDbSecret', {
      username: props.database.username || 'mediawiki',
      dbname: props.database.dbName,
    });

    // Create a security group for the Aurora cluster
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'MediaWikiDbSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(3306), 'Allow ECS Service to access Aurora Cluster');

    // Aurora Cluster
    const auroraCluster = new rds.ServerlessCluster(this, 'MediaWikiAuroraCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      vpc,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      defaultDatabaseName: props.database.dbName,
      credentials: Credentials.fromSecret(dbSecret),
      scaling: {
        maxCapacity: props.scaling?.maxCapacity || 1,
        minCapacity: props?.scaling?.minCapacity || 1,
      },
      securityGroups: [dbSecurityGroup],
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'MediaWikiCluster', {
      vpc,
    });

    // ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'MediaWikiTaskDefinition', {
      memoryLimitMiB: props.scaling?.memoryLimitMiB || 512,
      cpu: props.scaling?.cpu || 256,
    });

    const image = new DockerImageAsset(this, 'MediaWikiImage', {
      directory: '.',
    });

    // Store MediaWiki upgrade key and secret string in SSM Parameter Store
    const upgradeKeySsm = new ssm.StringParameter(this, 'MediaWikiUpgradeKey', {
      parameterName: `/mediawiki/${props.stage}/upgrade-key`,
      stringValue: props.mediawiki.upgradeKey,
    });
    const secretStringSsm = new ssm.StringParameter(this, 'MediaWikiSecretString', {
      parameterName: `/mediawiki/${props.stage}/secret-string`,
      stringValue: props.mediawiki.secretString,
    });

    const container = new ecs.ContainerDefinition(this, 'MediaWikiContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      taskDefinition,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: `mediawiki-${props.stage}` }),
      environment: {
        MEDIAWIKI_DB_HOST: auroraCluster.clusterEndpoint.hostname,
        MEDIAWIKI_SERVER: `//${props.subdomain}.${props.zoneName}`,
      },
      secrets: {
        MEDIAWIKI_DB_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        MEDIAWIKI_DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        MEDIAWIKI_DB_NAME: ecs.Secret.fromSecretsManager(dbSecret, 'dbname'),
        MEDIAWIKI_SECRET_STRING: ecs.Secret.fromSsmParameter(secretStringSsm),
        MEDIAWIKI_UPGRADE_KEY: ecs.Secret.fromSsmParameter(upgradeKeySsm),
      }
    });

    container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    const albFargateService = new cdk.aws_ecs_patterns.ApplicationLoadBalancedFargateService(this, 'MediaWikiService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    albFargateService.targetGroup.configureHealthCheck({
      path: '/',
      port: '80',
      healthyHttpCodes: '200',
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      timeout: cdk.Duration.seconds(20),
      interval: cdk.Duration.seconds(60),
    });

    albFargateService.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '30');

    // Allow ECS Service to connect to Aurora
    auroraCluster.connections.allowFrom(cluster, ec2.Port.tcp(3306), 'Allow ECS Service to connect to Aurora');

    // CloudFront Distribution
    const cloudFrontDistribution = new cloudfront.CloudFrontWebDistribution(this, 'MediaWikiCloudFront', {
      originConfigs: [
        {
          customOriginSource: {
            domainName: albFargateService.loadBalancer.loadBalancerDnsName,
            originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          },
          behaviors: [{ isDefaultBehavior: true}],
        },
      ],
      // Set CloudFront price class based on production flag
      priceClass: isProduction ? cloudfront.PriceClass.PRICE_CLASS_100 : cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultRootObject: '',
      viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(
        acm.Certificate.fromCertificateArn(this, 'AcmCertificate', props.acmCertificateArn),
        {
          sslMethod: cloudfront.SSLMethod.SNI,
          securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2019,
        }
      ),
    });

    // Route 53 Hosted Zone
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'MediaWikiHostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    // Route 53 Record Set
    new route53.ARecord(this, 'MediaWikiAliasRecord', {
      zone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(cloudFrontDistribution)),
      recordName: props.subdomain,
    });
  }
}