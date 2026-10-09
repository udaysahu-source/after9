import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryStateView, type DiscoveryDiagnostics } from "@/components/discovery-states";
import type { ProfileRow } from "@/lib/after9";

// Mock @tanstack/react-router Link for testing
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
    onClick,
    ...props
  }: React.ComponentProps<"a"> & { to: string }) => (
    <a href={to} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const mockDiagnostics: DiscoveryDiagnostics = {
  total_active_others: 12,
  swiped_count: 5,
  filter_match_count: 0,
  eligible_unswiped: 0,
  night_counts: { "1": 4, "2": 0, "3": 8 },
  my_nights_count: 3,
  my_min_age: 19,
  my_max_age: 23,
  my_interested_in: "women",
};

const mockProfile: ProfileRow = {
  id: "user-123",
  first_name: "Aarav",
  birth_date: "2002-05-15",
  gender: "man",
  interested_in: "women",
  min_age: 19,
  max_age: 23,
  college: "NIT Raipur",
  branch: "CSE",
  prompt: "Garba beats > EDM drops",
  photo_path: "user-123/profile.jpg",
  nights: [1, 2, 3],
  onboarding_step: 3,
  onboarded: true,
  discoverable: true,
  incognito: false,
  invited_by: null,
  quiz: {},
  show_college: true,
  public_profile_enabled: true,
  verification_status: "approved",
  verification_reason: null,
  visibility_audiences: ["college", "nearby"],
  general_area: "Telibandha",
  push_notifications_enabled: true,
  share_token: "aarav_xyz",
  card_preferences: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

describe("DiscoveryStateView", () => {
  it("renders loading skeleton state with shimmer", () => {
    const { container } = render(
      <DiscoveryStateView
        state="loading"
        selectedNight={null}
        diagnostics={null}
        userProfile={mockProfile}
        onClearNight={vi.fn()}
        onOpenInvite={vi.fn()}
        onOpenShareCard={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Connecting to the floor…")).toBeInTheDocument();
    expect(screen.getByText("Finding Garba circles in Raipur")).toBeInTheDocument();
    expect(container.querySelector(".animate-shimmer")).toBeInTheDocument();
  });

  it("renders zero users state with required headline, copy, and CTAs", () => {
    const handleInvite = vi.fn();
    const handleShareCard = vi.fn();

    render(
      <DiscoveryStateView
        state="zero_users"
        selectedNight={null}
        diagnostics={null}
        userProfile={mockProfile}
        onClearNight={vi.fn()}
        onOpenInvite={handleInvite}
        onOpenShareCard={handleShareCard}
        onRetry={vi.fn()}
      />,
    );

    // Headline & supporting copy
    expect(screen.getByText("Your people are getting ready.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Be part of the first After9 crew. Invite your Garba friends and make your Navratri nights more social.",
      ),
    ).toBeInTheDocument();

    // Primary Action
    const primaryInviteBtn = screen.getByRole("button", { name: /invite your garba crew/i });
    expect(primaryInviteBtn).toBeInTheDocument();
    fireEvent.click(primaryInviteBtn);
    expect(handleInvite).toHaveBeenCalledTimes(1);

    // Secondary Actions
    expect(screen.getByText("Complete your profile")).toBeInTheDocument();
    expect(screen.getByText("Choose your Garba nights")).toBeInTheDocument();
    expect(screen.getByText("Share your After9 card")).toBeInTheDocument();

    // Test clicking Share After9 card
    const shareCardBtn = screen.getByRole("button", { name: /share your after9 card/i });
    fireEvent.click(shareCardBtn);
    expect(handleShareCard).toHaveBeenCalledTimes(1);
  });

  it("renders no eligible profiles for night state and handles actions", () => {
    const handleClearNight = vi.fn();
    const handleInvite = vi.fn();

    render(
      <DiscoveryStateView
        state="no_eligible_for_night"
        selectedNight={4}
        diagnostics={mockDiagnostics}
        userProfile={mockProfile}
        onClearNight={handleClearNight}
        onOpenInvite={handleInvite}
        onOpenShareCard={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Nobody on the floor for Night 4 yet.")).toBeInTheDocument();
    expect(screen.getByText(/Dancers have selected other festival nights!/i)).toBeInTheDocument();

    // Action 1: Show all festival nights
    const showAllBtn = screen.getByRole("button", { name: /show all festival nights/i });
    fireEvent.click(showAllBtn);
    expect(handleClearNight).toHaveBeenCalledTimes(1);

    // Action 2: Invite for Night 4
    const inviteNightBtn = screen.getByRole("button", { name: /invite friends for night 4/i });
    fireEvent.click(inviteNightBtn);
    expect(handleInvite).toHaveBeenCalledTimes(1);
  });

  it("renders filters restrictive state and handles filter expansion", () => {
    const handleExpandFilters = vi.fn();
    const handleInvite = vi.fn();

    render(
      <DiscoveryStateView
        state="filters_restrictive"
        selectedNight={null}
        diagnostics={mockDiagnostics}
        userProfile={mockProfile}
        onClearNight={vi.fn()}
        onOpenInvite={handleInvite}
        onOpenShareCard={vi.fn()}
        onRetry={vi.fn()}
        onExpandFilters={handleExpandFilters}
      />,
    );

    expect(screen.getByText("No one matches your filters.")).toBeInTheDocument();
    expect(screen.getByText(/12 active dancers/i)).toBeInTheDocument();

    // Widen age & preference button
    const widenBtn = screen.getByRole("button", { name: /widen age & preference/i });
    fireEvent.click(widenBtn);
    expect(handleExpandFilters).toHaveBeenCalledTimes(1);

    // Invite button
    const inviteBtn = screen.getByRole("button", { name: /invite your garba circle/i });
    fireEvent.click(inviteBtn);
    expect(handleInvite).toHaveBeenCalledTimes(1);
  });

  it("renders all seen state with swiped count and actions", () => {
    const handleInvite = vi.fn();
    const handleShareCard = vi.fn();

    render(
      <DiscoveryStateView
        state="all_seen"
        selectedNight={null}
        diagnostics={mockDiagnostics}
        userProfile={mockProfile}
        onClearNight={vi.fn()}
        onOpenInvite={handleInvite}
        onOpenShareCard={handleShareCard}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("You're all caught up for now.")).toBeInTheDocument();
    expect(screen.getByText(/You've connected with or passed on all/i)).toBeInTheDocument();

    const inviteBtn = screen.getByRole("button", { name: /invite more dancers to raipur/i });
    fireEvent.click(inviteBtn);
    expect(handleInvite).toHaveBeenCalledTimes(1);

    const matchesLink = screen.getByRole("link", { name: /view your clashes & chats/i });
    expect(matchesLink).toHaveAttribute("href", "/matches");
  });

  it("renders error state with retry button", async () => {
    const handleRetry = vi.fn();

    render(
      <DiscoveryStateView
        state="error"
        selectedNight={null}
        diagnostics={null}
        userProfile={mockProfile}
        onClearNight={vi.fn()}
        onOpenInvite={vi.fn()}
        onOpenShareCard={vi.fn()}
        onRetry={handleRetry}
      />,
    );

    expect(screen.getByText("Couldn't reach the festival floor.")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
