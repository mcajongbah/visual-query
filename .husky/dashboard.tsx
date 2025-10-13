import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(dashboard)/dashboard")({
  component: RouteComponent,
  // beforeLoad: async () => {
  //   const session = await authClient.getSession();
  //   if (!session.data) {
  //     redirect({
  //       to: "/login",
  //       throw: true,
  //     });
  //   }
  //   return { session };
  // },
});

function RouteComponent() {
  // const { session } = Route.useRouteContext();

  return (
    <div>
      <h1>Dashboard</h1>
    </div>
  );
}
