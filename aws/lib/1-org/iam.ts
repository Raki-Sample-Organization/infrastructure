import * as aws from '@pulumi/aws'


export class IAM {
    public readonly devOpsAdminRole!: aws.iam.Role

    constructor(private readonly environment: string) {
        const devOpsAdminRole = this.setDevOpsAdminRole()
        this.setDevOpsAdminRolePolicy(devOpsAdminRole)
        this.setDevOpsAdminGroup(devOpsAdminRole)
        
        this.devOpsAdminRole = devOpsAdminRole
    }


    private setDevOpsAdminRole = (): aws.iam.Role =>
        new aws.iam.Role('devops-admin', {
            name: `${this.environment}-devops-admin`,
            assumeRolePolicy: aws.getCallerIdentity().then(_ => aws.iam.assumeRolePolicyForPrincipal({ AWS: `arn:aws:iam::${_.accountId}:root` }))
        })


    private setDevOpsAdminGroup = (role: aws.iam.Role): aws.iam.Group => {
        const group = new aws.iam.Group('devops-admin', { name: `${this.environment}-devops-admin` })
        new aws.iam.GroupPolicy('devops-admin', {
            name: `${this.environment}-devops-admin`,
            group: group.name,
            policy: aws.iam.getPolicyDocumentOutput({
                statements: [{
                    sid: 'AllowAssumeOrganizationAccountRole',
                    actions: ['sts:AssumeRole'],
                    resources: [role.arn]
                }],
            }).json
        })
        return group
    }


    private setDevOpsAdminRolePolicy = (role: aws.iam.Role): aws.iam.RolePolicy =>
        new aws.iam.RolePolicy('devops-admin', {
            role,
            policy: aws.iam.getPolicyDocumentOutput({
                statements: [
                    {
                        actions: [
                            "iam:*",
                            "s3:*",
                            "ec2:*",
                            "kms:*",
                            "eks:*",
                            "ssm:*",
                            "autoscaling:*",
                            "cloudformation:*"
                        ],
                        resources: ["*"],
                    }
                ],
            }).json
        })
}
