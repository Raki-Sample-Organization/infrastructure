import * as aws from '@pulumi/aws'


export class IAM {
    public readonly devOpsAdminRole!: aws.iam.Role
    public readonly devOpsAdminGroup!: aws.iam.Group

    constructor(private readonly environment: string) {
        this.devOpsAdminRole = this.setDevOpsAdminRole()
        this.devOpsAdminGroup = this.setDevOpsAdminGroup(this.devOpsAdminRole)
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
}
