import { PrismaClient, UserRole, GitPlatform } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@codeguard.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin';

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: UserRole.ADMIN },
    create: {
      email,
      passwordHash,
      name,
      role: UserRole.ADMIN,
    },
  });

  const webhookSecret = randomBytes(24).toString('hex');
  const project = await prisma.project.upsert({
    where: {
      platform_repoFullName: {
        platform: GitPlatform.GITHUB,
        repoFullName: 'acme/demo',
      },
    },
    update: {},
    create: {
      name: 'Demo Project',
      platform: GitPlatform.GITHUB,
      repoFullName: 'acme/demo',
      webhookSecret,
      // placeholder encrypted-looking token; real tokens set via API
      accessToken: 'seed-placeholder-token',
      enabled: true,
    },
  });

  console.log('Seeded admin:', admin.email);
  console.log('Seeded project:', project.repoFullName, 'webhookSecret=', project.webhookSecret);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
