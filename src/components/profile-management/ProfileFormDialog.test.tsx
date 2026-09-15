import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import type { Library, Profile } from "../../api/types";
import i18n from "../../i18n";
import { theme } from "../../theme";
import { ProfileFormDialog, type ProfileFormSubmit } from "./ProfileFormDialog";

// The flag is a build-time constant; a getter lets each test pick its value.
const flags = vi.hoisted(() => ({ parentalControls: true }));
vi.mock("../../config/featureFlags", () => ({
  SHARE_ENABLED: true,
  get PARENTAL_CONTROLS_ENABLED() {
    return flags.parentalControls;
  },
}));

const LIBRARIES = [
  { id: "lib_movies", name: "Movies", paths: ["/media/movies"] },
  { id: "lib_shows", name: "Shows", paths: ["/media/shows"] },
] as Library[];

const profileWithLimit = (maturity_limit: number | null | undefined): Profile => ({
  id: "prf_kid",
  user_id: "usr_1",
  name: "Kid",
  avatar_url: null,
  is_kids: maturity_limit !== null && maturity_limit !== undefined,
  maturity_limit,
  allowed_library_ids: ["lib_movies"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

function renderDialog(profile: Profile | null) {
  const onSubmit = vi.fn<(body: ProfileFormSubmit) => void>();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <ProfileFormDialog
          open
          profile={profile}
          libraries={LIBRARIES}
          submitting={false}
          onClose={() => {}}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return onSubmit;
}

const submitted = (onSubmit: ReturnType<typeof renderDialog>) => {
  expect(onSubmit).toHaveBeenCalledTimes(1);
  return onSubmit.mock.calls[0][0];
};

beforeEach(async () => {
  flags.parentalControls = true;
  await i18n.changeLanguage("en");
});

describe("ProfileFormDialog — maturity limit", () => {
  it("renames a limited profile without writing is_kids or the limit", async () => {
    const onSubmit = renderDialog(profileWithLimit(14));

    expect(screen.getByRole("radio", { name: "14" })).toBeChecked();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Kiddo");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(submitted(onSubmit)).toEqual({
      name: "Kiddo",
      allowed_library_ids: ["lib_movies"],
    });
  });

  it("edits a limited profile's libraries without writing the limit", async () => {
    const onSubmit = renderDialog(profileWithLimit(14));

    await userEvent.click(screen.getByRole("checkbox", { name: /Shows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(submitted(onSubmit)).not.toHaveProperty("maturity_limit");
  });

  it.each([
    ["Unrestricted", null],
    ["L", 0],
    ["10", 10],
    ["12", 12],
    ["14", 14],
    ["16", 16],
  ])("maps the %s step to maturity_limit %s", async (label, value) => {
    // 18 is outside the steps, so every step is a change.
    const onSubmit = renderDialog(profileWithLimit(18));

    await userEvent.click(screen.getByRole("radio", { name: label }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(submitted(onSubmit)).toHaveProperty("maturity_limit", value);
  });

  it("lists a limit set outside the steps as the selected one", () => {
    renderDialog(profileWithLimit(18));

    expect(screen.getByRole("radio", { name: "18" })).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(7);
  });

  it("offers the D7 steps on create, starting unrestricted, and writes a chosen limit", async () => {
    const onSubmit = renderDialog(null);

    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "unrestricted",
      "0",
      "10",
      "12",
      "14",
      "16",
    ]);
    expect(screen.getByRole("radio", { name: "Unrestricted" })).toBeChecked();
    await userEvent.type(screen.getByLabelText("Name"), "Kid");
    await userEvent.click(screen.getByRole("radio", { name: "12" }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(submitted(onSubmit)).toEqual({
      name: "Kid",
      allowed_library_ids: [],
      maturity_limit: 12,
    });
  });

  it("warns that the limit does not cover already cached video", () => {
    renderDialog(profileWithLimit(null));

    expect(
      screen.getByText(/video the server has already cached can still be reached/),
    ).toBeInTheDocument();
  });

  it("renders no kids switch", () => {
    renderDialog(profileWithLimit(14));

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByText("Kids mode")).not.toBeInTheDocument();
  });
});

describe("ProfileFormDialog — parental controls flag off", () => {
  beforeEach(() => {
    flags.parentalControls = false;
  });

  it("renders no limit selector, no cache note and no kids switch", () => {
    renderDialog(profileWithLimit(14));

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText("Age limit")).not.toBeInTheDocument();
    expect(screen.queryByText(/already cached/)).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("never writes the limit of a limited profile", async () => {
    const onSubmit = renderDialog(profileWithLimit(14));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(submitted(onSubmit)).toEqual({ name: "Kid", allowed_library_ids: ["lib_movies"] });
  });
});
