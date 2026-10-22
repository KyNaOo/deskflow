import { BullModule, getQueueToken, Processor } from '@nestjs/bullmq';
import { INestApplication, Inject, Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Job, Queue } from 'bullmq';
import { App } from 'supertest/types.js';
import { TenantContext } from '../../src/common/tenant-context.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { TENANT_PRISMA, type TenantPrisma } from '../../src/prisma/tenant-prisma.js';
import { JobProcessor } from '../../src/queues/job-processor.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createTestWorker } from '../helpers/create-test-worker.js';

const SLUG_PREFIX = 'e2e-worker-';
const TEST_QUEUE = 'worker-test';

interface TestJobData {
  tenantId: string;
}

/** Jobs exécutés, dans l'ordre : pour vérifier qu'aucun ne l'est deux fois. */
const executedJobIds: string[] = [];
/**
 * Libère le job `slow`, retenu jusque-là. Défini seulement quand le processor l'a commencé :
 * l'état `active` dans Redis le précède, l'attendre seul ne suffit pas.
 */
let releaseSlowJob: (() => void) | undefined;

// Processor propre au test : lit les utilisateurs dans le contexte du tenant du job
@Processor(TEST_QUEUE)
class TestProcessor extends JobProcessor<TestJobData, string[]> {
  constructor(
    private readonly tenantContext: TenantContext,
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
  ) {
    super();
  }

  protected async handle(job: Job<TestJobData>): Promise<string[]> {
    if (job.name === 'slow') {
      await new Promise<void>((resolve) => (releaseSlowJob = resolve));
    }
    executedJobIds.push(job.id!);
    return this.tenantContext.run(job.data.tenantId, async () => {
      const users = await this.prisma.user.findMany({ select: { tenantId: true } });
      return users.map((user) => user.tenantId);
    });
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: TEST_QUEUE })],
  providers: [TestProcessor],
})
class TestWorkerModule {}

describe('Worker BullMQ (e2e)', () => {
  let api: INestApplication<App>;
  let queue: Queue<TestJobData>;
  let tenantA: TestAccount;
  let tenantB: TestAccount;
  const workers: TestingModule[] = [];

  async function startWorker() {
    const worker = await createTestWorker([TestWorkerModule]);
    workers.push(worker);
    return worker;
  }

  async function waitForState(jobId: string, state: string) {
    await vi.waitFor(async () => expect(await queue.getJobState(jobId)).toBe(state), {
      timeout: 5_000,
      interval: 50,
    });
  }

  beforeAll(async () => {
    // Côté API : la file est déclarée pour y ajouter des jobs, sans aucun processor
    api = await createTestApp({ imports: [BullModule.registerQueue({ name: TEST_QUEUE })] });
    queue = api.get(getQueueToken(TEST_QUEUE));
    tenantA = await registerTenant(api, SLUG_PREFIX);
    tenantB = await registerTenant(api, SLUG_PREFIX);
    await createAccount(api, tenantB.tenantId, Role.AGENT);
  });

  afterEach(async () => {
    await Promise.all(workers.splice(0).map((worker) => worker.close()));
    executedJobIds.length = 0;
    releaseSlowJob = undefined;
  });

  afterAll(async () => {
    await api.get(PrismaService).tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await api.close();
  });

  it('l’API n’exécute pas les jobs : ils attendent dans Redis que le worker démarre', async () => {
    const job = await queue.add('list-users', { tenantId: tenantA.tenantId });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await queue.getJobState(job.id!)).toBe('waiting');

    await startWorker();
    await waitForState(job.id!, 'completed');
    expect(executedJobIds).toEqual([job.id]);
  });

  it('un job lit la base dans le contexte de son tenant, sans voir les autres', async () => {
    await startWorker();

    const jobA = await queue.add('list-users', { tenantId: tenantA.tenantId });
    const jobB = await queue.add('list-users', { tenantId: tenantB.tenantId });
    await waitForState(jobA.id!, 'completed');
    await waitForState(jobB.id!, 'completed');

    expect((await queue.getJob(jobA.id!))!.returnvalue).toEqual([tenantA.tenantId]);
    expect((await queue.getJob(jobB.id!))!.returnvalue).toEqual([tenantB.tenantId, tenantB.tenantId]);
  });

  it('à l’arrêt, le worker termine le job en cours avant de fermer', async () => {
    const worker = await startWorker();
    const job = await queue.add('slow', { tenantId: tenantA.tenantId });
    await vi.waitFor(() => expect(releaseSlowJob).toBeDefined(), { timeout: 5_000, interval: 20 });

    const closing = worker.close();
    releaseSlowJob!();
    await closing;
    workers.length = 0;

    expect(await queue.getJobState(job.id!)).toBe('completed');
  });

  it('avec deux workers, chaque job est exécuté une seule fois', async () => {
    await startWorker();
    await startWorker();

    const jobs = await queue.addBulk(
      Array.from({ length: 20 }, () => ({ name: 'list-users', data: { tenantId: tenantA.tenantId } })),
    );
    await Promise.all(jobs.map((job) => waitForState(job.id!, 'completed')));

    expect(executedJobIds.toSorted()).toEqual(jobs.map((job) => job.id!).toSorted());
  });
});
