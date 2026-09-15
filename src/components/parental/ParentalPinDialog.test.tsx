import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { createQueryClient } from "../../api/queryClient";
import i18n from "../../i18n";
import { theme } from "../../theme";
import { ParentalPinDialog } from "./ParentalPinDialog";

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: { get: vi.fn(), post: apiPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const pinError = (code: string, details: unknown[] = []) =>
  new ApiError(403, "Forbidden", {
    code,
    type: "business_rule_violation",
    // Never shown: the dialog words every error from its code.
    message: `backend text for ${code}`,
    details,
  });

const lockedFor = (seconds: number) =>
  pinError("PARENTAL_PIN_LOCKED", [
    {
      code: "PARENTAL_PIN_LOCKED",
      message: `Try again in ${seconds} seconds`,
      metadata: { retry_after_seconds: seconds },
    },
  ]);

function renderDialog() {
  const onUnlocked = vi.fn();
  const onCancel = vi.fn();
  const client = createQueryClient();
  const ui = (open: boolean) => (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ParentalPinDialog open={open} onUnlocked={onUnlocked} onCancel={onCancel} />
      </ThemeProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(ui(true));
  /** Closes or reopens the challenge, keeping the dialog mounted as the provider does. */
  const setOpen = (open: boolean) => rerender(ui(open));
  return { onUnlocked, onCancel, setOpen };
}

const pinField = () => screen.getByLabelText("Parental PIN") as HTMLInputElement;
const submitButton = () => screen.getByRole("button", { name: "Unlock" });
const unlockCalls = () => apiPost.mock.calls.filter(([path]) => path === "/parental/unlock");

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ParentalPinDialog — PIN input", () => {
  it("accepts exactly six ASCII digits before submit enables", async () => {
    renderDialog();

    await userEvent.type(pinField(), "1234");
    expect(pinField().value).toBe("1234");
    expect(submitButton()).toBeDisabled();

    // Letters and digits from other scripts never count.
    await userEvent.type(pinField(), "ab٣٤");
    expect(pinField().value).toBe("1234");
    expect(submitButton()).toBeDisabled();

    await userEvent.type(pinField(), "567");
    expect(pinField().value).toBe("123456");
    expect(submitButton()).toBeEnabled();
  });

  it("keeps a pasted PIN whole, dropping separators", async () => {
    renderDialog();

    await userEvent.click(pinField());
    await userEvent.paste("12 34 56");

    expect(pinField().value).toBe("123456");
    expect(submitButton()).toBeEnabled();
  });

  it("is a numeric field that password managers neither save nor fill", () => {
    renderDialog();

    // A password input would be offered to the password manager, which
    // then suggests the PIN to whoever holds the device next.
    expect(pinField()).not.toHaveAttribute("type", "password");
    expect(pinField()).toHaveAttribute("type", "text");
    expect(pinField()).toHaveAttribute("inputmode", "numeric");
    expect(pinField()).toHaveAttribute("autocomplete", "off");
    expect(pinField()).toHaveAttribute("data-1p-ignore");
    expect(pinField()).toHaveAttribute("data-lpignore", "true");
    expect(pinField()).toHaveAttribute("data-bwignore");
    expect(pinField()).toHaveAttribute("data-form-type", "other");
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[autocomplete="new-password"]')).toBeNull();
    expect(dialog.querySelector('input[type="password"]')).toBeNull();
  });

  it("sends the PIN and reports the unlock", async () => {
    apiPost.mockResolvedValue(undefined);
    const { onUnlocked, onCancel } = renderDialog();

    await userEvent.type(pinField(), "123456");
    await userEvent.click(submitButton());

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith("/parental/unlock", { pin: "123456" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("ParentalPinDialog — refusals", () => {
  it("keeps the dialog open and clears the field on PARENTAL_PIN_INVALID", async () => {
    apiPost.mockRejectedValue(pinError("PARENTAL_PIN_INVALID"));
    const { onUnlocked, onCancel } = renderDialog();

    await userEvent.type(pinField(), "654321");
    await userEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong PIN. Try again.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(pinField().value).toBe("");
    expect(onUnlocked).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByText(/backend text/)).not.toBeInTheDocument();
  });

  it("returns focus to the cleared field after PARENTAL_PIN_INVALID", async () => {
    apiPost.mockRejectedValue(pinError("PARENTAL_PIN_INVALID"));
    renderDialog();

    await userEvent.type(pinField(), "654321");
    await userEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong PIN. Try again.");
    await waitFor(() => expect(pinField()).toHaveFocus());
    expect(pinField()).toBeEnabled();
  });

  it("counts down from retry_after_seconds on PARENTAL_PIN_LOCKED and sends nothing until zero", async () => {
    vi.useFakeTimers();
    apiPost.mockRejectedValueOnce(lockedFor(3)).mockResolvedValue(undefined);
    renderDialog();
    /** Lets the mutation's promise chain settle without passing a second. */
    const flush = () => act(() => vi.advanceTimersByTimeAsync(10));

    fireEvent.change(pinField(), { target: { value: "111111" } });
    fireEvent.click(submitButton());
    await flush();
    await flush();

    expect(screen.getByText("Too many wrong attempts. Try again in 0:03.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(unlockCalls()).toHaveLength(1);

    // A complete PIN during the lock still cannot be sent.
    fireEvent.change(pinField(), { target: { value: "222222" } });
    expect(submitButton()).toBeDisabled();
    fireEvent.submit(submitButton().closest("form")!);
    await flush();
    expect(unlockCalls()).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText("Too many wrong attempts. Try again in 0:02.")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText("Too many wrong attempts. Try again in 0:01.")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(unlockCalls()).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.queryByText(/Too many wrong attempts/)).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();

    fireEvent.click(submitButton());
    await flush();
    expect(unlockCalls()).toHaveLength(2);
    expect(unlockCalls()[1]).toEqual(["/parental/unlock", { pin: "222222" }]);
  });

  it("closes through Cancel without sending anything", async () => {
    const { onCancel } = renderDialog();

    await userEvent.type(pinField(), "123");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(apiPost).not.toHaveBeenCalled();
  });
});

describe("ParentalPinDialog — lock follows the clock", () => {
  /** Lets the mutation's promise chain settle without passing a second. */
  const flush = () => act(() => vi.advanceTimersByTimeAsync(10));

  /** Submits a PIN the backend answers with a lock of ``seconds``. */
  async function lockDevice(seconds: number) {
    vi.useFakeTimers();
    apiPost.mockRejectedValueOnce(lockedFor(seconds)).mockResolvedValue(undefined);
    const rendered = renderDialog();
    fireEvent.change(pinField(), { target: { value: "111111" } });
    fireEvent.click(submitButton());
    await flush();
    await flush();
    return rendered;
  }

  /**
   * The tablet sleeps through the lock: timers stay paused while the
   * wall clock moves ``seconds`` ahead.
   */
  const sleepFor = (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000);

  /** A complete PIN can be sent, and nothing says the device is locked. */
  function expectUnlocked() {
    expect(screen.queryByText(/Too many wrong attempts/)).not.toBeInTheDocument();
    fireEvent.change(pinField(), { target: { value: "222222" } });
    expect(submitButton()).toBeEnabled();
  }

  it("ends the lock on the next tick once the deadline passed while timers were paused", async () => {
    await lockDevice(300);
    expect(screen.getByText("Too many wrong attempts. Try again in 5:00.")).toBeInTheDocument();

    sleepFor(600);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expectUnlocked();
    fireEvent.click(submitButton());
    await flush();
    expect(unlockCalls()).toHaveLength(2);
  });

  it("ends the lock when the page becomes visible after the deadline", async () => {
    await lockDevice(300);

    sleepFor(600);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expectUnlocked();
  });

  it("ends the lock when the challenge reopens after the deadline", async () => {
    const { setOpen } = await lockDevice(300);

    setOpen(false);
    sleepFor(600);
    setOpen(true);

    expectUnlocked();
  });

  it("keeps the lock, still counting, when the clock has not reached the deadline", async () => {
    await lockDevice(300);

    sleepFor(120);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("Too many wrong attempts. Try again in 3:00.")).toBeInTheDocument();
    fireEvent.change(pinField(), { target: { value: "222222" } });
    expect(submitButton()).toBeDisabled();
    expect(unlockCalls()).toHaveLength(1);
  });

  it("announces a lock once through a status region, not on every tick", async () => {
    await lockDevice(300);

    const status = screen.getByRole("status");
    const announcement = "Too many wrong attempts. The PIN is locked for 5 minutes.";
    expect(status.textContent).toBe(announcement);

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText("Too many wrong attempts. Try again in 4:59.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe(announcement);

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(status.textContent).toBe(announcement);
  });
});
