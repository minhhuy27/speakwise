import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlashcardReview } from "@/components/vocab/flashcard-review";
import { INITIAL_EASE_FACTOR, previewGradeIntervals } from "@/lib/engines/srs";
import type { VocabCard } from "@/types/domain";

function makeCard(overrides: Partial<VocabCard> = {}): VocabCard {
  return {
    id: "card-1",
    word: "negotiate",
    displayWord: "negotiate",
    ipa: "/nɪˈɡoʊ.ʃi.eɪt/",
    partOfSpeech: "verb",
    meaningEn: "To discuss something formally to reach an agreement",
    meaningVi: "Đàm phán, thương lượng",
    exampleEn: "We need to negotiate the contract terms before Friday.",
    exampleVi: "Chúng ta cần đàm phán các điều khoản hợp đồng trước thứ Sáu.",
    wordFamily: ["negotiation", "negotiator"],
    collocations: ["negotiate a contract"],
    tags: ["Contracts"],
    personalNote: "Often followed by 'terms' or 'a contract'.",
    status: "learning",
    easeFactor: INITIAL_EASE_FACTOR,
    intervalDays: 1,
    repetitions: 1,
    lapses: 0,
    nextReviewAt: "2026-11-24T09:00:00.000Z",
    createdAt: "2026-11-20T09:00:00.000Z",
    updatedAt: "2026-11-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("FlashcardReview", () => {
  it("renders the front side initially without revealing bilingual meanings", () => {
    const card = makeCard({ lapses: 4 });
    const onGradeCard = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();

    render(
      <FlashcardReview
        initialQueue={[card]}
        onGradeCard={onGradeCard}
        onExit={onExit}
      />
    );

    expect(
      screen.getByRole("heading", { name: "negotiate" })
    ).toBeInTheDocument();
    expect(screen.getByText("verb")).toBeInTheDocument();
    expect(screen.getByText("Leech")).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show answer/i })
    ).toBeInTheDocument();

    expect(screen.queryByText(card.meaningEn)).not.toBeInTheDocument();
    expect(screen.queryByText(card.meaningVi)).not.toBeInTheDocument();
  });

  it("reveals bilingual meanings and predicted grade intervals on Space press", () => {
    const card = makeCard({
      status: "learning",
      intervalDays: 1,
      repetitions: 1,
    });
    const intervals = previewGradeIntervals(card);
    const onGradeCard = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();

    render(
      <FlashcardReview
        initialQueue={[card]}
        onGradeCard={onGradeCard}
        onExit={onExit}
      />
    );

    fireEvent.keyDown(window, { code: "Space", key: " " });

    expect(screen.getByText(card.meaningEn)).toBeInTheDocument();
    expect(screen.getByText(card.meaningVi)).toBeInTheDocument();
    expect(screen.getByText(card.ipa)).toBeInTheDocument();
    expect(screen.getByText("Again")).toBeInTheDocument();
    expect(screen.getByText("Hard")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText(`${intervals[2]}d`)).toBeInTheDocument();
    expect(screen.getByText(`${intervals[3]}d`)).toBeInTheDocument();
  });

  it("submits grade 2 (Good) on key '3' and shows session complete after all cards", async () => {
    const firstCard = makeCard({ id: "card-1", displayWord: "negotiate" });
    const secondCard = makeCard({
      id: "card-2",
      word: "reimburse",
      displayWord: "reimburse",
      ipa: "/ˌriː.ɪmˈbɜːrs/",
      meaningEn: "To repay money spent by an employee",
      meaningVi: "Hoàn trả chi phí",
    });

    const onGradeCard = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();

    render(
      <FlashcardReview
        initialQueue={[firstCard, secondCard]}
        onGradeCard={onGradeCard}
        onExit={onExit}
      />
    );

    // Card 1: Flip via button click, then press '3' for Good (grade 2)
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    expect(screen.getByText(firstCard.meaningEn)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "3" });

    await waitFor(() => {
      expect(onGradeCard).toHaveBeenCalledTimes(1);
    });
    expect(onGradeCard).toHaveBeenNthCalledWith(1, firstCard, 2);

    // Card 2 appears
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "reimburse" })
      ).toBeInTheDocument();
    });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    // Flip with Space and click Easy (grade 3)
    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(screen.getByText(secondCard.meaningVi)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /easy/i }));

    await waitFor(() => {
      expect(onGradeCard).toHaveBeenCalledTimes(2);
    });
    expect(onGradeCard).toHaveBeenNthCalledWith(2, secondCard, 3);

    // Session Complete summary
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Session Complete" })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "Back to Vocabulary" })
    ).toHaveAttribute("href", "/vocab");
    expect(
      screen.getByRole("link", { name: "Go to Overview" })
    ).toHaveAttribute("href", "/");
  });
});
