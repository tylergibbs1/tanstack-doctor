// Regression guard (from scanning tylergibbs1/rebar): a GET server function that
// reads `context` (not `data`) and has a return-type annotation before `=>` must
// NOT be flagged by sf-input-validation. The parser must anchor to THIS handler
// and look past `): Promise<...> =>`.
import { createServerFn } from '@tanstack/react-start';

export const getAccountEvents = createServerFn({ method: 'GET' })
  .middleware([accountMiddleware])
  .handler(async ({ context }): Promise<AccountEventView[]> => {
    return listAccountEvents(context.accountId, 30);
  });

// And one that DOES read data but is properly validated — also must stay clean.
export const getThing = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<Thing> => {
    return loadThing(data.id);
  });
