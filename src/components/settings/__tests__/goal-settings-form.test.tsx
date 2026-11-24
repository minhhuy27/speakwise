import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoalSettingsForm } from "@/components/settings/goal-settings-form";

afterEach(() => {
  cleanup();
});

describe("GoalSettingsForm", () => {
  it("updates target score when clicking a quick preset chip", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <GoalSettingsForm
        initialProfile={{ targetScore: 750, dailyNewWordsLimit: 15 }}
        onSave={onSave}
      />
    );

    const targetInput = screen.getByLabelText(
      /target total score/i
    ) as HTMLInputElement;
    expect(targetInput.value).toBe("750");

    await user.click(screen.getByRole("button", { name: "850" }));
    expect(targetInput.value).toBe("850");
  });

  it("shows a validation error when submitting a non-multiple of 5 score", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <GoalSettingsForm
        initialProfile={{ targetScore: 750, dailyNewWordsLimit: 15 }}
        onSave={onSave}
      />
    );

    const targetInput = screen.getByLabelText(/target total score/i);
    await user.clear(targetInput);
    await user.type(targetInput, "753");

    await user.click(
      screen.getByRole("button", { name: /save study goals/i })
    );

    expect(
      await screen.findByText(/target score must be a multiple of 5/i)
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submits validated values with null for empty optional fields", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <GoalSettingsForm
        initialProfile={{ targetScore: 750, dailyNewWordsLimit: 15 }}
        isOnboarding
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("button", { name: "850" }));

    const dailyInput = screen.getByLabelText(/daily new vocabulary limit/i);
    await user.clear(dailyInput);
    await user.type(dailyInput, "20");

    await user.click(
      screen.getByRole("button", { name: /save goals & continue/i })
    );

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith({
      targetScore: 850,
      targetListening: null,
      targetReading: null,
      targetExamDate: null,
      dailyNewWordsLimit: 20,
    });
  });
});
