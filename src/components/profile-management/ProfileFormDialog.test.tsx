import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import type { Library, Profile } from "../../api/types";
import i18n from "../../i18n";
import { theme } from "../../theme";
import { ProfileFormDialog, type ProfileFormSubmit } from "./ProfileFormDialog";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(),
    postMultipart: vi.fn() },
}));

/** The cap the server reports, unless a test says otherwise. */
const AVATAR_LIMITS = { max_size_bytes: 2 * 1024 * 1024, max_size_mb: 2, size_pixels: 256 };

/** A ``File`` of ``size`` bytes with the given MIME, without allocating it. */
function fakeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/**
 * Pick a file through the hidden input.
 *
 * ``applyAccept: false`` mirrors the real escape hatch: the ``accept``
 * attribute only filters what the OS dialog offers by default, and a
 * user who switches it to "All files" — or drops a file on the input —
 * still hands over anything. That is the only way the unsupported-format
 * branch is reachable, so the test has to reach it the same way.
 */
const pickFile = async (file: File) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(input, file, { applyAccept: false });
};

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

function renderDialog(profile: Profile | null, libraries: Library[] = LIBRARIES) {
  const onSubmit = vi.fn<(body: ProfileFormSubmit) => void>();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <ProfileFormDialog
          open
          profile={profile}
          libraries={libraries}
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

const slider = () => screen.getByRole("slider", { name: "Age limit" });

/** Click the ladder step drawn for ``limit`` (``null`` = unrestricted), as a pointer would. */
const clickStep = (limit: number | null) =>
  userEvent.click(document.querySelector<HTMLElement>(`[data-step="${limit ?? "unrestricted"}"]`)!);

const drawnSteps = () =>
  [...document.querySelectorAll<HTMLElement>("[data-step]")].map((element) => element.dataset.step);

beforeEach(async () => {
  vi.clearAllMocks();
  flags.parentalControls = true;
  await i18n.changeLanguage("en");
  apiGet.mockImplementation((path: string) =>
    path === "/settings/avatar"
      ? Promise.resolve({ data: AVATAR_LIMITS })
      : new Promise(() => {}),
  );
});

describe("ProfileFormDialog — maturity limit", () => {
  it("renames a limited profile without writing is_kids or the limit", async () => {
    const onSubmit = renderDialog(profileWithLimit(14));

    expect(slider()).toHaveAttribute("aria-valuetext", "Up to age 14");
    const name = screen.getByLabelText("Profile name");
    await userEvent.clear(name);
    await userEvent.type(name, "Kiddo");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(submitted(onSubmit)).toEqual({
      name: "Kiddo",
      allowed_library_ids: ["lib_movies"],
    });
  });

  it("edits a limited profile's libraries without writing the limit", async () => {
    const onSubmit = renderDialog(profileWithLimit(14));

    await userEvent.click(screen.getByRole("checkbox", { name: /Shows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(submitted(onSubmit)).not.toHaveProperty("maturity_limit");
  });

  it.each([
    ["Unrestricted", null],
    ["All ages", 0],
    ["Up to age 10", 10],
    ["Up to age 12", 12],
    ["Up to age 14", 14],
    ["Up to age 16", 16],
  ])("maps the %s step to maturity_limit %s", async (title, value) => {
    // 18 is outside the steps, so every step is a change.
    const onSubmit = renderDialog(profileWithLimit(18));

    await clickStep(value);
    expect(slider()).toHaveAttribute("aria-valuetext", title);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(submitted(onSubmit)).toHaveProperty("maturity_limit", value);
  });

  it("writes the step reached with the keyboard", async () => {
    const onSubmit = renderDialog(profileWithLimit(12));

    slider().focus();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(submitted(onSubmit)).toHaveProperty("maturity_limit", 14);
  });

  it("lists a limit set outside the steps as the selected one", () => {
    renderDialog(profileWithLimit(18));

    expect(slider()).toHaveAttribute("aria-valuetext", "Up to age 18");
    expect(drawnSteps()).toEqual(["0", "10", "12", "14", "16", "18", "unrestricted"]);
    expect(document.querySelector('[data-step="18"]')).toHaveAttribute("data-selected", "true");
  });

  it("offers the D7 steps on create, starting unrestricted, and writes a chosen limit", async () => {
    const onSubmit = renderDialog(null);

    expect(drawnSteps()).toEqual(["0", "10", "12", "14", "16", "unrestricted"]);
    expect(slider()).toHaveAttribute("aria-valuetext", "Unrestricted");
    await userEvent.type(screen.getByLabelText("Profile name"), "Kid");
    await clickStep(12);
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(submitted(onSubmit)).toEqual({
      name: "Kid",
      allowed_library_ids: [],
      maturity_limit: 12,
    });
  });

  it("keeps “how ratings work” closed until asked, and warns there about cached video", async () => {
    renderDialog(profileWithLimit(null));

    const toggle = screen.getByRole("button", { name: "How ratings work" });
    const caveat = screen.getByText(/video the server has already cached can still be reached/);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(caveat).not.toBeVisible();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(caveat).toBeVisible();
  });

  it("lays the form out as a basics section and an age limit section, at the md width", () => {
    renderDialog(profileWithLimit(14));

    const basics = screen.getByRole("region", { name: "Profile details" });
    const maturity = screen.getByRole("region", { name: "Parental controls" });
    expect(within(basics).getByLabelText("Profile name")).toBeInTheDocument();
    expect(within(basics).getByRole("checkbox", { name: /Shows/ })).toBeInTheDocument();
    expect(within(basics).queryByRole("slider")).not.toBeInTheDocument();
    expect(within(maturity).getByRole("slider", { name: "Age limit" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass("MuiDialog-paperWidthMd");
  });

  it("renders no kids switch", () => {
    renderDialog(profileWithLimit(14));

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByText("Kids mode")).not.toBeInTheDocument();
  });
});

describe("ProfileFormDialog — header and libraries", () => {
  it("tags the edit title with the profile's first name, in capitals", () => {
    renderDialog({ ...profileWithLimit(null), name: "Lucas Cristovam" });

    const title = screen.getByRole("heading", { name: "Edit profile Lucas" });
    const tag = within(title).getByText("Lucas");
    expect(tag).toHaveStyle({ textTransform: "uppercase" });
    expect(title).not.toHaveTextContent("Cristovam");
  });

  it("has no tag on the create title", () => {
    renderDialog(null);

    const title = screen.getByRole("heading", { name: "New profile" });
    expect(title).toHaveTextContent(/^New profile\s*$/);
    expect(title.children).toHaveLength(0);
  });

  it("shows each library's paths under its name", () => {
    renderDialog(profileWithLimit(null));

    expect(screen.getByText("/media/movies")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Movies/ })).toBeChecked();
  });

  it("leaves the path line out when the server sends no paths", async () => {
    // Non-admins (and suspended admins) receive every library without paths.
    const onSubmit = renderDialog(
      profileWithLimit(null),
      LIBRARIES.map((library) => ({ ...library, paths: [] })),
    );

    expect(screen.getByText("Movies").nextElementSibling).toBeNull();
    expect(screen.getByText("Shows").nextElementSibling).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Shows" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: "Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(submitted(onSubmit)).toEqual({
      name: "Kid",
      allowed_library_ids: ["lib_movies", "lib_shows"],
    });
  });
});

describe("ProfileFormDialog — parental controls flag off", () => {
  beforeEach(() => {
    flags.parentalControls = false;
  });

  it("renders no limit slider, no cache note and no kids switch", () => {
    renderDialog(profileWithLimit(14));

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(document.querySelector("[data-step]")).not.toBeInTheDocument();
    expect(screen.queryByText("Age limit")).not.toBeInTheDocument();
    expect(screen.queryByText(/already cached/)).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders only the basics section, at the sm width", () => {
    renderDialog(profileWithLimit(14));

    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "Profile details",
    ]);
    expect(screen.getByRole("dialog")).toHaveClass("MuiDialog-paperWidthSm");
  });

  it("never writes the limit of a limited profile", async () => {
    const onSubmit = renderDialog(profileWithLimit(14));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(submitted(onSubmit)).toEqual({ name: "Kid", allowed_library_ids: ["lib_movies"] });
  });
});

describe("ProfileFormDialog — photo on create", () => {
  it("offers the photo on create and hands the picked file to the parent", async () => {
    const onSubmit = renderDialog(null);

    // The control is there before any profile exists — the whole point:
    // previously the block was rendered only in edit mode.
    await userEvent.click(screen.getByRole("button", { name: "Add photo" }));
    await userEvent.type(screen.getByLabelText("Profile name"), "Bia");
    const file = fakeFile("bia.png", "image/png", 1024);
    await pickFile(file);

    // Held, not uploaded: there is no profile id to upload against yet.
    expect(await screen.findByText("Saved once the profile is created.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(submitted(onSubmit)).toEqual({
      name: "Bia",
      allowed_library_ids: [],
      avatarFile: file,
    });
  });

  it("submits without the key when no photo was picked", async () => {
    const onSubmit = renderDialog(null);

    await userEvent.type(screen.getByLabelText("Profile name"), "Bia");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(submitted(onSubmit)).toEqual({ name: "Bia", allowed_library_ids: [] });
  });

  it("drops a held photo when the operator removes it", async () => {
    const onSubmit = renderDialog(null);

    await userEvent.type(screen.getByLabelText("Profile name"), "Bia");
    await pickFile(fakeFile("bia.png", "image/png", 1024));
    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(submitted(onSubmit)).toEqual({ name: "Bia", allowed_library_ids: [] });
  });
});

describe("ProfileFormDialog — local file check", () => {
  it("states the cap the server reports, not a hard-coded one", async () => {
    apiGet.mockResolvedValue({ data: { ...AVATAR_LIMITS, max_size_mb: 9 } });
    renderDialog(null);

    expect(await screen.findByText("PNG, JPEG or WebP up to 9MB.")).toBeInTheDocument();
  });

  it("refuses an oversized file before the profile is created", async () => {
    const onSubmit = renderDialog(null);
    // Wait for the reported cap so the check runs against it, not the fallback.
    await screen.findByText("PNG, JPEG or WebP up to 2MB.");

    await userEvent.type(screen.getByLabelText("Profile name"), "Bia");
    await pickFile(fakeFile("huge.png", "image/png", 3 * 1024 * 1024));

    expect(
      await screen.findByText("The image is too large. Pick a file under 2MB."),
    ).toBeInTheDocument();

    // Creating still works — it just goes ahead without the photo,
    // rather than creating the profile and then failing the upload.
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(submitted(onSubmit)).toEqual({ name: "Bia", allowed_library_ids: [] });
  });

  it("refuses a format the storage does not accept, picked past the accept filter", async () => {
    const onSubmit = renderDialog(null);
    await screen.findByText("PNG, JPEG or WebP up to 2MB.");

    await userEvent.type(screen.getByLabelText("Profile name"), "Bia");
    await pickFile(fakeFile("clip.gif", "image/gif", 1024));

    expect(
      await screen.findByText("Unsupported format. Use PNG, JPEG or WebP."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(submitted(onSubmit)).toEqual({ name: "Bia", allowed_library_ids: [] });
  });
});
