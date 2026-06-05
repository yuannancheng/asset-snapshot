import { FormEvent, useState } from "react";
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
      title="设置数据库密码"
      description={`设置密码后，数据文件将以 SQLCipher 加密保护。密码最短 ${MIN_LENGTH} 位字符。`}
      onClose={close}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">密码</Label>
          <Input
            id="new-password"
            type="password"
            placeholder={`至少 ${MIN_LENGTH} 位字符`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">确认密码</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="再次输入密码"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <p className="text-sm text-ink/55">
            密码无法找回。如果忘记密码，加密数据将无法恢复。
          </p>
          {error ? (
            <p className="text-sm text-coral">{error}</p>
          ) : null}
          <Button type="submit" disabled={!valid || saving}>
            {saving ? "正在设置..." : "设置密码"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
