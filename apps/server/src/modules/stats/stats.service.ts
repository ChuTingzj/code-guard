import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private since(range: string): Date {
    const days = range === '30d' ? 30 : 7;
    return new Date(Date.now() - days * 24 * 3600 * 1000);
  }

  async overview(range = '7d') {
    const from = this.since(range);
    const records = await this.prisma.reviewRecord.findMany({
      where: { createdAt: { gte: from } },
      include: { issues: { where: { severity: 'CRITICAL' }, select: { id: true } } },
    });
    const totalReviews = records.length;
    const criticalBlocked = records.filter((r) => r.verdict === 'REJECTED').length;
    const passed = records.filter((r) => r.verdict === 'PASSED').length;
    const passRate = totalReviews ? passed / totalReviews : 0;
    const avgDurationMs = totalReviews
      ? Math.round(records.reduce((s, r) => s + r.durationMs, 0) / totalReviews)
      : 0;
    return { totalReviews, criticalBlocked, passRate, avgDurationMs };
  }

  async trend(range = '30d', interval = 'week') {
    const from = this.since(range);
    const records = await this.prisma.reviewRecord.findMany({
      where: { createdAt: { gte: from } },
      select: { verdict: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, { passed: number; warning: number; rejected: number }>();
    for (const r of records) {
      const d = r.createdAt;
      let key: string;
      if (interval === 'day') {
        key = d.toISOString().slice(0, 10);
      } else {
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(
          ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
        );
        key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
      }
      const b = buckets.get(key) ?? { passed: 0, warning: 0, rejected: 0 };
      if (r.verdict === 'PASSED') b.passed += 1;
      else if (r.verdict === 'WARNING') b.warning += 1;
      else b.rejected += 1;
      buckets.set(key, b);
    }
    return [...buckets.entries()].map(([period, v]) => ({ period, ...v }));
  }

  async topViolations(range = '30d', limit = 10) {
    const from = this.since(range);
    const grouped = await this.prisma.reviewIssue.groupBy({
      by: ['ruleTitle'],
      where: {
        ruleTitle: { not: null },
        createdAt: { gte: from },
      },
      _count: { ruleTitle: true },
      orderBy: { _count: { ruleTitle: 'desc' } },
      take: limit,
    });
    return grouped
      .filter((g) => g.ruleTitle)
      .map((g) => ({ ruleTitle: g.ruleTitle!, count: g._count.ruleTitle }));
  }

  async byProject(range = '30d') {
    const from = this.since(range);
    const tasks = await this.prisma.reviewTask.findMany({
      where: { createdAt: { gte: from }, record: { isNot: null } },
      include: {
        record: { select: { verdict: true } },
        project: { select: { name: true } },
      },
    });
    const map = new Map<string, { total: number; passed: number }>();
    for (const t of tasks) {
      const name = t.project.name;
      const cur = map.get(name) ?? { total: 0, passed: 0 };
      cur.total += 1;
      if (t.record?.verdict === 'PASSED') cur.passed += 1;
      map.set(name, cur);
    }
    return [...map.entries()].map(([projectName, v]) => ({
      projectName,
      total: v.total,
      passRate: v.total ? v.passed / v.total : 0,
    }));
  }
}
