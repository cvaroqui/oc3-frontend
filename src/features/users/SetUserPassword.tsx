import { useId, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TransientNotice } from "@/components/ui/TransientNotice";
import { api } from "@/lib/api/client";
import { problemText } from "@/lib/api/problem";
import { useAuthInfo } from "@/lib/api/auth-info";
import { useImpersonation } from "@/lib/api/impersonation";
import { useUserGroups } from "./use-user-groups";

const INPUT = "h-8 w-full rounded-(--radius-control) border border-line bg-surface px-2";

/** The shortest password the server accepts (`POST /users/{user_id}/password`). */
const MIN_LENGTH = 12;

type Field = "next" | "confirm";

const EMPTY: Record<Field, string> = { next: "", confirm: "" };

/**
 * Setting the password of another user, without the current one, as an
 * administrator resets it. Offered as the server accepts it, the rules of
 * `DeleteUser`: to a UserManager (a Manager having it too), never on one's own
 * account (the profile page changes it, with the current one), on a Manager's
 * account to a Manager only, never on an account linked to the identity provider
 * (`oidc_linked`), whose password, second factor and deactivation live there, not
 * while impersonating, and not when the collector has password sign-in turned off. Folded behind a button, an occasional action.
 */
export function SetUserPassword({
  userId,
  email,
  isSelf,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const impersonation = useImpersonation();
  const passwords = useAuthInfo().data?.basic !== false;
  const mine = useUserGroups("self");
  const theirs = useUserGroups(userId);
  const callerIsManager = mine.data?.some((g) => g.role === "Manager") ?? false;
  const callerMay = callerIsManager || (mine.data?.some((g) => g.role === "UserManager") ?? false);
  const targetIsManager = theirs.data?.some((g) => g.role === "Manager") ?? false;
  // An account linked to the identity provider has its password there: the
  // server refuses to set one in the collector.
  const linked = useQuery({
    queryKey: ["user", userId, "oidc_linked"],
    queryFn: async () => {
      const { data, error } = await api.GET("/users/{user_id}", {
        params: { path: { user_id: userId }, query: { props: "oidc_linked" } },
      });
      if (error !== undefined) throw new Error(problemText(error));
      // Unknown, the account counts as linked: the button stays hidden.
      return Array.isArray(data.data) ? data.data[0]?.oidc_linked !== false : true;
    },
    enabled: !isSelf,
  });

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<Field, string>>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const [dismissedChange, setDismissedChange] = useState<number | null>(null);

  const change = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await api.POST("/users/{user_id}/password", {
        params: { path: { user_id: userId } },
        body: { new_password: next },
      });
      if (error !== undefined) throw new Error(problemText(error));
    },
    onSuccess: () => {
      close();
    },
  });

  function close() {
    setOpen(false);
    setValues(EMPTY);
    setTouched(false);
    setVisible(false);
    // The focus goes back to the button that opened the form.
    window.setTimeout(() => opener.current?.focus(), 0);
  }

  if (
    isSelf ||
    !passwords ||
    impersonation !== null ||
    !callerMay ||
    !theirs.isSuccess ||
    linked.data !== false ||
    (targetIsManager && !callerIsManager)
  )
    return null;

  const problems: Partial<Record<Field, string>> = {};
  // Counted in characters, as the server does: an accented letter counts once.
  if (Array.from(values.next).length < MIN_LENGTH)
    problems.next = t("profile.password.tooShort", { count: MIN_LENGTH });
  if (values.confirm !== values.next) problems.confirm = t("profile.password.mismatch");
  const valid = Object.keys(problems).length === 0;

  const field = (name: Field, autoFocus = false) => {
    const problem = touched ? problems[name] : undefined;
    return (
      <div>
        <label htmlFor={`${id}-${name}`} className="mb-1 block font-medium">
          {t(`profile.password.fields.${name}`)}
        </label>
        <input
          id={`${id}-${name}`}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={values[name]}
          aria-invalid={problem !== undefined}
          aria-describedby={problem === undefined ? undefined : `${id}-${name}-problem`}
          onChange={(event) => {
            setValues({ ...values, [name]: event.target.value });
            change.reset();
          }}
          className={`${INPUT} ${problem === undefined ? "" : "border-state-down"}`}
        />
        {problem !== undefined && (
          <p id={`${id}-${name}-problem`} className="mt-1 text-state-down">
            ■ {problem}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="border-t border-line pt-3">
      {!open ? (
        <div className="space-y-2">
          <button
            ref={opener}
            type="button"
            aria-expanded={false}
            onClick={() => {
              setOpen(true);
              change.reset();
            }}
            className="h-8 rounded-(--radius-control) border border-line bg-surface px-3 hover:border-line-strong"
          >
            {t("users.password.open")}
          </button>
          {change.isSuccess && dismissedChange !== change.submittedAt && (
            <TransientNotice
              id={change.submittedAt}
              tone="success"
              text={t("users.password.done", { email })}
              dismissLabel={t("actionsMenu.dismiss")}
              onDismiss={() => {
                setDismissedChange(change.submittedAt);
              }}
            />
          )}
        </div>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (valid) change.mutate(values.next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <p className="text-ink-muted">{t("users.password.hint", { email, count: MIN_LENGTH })}</p>
          {/* The account name, for password managers to file the password under it. */}
          <input type="text" autoComplete="username" value={email} readOnly hidden />
          {field("next", true)}
          {field("confirm")}
          <label className="flex items-center gap-2 text-ink-muted">
            <input
              type="checkbox"
              checked={visible}
              onChange={(event) => {
                setVisible(event.target.checked);
              }}
            />
            {t("profile.password.show")}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={change.isPending}
              className="h-8 rounded-(--radius-control) bg-accent px-3 font-medium text-accent-ink disabled:opacity-60"
            >
              {change.isPending ? t("profile.password.pending") : t("users.password.submit")}
            </button>
            <button
              type="button"
              onClick={close}
              className="h-8 rounded-(--radius-control) border border-line bg-surface px-3 hover:border-line-strong"
            >
              {t("detail.cancel")}
            </button>
          </div>
          {change.isError && (
            <p role="alert" className="text-state-down">
              ■ {change.error.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
