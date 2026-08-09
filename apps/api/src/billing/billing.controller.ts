import { BadGatewayException, Controller, Headers, Post, Req } from '@nestjs/common';
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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.client_reference_id) {
        await this.prisma.user.update({
          where: { id: session.client_reference_id },
          data: { isPremium: true },
        });
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
