"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, updatePassword, type FormMessage } from "@/actions/auth";
import { Spinner } from "@/components/ui/Spinner";

function Message({ state }: { state: FormMessage }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-2xl px-4 py-3 font-bold ${state.ok ? "bg-ok-fundo text-ok" : "bg-erro-fundo text-erro"}`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ pending, children, pendingText }: { pending: boolean; children: React.ReactNode; pendingText: string }) {
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <Spinner /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-5">
      {notice ? <p className="rounded-2xl bg-alerta-fundo px-4 py-3 text-alerta">{notice}</p> : null}
      <div>
        <label htmlFor="email" className="field-label">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Senha
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <Message state={state} />
      <SubmitButton pending={pending} pendingText="Entrando…">
        Entrar
      </SubmitButton>
      <Link href="/admin/esqueci-senha" className="block text-center font-bold text-tinta underline-offset-4 hover:underline">
        Esqueci minha senha
      </Link>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-5">
      <p className="text-suave">Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
      <div>
        <label htmlFor="email" className="field-label">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <Message state={state} />
      <SubmitButton pending={pending} pendingText="Enviando…">
        Enviar link
      </SubmitButton>
      <Link href="/admin/login" className="block text-center font-bold text-tinta underline-offset-4 hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="password" className="field-label">
          Nova senha
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" />
        <span className="field-hint">Pelo menos 10 caracteres. Uma frase fácil de lembrar funciona bem.</span>
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">
          Repita a nova senha
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="input" />
      </div>
      <Message state={state} />
      <SubmitButton pending={pending} pendingText="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
