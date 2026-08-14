import { BadGatewayException, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common/interfaces';
import Stripe from 'stripe';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User as UserModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Stripe checkout + webhook. Requires STRIPE_SECRET_KEY / STRIPE_PRICE_ID /
// STRIPE_WEBHOOK_SECRET; fails closed with a clear error when not configured.

@Controller('billing')
export class BillingController {
  private stripe?: Stripe;

  constructor(private readonly prisma: PrismaService) {}

  @Post('checkout')
  async checkout(@CurrentUser() user: UserModel): Promise<{ url: string }> {
    const secretKey = process.env['STRIPE_SECRET_KEY'];
    const priceId = process.env['STRIPE_PRICE_ID'];
    if (!secretKey || !priceId) {
      throw new BadGatewayException('Stripe is not configured');
    }

    const session = await this.client(secretKey).checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.origin()}/?upgraded=1`,
      cancel_url: `${this.origin()}/trips`,
      client_reference_id: user.id,
      customer_email: user.email,
    });
    if (!session.url) {
      throw new BadGatewayException('Stripe did not return a checkout URL');
    }
    return { url: session.url };
  }

  @Get('status')
  async status(@CurrentUser() user: UserModel): Promise<{
    isPremium: boolean;
    stripeCustomerId: string | null;
  }> {
    return {
      isPremium: user.isPremium,
      stripeCustomerId: user.stripeCustomerId,
    };
  }

  @Post('cancel')
  async cancel(@CurrentUser() user: UserModel): Promise<{ message: string }> {
    if (!user.stripeCustomerId) {
      throw new BadGatewayException('No Stripe customer found');
    }

    const secretKey = process.env['STRIPE_SECRET_KEY'];
    if (!secretKey) {
      throw new BadGatewayException('Stripe is not configured');
    }

    const subscriptions = await this.client(secretKey).subscriptions.list({
      customer: user.stripeCustomerId,
    });

    if (subscriptions.length === 0) {
      throw new BadGatewayException('No active subscription found');
    }

    await this.client(secretKey).subscriptions.cancel(subscriptions[0].id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isPremium: false },
    });

    return { message: 'Subscription cancelled successfully' };
  }

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    const secretKey = process.env['STRIPE_SECRET_KEY'];
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!secretKey || !webhookSecret || !signature) {
      throw new BadGatewayException('Stripe is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.client(secretKey).webhooks.constructEvent(
        req.rawBody as Buffer,
        signature,
        webhookSecret
      );
    } catch (error) {
      throw new BadGatewayException(`Invalid Stripe webhook signature: ${(error as Error).message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.client_reference_id && session.customer) {
          await this.prisma.user.update({
            where: { id: session.client_reference_id },
            data: {
              isPremium: true,
              stripeCustomerId: session.customer as string,
            },
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          await this.prisma.user.update({
            where: { stripeCustomerId: subscription.customer as string },
            data: { isPremium: true },
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.status === 'canceled') {
          await this.prisma.user.update({
            where: { stripeCustomerId: subscription.customer as string },
            data: { isPremium: false },
          });
        }
        break;
      }
    }

    return { received: true };
  }

  private client(secretKey: string): Stripe {
    if (!this.stripe) {
      this.stripe = new Stripe(secretKey);
    }
    return this.stripe;
  }

  private origin(): string {
    return process.env['APP_ORIGIN'] ?? 'http://localhost:5173';
  }
}
