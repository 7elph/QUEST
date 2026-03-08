"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AvatarAction, ProfileAvatarOption } from "@/lib/profile-avatars";

type ProfileAvatarPickerProps = {
  options: ProfileAvatarOption[];
  initialAvatarId: string;
  unreadNotifications: number;
  activeMissionCount: number;
  disputeCount: number;
};

type AvatarMode = "idle" | "quest" | "alert";

function getMode(unreadNotifications: number, activeMissionCount: number, disputeCount: number): AvatarMode {
  if (disputeCount > 0 || unreadNotifications >= 3) return "alert";
  if (activeMissionCount > 0) return "quest";
  return "idle";
}

function getAction(mode: AvatarMode): AvatarAction {
  if (mode === "alert") return "hurt";
  if (mode === "quest") return "walk";
  return "idle";
}

export function ProfileAvatarPicker({
  options,
  initialAvatarId,
  unreadNotifications,
  activeMissionCount,
  disputeCount,
}: ProfileAvatarPickerProps) {
  const [selectedId, setSelectedId] = useState(initialAvatarId);
  const [savedId, setSavedId] = useState(initialAvatarId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [actionBoost, setActionBoost] = useState(false);
  const [frame, setFrame] = useState(0);

  const mode = useMemo(
    () => getMode(unreadNotifications, activeMissionCount, disputeCount),
    [activeMissionCount, disputeCount, unreadNotifications],
  );
  const selected = options.find((item) => item.id === selectedId) ?? options[0];
  const baseAction = getAction(mode);
  const action: AvatarAction = actionBoost ? "attack" : baseAction;
  const sheet = selected.sheets[action];

  useEffect(() => {
    setFrame(0);
  }, [selected.id, action]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrame((prev) => (prev + 1) % sheet.frames);
    }, Math.max(60, Math.round(1000 / sheet.fps)));
    return () => window.clearInterval(interval);
  }, [sheet.fps, sheet.frames]);

  const modeLabel =
    mode === "alert"
      ? "Estado: em alerta"
      : mode === "quest"
        ? "Estado: em missao"
        : "Estado: em repouso";

  const save = async () => {
    setSaving(true);
    setMessage("");
    setActionBoost(true);
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: selectedId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "Falha ao salvar avatar.");
        return;
      }
      setSavedId(selectedId);
      setMessage("Avatar salvo.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setActionBoost(false), 900);
    }
  };

  return (
    <div className="space-y-2">
      <div className={`avatar-frame ${mode}`}>
        <div
          className="sprite"
          style={{
            backgroundImage: `url('${sheet.src}')`,
            backgroundPosition: `-${frame * 96}px 0px`,
          }}
        />
      </div>
      <p className="text-center text-xs text-amber-100/85">{modeLabel}</p>

      <div className="grid grid-cols-4 gap-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setSelectedId(option.id);
              setActionBoost(true);
              window.setTimeout(() => setActionBoost(false), 700);
            }}
            className={`relative h-10 rounded-md border p-0.5 ${
              option.id === selectedId
                ? "border-amber-300/70 bg-amber-500/20"
                : "border-amber-200/25 bg-black/20 hover:border-amber-200/40"
            }`}
            aria-label={`Selecionar avatar ${option.label}`}
            title={option.label}
          >
            <Image src={option.previewSrc} alt="" aria-hidden fill className="object-contain" sizes="40px" />
          </button>
        ))}
      </div>

      <Button
        onClick={() => void save()}
        disabled={saving || selectedId === savedId}
        className="w-full border border-amber-200/35 bg-amber-500/85 text-black hover:bg-amber-400"
      >
        {saving ? "Salvando..." : "Salvar avatar"}
      </Button>
      {message && <p className="text-center text-xs text-amber-100/85">{message}</p>}

      <style jsx>{`
        .avatar-frame {
          position: relative;
          margin-inline: auto;
          display: flex;
          height: 118px;
          width: 118px;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 28%, rgba(251, 191, 36, 0.18), rgba(0, 0, 0, 0));
        }

        .sprite {
          width: 96px;
          height: 96px;
          image-rendering: pixelated;
          background-repeat: no-repeat;
          background-size: auto 100%;
        }

        .avatar-frame.idle {
          animation: avatarFloat 4.8s ease-in-out infinite;
        }

        .avatar-frame.quest {
          animation: avatarFloat 2.8s ease-in-out infinite;
          filter: saturate(1.1);
        }

        .avatar-frame.alert {
          animation: avatarAlert 1.4s ease-in-out infinite;
          filter: saturate(1.2) contrast(1.05);
        }

        @keyframes avatarFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes avatarAlert {
          0%,
          100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-3px) scale(1.03);
          }
        }
      `}</style>
    </div>
  );
}

