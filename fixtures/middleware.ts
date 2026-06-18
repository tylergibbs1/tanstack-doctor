// Demo fixture — function middleware input validation.
import { createMiddleware } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';

// VIOLATION mw-input-validation: reads `data` with no .validator().
export const workspaceMiddleware = createMiddleware({ type: 'function' })
  .server(({ next, data }) => {
    console.log('workspace', data.workspaceId);
    return next();
  });

// OK: validated before .server().
export const validatedMiddleware = createMiddleware({ type: 'function' })
  .validator(zodValidator(z.object({ workspaceId: z.string() })))
  .server(({ next, data }) => {
    return next({ context: { workspaceId: data.workspaceId } });
  });

// OK: newer .inputValidator() name + chained .middleware(), reads data — clean.
export const scopedMiddleware = createMiddleware({ type: 'function' })
  .middleware([validatedMiddleware])
  .inputValidator(zodValidator(z.object({ id: z.string() })))
  .server(async ({ next, context, data }) => {
    return next({ context: { ...context, id: data.id } });
  });

// OK: request middleware doesn't read `data`.
export const loggingMiddleware = createMiddleware()
  .server(async ({ next, request }) => {
    console.log(request.method, request.url);
    return next();
  });
