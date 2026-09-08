import { Injectable } from '@nestjs/common';
import { GitPlatform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptToken } from '../../common/crypto.util';
import { IGitProvider } from './git-provider.interface';
import { GithubProvider } from './github.provider';
import { GitlabProvider } from './gitlab.provider';

@Injectable()
export class GitProviderFactory {
  constructor(private readonly prisma: PrismaService) {}

  async forProject(projectId: string): Promise<{ provider: IGitProvider; repoFullName: string; platform: GitPlatform }> {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const token = decryptToken(project.accessToken);
    const provider =
      project.platform === GitPlatform.GITHUB
        ? new GithubProvider(token)
        : new GitlabProvider(token);
    return { provider, repoFullName: project.repoFullName, platform: project.platform };
  }
}
