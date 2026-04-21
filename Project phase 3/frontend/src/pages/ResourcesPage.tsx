import { useEffect, useState } from "react";
import {
  fetchResources as apiFetchResources,
  createResource as apiCreateResource,
  uploadResourceFile as apiUploadResourceFile,
  type Resource,
} from "../api/resources.js";
import { API_BASE } from "../api/base.js";
import { formatDateOnly } from "../utils/dateFormat.js";
import useCurrentUser from "../hooks/useCurrentUser.js";

const TYPE_FILTERS = ["ALL", "LINK", "PDF", "VIDEO"] as const;

export default function ResourcesPage() {
  const { user } = useCurrentUser();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFiletype, setNewFiletype] = useState("LINK");
  const [newSource, setNewSource] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showToast, setShowToast] = useState(false);

  const loadResources = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetchResources();
      const list = Array.isArray(data) ? data : data.resources || [];
      setResources(list);
    } catch (err) {
      if (err instanceof Error) setError(err.message || "Failed to load resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  // Scroll-lock body while create modal is open
  useEffect(() => {
    if (showCreateModal) document.body.classList.add("study-scroll-lock");
    else document.body.classList.remove("study-scroll-lock");
    return () => document.body.classList.remove("study-scroll-lock");
  }, [showCreateModal]);

  // Esc closes modal
  useEffect(() => {
    if (!showCreateModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCreateModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal]);

  // Auto-hide toast
  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 1700);
    return () => clearTimeout(t);
  }, [showToast]);

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateError("");
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewFiletype("LINK");
    setNewSource("");
    setUploadFile(null);
  };

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!newTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }

    const typeUpper = newFiletype.toUpperCase();
    const isFileUpload = typeUpper === "PDF" || typeUpper === "OTHER" || typeUpper === "VIDEO";

    try {
      setCreating(true);

      let created: any;
      if (isFileUpload) {
        if (!uploadFile) {
          setCreateError("Please choose a file to upload.");
          return;
        }
        const formData = new FormData();
        formData.append("title", newTitle.trim());
        formData.append("description", newDescription.trim());
        formData.append("filetype", typeUpper);
        if (user?.user_id) formData.append("uploader_id", String(user.user_id));
        formData.append("file", uploadFile);
        created = await apiUploadResourceFile(formData);
      } else {
        if (!newSource.trim()) {
          setCreateError("URL is required for links.");
          return;
        }
        created = await apiCreateResource({
          title: newTitle.trim(),
          description: newDescription.trim(),
          url: newSource.trim(),
          filetype: typeUpper,
          uploader_id: user?.user_id ?? null,
        });
      }

      if (created && created.resource_id) {
        setResources((prev) => [created, ...prev]);
      } else {
        await loadResources();
      }

      resetForm();
      setShowCreateModal(false);
      setShowToast(true);
    } catch (err) {
      if (err instanceof Error) setCreateError(err.message || "Failed to save resource");
      else setCreateError("Failed to save resource");
    } finally {
      setCreating(false);
    }
  };

  const filteredResources = resources.filter((r) => {
    const text = (r.title || "") + " " + (r.description || "");
    const matchesText = text.toLowerCase().includes(filter.toLowerCase());
    const ft = (r.filetype || "").toString().trim().toUpperCase();
    const matchesType = typeFilter === "ALL" || ft === typeFilter.toUpperCase();
    return matchesText && matchesType;
  });

  return (
    <div className="crews-page">
      <div className="crews-bg-layer" />

      <div className="crews-hero">
        <span className="crews-hero-ropes" aria-hidden />
        <h1 className="crews-hero-title">Learning Resources</h1>
      </div>

      <div className="crews-panel">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h2 className="crews-panel-title" style={{ flex: 1, minWidth: 0 }}>
            Browse the Shipmates Library
          </h2>
          <button
            className="btn-wood"
            onClick={() => setShowCreateModal(true)}
            style={{ marginTop: "-0.2rem" }}
          >
            + Share a Resource
          </button>
        </div>

        <div className="study-field">
          <label className="study-label">Search</label>
          <input
            className="study-input"
            type="text"
            placeholder="Search by title or description..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="resource-tabs">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              className={`resource-tab ${typeFilter === t ? "active" : ""}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === "ALL" ? "All" : t}
            </button>
          ))}
        </div>

        {error && <div className="study-notice study-notice-error">{error}</div>}

        {loading ? (
          <div className="study-empty">Loading resources…</div>
        ) : filteredResources.length === 0 ? (
          <div className="study-empty">No resources yet — be the first to share one!</div>
        ) : (
          <div style={{ marginTop: "0.5rem" }}>
            {filteredResources.map((r) => (
              <ResourceCard key={r.resource_id ?? r.id} resource={r} />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="study-fullmodal-backdrop" onClick={closeCreateModal}>
          <div
            className="study-fullmodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "620px" }}
          >
            <button
              className="study-fullmodal-close"
              onClick={closeCreateModal}
              aria-label="Close"
            >
              ×
            </button>

            <div style={{ paddingRight: "2.5rem" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", color: "var(--parchment)", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>
                Share a Resource
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.2rem", paddingBottom: "0.8rem", borderBottom: "1px solid rgba(212,168,67,0.3)" }}>
                Drop helpful resources here for the rest of the crew.
              </div>
            </div>

            <form onSubmit={handleCreateResource}>
              <div className="study-field">
                <label className="study-label">Title</label>
                <input
                  className="study-input"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Arrays in Data Structures"
                />
              </div>

              <div className="study-field">
                <label className="study-label">Description (optional)</label>
                <textarea
                  className="study-textarea"
                  style={{ minHeight: "90px" }}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Short note on why this is useful…"
                />
              </div>

              <div className="study-field">
                <label className="study-label">Type</label>
                <select
                  className="study-input"
                  value={newFiletype}
                  onChange={(e) => {
                    setNewFiletype(e.target.value);
                    setNewSource("");
                    setUploadFile(null);
                  }}
                >
                  <option value="LINK">Link</option>
                  <option value="PDF">PDF (upload)</option>
                  <option value="VIDEO">Video (upload)</option>
                  <option value="OTHER">Other file</option>
                </select>
              </div>

              {newFiletype === "LINK" ? (
                <div className="study-field">
                  <label className="study-label">URL</label>
                  <input
                    className="study-input"
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="https://example.com/article"
                  />
                </div>
              ) : (
                <div className="study-field">
                  <label className="study-label">File</label>
                  <input
                    className="study-input"
                    type="file"
                    accept={
                      newFiletype === "PDF"
                        ? ".pdf"
                        : newFiletype === "VIDEO"
                        ? "video/*"
                        : "*/*"
                    }
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    style={{ padding: "0.45rem 0.7rem" }}
                  />
                  {uploadFile && (
                    <span className="study-selected-chip">📄 {uploadFile.name}</span>
                  )}
                </div>
              )}

              {createError && (
                <div className="study-notice study-notice-error">{createError}</div>
              )}

              <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end", marginTop: "1.2rem" }}>
                <button
                  type="button"
                  className="btn-ghost-gold"
                  onClick={closeCreateModal}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-treasure" disabled={creating}>
                  {creating ? "Saving…" : "Add Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showToast && <div className="study-toast">Resource added</div>}
    </div>
  );
}

function ResourceCard({ resource }: { resource: Resource & { source?: string; url?: string; upload_date?: string; created_at?: string; createdAt?: string } }) {
  let url = (resource as any).source || (resource as any).url;
  if (url && url.startsWith("/uploads")) {
    url = `${API_BASE}${url}`;
  }
  const added =
    (resource as any).upload_date ||
    (resource as any).created_at ||
    (resource as any).createdAt;
  const filetype = (resource.filetype || "").toString().trim().toUpperCase() || "LINK";
  const title = resource.title || "Untitled resource";
  const desc = resource.description || "";

  return (
    <div className="resource-card">
      <div className="resource-card-body">
        <div className="resource-card-title-row">
          <div className="resource-card-title" title={title}>{title}</div>
          <span className={`resource-type-pill type-${filetype.toLowerCase()}`}>
            {filetype}
          </span>
        </div>
        {desc && <div className="resource-card-desc" title={desc}>{desc}</div>}
        <div className="resource-card-footer">
          {added && (
            <span className="resource-card-added">Added {formatDateOnly(added)}</span>
          )}
          {url && /^https?:\/\//i.test(url) && (
            <button
              type="button"
              className="btn-ghost-gold"
              style={{ fontSize: "0.72rem", padding: "0.35rem 0.8rem" }}
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              Open →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
