// app/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/auth");
  }

  const metadata = sessionClaims?.metadata as Record<string, unknown> | undefined;
  const onboardingComplete = metadata?.onboardingComplete === true;
  const role = (metadata?.role as string) || "LEARNER";

  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  switch (role) {
    case "HIRING_MANAGER":
      redirect("/assessments");
    case "INSTRUCTOR":
      redirect("/classroom");
    default:
      redirect("/dashboard");
  }
}