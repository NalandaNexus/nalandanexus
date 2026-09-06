import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ticket, Plus, Search, X, AlertTriangle, Copy, Check, Ban, RotateCcw, Trash2, Download } from 'lucide-react';
import { adminApi } from '../services/adminApi';

/**
 * Coupon administration.
 *
 * A coupon here is worth a paid course, so the page is built around the two
 * questions that actually matter operationally: how many free places are still
 * outstanding, and who used the ones that are gone. Codes are shown in full
 * because an admin has to be able to hand them out — the access control is the
 * page itself, which sits behind `courses.manage`.
 */

const rupees = (paise) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;

const STATUS_TONE = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  USED: 'bg-slate-100 text-slate-600 border-slate-200',
  EXPIRED: 'bg-amber-50 text-amber-700 border-amber-200',
  INACTIVE: 'bg-red-50 text-red-700 border-red-200',
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [summary, setSummary] = useState({});
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', courseSlug: '', campaignId: '', search: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [exportingId, setExportingId] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== 'ALL'));
      const [res, camps] = await Promise.all([
        adminApi.getCoupons(query),
        // Campaign statistics follow the course filter but not the status or
        // search filters - narrowing the table should not make a campaign look
        // like it has fewer seats than it does.
        adminApi.getCampaigns(filters.courseSlug ? { courseSlug: filters.courseSlug } : {}),
      ]);
      setCoupons(res.coupons);
      setSummary(res.summary || {});
      setCampaigns(camps);
    } catch (err) {
      setError(err.message || 'Could not load coupons.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi.getCourses().then(setCourses).catch(() => {});
  }, []);

  const courseOptions = useMemo(() => courses.filter((c) => c.slug), [courses]);

  const setStatus = async (coupon, isActive) => {
    try {
      await adminApi.updateCoupon(coupon.id, { isActive });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update that coupon.');
    }
  };

  const exportCampaign = async (campaign) => {
    setExportingId(campaign.id);
    try {
      await adminApi.downloadCampaignCodes(campaign.id, campaign.name);
    } catch (err) {
      setError(err.message || 'Could not export that campaign.');
    } finally {
      setExportingId('');
    }
  };

  const remove = async (coupon) => {
    try {
      await adminApi.deleteCoupon(coupon.id);
      await load();
    } catch (err) {
      setError(err.message || 'Could not remove that coupon.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#22355E] flex items-center gap-2">
            <Ticket className="w-6 h-6" /> Coupons
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Each coupon gives one student one course. Codes are single-use unless set otherwise.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-[#22355E] hover:bg-[#16233F] text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Coupon Campaign
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={load} className="font-semibold underline whitespace-nowrap">Retry</button>
        </div>
      )}

      {/* The number that matters: how many free places are still outstanding. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {['AVAILABLE', 'USED', 'EXPIRED', 'INACTIVE'].map((key) => (
          <div key={key} className="p-4 rounded-xl bg-white border border-slate-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{key.toLowerCase()}</p>
            <p className="text-2xl font-bold text-[#22355E] tabular-nums mt-0.5">{summary[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Campaign-level statistics: the question an operator actually has is
          "how much of THAT giveaway is left", which the global tiles cannot
          answer once there is more than one batch. */}
      {campaigns.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-bold text-[#22355E]">Campaigns</h2>
            <p className="text-xs text-slate-500 mt-0.5">Each campaign is one batch of codes minted together.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="text-left font-semibold px-4 py-2.5">Campaign</th>
                  <th className="text-left font-semibold px-4 py-2.5">Course</th>
                  <th className="text-right font-semibold px-4 py-2.5">Total</th>
                  <th className="text-right font-semibold px-4 py-2.5">Available</th>
                  <th className="text-right font-semibold px-4 py-2.5">Used</th>
                  <th className="text-right font-semibold px-4 py-2.5">Expired</th>
                  <th className="text-right font-semibold px-4 py-2.5">Inactive</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const isFiltered = filters.campaignId === c.id;
                  return (
                    <tr key={c.id} className={`border-b border-slate-100 last:border-0 ${isFiltered ? 'bg-[#22355E]/5' : ''}`}>
                      <td className="px-4 py-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => setFilters((f) => ({ ...f, campaignId: isFiltered ? '' : c.id }))}
                          className="font-semibold text-[#22355E] hover:underline text-left"
                          aria-pressed={isFiltered}
                        >
                          {c.name}
                        </button>
                        <p className="text-[11px] text-slate-400">
                          {c.discountType === 'FULL' ? '100% off' : c.discountType === 'PERCENT' ? `${c.discountValue}% off` : `${rupees(c.discountValue)} off`}
                          {' · '}{c.maxUsesPerCoupon} use{c.maxUsesPerCoupon === 1 ? '' : 's'} each
                          {c.createdByName ? ` · by ${c.createdByName}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.courseTitle || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#22355E]">{c.total}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{c.available}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.used}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700">{c.expired}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-700">{c.inactive}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => exportCampaign(c)}
                          disabled={exportingId === c.id}
                          title="Download these codes as CSV"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:underline disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {exportingId === c.id ? 'Preparing…' : 'Export'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white border border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search coupon code"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filters.courseSlug}
          onChange={(e) => setFilters((f) => ({ ...f, courseSlug: e.target.value }))}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          aria-label="Filter by course"
        >
          <option value="">All courses</option>
          {courseOptions.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="USED">Used</option>
          <option value="EXPIRED">Expired</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-slate-400 bg-white rounded-xl border border-slate-200">Loading coupons…</div>
      ) : coupons.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">No coupons match these filters.</p>
          <p className="text-xs text-slate-400 mt-1">Generate a batch to give students free access to a course.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-3 px-4">Coupon</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Uses</th>
                <th className="py-3 px-4">Redeemed by</th>
                <th className="py-3 px-4">Expires</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-3 px-4">
                    <CopyableCode code={c.code} />
                    {c.campaignName && <p className="text-[10px] text-slate-400 mt-0.5">{c.campaignName}</p>}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{c.courseTitle || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_TONE[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                    {c.usedCount}/{c.maxUses}
                  </td>
                  <td className="py-3 px-4">
                    {c.usedBy.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      c.usedBy.map((u) => (
                        <div key={u.userId} className="mb-1 last:mb-0">
                          <p className="text-slate-700 font-medium">{u.name || u.email || 'Student'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {u.enrollmentId || 'enrollment pending'} · {rupees(u.amountDiscountedInPaise)} ·{' '}
                            {new Date(u.usedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      ))
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 justify-end">
                      {c.isActive ? (
                        <button type="button" onClick={() => setStatus(c, false)} title="Deactivate" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setStatus(c, true)} title="Reactivate" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* A redeemed coupon is the record of a real enrollment, so
                          the backend refuses to delete it; not offering the
                          button avoids inviting an action that cannot succeed. */}
                      {c.usedCount === 0 && (
                        <button type="button" onClick={() => remove(c)} title="Remove unused coupon" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <GenerateDialog
          courses={courseOptions}
          onCancel={() => setCreateOpen(false)}
          onCreated={async (created) => {
            setCreateOpen(false);
            setGenerated(created);
            await load();
          }}
        />
      )}

      {generated && (
        <GeneratedCodesDialog
          campaign={generated.campaign}
          coupons={generated.coupons}
          onExport={exportCampaign}
          onClose={() => setGenerated(null)}
        />
      )}
    </div>
  );
}

/** Codes are meant to be handed out, so copying one must not mean selecting it by hand. */
function CopyableCode({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can be refused; the code is on screen regardless.
        }
      }}
      className="font-mono font-semibold text-[#22355E] hover:text-[#AB5236] flex items-center gap-1.5 group"
      title="Copy code"
    >
      {code}
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60" />}
    </button>
  );
}

const field = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm';

function GenerateDialog({ courses, onCancel, onCreated }) {
  const [form, setForm] = useState({
    courseSlug: '',
    name: '',
    count: '25',
    discountPercent: '100',
    maxUses: '1',
    expiresAt: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // A course with no slug cannot be addressed across the service boundary, so
  // it is not offered - picking one could only ever fail.
  const selectable = courses.filter((c) => c.slug);
  const course = selectable.find((c) => c.slug === form.courseSlug);
  const count = Number(form.count);
  const maxUses = Number(form.maxUses);
  const discountPercent = Number(form.discountPercent);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.courseSlug) return setErr('Choose the course these coupons unlock.');
    if (!form.name.trim()) return setErr('Name the campaign — it is what stops a second batch being created by mistake.');
    if (!Number.isInteger(count) || count < 1) return setErr('Enter how many coupons to create.');
    if (!Number.isInteger(maxUses) || maxUses < 1) return setErr('Each coupon needs at least one use.');
    if (!(discountPercent > 0 && discountPercent <= 100)) return setErr('Discount must be between 1% and 100%.');

    setBusy(true);
    try {
      const created = await adminApi.createCampaign({
        // Slug, not _id: this portal's course _ids belong to this portal's
        // database, and the coupons are stored by the student backend.
        courseSlug: form.courseSlug,
        name: form.name.trim(),
        count,
        // 100% is FULL, which is the only kind that skips Razorpay entirely.
        // Anything less is a discount on a payment, and still goes to checkout.
        discountType: discountPercent === 100 ? 'FULL' : 'PERCENT',
        discountValue: discountPercent,
        maxUses,
        expiresAt: form.expiresAt || null,
      });
      await onCreated(created);
    } catch (error) {
      setErr(error.message || 'Could not generate coupons.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Create Coupon Campaign" onCancel={onCancel}>
      <form onSubmit={submit} className="space-y-3">
        {err && <div role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{err}</div>}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Course *</label>
          <select value={form.courseSlug} onChange={(e) => setForm({ ...form, courseSlug: e.target.value })} className={field}>
            <option value="">— Select a course —</option>
            {selectable.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title} · {rupees(c.priceInPaise)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Campaign name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
            placeholder="e.g. Launch giveaway"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Names this batch, and is what stops it being created twice — one campaign of a given name per course.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Number of coupons *</label>
            <input type="number" min="1" max="500" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Max uses per coupon *</label>
            <input type="number" min="1" max="1000" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Discount % *</label>
            <input type="number" min="1" max="100" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Expires (optional)</label>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={field} />
          </div>
        </div>

        {/* Anything under 100% still goes through checkout, and an operator
            setting up a free giveaway should find that out here, not from a
            confused student at the payment screen. */}
        {discountPercent > 0 && discountPercent < 100 && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            At {discountPercent}% these are discounts, not free places — students will still be taken to Razorpay to pay the balance.
          </div>
        )}

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          Each coupon gives <strong>{discountPercent === 100 ? '100% off' : `${discountPercent || 0}% off`}</strong> and can be used{' '}
          <strong>{maxUses === 1 ? 'once' : `${maxUses} times`}</strong>.
          {course && count > 0 && (
            <>
              {' '}
              This creates <strong>{count * maxUses}</strong>{' '}
              {discountPercent === 100 ? 'free' : 'discounted'} {count * maxUses === 1 ? 'place' : 'places'} on{' '}
              <strong>{course.title}</strong>, worth{' '}
              {rupees(Math.floor(((course.priceInPaise || 0) * count * maxUses * discountPercent) / 100))} in total.
            </>
          )}
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-sm font-semibold disabled:opacity-60">
            {busy ? 'Generating…' : `Generate ${Number.isInteger(count) && count > 0 ? count : ''} coupons`.trim()}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * The freshly-generated codes, together, once.
 *
 * They remain visible in the table afterwards, but this is the moment an admin
 * is most likely to want the whole list to paste somewhere, so it is offered
 * plainly rather than making them copy 25 rows one at a time.
 */
function GeneratedCodesDialog({ campaign, coupons, onExport, onClose }) {
  const [copied, setCopied] = useState(false);
  const all = coupons.map((c) => c.code).join('\n');

  return (
    <Dialog title={`${coupons.length} coupon${coupons.length === 1 ? '' : 's'} generated`} onCancel={onClose}>
      <div className="space-y-3">
        {campaign && (
          <p className="text-xs text-slate-500">
            Campaign <strong className="text-[#22355E]">{campaign.name}</strong>
            {campaign.courseTitle ? ` · ${campaign.courseTitle}` : ''}
          </p>
        )}
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Each of these unlocks the course for one student. Treat them like access keys &mdash; they can be exported again later.</span>
        </div>
        <pre className="max-h-64 overflow-y-auto p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed">
          {all}
        </pre>
        <div className="flex justify-end gap-2">
          {campaign && (
            <button
              type="button"
              onClick={() => onExport(campaign)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(all);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                // Clipboard refused; the codes are on screen and in the table.
              }
            }}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy all'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-sm font-semibold">
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Dialog({ title, children, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onCancel} className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-bold text-[#22355E] mb-4 pr-8">{title}</h3>
        {children}
      </div>
    </div>
  );
}
