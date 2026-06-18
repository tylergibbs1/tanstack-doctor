// A file that follows every best practice — the scanner must report ZERO issues.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const updateUser = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
  .handler(async ({ data }) => db.users.update({ where: { id: data.id }, data }));

export const getPublicUrl = () => import.meta.env.VITE_APP_URL;
