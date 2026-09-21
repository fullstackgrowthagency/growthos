import { Suspense } from "react";
import { CreateAccountForm } from "./CreateAccountForm";

export default function CreateAccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={null}>
        <CreateAccountForm />
      </Suspense>
    </div>
  );
}
