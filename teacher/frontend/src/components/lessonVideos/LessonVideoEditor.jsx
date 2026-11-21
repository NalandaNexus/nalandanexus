import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Save, Trash2, Upload, X } from 'lucide-react';

const sources = [{ id: 'youtube', label: 'YouTube link' }, { id: 'google_drive', label: 'Google Drive link' }, { id: 'upload', label: 'Upload video' }];
const fmtSize = (bytes) => !Number.isFinite(bytes) ? '' : `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 * 1024 ? 0 : 1)} MB`;
function durationOf(file) { return new Promise((resolve) => { const v = document.createElement('video'); const u = URL.createObjectURL(file); v.preload = 'metadata'; v.onloadedmetadata = () => { URL.revokeObjectURL(u); resolve(Number.isFinite(v.duration) ? v.duration : undefined); }; v.onerror = () => { URL.revokeObjectURL(u); resolve(undefined); }; v.src = u; }); }
function putPart(url, blob, onProgress) { return new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open('PUT', url); xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded); xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.getResponseHeader('ETag')) : reject(new Error(`Storage returned ${xhr.status}`)); xhr.onerror = () => reject(new Error('Network error while uploading a video part.')); xhr.send(blob); }); }

/** A source-agnostic editor; the parent provides authenticated portal API calls. */
export default function LessonVideoEditor({ lesson, api, onSaved, onRemoved, onClose, onConflict }) {
  const saved = lesson.video;
  const [source, setSource] = useState(saved?.provider || 'youtube');
  const [url, setUrl] = useState(saved?.originalUrl || '');
  const [title, setTitle] = useState(saved?.title || '');
  const [description, setDescription] = useState(saved?.description || '');
  const [file, setFile] = useState(null), [inspect, setInspect] = useState(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  const input = useRef(null); const expectedUpdatedAt = saved?.updatedAt || null;
  useEffect(() => { if (source !== 'upload') input.current?.focus(); }, [source]);
  const inspectLink = async () => { if (!url.trim()) return setInspect(null); setError(''); setInspect({ checking: true }); try { setInspect(await api.inspect(url)); } catch (err) { setInspect(null); setError(err.message || 'This video link is invalid.'); } };
  const saveLink = async (published) => { setBusy(true); setError(''); try { const result = await api.save({ provider: source, url, title, description, isPublished: published, expectedUpdatedAt }); onSaved(result.video, published ? 'publish' : 'draft'); } catch (err) { if (err.code === 'VIDEO_CHANGED') onConflict?.(err.details?.current); else setError(err.message || 'Could not save the video.'); } finally { setBusy(false); } };
  const upload = async () => {
    if (!file) return setError('Choose an MP4, MOV, WEBM, or MKV video first.');
    setBusy(true); setError(''); setProgress(0); let session;
    try {
      const duration = await durationOf(file); session = await api.startUpload({ fileName: file.name, fileSize: file.size, mimeType: file.type, title, description, isPublished: true, expectedUpdatedAt });
      const parts = [], total = session.totalParts; let sent = 0;
      for (let first = 1; first <= total; first += 25) {
        const numbers = Array.from({ length: Math.min(25, total - first + 1) }, (_, i) => first + i); const signed = await api.partUrls(session.uploadId, numbers);
        for (const part of signed.parts) {
          const start = (part.partNumber - 1) * session.partSize, chunk = file.slice(start, Math.min(file.size, start + session.partSize)); let etag; let last;
          for (let attempt = 0; attempt < 2 && !etag; attempt += 1) { try { etag = await putPart(part.url, chunk, (loaded) => setProgress(Math.round(((sent + loaded) / file.size) * 100))); } catch (err) { last = err; } }
          if (!etag) throw last || new Error('A video part could not be uploaded.'); sent += chunk.size; setProgress(Math.round((sent / file.size) * 100)); parts.push({ partNumber: part.partNumber, etag });
        }
      }
      const result = await api.completeUpload(session.uploadId, { parts, duration }); onSaved(result.video, result.video?.isPublished ? 'publish' : 'draft');
    } catch (err) { if (session?.uploadId) api.abortUpload(session.uploadId).catch(() => {}); setError(err.message || 'Upload failed. You can retry with the same file.'); } finally { setBusy(false); }
  };
  const remove = async () => { setBusy(true); try { await api.remove({ expectedUpdatedAt }); onRemoved(); } catch (err) { if (err.code === 'VIDEO_CHANGED') onConflict?.(err.details?.current); else setError(err.message || 'Could not remove the video.'); } finally { setBusy(false); } };
  const ready = inspect && !inspect.checking && inspect.availability !== 'unavailable';
  return <div className="mt-3 rounded-xl border border-[#D8D3C5] bg-[#FAF9F4] p-4 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#22355E]">{saved ? 'Replace video' : 'Add video'}</p><p className="text-[11px] text-[#6E6A64]">One verified primary video is active at a time.</p></div><button type="button" onClick={onClose} className="p-1 text-[#6E6A64]"><X className="w-4 h-4" /></button></div>
    <div className="flex flex-wrap gap-2">{sources.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => { setSource(item.id); setError(''); setInspect(null); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${source === item.id ? 'bg-[#22355E] text-white' : 'bg-white border border-[#D8D3C5] text-[#22355E]'}`}>{item.label}</button>)}</div>
    {source === 'upload' ? <div className="space-y-2"><input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-xs" />{file && <p className="text-xs text-[#6E6A64]">{file.name} · {fmtSize(file.size)}</p>}{busy && <><div className="h-2 overflow-hidden rounded bg-[#EDEAE0]"><div className="h-full bg-[#AB5236]" style={{ width: `${progress}%` }} /></div><p className="text-xs text-[#6E6A64]">{progress < 100 ? `Uploading ${progress}%` : 'Verifying file and publishing…'}</p></>}</div> : <div className="space-y-2"><label className="block text-xs font-semibold text-[#6E6A64]">{source === 'youtube' ? 'YouTube URL' : 'Google Drive sharing link'}</label><input ref={input} value={url} onChange={(e) => { setUrl(e.target.value); setInspect(null); }} onBlur={inspectLink} placeholder={source === 'youtube' ? 'https://youtu.be/…' : 'https://drive.google.com/file/d/…'} className="w-full rounded-lg border border-[#D8D3C5] bg-white px-3 py-2 text-sm" />{inspect?.checking && <p className="text-xs text-[#6E6A64]">Checking availability…</p>}{ready && <div className="rounded-lg border border-[#5C7A5E]/30 bg-[#5C7A5E]/10 p-2 text-xs text-[#3F5A41]"><CheckCircle2 className="mr-1 inline w-3.5 h-3.5" />{inspect.availability === 'restricted' ? 'The provider may prevent in-page viewing; students receive an external link.' : 'Link validated.'}{source === 'google_drive' && <p className="mt-1">Students need Drive sharing access (normally “Anyone with the link”).</p>}</div>}</div>}
    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength="200" placeholder="Video title (optional)" className="w-full rounded-lg border border-[#D8D3C5] bg-white px-3 py-2 text-sm" /><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength="2000" rows="2" placeholder="Description (optional)" className="w-full rounded-lg border border-[#D8D3C5] bg-white px-3 py-2 text-sm" />
    {error && <p role="alert" className="rounded-lg bg-[#C1352B]/10 p-2 text-xs text-[#9A2820]"><AlertTriangle className="mr-1 inline w-3.5 h-3.5" />{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">{saved && (confirm ? <><span className="text-xs text-[#9A2820] self-center">Remove this video?</span><button type="button" onClick={remove} disabled={busy} className="rounded-lg bg-[#C1352B] px-3 py-2 text-xs font-bold text-white">Confirm remove</button><button type="button" onClick={() => setConfirm(false)} className="px-2 text-xs">Keep</button></> : <button type="button" onClick={() => setConfirm(true)} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#9A2820]"><Trash2 className="w-3.5 h-3.5" />Remove</button>)}<button type="button" onClick={() => source === 'upload' ? upload() : saveLink(false)} disabled={busy || (source !== 'upload' && !url.trim())} className="inline-flex items-center gap-1 rounded-lg border border-[#D8D3C5] bg-white px-3 py-2 text-xs font-bold text-[#22355E]">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : source === 'upload' ? <Upload className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}{source === 'upload' ? 'Upload & publish' : 'Save draft'}</button>{source !== 'upload' && <button type="button" onClick={() => saveLink(true)} disabled={busy || !ready} className="inline-flex items-center gap-1 rounded-lg bg-[#AB5236] px-3 py-2 text-xs font-bold text-white"><ExternalLink className="w-3.5 h-3.5" />Publish</button>}</div>
  </div>;
}
