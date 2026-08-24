import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request Account | DC & Vendor Material Management",
  description: "Request an account for DC & Vendor Material Management - Vijay Spheroidals",
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
