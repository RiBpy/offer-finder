"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "./api";
import { AVAILABILITY_TYPES, CATEGORIES, DISCOUNT_TYPES, SCOPES, SOURCE_TYPES } from "@/lib/constants";

const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function toYmd(value, tz) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function offerToForm(o) {
  const tz = o.timezone || browserTz();
  return {
    title: o.title || "",
    description: o.description || "",
    terms: o.terms || "",
    brandName: o.brandName || "",
    businessName: o.businessName || "",
    isBrandOffer: Boolean(o.isBrandOffer),
    primaryCategory: o.primaryCategory || "",
    categories: o.categories || [],
    tags: (o.tags || []).join(", "),
    discountType: o.discountType || "none",
    discountValue: o.discountValue ?? "",
    discountText: o.discountText || "",
    originalPrice: o.originalPrice ?? "",
    discountedPrice: o.discountedPrice ?? "",
    currency: o.currency || "",
    startDate: toYmd(o.startDate, tz),
    endDate: toYmd(o.endDate, tz),
    publishedAt: toYmd(o.publishedAt, tz),
    timezone: tz,
    sourceUrl: o.sourceUrl || "",
    canonicalUrl: o.canonicalUrl || "",
    sourceName: o.sourceName || "",
    sourceType: o.sourceType || "official_website",
    sourceOfferId: o.sourceOfferId || "",
    imageUrl: o.imageUrl || "",
    availabilityType: o.availabilityType || "",
    scope: o.scope || "",
    country: o.country || "",
    city: o.city || "",
    address: o.address || "",
    eligibleLocations: (o.eligibleLocations || []).map((l) => ({
      name: l.name || "",
      address: l.address || "",
      city: l.city || "",
      latitude: l.latitude ?? "",
      longitude: l.longitude ?? "",
    })),
    validationStatus: o.validationStatus || "unverified",
    reviewState: o.reviewState || "pending",
    evidenceNote: "",
  };
}

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";

function Field({ label, error, hint, children, className = "" }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}

function Fieldset({ title, children }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function OfferForm({ initial, offerId }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((s) => ({ ...s, [k]: v }));
  };
  const setLoc = (i, k) => (e) =>
    setF((s) => ({ ...s, eligibleLocations: s.eligibleLocations.map((l, j) => (j === i ? { ...l, [k]: e.target.value } : l)) }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setErrors({});
    const body = { ...f, tags: f.tags };
    try {
      if (offerId) {
        await adminFetch(`/api/admin/offers/${offerId}`, { method: "PUT", body });
        setMessage("Saved.");
        setF((s) => ({ ...s, evidenceNote: "" }));
        router.refresh();
      } else {
        const r = await adminFetch("/api/admin/offers", { method: "POST", body });
        router.push(`/admin/offers/${r.id}`);
      }
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.fields ? "Please fix the highlighted fields." : err.message);
    } finally {
      setSaving(false);
    }
  }

  const err = (k) => errors[k];

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <Fieldset title="Source">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source URL *" error={err("sourceUrl")} className="sm:col-span-2">
            <input className={input} value={f.sourceUrl} onChange={set("sourceUrl")} type="url" required />
          </Field>
          <Field label="Source type *" error={err("sourceType")}>
            <select className={input} value={f.sourceType} onChange={set("sourceType")}>
              {SOURCE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Source name" hint="Defaults to the website's domain">
            <input className={input} value={f.sourceName} onChange={set("sourceName")} />
          </Field>
          <Field label="Canonical URL" error={err("canonicalUrl")} hint="Used for duplicate detection">
            <input className={input} value={f.canonicalUrl} onChange={set("canonicalUrl")} />
          </Field>
          <Field label="Source offer ID" hint="Only if one page lists several offers">
            <input className={input} value={f.sourceOfferId} onChange={set("sourceOfferId")} />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Offer">
        <Field label="Title *" error={err("title")}>
          <input className={input} value={f.title} onChange={set("title")} maxLength={200} />
        </Field>
        <Field label="Summary" hint="Write a short summary in your own words. Do not paste whole articles.">
          <textarea className={input} rows={4} value={f.description} onChange={set("description")} maxLength={2000} />
        </Field>
        <Field label="Terms">
          <textarea className={input} rows={3} value={f.terms} onChange={set("terms")} maxLength={2000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Brand">
            <input className={input} value={f.brandName} onChange={set("brandName")} />
          </Field>
          <Field label="Business / store">
            <input className={input} value={f.businessName} onChange={set("businessName")} />
          </Field>
          <Field label="Image URL" error={err("imageUrl")} hint="Leave empty if the site prohibits hotlinking">
            <input className={input} value={f.imageUrl} onChange={set("imageUrl")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isBrandOffer} onChange={set("isBrandOffer")} className="h-4 w-4 accent-emerald-700" />
          Brand-wide promotion (shows in Brand Offers)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary category *" error={err("primaryCategory")}>
            <select className={input} value={f.primaryCategory} onChange={set("primaryCategory")}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tags" hint="Comma separated">
            <input className={input} value={f.tags} onChange={set("tags")} />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Other categories</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.id !== f.primaryCategory).map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs">
                <input
                  type="checkbox"
                  className="accent-emerald-700"
                  checked={f.categories.includes(c.id)}
                  onChange={(e) =>
                    setF((s) => ({ ...s, categories: e.target.checked ? [...s.categories, c.id] : s.categories.filter((x) => x !== c.id) }))
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </Fieldset>

      <Fieldset title="Discount (only what the source states)">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type" error={err("discountType")}>
            <select className={input} value={f.discountType} onChange={set("discountType")}>
              {DISCOUNT_TYPES.map((d) => (
                <option key={d} value={d}>{{ none: "None stated", percent: "Percent off", amount: "Amount off", bogo: "Buy one get one", fixed_price: "Special price", other: "Other benefit" }[d]}</option>
              ))}
            </select>
          </Field>
          <Field label="Value" error={err("discountValue")} hint="Percent or amount">
            <input className={input} value={f.discountValue} onChange={set("discountValue")} inputMode="decimal" />
          </Field>
          <Field label="Benefit as stated" hint='e.g. "Buy 2 get 1 free"'>
            <input className={input} value={f.discountText} onChange={set("discountText")} />
          </Field>
          <Field label="Original price" error={err("originalPrice")}>
            <input className={input} value={f.originalPrice} onChange={set("originalPrice")} inputMode="decimal" />
          </Field>
          <Field label="Discounted price" error={err("discountedPrice")}>
            <input className={input} value={f.discountedPrice} onChange={set("discountedPrice")} inputMode="decimal" />
          </Field>
          <Field label="Currency" error={err("currency")} hint="ISO code, e.g. BDT">
            <input className={input} value={f.currency} onChange={set("currency")} maxLength={3} />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Validity (never guess dates)">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Start date" error={err("startDate")}>
            <input type="date" className={input} value={f.startDate} onChange={set("startDate")} />
          </Field>
          <Field label="End date" error={err("endDate")} hint="Valid until the end of this day">
            <input type="date" className={input} value={f.endDate} onChange={set("endDate")} />
          </Field>
          <Field label="Published" error={err("publishedAt")}>
            <input type="date" className={input} value={f.publishedAt} onChange={set("publishedAt")} />
          </Field>
          <Field label="Offer timezone" error={err("timezone")}>
            <input className={input} value={f.timezone} onChange={set("timezone")} />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Where it applies">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Scope *" error={err("scope")}>
            <select className={input} value={f.scope} onChange={set("scope")}>
              <option value="">Choose…</option>
              {SCOPES.map((s) => (
                <option key={s} value={s}>{{ local: "Specific branches", city: "Whole city", national: "Whole country", online: "Online only" }[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Redeem *" error={err("availabilityType")}>
            <select className={input} value={f.availabilityType} onChange={set("availabilityType")}>
              <option value="">Choose…</option>
              {AVAILABILITY_TYPES.map((a) => (
                <option key={a} value={a}>{{ online: "Online only", in_store: "In-store only", both: "Online and in-store" }[a]}</option>
              ))}
            </select>
          </Field>
          <Field label="Country" error={err("country")} hint="2-letter code, e.g. BD">
            <input className={input} value={f.country} onChange={set("country")} maxLength={2} />
          </Field>
          <Field label="City" error={err("city")}>
            <input className={input} value={f.city} onChange={set("city")} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input className={input} value={f.address} onChange={set("address")} />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Participating branches</span>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              onClick={() => setF((s) => ({ ...s, eligibleLocations: [...s.eligibleLocations, { name: "", address: "", city: "", latitude: "", longitude: "" }] }))}
            >
              + Add branch
            </button>
          </div>
          {err("eligibleLocations") && <p className="text-xs font-medium text-red-700">{err("eligibleLocations")}</p>}
          <p className="text-xs text-slate-500">
            Only add coordinates you have verified (e.g. from the business&apos;s own store locator). Never add a branch without evidence it participates.
          </p>
          {f.eligibleLocations.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-6">
              <input aria-label="Branch name" placeholder="Name" className={`${input} sm:col-span-2`} value={l.name} onChange={setLoc(i, "name")} />
              <input aria-label="Branch address" placeholder="Address" className={`${input} sm:col-span-2`} value={l.address} onChange={setLoc(i, "address")} />
              <input aria-label="Branch city" placeholder="City" className={input} value={l.city} onChange={setLoc(i, "city")} />
              <button
                type="button"
                className="text-xs text-red-700"
                onClick={() => setF((s) => ({ ...s, eligibleLocations: s.eligibleLocations.filter((_, j) => j !== i) }))}
              >
                Remove
              </button>
              <input aria-label="Latitude" placeholder="Latitude" className={`${input} sm:col-span-3`} value={l.latitude} onChange={setLoc(i, "latitude")} inputMode="decimal" />
              <input aria-label="Longitude" placeholder="Longitude" className={`${input} sm:col-span-3`} value={l.longitude} onChange={setLoc(i, "longitude")} inputMode="decimal" />
              {err(`eligibleLocations.${i}`) && <p className="text-xs font-medium text-red-700 sm:col-span-6">{err(`eligibleLocations.${i}`)}</p>}
            </div>
          ))}
        </div>
      </Fieldset>

      <Fieldset title="Review and validation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Validation status" error={err("validationStatus")}>
            <select className={input} value={f.validationStatus} onChange={set("validationStatus")}>
              <option value="active">Active: verified as currently valid</option>
              <option value="unverified">Unverified: could not confirm</option>
              <option value="expired">Expired</option>
              <option value="unavailable">Unavailable: page or promotion gone</option>
            </select>
          </Field>
          <Field label="Review" error={err("reviewState")}>
            <select className={input} value={f.reviewState} onChange={set("reviewState")}>
              <option value="pending">Pending review</option>
              <option value="approved">Approved (publishable)</option>
              <option value="rejected">Rejected (hidden)</option>
            </select>
          </Field>
        </div>
        <Field
          label={f.validationStatus === "active" ? "Verification evidence *" : "Verification note"}
          error={err("evidenceNote")}
          hint="What did you check? e.g. 'Campaign page says 20–31 Oct 2026, checked today'"
        >
          <textarea className={input} rows={2} value={f.evidenceNote} onChange={set("evidenceNote")} maxLength={500} />
        </Field>
      </Fieldset>

      {message && (
        <p className={`rounded-lg p-3 text-sm ${Object.keys(errors).length ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`} role="status">
          {message}
        </p>
      )}
      <div className="flex gap-3">
        <button disabled={saving} className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
          {saving ? "Saving…" : offerId ? "Save changes" : "Create offer"}
        </button>
      </div>
    </form>
  );
}
