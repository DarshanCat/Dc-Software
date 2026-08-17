"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendorSchema, type VendorInput } from "@/lib/validation/vendor";
import { createVendor } from "@/server/vendors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VendorForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { defaultReturnDays: 15 },
  });

  async function onSubmit(values: VendorInput) {
    setServerError(null);
    const res = await createVendor(values);
    if (!res.ok) {
      setServerError(res.error);
      if (res.fieldErrors) {
        for (const [field, message] of Object.entries(res.fieldErrors)) {
          setError(field as keyof VendorInput, { message });
        }
      }
      return;
    }
    reset({ defaultReturnDays: 15 });
    router.refresh(); // re-fetch the server component list
  }

  const field = (name: keyof VendorInput, label: string, type = "text") => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <Input type={type} {...register(name)} />
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {field("vendorCode", "Vendor Code *")}
        {field("vendorName", "Vendor Name *")}
        {field("gstNumber", "GST Number")}
        {field("city", "City")}
        {field("state", "State")}
        {field("contactPerson", "Contact Person")}
        {field("phone", "Phone")}
        {field("email", "Email", "email")}
        {field("defaultReturnDays", "Default Return Days", "number")}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Create Vendor"}
      </Button>
    </form>
  );
}