import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import i18n from "../../i18n";
import { theme } from "../../theme";
import { UsersAdmin } from "./UsersAdmin";

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: { get: apiGet, post: apiPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

function renderUsers() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <UsersAdmin />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/** Renders the page, opens the invite modal and fills in the account fields. */
async function openInvite() {
  renderUsers();
  await userEvent.click(await screen.findByRole("button", { name: "Invite user" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.type(dialog.querySelector('input[type="email"]')!, "kid@home.test");
  await userEvent.type(dialog.querySelector('input[type="password"]')!, "known-password");
  return dialog;
}

describe("invite user dialog", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ data: [] });
    apiPost.mockResolvedValue({
      data: {
        id: "u1",
        email: "kid@home.test",
        role: "member",
        profile_count: 0,
        created_at: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("defaults to the member role", async () => {
    const dialog = await openInvite();

    expect(within(dialog).getByRole("radio", { name: /Member/ })).toBeChecked();

    await userEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/admin/users", {
        email: "kid@home.test",
        password: "known-password",
        role: "member",
      }),
    );
  });

  it("submits the admin role when its card is picked", async () => {
    const dialog = await openInvite();

    await userEvent.click(within(dialog).getByRole("radio", { name: /Admin/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/admin/users", {
        email: "kid@home.test",
        password: "known-password",
        role: "admin",
      }),
    );
  });

  it("reveals and re-masks the initial password", async () => {
    const dialog = await openInvite();

    await userEvent.click(within(dialog).getByRole("button", { name: "Show password" }));
    expect(dialog.querySelector('input[type="password"]')).toBeNull();
    expect(dialog.querySelector('input[type="text"]')).toHaveValue("known-password");

    await userEvent.click(within(dialog).getByRole("button", { name: "Hide password" }));
    expect(dialog.querySelector('input[type="password"]')).toBeTruthy();
  });

  it("closes without submitting from the header close button", async () => {
    const dialog = await openInvite();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiPost).not.toHaveBeenCalled();
  });
});
