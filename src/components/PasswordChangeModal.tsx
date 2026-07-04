import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Input, Label } from "./Field";
import { Modal } from "./Modal";

type PasswordChangeModalProps = {
  open: boolean;
  onClose: () => void;
  onChangePassword: (newPassword: string) => Promise<void>;
  saving: boolean;
  error: string | null;
};

const MIN_LENGTH = 6;

export function PasswordChangeModal({
  open,
  onClose,
  onChangePassword,
  saving,
  error,
}: PasswordChangeModalProps) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const valid =
    newPassword.length >= MIN_LENGTH && newPassword === confirm;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || saving) return;
    await onChangePassword(newPassword);
    setNewPassword("");
    setConfirm("");
  };

  const close = () => {
    if (saving) return;
    setNewPassword("");
    setConfirm("");
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t("password.changeTitle")}
      description={t("password.changeDesc", { length: MIN_LENGTH })}
      onClose={close}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="change-new-password">{t("password.newPassword")}</Label>
          <Input
            id="change-new-password"
            type="password"
            placeholder={t("password.passwordPlaceholder", { length: MIN_LENGTH })}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="change-confirm-password">{t("password.confirmNewPassword")}</Label>
          <Input
            id="change-confirm-password"
            type="password"
            placeholder={t("password.reenterNewPassword")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <p className="text-sm text-ink/55">
            {t("password.warningRemember")}
          </p>
          {error ? (
            <p className="text-sm text-coral">{error}</p>
          ) : null}
          <Button type="submit" disabled={!valid || saving}>
            {saving ? t("password.changingPassword") : t("password.changePasswordBtn")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
