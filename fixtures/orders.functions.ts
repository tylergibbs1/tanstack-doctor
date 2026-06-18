// Demo fixture — server-function method + validator violations.
import { createServerFn } from '@tanstack/react-start';

// VIOLATION sf-method-selection: mutates under the default GET method.
export const deleteOrder = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await db.orders.delete({ where: { id: data.id } });
  });

// VIOLATION sf-weak-validator: passthrough validator does no runtime check.
export const createOrder = createServerFn({ method: 'POST' })
  .validator((data: { total: number }) => data)
  .handler(async ({ data }) => {
    return db.orders.create({ data });
  });

// OK: GET query with a real read, no mutation.
export const listOrders = createServerFn()
  .handler(async () => db.orders.findMany());
