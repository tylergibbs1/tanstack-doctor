// Demo fixture — intentionally contains violations for tanstack-doctor.
import { createServerFn } from '@tanstack/react-start';

// VIOLATION sf-input-validation: reads `data` with no .validator()
export const updateUser = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    await db.users.update({ where: { id: data.id }, data });
  });

// OK: validated, should NOT be flagged.
export const getPost = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    return db.posts.findUnique({ where: { id: data.id } });
  });

// OK: no data consumed.
export const ping = createServerFn().handler(async () => 'pong');
