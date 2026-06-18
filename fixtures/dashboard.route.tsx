// Demo fixture — ssr-streaming advisory: loader blocks on multiple queries.
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(userQueries.profile()),
      queryClient.ensureQueryData(dashboardQueries.stats()),
      queryClient.ensureQueryData(activityQueries.recent()),
    ]);
  },
  component: DashboardPage,
});
