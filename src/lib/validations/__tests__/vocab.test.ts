import { describe, expect, it } from "vitest";
import {
  vocabCardFormSchema,
  vocabEnrichRequestSchema,
  vocabEnrichResponseSchema,
} from "@/lib/validations/vocab";

describe("vocabEnrichRequestSchema", () => {
  it("accepts and trims a valid word with optional contextSentence", () => {
    const result = vocabEnrichRequestSchema.safeParse({
      word: "  reimburse  ",
      contextSentence: "  The company will reimburse travel expenses within ten business days.  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        word: "reimburse",
        contextSentence:
          "The company will reimburse travel expenses within ten business days.",
      });
    }
  });

  it("rejects empty or whitespace-only words", () => {
    const result = vocabEnrichRequestSchema.safeParse({
      word: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.word).toContain(
        "Word is required"
      );
    }
  });

  it("enforces max length bounds on word and contextSentence", () => {
    expect(
      vocabEnrichRequestSchema.safeParse({
        word: "a".repeat(121),
      }).success
    ).toBe(false);

    expect(
      vocabEnrichRequestSchema.safeParse({
        word: "invoice",
        contextSentence: "x".repeat(401),
      }).success
    ).toBe(false);
  });
});

describe("vocabCardFormSchema", () => {
  it("accepts a valid bilingual TOEIC vocabulary card payload", () => {
    const result = vocabCardFormSchema.safeParse({
      displayWord: "  reimburse ",
      ipa: "/ˌriː.ɪmˈbɜːrs/",
      partOfSpeech: "verb",
      meaningEn: "To pay back money that someone has spent for business purposes",
      meaningVi: "Hoàn trả, bồi hoàn chi phí",
      exampleEn: "Employees must submit receipts to be reimbursed for airfare.",
      exampleVi: "Nhân viên phải nộp hóa đơn để được hoàn tiền vé máy bay.",
      audioUrl: "https://api.dictionaryapi.dev/media/pronunciations/en/reimburse-us.mp3",
      wordFamily: ["reimbursement", "reimbursable"],
      collocations: ["reimburse expenses", "reimburse in full"],
      tags: ["Finance", "Travel"],
      personalNote: "Common in TOEIC Part 7 expense reports",
      sourceTestId: "test-123",
      sourceMistakeId: "mistake-456",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayWord).toBe("reimburse");
      expect(result.data.meaningVi).toBe("Hoàn trả, bồi hoàn chi phí");
      expect(result.data.audioUrl).toBe(
        "https://api.dictionaryapi.dev/media/pronunciations/en/reimburse-us.mp3"
      );
    }
  });

  it("applies default values for optional arrays and empty strings", () => {
    const result = vocabCardFormSchema.safeParse({
      displayWord: "agenda",
      partOfSpeech: "noun",
      meaningEn: "A list of items to be discussed at a formal meeting",
      meaningVi: "Chương trình nghị sự, lịch họp",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ipa).toBe("");
      expect(result.data.exampleEn).toBe("");
      expect(result.data.exampleVi).toBe("");
      expect(result.data.audioUrl).toBeNull();
      expect(result.data.wordFamily).toEqual([]);
      expect(result.data.collocations).toEqual([]);
      expect(result.data.tags).toEqual([]);
    }
  });

  it("rejects missing required bilingual fields", () => {
    const missingVi = vocabCardFormSchema.safeParse({
      displayWord: "procurement",
      partOfSpeech: "noun",
      meaningEn: "The process of obtaining supplies or services for a company",
      meaningVi: "   ",
    });
    expect(missingVi.success).toBe(false);
    if (!missingVi.success) {
      expect(missingVi.error.flatten().fieldErrors.meaningVi).toContain(
        "Vietnamese meaning is required"
      );
    }

    const missingEn = vocabCardFormSchema.safeParse({
      displayWord: "procurement",
      partOfSpeech: "noun",
      meaningEn: "",
      meaningVi: "Hoạt động thu mua",
    });
    expect(missingEn.success).toBe(false);
    if (!missingEn.success) {
      expect(missingEn.error.flatten().fieldErrors.meaningEn).toContain(
        "English meaning is required"
      );
    }
  });

  it("normalizes empty or nullish audioUrl to null and rejects invalid URLs", () => {
    const emptyAudio = vocabCardFormSchema.safeParse({
      displayWord: "invoice",
      partOfSpeech: "noun",
      meaningEn: "A document listing goods or services and the amount owed",
      meaningVi: "Hóa đơn thanh toán",
      audioUrl: "",
    });
    expect(emptyAudio.success).toBe(true);
    if (emptyAudio.success) {
      expect(emptyAudio.data.audioUrl).toBeNull();
    }

    const whitespaceAudio = vocabCardFormSchema.safeParse({
      displayWord: "invoice",
      partOfSpeech: "noun",
      meaningEn: "A document listing goods or services and the amount owed",
      meaningVi: "Hóa đơn thanh toán",
      audioUrl: "   ",
    });
    expect(whitespaceAudio.success).toBe(true);
    if (whitespaceAudio.success) {
      expect(whitespaceAudio.data.audioUrl).toBeNull();
    }

    const invalidAudio = vocabCardFormSchema.safeParse({
      displayWord: "invoice",
      partOfSpeech: "noun",
      meaningEn: "A document listing goods or services and the amount owed",
      meaningVi: "Hóa đơn thanh toán",
      audioUrl: "not-a-valid-url",
    });
    expect(invalidAudio.success).toBe(false);
    if (!invalidAudio.success) {
      expect(invalidAudio.error.flatten().fieldErrors.audioUrl).toContain(
        "Audio URL must be a valid URL"
      );
    }
  });
});

describe("vocabEnrichResponseSchema", () => {
  it("validates a complete AI + dictionary enrichment response", () => {
    const result = vocabEnrichResponseSchema.safeParse({
      displayWord: "in accordance with",
      partOfSpeech: "phrase",
      meaningEn: "Following or obeying a rule, law, or agreement",
      meaningVi: "Tuân theo, phù hợp với",
      exampleEn:
        "All equipment inspections were completed in accordance with safety regulations.",
      exampleVi:
        "Tất cả các cuộc kiểm tra thiết bị đã được hoàn tất tuân theo các quy định an toàn.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ipa).toBe("");
      expect(result.data.audioUrl).toBeNull();
      expect(result.data.wordFamily).toEqual([]);
      expect(result.data.collocations).toEqual([]);
      expect(result.data.suggestedTags).toEqual([]);
    }
  });
});
