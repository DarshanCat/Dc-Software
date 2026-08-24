import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | DC & Vendor Material Management",
  description: "Sign in to Delivery Challan and Vendor Material Management System",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
