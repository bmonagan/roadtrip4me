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

describe('BillingController.handleEvent', () => {
  function event(type: string, data: object): { type: string; data: { object: object } } {
    return { type, data: { object: data } };
  }

  it('marks the user premium on checkout.session.completed', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue({});

    await controller['handleEvent'](
      event('checkout.session.completed', {
        client_reference_id: 'u1',
        customer: 'cus_123',
      }) as never
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isPremium: true, stripeCustomerId: 'cus_123' },
    });
  });

  it('grants premium when a subscription becomes active', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue({});

    await controller['handleEvent'](
      event('customer.subscription.updated', {
        status: 'active',
        customer: 'cus_123',
      }) as never
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_123' },
      data: { isPremium: true },
    });
  });

  it('downgrades on invoice.payment_failed', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue({});

    await controller['handleEvent'](
      event('invoice.payment_failed', { customer: 'cus_123' }) as never
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_123' },
      data: { isPremium: false },
    });
  });

  it('downgrades on customer.subscription.deleted', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue({});

    await controller['handleEvent'](
      event('customer.subscription.deleted', {
        status: 'canceled',
        customer: 'cus_123',
      }) as never
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_123' },
      data: { isPremium: false },
    });
  });

  it('ignores unknown event types', async () => {
    const { controller, prisma } = makeController();

    await controller['handleEvent'](
      event('charge.succeeded', { id: 'ch_1' }) as never
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
