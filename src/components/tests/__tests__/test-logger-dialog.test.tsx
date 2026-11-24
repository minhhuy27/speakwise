import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestLoggerDialog } from "@/components/tests/test-logger-dialog";

afterEach(() => {
  cleanup();
});

describe("TestLoggerDialog", () => {
  it("updates live ETS /990 score preview immediately when typing Part scores", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmitTest = vi.fn().mockResolvedValue(undefined);

    render(
      <TestLoggerDialog
        open
        onOpenChange={onOpenChange}
        onSubmitTest={onSubmitTest}
      />
    );

    const preview = screen.getByTestId("live-score-preview");
    expect(preview).toHaveTextContent(/Listening:\s*5\/495/i);
    expect(preview).toHaveTextContent(/Reading:\s*5\/495/i);
    expect(preview).toHaveTextContent(/Total:\s*10\s*\/\s*990/i);

    const part2Input = screen.getByLabelText("Part 2 correct");
    await user.clear(part2Input);
    await user.type(part2Input, "25");

    const part5Input = screen.getByLabelText("Part 5 correct");
    await user.clear(part5Input);
    await user.type(part5Input, "25");

    expect(preview).toHaveTextContent(/Listening:\s*105\/495/i);
    expect(preview).toHaveTextContent(/Reading:\s*90\/495/i);
    expect(preview).toHaveTextContent(/Total:\s*195\s*\/\s*990/i);
  });

  it("shows Manual Listening and Reading inputs when toggling Manual Score Override", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmitTest = vi.fn().mockResolvedValue(undefined);

    render(
      <TestLoggerDialog
        open
        onOpenChange={onOpenChange}
        onSubmitTest={onSubmitTest}
      />
    );

    expect(
      screen.queryByLabelText(/manual listening score/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/manual reading score/i)
    ).not.toBeInTheDocument();

    const overrideCheckbox = screen.getByLabelText(/manual score override/i);
    await user.click(overrideCheckbox);

    const manualListening = screen.getByLabelText(/manual listening score/i);
    const manualReading = screen.getByLabelText(/manual reading score/i);

    expect(manualListening).toBeInTheDocument();
    expect(manualReading).toBeInTheDocument();

    await user.clear(manualListening);
    await user.type(manualListening, "440");
    await user.clear(manualReading);
    await user.type(manualReading, "410");

    const preview = screen.getByTestId("live-score-preview");
    expect(preview).toHaveTextContent(/Listening:\s*440\/495/i);
    expect(preview).toHaveTextContent(/Reading:\s*410\/495/i);
    expect(preview).toHaveTextContent(/Total:\s*850\s*\/\s*990/i);
  });

  it("switches to Mini / Part Practice mode and updates the preview and part selection cleanly", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmitTest = vi.fn().mockResolvedValue(undefined);

    render(
      <TestLoggerDialog
        open
        onOpenChange={onOpenChange}
        onSubmitTest={onSubmitTest}
      />
    );

    await user.click(
      screen.getByRole("tab", { name: /mini \/ part practice/i })
    );

    const preview = screen.getByTestId("live-score-preview");
    expect(preview).toHaveTextContent(
      /Selected Parts:\s*0\s*\/\s*0\s*correct\s*\(0%\)/i
    );
    expect(
      screen.queryByLabelText(/manual score override/i)
    ).not.toBeInTheDocument();

    const part5Toggle = screen.getByRole("checkbox", {
      name: /include part 5/i,
    });
    await user.click(part5Toggle);

    const part5Correct = screen.getByLabelText("Part 5 correct");
    const part5Total = screen.getByLabelText("Part 5 total");
    expect(part5Correct).not.toBeDisabled();
    expect(part5Total).not.toBeDisabled();

    await user.clear(part5Correct);
    await user.type(part5Correct, "24");

    expect(preview).toHaveTextContent(
      /Selected Parts:\s*24\s*\/\s*30\s*correct\s*\(80%\)/i
    );

    await user.type(screen.getByLabelText(/test title/i), "Part 5 Drill");
    await user.click(
      screen.getByRole("button", { name: /save test attempt/i })
    );

    await waitFor(() => {
      expect(onSubmitTest).toHaveBeenCalledTimes(1);
    });

    expect(onSubmitTest).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "mini_or_part",
        title: "Part 5 Drill",
        parts: {
          part5: { correct: 24, total: 30 },
        },
        isManualScoreOverride: false,
      })
    );
  });
});
