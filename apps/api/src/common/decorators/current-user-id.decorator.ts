import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

// TEMPORARY: there is no Auth0 guard yet, so the user id is read from the
// `x-user-id` header. Replace with the authenticated user once auth lands.
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const userId = request.headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return userId;
  }
);
