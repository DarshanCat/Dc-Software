"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, type CreateUserInput } from "@/lib/validation/user";
import { createUser } from "@/server/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  roles: { key: string; name: string }[];
  vendors: { id: string; name: string }[];
}

export function CreateUserForm({ roles, vendors }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { roleKeys: [] },
  });

  const selectedRoles = watch("roleKeys") ?? [];
  const needsVendorScope = selectedRoles.includes("VENDOR");

  async function onSubmit(values: CreateUserInput) {
    setServerError(null);
    const res = await createUser(values);
    if (!res.ok) {
      setServerError(res.error);
      if (res.fieldErrors) {
        for (const [field, message] of Object.entries(res.fieldErrors)) {
          setError(field as keyof CreateUserInput, { message });
        }
      }
      return;
    }
    reset({ roleKeys: [] });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Name *</label>
          <Input {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
          <Input type="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Password *</label>
          <Input type="password" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Roles *</label>
        <Controller
          name="roleKeys"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 p-3">
              {roles.map((r) => {
                const checked = (field.value ?? []).includes(r.key);
                return (
                  <label key={r.key} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = field.value ?? [];
                        field.onChange(
                          e.target.checked ? [...current, r.key] : current.filter((k) => k !== r.key),
                        );
                      }}
                    />
                    {r.name}
                  </label>
                );
              })}
            </div>
          )}
        />
        {errors.roleKeys && <p className="mt-1 text-xs text-red-600">{errors.roleKeys.message}</p>}
      </div>

      {needsVendorScope && (
        <div className="max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-600">Vendor Scope (for VENDOR role)</label>
          <select {...register("vendorId")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create User"}
      </Button>
    </form>
  );
}