import { describe, expect, it, vi } from 'vitest';
import { BillingController } from './billing.controller';

function makeController() {
  const prisma = {
    user: { update: vi.fn() },
  };
  const controller = new BillingController(prisma as never);
  return { controller, prisma };
}

describe('BillingController.setPremiumForCustomer', () => {
  it('updates premium by stripeCustomerId', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue({});

    await controller['setPremiumForCustomer']('cus_123', true);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_123' },
      data: { isPremium: true },
    });
  });

  it('swallows a missing-user error (P2025) so Stripe does not retry forever', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockRejectedValue({ code: 'P2025' });

    await expect(
      controller['setPremiumForCustomer']('cus_ghost', false)
    ).resolves.toBeUndefined();
  });

  it('rethrows non-P2025 errors', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockRejectedValue(new Error('boom'));

    await expect(
      controller['setPremiumForCustomer']('cus_123', true)
    ).rejects.toThrow('boom');
  });
});
