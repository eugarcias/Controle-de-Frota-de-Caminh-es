'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, User, Loader2, CheckCircle2, AlertTriangle, Shield, Truck as TruckIcon, Phone, Mail } from 'lucide-react';
import { Modal, primaryBtn, secondaryBtn, inputCls } from '@/components/ui';

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  canChangeTruck?: boolean;
  driver?: {
    id: string;
    name: string;
    phone: string;
    cnhNumber?: string | null;
    cnhCategory?: string | null;
    avatarUrl?: string | null;
  } | null;
  truck?: {
    plate: string;
    model: string;
    brand: string;
  } | null;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: UserProfileData | null;
  onProfileUpdated?: (updated: UserProfileData) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setMsg({ ok: false, text: 'A imagem deve ter no máximo 8 MB.' });
      return;
    }

    setUploading(true);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/driver/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar imagem.');

      const newUrl = `/api/driver/upload?path=${encodeURIComponent(data.path)}`;
      setAvatarUrl(newUrl);
      setMsg({ ok: true, text: 'Foto carregada! Clique em Salvar Alterações para confirmar.' });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || 'Erro ao fazer upload da foto.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          avatarUrl: avatarUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil.');

      setMsg({ ok: true, text: 'Perfil atualizado com sucesso!' });
      if (onProfileUpdated && initialProfile) {
        onProfileUpdated({
          ...initialProfile,
          name: name.trim(),
          avatarUrl: avatarUrl || null,
        });
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || 'Erro ao salvar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Meu Perfil"
      subtitle="Gerencie seus dados pessoais, foto de perfil e visualize suas permissões."
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Foto de Perfil */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center border-2 border-emerald-500 shadow-md">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || 'Foto de Perfil'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-zinc-400 dark:text-zinc-500" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-black text-white hover:bg-zinc-800 shadow-lg border border-white dark:border-zinc-700 transition"
              title="Trocar foto"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <Camera className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-1 text-center sm:text-left">
            <p className="text-sm font-bold text-zinc-900 dark:text-white">Sua Foto de Perfil</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Formatos aceitos: JPG, PNG, WEBP até 8 MB.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 transition"
              >
                {uploading ? 'Carregando…' : 'Escolher Foto'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Informações Básicas */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1">
              Nome Completo
            </label>
            <input
              required
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1">
              Login de Acesso
            </label>
            <input
              disabled
              className={`${inputCls} opacity-70 cursor-not-allowed`}
              value={initialProfile?.email?.replace('@vsmgarcia.internal', '') ?? ''}
            />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 block">
              Para alterar seu login ou senha, consulte o administrador.
            </span>
          </div>
        </div>

        {/* Detalhes de Cargo e Permissões */}
        <div className="rounded-2xl p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/80 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Nível de Acesso
            </span>
            <span className="font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
              {initialProfile?.role === 'ADMIN' ? 'Administrador' : 'Motorista'}
            </span>
          </div>

          {initialProfile?.driver && (
            <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-700">
              <span className="text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Telefone de Contato
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {initialProfile.driver.phone || 'Não informado'}
              </span>
            </div>
          )}

          {initialProfile?.truck && (
            <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-700">
              <span className="text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
                <TruckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Caminhão Padrão Vinculado
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {initialProfile.truck.plate} — {initialProfile.truck.model}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-700">
            <span className="text-zinc-500 dark:text-zinc-400 font-semibold">
              Permissão de Troca de Caminhão
            </span>
            <span
              className={`font-bold px-2 py-0.5 rounded ${
                initialProfile?.canChangeTruck !== false
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
              }`}
            >
              {initialProfile?.canChangeTruck !== false ? 'Permitido' : 'Bloqueado pelo Admin'}
            </span>
          </div>
        </div>

        {/* Feedback visual */}
        {msg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              msg.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            {msg.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <button type="button" onClick={onClose} className={secondaryBtn} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando…
              </>
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
