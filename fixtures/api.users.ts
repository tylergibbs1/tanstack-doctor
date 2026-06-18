// Demo fixture — server route input validation.
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';

export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      // VIOLATION api-input-validation: body written to DB with no validation.
      POST: async ({ request }) => {
        const body = await request.json();
        const user = await db.users.create({ data: body });
        return json(user, { status: 201 });
      },

      // OK: validated with safeParse before the mutation.
      PUT: async ({ request }) => {
        const body = await request.json();
        const parsed = updateUserSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });
        const user = await db.users.update({ where: { id: parsed.data.id }, data: parsed.data });
        return json(user);
      },
    },
  },
});
