import { Link } from "@/i18n/routing";
import Logo from "@/components/partials/auth/logo";

const Unauthorized = () => {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-default-50 px-6">
      <div className="w-full max-w-md rounded-md bg-white dark:bg-default-100 p-8 text-center shadow-sm">
        <Link href="/" className="inline-flex justify-center mb-6">
          <Logo />
        </Link>
        <h1 className="text-2xl font-semibold text-default-900">Access pending</h1>
        <p className="mt-3 text-sm text-default-500">
          Your account is signed in, but it has not been granted dashboard access yet.
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;