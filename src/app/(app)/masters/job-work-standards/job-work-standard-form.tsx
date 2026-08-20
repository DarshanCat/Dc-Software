"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jobWorkStandardSchema, type JobWorkStandardInput } from "@/lib/validation/job-work-standard";
import { createJobWorkStandard } from "@/server/job-work-standards/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  items: { id: string; label: string }[];
  processes: { id: string; name: string }[];
}

export function JobWorkStandardForm({ items, processes }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobWorkStandardInput>({
    resolver: zodResolver(jobWorkStandardSchema),
    defaultValues: {
      calculationType: "PERCENTAGE",
      inputUOM: "KG",
      tolerancePercentage: 0,
      expectedOutputWeight: 0,
      expectedScrapWeight: 0,
      allowedProcessLoss: 0,
    },
  });

  async function onSubmit(values: JobWorkStandardInput) {
    setServerError(null);
    const res = await createJobWorkStandard(values);
    if (!res.ok) {
      setServerError(res.error);
      if (res.fieldErrors) {
        for (const [field, message] of Object.entries(res.fieldErrors)) {
          setError(field as keyof JobWorkStandardInput, { message });
        }
      }
      return;
    }
    reset({
      calculationType: "PERCENTAGE",
      inputUOM: "KG",
      tolerancePercentage: 0,
      expectedOutputWeight: 0,
      expectedScrapWeight: 0,
      allowedProcessLoss: 0,
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Item *</label>
          <select {...register("itemId")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Select item</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
          {errors.itemId && <p className="mt-1 text-xs text-red-600">{errors.itemId.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Process *</label>
          <select {...register("processId")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Select process</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.processId && <p className="mt-1 text-xs text-red-600">{errors.processId.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Calculation Type</label>
          <select {...register("calculationType")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="PERCENTAGE">Percentage</option>
            <option value="INPUT_MINUS_OUTPUT">Input minus Output</option>
            <option value="FIXED">Fixed</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Reference Input Weight (kg) *</label>
          <Input type="number" step="0.001" {...register("inputWeight")} />
          {errors.inputWeight && <p className="mt-1 text-xs text-red-600">{errors.inputWeight.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Expected Scrap %</label>
          <Input type="number" step="0.01" {...register("expectedScrapPercentage")} placeholder="used for Percentage type" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Allowed Process Loss %</label>
          <Input type="number" step="0.01" {...register("allowedProcessLossPercentage")} placeholder="used for Percentage type" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Expected Scrap Weight (kg)</label>
          <Input type="number" step="0.001" {...register("expectedScrapWeight")} placeholder="used for Input-minus-Output" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Allowed Process Loss (kg)</label>
          <Input type="number" step="0.001" {...register("allowedProcessLoss")} placeholder="used for Input-minus-Output" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Expected Output Weight (kg)</label>
          <Input type="number" step="0.001" {...register("expectedOutputWeight")} placeholder="used for Fixed/Manual" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tolerance %</label>
          <Input type="number" step="0.01" {...register("tolerancePercentage")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Effective From *</label>
          <Input type="date" {...register("effectiveFrom")} />
          {errors.effectiveFrom && <p className="mt-1 text-xs text-red-600">{errors.effectiveFrom.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Effective To</label>
          <Input type="date" {...register("effectiveTo")} />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Only the fields relevant to the chosen Calculation Type are actually used when computing expected values on a DC.
        New standards are created unapproved — a user with approval permission must approve before it can be used.
      </p>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Create Standard"}
      </Button>
    </form>
  );
}