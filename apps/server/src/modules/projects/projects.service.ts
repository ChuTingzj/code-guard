import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { GitPlatform } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from '../../common/crypto.util';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const projects = await this.prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
    return projects.map((p) => this.toPublic(p));
  }

  async create(input: {
    name: string;
    platform: GitPlatform;
    repoFullName: string;
    accessToken: string;
  }) {
    const existing = await this.prisma.project.findUnique({
      where: {
        platform_repoFullName: {
          platform: input.platform,
          repoFullName: input.repoFullName,
        },
      },
    });
    if (existing) {
      throw new ConflictException({ code: 409, data: null, message: 'Project already exists' });
    }

    const webhookSecret = randomBytes(24).toString('hex');
    const project = await this.prisma.project.create({
      data: {
        name: input.name,
        platform: input.platform,
        repoFullName: input.repoFullName,
        webhookSecret,
        accessToken: encryptToken(input.accessToken),
      },
    });

    const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001';
    const webhookPath =
      project.platform === 'GITHUB' ? '/api/webhooks/github' : '/api/webhooks/gitlab';

    return {
      ...this.toPublic(project),
      webhookSecret,
      webhookUrl: `${baseUrl}${webhookPath}`,
      webhookSetupHint:
        project.platform === 'GITHUB'
          ? 'GitHub → Settings → Webhooks → Content type application/json, secret = webhookSecret'
          : 'GitLab → Settings → Webhooks → use webhookSecret as token',
    };
  }

  async update(
    id: string,
    input: { name?: string; accessToken?: string; enabled?: boolean },
  ) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException({ code: 404, data: null, message: 'Project not found' });
    }
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        name: input.name,
        enabled: input.enabled,
        accessToken: input.accessToken ? encryptToken(input.accessToken) : undefined,
      },
    });
    return this.toPublic(updated);
  }

  async remove(id: string) {
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }

  private toPublic(p: {
    id: string;
    name: string;
    platform: GitPlatform;
    repoFullName: string;
    enabled: boolean;
    createdAt: Date;
    webhookSecret: string;
  }) {
    return {
      id: p.id,
      name: p.name,
      platform: p.platform,
      repoFullName: p.repoFullName,
      enabled: p.enabled,
      createdAt: p.createdAt,
      // expose secret only on create; list shows masked
      webhookSecretMasked: `${p.webhookSecret.slice(0, 4)}****`,
    };
  }
}
