import { describe, expect, it, vi } from 'vitest';
import { StopsService } from './stops.service';

function makeService() {
  const prisma = {
    stop: { deleteMany: vi.fn() },
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
    ),
  };
  const service = new StopsService(prisma as never);
  return { service, prisma };
}

describe('StopsService.remove', () => {
  it('deletes a stop the user submitted', async () => {
    const { service, prisma } = makeService();
    prisma.stop.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.remove('u1', 's1');
    expect(result).toEqual({ deleted: true });
    expect(prisma.stop.deleteMany).toHaveBeenCalledWith({
      where: { id: 's1', submittedByUserId: 'u1' },
    });
  });

  it('throws when the stop does not exist or is not owned by the user', async () => {
    const { service, prisma } = makeService();
    prisma.stop.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('u1', 's_other')).rejects.toThrow(
      'Stop s_other not found'
    );
  });
});
