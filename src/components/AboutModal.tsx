import { ExternalLink, Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import pkg from "../../package.json";
import { useState, useCallback, useEffect } from "react";

type AboutModalProps = {
  open: boolean;
  onClose: () => void;
  showToast: (text: string, kind: "success" | "error") => void;
};

const REPO_URL = "https://github.com/yuannancheng/asset-snapshot";
const CACHE_KEY = "about_update_check";
/** 两次真正网络请求的最小间隔（毫秒）*/
const CACHE_TTL = 1 * 60 * 1000;

const openRepo = () => {
  openUrl(REPO_URL).catch(() => {
    window.open(REPO_URL, "_blank", "noopener,noreferrer");
  });
};

/** Inline GitHub icon to avoid deprecated lucide-react brand icon. */
const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-label="GitHub"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export function AboutModal({ open, onClose, showToast }: AboutModalProps) {
  const [checkState, setCheckState] = useState<"idle" | "loading" | "error" | "no-update" | "has-update">("idle");
  const [latestVersion, setLatestVersion] = useState("");
  const [releaseUrl, setReleaseUrl] = useState("");
  const checkUpdate = useCallback(async () => {
    if (checkState === "loading") return;

    // Try to load cached result first (stale-while-revalidate)
    let cached: { remote: string; url: string; time: number } | null = null;
    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      try {
        cached = JSON.parse(cachedRaw);
      } catch { /* ignore corrupted cache */ }
    }

    // If cache is fresh, use it directly — no network request
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      setLatestVersion(cached.remote);
      setReleaseUrl(cached.url);
      setCheckState(cached.remote !== pkg.version ? "has-update" : "no-update");
      return;
    }

    // Cache is absent or expired: show stale result while revalidating
    if (cached) {
      setLatestVersion(cached.remote);
      setReleaseUrl(cached.url);
      setCheckState(cached.remote !== pkg.version ? "has-update" : "no-update");
    } else {
      setCheckState("loading");
    }

    try {
      const data = await invoke<{ version: string; htmlUrl: string } | null>("check_update");
      if (!data) {
        if (!cached) setCheckState("error");
        showToast("检查更新失败，请稍后重试", "error");
        return;
      }
      const remote = data.version;
      setLatestVersion(remote);
      setReleaseUrl(data.htmlUrl);
      setCheckState(remote !== pkg.version ? "has-update" : "no-update");
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ remote, url: data.htmlUrl, time: Date.now() }));
      } catch { /* storage full */ }
    } catch (err) {
      // If we had stale cache, we already showed it — just warn
      if (!cached) {
        setCheckState("error");
      }
      showToast("检查更新失败，请稍后重试", "error");
    }
  }, [checkState, showToast]);

  // Reset UI when modal closes
  useEffect(() => {
    if (!open) {
      setCheckState("idle");
      setLatestVersion("");
      setReleaseUrl("");
    }
  }, [open]);

  const goToRelease = () => {
    const url = releaseUrl || `${REPO_URL}/releases/latest`;
    openUrl(url).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <Modal
      open={open}
      title="关于资产快照"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <svg className="size-12 shrink-0 rounded-xl" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="abg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#162018"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </linearGradient>
              <linearGradient id="aaccent" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#2D4A35"/>
                <stop offset="100%" stopColor="#5A9E6F"/>
              </linearGradient>
            </defs>
            <rect x="48" y="48" width="928" height="928" rx="196" fill="url(#abg)"/>
            <rect x="224" y="620" width="120" height="176" rx="16" fill="url(#aaccent)" opacity="0.55"/>
            <rect x="416" y="500" width="120" height="296" rx="16" fill="url(#aaccent)" opacity="0.72"/>
            <rect x="608" y="340" width="120" height="456" rx="16" fill="url(#aaccent)" opacity="0.92"/>
            <polyline points="284,592 476,472 668,312" stroke="#6BCB85" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <line x1="668" y1="312" x2="748" y2="248" stroke="#6BCB85" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="284" cy="592" r="20" fill="#6BCB85"/>
            <circle cx="476" cy="472" r="20" fill="#6BCB85"/>
            <circle cx="668" cy="312" r="20" fill="#6BCB85"/>
            <circle cx="748" cy="248" r="16" fill="#6BCB85" opacity="0.6"/>
          </svg>
          <div>
            <p className="font-semibold text-ink">资产快照</p>
            <button
              type="button"
              onClick={checkUpdate}
              disabled={checkState === "loading"}
              className="group inline-flex items-center gap-1.5 text-sm text-ink/50 transition hover:text-ink/80 disabled:cursor-default cursor-pointer"
            >
              v{pkg.version}
              {checkState === "loading" ? (
                <Loader2 size={12} className="animate-spin text-ink/40" />
              ) : checkState === "no-update" ? (
                <span className="text-[10px] text-mint/80 whitespace-nowrap">已是最新</span>
              ) : checkState === "error" ? (
                <span className="text-[10px] text-coral/80 whitespace-nowrap">获取失败</span>
              ) : (
                <span className="text-[10px] text-ink/25 opacity-0 transition group-hover:opacity-100 whitespace-nowrap">检查更新</span>
              )}
            </button>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink/65">
          一款轻量、本地优先的个人资产追踪工具。支持多平台账户管理、快照记录、趋势图表与资产分析，数据文件可选加密保护。
        </p>

        <p className="text-sm leading-relaxed text-ink/40">
          背景中的无何有之树，取自《庄子》「无何有之乡，广莫之野」。
        </p>

        <button
          type="button"
          onClick={openRepo}
          className="inline-flex items-center gap-2 rounded-md border border-ink/10 bg-subtle px-3 py-2 text-sm text-ink/70 transition hover:bg-mint/40 hover:text-ink cursor-pointer"
        >
          <GithubIcon />
          查看源代码
          <ExternalLink size={12} className="text-ink/35" />
          <span className="text-ink/35">yuannancheng/asset-snapshot</span>
        </button>
      </div>

      <Modal
        open={checkState === "has-update"}
        title="发现新版本"
        onClose={() => setCheckState("no-update")}
        footer={
          <>
            <button
              type="button"
              onClick={goToRelease}
              className="rounded-md bg-mint/80 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mint cursor-pointer"
            >
              前往发布页
            </button>
            <button
              type="button"
              onClick={() => setCheckState("no-update")}
              className="rounded-md border border-ink/10 bg-subtle px-3 py-1.5 text-sm text-ink/60 transition hover:text-ink cursor-pointer"
            >
              关闭
            </button>
          </>
        }
      >
        <p className="text-sm text-ink/80">
          发现新版本 <span className="font-semibold text-mint/90">v{latestVersion}</span>，当前版本 v{pkg.version}。
        </p>
      </Modal>

    </Modal>
  );
}
