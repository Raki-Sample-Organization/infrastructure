import * as aws from '@pulumi/aws'
import * as eks from '@pulumi/eks'
import * as pulumi from '@pulumi/pulumi'
import { ArgoCD } from './argocd'
import { CrossplaneUser } from './crossplane-user'
import { Network } from './network'


export interface EksClusterProps {
    network: Network,
    adminRoles: aws.iam.Role[]
}


export class EksCluster {
    public readonly eksCluster!: eks.Cluster

    constructor(config: pulumi.Config, private readonly environment: string, private readonly props: EksClusterProps) {
        const defaultInstanceRole = this.setDefaultInstanceRole()
        const eksCluster = this.setEksCluster(defaultInstanceRole)
        const nodegroup = this.setDefaultNodeGroup(eksCluster, defaultInstanceRole)
        new ArgoCD({config, environment, provider: eksCluster.provider, dependencies: [eksCluster, nodegroup]})
        new CrossplaneUser({environment, provider: eksCluster.provider, dependencies: [eksCluster, nodegroup]})

        this.eksCluster = eksCluster
    }


    private clusterName = (): string => `${this.environment}-apps`


    private setDefaultInstanceRole = (): aws.iam.Role => {
        // Create Role
        const role = new aws.iam.Role(`${this.clusterName()}-default-nodegroup`, {
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                Service: 'ec2.amazonaws.com'
            })
        })
        // Add policies to role
        Array.from([
            'arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy',
            'arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy',
            'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly'
        ]).forEach((policyArn, index) =>
            new aws.iam.RolePolicyAttachment(`${this.clusterName()}-default-nodegroup-${index}`, { policyArn, role })
        )
        return role
    }


    private setEksCluster = (instanceRole: aws.iam.Role): eks.Cluster =>
        new eks.Cluster(this.clusterName(), {
            name: this.clusterName(),
            vpcId: this.props.network.vpc.id,
            publicSubnetIds: this.props.network.publicSubnets.map(_ => _.id),
            privateSubnetIds: this.props.network.privateSubnets.map(_ => _.id),
            endpointPrivateAccess: true,
            version: '1.21',
            providerCredentialOpts: {
                profileName: aws.config.profile
            },
            instanceRoles: [instanceRole],
            skipDefaultNodeGroup: true,
            roleMappings: this.props.adminRoles.map(_ => ({
                groups: ['system:masters'],
                roleArn: _.arn,
                username: 'admin'
            }))
        })


    private setDefaultNodeGroup = (cluster: eks.Cluster, instanceRole: aws.iam.Role): eks.ManagedNodeGroup =>
        new eks.ManagedNodeGroup(`${this.clusterName()}-default`, {
            cluster,
            capacityType: 'SPOT',
            instanceTypes: [aws.ec2.InstanceType.T3_Medium],
            nodeRoleArn: instanceRole.arn,
            diskSize: 5,
            scalingConfig: {
                desiredSize: 2,
                minSize: 2,
                maxSize: 4
            },
            labels: {
                nodegroup: `${this.clusterName()}-default`
            }
        })
}
