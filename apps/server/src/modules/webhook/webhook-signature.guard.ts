import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GitPlatform } from '@prisma/client';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path: string = req.route?.path ?? req.url;
    const rawBody: Buffer =
      req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');

    if (path.includes('github') || req.url?.includes('/github')) {
      return this.verifyGithub(req, rawBody);
    }
    if (path.includes('gitlab') || req.url?.includes('/gitlab')) {
      return this.verifyGitlab(req);
    }
    throw new UnauthorizedException({ code: 401, data: null, message: 'Unknown webhook' });
  }

  private async verifyGithub(
    req: {
      headers: Record<string, string>;
      body: Record<string, unknown> & {
        repository?: { full_name?: string };
        __projectId?: string;
      };
    },
    rawBody: Buffer,
  ): Promise<boolean> {
    const signature = req.headers['x-hub-signature-256'];
    const repoFullName = req.body?.repository?.full_name;
    if (!signature || !repoFullName) {
      throw new UnauthorizedException({ code: 401, data: null, message: 'Missing signature' });
    }
    const project = await this.prisma.project.findUnique({
      where: {
        platform_repoFullName: { platform: GitPlatform.GITHUB, repoFullName },
      },
    });
    if (!project || !project.enabled) {
      throw new UnauthorizedException({ code: 401, data: null, message: 'Unknown project' });
    }
    const expected =
      'sha256=' +
      createHmac('sha256', project.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({ code: 401, data: null, message: 'Invalid signature' });
    }
    req.body.__projectId = project.id;
    return true;
  }

  private async verifyGitlab(req: {
    headers: Record<string, string>;
    body: Record<string, unknown> & {
      project?: { path_with_namespace?: string };
      __projectId?: string;
    };
  }): Promise<boolean> {
    const token = req.headers['x-gitlab-token'];
    const repoFullName = req.body?.project?.path_with_namespace;
    if (!token || !repoFullName) {
      throw new UnauthorizedException({ code: 401, data: null, message: 'Missing token' });
    }
    const project = await this.prisma.project.findUnique({
      where: {
        platform_repoFullName: { platform: GitPlatform.GITLAB, repoFullName },
      },
    });
    if (!project || !project.enabled || project.webhookSecret !== token) {
      throw new UnauthorizedException({ code: 401, data: null, message: 'Invalid token' });
    }
    req.body.__projectId = project.id;
    return true;
  }
}
