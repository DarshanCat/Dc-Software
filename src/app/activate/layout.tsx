import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activate Account | DC & Vendor Material Management",
  description: "Set your password and activate your account for DC & Vendor Material Management - Vijay Spheroidals",
};

export default function ActivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
