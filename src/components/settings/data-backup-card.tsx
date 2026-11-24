"use client";

import * as React from "react";
import {
  AlertTriangle,
  Download,
  FileJson,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  downloadBackupFile,
  parseAndValidateBackupJson,
} from "@/lib/backup";
import {
  exportUserBackup,
  importUserBackup,
  type BackupRestoreMode,
} from "@/lib/firebase/repositories/backup";
import type { SpeakWiseBackupPayload } from "@/lib/validations/backup";
import type { UserProfile } from "@/types/domain";

export interface DataBackupCardProps {
  uid: string;
  profile: UserProfile | null;
  onExport?: typeof exportUserBackup;
  onImport?: typeof importUserBackup;
  onRestored?: () => Promise<void>;
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read backup file."));
    reader.readAsText(file);
  });
}

function formatExportedTimestamp(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return isoValue;
  }
  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DataBackupCard({
  uid,
  profile,
  onExport = exportUserBackup,
  onImport = importUserBackup,
  onRestored,
}: DataBackupCardProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(
    null
  );
  const [previewPayload, setPreviewPayload] =
    React.useState<SpeakWiseBackupPayload | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<BackupRestoreMode>("merge");
  const [restoreProfileGoals, setRestoreProfileGoals] = React.useState(true);

  async function handleExport() {
    setIsExporting(true);
    try {
      const payload = await onExport(uid, profile);
      downloadBackupFile(payload);
      toast.success("Backup exported successfully");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to export backup. Please try again.";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setParseError(null);

    if (!file) {
      setPreviewPayload(null);
      setSelectedFileName(null);
      return;
    }

    try {
      const rawJson = await readFileAsText(file);
      const validated = parseAndValidateBackupJson(rawJson);
      setPreviewPayload(validated);
      setSelectedFileName(file.name);
      setRestoreProfileGoals(Boolean(validated.profile));
    } catch (error) {
      setPreviewPayload(null);
      setSelectedFileName(null);
      const message =
        error instanceof Error
          ? error.message
          : "Invalid SpeakWise backup file.";
      setParseError(message);
    }
  }

  async function handleRestore() {
    if (!previewPayload) {
      return;
    }

    setIsImporting(true);
    setParseError(null);
    try {
      const result = await onImport(uid, previewPayload, {
        mode,
        restoreProfileGoals: Boolean(
          previewPayload.profile && restoreProfileGoals
        ),
      });
      if (onRestored) {
        await onRestored();
      }
      toast.success(
        `Restored ${result.vocabCount} vocab cards, ${result.testsCount} tests, and ${result.mistakesCount} mistakes`
      );
      setPreviewPayload(null);
      setSelectedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to restore backup. Please try again.";
      setParseError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Data Backup &amp; Restore</CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            JSON v1
          </Badge>
        </div>
        <CardDescription>
          Export your vocabulary cards, test attempts, mistake logs, and study
          goals as JSON, or restore from a previous backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-foreground">
              Export Backup
            </h4>
            <p className="text-xs text-muted-foreground">
              Downloads a complete snapshot of your SpeakWise study data.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || isImporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Export Backup (.json)</span>
              </>
            )}
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="backup-file-input">Restore Backup</Label>
            <Input
              ref={fileInputRef}
              id="backup-file-input"
              type="file"
              accept=".json,application/json"
              aria-label="Select backup JSON file"
              disabled={isImporting}
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Select a SpeakWise JSON backup file to preview contents before
              restoring.
            </p>
          </div>

          {parseError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          ) : null}

          {previewPayload ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileJson className="h-4 w-4 text-primary" />
                  <span>Backup Preview</span>
                  {selectedFileName ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({selectedFileName})
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Exported {formatExportedTimestamp(previewPayload.exportedAt)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-card p-3">
                  <div className="text-lg font-semibold tabular-nums text-foreground">
                    {previewPayload.vocab.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Vocab cards
                  </div>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <div className="text-lg font-semibold tabular-nums text-foreground">
                    {previewPayload.tests.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Test attempts
                  </div>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <div className="text-lg font-semibold tabular-nums text-foreground">
                    {previewPayload.mistakes.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mistakes
                  </div>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Restore Mode
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-card p-3 text-sm">
                    <input
                      type="radio"
                      name="backup-restore-mode"
                      value="merge"
                      checked={mode === "merge"}
                      onChange={() => setMode("merge")}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="space-y-0.5">
                      <span className="block font-medium text-foreground">
                        Merge with existing data
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Adds new items and updates matching IDs without deleting
                        current records.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-card p-3 text-sm">
                    <input
                      type="radio"
                      name="backup-restore-mode"
                      value="replace"
                      checked={mode === "replace"}
                      onChange={() => setMode("replace")}
                      className="mt-0.5 accent-destructive"
                    />
                    <span className="space-y-0.5">
                      <span className="block font-medium text-foreground">
                        Replace all existing data
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Removes current records not in the backup and writes the
                        snapshot.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {mode === "replace" ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Warning: Replace mode will permanently delete existing
                    vocabulary cards, test attempts, and mistake logs that are
                    not present in this backup file.
                  </span>
                </div>
              ) : null}

              {previewPayload.profile ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={restoreProfileGoals}
                    onChange={(event) =>
                      setRestoreProfileGoals(event.target.checked)
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <span>Also restore study goal settings</span>
                </label>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant={mode === "replace" ? "destructive" : "default"}
                  onClick={handleRestore}
                  disabled={isImporting || isExporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Restore Backup</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
