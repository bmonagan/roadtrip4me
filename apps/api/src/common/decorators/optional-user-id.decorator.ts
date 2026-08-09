import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// TEMPORARY: mirrors CurrentUserId but returns undefined when the header is
// absent, so public endpoints can optionally enrich responses for the caller.
export const OptionalUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    return request.headers['x-user-id'];
  }
);
