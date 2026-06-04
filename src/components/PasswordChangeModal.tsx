import { FormEvent, useState } from "react";
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

const MIN_LENGTH = 4;

export function PasswordChangeModal({
  open,
  onClose,
  onChangePassword,
  saving,
  error,
}: PasswordChangeModalProps) {
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
      title="修改数据库密码"
      description={`输入新密码以更改加密密钥。密码最短 ${MIN_LENGTH} 位字符。`}
      onClose={close}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="change-new-password">新密码</Label>
          <Input
            id="change-new-password"
            type="password"
            placeholder={`至少 ${MIN_LENGTH} 位字符`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="change-confirm-password">确认新密码</Label>
          <Input
            id="change-confirm-password"
            type="password"
            placeholder="再次输入新密码"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <p className="text-sm text-ink/55">
            请务必记住新密码。密码无法找回，忘记密码将导致数据无法恢复。
          </p>
          {error ? (
            <p className="text-sm text-coral">{error}</p>
          ) : null}
          <Button type="submit" disabled={!valid || saving}>
            {saving ? "正在修改..." : "修改密码"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
