import { useState, type FormEvent } from "react";
import { Alert, Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useLogin } from "../api/auth";
import {
  AuthShell,
  Checkbox,
  Field,
  MarkBadge,
  PrimaryButton,
} from "../components/auth";
import { Logo } from "../components/Logo";

const REMEMBER_EMAIL_KEY = "homeflix:auth:remember-email";

/**
 * Variação B login screen — single full-bleed dark surface, peach
 * halos, centered card.
 *
 * Backend contract: POST ``/api/v1/auth/cookie/login`` with
 * form-encoded ``username`` (the email) + ``password``. 204 + Set-Cookie
 * on success, 400 on bad creds. The cookie roundtrips via
 * ``credentials: 'include'`` set in ``api/client.ts``.
 *
 * Misalignment decisions baked in (see project memory):
 * - The "Criar conta" / "Esqueci a senha" links from the mock are
 *   hidden — the backend has no public signup or password-reset
 *   route yet (ADR-011, CLI-only bootstrap).
 * - "Lembrar-me" is cosmetic: it persists the email in
 *   ``localStorage`` so subsequent visits prefill the field. The
 *   backend's session lifetime is fixed at 90 days; the checkbox
 *   doesn't change that.
 */
export function Login() {
  const navigate = useNavigate();
  const login = useLogin();

  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Already-authenticated visitors are bounced to ``/profiles`` by
  // the route-level ``RedirectIfAuthenticated`` guard before this
  // component ever mounts, so no in-page useEffect is needed.

  const submitting = login.isPending;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    try {
      await login.mutateAsync({ email: email.trim(), password });
      if (typeof window !== "undefined") {
        if (remember) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      }
      navigate("/profiles", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError("Email ou senha inválidos.");
      } else {
        setError("Não foi possível entrar. Tente novamente em instantes.");
      }
    }
  }

  return (
    <AuthShell>
      {/* Header logo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: { xs: 3, sm: 4.5 }, py: 3.5 }}>
        <Logo size={22} />
        <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
          HomeFlix
        </Typography>
      </Box>

      {/* Centred form */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <MarkBadge />

          <Typography
            variant="h1"
            sx={{
              mt: 3.5,
              mb: 1.25,
              fontSize: { xs: 26, sm: 32 },
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            Entrar no HomeFlix
          </Typography>

          <Typography
            sx={{
              mt: 0,
              mb: 4.5,
              fontSize: 14,
              lineHeight: 1.55,
              color: "rgba(245, 241, 235, 0.55)",
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            Use as credenciais do administrador para acessar sua biblioteca privada.
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                width: "100%",
                mb: 2,
                bgcolor: "rgba(248, 113, 113, 0.08)",
                color: "rgba(252, 165, 165, 0.95)",
                border: "1px solid rgba(248, 113, 113, 0.25)",
              }}
            >
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 1.75 }}
          >
            <Field
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={email.length === 0}
              disabled={submitting}
            />
            <Field
              label="Senha"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoFocus={email.length > 0}
              rightSlot={
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  sx={{
                    background: "transparent",
                    border: "none",
                    color: "text.secondary",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    "&:hover": { color: "text.primary" },
                  }}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Box>
              }
            />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                my: 0.75,
              }}
            >
              <Checkbox
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                label="Lembrar-me"
                disabled={submitting}
              />
            </Box>

            <PrimaryButton type="submit" disabled={!canSubmit}>
              {submitting ? "Entrando…" : "Entrar"}
            </PrimaryButton>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: { xs: 3, sm: 4.5 },
          py: 2.5,
          display: "flex",
          justifyContent: "center",
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "text.secondary",
        }}
      >
        <span>HomeFlix · Servidor local</span>
      </Box>
    </AuthShell>
  );
}
