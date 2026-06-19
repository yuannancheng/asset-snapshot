import { FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,

  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Button } from "../Button";
import { ChoiceSelect } from "../ChoiceSelect";
import { Input, Label } from "../Field";
import { Modal } from "../Modal";
import { ColorInput } from "../platform/ColorInput";
import { accountTypeOptions } from "../../lib/constants";
import { presetColors, presetColorLabels } from "../../lib/constants";
import type { Account, AccountType, Platform } from "../../lib/types";

type PlatformGroup = { platform: Platform; accounts: Account[] };

export function ConfigModal({
  open,
  onClose,
  saving,
  platformName,
  setPlatformName,
  platformColor,
  setPlatformColor,
  platformEdits,
  setPlatformEdits,
  accountEdits,
  setAccountEdits,
  inlineAccountForms,
  setInlineAccountForms,
  platformGroups,
  submitPlatform,
  savePlatformName,
  savePlatformColor,
  movePlatformOrder,
  removePlatform,
  saveAccountName,
  changeAccountType,
  moveAccountOrder,
  toggleAccountActive,
  removeAccount,
  inlineAddAccount,
  platformColorFor,
}: {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  platformName: string;
  setPlatformName: (v: string) => void;
  platformColor: string;
  setPlatformColor: (v: string) => void;
  platformEdits: Record<number, string>;
  setPlatformEdits: (updater: (current: Record<number, string>) => Record<number, string>) => void;
  accountEdits: Record<number, string>;
  setAccountEdits: (updater: (current: Record<number, string>) => Record<number, string>) => void;
  inlineAccountForms: Record<number, { name: string; type: AccountType }>;
  setInlineAccountForms: (updater: (current: Record<number, { name: string; type: AccountType }>) => Record<number, { name: string; type: AccountType }>) => void;
  platformGroups: PlatformGroup[];
  submitPlatform: (event: FormEvent) => Promise<void>;
  savePlatformName: (platformId: number) => Promise<void>;
  savePlatformColor: (platformId: number, color: string) => Promise<void>;
  movePlatformOrder: (platformId: number, direction: "up" | "down") => Promise<void>;
  removePlatform: (platformId: number) => Promise<void>;
  saveAccountName: (accountId: number) => Promise<void>;
  changeAccountType: (accountId: number, type: AccountType) => Promise<void>;
  moveAccountOrder: (accountId: number, direction: "up" | "down") => Promise<void>;
  toggleAccountActive: (account: Account) => Promise<void>;
  removeAccount: (account: Account) => Promise<void>;
  inlineAddAccount: (platformId: number) => Promise<void>;
  platformColorFor: (platformId: number, index: number) => string;
}) {
  return (
    <Modal
      open={open}
      title="平台与账户"
      description="管理你的资产平台和账户。"
      onClose={onClose}
      footer={null}
    >
      <div className="space-y-6">
        <form className="flex flex-wrap items-end gap-3" onSubmit={submitPlatform}>
          <div className="min-w-[120px] flex-1">
            <Label>新建平台</Label>
            <Input
              value={platformName}
              placeholder="平台名称"
              onChange={(event) => setPlatformName(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Popover className="relative">
              <PopoverButton
                className="size-10 rounded-full border-2 border-ink/15 p-0 transition-shadow hover:shadow-md"
                style={{ background: platformColor || "conic-gradient(from 0deg, red 0deg 60deg, yellow 60deg 120deg, lime 120deg 180deg, cyan 180deg 240deg, blue 240deg 300deg, magenta 300deg 360deg)", backgroundClip: "padding-box" }}
                title="选择颜色"
              />
              <PopoverPanel
                anchor="bottom"
                className="z-[9999] mt-2 rounded-lg border border-ink/10 bg-panel p-3 shadow-panel [--anchor-gap:8px]"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  {presetColors.map((color, idx) => (
                    <button
                      key={color}
                      type="button"
                      className={`size-7 rounded-full border-2 transition-shadow hover:shadow-md ${
                        platformColor === color ? "border-ink scale-110" : "border-transparent"
                      }`}
                      style={{ background: color }}
                      title={presetColorLabels[idx]}
                      onClick={() => setPlatformColor(color)}
                    />
                  ))}
                  <button
                    type="button"
                    className="size-7 rounded-full border-2 border-transparent transition-shadow hover:shadow-md"
                    style={{ background: "conic-gradient(from 0deg, red 0deg 60deg, yellow 60deg 120deg, lime 120deg 180deg, cyan 180deg 240deg, blue 240deg 300deg, magenta 300deg 360deg)", backgroundClip: "padding-box" }}
                    title="自定义颜色"
                    onClick={() => {
                      const el = document.getElementById("new-platform-custom-color");
                      if (el) el.click();
                    }}
                  />
                  <input
                    id="new-platform-custom-color"
                    type="color"
                    className="sr-only"
                    onChange={(event) => setPlatformColor(event.target.value)}
                  />
                </div>
                <ColorInput
                  initialValue={platformColor}
                  onCommit={(color) => setPlatformColor(color)}
                />
              </PopoverPanel>
            </Popover>
          </div>
          <Button type="submit" variant="secondary" disabled={saving || !platformName.trim()}>
            <Plus size={16} />
            添加
          </Button>
        </form>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {platformGroups.map(({ platform, accounts }, pIdx) => (
            <div key={platform.id} className="rounded-lg bg-subtle p-3">
              <div className="mb-2 flex items-center gap-2">
                <Popover className="relative">
                  <PopoverButton className="inline-block size-5 shrink-0 rounded-full border-2 border-ink/15 hover:shadow-md transition-shadow p-0" style={{ background: platform.color || platformColorFor(platform.id, pIdx), backgroundClip: "padding-box" }} />
                  <PopoverPanel
                    anchor="bottom"
                    className="z-[9999] mt-2 rounded-lg border border-ink/10 bg-panel p-3 shadow-panel [--anchor-gap:8px]"
                  >
                    <div className="flex flex-wrap gap-2 mb-2">
                      {presetColors.map((color, idx) => (
                        <button
                          key={color}
                          type="button"
                          className={`size-7 rounded-full border-2 transition-shadow hover:shadow-md ${
                            platform.color === color ? "border-ink scale-110" : "border-transparent"
                          }`}
                          style={{ background: color }}
                          title={presetColorLabels[idx]}
                          onClick={() => savePlatformColor(platform.id, color)}
                        />
                      ))}
                      <button
                        type="button"
                        className="size-7 rounded-full border-2 border-transparent transition-shadow hover:shadow-md"
                        style={{ background: "conic-gradient(from 0deg, red 0deg 60deg, yellow 60deg 120deg, lime 120deg 180deg, cyan 180deg 240deg, blue 240deg 300deg, magenta 300deg 360deg)", backgroundClip: "padding-box" }}
                        title="自定义颜色"
                        onClick={() => {
                          const el = document.getElementById("existing-platform-custom-color-" + platform.id);
                          if (el) el.click();
                        }}
                      />
                      <input
                        id={"existing-platform-custom-color-" + platform.id}
                        type="color"
                        className="sr-only"
                        onChange={(event) => savePlatformColor(platform.id, event.target.value)}
                      />
                    </div>
                    <ColorInput
                      initialValue={platform.color ?? ""}
                      onCommit={(color) => savePlatformColor(platform.id, color)}
                    />
                  </PopoverPanel>
                </Popover>
                <span className="font-semibold text-ink">{platform.name}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className="size-7 px-0"
                    title="上移"
                    onClick={() => movePlatformOrder(platform.id, "up")}
                    disabled={saving}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="size-7 px-0"
                    title="下移"
                    onClick={() => movePlatformOrder(platform.id, "down")}
                    disabled={saving}
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="size-7 px-0 text-coral"
                    title="删除平台"
                    onClick={() => removePlatform(platform.id)}
                    disabled={saving}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="mb-1">
                <Input
                  value={platformEdits[platform.id] ?? platform.name}
                  placeholder="编辑平台名称"
                  onChange={(event) =>
                    setPlatformEdits((current) => ({ ...current, [platform.id]: event.target.value }))
                  }
                  onBlur={() => savePlatformName(platform.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") savePlatformName(platform.id);
                  }}
                />
              </div>
              {accounts.length === 0 ? (
                <p className="py-2 text-xs text-ink/35">暂无账户</p>
              ) : (
                <div className="ml-4 space-y-1.5">
                  {accounts.map((account) => (
                    <div key={account.id} className={`flex items-center gap-2 rounded-md p-1.5${!account.isActive ? " opacity-50" : ""}`}>
                      <div className="flex-1 relative">
                        {!account.isActive && <span className="absolute -top-1.5 left-2 z-10 text-[10px] text-ink/50 bg-panel px-1 rounded">已停用</span>}
                        <Input
                          disabled={!account.isActive}
                          value={accountEdits[account.id] ?? account.name}
                          placeholder="账户名称"
                          onChange={(event) =>
                            setAccountEdits((current) => ({
                              ...current,
                              [account.id]: event.target.value,
                            }))
                          }
                          onBlur={() => saveAccountName(account.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveAccountName(account.id);
                          }}
                        />
                      </div>
                      <ChoiceSelect
                        value={account.type}
                        options={accountTypeOptions}
                        onChange={(value) => changeAccountType(account.id, value)}
                      />
                      <Button
                        variant="ghost"
                        className="size-8 px-0"
                        title={account.isActive ? "停用" : "启用"}
                        onClick={() => toggleAccountActive(account)}
                        disabled={saving}
                      >
                        {account.isActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                      </Button>
                      <Button
                        variant="ghost"
                        className="size-7 px-0"
                        title="上移"
                        onClick={() => moveAccountOrder(account.id, "up")}
                        disabled={saving}
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="size-7 px-0"
                        title="下移"
                        onClick={() => moveAccountOrder(account.id, "down")}
                        disabled={saving}
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="size-7 px-0 text-coral"
                        title="删除账户"
                        onClick={() => removeAccount(account)}
                        disabled={saving}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 border-t border-ink/10 pt-2">
                <div className="flex-1">
                  <Input
                    value={inlineAccountForms[platform.id]?.name ?? ""}
                    placeholder="新账户名称"
                    onChange={(event) =>
                      setInlineAccountForms((prev) => ({
                        ...prev,
                        [platform.id]: { ...prev[platform.id], name: event.target.value, type: prev[platform.id]?.type ?? "asset_liquid" },
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") inlineAddAccount(platform.id);
                    }}
                  />
                </div>
                <ChoiceSelect
                  value={inlineAccountForms[platform.id]?.type ?? "asset_liquid"}
                  options={accountTypeOptions}
                  onChange={(value) =>
                    setInlineAccountForms((prev) => ({
                      ...prev,
                      [platform.id]: { ...prev[platform.id], name: prev[platform.id]?.name ?? "", type: value },
                    }))
                  }
                />
                <Button
                  variant="secondary"
                  className="size-9 shrink-0 px-0"
                  title="添加账户"
                  onClick={() => inlineAddAccount(platform.id)}
                  disabled={saving || !inlineAccountForms[platform.id]?.name?.trim()}
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
