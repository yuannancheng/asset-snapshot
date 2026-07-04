import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Input, Label } from "./Field";
import { Modal } from "./Modal";

type PasswordSetupModalProps = {
  open: boolean;
  onClose: () => void;
  onSetPassword: (password: string) => Promise<void>;
  saving: boolean;
  error: string | null;
};

const MIN_LENGTH = 6;

export function PasswordSetupModal({
  open,
  onClose,
  onSetPassword,
  saving,
  error,
}: PasswordSetupModalProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const valid =
    password.length >= MIN_LENGTH && password === confirm;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || saving) return;
    await onSetPassword(password);
    setPassword("");
    setConfirm("");
  };

  const close = () => {
    if (saving) return;
    setPassword("");
    setConfirm("");
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t("password.setupTitle")}
      description={t("password.setupDesc", { length: MIN_LENGTH })}
      onClose={close}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">{t("password.password")}</Label>
          <Input
            id="new-password"
            type="password"
            placeholder={t("password.passwordPlaceholder", { length: MIN_LENGTH })}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t("password.confirmPassword")}</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder={t("password.reenterPassword")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <p className="text-sm text-ink/55">
            {t("password.warningNoRecovery")}
          </p>
          {error ? (
            <p className="text-sm text-coral">{error}</p>
          ) : null}
          <Button type="submit" disabled={!valid || saving}>
            {saving ? t("password.settingPassword") : t("password.setPasswordBtn")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
