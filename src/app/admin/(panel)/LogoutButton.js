"use client";

export default function LogoutButton() {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-300 px-2.5 py-1 hover:bg-slate-50"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.href = "/admin/login";
      }}
    >
      Sign out
    </button>
  );
}
