"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { itemSchema, type ItemInput } from "@/lib/validation/item";
import { createItem } from "@/server/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ItemForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: { defaultUOM: "NOS", weightUOM: "KG" },
  });

  async function onSubmit(values: ItemInput) {
    setServerError(null);
    const res = await createItem(values);
    if (!res.ok) {
      setServerError(res.error);
      if (res.fieldErrors) {
        for (const [f, m] of Object.entries(res.fieldErrors)) setError(f as keyof ItemInput, { message: m });
      }
      return;
    }
    reset({ defaultUOM: "NOS", weightUOM: "KG" });
    router.refresh();
  }

  const field = (name: keyof ItemInput, label: string, type = "text") => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <Input type={type} {...register(name)} />
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {field("itemCode", "Item Code *")}
        {field("itemName", "Item Name *")}
        {field("materialGrade", "Material Grade")}
        {field("drawingNumber", "Drawing Number")}
        {field("defaultUOM", "Default UOM")}
        {field("weightUOM", "Weight UOM")}
        {field("standardUnitWeight", "Std Unit Weight (kg)", "number")}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Create Item"}
      </Button>
    </form>
  );
}