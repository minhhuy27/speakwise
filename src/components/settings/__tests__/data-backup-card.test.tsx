import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataBackupCard } from "@/components/settings/data-backup-card";
import { buildBackupPayload, serializeBackupPayload } from "@/lib/backup";
import type {
  MistakeRecord,
  TestAttempt,
  UserProfile,
  VocabCard,
} from "@/types/domain";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleProfile: UserProfile = {
  uid: "user-1",
  email: "learner@example.com",
  displayName: "TOEIC Learner",
  targetScore: 800,
  targetListening: 410,
  targetReading: 390,
  targetExamDate: "2026-12-20",
  dailyNewWordsLimit: 15,
  onboardingCompleted: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const sampleVocab: VocabCard[] = [
  {
    id: "v1",
    word: "itinerary",
    displayWord: "itinerary",
    ipa: "/aɪˈtɪn.ə.rer.i/",
    partOfSpeech: "noun",
    meaningEn: "A planned route or journey.",
    meaningVi: "Lịch trình",
    exampleEn: "Please send me your travel itinerary.",
    exampleVi: "Vui lòng gửi cho tôi lịch trình chuyến đi của bạn.",
    wordFamily: [],
    collocations: ["travel itinerary"],
    tags: ["Part 7"],
    status: "new",
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    nextReviewAt: "2026-11-24T00:00:00.000Z",
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
  },
];

const sampleTests: TestAttempt[] = [
  {
    id: "t1",
    mode: "mini_or_part",
    title: "Part 5 Drill",
    source: "ETS 2024",
    takenAt: "2026-11-20",
    durationMinutes: 15,
    parts: { part5: { correct: 24, total: 30 } },
    listeningCorrect: 0,
    readingCorrect: 24,
    listeningScore: 0,
    readingScore: 0,
    totalScore: 0,
    isManualScoreOverride: false,
    mistakeCount: 1,
    createdAt: "2026-11-20T08:00:00.000Z",
    updatedAt: "2026-11-20T08:15:00.000Z",
  },
];

const sampleMistakes: MistakeRecord[] = [
  {
    id: "m1",
    testId: "t1",
    testTitle: "Part 5 Drill",
    part: 5,
    questionNumber: 105,
    errorCategory: "grammar",
    promptSnippet: "The report was reviewed ___ the committee.",
    createdAt: "2026-11-20T08:20:00.000Z",
  },
];

describe("DataBackupCard", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:speakwise-backup");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("invokes onExport when clicking Export Backup (.json)", async () => {
    const user = userEvent.setup();
    const payload = buildBackupPayload({
      profile: sampleProfile,
      vocab: sampleVocab,
      tests: sampleTests,
      mistakes: sampleMistakes,
      now: new Date("2026-11-24T07:00:00.000Z"),
    });
    const onExport = vi.fn().mockResolvedValue(payload);
    const onImport = vi.fn();

    render(
      <DataBackupCard
        uid="user-1"
        profile={sampleProfile}
        onExport={onExport}
        onImport={onImport}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /export backup \(\.json\)/i })
    );

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledTimes(1);
    });
    expect(onExport).toHaveBeenCalledWith("user-1", sampleProfile);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("displays preview counts for a valid uploaded backup and invokes onImport with merge defaults", async () => {
    const user = userEvent.setup();
    const payload = buildBackupPayload({
      profile: sampleProfile,
      vocab: sampleVocab,
      tests: sampleTests,
      mistakes: sampleMistakes,
      now: new Date("2026-11-24T07:00:00.000Z"),
    });
    const jsonString = serializeBackupPayload(payload);
    const file = new File([jsonString], "speakwise-backup-2026-11-24.json", {
      type: "application/json",
    });

    const onExport = vi.fn();
    const onImport = vi.fn().mockResolvedValue({
      vocabCount: 1,
      testsCount: 1,
      mistakesCount: 1,
    });
    const onRestored = vi.fn().mockResolvedValue(undefined);

    render(
      <DataBackupCard
        uid="user-1"
        profile={sampleProfile}
        onExport={onExport}
        onImport={onImport}
        onRestored={onRestored}
      />
    );

    const fileInput = screen.getByLabelText(/select backup json file/i);
    await user.upload(fileInput, file);

    expect(await screen.findByText(/backup preview/i)).toBeInTheDocument();
    expect(screen.getByText("Vocab cards")).toBeInTheDocument();
    expect(screen.getByText("Test attempts")).toBeInTheDocument();
    expect(screen.getByText("Mistakes")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /restore backup/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });
    expect(onImport).toHaveBeenCalledWith("user-1", payload, {
      mode: "merge",
      restoreProfileGoals: true,
    });
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error alert when uploading an invalid JSON file", async () => {
    const user = userEvent.setup();
    const badFile = new File(["{invalid-json"], "broken.json", {
      type: "application/json",
    });

    render(
      <DataBackupCard
        uid="user-1"
        profile={sampleProfile}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />
    );

    const fileInput = screen.getByLabelText(/select backup json file/i);
    await user.upload(fileInput, badFile);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/malformed json/i);
    expect(screen.queryByText(/backup preview/i)).not.toBeInTheDocument();
  });
});
