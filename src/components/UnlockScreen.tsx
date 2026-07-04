import { FormEvent, useState } from "react";
import { KeyRound, ShieldAlert, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Input, Label } from "./Field";

type UnlockScreenProps = {
  currentPath: string;
  onUnlock: (password: string) => Promise<void>;
  error: string | null;
  waitSeconds: number;
};

export function UnlockScreen({ currentPath, onUnlock, error, waitSeconds }: UnlockScreenProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const waiting = waitSeconds > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || unlocking || waiting) return;
    setUnlocking(true);
    try {
      await onUnlock(password);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-app p-5">
      <div className="w-full max-w-md rounded-lg border border-ink/10 bg-panel p-8 shadow-panel">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint text-moss">
            <KeyRound size={26} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-ink">{t("password.unlockTitle")}</h1>
          <p className="mt-2 text-sm text-ink/55">
            {t("password.unlockDesc")}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-md border border-ink/10 bg-subtle p-4">
            <p className="text-xs font-medium text-ink/45">{t("password.unlockFileLocation")}</p>
            <p className="mt-1 break-all font-mono text-xs leading-5 text-ink/65">
              {currentPath || t("common.unknown")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unlock-password">{t("password.unlockPassword")}</Label>
            <Input
              id="unlock-password"
              type="password"
              placeholder={t("password.unlockPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={waiting}
            />
          </div>

          {waiting ? (
            <div className="flex items-start gap-2 rounded-md bg-mint/40 p-3 text-sm">
              <Timer size={18} className="mt-px shrink-0 text-moss" />
              <div>
                <p className="font-medium text-moss">
                  {error ? error : t("password.unlockWait", { seconds: waitSeconds })}
                </p>
                <p className="mt-1 text-moss/70">
                  {t("password.unlockWaitBruteForce")}
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-md bg-coral/10 p-3 text-sm text-coral">
              <ShieldAlert size={18} className="mt-px shrink-0" />
              <div>
                <p className="font-medium">{error}</p>
                <p className="mt-1 text-coral/70">
                  {t("password.unlockErrorHint")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md bg-mint/40 p-3 text-sm text-moss/80">
              <ShieldAlert size={18} className="mt-px shrink-0" />
              <p>{t("password.unlockWarning")}</p>
            </div>
          )}

          <Button type="submit" disabled={unlocking || !password || waiting} className="w-full">
            {waiting ? t("password.waitBtn", { seconds: waitSeconds }) : unlocking ? t("common.unlocking") : t("password.unlockBtn")}
          </Button>
        </form>
      </div>
    </main>
  );
}
