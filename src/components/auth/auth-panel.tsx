"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowRight, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage, issuesFor } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { LanguageSwitcher, ThemeSwitcher } from "@/components/layout/app-shell";

type Values = { email: string; password: string; name?: string };

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const t = useT();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: { email: "", password: "", name: "" } });

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      if (mode === "login") {
        await api.post("/api/auth/login", values);
      } else {
        await api.post("/api/auth/signup", values);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(errorMessage(error, t));
    }
  };

  const fieldError = (name: keyof Values) =>
    issuesFor(undefined)[name] ?? (errors[name]?.message as string | undefined);

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-sm font-black text-white">
            SP
          </span>
          <span className="text-[15px] font-bold tracking-tight">{t("app.name")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-md place-items-center px-4 py-8 sm:py-14">
        <div className="card w-full p-6 sm:p-7">
          <h1 className="text-xl font-bold tracking-tight">
            {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "login" ? t("auth.signInSubtitle") : t("auth.signUpSubtitle")}
          </p>

          {serverError ? (
            <Alert tone="danger" className="mt-4" role="alert">
              {serverError}
            </Alert>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {mode === "signup" ? (
              <Field
                label={t("auth.name")}
                error={fieldError("name")}
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    autoComplete="name"
                    placeholder={t("auth.name")}
                    invalid={Boolean(errors.name)}
                    {...register("name", {
                      required: t("auth.formInvalid"),
                      minLength: { value: 1, message: t("auth.formInvalid") },
                    })}
                  />
                )}
              </Field>
            ) : null}

            <Field label={t("auth.email")} error={fieldError("email")}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  invalid={Boolean(errors.email)}
                  {...register("email", {
                    required: t("auth.formInvalid"),
                    pattern: { value: /^\S+@\S+\.\S+$/, message: t("auth.formInvalid") },
                  })}
                />
              )}
            </Field>

            <Field
              label={t("auth.password")}
              help={mode === "signup" ? t("auth.passwordHint") : undefined}
              error={fieldError("password")}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  invalid={Boolean(errors.password)}
                  {...register("password", {
                    required: t("auth.formInvalid"),
                    minLength:
                      mode === "signup"
                        ? { value: 8, message: t("auth.passwordHint") }
                        : undefined,
                  })}
                />
              )}
            </Field>

            <Button
              type="submit"
              variant="primary"
              block
              loading={isSubmitting}
              iconRight={isSubmitting ? undefined : <ArrowRight className="h-4 w-4" />}
            >
              {isSubmitting
                ? mode === "login"
                  ? t("auth.signingIn")
                  : t("auth.creating")
                : mode === "login"
                  ? t("common.signIn")
                  : t("common.signUp")}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
            <Link className="link" href={mode === "login" ? "/signup" : "/login"}>
              {mode === "login" ? t("common.signUp") : t("common.signIn")}
            </Link>
          </p>

          {mode === "login" ? (
            <div className="surface-2 mt-5 p-3 text-center text-xs text-muted">
              <p className="font-semibold text-ink">{t("auth.demoTitle")}</p>
              <p className="mt-1">{t("auth.demoBody")}</p>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-faint">{t("footer.product")}</p>
      </main>

      {isSubmitting ? (
        <span className="sr-only" role="status">
          <Loader2 className="h-4 w-4" aria-hidden="true" />
          {t("common.loading")}
        </span>
      ) : null}
    </div>
  );
}
